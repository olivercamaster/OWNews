// Missão 14/11/2026 — decisão comercial: ZERO direcionamento público do OWNews para o OffVoos
// (link, botão, CTA, logo/nome clicável, rede social). O DADO autorizado continua (crédito em texto).
// + afirmações técnicas de risco corrigidas (HUET/CBSP sem base oficial suficiente).
// Uso: node tests/offvoos_conteudo_test.js
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const W = fs.readFileSync(path.join(RAIZ, "worker.js"), "utf8");
let ok = 0, falhas = 0;
function test(nome, fn) { try { fn(); ok++; console.log("  ✓ " + nome); } catch (e) { falhas++; console.log("  ✗ " + nome + "\n      " + e.message); } }
function expect(c, m) { if (!c) throw new Error(m || "falhou"); }

function arquivosPublicos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? arquivosPublicos(p) : /\.(html|js|css|json|txt|xml|webmanifest)$/.test(e.name) ? [p] : [];
  });
}

test("worker do portal: nenhuma URL do OffVoos (link, CTA, rede social)", () => {
  const achados = W.match(/offvoos\.com(\.br)?|instagram\.com\/offvoos|@offvoos/gi) || [];
  expect(achados.length === 0, achados.length + " ocorrência(s): " + achados.slice(0, 3).join(", "));
});
test("worker do portal: nenhum <a>/window.open com destino OffVoos", () => {
  expect(!/<a\b[^>]*href=[^>]*offvoos/i.test(W), "<a href> para OffVoos");
  expect(!/window\.open\([^)]*offvoos/i.test(W), "window.open para OffVoos");
  expect(!/OffVoos ↗/.test(W), "seta de link externo ao lado de OffVoos");
});
test("public/ (assets estáticos): nenhuma URL do OffVoos", () => {
  const ruins = arquivosPublicos(path.join(RAIZ, "public")).filter((f) => /offvoos\.com/i.test(fs.readFileSync(f, "utf8")));
  expect(ruins.length === 0, ruins.join(", "));
});
test("aeroportos continuam: dado operacional do OffVoos lido do collector e crédito em texto", () => {
  expect(W.includes('offvoos:item.offvoos||null'), "mapa de aeroportos perdeu o campo offvoos");
  expect(W.includes('Finalizados'), "métrica Finalizados sumiu");
  expect(W.includes('dados: OffVoos'), "crédito em texto sumiu");
  expect(W.includes('/aeroportos"') || W.includes("/aeroportos'") || W.includes('/aeroportos)'), "rota de aeroportos");
});
test("CSS: crédito do OffVoos não tem cara de link (sem sublinhado)", () => {
  const css = fs.readFileSync(path.join(RAIZ, "public", "css", "paginas.css"), "utf8");
  const r = (css.match(/\.aero-fonte-link\{[^}]*\}/) || [""])[0];
  expect(r && !/underline/.test(r), r);
});
// A lista pública de correções cita o texto errado de propósito — fica fora da varredura.
const SEM_CORRECOES = W.replace(/const CORRECOES_NOTICIAS = \[[\s\S]*?\n\];/, "");
test("HUET não é apresentado como obrigatório em geral", () => {
  expect(SEM_CORRECOES.length < W.length, "lista de correções não encontrada");
  expect(!/Treinamento obrigatório para voar/i.test(SEM_CORRECOES), "Aviação Offshore");
  expect(!/HUET[^.<]{0,80}pré-requisito obrigatório|pré-requisito obrigatório[^.<]{0,80}HUET/i.test(SEM_CORRECOES), "pré-requisito obrigatório");
});
test("CBSP: sem regra das 72 h nem validade de 5 anos sem fonte oficial", () => {
  expect(!/72h embarcado/.test(SEM_CORRECOES), "72h");
  expect(!/CBSP[\s\S]{0,600}validade internacional de 5 anos/.test(SEM_CORRECOES), "5 anos");
  expect(W.includes("NORMAM-104"), "a referência regulatória real continua");
});
console.log("\n" + ok + " passaram, " + falhas + " falharam");
process.exit(falhas ? 1 : 0);
