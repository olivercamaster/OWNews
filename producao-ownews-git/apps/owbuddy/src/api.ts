import AsyncStorage from '@react-native-async-storage/async-storage';
import { buscarJson } from './net';
import { normalizarArtigo, normalizarFeed, OWNEWS_BASE_URL, type Article } from './contratos';
import { lerPacoteRadar, type PacoteRadar } from '@owbuddy/domain';
export { paragrafos, type Article, type ExplicaItem } from './contratos';

// Contratos documentados em docs/OWBUDDY-CONTRATOS.md (mudou lá → muda aqui e no teste).
const BASE_URL = OWNEWS_BASE_URL;
const FEED_URL = `${BASE_URL}/api/buddy/feed`;
const VAGAS_URL = `${BASE_URL}/api/buddy/vagas`;
const UNIDADES_URL = `${BASE_URL}/api/buddy/unidades`;
// Radar Offshore: pacote público (catálogo + notícias de todas as unidades). O app filtra no aparelho.
const RADAR_PACOTE_URL = `${BASE_URL}/radar-offshore/api/buddy`;

// v3: feed só com matéria OWNews completa (Buddy + corpo + Impacto + fonte).
// O cache v2 tinha o lead da fonte em `summary` — não é mais lido.
const CACHE_KEY_FEED = 'owbuddy_cache_feed_v3';
const CACHE_KEY_ABERTAS = 'owbuddy_noticias_abertas_v1';
const CACHE_KEY_VAGAS = 'owbuddy_cache_vagas';
// `updated_at` do /api/buddy/vagas (última verificação nos portais) — chave separada para
// não mudar o formato do cache de vagas de quem já tem o app.
const CACHE_KEY_VAGAS_META = 'owbuddy_cache_vagas_meta_v1';
const CACHE_KEY_UNIDADES = 'owbuddy_cache_unidades_v1';
const CACHE_KEY_RADAR = 'owbuddy_cache_radar_v1';
const RADAR_TTL_MS = 6 * 60 * 60 * 1000; // 6 h (as bases da ANP mudam no máximo 1×/dia)
const FEED_TTL_MS = 5 * 60 * 1000;       // 5 min
const VAGAS_TTL_MS = 60 * 60 * 1000;     // 1 h
const UNIDADES_TTL_MS = 60 * 60 * 1000;  // 1 h
const ABERTAS_MAX = 40;

export type FleetStatusFonte = {
  nome: string;
  url: string;
  documento: string;
  data_ref: string;
};

export type Unidade = {
  slug: string;
  nome: string;
  tipo: string;
  tipo_label: string;
  codigo_petrobras: string | null;
  codigo_confianca: string | null;
  owner: string | null;
  contratante: string | null;
  status_brasil: string;
  campo: string | null;
  sobre: string | null;
  image_url: string | null;
  image_credit: string | null;
  image_status: 'real' | 'fallback' | 'ilustrativa' | 'ausente';
  fleet_status_fonte: FleetStatusFonte | null;
  url: string;
};

export type Vaga = {
  id: string;
  titulo: string;
  empresa: string;
  local: string | null;
  offshore_onshore: string | null;
  resumo: string;
  application_url: string | null;
  verificado_em: string;
};

type CacheEntry<T> = { data: T; cachedAt: number };

async function readCache<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const e = JSON.parse(raw) as CacheEntry<T>;
    return e && typeof e.cachedAt === 'number' ? e : null;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, cachedAt: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {}
}

function isStale(cachedAt: number, ttl: number): boolean {
  return Date.now() - cachedAt > ttl;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export type FeedResult =
  | { status: 'ok'; articles: Article[]; fromCache: boolean; cachedAt?: number }
  | { status: 'offline_cached'; articles: Article[]; cachedAt: number }
  | { status: 'offline_empty' }
  | { status: 'error'; message: string };

/** `forcar` ignora o TTL (puxar para atualizar). */
export async function fetchFeed(forcar = false): Promise<FeedResult> {
  const cached = await readCache<Article[]>(CACHE_KEY_FEED);
  if (!forcar && cached && !isStale(cached.cachedAt, FEED_TTL_MS)) {
    return { status: 'ok', articles: cached.data, fromCache: true, cachedAt: cached.cachedAt };
  }
  const r = await buscarJson<unknown>(FEED_URL);
  if (r.ok) {
    const articles = normalizarFeed(r.data);
    // Resposta vazia/fora do contrato não apaga um cache bom.
    if (articles.length === 0 && cached && cached.data.length > 0) {
      return { status: 'offline_cached', articles: cached.data, cachedAt: cached.cachedAt };
    }
    await writeCache(CACHE_KEY_FEED, articles);
    return { status: 'ok', articles, fromCache: false };
  }
  if (cached) return { status: 'offline_cached', articles: cached.data, cachedAt: cached.cachedAt };
  return r.motivo === 'offline' || r.motivo === 'timeout'
    ? { status: 'offline_empty' }
    : { status: 'error', message: 'As notícias não puderam ser carregadas agora.' };
}

/** Guarda a matéria aberta para ler de novo sem internet (últimas ABERTAS_MAX). */
export async function guardarNoticiaAberta(a: Article): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY_ABERTAS);
    const lista: Article[] = raw ? JSON.parse(raw) : [];
    const nova = [a, ...lista.filter(x => x && x.id !== a.id)].slice(0, ABERTAS_MAX);
    await AsyncStorage.setItem(CACHE_KEY_ABERTAS, JSON.stringify(nova));
  } catch {}
}

