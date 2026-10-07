import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://ownews.com.br';
const FEED_URL = `${BASE_URL}/api/buddy/feed`;
const VAGAS_URL = `${BASE_URL}/api/buddy/vagas`;
const UNIDADES_URL = `${BASE_URL}/api/buddy/unidades`;

const CACHE_KEY_FEED = 'owbuddy_cache_feed_v2';
const CACHE_KEY_VAGAS = 'owbuddy_cache_vagas';
const CACHE_KEY_UNIDADES = 'owbuddy_cache_unidades_v1';
const FEED_TTL_MS = 5 * 60 * 1000;       // 5 min
const VAGAS_TTL_MS = 60 * 60 * 1000;     // 1 h
const UNIDADES_TTL_MS = 60 * 60 * 1000;  // 1 h

export type ExplicaItem = {
  slug: string;
  titulo: string;
  url: string;
};

export type Article = {
  id: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  image_credit: string | null;
  original_url: string;
  published_at: string;
  editorial_score: number;
  url: string;
  buddy_summary: string | null;
  why_it_matters: string | null;
  buddy_reviewed_at: string | null;
  buddy_source: string | null;
  explica: ExplicaItem[] | null;
  thin: boolean | null;
};

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
  image_status: 'real' | 'ilustrativa' | 'ausente';
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
    return JSON.parse(raw) as CacheEntry<T>;
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

export type FeedResult =
  | { status: 'ok'; articles: Article[]; fromCache: boolean; cachedAt?: number }
  | { status: 'offline_cached'; articles: Article[]; cachedAt: number }
  | { status: 'offline_empty' }
  | { status: 'error'; message: string };

export async function fetchFeed(): Promise<FeedResult> {
  const cached = await readCache<Article[]>(CACHE_KEY_FEED);
  if (cached && !isStale(cached.cachedAt, FEED_TTL_MS)) {
    return { status: 'ok', articles: cached.data, fromCache: true, cachedAt: cached.cachedAt };
  }
  try {
    const resp = await fetch(FEED_URL, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json() as { articles: Article[] };
    const articles = json.articles ?? [];
    await writeCache(CACHE_KEY_FEED, articles);
    return { status: 'ok', articles, fromCache: false };
  } catch {
    if (cached) return { status: 'offline_cached', articles: cached.data, cachedAt: cached.cachedAt };
    return { status: 'offline_empty' };
  }
}

export type VagasResult =
  | { status: 'ok'; vagas: Vaga[]; fromCache: boolean; cachedAt?: number }
  | { status: 'offline_cached'; vagas: Vaga[]; cachedAt: number }
  | { status: 'offline_empty' }
  | { status: 'error'; message: string };

export async function fetchVagas(): Promise<VagasResult> {
  const cached = await readCache<Vaga[]>(CACHE_KEY_VAGAS);
  if (cached && !isStale(cached.cachedAt, VAGAS_TTL_MS)) {
    return { status: 'ok', vagas: cached.data, fromCache: true, cachedAt: cached.cachedAt };
  }
  try {
    const resp = await fetch(VAGAS_URL, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json() as { vagas: Vaga[] };
    const vagas = json.vagas ?? [];
    await writeCache(CACHE_KEY_VAGAS, vagas);
    return { status: 'ok', vagas, fromCache: false };
  } catch {
    if (cached) return { status: 'offline_cached', vagas: cached.data, cachedAt: cached.cachedAt };
    return { status: 'offline_empty' };
  }
}

export type UnidadesResult =
  | { status: 'ok'; unidades: Unidade[]; fromCache: boolean; cachedAt?: number }
  | { status: 'offline_cached'; unidades: Unidade[]; cachedAt: number }
  | { status: 'offline_empty' }
  | { status: 'error'; message: string };

export async function fetchUnidades(): Promise<UnidadesResult> {
  const cached = await readCache<Unidade[]>(CACHE_KEY_UNIDADES);
  if (cached && !isStale(cached.cachedAt, UNIDADES_TTL_MS)) {
    return { status: 'ok', unidades: cached.data, fromCache: true, cachedAt: cached.cachedAt };
  }
  try {
    const resp = await fetch(UNIDADES_URL, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json() as { unidades: Unidade[] };
    const unidades = json.unidades ?? [];
    await writeCache(CACHE_KEY_UNIDADES, unidades);
    return { status: 'ok', unidades, fromCache: false };
  } catch {
    if (cached) return { status: 'offline_cached', unidades: cached.data, cachedAt: cached.cachedAt };
    return { status: 'offline_empty' };
  }
}
