// Mede subrequests REAIS de grupos do collector (P0 31/10/2026): fontes e páginas reais (rede), memória
// de reprovação real (export de GET /admin/rejeicoes), Supabase/DO/IA simulados e contados.
// Uso: REJ=rejeicoes.json node tests/medir_subrequests.mjs worker.js C A   (grupos na MESMA invocação)
import fs from 'node:fs';
const [,, workerPath, ...grupos] = process.argv;
let src = fs.readFileSync(workerPath, 'utf8').replace(/^const ([A-Z_0-9]+) = /gm, 'var $1 = ');
src += (src.includes('function comOrcamento') ? '\nexport { comOrcamento };' : '\nconst comOrcamento = (e) => e; export { comOrcamento };') + '\nexport { executarAtualizacaoPrincipal, executarAtualizacaoNovasFontes, executarAtualizacaoTerceiraFonte, executarAtualizacaoInternacional, executarAtualizacaoImprensaEspecializada };\n';
const tmp = new URL('file://' + (await import('node:os')).tmpdir() + '/medir-' + process.pid + '.mjs'); fs.writeFileSync(tmp, src);
const rej = JSON.parse(fs.readFileSync(process.env.REJ, 'utf8'));
const cont = { fetch_rede: 0, supabase: 0, do: 0, ai: 0 };
const fetchReal = globalThis.fetch;
const SB = 'https://sb.teste';
globalThis.fetch = async (url, init) => {
  const u = String(url && url.url || url);
  if (u.startsWith(SB)) { cont.supabase++; const m = (init && init.method) || 'GET';
    return new Response(m === 'GET' ? '[]' : '[{"id":"x"}]', { status: m === 'GET' ? 200 : 201, headers: { 'content-type': 'application/json' } }); }
  cont.fetch_rede++; return fetchReal(url, init);
};
const stub = { fetch: async (req) => { cont.do++; const u = new URL(typeof req === 'string' ? req : req.url);
  if (u.pathname === '/rejeicoes' && u.searchParams.get('v') === '3') return Response.json({ rej: Object.fromEntries(Object.entries(rej).map(([k, v]) => [k, { c: v.c, n: v.n, t: v.t, m: v.m }])), tec: {} });
  if (u.pathname === '/rejeicoes') return Response.json(u.searchParams.get('v') === '2' ? Object.fromEntries(Object.entries(rej).map(([k, v]) => [k, { c: v.c, n: v.n, t: v.t, m: v.m }])) : Object.keys(rej));
  if (u.pathname === '/rejeicao') return Response.json(rej[u.searchParams.get('hash')] || null);
  if (u.pathname.startsWith('/tecnica')) return Response.json(null);
  return Response.json({ ok: true }); } };
const DO = { idFromName: () => 'id', get: () => stub };
const env = { SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_ANON_KEY: 'k',
  AI: { run: async () => { cont.ai++; return { response: '{"acao":"fora_escopo"}' }; } },
  BUDDY_IA_DO: DO, EDITORIAL_POLLER: DO, SAUDE_KV: { get: async () => null, put: async () => {} }, PERGUNTE_IA_KV: { get: async () => null, put: async () => {} } };
const W = await import(tmp.href);
const FN = { A: 'executarAtualizacaoPrincipal', B: 'executarAtualizacaoNovasFontes', C: 'executarAtualizacaoTerceiraFonte', D: 'executarAtualizacaoInternacional', E: 'executarAtualizacaoImprensaEspecializada' };
const envInv = W.comOrcamento(env);
for (const g of grupos) {
  const antes = { ...cont };
  const r = await W[FN[g]](envInv);
  const d = Object.fromEntries(Object.keys(cont).map((k) => [k, cont[k] - antes[k]]));
  const st = {}; for (const f of Object.values(r.resultados || {})) for (const n of f.noticias || []) { const k = n.status + (n.motivo ? ':' + n.motivo : ''); st[k] = (st[k] || 0) + 1; }
  const erros = Object.entries(r.resultados || {}).filter(([, f]) => f && f.ok === false).map(([k, f]) => k + ':' + String(f.erro).slice(0, 40));
  console.log(`grupo ${g}: subrequests=${d.fetch_rede + d.supabase + d.do + d.ai} ${JSON.stringify(d)} itens=${JSON.stringify(st)} ${erros.length ? 'ERROS ' + erros.join(' ') : ''}`);
}
console.log(`orcamento: ${JSON.stringify(envInv.__orc || null)}`);
console.log(`TOTAL invocação (${grupos.join('+')}): ${cont.fetch_rede + cont.supabase + cont.do + cont.ai} ${JSON.stringify(cont)}`);
fs.unlinkSync(tmp);
