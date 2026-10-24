#!/usr/bin/env node
/* Conta OW + Privacidade (Play Store, 2026-10-24) — checagens estáticas do worker.js do site. */
const fs = require("fs");
const path = require("path");
const W = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");
let pass = 0, fail = 0;
function test(n, fn) { try { fn(); pass++; console.log("  ✓ " + n); } catch (e) { fail++; console.log("  ✗ " + n + "\n      " + e.message); } }
function expect(c, m) { if (!c) throw new Error(m || "falhou"); }
const fn = nome => { const i = W.indexOf("function " + nome + "("); const j = W.indexOf("\nfunction ", i + 10); return W.slice(i, j); };

test("rotas públicas /excluir-conta e /privacidade existem (sem login)", () => {
  expect(W.includes('url.pathname === "/excluir-conta"') && W.includes('url.pathname === "/privacidade"'));
  expect(!/excluir-conta[\s\S]{0,200}getSessao|requireAuth/.test(fn("renderExcluirConta").slice(0, 400)));
});
test("página de exclusão: identifica OWBuddy, OWNews/OffshoreWorks e Conta OW; canonical estável", () => {
  const p = fn("renderExcluirConta");
  for (const t of ["OWBuddy", "OWNews", "OffshoreWorks", "Conta OW", '"/excluir-conta"']) expect(p.includes(t), t);
});
test("página de exclusão explica: como, o que é apagado, o que fica no aparelho, sair ≠ apagar ≠ excluir, contato", () => {
  const p = fn("renderExcluirConta");
  for (const t of ["Como excluir", "O que é apagado", "O que fica só no seu aparelho", "Sair da conta", "Apagar dados deste aparelho", "@ownewsbr"]) expect(p.includes(t), t);
  expect(p.includes("<noscript>"), "instrução sem JS");
});
test("exclusão: senha de novo (grant password) → /api/conta/excluir só com Bearer; sem user_id do cliente", () => {
  const p = fn("renderExcluirConta");
  expect(p.includes("/token?grant_type=password") && p.includes('fetch(\\"/api/conta/excluir\\"'));
  expect(!/user_id|userId/.test(p), "cliente não manda id");
});
test("proxy /api/conta/excluir: só POST, repassa SÓ o Authorization ao coletor", () => {
  const i = W.indexOf('url.pathname === "/api/conta/excluir"');
  const b = W.slice(i, i + 900);
  expect(b.includes('request.method !== "POST"') && b.includes('COLETOR_BASE_URL + "/conta/excluir"'));
  expect(b.includes('headers: { Authorization: request.headers.get("Authorization") || "" }') && !b.includes("request.body") && !b.includes("request.text()"));
});
test("nenhuma chave administrativa no site; nenhum e-mail inexistente", () => {
  expect(!/service_role|SERVICE_ROLE/i.test(W), "service role no front");
  expect(!W.includes("suporte@ownews.com.br"), "ownews.com.br não recebe e-mail (MX nulo)");
  expect(!W.includes('authFetch("/user",{method:"DELETE"'), "DELETE /user (inexistente no Supabase) removido");
});
test("Minha Escala: 'Excluir minha conta' leva à página pública", () => {
  expect(W.includes('_btnExcluirConta.addEventListener("click",function(){location.href="/excluir-conta";})'));
});
test("privacidade cobre o OWBuddy com âncoras #owbuddy e #exclusao", () => {
  const p = fn("renderPrivacidade");
  for (const t of ['id="owbuddy"', 'id="exclusao"', "Só no seu aparelho", "Com a Conta OW", "Open-Meteo", "Notificações", "Compartilhar minha escala", "Estatísticas de uso", "contatos do embarque", "Meu Pagamento", "/excluir-conta"]) expect(p.includes(t), t);
  expect(!p.includes("Viagem, aeroporto"), "afirmação antiga incorreta (aeroporto sincroniza na escala)");
});
console.log("\n" + pass + " passaram, " + fail + " falharam");
process.exit(fail ? 1 : 0);
