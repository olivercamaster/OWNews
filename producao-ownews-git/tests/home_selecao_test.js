#!/usr/bin/env node
/* P0 Freshness dos destaques (2026-10-20) — seleção canônica da Home.
 * Extrai do worker.js a MESMA função usada pelo SSR e por /api/home-selecao
 * (selecionarHomeServidor) e roda cenários determinísticos (relógio fixo). */
const fs = require("fs");
const path = require("path");

const FRONT = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");
function trecho(ini, fim) {
  const a = FRONT.indexOf(ini);
  if (a < 0) throw new Error("marcador ausente: " + ini);
  const b = FRONT.indexOf(fim, a);
  if (b < 0) throw new Error("marcador ausente: " + fim);
  return FRONT.slice(a, b);
}
const editoriaSrc = trecho("const FONTES_INTERNACIONAIS_SERVIDOR", "/* ==== CAMADA EDITORIAL: INICIO ====");
const camadaSrc = trecho("/* ==== CAMADA EDITORIAL: INICIO ====", "/* ==== CAMADA EDITORIAL: FIM ==== */");
const qSrc = trecho("/* ==== QUALIDADE EDITORIAL 2.1: INICIO ====", "/* ==== QUALIDADE EDITORIAL 2.1: FIM ==== */");
const qtdSrc = trecho("/* ACONTECEU NO OFFSHORE — quantidade fixa", "// Home 3.0: resumo institucional");
const selSrc = trecho("const PALAVRAS_BREAKING_SERVIDOR", "function homeSsrCapa(n, classe");
const canonSrc = trecho("function selecaoCanonicaHome(selecao)", "async function responderHomeSelecao");
const tempoSrc = trecho("function tempoRelativoOuData(data, agora)", "const PALAVRAS_IRRELEVANTES_RELACIONADAS");

const esc = (s) => String(s == null ? "" : s);
const H = new Function("escaparHTML", "decodificarEntidadesHTMLServidor",
  qtdSrc + "\n" + editoriaSrc + "\n" + camadaSrc + "\n" + qSrc + "\n" + selSrc + "\n" + canonSrc + "\n" + tempoSrc +
  "\nreturn { selecionarHomeServidor, homeScoreServidor, fatorFrescorHome, diagnosticoHome, selecaoCanonicaHome, HOME_SCORE_FORTE, editoriaDeServidor, materiaInternacional, tempoRelativoOuData, injetarNoticiasHome: typeof injetarNoticiasHome === 'function' ? injetarNoticiasHome : null };"
)(esc, esc);

let pass = 0, fail = 0;
function test(nome, fn) {
  try { fn(); pass++; console.log("  ✓ " + nome); }
  catch (e) { fail++; console.log("  ✗ " + nome + "\n      " + e.message); }
}
function expect(c, msg) { if (!c) throw new Error(msg || "falhou"); }

// Relógio fixo: 20/10/2026 09:16 BRT = 12:16 UTC (momento da observação).
const AGORA = Date.parse("2026-10-20T12:16:00Z");
const CORPO = "Primeiro parágrafo da matéria OWNews com fatos e contexto suficientes para leitura completa, escrito a partir do material da fonte e revisado pelo gate editorial do portal.\n\nSegundo parágrafo com o contexto do setor offshore, detalhes do contrato, prazos, operadora envolvida e o que muda para quem trabalha embarcado nas unidades da bacia.";
// Títulos de pautas diferentes (a regra de diversidade compara títulos).
const TEMAS = ["Equinor anuncia descoberta no mar do Norte", "Sindicato aprova acordo coletivo na Bahia", "ANP divulga produção recorde de agosto",
  "Navio de apoio chega ao porto do Açu", "Seadrill renova sonda na Malásia", "Leilão de áreas atrai sete operadoras", "Helicóptero ganha nova base em Jacarepaguá",
  "Shell investe em captura de carbono", "Estaleiro gaúcho retoma obras de casco", "Preço do Brent recua com estoques altos", "Prio conclui aquisição de campo maduro"];