/** Procura a matéria no feed em cache e nas já abertas — funciona offline. */
export async function noticiaLocal(id: string): Promise<Article | null> {
  try {
    const feed = await readCache<Article[]>(CACHE_KEY_FEED);
    const noFeed = feed?.data.find(a => a.id === id);
    if (noFeed) return noFeed;
    const raw = await AsyncStorage.getItem(CACHE_KEY_ABERTAS);
    const lista: unknown[] = raw ? JSON.parse(raw) : [];
    for (const item of lista) {
      const a = normalizarArtigo(item);
      if (a && a.id === id) return a;
    }
  } catch {}
  return null;
}

export type VagasResult =
  | { status: 'ok'; vagas: Vaga[]; fromCache: boolean; cachedAt?: number; updatedAt?: string | null }
  | { status: 'offline_cached'; vagas: Vaga[]; cachedAt: number; updatedAt?: string | null }
  | { status: 'offline_empty' }
  | { status: 'error'; message: string };

export async function fetchVagas(forcar = false): Promise<VagasResult> {
  const cached = await readCache<Vaga[]>(CACHE_KEY_VAGAS);
  const meta = await readCache<string | null>(CACHE_KEY_VAGAS_META);
  const updatedCache = meta?.data ?? null;
  if (!forcar && cached && !isStale(cached.cachedAt, VAGAS_TTL_MS)) {
    return { status: 'ok', vagas: cached.data, fromCache: true, cachedAt: cached.cachedAt, updatedAt: updatedCache };
  }
  const r = await buscarJson<{ vagas?: unknown; updated_at?: unknown }>(VAGAS_URL);
  if (r.ok && Array.isArray(r.data?.vagas)) {
    const vagas = (r.data.vagas as Vaga[]).filter(v => v && str(v.id) && str(v.titulo) && str(v.empresa));
    const updatedAt = str(r.data.updated_at);
    await writeCache(CACHE_KEY_VAGAS, vagas);
    await writeCache(CACHE_KEY_VAGAS_META, updatedAt);
    return { status: 'ok', vagas, fromCache: false, updatedAt };
  }
  if (cached) return { status: 'offline_cached', vagas: cached.data, cachedAt: cached.cachedAt, updatedAt: updatedCache };
  return { status: 'offline_empty' };
}

export type UnidadesResult =
  | { status: 'ok'; unidades: Unidade[]; fromCache: boolean; cachedAt?: number }
  | { status: 'offline_cached'; unidades: Unidade[]; cachedAt: number }
  | { status: 'offline_empty' }
  | { status: 'error'; message: string };

export async function fetchUnidades(forcar = false): Promise<UnidadesResult> {
  const cached = await readCache<Unidade[]>(CACHE_KEY_UNIDADES);
  if (!forcar && cached && !isStale(cached.cachedAt, UNIDADES_TTL_MS)) {
    return { status: 'ok', unidades: cached.data, fromCache: true, cachedAt: cached.cachedAt };
  }
  const r = await buscarJson<{ unidades?: unknown }>(UNIDADES_URL);
  if (r.ok && Array.isArray(r.data?.unidades)) {
    const unidades = (r.data.unidades as Unidade[]).filter(u => u && str(u.slug) && str(u.nome));
    await writeCache(CACHE_KEY_UNIDADES, unidades);
    return { status: 'ok', unidades, fromCache: false };
  }
  if (cached) return { status: 'offline_cached', unidades: cached.data, cachedAt: cached.cachedAt };
  return { status: 'offline_empty' };
}

/**
 * Pacote do Radar Offshore. Sem internet: o último pacote guardado (o autocomplete continua);
 * sem nada guardado: null — e o campo de unidade segue funcionando como texto livre.
 */
export async function fetchPacoteRadar(forcar = false): Promise<{ pacote: PacoteRadar; cachedAt: number; fromCache: boolean } | null> {
  const cached = await readCache<PacoteRadar>(CACHE_KEY_RADAR);
  if (!forcar && cached && !isStale(cached.cachedAt, RADAR_TTL_MS)) return { pacote: cached.data, cachedAt: cached.cachedAt, fromCache: true };
  const r = await buscarJson<unknown>(RADAR_PACOTE_URL);
  const pacote = r.ok ? lerPacoteRadar(r.data) : null;
  if (pacote && pacote.unidades.length) {
    await writeCache(CACHE_KEY_RADAR, pacote);
    return { pacote, cachedAt: Date.now(), fromCache: false };
  }
  return cached ? { pacote: cached.data, cachedAt: cached.cachedAt, fromCache: true } : null;
}
