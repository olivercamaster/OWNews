// Offshore Agora — Giro (incidente 04/11/2026: bloco vazio com notícias de ~20 h no banco).
// Extrai do worker.js REAL selecionarGiroOA/quandoBrtOA (as mesmas que vão para o navegador).
// Uso: node tests/offshore_agora_test.js
const fs = require("fs");
const path = require("path");
const W = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");
const ini = W.indexOf("function selecionarGiroOA("), fim = W.indexOf("function materiaInternacional(");
const M = new Function(W.slice(ini, fim) + "\nreturn { selecionarGiroOA, quandoBrtOA };")();
let ok = 0, falhas = 0;
function test(nome, fn) { try { fn(); ok++; console.log("  ✓ " + nome); } catch (e) { falhas++; console.log("  ✗ " + nome + " — " + e.message); } }
function expect(c, m) { if (!c) throw new Error(m || "falhou"); }
const AGORA = Date.parse("2026-11-04T22:45:00Z");
const n = (id, h) => ({ id, title: "Notícia " + id, published_at: new Date(AGORA - h * 3600000).toISOString() });

test("matéria de 20 h aparece no giro de 24 h", () => {
  const g = M.selecionarGiroOA([n("a", 20), n("b", 2), n("c", 5)], AGORA, {});
  expect(g.itens.some((x) => x.id === "a"), "20 h ausente"); expect(g.janela === 24);
});
test("destaque não se repete no giro, mas o giro não fica vazio com pouco volume", () => {
  const g = M.selecionarGiroOA([n("a", 2), n("b", 20), n("c", 30)], AGORA, { a: 1 });
  expect(g.itens.length === 2 && !g.itens.some((x) => x.id === "a"), JSON.stringify(g));
});
test("nenhuma em 24 h e há 25–48 h → fallback 48 h, título honesto, mais nova primeiro", () => {
  const g = M.selecionarGiroOA([n("x", 40), n("y", 26), n("z", 60)], AGORA, {});
  expect(g.janela === 48, "janela"); expect(g.itens.map((x) => x.id).join() === "y,x", g.itens.map((x) => x.id).join());
});
test("com 3+ em 24 h não mistura matéria de ontem", () => {
  const g = M.selecionarGiroOA([n("a", 1), n("b", 3), n("c", 10), n("d", 30)], AGORA, {});
  expect(g.janela === 24 && !g.itens.some((x) => x.id === "d"));
});
test("bordas: 23h59 e 24h00 são 24 h; 24h01 só no fallback; 47h59 e 48h00 entram; 48h01 nunca", () => {
  const L = [n("h2359", 23 + 59 / 60), n("h2400", 24), n("h2401", 24 + 1 / 60), n("h4759", 47 + 59 / 60), n("h4800", 48), n("h4801", 48 + 1 / 60)];
  const g = M.selecionarGiroOA(L, AGORA, {});
  const ids = g.itens.map((x) => x.id);
  expect(ids.join() === "h2359,h2400,h2401,h4759,h4800", ids.join());
  const so24 = M.selecionarGiroOA([n("a", 1), n("b", 2), n("h2400", 24), n("h2401", 24 + 1 / 60)], AGORA, {});
  expect(!so24.itens.some((x) => x.id === "h2401") && so24.itens.some((x) => x.id === "h2400"));
});
test("data no futuro além de 15 min (relógio da fonte errado) não entra; vazio = vazio", () => {
  expect(M.selecionarGiroOA([n("f", -2)], AGORA, {}).itens.length === 0);
  expect(M.selecionarGiroOA([], AGORA, {}).itens.length === 0);
});
test("horário no fuso de Brasília: hoje, ontem e data — virada do dia em BRT, não em UTC", () => {
  // 22:45 UTC = 19:45 BRT de 04/11. 02:30 UTC de 04/11 = 23:30 BRT de 03/11 → "ontem".
  expect(M.quandoBrtOA("2026-11-04T20:00:00Z", AGORA) === "17:00", M.quandoBrtOA("2026-11-04T20:00:00Z", AGORA));
  expect(M.quandoBrtOA("2026-11-04T02:30:00Z", AGORA) === "ontem, 23:30", M.quandoBrtOA("2026-11-04T02:30:00Z", AGORA));
  expect(M.quandoBrtOA("2026-11-02T15:00:00Z", AGORA) === "02/11, 12:00", M.quandoBrtOA("2026-11-02T15:00:00Z", AGORA));
});
test("bloco escondido não aparece (CSS não pode sobrescrever o atributo hidden)", () => {
  expect(W.includes("#oaGiroWrap[hidden],#oaFatosWrap[hidden]{display:none!important}"));
  expect(!/#oaFatosWrap\+#oaGiroWrap,/.test(W), "regra antiga que mostrava o título com o bloco vazio");
});
console.log(`\n${ok} passaram, ${falhas} falharam`);
process.exit(falhas ? 1 : 0);