let seq = 0;
function art(horas, score, extra) {
  seq++;
  return Object.assign({
    id: "a" + seq,
    title: TEMAS[seq % TEMAS.length] + " (" + seq + ")",
    summary: "Resumo " + seq,
    content: CORPO,
    buddy_source: "ownews",
    image_url: "https://img.example/" + seq + ".jpg",
    image_credit: "Fonte" + seq,
    published_at: new Date(AGORA - horas * 3600000).toISOString(),
    editorial_score: score
  }, extra || {});
}
const idade = (n) => (AGORA - Date.parse(n.published_at)) / 3600000;
const ordenar = (l) => l.slice().sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

console.log("\nSeleção da Home — freshness + relevância");

test("CASO 1: forte de 22h perde para quase tão forte de 3h", () => {
  const A = art(22, 85), B = art(3, 80);
  const s = H.selecionarHomeServidor(ordenar([A, B, art(5, 60), art(8, 55)]), AGORA);
  expect(s.hero.id === B.id, "hero=" + s.hero.title);
});

test("CASO 1b: reprodução de 20/10 — matéria de 22h (75) vs nova de 2h (63) → nova", () => {
  const eni = art(22.5, 75), transocean = art(23.5, 85), nova = art(2, 63);
  const s = H.selecionarHomeServidor(ordenar([eni, transocean, nova]), AGORA);
  expect(s.hero.id === nova.id, "hero=" + s.hero.title);
});

test("CASO 2: extraordinária de 10h vence fraca de 1h", () => {
  const A = art(10, 100), B = art(1, 40);
  const s = H.selecionarHomeServidor(ordenar([A, B, art(4, 45), art(6, 42)]), AGORA);
  expect(s.hero.id === A.id, "hero=" + s.hero.title);
});

test("CASO 2b: faixa C (14h, 100) só vale sem forte mais nova — mediana forte de 2h vence", () => {
  const A = art(14, 100), B = art(2, 60);
  const s = H.selecionarHomeServidor(ordenar([A, B, art(5, 50)]), AGORA);
  expect(s.hero.id === B.id, "hero=" + s.hero.title);
});

test("CASO 2c: mesma excepcional com 22h já cede para a mediana de 2h", () => {
  const A = art(22, 100), B = art(2, 60);
  const s = H.selecionarHomeServidor(ordenar([A, B, art(5, 50)]), AGORA);
  expect(s.hero.id === B.id, "hero=" + s.hero.title);
});

test("CASO 2d: palavra de urgência no resumo não segura matéria velha (só título conta, como bônus)", () => {
  const velha = art(20, 70, { summary: "Operação de resgate concluída" }), nova = art(2, 70);
  const s = H.selecionarHomeServidor(ordenar([velha, nova, art(6, 55)]), AGORA);
  expect(s.hero.id === nova.id, "hero=" + s.hero.title);
});

test("CASO 3: nada forte em 24h → a melhor válida de 24h; 24–48h só completa secundárias", () => {
  const nova = art(20, 45);
  const l = ordenar([art(30, 85), art(40, 70), nova]);
  const s = H.selecionarHomeServidor(l, AGORA);
  expect(s.hero.id === nova.id, "hero=" + s.hero.title);
  expect(s.laterais.map(idade).join() === "30,40", "laterais=" + s.laterais.map(idade).join());
  expect(s.ultimas.length === 0, "últimas repetem o bloco: " + s.ultimas.length);
});

test("CASO 3b: nada em 48h → null (Home mostra estado vazio honesto)", () => {
  expect(H.selecionarHomeServidor([art(60, 90), art(72, 95)], AGORA) === null);
});

test("CASO 4: 4 recentes da mesma editoria → diversidade sem matar frescor", () => {
  const contrato = (h, s) => art(h, s, { title: "Empresa " + h + " assina contrato de afretamento distinto " + h });
  const l = ordenar([contrato(1, 80), contrato(2, 78), contrato(3, 77), contrato(4, 76), art(5, 70)]);
  const s = H.selecionarHomeServidor(l, AGORA);
  const eds = [s.hero, ...s.laterais].map((n) => /contrato/.test(n.title) ? "C" : "O");
  expect(eds.filter((e) => e === "C").length <= 3, eds.join(""));
  expect(s.laterais.some((n) => !/contrato/.test(n.title)), "outra editoria ficou de fora");
  expect([s.hero, ...s.laterais].every((n) => (AGORA - Date.parse(n.published_at)) / 3600000 <= 6), "perdeu frescor");
});

