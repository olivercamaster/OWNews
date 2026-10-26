#!/usr/bin/env node
/* Mais Lidas — popularidade × recência (2026-10-22).
 * Extrai do worker.js a MESMA rankingMaisLidas usada por /api/mais-lidas e
 * roda cenários determinísticos (relógio fixo). */
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
const selSrc = trecho("const PALAVRAS_BREAKING_SERVIDOR", "function homeSsrCapa(n, classe");
const mlSrc = trecho("const MAIS_LIDAS_ITENS", "async function responderMaisLidas");

const esc = (s) => String(s == null ? "" : s);
const M = new Function("escaparHTML", "decodificarEntidadesHTMLServidor",
  editoriaSrc + "\n" + camadaSrc + "\n" + qSrc + "\n" + selSrc + "\n" + mlSrc +
  "\nreturn { rankingMaisLidas, fatorRecenciaMaisLidas, MAIS_LIDAS_ITENS };"
)(esc, esc);

let pass = 0, fail = 0;
function test(nome, fn) {
  try { fn(); pass++; console.log("  ✓ " + nome); }
  catch (e) { fail++; console.log("  ✗ " + nome + "\n      " + e.message); }
}
function expect(c, msg) { if (!c) throw new Error(msg || "falhou"); }

const AGORA = Date.parse("2026-10-22T15:00:00Z");
const CORPO = "Primeiro parágrafo da matéria OWNews com fatos e contexto suficientes para leitura completa, escrito a partir do material da fonte e revisado pelo gate editorial do portal.\n\nSegundo parágrafo com o contexto do setor offshore, detalhes do contrato, prazos, operadora envolvida e o que muda para quem trabalha embarcado nas unidades da bacia.";
const TEMAS = ["Equinor anuncia descoberta no mar do Norte", "Sindicato aprova acordo coletivo na Bahia", "ANP divulga produção recorde de agosto",
  "Navio de apoio chega ao porto do Açu", "Seadrill renova sonda na Malásia", "Leilão de áreas atrai sete operadoras", "Helicóptero ganha nova base em Jacarepaguá",
  "Shell investe em captura de carbono", "Estaleiro gaúcho retoma obras de casco", "Preço do Brent recua com estoques altos", "Prio conclui aquisição de campo maduro"];
let seq = 0;
function art(horas, extra) {
  seq++;
  return Object.assign({ id: "id" + String(seq).padStart(3, "0"), title: TEMAS[seq % TEMAS.length], content: CORPO, buddy_source: "ownews",
    published_at: new Date(AGORA - horas * 3600000).toISOString() }, extra || {});
}
// cenario([[horas, leitores, extra?], ...]) → ids na ordem do ranking
function rodar(linhas) {
  seq = 0;
  const artigos = [], contagens = [];
  linhas.forEach(([h, v, extra]) => { const a = art(h, extra); artigos.push(a); contagens.push({ article_id: a.id, views: v }); });
  const r = M.rankingMaisLidas(contagens, artigos, AGORA);
  return Object.assign(r, { ids: r.escolhidos.map((c) => c.a.id), artigos });
}

console.log("\nMais Lidas — popularidade × recência");

