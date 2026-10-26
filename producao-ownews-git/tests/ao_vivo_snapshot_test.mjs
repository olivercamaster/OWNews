#!/usr/bin/env node
/* AO VIVO — infra genérica de snapshot (ao-vivo/snapshot.js), sem rede. */
import { buscarSnapshot } from '../ao-vivo/snapshot.js';
import fs from 'node:fs';
let pass = 0, fail = 0;
const expect = (c, m) => { if (!c) throw new Error(m || 'falhou'); };
const store = new Map();
globalThis.caches = { default: {
  match: async (req) => { const v = store.get(req.url); return v ? new Response(v) : undefined; },
  put: async (req, resp) => { store.set(req.url, await resp.text()); },
} };
let t = 1_000_000; Date.now = () => t;
let chamadas = [], proxima;
globalThis.fetch = async (u, o) => { chamadas.push(o.headers); return proxima(); };
const opts = { chave: 'x', url: 'https://fonte.exemplo/x.json', transformar: (j) => ({ placar: j.p }) };

const casos = [
  ['primeira consulta grava snapshot com ETag', async () => {
    proxima = () => new Response(JSON.stringify({ p: '1x0' }), { headers: { etag: '"a"' } });
    const r = await buscarSnapshot(opts);
    expect(r.fonte === 'origem' && r.snap.dados.placar === '1x0' && chamadas.length === 1);
  }],
  ['dentro do intervalo não consulta a fonte', async () => {
    t += 10_000; const r = await buscarSnapshot(opts);
    expect(r.fonte === 'cache' && chamadas.length === 1);
  }],
  ['após o intervalo revalida com If-None-Match e aceita 304', async () => {
    t += 30_000; proxima = () => new Response(null, { status: 304 });
    const r = await buscarSnapshot(opts);
    expect(chamadas.at(-1)['If-None-Match'] === '"a"' && r.snap.dados.placar === '1x0' && !r.snap.falhaEm);
  }],
  ['fonte fora do ar mantém último snapshot e marca falhaEm', async () => {
    t += 31_000; proxima = () => { throw new Error('rede'); };
    const r = await buscarSnapshot(opts);
    expect(r.fonte === 'snapshot' && r.snap.dados.placar === '1x0' && r.snap.falhaEm === t);
  }],
  ['sem snapshot e fonte fora do ar: dados nulos com erro', async () => {
    proxima = () => new Response('x', { status: 503 });
    const r = await buscarSnapshot({ ...opts, chave: 'novo' });
    expect(r.snap.dados === null && r.erro === 'HTTP 503');
  }],
  ['fonte fora do ar sem snapshot: grava falha e não reconsulta a cada visitante', async () => {
    const antes = chamadas.length; t += 1000;
    const r = await buscarSnapshot({ ...opts, chave: 'novo' });
    expect(chamadas.length === antes && r.snap.dados === null && r.fonte === 'cache');
  }],
  ['timeout e payload inválido contam como falha', async () => {
    t += 10 * 60_000; proxima = () => new Response(JSON.stringify({ outra: 1 }));
    const r = await buscarSnapshot({ ...opts, transformar: (j) => (j.p ? j : null) });
    expect(r.fonte === 'snapshot' && r.erro === 'payload inválido' && r.snap.dados.placar === '1x0');
  }],
  ['infra genérica: sem esporte/eleição e sem KV', async () => {
    const s = fs.readFileSync(new URL('../ao-vivo/snapshot.js', import.meta.url), 'utf8');
    expect(!/futebol|placar|tse|eleic/i.test(s.replace(/\/\*[\s\S]*?\*\//g, '')), 'código específico na infra');
    expect(!/\.put\(/.test(s.replace('cache.put(', '')), 'put fora do Cache API');
  }],
];
for (const [n, f] of casos) { try { await f(); pass++; console.log('OK  ', n); } catch (e) { fail++; console.log('FALHA', n, e.message); } }
console.log(`\n${pass} ok, ${fail} falha(s)`); process.exit(fail ? 1 : 0);
