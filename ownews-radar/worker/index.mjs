/**
 * ownews-radar — worker isolado do Radar Offshore. Só LÊ snapshots do KV (escritos pela ingestão
 * no VPS via PUT /interno/snapshot). Nunca baixa nada da ANP por pageview.
 *
 * Páginas HTML: devolve JSON { titulo, descricao, html, canonical, jsonLd, robots, status } com o
 * cabeçalho X-Radar-Pagina: 1 — o worker principal do OWNews veste com a casca oficial do site.
 * APIs (JSON, CORS aberto, só GET): /radar-offshore/api/{resumo,catalogo,busca,unidade,geo/*}.
 * Escrita: só PUT /interno/snapshot com X-Radar-Secret (Worker Secret RADAR_INGEST_SECRET).
 */
import * as P from './paginas.mjs';
import { CSS, JS_FILTROS, JS_MAPA } from './estaticos.mjs';
import { BASE } from './ui.mjs';

/** Versão do HTML: suba a cada mudança de página/CSS (entra na chave do cache de borda). */
const VERSAO_UI = '3';
const memoria = new Map(); // memo curta por isolate: { valor, em }
/** Só testes: zera a memória do isolate entre cenários. */
export function __limparMemoria() { memoria.clear(); }
const MEMO_MS = 60_000;
const CHAVES_PERMITIDAS = /^radar:(meta|resumo|unidades|campos|operadores|producao|exploracao|futuro|noticias|vagas|busca|pautas|revisao|geo:(campos|blocos|presal))$/;

async function ler(env, chave) {
  const m = memoria.get(chave);
  if (m && Date.now() - m.em < MEMO_MS) return m.valor;
  const valor = await env.RADAR_KV.get(chave, 'json');
  memoria.set(chave, { valor, em: Date.now() });
  return valor;
}
async function lerVarias(env, nomes) {
  const vals = await Promise.all(nomes.map((n) => ler(env, `radar:${n}`)));
  return Object.fromEntries(nomes.map((n, i) => [n, vals[i]]));
}

function igualSeguro(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length < 24) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=600', ...extra },
});

function respostaPagina(p, host) {
  return new Response(JSON.stringify(p), {
    status: p.status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8', 'x-radar-pagina': '1', 'cache-control': p.status === 200 ? 'public, max-age=900' : 'no-store',
      ...(host !== 'ownews.com.br' ? { 'x-robots-tag': 'noindex' } : {}),
    },
  });
}

/* ─── Rotas internas (ingestão) ─── */
async function interno(request, env, url) {
  if (!igualSeguro(request.headers.get('x-radar-secret') || '', env.RADAR_INGEST_SECRET || '')) return json({ erro: 'não autorizado' }, 401, { 'cache-control': 'no-store' });
  if (url.pathname === '/interno/snapshot' && request.method === 'PUT') {
    const chave = url.searchParams.get('chave') || '';
    if (!CHAVES_PERMITIDAS.test(chave)) return json({ erro: 'chave não permitida' }, 400);
    const texto = await request.text();
    if (texto.length > 5_000_000) return json({ erro: 'grande demais' }, 413);
    try { JSON.parse(texto); } catch { return json({ erro: 'json inválido' }, 400); }
    await env.RADAR_KV.put(chave, texto);
    memoria.delete(chave);
    console.log(JSON.stringify({ evento: 'snapshot_recebido', chave, bytes: texto.length }));
    return json({ ok: true, chave }, 200, { 'cache-control': 'no-store' });
  }
  if (url.pathname === '/interno/pautas') return json(await ler(env, 'radar:pautas') || [], 200, { 'cache-control': 'no-store' });
  if (url.pathname === '/interno/saude') {
    const [meta, revisao] = await Promise.all([ler(env, 'radar:meta'), ler(env, 'radar:revisao')]);
    return json({ meta, revisao: revisao || [] }, 200, { 'cache-control': 'no-store' });
  }
  return json({ erro: 'rota interna desconhecida' }, 404);
}

