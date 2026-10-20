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
const selSrc = trecho("const PALAVRAS_BREAKING_SERVIDOR", "function homeSsrCapa(n, classe)");
const canonSrc = trecho("function selecaoCanonicaHome(selecao)", "async function responderHomeSelecao");

const esc = (s) => String(s == null ? "" : s);
const H = new Function("escaparHTML", "decodificarEntidadesHTMLServidor",
  editoriaSrc + "\n" + camadaSrc + "\n" + qSrc + "\n" + selSrc + "\n" + canonSrc +
  "\nreturn { selecionarHomeServidor, homeScoreServidor, fatorFrescorHome, diagnosticoHome, selecaoCanonicaHome, HOME_SCORE_FORTE, editoriaDeServidor, materiaInternacional };"
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

test("CASO 2b: excepcional de 14h ainda segura a manchete contra mediana de 2h (score justifica)", () => {
  const A = art(14, 100), B = art(2, 60);
  const s = H.selecionarHomeServidor(ordenar([A, B, art(5, 50)]), AGORA);
  expect(s.hero.id === A.id, "hero=" + s.hero.title);
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

test("CASO 3: nada forte em 12h → janela expande (24h/48h) sem inventar", () => {
  const l = ordenar([art(30, 85), art(40, 70), art(20, 45)]);
  const s = H.selecionarHomeServidor(l, AGORA);
  expect(s && s.hero, "sem hero");
  expect(l.some((n) => n.id === s.hero.id), "hero fora da lista");
  expect(s.laterais.every((n) => l.includes(n)), "lateral inventada");
  expect(s.laterais.length === 2, "laterais=" + s.laterais.length);
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

test("CASO 5b: >24h volta a ser manchete só sem nada forte em 24h", () => {
  const velha = art(26, 90), fraca = art(3, 35);
  const s = H.selecionarHomeServidor(ordenar([velha, fraca, art(30, 60)]), AGORA);
  expect(s.hero.id === velha.id, "hero=" + s.hero.title);
});

test("CASO 6: seleção muda sozinha quando o relógio anda / chega matéria nova", () => {
  const a = art(1, 70);
  const l1 = ordenar([a, art(8, 60), art(9, 60)]);
  expect(H.selecionarHomeServidor(l1, AGORA).hero.id === a.id);
  const b = art(0.2, 72);
  expect(H.selecionarHomeServidor(ordenar([b, ...l1]), AGORA).hero.id === b.id, "nova não assumiu");
  // 30h depois, sem nada novo: nenhuma >48h aparece; janela vazia → null
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

test("decaimento é monotônico (0–48h)", () => {
  let ant = 2;
  for (let h = 0; h <= 48; h += 0.5) { const f = H.fatorFrescorHome(h); expect(f <= ant, "h=" + h); ant = f; }
  expect(H.fatorFrescorHome(48.1) === 0);
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
test("fonte internacional sem país citado continua INTERNACIONAL", () => {
  expect(ED("Fleet status report de outubro", "", "Transocean") === "INTERNACIONAL");
});
test("matéria brasileira sem tema específico continua BRASIL; 'irá' não vira Irã", () => {
  expect(ED("Sindipetro irá realizar evento em Macaé", "", "Sindipetro NF") !== "INTERNACIONAL");
});
test("o mesmo classificador vai para os scripts do navegador (sem cópia divergente)", () => {
  expect(FRONT.includes("${materiaInternacional.toString()}"), "Home");
  expect((FRONT.match(/materiaInternacional\.toString\(\) \+/g) || []).length === 2, "páginas de lista");
  expect(!/FONTES_INTERNACIONAIS(_B)?\.indexOf\(n\.image_credit\)!==-1\)return "INTERNACIONAL"/.test(FRONT), "regra antiga por fonte");
});

console.log("\n" + pass + " passaram, " + fail + " falharam");
process.exit(fail ? 1 : 0);
