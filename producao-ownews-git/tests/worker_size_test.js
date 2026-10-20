#!/usr/bin/env node
/* Topo Fresco (2026-10-20) — tamanho do worker e CSS das páginas internas
 * como Static Asset. Margem mínima de 12% abaixo do guard de 2 MB e
 * versão do /css/paginas.css igual ao sha256 do arquivo publicado. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const RAIZ = path.join(__dirname, "..");
const FRONT = fs.readFileSync(path.join(RAIZ, "worker.js"), "utf8");
let pass = 0, fail = 0;
function test(nome, fn) {
  try { fn(); pass++; console.log("  ✓ " + nome); }
  catch (e) { fail++; console.log("  ✗ " + nome + "\n      " + e.message); }
}
function expect(c, msg) { if (!c) throw new Error(msg || "falhou"); }

const tamanho = Buffer.byteLength(FRONT);
test("worker.js com margem >= 12% abaixo de 2.000.000 bytes (" + tamanho + ")", () => {
  expect(tamanho <= 1760000, tamanho + " bytes");
});
test("CSS das páginas internas é Static Asset com versão = sha256 do arquivo", () => {
  const css = fs.readFileSync(path.join(RAIZ, "public", "css", "paginas.css"), "utf8");
  const v = crypto.createHash("sha256").update(css).digest("hex").slice(0, 10);
  const m = FRONT.match(/const CSS_PAGINAS_VERSAO = '([0-9a-f]{10})'/);
  expect(m && m[1] === v, "constante " + (m && m[1]) + " ≠ arquivo " + v);
  expect(FRONT.includes("href=\"/css/paginas.css?v=' + CSS_PAGINAS_VERSAO + '\""), "link ausente");
  expect(css.includes(".cert-card-head") && css.includes(":root{") && !css.includes("<style>"), "conteúdo inesperado");
});
test("_headers: /css/* imutável (a versão na URL troca a cada mudança)", () => {
  const h = fs.readFileSync(path.join(RAIZ, "public", "_headers"), "utf8");
  expect(/\/css\/\*\s*\n\s*Cache-Control: public, max-age=31536000, immutable/.test(h));
});
test("snapshot estático de notícias (SEED_ARTICLES) não volta", () => {
  expect(!/const SEED_ARTICLES = \[\{/.test(FRONT), "seed estático voltou");
});
console.log("\n" + pass + " passaram, " + fail + " falharam");
process.exit(fail ? 1 : 0);