/* ─── APIs públicas (GET) ─── */
function normalizarBusca(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

async function api(env, url) {
  const rota = url.pathname.slice(`${BASE}/api/`.length);
  if (rota === 'resumo') {
    const [resumo, meta] = await Promise.all([ler(env, 'radar:resumo'), ler(env, 'radar:meta')]);
    return resumo ? json({ ...resumo, atualizado_em: meta?.gerado_em || null, url: `https://ownews.com.br${BASE}` }) : json({ erro: 'sem dados' }, 503);
  }
  if (rota === 'catalogo') {
    // Para o OWBuddy guardar no aparelho: só o catálogo público de unidades (nada do usuário).
    const busca = await ler(env, 'radar:busca');
    return busca ? json({ versao: 1, unidades: busca.map(({ id, slug, nome, tipo, categoria, sigla }) => ({ id, slug, nome, tipo, categoria, sigla })) }, 200, { 'cache-control': 'public, max-age=3600' }) : json({ erro: 'sem dados' }, 503);
  }
  if (rota === 'buddy') {
    // Pacote do OWBuddy: catálogo público + notícias de TODAS as unidades. O app filtra no aparelho,
    // então o OWNews nunca recebe "qual é a unidade de quem pergunta" (privacidade por desenho).
    const { unidades, operadores, noticias, meta } = await lerVarias(env, ['unidades', 'operadores', 'noticias', 'meta']);
    if (!unidades) return json({ erro: 'sem dados' }, 503);
    const ops = new Map((operadores || []).map((o) => [o.id, o]));
    const comLink = (l) => (l || []).slice(0, 5).map((n) => ({ id: n.id, titulo: n.titulo, data: n.data }));
    const opsUsados = new Set();
    const lista = unidades.map((u) => {
      const op = ops.get(u.categoria === 'sonda' ? u.operador_sonda : u.operador);
      if (op) opsUsados.add(op.id);
      return { id: u.id, slug: u.slug, nome: u.nome, tipo: u.tipo, categoria: u.categoria, sigla: u.sigla, bacia: u.bacia || null,
        operador: op ? { id: op.id, nome: op.nome, slug: op.slug } : null, campos: (u.campos || []).map((c) => c.nome) };
    });
    return json({
      versao: 1, atualizado_em: meta?.gerado_em || null, fonte: 'ANP', base_url: `https://ownews.com.br${BASE}`,
      unidades: lista,
      noticias_unidades: Object.fromEntries(Object.entries(noticias?.unidades || {}).map(([k, v]) => [k, comLink(v)])),
      noticias_operadores: Object.fromEntries(Object.entries(noticias?.operadores || {}).filter(([k]) => opsUsados.has(k)).map(([k, v]) => [k, comLink(v).slice(0, 3)])),
    }, 200, { 'cache-control': 'public, max-age=1800' });
  }
  if (rota === 'busca') {
    const q = normalizarBusca(url.searchParams.get('q')).slice(0, 60);
    if (q.length < 2) return json({ unidades: [], campos: [], operadores: [] });
    const { unidades, campos, operadores } = await lerVarias(env, ['unidades', 'campos', 'operadores']);
    const casa = (t) => normalizarBusca(t).includes(q);
    const prim = (t) => normalizarBusca(t).startsWith(q) ? 0 : 1;
    const ord = (a, b) => prim(a.nome) - prim(b.nome) || a.nome.localeCompare(b.nome, 'pt-BR');
    return json({
      unidades: (unidades || []).filter((u) => casa(u.nome) || casa(u.sigla)).sort(ord).slice(0, 8).map((u) => ({ id: u.id, slug: u.slug, nome: u.nome, tipo: u.tipo, categoria: u.categoria, url: `${BASE}/unidades/${u.slug}` })),
      campos: (campos || []).filter((c) => casa(c.nome)).sort(ord).slice(0, 5).map((c) => ({ id: c.id, slug: c.slug, nome: c.nome, bacia: c.bacia, url: `${BASE}/campos/${c.slug}` })),
      operadores: (operadores || []).filter((o) => casa(o.nome)).sort(ord).slice(0, 5).map((o) => ({ id: o.id, slug: o.slug, nome: o.nome, url: `${BASE}/operadores/${o.slug}` })),
    });
  }
  if (rota === 'unidade') {
    // Minha Unidade (OWBuddy): por id estável (preferido) ou slug. Só dados públicos.
    const id = url.searchParams.get('id'), s = url.searchParams.get('slug');
    const { unidades, operadores, campos, noticias, meta } = await lerVarias(env, ['unidades', 'operadores', 'campos', 'noticias', 'meta']);
    const u = (unidades || []).find((x) => (id && x.id === id) || (s && x.slug === s));
    if (!u) return json({ erro: 'unidade não encontrada' }, 404);
    const opId = u.categoria === 'sonda' ? u.operador_sonda : u.operador;
    const op = (operadores || []).find((o) => o.id === opId);
    const cPorId = new Map((campos || []).map((c) => [c.id, c]));
    return json({
      id: u.id, slug: u.slug, nome: u.nome, tipo: u.tipo, categoria: u.categoria, sigla: u.sigla, bacia: u.bacia || null,
      operador: op ? { nome: op.nome, url: `https://ownews.com.br${BASE}/operadores/${op.slug}` } : null,
      campos: (u.campos || []).map((c) => ({ nome: c.nome, url: c.id && cPorId.get(c.id) ? `https://ownews.com.br${BASE}/campos/${cPorId.get(c.id).slug}` : null })),
      url: `https://ownews.com.br${BASE}/unidades/${u.slug}`,
      noticias_unidade: ((noticias?.unidades || {})[u.id] || []).slice(0, 5).map((n) => ({ ...n, url: `https://ownews.com.br/noticia?id=${encodeURIComponent(n.id)}` })),
      noticias_operador: op ? ((noticias?.operadores || {})[op.id] || []).slice(0, 3).map((n) => ({ ...n, url: `https://ownews.com.br/noticia?id=${encodeURIComponent(n.id)}` })) : [],
      atualizado_em: meta?.gerado_em || null,
      fonte: 'ANP',
    });
  }
  if (rota.startsWith('geo/')) {
    const nome = rota.slice(4);
    if (nome === 'unidades') {
      const { unidades, operadores } = await lerVarias(env, ['unidades', 'operadores']);
      const ops = new Map((operadores || []).map((o) => [o.id, o.nome]));
      return json({ type: 'FeatureCollection', features: (unidades || []).filter((u) => Number.isFinite(u.lat) && Number.isFinite(u.lon)).map((u) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [u.lon, u.lat] }, properties: { slug: u.slug, nome: u.nome, tipo: u.tipo, operador: ops.get(u.operador) || null } })) }, 200, { 'cache-control': 'public, max-age=3600' });
    }
    if (['campos', 'blocos', 'presal'].includes(nome)) {
      const g = await ler(env, `radar:geo:${nome}`);
      return g ? json(g, 200, { 'cache-control': 'public, max-age=86400' }) : json({ type: 'FeatureCollection', features: [] }, 200);
    }
  }
  return json({ erro: 'rota desconhecida' }, 404);
}

