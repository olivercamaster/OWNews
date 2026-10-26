/* OWNews AO VIVO — snapshot de fonte externa com cache no PoP.
 *
 * Infra genérica herdada da cobertura das Eleições 2026 (bloco removido do
 * worker.js em 26/10/2026; código completo na tag ownews-eleicoes-2026-final).
 * NÃO é importado pelo worker.js hoje: custo zero no bundle. Para usar num
 * evento ao vivo (placar, apuração, evento especial):
 *
 *   import { buscarSnapshot } from './ao-vivo/snapshot.js';
 *   const { snap } = await buscarSnapshot({ chave: 'jogo-123', url, transformar, ctx });
 *
 * Garantias:
 *  - Navegador → OWNews, nunca → fonte (chave de API fica no servidor).
 *  - A fonte é consultada no máximo 1x a cada `intervaloS` por PoP; visitantes
 *    dentro da janela recebem o snapshot do Cache API.
 *  - Revalidação condicional (If-None-Match / If-Modified-Since): 304 só renova
 *    o carimbo de consulta.
 *  - Fonte fora do ar: mantém o último snapshot válido e marca `falhaEm`.
 *  - Sem KV e sem banco: só Cache API (sem PUT de KV por acesso).
 */

export async function buscarSnapshot({ chave, url, transformar, ctx, intervaloS = 30, retencaoS = 172800, headers = {}, namespace = 'ownews-ao-vivo.interno' }) {
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const k = new Request('https://' + namespace + '/' + encodeURIComponent(chave));
  let snap = null;
  if (cache) { try { const r = await cache.match(k); if (r) snap = await r.json(); } catch {} }
  const agora = Date.now();
  if (snap && agora - snap.consultadoEm < intervaloS * 1000) return { snap, fonte: 'cache' };
  const cab = { 'User-Agent': 'OWNews-AoVivo/1.0 (+https://ownews.com.br)', ...headers };
  if (snap && snap.etag) cab['If-None-Match'] = snap.etag;
  else if (snap && snap.lm) cab['If-Modified-Since'] = snap.lm;
  let novo = null, erro = null;
  try {
    const r = await fetch(url, { headers: cab, cf: { cacheTtl: 0 } });
    if (r.status === 304 && snap) novo = { ...snap, consultadoEm: agora, falhaEm: null };
    else if (r.ok) novo = { dados: transformar(await r.json()), etag: r.headers.get('etag'), lm: r.headers.get('last-modified'), consultadoEm: agora, falhaEm: null };
    else erro = 'HTTP ' + r.status;
  } catch (e) { erro = String(e && e.message || e); }
  if (!novo) {
    if (!snap) return { snap: null, erro };
    novo = { ...snap, consultadoEm: agora, falhaEm: agora };
  }
  if (cache) {
    const gravar = cache.put(k, new Response(JSON.stringify(novo), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + retencaoS } }));
    if (ctx && ctx.waitUntil) ctx.waitUntil(gravar.catch(() => {})); else await gravar.catch(() => {});
  }
  return { snap: novo, fonte: novo.falhaEm ? 'snapshot' : 'origem' };
}

/* Lado do navegador (padrão usado na Home das Eleições, ES5 inline):
 *  - fetch para a API do próprio OWNews com cache:'no-store';
 *  - render só com textContent (nada de innerHTML com dado externo);
 *  - setInterval(…, 30000) que só busca quando !document.hidden;
 *  - falha com dado já exibido: mantém o último e avisa "atualização
 *    temporariamente indisponível"; sem dado nenhum: mensagem neutra.
 *  - módulo da Home com data de expiração (some sozinho) e cache de borda
 *    da Home de 300 s: o HTML pode estar velho, o dado vem sempre do fetch. */