test("CASO 4b: mesma pauta não ocupa duas vagas quando há alternativa", () => {
  const a = art(1, 80, { title: "Petrobras contrata FPSO para campo de Búzios" });
  const b = art(2, 79, { title: "Petrobras contrata FPSO para o campo de Búzios" });
  const s = H.selecionarHomeServidor(ordenar([a, b, art(3, 60), art(4, 60), art(5, 60)]), AGORA);
  const ids = [s.hero, ...s.laterais].map((n) => n.id);
  expect(!(ids.includes(a.id) && ids.includes(b.id)), "mesma pauta duplicada: " + [s.hero, ...s.laterais].map((n) => n.title).join(" / "));
});

test("CASO 5: matéria >24h não é manchete quando há alternativa recente elegível", () => {
  const velha = art(26, 100), nova = art(10, 55);
  const s = H.selecionarHomeServidor(ordenar([velha, nova, art(12, 52)]), AGORA);
  expect(s.hero.id === nova.id, "hero=" + s.hero.title);
});

test("CASO 5b: >24h nunca volta a ser manchete (sem exceção por score)", () => {
  const velha = art(26, 100), fraca = art(3, 35);
  const s = H.selecionarHomeServidor(ordenar([velha, fraca, art(30, 90)]), AGORA);
  expect(s.hero.id === fraca.id, "hero=" + s.hero.title);
  expect(s.laterais.map(idade).join() === "26,30", "secundárias 24–48h por recência: " + s.laterais.map(idade).join());
});

test("CASO 6: seleção muda sozinha quando o relógio anda / chega matéria nova", () => {
  const a = art(1, 70);
  const l1 = ordenar([a, art(8, 60), art(9, 60)]);
  expect(H.selecionarHomeServidor(l1, AGORA).hero.id === a.id);
  const b = art(0.2, 72);
  expect(H.selecionarHomeServidor(ordenar([b, ...l1]), AGORA).hero.id === b.id, "nova não assumiu");
  // 30h depois, sem nada novo: topo vazio (sem manchete), Últimas mantém as reais
  const s30 = H.selecionarHomeServidor(l1, AGORA + 30 * 3600000);
  expect(s30.hero === null && s30.laterais.length === 0 && s30.ultimas.length === 3, JSON.stringify(H.selecaoCanonicaHome(s30)));
  // 50h depois: nada em 48h → null
  expect(H.selecionarHomeServidor(l1, AGORA + 50 * 3600000) === null);
});

