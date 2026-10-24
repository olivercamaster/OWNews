#!/usr/bin/env node
/* Exclusão da Conta OW (2026-10-24) — testa o código REAL do worker.js
 * (bloco extraído entre os marcadores), com fetch simulado. Sem rede. */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");
const ini = src.indexOf("// ─── Exclusão da Conta OW");
const fim = src.indexOf("const ROTAS_PUBLICAS_COLLECTOR");
const bloco = src.slice(ini, fim);
let chamadas = [];
let respostasSupabase = {};
global.fetch = async (url, opts = {}) => {
  chamadas.push({ url, metodo: opts.method || "GET", auth: (opts.headers || {}).Authorization });
  const r = respostasSupabase[(opts.method || "GET") + " " + url.replace(/^https:\/\/x\.supabase\.co/, "")];
  if (!r) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: r.status < 300, status: r.status, json: async () => r.body };
};
const mod = new Function(bloco + "; return { avaliarTokenExclusao, rotaExcluirConta, rotaAdminContaTeste, EXCLUSAO_JANELA_SEG };")();

let pass = 0, fail = 0;
async function test(nome, fn) {
  chamadas = []; respostasSupabase = {};
  try { await fn(); pass++; console.log("  ✓ " + nome); } catch (e) { fail++; console.log("  ✗ " + nome + "\n      " + e.message); }
}
const expect = (c, m) => { if (!c) throw new Error(m || "falhou"); };
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const AGORA = 1793000000;
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const jwt = (p) => b64({ alg: "HS256" }) + "." + b64({ iss: "https://x.supabase.co/auth/v1", role: "authenticated", exp: AGORA + 3600, amr: [{ method: "password", timestamp: AGORA - 60 }], ...p }) + ".assinatura";
const ENV = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-secret" };
const req = (metodo, token, corpo) => new Request("https://c/conta/excluir", { method: metodo, headers: token ? { Authorization: "Bearer " + token } : {}, body: corpo ? JSON.stringify(corpo) : undefined });

