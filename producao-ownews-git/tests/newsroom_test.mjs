#!/usr/bin/env node
/* OWNews Live Newsroom (2026-10-20) — pipeline editorial do collector.
 * Carrega o worker REAL do collector (shrill-pond-a915-fix/worker.js) como
 * módulo (const→var para expor as funções) e testa, sem rede e sem IA real:
 * redator+gate+2ª tentativa (IA simulada), classes de reprovação, memória
 * de reprovação, dedup fato x assunto, idade da pauta, anti-cópia por prosa,
 * âncora/emprego do impacto, título, saúde editorial e escrita em KV. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(AQUI, "..", "..", "shrill-pond-a915-fix", "worker.js");
const codigo = fs.readFileSync(SRC, "utf8").replace(/^const /gm, "var ").replace(/^let /gm, "var ") +
  "\nexport const __t = { gerarCamadaEditorialIA, validarMateriaOWNews, validarImpactoPublicavel, trechoCopiadoDaFonte, parafraseRasaDaFonte, classeReprovacao, mesmoFatoTitulos, pautaAntiga, frasesCopiadasDaFonte, escolherTituloOWNews, calcularSaudeEditorial, acumularGateEditorial, obterGateEditorialStats, BuddyIAPoller, processarNoticias, BUDDY_IA_REJ_CORRIGIVEL_DESDE, BUDDY_IA_REJ_VALIDA_DESDE, PAUTA_IDADE_MAX_H, buscarCandidatosTelegram, validarTituloOWNews, decisaoMemoriaRejeicao, intervaloVarreduraEditorialMs, REJ_RECUPERACAO_APOS_H, REJ_RECUPERACAO_PAUTA_MAX_H, LIMITE_IDADE_CANDIDATO_HORAS_TELEGRAM, LIMITE_NOTICIAS_POR_DIA_TELEGRAM, SLOTS_NOTICIAS_TELEGRAM };\n";
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ownews-newsroom-")), "collector.mjs");
fs.writeFileSync(tmp, codigo);
const T = (await import(pathToFileURL(tmp).href)).__t;

let pass = 0, fail = 0;
async function test(nome, fn) {
  try { await fn(); pass++; console.log("  ✓ " + nome); }
  catch (e) { fail++; console.log("  ✗ " + nome + "\n      " + (e && e.message)); }
}
function expect(c, msg) { if (!c) throw new Error(msg || "falhou"); }

// ── Material real (Petrobras/Eixos, 19/10/2026 — P-82) ─────────────────────
const MATERIAL = "A Petrobras informou neste domingo (19) que a plataforma P-82 deixou o estaleiro Tuas Boulevard Yard, em Singapura, rumo ao campo de Búzios, no pré-sal da Bacia de Santos. A unidade é a décima plataforma destinada a Búzios. Com 345,3 metros de comprimento, 60 metros de largura e peso superior a 100 mil toneladas, a P-82 integra a série 80, composta por seis plataformas com capacidade para produzir 225 mil barris de óleo por dia e comprimir 12 milhões de metros cúbicos de gás. Segundo a diretora de Engenharia, Tecnologia e Inovação da Petrobras, Renata Baruzzi, a construção em série reduz custos e aumenta a produtividade nos estaleiros. A P-80 deixou o mesmo estaleiro dias antes e as duas unidades devem entrar em operação em 2027. Os módulos de processo foram fabricados no estaleiro Seatrium, em Aracruz, no Espírito Santo.";
const ARTIGO = { title: "Plataforma P-82 deixa estaleiro em Singapura rumo ao campo de Búzios", summary: "" };
const BOA = {
  relacao_offshore: "direta",
  titulo: "Plataforma P-82 deixa estaleiro em Singapura rumo ao campo de Búzios",
  buddy: "A P-82 saiu de Singapura e segue para o pré-sal de Búzios, na Bacia de Santos. É a décima unidade prevista para o campo.",
  corpo: [
    "Capaz de produzir 225 mil barris de óleo por dia e comprimir 12 milhões de metros cúbicos de gás, a P-82 tem 345,3 metros de comprimento. Ela faz parte da série 80, de seis unidades, e partiu do estaleiro Tuas Boulevard Yard rumo ao Brasil.",
    "Segundo a Petrobras, a P-80 já havia deixado o mesmo pátio dias antes; as duas devem começar a operar em 2027. Os módulos de processo vieram do estaleiro Seatrium, em Aracruz (ES). Para a diretora Renata Baruzzi, construir em série barateia o projeto."
  ],
  impacto: "A chegada da P-82 a Búzios amplia a campanha de instalação no pré-sal da Bacia de Santos, com comissionamento e logística de apoio até a entrada em operação prevista para 2027."
};
const resposta = (obj) => ({ choices: [{ message: { content: typeof obj === "string" ? obj : JSON.stringify(obj) } }] });
function iaFalsa(saidas) {
  const chamadas = [];
  return { chamadas, AI: { async run(modelo, input) { chamadas.push(input); const s = saidas[Math.min(chamadas.length - 1, saidas.length - 1)]; if (s instanceof Error) throw s; return resposta(s); } } };
}

console.log("\nLive Newsroom — redator, gate e segunda tentativa");

await test("redação aprovada de primeira (1 chamada)", async () => {
  const ia = iaFalsa([BOA]);
  const r = await T.gerarCamadaEditorialIA({ AI: ia.AI }, ARTIGO, MATERIAL, 1, {});
  expect(r.ok, JSON.stringify(r.motivos));
  expect(ia.chamadas.length === 1 && r.tentativas === 1);
});

await test("ficha técnica com os números da fonte não é cópia (dado ≠ prosa)", () => {
  const v = T.validarMateriaOWNews({ buddy_summary: BOA.buddy, why_it_matters: BOA.impacto, corpo: BOA.corpo.join("\n\n") }, ARTIGO, MATERIAL);
  expect(v.ok, v.motivos.join(","));
});

await test("frase copiada da fonte (prosa) continua reprovando", () => {
  const copia = "Segundo a diretora de Engenharia, Tecnologia e Inovação da Petrobras, Renata Baruzzi, a construção em série reduz custos e aumenta a produtividade nos estaleiros.";
  expect(T.trechoCopiadoDaFonte(copia, MATERIAL), "cópia literal passou");
  const corpo = [BOA.corpo[0], copia + " A P-80 também saiu antes."].join("\n\n");
  const v = T.validarMateriaOWNews({ buddy_summary: BOA.buddy, why_it_matters: BOA.impacto, corpo }, ARTIGO, MATERIAL);
  expect(v.motivos.includes("corpo:copia_fonte"), v.motivos.join(","));
});

await test("paráfrase rasa (troca de poucas palavras) continua reprovando", () => {
  const rasa = "A Petrobras comunicou neste domingo (19) que a plataforma P-82 saiu do estaleiro Tuas Boulevard Yard, em Singapura, rumo ao campo de Búzios, no pré-sal da Bacia de Santos. A unidade é a décima plataforma destinada a Búzios e integra a série 80, composta por seis plataformas com capacidade para produzir e comprimir gás.";
  expect(T.parafraseRasaDaFonte(rasa, MATERIAL) >= 0.4, String(T.parafraseRasaDaFonte(rasa, MATERIAL)));
});

await test("corpo reprovado (cópia) → 2ª tentativa dirigida cita a frase e aprova", async () => {
  const ruim = Object.assign({}, BOA, { corpo: ["Segundo a diretora de Engenharia, Tecnologia e Inovação da Petrobras, Renata Baruzzi, a construção em série reduz custos e aumenta a produtividade nos estaleiros.", BOA.corpo[1]] });
  const ia = iaFalsa([ruim, BOA]);
  const r = await T.gerarCamadaEditorialIA({ AI: ia.AI }, ARTIGO, MATERIAL, 1, {});
  expect(r.ok && r.tentativas === 2, JSON.stringify(r));
  const pedido = ia.chamadas[1].messages[1].content;
  expect(pedido.includes("repetem a matéria") && pedido.includes("Renata Baruzzi"), "2ª tentativa sem a frase reprovada");
  expect(ia.chamadas[1].temperature === 0.35, "temperatura da 2ª tentativa");
});

await test("Buddy reprovado (cópia) → 2ª tentativa; reprovada de novo = corrigível, máximo 2 chamadas", async () => {
  const ruim = Object.assign({}, BOA, { buddy: "Segundo a diretora de Engenharia, Tecnologia e Inovação da Petrobras, Renata Baruzzi, a construção em série reduz custos e aumenta a produtividade nos estaleiros. A P-82 é a décima." });
  const ia = iaFalsa([ruim, ruim, ruim]);
  const r = await T.gerarCamadaEditorialIA({ AI: ia.AI }, ARTIGO, MATERIAL, 1, {});
  expect(!r.ok && r.tentativas === 2 && ia.chamadas.length === 2, JSON.stringify(r));
  expect(r.motivos.some((m) => m.startsWith("buddy:")), r.motivos.join(","));
  expect(T.classeReprovacao(r.motivos) === "corrigivel");
});

await test("Impacto genérico reprovado → reescrito na 2ª tentativa", async () => {
  const ruim = Object.assign({}, BOA, { impacto: "Isso é importante para o setor offshore." });
  const ia = iaFalsa([ruim, BOA]);
  const r = await T.gerarCamadaEditorialIA({ AI: ia.AI }, ARTIGO, MATERIAL, 1, {});
  expect(r.ok && r.tentativas === 2, JSON.stringify(r.motivos || r));
});

await test("impacto: âncora no meio da frase conta (\"A decisão ... Petrobras\")", () => {
  const v = T.validarImpactoPublicavel("A saída da unidade da Petrobras acelera a campanha de instalação em Búzios.", ARTIGO, BOA.buddy, { fonte: MATERIAL });
  expect(!v.motivos.includes("sem_ancora"), v.motivos.join(","));
  const sem = T.validarImpactoPublicavel("A decisão acelera a campanha de instalação do setor.", ARTIGO, BOA.buddy, { fonte: MATERIAL });
  expect(sem.motivos.includes("sem_ancora"), "impacto sem nome/número passou");
});

await test("impacto com empregos: aceito quando a fonte (em inglês) informa jobs; reprovado sem base", () => {
  const fonteEn = "Sumitomo Electric opened the first UK HVDC subsea cable factory at the Port of Nigg in Scotland, creating more than 200 jobs.";
  const ok = T.validarImpactoPublicavel("A fábrica da Sumitomo em Nigg cria mais de 200 empregos e encurta o prazo de entrega de cabos submarinos.", { title: "Fábrica de cabos HVDC abre na Escócia", summary: "" }, "", { fonte: fonteEn });
  expect(!ok.motivos.includes("emprego_sem_base"), ok.motivos.join(","));
  const ko = T.validarImpactoPublicavel("A saída da P-82 abre vagas para quem trabalha na Petrobras.", ARTIGO, "", { fonte: MATERIAL });
  expect(ko.motivos.includes("emprego_sem_base"), ko.motivos.join(","));
});

await test("fora de escopo → reprovação definitiva sem 2ª tentativa", async () => {
  const ia = iaFalsa([{ relacao_offshore: "nenhuma", titulo: "", buddy: "", corpo: [], impacto: "" }]);
  const r = await T.gerarCamadaEditorialIA({ AI: ia.AI }, ARTIGO, MATERIAL, 1, {});
  expect(!r.ok && ia.chamadas.length === 1 && T.classeReprovacao(r.motivos) === "definitiva", JSON.stringify(r));
});

await test("conteúdo thin (sem material) → definitiva, nenhuma chamada de IA", async () => {
  const ia = iaFalsa([BOA]);
  const r = await T.gerarCamadaEditorialIA({ AI: ia.AI }, ARTIGO, "Nota curta sem fatos.", 1, {});
  expect(!r.ok && ia.chamadas.length === 0 && T.classeReprovacao(r.motivos) === "definitiva");
});

// Topo Fresco (2026-10-20): impacto vazio/sem relevância é falha de redação
// (a P-82 da Eixos ficou 3 dias condenada assim) — corrigível. Definitiva só
// escopo (relacao_offshore=nenhuma) e substância (sem material).
await test("gate corrigível: impacto vazio / sem relevância → corrigível (falha de redação, não de pauta)", () => {
  expect(T.classeReprovacao(["impacto:vazio", "corpo:copia_fonte"]) === "corrigivel");
  expect(T.classeReprovacao(["impacto:sem_relevancia_offshore"]) === "corrigivel");
  expect(T.classeReprovacao(["corpo:parafrase_rasa", "titulo:title_case"]) === "corrigivel");
});
await test("gate definitivo: fora de escopo e sem material continuam definitivos", () => {
  expect(T.classeReprovacao(["fora_escopo"]) === "definitiva");
  expect(T.classeReprovacao(["sem_material"]) === "definitiva");
});

await test("JSON degenerado na 2ª tentativa → reprovação corrigível da 1ª (não 'vazio')", async () => {
  const ruim = Object.assign({}, BOA, { impacto: "Isso é importante para o setor offshore." });
  const lixo = 'analysis: ...<|end|>assistantfinal {"relacao_off offshore":"direct"," buddy":"x"}';
  const ia = iaFalsa([ruim, lixo]);
  const r = await T.gerarCamadaEditorialIA({ AI: ia.AI }, ARTIGO, MATERIAL, 1, {});
  expect(!r.ok && !r.erro && r.degenerou && r.motivos.some((m) => m.startsWith("impacto:")), JSON.stringify(r));
  expect(T.classeReprovacao(r.motivos) === "corrigivel");
});

await test("JSON inválido na 1ª tentativa → falha técnica (não memoriza)", async () => {
  const r = await T.gerarCamadaEditorialIA({ AI: iaFalsa(["sem json aqui"]).AI }, ARTIGO, MATERIAL, 1, {});
  expect(r.erro === "ia_json_invalido", JSON.stringify(r));
});

await test("Workers AI indisponível / cota 4006 / timeout → erro técnico (tenta no próximo ciclo)", async () => {
  expect((await T.gerarCamadaEditorialIA({}, ARTIGO, MATERIAL, 1, {})).erro === "ia_indisponivel");
  const cota = await T.gerarCamadaEditorialIA({ AI: iaFalsa([new Error("4006: you have used up your daily free allocation of 10,000 neurons")]).AI }, ARTIGO, MATERIAL, 1, {});
  expect(/^ia_erro:4006/.test(cota.erro), cota.erro);
  const to = await T.gerarCamadaEditorialIA({ AI: iaFalsa([new Error("timeout")]).AI }, ARTIGO, MATERIAL, 1, {});
  expect(/^ia_erro:timeout/.test(to.erro), to.erro);
});

await test("título: tradução automática só vale se o redator a endossou nas 2 redações", () => {
  const trad = "SSE escolhe Seaway7 para fundações e cabos do parque eólico Berwick Bank B";
  const fonte = "SSE picks Seaway7 for Berwick Bank B offshore wind foundations and cables";
  expect(!T.escolherTituloOWNews(trad, trad, fonte, true, false).ok, "1ª redação não pode publicar tradução");
  expect(T.escolherTituloOWNews(trad, trad, fonte, true, true).ok, "endosso na 2ª redação");
  expect(!T.escolherTituloOWNews("SSE Escolhe Seaway7 Para Fundações Do Parque", "SSE Escolhe Seaway7 Para Fundações Do Parque", fonte, true, true).ok, "Title Case endossado passou");
});

await test("título em português natural (Title Case importado reprovado)", () => {
  const r = T.escolherTituloOWNews("Fugro, EirGrid Completa Pesquisas Marítimas Para Ligação", "Fugro e EirGrid concluem pesquisas marítimas para ligação eólica na Irlanda", "Fugro and EirGrid complete marine surveys for Ireland wind link", false, false);
  expect(r.ok && /concluem/.test(r.titulo), JSON.stringify(r));
});

console.log("\nLive Newsroom — descoberta, dedup e memória de reprovação");

await test("dedup: mesmo FATO (título parecido + mesmo número) é duplicata", () => {
  expect(T.mesmoFatoTitulos("Par de perfurações da Transocean soma US$ 550 milhões em novos contratos", "TRANSOCEAN AMPLIA CARTEIRA DE CONTRATOS EM US$ 550 MILHÕES COM CAMPANHAS DE PERFURAÇÃO", 0.2));
});

await test("dedup: mesmo ASSUNTO, fato diferente, não é duplicata", () => {
  expect(!T.mesmoFatoTitulos("Estoques de petróleo nos EUA caem 8,557 milhões de barris, aponta DoE", "PRODUÇÃO DE PETRÓLEO DA UNIÃO ATINGE 313 MIL BARRIS POR DIA EM AGOSTO", 0.2));
  expect(!T.mesmoFatoTitulos("Transocean fecha contrato de US$ 120 milhões para sonda no Brasil", "Transocean publica Fleet Status de outubro", 0.2));
});

await test("dedup: título quase idêntico continua duplicata (limiar normal)", () => {
  expect(T.mesmoFatoTitulos("Petrobras contrata FPSO para o campo de Búzios", "Petrobras contrata FPSO para campo de Búzios", 0.55));
});

await test("pauta com mais de 72h não vai para a IA; data ausente decide depois", () => {
  expect(T.PAUTA_IDADE_MAX_H === 72);
  expect(T.pautaAntiga(new Date(Date.now() - 80 * 3600000).toISOString()));
  expect(!T.pautaAntiga(new Date(Date.now() - 30 * 3600000).toISOString()));
  expect(!T.pautaAntiga(null) && !T.pautaAntiga("data inválida"));
  expect(!T.pautaAntiga("2026-10-20T09:00:00-03:00".replace("2026-10-20", new Date().toISOString().slice(0, 10))), "BRT");
});

await test("memória de reprovação: corrigível de versão anterior expira; definitiva vale 3 dias", async () => {
  const mapa = new Map();
  const storage = { async list() { return new Map(mapa); }, async delete(ks) { ks.forEach((k) => mapa.delete(k)); }, async put(k, v) { mapa.set(k, v); }, async get(k) { return mapa.get(k); }, async getAlarm() { return 1; }, async setAlarm() {} };
  const poller = new T.BuddyIAPoller({ storage }, {});
  const antes = T.BUDDY_IA_REJ_CORRIGIVEL_DESDE - 3600000;
  mapa.set("rej:legado", antes);                                   // número antigo (sem classe)
  mapa.set("rej:corr-velha", { t: antes, c: "corrigivel" });
  const tDef = Math.max(antes, T.BUDDY_IA_REJ_VALIDA_DESDE + 1);
  mapa.set("rej:def-velha", { t: tDef, c: "definitiva" });
  mapa.set("rej:expirada", { t: Date.now() - 4 * 86400000, c: "definitiva" });
  await poller.fetch(new Request("https://buddy-ia.interno/rejeitar", { method: "POST", body: JSON.stringify({ hash: "nova", classe: "corrigivel" }) }));
  const vivos = await (await poller.fetch(new Request("https://buddy-ia.interno/rejeicoes"))).json();
  // definitiva vale 3 dias a partir do próprio t (não do marco de versão)
  const esperado = Date.now() - tDef < 3 * 86400000 ? ["def-velha", "nova"] : ["nova"];
  expect(JSON.stringify(vivos.sort()) === JSON.stringify(esperado.sort()), JSON.stringify(vivos));
  expect(!mapa.has("rej:expirada"), "expirada não foi limpa");
});

console.log("\nLive Newsroom — observabilidade e KV");

const AGORA = Date.parse("2026-10-20T15:00:00Z");
const art = (h, extra) => Object.assign({ published_at: new Date(AGORA - h * 3600000).toISOString(), created_at: new Date(AGORA - h * 3600000 + 2 * 3600000).toISOString(), buddy_source: "ownews" }, extra || {});

await test("saúde VERDE: publicação recente e IA ok", () => {
  const s = T.calcularSaudeEditorial({ agora: AGORA, artigos: [art(2), art(5)], gate: { "24h": { ia_avaliadas: 6, publicadas: 3, taxa_aprovacao_ia: 50 }, ia: { ultima_resposta: new Date(AGORA - 3600000).toISOString() } }, automacao: { fontes_com_erro: [] } });
  expect(s.status === "VERDE" && s.publicadas_24h === 2 && s.latencia_mediana_h_7d === 2, JSON.stringify(s));
});

await test("saúde AMARELO: 7h sem publicar / aprovação baixa / fonte com erro", () => {
  // art(9): fonte de 9h atrás gravada 2h depois → 7h sem publicar no OWNews.
  const s = T.calcularSaudeEditorial({ agora: AGORA, artigos: [art(9)], gate: { "24h": { ia_avaliadas: 8, publicadas: 1, taxa_aprovacao_ia: 12 }, ia: {} }, automacao: { fontes_com_erro: ["antaq"] } });
  expect(s.status === "AMARELO" && s.motivos.length === 3, JSON.stringify(s.motivos));
});

await test("saúde VERMELHO + alerta de silêncio: 22h sem publicar com pautas chegando", () => {
  const s = T.calcularSaudeEditorial({ agora: AGORA, artigos: [art(22.5)], gate: { "24h": { ia_avaliadas: 3, barradas_memoria: 85, editorial_incomplete: 103, publicadas: 0, taxa_aprovacao_ia: 0 }, ia: {} }, automacao: {} });
  expect(s.status === "VERMELHO" && s.silencio_alerta === true, JSON.stringify(s));
});

await test("saúde VERMELHO: cota de Workers AI esgotada (ia_status=cota_esgotada)", () => {
  const s = T.calcularSaudeEditorial({ agora: AGORA, artigos: [art(1)], gate: { "24h": {}, ia: { ultima_resposta: new Date(AGORA - 5 * 3600000).toISOString(), ultima_falha: new Date(AGORA - 600000).toISOString(), ultima_falha_motivo: "ia_erro:4006: you have used up your daily free allocation" } }, automacao: {} });
  expect(s.status === "VERMELHO" && s.ia_status === "cota_esgotada" && !s.silencio_alerta, JSON.stringify(s));
});

await test("KV: acumulador do gate grava 1x por rodada com dado e 0x sem dado", async () => {
  let puts = 0; const kv = { async get() { return []; }, async put() { puts++; } };
  await T.acumularGateEditorial({ SAUDE_KV: kv }, { petronoticias: { ok: true, inseridas: 1, editorial_incomplete: 1, ia_avaliadas: 2, aprovadas_2a: 1, rep_corrigivel: 1, noticias: [{ status: "editorial_incomplete", motivo: "sem_buddy_valido" }] } });
  await T.acumularGateEditorial({ SAUDE_KV: kv }, { anp: { ok: true, inseridas: 0, editorial_incomplete: 0, noticias: [] } });
  expect(puts === 1, "puts=" + puts);
});

await test("KV: estatística 24h expõe funil (IA avaliou, 2ª tentativa, corrigível, taxa real)", async () => {
  // "ap" = aprovadas PELA IA; a taxa não usa mais "publicadas" (passava de 100%).
  const entrada = { ts: Date.now() - 3600000, fontes: { eixos: { p: 2, ei: 3, cs: 0, motivos: { reprovada_recente: 2, sem_buddy_valido: 1 }, ia: 4, ap: 2, a2: 1, rc: 1, rd: 1, rr: 2, ant: 0, rec: 1, rok: 1 } } };
  const antiga = { ts: Date.now() - 7200000, fontes: { petrobras: { p: 5, ei: 0, cs: 0, motivos: {}, ia: 2 } } }; // sem "ap": fora da taxa
  const s = await T.obterGateEditorialStats({ SAUDE_KV: { async get() { return [entrada, antiga]; } } });
  const d = s["24h"];
  expect(d.ia_avaliadas === 6 && d.ia_aprovadas === 2 && d.aprovadas_2a === 1 && d.taxa_aprovacao_ia === 50 && d.barradas_memoria === 2 && d.recuperacoes === 1 && d.recuperadas === 1, JSON.stringify(d));
});

console.log("\nTopo Fresco — memória, recuperação, latência e cadência");

const H = 3600000;
await test("reprocessamento: corrigível de pauta nova ganha UMA recuperação depois de 2h", () => {
  const agora = Date.now();
  const rej = { c: "corrigivel", n: 1, t: agora - 3 * H, m: ["buddy:copia_fonte"] };
  expect(T.decisaoMemoriaRejeicao(rej, 10, agora) === "recuperar");
  expect(T.decisaoMemoriaRejeicao({ ...rej, t: agora - 1 * H }, 10, agora) === "bloquear", "antes de 2h espera");
  expect(T.decisaoMemoriaRejeicao({ ...rej, n: 2 }, 10, agora) === "bloquear", "sem loop: 2ª reprovação bloqueia 3 dias");
  expect(T.decisaoMemoriaRejeicao(rej, T.REJ_RECUPERACAO_PAUTA_MAX_H + 1, agora) === "bloquear", "pauta velha não gasta IA");
  expect(T.decisaoMemoriaRejeicao(null, 10, agora) === "avaliar");
});
await test("gate definitivo nunca é recuperado", () => {
  expect(T.decisaoMemoriaRejeicao({ c: "definitiva", n: 1, t: Date.now() - 20 * H }, 5, Date.now()) === "bloquear");
});
await test("memória v2: 2ª reprovação incrementa n e guarda motivos/título/fonte", async () => {
  const mem = new Map();
  const state = { storage: { async get(k) { return mem.get(k); }, async put(k, v) { mem.set(k, v); }, async list() { return new Map([...mem].filter(([k]) => k.startsWith("rej:"))); }, async delete() {}, async getAlarm() { return 1; }, async setAlarm() {} } };
  const p = new T.BuddyIAPoller(state, {});
  const post = (b) => p.fetch(new Request("https://buddy-ia.interno/rejeitar", { method: "POST", body: JSON.stringify(b) }));
  await post({ hash: "h1", classe: "corrigivel", motivos: ["impacto:vazio"], titulo: "P-82 deixa Singapura", fonte: "Eixos" });
  expect(mem.get("rej:h1").n === 1 && mem.get("rej:h1").ti === "P-82 deixa Singapura" && mem.get("rej:h1").m[0] === "impacto:vazio", JSON.stringify(mem.get("rej:h1")));
  await post({ hash: "h1", classe: "corrigivel", motivos: ["corpo:copia_fonte"] });
  expect(mem.get("rej:h1").n === 2, JSON.stringify(mem.get("rej:h1")));
  const v2 = await (await p.fetch(new Request("https://buddy-ia.interno/rejeicoes?v=2"))).json();
  expect(v2.h1 && v2.h1.n === 2 && v2.h1.c === "corrigivel", JSON.stringify(v2));
  const v1 = await (await p.fetch(new Request("https://buddy-ia.interno/rejeicoes"))).json();
  expect(Array.isArray(v1) && v1[0] === "h1", "formato antigo preservado");
});
await test("writer failure (erro técnico) não memoriza; corrigível memoriza com motivos", async () => {
  expect(T.classeReprovacao(["buddy:copia_fonte"]) === "corrigivel");
  const ia = { AI: { async run() { throw new Error("4006: daily free allocation"); } } };
  const r = await T.gerarCamadaEditorialIA(ia, ARTIGO, MATERIAL, 1, {});
  expect(!r.ok && r.erro && r.erro.startsWith("ia_erro"), JSON.stringify(r));
});
await test("source latency: p50/p90 fonte→OWNews em 24h e 7d; 24h conta a publicação OWNews (created_at)", () => {
  const AG = Date.parse("2026-10-20T16:00:00Z");
  const a = (fonteH, gravH) => ({ buddy_source: "ownews", published_at: new Date(AG - fonteH * H).toISOString(), created_at: new Date(AG - gravH * H).toISOString() });
  // P-82: fonte 25h atrás, gravada 1h atrás → conta como publicada nas 24h.
  const s = T.calcularSaudeEditorial({ agora: AG, artigos: [a(6, 3), a(25, 1), a(26, 25)], gate: { "24h": {}, ia: {} }, automacao: {} });
  expect(s.publicadas_24h === 2 && s.publicadas_24h_fonte_24h === 1, JSON.stringify(s));
  expect(s.latencia_fonte_ownews.p50_24h === 24 && s.latencia_fonte_ownews.amostras_24h === 2, JSON.stringify(s.latencia_fonte_ownews));
  expect(s.idade_ultima_publicacao_h === 1 && s.idade_noticia_mais_nova_h === 6, JSON.stringify(s));
});
await test("saúde: taxa de aprovação null (sem amostra) não vira 'aprovação baixa'", () => {
  const s = T.calcularSaudeEditorial({ agora: AGORA, artigos: [art(2)], gate: { "24h": { ia_avaliadas: 5, taxa_aprovacao_ia: null }, ia: {} }, automacao: {} });
  expect(s.status === "VERDE", JSON.stringify(s.motivos));
});
await test("título Title Case com 'para' minúsculo é reprovado; título natural com nomes próprios passa", () => {
  const tc = "A Petrobrás Adia o Acostamento da P-35 no Estaleiro Inhaúma e se Prepara para Receber a Plataforma P-82 que Saiu de Cingapura em Direção ao Brasil";
  expect(T.validarTituloOWNews(tc, "").includes("title_case"), JSON.stringify(T.validarTituloOWNews(tc, "")));
  for (const ok of ["Petrobras e Equinor assinam acordo para Raia Pequena", "Fórum Sebrae debate cadeia de óleo e gás em Macaé", "Plataforma P-82 deixa estaleiro em Singapura rumo ao campo de Búzios", "Seminário da ANP debate desempenho da indústria de petróleo e gás em segurança operacional e meio ambiente"])
    expect(!T.validarTituloOWNews(ok, "").includes("title_case"), ok);
});
await test("saúde: taxa baixa só com amostra real (entradas com contador de aprovadas)", () => {
  const s = T.calcularSaudeEditorial({ agora: AGORA, artigos: [art(2)], gate: { "24h": { ia_avaliadas: 7, ia_avaliadas_amostra_taxa: 2, taxa_aprovacao_ia: 0 }, ia: {} }, automacao: {} });
  expect(s.status === "VERDE", JSON.stringify(s.motivos));
});
await test("sem_material não conta como avaliação da IA (reprova antes da chamada)", async () => {
  const r = await T.gerarCamadaEditorialIA({ AI: { async run() { throw new Error("não deveria chamar"); } } }, ARTIGO, "curto", 1, {});
  expect(!r.ok && !r.erro && r.motivos[0] === "sem_material", JSON.stringify(r));
});
await test("cron: varredura a cada 30 min das 05:20 às 20:20 BRT, 60 min de madrugada", () => {
  expect(T.intervaloVarreduraEditorialMs(Date.parse("2026-10-20T08:50:00Z")) === 30 * 60000);
  expect(T.intervaloVarreduraEditorialMs(Date.parse("2026-10-20T22:50:00Z")) === 30 * 60000);
  expect(T.intervaloVarreduraEditorialMs(Date.parse("2026-10-20T03:00:00Z")) === 60 * 60000);
  expect(T.intervaloVarreduraEditorialMs(Date.parse("2026-10-20T23:30:00Z")) === 60 * 60000);
});

console.log("\nLive Newsroom — Telegram");

await test("Telegram: só matéria OWNews de até 24h entra como candidata; 2 notícias/dia nos slots 08:50/17:50", async () => {
  let url = "";
  const orig = globalThis.fetch;
  globalThis.fetch = async (u) => { url = String(u); return new Response("[]", { status: 200 }); };
  try { await T.buscarCandidatosTelegram({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }); }
  finally { globalThis.fetch = orig; }
  expect(url.includes("buddy_source=eq.ownews") && url.includes("status=eq.published"), url);
  const corte = Date.parse(decodeURIComponent(url.match(/published_at=gte\.([^&]+)/)[1]));
  expect(Date.now() - corte <= 24 * 3600000 + 60000, "janela maior que 24h");
  expect(T.LIMITE_IDADE_CANDIDATO_HORAS_TELEGRAM === 24 && T.LIMITE_NOTICIAS_POR_DIA_TELEGRAM === 2);
  expect(T.SLOTS_NOTICIAS_TELEGRAM.map((s) => s.horaAlvoBRT + ":" + s.minAlvoBRT).join(",") === "8:50,17:50");
});

console.log("\nFontes e originalidade (auditoria 2026-10-22) — pipeline");

await test("título: tradução literal reprovada (jogador, nave, par de perfurações, 'X, Y completa')", () => {
  for (const t of ["Jogador de petróleo do Paquistão escolhe empresa norueguesa para aquisição de dados", "Nave de construção submarina pronta para metanol chega à Noruega", "Par de perfurações da Transocean soma US$ 550 milhões em novos contratos", "Fugro, EirGrid completa pesquisas marítimas para ligação eólica"])
    expect(T.validarTituloOWNews(t, "").includes("traducao_literal"), t);
  expect(!T.validarTituloOWNews("Duas sondas da Transocean somam US$ 550 milhões em novos contratos no Golfo dos EUA", "").includes("traducao_literal"));
});
await test("título: especificação virou quantidade ('20 mil árvores' de '20,000 psi') é reprovado", () => {
  const f = "TechnipFMC will supply 20,000 psi (20K) subsea tree systems to BP.";
  expect(T.validarTituloOWNews("TechnipFMC fornecerá 20 mil árvores submarinas de 20K psi à BP nos EUA", f).includes("numero_unidade_trocada"));
  expect(!T.validarTituloOWNews("TechnipFMC vai fornecer árvores submarinas de 20 mil psi para a BP nos EUA", f).includes("numero_unidade_trocada"));
});
await test("matéria: número trocado e impacto especulativo viram 2ª redação dirigida (corrigível)", async () => {
  const ruim = Object.assign({}, BOA, { impacto: "A chegada da P-82 a Búzios pode elevar a demanda por serviços para a cadeia offshore da Bacia de Santos." });
  const ia = iaFalsa([ruim, BOA]);
  const r = await T.gerarCamadaEditorialIA({ AI: ia.AI }, ARTIGO, MATERIAL, 1, {});
  expect(r.ok && r.tentativas === 2, JSON.stringify(r));
  expect(/não especule/.test(ia.chamadas[1].messages[1].content), "dica do especulativo ausente");
  expect(T.classeReprovacao(["impacto:especulativo", "corpo:numero_unidade_trocada"]) === "corrigivel");
});
await test("índice de newsletter ('NESTA EDIÇÃO' + legenda) → sem_material, nenhuma chamada de IA", async () => {
  const ia = iaFalsa([BOA]);
  const m = "As unidades de hidrotratamento da Refinaria Abreu e Lima (RNEST), da Petrobras, reduzem enxofre. Foto: Fernando Frazão/Agência Brasil NESTA EDIÇÃO. Maior consumo de diesel puxou aumento de emissões do setor energético, aponta Seeg. Brasil ficou a 85 milhões de toneladas de distância da NDC para 2025. No mundo, agência da ONU fala em buscar menor excesso possível, já que 1,5 grau está em vias de ser ultrapassado.";
  const r = await T.gerarCamadaEditorialIA({ AI: ia.AI }, { title: "Diesel segue puxando emissões", summary: "" }, m, 1, {});
  expect(!r.ok && r.motivos[0] === "sem_material" && ia.chamadas.length === 0, JSON.stringify(r));
});
await test("anti-paráfrase: limiar 0,3 (reescrita colada em fonte em português vai para 2ª redação)", () => {
  const src = fs.readFileSync(SRC, "utf8");
  expect(src.includes("if (parafraseRasaDaFonte(t, fonte) >= 0.3) m.push('parafrase_rasa');"));
});
await test("dedup de evento entre idiomas: Buddy >= 0,4 e corpo >= 0,4 (BP/TechnipFMC 21/10)", () => {
  const src = fs.readFileSync(SRC, "utf8");
  expect(src.includes("return sb >= 0.6 || (sb >= 0.4 && !!r.content && simMin(camadaIA.corpo, r.content) >= 0.4);"));
  expect(/select=id,title,image_credit,original_url,buddy_summary,buddy_source,content&status=eq\.published/.test(src), "recentes sem content");
});

console.log("\n" + pass + " passaram, " + fail + " falharam");
process.exit(fail ? 1 : 0);