test("decaimento contínuo: ≤6h quase sem pena, 24h metade, 72h forte, sem degrau em 24h", () => {
  const f = M.fatorRecenciaMaisLidas;
  expect(f(0) === 1 && f(6) > 0.93 && f(12) > 0.79 && f(12) < 0.81, "6h/12h");
  expect(Math.abs(f(24) - 0.5) < 1e-9 && f(48) < 0.21 && f(72) < 0.11, "24/48/72");
  expect(Math.abs(f(23.98) - f(24.02)) < 0.001, "sem cliff em 24h");
  expect(f(168) > 0 && f(168.1) === 0, "7 dias é o limite");
});
test("ranking por acesso dentro da janela", () => {
  const r = rodar([[2, 4], [3, 9], [4, 6], [5, 3], [6, 12]]);
  expect(r.ids.join() === "id005,id002,id003,id001,id004", r.ids.join());
});
test("matéria nova popular vence antiga pouco popular", () => {
  const r = rodar([[100, 6], [3, 5], [4, 4], [5, 4], [6, 3], [7, 3]]);
  expect(r.ids[0] === "id002" && !r.ids.includes("id001"), r.ids.join());
});
test("17 leitores há 8h vence 4 leitores há 1h (popularidade conta)", () => {
  const r = rodar([[8, 17], [1, 4], [2, 3], [3, 3], [4, 3]]);
  expect(r.ids[0] === "id001", r.ids.join());
});
test("acumulado de 7 dias não domina: 17 leitores há 150h perde para 4 leitores há 10h", () => {
  const r = rodar([[150, 17], [10, 4], [12, 3], [14, 3]]);
  expect(r.ids[0] === "id002", r.ids.join());
  expect(!r.ids.includes("id001"), "17×f(150h)=0,42 < piso 0,5: " + r.ids.join());
});
test("janela 24h quando há 5 elegíveis em 24h", () => {
  const r = rodar([[2, 3], [5, 3], [9, 3], [15, 3], [20, 3], [40, 8]]);
  expect(r.janela === 24 && !r.ids.includes("id006"), r.janela + " " + r.ids.join());
});
test("expande para 48h quando faltam elegíveis em 24h", () => {
  const r = rodar([[2, 3], [5, 3], [9, 3], [30, 3], [40, 4], [60, 9]]);
  expect(r.janela === 48 && r.ids.includes("id005") && !r.ids.includes("id006"), r.janela + " " + r.ids.join());
});
test("expande para 72h", () => {
  const r = rodar([[2, 3], [30, 3], [40, 3], [50, 6], [70, 9]]);
  expect(r.janela === 72 && r.ids.length === 5, r.janela + " " + r.ids.join());
});
test("fallback até 7 dias só com quem passa no piso", () => {
  const r = rodar([[2, 3], [30, 3], [100, 12], [160, 3]]);
  expect(r.janela === 168, "janela " + r.janela);
  expect(r.ids.includes("id003") && !r.ids.includes("id004"), r.ids.join());
});
test("mais de 7 dias nunca entra", () => {
  const r = rodar([[2, 3], [5, 3], [9, 3], [200, 500]]);
  expect(!r.ids.includes("id004"), r.ids.join());
});
test("menos de 5 elegíveis: mostra só as boas, não completa", () => {
  const r = rodar([[2, 5], [5, 4], [9, 3], [20, 1], [30, 0]]);
  expect(r.ids.length === 3, r.ids.join());
});
test("zero acessos não entra", () => {
  const r = rodar([[1, 0], [2, 0], [3, 3]]);
  expect(r.ids.join() === "id003", r.ids.join());
});
test("viral excepcional fora da janela entra (relativo à média real)", () => {
  // janela 24h cheia com 2–4 leitores; matéria de 50h com 40 leitores.
  const r = rodar([[2, 4], [5, 3], [9, 3], [15, 2], [20, 2], [50, 40], [30, 2], [35, 2]]);
  expect(r.janela === 24, "janela " + r.janela);
  const v = r.escolhidos.find((c) => c.a.id === "id006");
  expect(v && v.motivo === "viral", r.ids.join());
  expect(r.ids[0] === "id006", "40×f(50h)=7,5 lidera: " + r.ids.join());
});
test("não-viral fora da janela não entra (meia dúzia de acessos)", () => {
  const r = rodar([[2, 4], [5, 3], [9, 3], [15, 2], [20, 2], [50, 6]]);
  expect(!r.ids.includes("id006"), "limiar " + r.limiarViral + " " + r.ids.join());
});
test("diversidade: mesma pauta entra uma vez", () => {
  const t = "Petrobras contrata navio-sonda para a Bacia de Campos";
  const r = rodar([[2, 9, { title: t }], [3, 8, { title: t + " em 2027" }], [4, 3], [5, 3]]);
  expect(r.ids.includes("id001") && !r.ids.includes("id002"), r.ids.join());
});
test("thin/duplicada/insuficiente nunca entra", () => {
  const r = rodar([[2, 30, { buddy_source: "duplicada" }], [3, 30, { content: "curto" }], [4, 3], [5, 3]]);
  expect(!r.ids.includes("id001") && !r.ids.includes("id002"), r.ids.join());
});
test("data futura inválida fica fora; relógio adiantado até 15 min aceito", () => {
  const r = rodar([[-5, 30], [-0.2, 4], [3, 3]]);
  expect(!r.ids.includes("id001") && r.ids.includes("id002"), r.ids.join());
});
test("timezone: mesmo instante em UTC e em BRT (-03:00) dá a mesma idade", () => {
  seq = 0;
  const a = art(0, { published_at: "2026-10-22T09:00:00Z" }), b = art(0, { published_at: "2026-10-22T06:00:00-03:00" });
  const r = M.rankingMaisLidas([{ article_id: a.id, views: 3 }, { article_id: b.id, views: 3 }], [a, b], AGORA);
  expect(r.escolhidos.length === 2 && r.escolhidos[0].h === r.escolhidos[1].h && r.escolhidos[0].h === 6, String(r.escolhidos.map((c) => c.h)));
});
test("empate de score: a mais recente na frente; empate total, ordem estável por id", () => {
  const r = rodar([[0, 4], [0, 4], [12, 5]]);
  // 4×1 = 4 · 5×0,8 = 4 → empate: as de 0h primeiro, depois por id
  expect(r.ids.join() === "id001,id002,id003", r.ids.join());
});
test("dados ausentes não quebram", () => {
  const r = M.rankingMaisLidas(null, null, AGORA);
  expect(r.escolhidos.length === 0, "vazio");
});

console.log("\n" + pass + " passou, " + fail + " falhou");
process.exit(fail ? 1 : 0);