(async () => {
await test("pré-validação: token válido e recente → ok com sub", async () => {
  const r = mod.avaliarTokenExclusao(jwt({ sub: A }), AGORA, ENV.SUPABASE_URL);
  expect(r.ok && r.sub === A, JSON.stringify(r));
});
await test("pré-validação: lixo, vencido, sem amr, outro projeto, anon → recusado", async () => {
  expect(!mod.avaliarTokenExclusao("abc", AGORA).ok);
  expect(mod.avaliarTokenExclusao(jwt({ sub: A, exp: AGORA - 1 }), AGORA).motivo === "sessao_invalida");
  expect(mod.avaliarTokenExclusao(jwt({ sub: A, amr: [] }), AGORA).motivo === "reautenticar");
  expect(mod.avaliarTokenExclusao(jwt({ sub: A, amr: [{ method: "password", timestamp: AGORA - 601 }] }), AGORA).motivo === "reautenticar", "senha há > 10 min");
  expect(mod.avaliarTokenExclusao(jwt({ sub: A, amr: [{ method: "otp", timestamp: AGORA }] }), AGORA).motivo === "reautenticar");
  expect(!mod.avaliarTokenExclusao(jwt({ sub: A, iss: "https://outro.supabase.co/auth/v1" }), AGORA, ENV.SUPABASE_URL).ok);
  expect(!mod.avaliarTokenExclusao(jwt({ sub: A, role: "anon" }), AGORA).ok);
  expect(!mod.avaliarTokenExclusao(jwt({ sub: "nao-e-uuid" }), AGORA).ok);
});
await test("sem login → 401 e nenhuma chamada ao Supabase", async () => {
  const r = await mod.rotaExcluirConta(req("POST"), ENV, AGORA);
  expect(r.status === 401 && chamadas.length === 0);
});
await test("token velho (senha há mais de 10 min) → 401 reautenticar, sem rede", async () => {
  const r = await mod.rotaExcluirConta(req("POST", jwt({ sub: A, amr: [{ method: "password", timestamp: AGORA - 3600 }] })), ENV, AGORA);
  expect(r.status === 401 && (await r.json()).erro === "reautenticar" && chamadas.length === 0);
});
await test("usuário A pedindo para excluir B (id no corpo/URL) → exclui SÓ A", async () => {
  respostasSupabase["GET /auth/v1/user"] = { status: 200, body: { id: A } };
  respostasSupabase["DELETE /auth/v1/admin/users/" + A] = { status: 200, body: {} };
  const r = await mod.rotaExcluirConta(new Request("https://c/conta/excluir?user_id=" + B, { method: "POST", headers: { Authorization: "Bearer " + jwt({ sub: A }) }, body: JSON.stringify({ user_id: B, id: B }) }), ENV, AGORA);
  expect(r.status === 200, "status " + r.status);
  const dels = chamadas.filter(c => c.metodo === "DELETE");
  expect(dels.length === 1 && dels[0].url.endsWith("/admin/users/" + A), JSON.stringify(dels));
  expect(!chamadas.some(c => c.url.includes(B)), "B nunca é tocado");
});
await test("token de A com sub forjado de B (Supabase diz que é A) → 401, nada excluído", async () => {
  respostasSupabase["GET /auth/v1/user"] = { status: 200, body: { id: A } };
  const r = await mod.rotaExcluirConta(req("POST", jwt({ sub: B })), ENV, AGORA);
  expect(r.status === 401 && !chamadas.some(c => c.metodo === "DELETE"));
});
await test("assinatura inválida/sessão revogada (Supabase 401) → 401, nada excluído", async () => {
  respostasSupabase["GET /auth/v1/user"] = { status: 401, body: {} };
  const r = await mod.rotaExcluirConta(req("POST", jwt({ sub: A })), ENV, AGORA);
  expect(r.status === 401 && !chamadas.some(c => c.metodo === "DELETE"));
});
await test("chave de serviço só no servidor: vai no DELETE admin, nunca na resposta", async () => {
  respostasSupabase["GET /auth/v1/user"] = { status: 200, body: { id: A } };
  respostasSupabase["DELETE /auth/v1/admin/users/" + A] = { status: 200, body: {} };
  const r = await mod.rotaExcluirConta(req("POST", jwt({ sub: A })), ENV, AGORA);
  const txt = await r.text();
  expect(!txt.includes("service-secret") && chamadas.find(c => c.metodo === "DELETE").auth === "Bearer service-secret");
});
await test("falha do Supabase no DELETE → 502 sem detalhe interno", async () => {
  respostasSupabase["GET /auth/v1/user"] = { status: 200, body: { id: A } };
  respostasSupabase["DELETE /auth/v1/admin/users/" + A] = { status: 500, body: { msg: "db detail" } };
  const r = await mod.rotaExcluirConta(req("POST", jwt({ sub: A })), ENV, AGORA);
  const j = await r.json();
  expect(r.status === 502 && j.erro === "falha" && !JSON.stringify(j).includes("db detail"));
});
await test("GET → 405; OPTIONS → 204 com CORS só de ownews.com.br; sem secret → 503", async () => {
  expect((await mod.rotaExcluirConta(req("GET"), ENV, AGORA)).status === 405);
  const o = await mod.rotaExcluirConta(req("OPTIONS"), ENV, AGORA);
  expect(o.status === 204 && o.headers.get("Access-Control-Allow-Origin") === "https://ownews.com.br");
  expect((await mod.rotaExcluirConta(req("POST", jwt({ sub: A })), {}, AGORA)).status === 503);
});
await test("conta de teste: só owbuddy-teste-*@example.com", async () => {
  const mk = c => new Request("https://c/admin/conta-teste", { method: "POST", body: JSON.stringify(c) });
  expect((await mod.rotaAdminContaTeste(mk({ email: "alguem@gmail.com", senha: "x".repeat(16) }), ENV)).status === 400);
  expect((await mod.rotaAdminContaTeste(mk({ email: "owbuddy-teste-abc123@example.com", senha: "curta" }), ENV)).status === 400);
});
await test("roteamento: /conta/excluir antes do portão admin; /admin/conta-teste depois dele", async () => {
  const iConta = src.indexOf('url.pathname === "/conta/excluir"'), iGate = src.indexOf("!ROTAS_PUBLICAS_COLLECTOR.has(url.pathname) && !tokenAdminValido"), iTeste = src.indexOf('url.pathname === "/admin/conta-teste"');
  expect(iConta > 0 && iConta < iGate && iTeste > iGate);
});
console.log("\n" + pass + " passaram, " + fail + " falharam");
process.exit(fail ? 1 : 0);
})();
