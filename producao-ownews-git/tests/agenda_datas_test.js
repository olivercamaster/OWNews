// Agenda: "hoje" em Brasília e evento encerrado fora de "Próximos eventos" (04/11/2026).
// Uso: node tests/agenda_datas_test.js
const fs = require("fs"), path = require("path");
const W = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");
const src = W.slice(W.indexOf("function hojeBrtAgenda("), W.indexOf("function fmtDataEvento("));
const M = new Function(src + "\nreturn { hojeBrtAgenda, statusEvento };")();
let ok = 0, f = 0;
const t = (n, fn) => { try { fn(); ok++; console.log("  ✓ " + n); } catch (e) { f++; console.log("  ✗ " + n + " — " + e.message); } };
const ev = (ini, fim) => ({ dataInicio: ini, dataFim: fim });
t("evento de 02/11 (um dia) não é próximo em 04/11", () => { if (M.statusEvento(ev("2026-11-02", "2026-11-02"), "2026-11-04") !== "ENCERRADO") throw new Error(); });
t("ADIPEC 02–05/11 em 04/11 está em andamento (HOJE), não encerrado", () => { if (M.statusEvento(ev("2026-11-02", "2026-11-05"), "2026-11-04") !== "HOJE") throw new Error(); });
t("ADIPEC em 06/11 é encerrado", () => { if (M.statusEvento(ev("2026-11-02", "2026-11-05"), "2026-11-06") !== "ENCERRADO") throw new Error(); });
t("23:30 BRT de 05/11 (02:30 UTC de 06/11) ainda é 05/11", () => { const d = M.hojeBrtAgenda(Date.parse("2026-11-06T02:30:00Z")); if (d !== "2026-11-05") throw new Error(d); });
t("00:30 BRT de 06/11 (03:30 UTC) já é 06/11", () => { const d = M.hojeBrtAgenda(Date.parse("2026-11-06T03:30:00Z")); if (d !== "2026-11-06") throw new Error(d); });
t("schema.org: evento passado não é marcado como cancelado", () => { if (/EventCancelled/.test(W)) throw new Error("EventCancelled no código"); });
console.log(`\n${ok} passaram, ${f} falharam`); process.exit(f ? 1 : 0);