test("CASO 6b: cache — Home 300s e /api/home-selecao 120s na borda; cliente busca a API a cada refresh", () => {
  expect(/pathname === "\/api\/home-selecao"[\s\S]{0,120}respostaCacheada\(request, ctx, 120,/.test(FRONT), "TTL API");
  expect(FRONT.includes("fetch('/api/home-selecao')"), "cliente não reconsulta a API");
  expect(FRONT.includes("paraCliente.headers.set('Cache-Control', 'public, max-age=60')"), "navegador revalida em 60s");
});

test("CASO 7: timezone — published_at com offset UTC/BRT dá a mesma idade", () => {
  const utc = art(3, 70, { published_at: "2026-10-20T09:16:00+00:00" });
  const brt = art(3, 70, { published_at: "2026-10-20T06:16:00-03:00" });
  expect(Math.abs(H.homeScoreServidor(utc, AGORA) - H.homeScoreServidor(brt, AGORA)) < 1e-9);
  expect(H.fatorFrescorHome(3) === 1);
});

test("CASO 7b: relógio da fonte adiantado ≤15 min é aceito; >15 min no futuro fica fora", () => {
  expect(H.fatorFrescorHome(-0.2) === 1);
  expect(H.fatorFrescorHome(-3) === 0);
});

test("CASO 8: SSR e API usam a mesma seleção canônica", () => {
  expect(/function injetarNoticiasHome[\s\S]{0,200}selecionarHomeServidor\(noticias, agora\.getTime\(\)\)/.test(FRONT), "SSR");
  expect(FRONT.includes("selecaoCanonicaHome(selecionarHomeServidor(noticias, Date.now()))"), "API");
  expect(FRONT.includes("window.__HOME_SEL__=' + JSON.stringify(selecaoCanonicaHome(selecao))"), "SSR embute a mesma seleção");
  const l = ordenar([art(1, 60), art(4, 80), art(7, 75), art(9, 70), art(30, 95)]);
  const d = H.diagnosticoHome(l, AGORA), c = H.selecaoCanonicaHome(H.selecionarHomeServidor(l, AGORA));
  expect(d.hero === c.hero && JSON.stringify(d.laterais) === JSON.stringify(c.laterais), "diagnóstico diverge");
});

test("thin/duplicada/insuficiente nunca é manchete", () => {
  const dup = art(0.5, 100, { buddy_source: "duplicada" });
  const s = H.selecionarHomeServidor(ordenar([dup, art(3, 60), art(4, 60), art(5, 60)]), AGORA);
  expect(s.hero.id !== dup.id && !s.laterais.some((n) => n.id === dup.id));
});

test("laterais sem imagem repetida e ordenadas por pontuação", () => {
  const l = ordenar([art(1, 60), art(2, 90), art(3, 50, { image_url: "https://img.example/x.jpg" }), art(4, 80, { image_url: "https://img.example/x.jpg" }), art(5, 70)]);
  const s = H.selecionarHomeServidor(l, AGORA);
  const imgs = [s.hero, ...s.laterais].map((n) => n.image_url);
  expect(new Set(imgs).size === imgs.length, "imagem repetida");
  const pts = s.laterais.map((n) => H.homeScoreServidor(n, AGORA));
  expect(pts.every((p, i) => i === 0 || pts[i - 1] >= p), pts.join(","));
});

test("decaimento é monotônico (0–24h) e zera depois de 24h (hard cap)", () => {
  let ant = 2;
  for (let h = 0; h <= 24; h += 0.5) { const f = H.fatorFrescorHome(h); expect(f <= ant && f > 0, "h=" + h); ant = f; }
  expect(H.fatorFrescorHome(24.1) === 0 && H.fatorFrescorHome(30) === 0);
});

console.log("\nTopo Fresco — hard caps de 24h");

test("Hero 2h vs 22h → 2h (mesmo com score menor)", () => {
  const a = art(2, 60), b = art(22, 95);
  expect(H.selecionarHomeServidor(ordenar([a, b]), AGORA).hero.id === a.id);
});
test("Hero 8h vs 20h → 8h", () => {
  const a = art(8, 65), b = art(20, 90);
  expect(H.selecionarHomeServidor(ordenar([a, b]), AGORA).hero.id === a.id);
});
test("Hero >24h proibido mesmo com score 100 e nada mais forte", () => {
  const s = H.selecionarHomeServidor(ordenar([art(24.5, 100), art(10, 30)]), AGORA);
  expect(idade(s.hero) <= 24, "hero com " + idade(s.hero) + "h");
});
test("lateral >24h só completa vaga: as de 24h vêm antes, a de 24–48h é a mais recente (20/10: P-82/PPSA 25h)", () => {
  const l = ordenar([art(5.5, 85), art(6, 63), art(6.6, 100), art(25.4, 75), art(25.7, 61), art(26.5, 75)]);
  const s = H.selecionarHomeServidor(l, AGORA);
  expect(s.laterais.map(idade).join(",") === "5.5,6,25.4", s.laterais.map(idade).join(","));
  const cheio = ordenar([...l, art(9, 40)]);
  expect(H.selecionarHomeServidor(cheio, AGORA).laterais.every((n) => idade(n) <= 24), "24h disponível, mas entrou >24h");
});
test("matéria de hoje boa (65, 3h) vence velha forte (85, 20h)", () => {
  const hoje = art(3, 65), ontem = art(20, 85);
  const s = H.selecionarHomeServidor(ordenar([hoje, ontem]), AGORA);
  expect(s.hero.id === hoje.id);
  expect(s.laterais[0].id === ontem.id, "ontem (≤24h) pode ser lateral");
});
test("nenhuma matéria ≤24h → sem manchete, sem laterais; Últimas cronológicas", () => {
  const l = ordenar([art(26, 90), art(30, 60), art(40, 80)]);
  const s = H.selecionarHomeServidor(l, AGORA);
  expect(s.hero === null && s.laterais.length === 0, JSON.stringify(H.selecaoCanonicaHome(s)));
  expect(s.ultimas.map((n) => n.id).join() === l.map((n) => n.id).join(), "Últimas fora de ordem");
  const d = H.diagnosticoHome(l, AGORA);
  expect(d.hero === null && d.noticias_24h === 0 && /mais de 24h/.test(d.candidatos[0].motivo), JSON.stringify(d).slice(0, 300));
});
test("apenas 1 matéria ≤24h → manchete + secundárias de 24–48h (sem inventar a 3ª)", () => {
  const s = H.selecionarHomeServidor(ordenar([art(4, 70), art(30, 95), art(36, 90), art(50, 99)]), AGORA);
  expect(idade(s.hero) === 4 && s.laterais.map(idade).join() === "30,36", s.laterais.map(idade).join());
});
test("apenas 2 matérias ≤24h → manchete + 24h + 24–48h por recência (4 válidas = 4 visíveis)", () => {
  const s = H.selecionarHomeServidor(ordenar([art(4, 70), art(18, 55), art(30, 95), art(36, 90)]), AGORA);
  expect(s.laterais.map(idade).join(",") === "18,30,36", s.laterais.map(idade).join(","));
});
test("laterais: até 12h vêm antes de 12–24h, mesmo com score menor", () => {
  const s = H.selecionarHomeServidor(ordenar([art(1, 90), art(14, 100), art(5, 52), art(9, 51)]), AGORA);
  expect(s.laterais.map(idade).join(",") === "5,9,14", s.laterais.map(idade).join(","));
});
test("Últimas é cronológica (score não reordena)", () => {
  const l = ordenar([art(1, 95), art(2, 90), art(3, 85), art(4, 85), art(5, 30), art(6, 99), art(7, 20), art(8, 70)]);
  const s = H.selecionarHomeServidor(l, AGORA);
  const ts = s.ultimas.map((n) => Date.parse(n.published_at));
  expect(ts.every((t, i) => i === 0 || ts[i - 1] >= t), s.ultimas.map(idade).join(","));
});
test("diversidade não força notícia velha (3 frescas da mesma editoria > 1 velha de outra)", () => {
  const T4 = ["Petrobras assina contrato de afretamento de sonda", "Prio fecha acordo de compra de gás com distribuidora", "Brava renova contrato de navio de apoio", "Karoon contrata serviço de manutenção submarina"];
  const c = (h) => art(h, 80, { title: T4[h - 1], image_credit: "Mesma" });
  const velha = art(30, 99, { title: "Equinor perfura no mar do Norte" });
  const s = H.selecionarHomeServidor(ordenar([c(1), c(2), c(3), c(4), velha]), AGORA);
  expect(![s.hero, ...s.laterais].some((n) => n.id === velha.id) && s.laterais.length === 3, s.laterais.map(idade).join(","));
});
test("frescor > diversidade: 6h da mesma editoria vence 22h de outra (reprodução 20/10 13:39 BRT)", () => {
  const I = (h, sc, t) => art(h, sc, { title: t, summary: "Na Noruega e no exterior" });
  const hero = I(6.9, 100, "United Oil avalia perfuração em licença jamaicana");
  const timor = I(5.9, 85, "Timor-Leste prorroga contrato de gás Chuditch");
  const noruega = I(6.4, 63, "Segundo navio de energia oceânica chega à Noruega");
  const anp = art(0.9, 80, { title: "Seminário da ANP debate segurança operacional" });
  const p35 = art(22.7, 75, { title: "Petrobras adia acostamento da P-35 no estaleiro Inhaúma" });
  const s = H.selecionarHomeServidor(ordenar([anp, timor, noruega, hero, p35]), AGORA);
  const ids = s.laterais.map((n) => n.id);
  expect(ids.includes(noruega.id) && !ids.includes(p35.id), s.laterais.map(idade).join(","));
});
test("duplicate: mesma pauta nunca ocupa 2 vagas, mesmo sem alternativa (mostra menos)", () => {
  const a = art(1, 80, { title: "Petrobras contrata FPSO para campo de Búzios" });
  const b = art(2, 79, { title: "Petrobras contrata FPSO para o campo de Búzios" });
  const s = H.selecionarHomeServidor(ordenar([a, b]), AGORA);
  expect(s.laterais.length === 0, s.laterais.map((n) => n.title).join());
});
test("mesmo assunto, fato diferente: as duas podem estar no topo", () => {
  const a = art(1, 80, { title: "P-82 deixa estaleiro em Singapura rumo a Búzios" });
  const b = art(3, 75, { title: "Petrobras adia acostamento da P-35 no estaleiro Inhaúma" });
  const s = H.selecionarHomeServidor(ordenar([a, b]), AGORA);
  expect(s.laterais.length === 1 && s.laterais[0].id === b.id);
});
test("Giro 24h literal: sem janela de 48h nem rótulo alternativo", () => {
  const giro = FRONT.slice(FRONT.indexOf("function renderTicker(lista){"), FRONT.indexOf("function atualizarVelocidadeTicker"));
  expect(giro.includes("JANELA_GIRO_24H_MS") && !/48 \* 3600000/.test(giro) && !giro.includes("rotulo = 'GIRO'"), "fallback 48h no Giro");
});
test("cliente: manchete nunca cai para 48h; secundárias 24h → 48h; respeita canônica sem manchete", () => {
  expect(FRONT.includes("selCanon && selCanon.hero === null"), "canônica sem manchete");
  expect(FRONT.includes("const poolTopo24h = noticias24h.filter(n => (agoraRender - new Date(n.published_at).getTime()) / 3600000 <= 24);"), "manchete 24h");
  expect(FRONT.includes("const elegiveisLaterais = (hero ? laterais48h : [])") && FRONT.includes("const faixaLateral = n => idadeLateral(n) <= 24 ? 0 : 1;"), "secundárias");
  expect(!FRONT.includes("Nenhuma notícia publicada nas últimas 48 horas"), "aviso dramático");
});
test("SSR sem manchete: bloco de destaque oculto, Últimas renderizadas", () => {
  const html = '<section class="masthead" id="destaque" aria-label="Destaque"><article class="lead" id="heroCard"></article><aside class="highlights" id="highlightsList"></aside></section><div class="latest-body" id="ultimasBody"></div>';
  expect(FRONT.includes("'<section class=\"masthead sem-laterais\" hidden id=\"destaque\"'") && FRONT.includes(".replace('<section class=\"masthead\" id=\"destaque\"', abertura)"), "SSR esconde destaque sem manchete");
  expect(H.selecaoCanonicaHome({ hero: null, laterais: [], ultimas: [] }).hero === null);
  void html;
});
test("timezone / virada do dia: rótulos em America/Sao_Paulo pelo dia-calendário", () => {
  const ag = new Date("2026-10-21T03:30:00Z"); // 00:30 BRT de 21/10
  expect(H.tempoRelativoOuData(new Date("2026-10-21T02:00:00Z"), ag) === "há 1 hora");
  expect(H.tempoRelativoOuData(new Date("2026-10-20T12:00:00Z"), ag) === "há 15 horas");
  expect(H.tempoRelativoOuData(new Date("2026-10-20T03:10:00Z"), ag) === "ontem", "00:10 BRT de 20/10 visto 00:30 de 21/10");
  expect(H.tempoRelativoOuData(new Date("2026-10-20T02:00:00Z"), ag) === "há 2 dias", "23:00 BRT de 19/10 é anteontem em Brasília");
  expect(H.tempoRelativoOuData(new Date("2026-10-18T12:00:00Z"), ag) === "há 3 dias");
  expect(H.tempoRelativoOuData(new Date("2026-10-01T12:00:00Z"), ag) === "01/10/2026");
});
test("future timestamp: nunca 'em X min' e fora do topo se >15 min no futuro", () => {
  const ag = new Date(AGORA);
  expect(H.tempoRelativoOuData(new Date(AGORA + 10 * 60000), ag) === "agora mesmo");
  const futura = art(-2, 100);
  const s = H.selecionarHomeServidor(ordenar([futura, art(3, 60)]), AGORA);
  expect(s.hero.id !== futura.id && !s.ultimas.some((n) => n.id === futura.id));
});
test("diagnóstico expõe idade do hero/laterais e faixa", () => {
  const d = H.diagnosticoHome(ordenar([art(2, 70), art(14, 60), art(30, 90)]), AGORA);
  expect(d.idade_hero_h === 2 && d.faixa_hero === "A" && d.idade_laterais_h.join() === "14,30" && d.noticias_24h === 2, JSON.stringify({ a: d.idade_hero_h, f: d.faixa_hero, l: d.idade_laterais_h, n: d.noticias_24h }));
});

console.log("\nEditoria — fonte ≠ país da matéria");

const ED = (title, summary, credito) => H.editoriaDeServidor({ title, summary: summary || "", image_credit: credito || "Offshore Energy" });
test("Líbia (fonte internacional genérica) → INTERNACIONAL", () => {
  const e = ED("Eni e a Corporação Nacional de Petróleo da Líbia iniciam projeto de gás na África");
  expect(e === "INTERNACIONAL", e);
});
test("Noruega → INTERNACIONAL; descoberta no Brasil pela mesma fonte → editoria temática", () => {
  expect(ED("Vår Energi e Equinor descobrem gás e condensado em nova licença norueguesa") === "INTERNACIONAL");
  const br = ED("Equinor anuncia descoberta no pré-sal da Bacia de Santos");
  expect(br !== "INTERNACIONAL" && br !== "BRASIL", br);
});
test("fonte brasileira falando do exterior → INTERNACIONAL", () => {
  expect(ED("Milei diz que Argentina está próxima de produzir 1 milhão de barris", "", "Eixos") === "INTERNACIONAL");
});
test("fonte internacional falando do Brasil → não é INTERNACIONAL", () => {
  const e = ED("Transocean recebe contrato da Petrobras para sonda em Búzios", "", "Transocean");
  expect(e !== "INTERNACIONAL", e);
});
test("veículo internacional (Offshore Energy) sem país citado → INTERNACIONAL; com marcador BR → não", () => {
  expect(ED("TenneT e NKT estudam a desativação de cabos offshore") === "INTERNACIONAL");
  expect(ED("Petrobras contrata navio de apoio para a Bacia de Campos") !== "INTERNACIONAL");
});
test("fonte internacional sem país citado continua INTERNACIONAL", () => {
  expect(ED("Fleet status report de outubro", "", "Transocean") === "INTERNACIONAL");
});
test("matéria brasileira sem tema específico continua BRASIL; 'irá' não vira Irã", () => {
  expect(ED("Sindipetro irá realizar evento em Macaé", "", "Sindipetro NF") !== "INTERNACIONAL");
});
test("Guyana / Guiana → INTERNACIONAL, mesmo vindo de fonte brasileira", () => {
  expect(ED("ExxonMobil eleva produção na Guyana com novo FPSO", "", "Eixos") === "INTERNACIONAL");
  expect(ED("Guiana aprova sexto projeto offshore no bloco Stabroek", "", "PetroNotícias") === "INTERNACIONAL");
});
test("EUA → INTERNACIONAL", () => {
  expect(ED("Estoques de petróleo nos EUA caem 8 milhões de barris", "", "Eixos") === "INTERNACIONAL");
  expect(ED("Leilão no Golfo do México atrai seis petroleiras", "", "MegaWhat") === "INTERNACIONAL");
});
test("vários países sem o Brasil → INTERNACIONAL; com o Brasil no fato → não", () => {
  expect(ED("Petronas e Petrovietnam reforçam laços com Noruega e Reino Unido", "", "Eixos") === "INTERNACIONAL");
  expect(ED("Equinor leva tecnologia norueguesa para campo na Bacia de Campos", "", "Offshore Energy") !== "INTERNACIONAL");
});
test("Timor-Leste e Jamaica (casos reais de 20/10) → INTERNACIONAL", () => {
  expect(ED("Timor-Leste concede prorrogação ao contrato de gás Chuditch", "", "PetroNotícias") === "INTERNACIONAL");
  expect(ED("United Oil & Gas avalia metas de perfuração em licença jamaicana", "", "Eixos") === "INTERNACIONAL");
});
test("o mesmo classificador vai para os scripts do navegador (sem cópia divergente)", () => {
  expect(FRONT.includes("${materiaInternacional.toString()}"), "Home");
  expect((FRONT.match(/materiaInternacional\.toString\(\) \+/g) || []).length === 2, "páginas de lista");
  expect(!/FONTES_INTERNACIONAIS(_B)?\.indexOf\(n\.image_credit\)!==-1\)return "INTERNACIONAL"/.test(FRONT), "regra antiga por fonte");
});

console.log("\n" + pass + " passaram, " + fail + " falharam");
process.exit(fail ? 1 : 0);
