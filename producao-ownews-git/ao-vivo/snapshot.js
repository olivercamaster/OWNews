/* OWNews AO VIVO — snapshot de fonte externa com cache no PoP.
 *
 * Infra genérica (sem nada de esporte ou eleição aqui). Nasceu na cobertura
 * das Eleições 2026 (código completo na tag ownews-eleicoes-2026-final) e é
 * usada hoje pelos placares (ao-vivo/futebol.js).
 *
 * Garantias:
 *  - Navegador → OWNews, nunca → fonte (chave de API fica no servidor).
 *  - A fonte é consultada no máximo 1x por `intervaloS` por PoP; o intervalo
 *    pode ser função do snapshot (ex.: 30 s com jogo ao vivo, 30 min sem jogo).
 *  - Revalidação condicional (If-None-Match / If-Modified-Since): 304 só renova
 *    o carimbo de consulta.
 *  - Timeout em toda consulta; payload que `transformar` rejeita = falha.
 *  - Fonte fora do ar: mantém o último snapshot válido, marca `falhaEm` e
 *    espaça as novas tentativas (disjuntor simples: 1, 2, 4… até 5 min).
 *  - Sem KV e sem banco: só Cache API (sem PUT de KV por acesso).
 */

const NS_PADRAO = 'ownews-ao-vivo.interno';

function chaveCache(namespace, chave) {
  return new Request('https://' + (namespace || NS_PADRAO) + '/' + encodeURIComponent(chave));
}

function log(evento, chave, extra) {
  // Logs genéricos e raros (no máximo 1 por consulta à fonte); nunca headers/URL com segredo.
  try { console.log(JSON.stringify(Object.assign({ ao_vivo: evento, chave }, extra || {}))); } catch {}
}

// Só lê o cache do PoP — nunca consulta a fonte. Para caminhos que não podem
// esperar a rede (ex.: render da Home).
export async function lerSnapshot(chave, namespace) {
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  if (!cache) return null;
  try { const r = await cache.match(chaveCache(namespace, chave)); return r ? await r.json() : null; } catch { return null; }
}

export async function buscarSnapshot({ chave, url, transformar, ctx, intervaloS = 30, retencaoS = 172800, timeoutMs = 4000, headers = {}, namespace = NS_PADRAO }) {
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const k = chaveCache(namespace, chave);
  let snap = null;
  if (cache) { try { const r = await cache.match(k); if (r) snap = await r.json(); } catch {} }
  const agora = Date.now();
  if (snap) {
    const base = typeof intervaloS === 'function' ? (snap.dados == null ? 60 : intervaloS(snap.dados)) : intervaloS;
    const espera = snap.falhaEm ? Math.min(300, base * Math.pow(2, Math.min(4, (snap.falhas || 1) - 1))) : base;
    if (agora - snap.consultadoEm < espera * 1000) {
      if (Math.random() < 0.01) log('cache_hit', chave);
      return { snap, fonte: 'cache' };
    }
  }
  log('cache_miss', chave);
  const cab = { 'User-Agent': 'OWNews-AoVivo/1.0 (+https://ownews.com.br)', ...headers };
  if (snap && snap.etag) cab['If-None-Match'] = snap.etag;
  else if (snap && snap.lm) cab['If-Modified-Since'] = snap.lm;
  let novo = null, erro = null;
  try {
    const sinal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined;
    const r = await fetch(url, { headers: cab, signal: sinal, cf: { cacheTtl: 0 } });
    if (r.status === 304 && snap) novo = { ...snap, consultadoEm: agora, falhaEm: null, falhas: 0 };
    else if (r.ok) {
      const dados = transformar(await r.json());
      if (dados == null) throw new Error('payload inválido');
      novo = { dados, etag: r.headers.get('etag'), lm: r.headers.get('last-modified'), consultadoEm: agora, atualizadoEm: agora, falhaEm: null, falhas: 0 };
    } else erro = 'HTTP ' + r.status;
  } catch (e) { erro = String(e && e.name === 'TimeoutError' ? 'timeout' : (e && e.message) || e); }
  if (novo) log('provider_fetch_ok', chave);
  else {
    log('provider_fetch_error', chave, { erro: String(erro).slice(0, 80) });
    // Sem snapshot anterior também grava (dados: null) — senão cada visitante
    // dispararia uma nova consulta enquanto a fonte estiver fora.
    novo = { ...(snap || { dados: null }), consultadoEm: agora, falhaEm: agora, falhas: ((snap && snap.falhas) || 0) + 1 };
  }
  if (cache) {
    const gravar = cache.put(k, new Response(JSON.stringify(novo), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + retencaoS } }));
    if (ctx && ctx.waitUntil) ctx.waitUntil(gravar.catch(() => {})); else await gravar.catch(() => {});
  }
  return { snap: novo, fonte: novo.falhaEm ? 'snapshot' : 'origem', erro };
}
