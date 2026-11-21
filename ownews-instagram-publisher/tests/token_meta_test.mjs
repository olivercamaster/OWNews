// Token e falhas da Meta (21/11/2026): o token de 17/09 expirou em 15/11 e os slots de 16 e 18/11 morreram com
// HTTP 401 (code 190) sem aparecer no health. Roda o worker real com fetch e KV simulados — nenhuma chamada de rede.
//   node tests/token_meta_test.mjs
import assert from 'node:assert/strict';
import worker, { __t } from '../worker.js';
const { renovarTokenSeNecessario, comTokenEfetivo, registrarErroMeta, CRON_SLOT, CRON_BREAKING } = __t;

function kvFake() { const m = new Map(); return { m, get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } }; }
let ok = 0;
async function t(nome, fn) { await fn(); ok++; console.log('  ✓ ' + nome); }

await t('renova o token válido, guarda no KV e passa a usar o renovado', async () => {
  const kv = kvFake(); let pedidas = 0;
  globalThis.fetch = async (u) => { pedidas++; assert.match(String(u), /refresh_access_token\?grant_type=ig_refresh_token&access_token=SEGREDO1/); return new Response(JSON.stringify({ access_token: 'RENOVADO1', expires_in: 5184000 }), { status: 200 }); };
  const env = { SAUDE_KV: kv, INSTAGRAM_ACCESS_TOKEN: 'SEGREDO1' };
  const r = await renovarTokenSeNecessario(env);
  assert.equal(r.ok, true); assert.equal((await comTokenEfetivo(env)).INSTAGRAM_ACCESS_TOKEN, 'RENOVADO1');
  assert.equal((await comTokenEfetivo(env)).SAUDE_KV, kv, 'bindings continuam acessíveis');
  assert.equal((await renovarTokenSeNecessario(env)).pulou, true, 'dentro de 7 dias não renova de novo');
  assert.equal(pedidas, 1);
  // 8 dias depois renova a partir do token renovado
  globalThis.fetch = async (u) => { assert.match(String(u), /access_token=RENOVADO1/); return new Response(JSON.stringify({ access_token: 'RENOVADO2', expires_in: 5184000 }), { status: 200 }); };
  await renovarTokenSeNecessario(env, Date.now() + 8 * 86400000);
  assert.equal((await comTokenEfetivo(env)).INSTAGRAM_ACCESS_TOKEN, 'RENOVADO2');
  // segredo novo gravado por uma pessoa volta a mandar (o renovado era de outro segredo)
  assert.equal((await comTokenEfetivo({ SAUDE_KV: kv, INSTAGRAM_ACCESS_TOKEN: 'SEGREDO_NOVO' })).INSTAGRAM_ACCESS_TOKEN, 'SEGREDO_NOVO');
});

await t('P) token expirado (code 190) fica registrado e o health alerta com a ação humana', async () => {
  const kv = kvFake();
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Error validating access token: Session has expired on Sunday, 15-Nov-26 18:23:09 PST.', type: 'OAuthException', code: 190 } }), { status: 400 });
  const env = { SAUDE_KV: kv, INSTAGRAM_ACCESS_TOKEN: 'VELHO', INSTAGRAM_ACCOUNT_ID: '1' };
  const r = await renovarTokenSeNecessario(env);
  assert.equal(r.ok, false); assert.equal(r.token_expirado, true);
  const h = await (await worker.fetch(new Request('https://w/saude-fragment'), env, { waitUntil() {} })).json();
  assert.match(h.alerta, /TOKEN DO INSTAGRAM EXPIRADO/); assert.equal(h.token.renovacao.token_expirado, true);
});

await t('P) falha da Meta na publicação persiste no health mesmo depois de um "skip"', async () => {
  const kv = kvFake();
  const env = { SAUDE_KV: kv, INSTAGRAM_ACCESS_TOKEN: 'X', INSTAGRAM_ACCOUNT_ID: '1' };
  await registrarErroMeta(env, 'criarContainer falhou: HTTP 401 — {"error":{"code":190}}');
  await kv.put('instagram_ultima_execucao', JSON.stringify({ resultado: 'skip', motivo: 'score baixo' }));
  globalThis.fetch = async () => new Response('{}', { status: 200 });
  const h = await (await worker.fetch(new Request('https://w/saude-fragment'), env, { waitUntil() {} })).json();
  assert.equal(h.ultima_execucao.resultado, 'skip'); assert.equal(h.ultimo_erro_meta.token_expirado, true); assert.ok(h.alerta);
});

await t('Q) cron horário renova o token; o do slot não', async () => {
  const kv = kvFake(); const urls = [];
  globalThis.fetch = async (u) => { urls.push(String(u)); return new Response(JSON.stringify(String(u).includes('refresh_access_token') ? { access_token: 'N', expires_in: 100 } : []), { status: 200 }); };
  const env = { SAUDE_KV: kv, INSTAGRAM_ACCESS_TOKEN: 'S', INSTAGRAM_ACCOUNT_ID: '1', SUPABASE_URL: 'https://sb' };
  const espera = []; const ctx = { waitUntil: (p) => espera.push(p) };
  await worker.scheduled({ cron: CRON_SLOT, scheduledTime: Date.parse('2026-11-22T12:00:00Z') }, env, ctx); await Promise.all(espera);
  assert.ok(!urls.some((u) => u.includes('refresh_access_token')));
  await worker.scheduled({ cron: CRON_BREAKING, scheduledTime: Date.parse('2026-11-22T03:30:00Z') }, env, ctx); await Promise.all(espera);
  assert.ok(urls.some((u) => u.includes('refresh_access_token')));
});
console.log(`\n${ok} passaram, 0 falharam`);
