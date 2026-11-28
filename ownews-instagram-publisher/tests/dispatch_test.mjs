// Sem VPS (28/11/2026): a Cloudflare aciona os workflows do GitHub — arte na criação do job, Radar pelo cron horário.
//   node tests/dispatch_test.mjs
import assert from 'node:assert/strict';
import worker, { __t } from '../worker.js';
const { dispararWorkflow, RADAR_HORAS_UTC, CRON_BREAKING } = __t;
function kvFake() { const m = new Map(); return { m, get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } }; }
let ok = 0; async function t(n, f) { await f(); ok++; console.log('  ✓ ' + n); }

await t('dispara o workflow com ref main e inputs; falha fica registrada para o health', async () => {
  const kv = kvFake(); const pedidos = [];
  globalThis.fetch = async (u, init) => { pedidos.push([String(u), JSON.parse(init.body), init.headers.Authorization]); return new Response(null, { status: 204 }); };
  const r = await dispararWorkflow({ SAUDE_KV: kv, GITHUB_DISPATCH_TOKEN: 'T' }, 'radar-ingestao.yml', { modo: 'completo' });
  assert.equal(r.ok, true);
  assert.equal(pedidos[0][0], 'https://api.github.com/repos/olivercamaster/OWNews/actions/workflows/radar-ingestao.yml/dispatches');
  assert.deepEqual(pedidos[0][1], { ref: 'main', inputs: { modo: 'completo' } }); assert.equal(pedidos[0][2], 'Bearer T');
  globalThis.fetch = async () => new Response('{"message":"Bad credentials"}', { status: 401 });
  const f = await dispararWorkflow({ SAUDE_KV: kv, GITHUB_DISPATCH_TOKEN: 'T' }, 'radar-ingestao.yml', { modo: 'so-noticias' });
  assert.equal(f.ok, false); assert.match(JSON.parse(kv.m.get('gh_dispatch_radar_ingestao_yml')).motivo, /HTTP 401/);
  const h = await (await worker.fetch(new Request('https://w/saude-fragment'), { SAUDE_KV: kv }, { waitUntil() {} })).json();
  assert.match(h.alerta, /disparo falhou/);
  assert.equal((await dispararWorkflow({ SAUDE_KV: kv }, 'x.yml')).ok, false, 'sem token não chama nada');
});

await t('cron horário aciona o Radar nas horas do antigo crontab (10 UTC completo; 1,4,13,16,19,22 notícias)', async () => {
  assert.deepEqual(Object.keys(RADAR_HORAS_UTC).map(Number).sort((a, b) => a - b), [1, 4, 10, 13, 16, 19, 22]);
  for (const [hora, esperado] of [[10, 'completo'], [13, 'so-noticias'], [11, null]]) {
    const kv = kvFake(); const urls = [];
    globalThis.fetch = async (u, init) => { urls.push([String(u), init && init.body]); return String(u).includes('/dispatches') ? new Response(null, { status: 204 }) : new Response('[]', { status: 200 }); };
    const espera = []; const env = { SAUDE_KV: kv, GITHUB_DISPATCH_TOKEN: 'T', SUPABASE_URL: 'https://sb' };
    await worker.scheduled({ cron: CRON_BREAKING, scheduledTime: Date.UTC(2026, 10, 28, hora, 30) }, env, { waitUntil: (p) => espera.push(p) }); await Promise.all(espera);
    const radar = urls.find(([u]) => u.includes('radar-ingestao.yml'));
    if (esperado) assert.equal(JSON.parse(radar[1]).inputs.modo, esperado, 'hora ' + hora); else assert.ok(!radar, 'hora ' + hora + ' não aciona');
  }
});
console.log(`\n${ok} passaram, 0 falharam`);
