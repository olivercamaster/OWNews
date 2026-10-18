/**
 * Contratos OWNews → OWBuddy (puro, sem React Native — testado em tests/contratos.test.mjs).
 * Documentação: docs/OWBUDDY-CONTRATOS.md. Mudou a API? Mude aqui, no doc e no teste.
 */
import { urlExternaSegura } from './net';

export const OWNEWS_BASE_URL = 'https://ownews.com.br';

export type ExplicaItem = {
  slug: string;
  titulo: string;
  url: string;
};

/**
 * Matéria canônica do OWNews. O app só EXIBE: não resume, não reescreve, não
 * gera Impacto. Os quatro blocos vêm prontos e já aprovados pelo gate da web.
 */
export type Article = {
  id: string;
  title: string;
  image_url: string | null;
  /** Nome da fonte (ex.: "PetroNotícias"). */
  image_credit: string | null;
  original_url: string;
  published_at: string;
  /** URL canônica no OWNews — é o que se compartilha. */
  url: string;
  /** BUDDY RESUME */
  buddy_summary: string;
  /** CORPO EDITORIAL OWNEWS (parágrafos separados por linha em branco). */
  corpo: string;
  /** O QUE ISSO IMPACTA PARA O OFFSHORE */
  why_it_matters: string;
  explica: ExplicaItem[];
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Contrato do feed: aceita a matéria só com os quatro blocos canônicos.
 * Qualquer item fora do padrão (API antiga, campo faltando) é descartado —
 * o app nunca completa nem inventa texto.
 */
export function normalizarArtigo(raw: unknown): Article | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const id = str(a.id);
  const title = str(a.title);
  const buddy = str(a.buddy_summary);
  const corpo = str(a.corpo);
  const impacto = str(a.why_it_matters);
  const url = urlExternaSegura(a.url);
  if (!id || !title || !buddy || !corpo || !impacto || !url || !url.startsWith(OWNEWS_BASE_URL + '/')) return null;
  const explica = Array.isArray(a.explica)
    ? (a.explica as unknown[]).map(e => {
        const x = (e ?? {}) as Record<string, unknown>;
        const u = urlExternaSegura(x.url);
        return str(x.slug) && str(x.titulo) && u ? { slug: str(x.slug)!, titulo: str(x.titulo)!, url: u } : null;
      }).filter((e): e is ExplicaItem => e !== null)
    : [];
  return {
    id,
    title,
    image_url: urlExternaSegura(a.image_url),
    image_credit: str(a.image_credit),
    original_url: urlExternaSegura(a.original_url) ?? '',
    published_at: str(a.published_at) ?? '',
    url,
    buddy_summary: buddy,
    corpo,
    why_it_matters: impacto,
    explica,
  };
}

export function normalizarFeed(json: unknown): Article[] {
  const lista = (json as { articles?: unknown })?.articles;
  return Array.isArray(lista) ? lista.map(normalizarArtigo).filter((a): a is Article => a !== null) : [];
}

/** Parágrafos do corpo OWNews (mesma separação da web: linha em branco). */
export function paragrafos(corpo: string): string[] {
  return corpo.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