async function sitemap(env) {
  const { unidades, campos, operadores } = await lerVarias(env, ['unidades', 'campos', 'operadores']);
  const urls = [BASE, ...['unidades', 'sondas', 'campos', 'operadores', 'producao', 'exploracao', 'futuro', 'mapa', 'fontes'].map((s) => `${BASE}/${s}`),
    ...(unidades || []).map((u) => `${BASE}/unidades/${u.slug}`), ...(campos || []).map((c) => `${BASE}/campos/${c.slug}`), ...(operadores || []).map((o) => `${BASE}/operadores/${o.slug}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>https://ownews.com.br${u}</loc></url>`).join('')}</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

/* ─── Páginas ─── */
async function pagina(env, url) {
  const partes = url.pathname.replace(/\/+$/, '').slice(BASE.length).split('/').filter(Boolean);
  const [secao, slug] = partes;
  const precisa = {
    undefined: ['resumo', 'meta', 'producao'], unidades: ['unidades', 'operadores', 'meta', ...(slug ? ['campos', 'noticias'] : [])], sondas: ['unidades', 'operadores', 'meta'],
    campos: ['campos', 'operadores', 'meta', ...(slug ? ['unidades', 'noticias'] : [])], operadores: ['operadores', 'meta', ...(slug ? ['unidades', 'campos', 'noticias', 'vagas'] : [])],
    producao: ['producao', 'campos', 'unidades', 'meta'], exploracao: ['exploracao', 'meta'], futuro: ['futuro', 'meta'], mapa: ['meta'], fontes: ['meta'],
  }[secao];
  if (!precisa || partes.length > 2 || (slug && !['unidades', 'campos', 'operadores'].includes(secao))) return P.naoEncontrada('Página');
  const d = await lerVarias(env, precisa);
  if (!d.meta) return P.indisponivel();
  d.noticias = d.noticias || {};
  switch (secao) {
    case undefined: return P.hub(d);
    case 'unidades': {
      if (!slug) return P.listaUnidades(d, 'producao');
      const u = (d.unidades || []).find((x) => x.slug === slug);
      return u ? P.unidade({ ...d, u }) : P.naoEncontrada('Unidade');
    }
    case 'sondas': return P.listaUnidades(d, 'sonda');
    case 'campos': {
      if (!slug) return P.listaCampos(d);
      const c = (d.campos || []).find((x) => x.slug === slug);
      return c ? P.campo({ ...d, c }) : P.naoEncontrada('Campo');
    }
    case 'operadores': {
      if (!slug) return P.listaOperadores(d);
      const o = (d.operadores || []).find((x) => x.slug === slug);
      return o ? P.operador({ ...d, o }) : P.naoEncontrada('Operador');
    }
    case 'producao': return P.producao(d);
    case 'exploracao': return P.exploracao(d);
    case 'futuro': return P.futuro(d);
    case 'mapa': return P.mapa(d);
    case 'fontes': return P.fontes(d);
  }
  return P.naoEncontrada('Página');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/interno/')) return interno(request, env, url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ erro: 'método não permitido' }, 405);
    if (!url.pathname.startsWith(BASE)) return new Response(null, { status: 301, headers: { location: `https://ownews.com.br${BASE}` } });
    if (url.pathname === `${BASE}/static/radar.css`) return new Response(CSS, { headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'public, max-age=604800' } });
    if (url.pathname === `${BASE}/static/filtros.js`) return new Response(JS_FILTROS, { headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'public, max-age=604800' } });
    if (url.pathname === `${BASE}/static/mapa.js`) return new Response(JS_MAPA, { headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'public, max-age=604800' } });
    try {
      if (url.pathname.startsWith(`${BASE}/api/`)) return await api(env, url);
      if (url.pathname === `${BASE}/sitemap.xml`) return await sitemap(env);
      // HTML: cache de borda por versão do snapshot (gerado_em) — CPU só na primeira visita.
      const meta = await ler(env, 'radar:meta');
      const chaveCache = new Request(`https://radar-cache.interno${url.pathname.replace(/\/+$/, '') || BASE}?v=${encodeURIComponent(meta?.gerado_em || '0')}&ui=${VERSAO_UI}&h=${url.hostname === 'ownews.com.br' ? 1 : 0}`);
      const emCache = await caches.default.match(chaveCache);
      if (emCache) return emCache;
      const p = await pagina(env, url);
      const resposta = respostaPagina(p, url.hostname);
      if (p.status === 200) ctx.waitUntil(caches.default.put(chaveCache, resposta.clone()));
      return resposta;
    } catch (e) {
      console.log(JSON.stringify({ evento: 'radar_erro', rota: url.pathname, erro: String(e && e.message).slice(0, 200) }));
      return url.pathname.startsWith(`${BASE}/api/`) ? json({ erro: 'indisponível' }, 503, { 'cache-control': 'no-store' }) : respostaPagina(P.indisponivel(), url.hostname);
    }
  },
};
