/**
 * Regras de frescor da Home (puras, sem RN — testadas em tests/frescor.test.mjs).
 * A Home só mostra número/manchete quando o dado é REAL e recente; senão, copy neutra.
 */

const HORA = 3600_000;

/** Lista obtida há no máximo 24 h (rede agora ou cache do aparelho). */
export const VAGAS_CACHE_MAX_MS = 24 * HORA;
/** OWNews verificou alguma vaga nos portais oficiais há no máximo 72 h (`updated_at`). */
export const VAGAS_VERIFICACAO_MAX_MS = 72 * HORA;
/** Manchete na Home: notícia publicada há no máximo 48 h (mesma janela da Home OWNews). */
export const NOTICIA_MAX_MS = 48 * HORA;

const ms = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : NaN;
};

/**
 * Quantas vagas a Home pode anunciar — ou null (mostra só "Vagas").
 * `obtidoEm` = quando o app recebeu a lista (agora, se veio da rede).
 */
export function contadorVagasHome(
  total: number,
  obtidoEm: number | null | undefined,
  updatedAtISO: string | null | undefined,
  agora: number = Date.now(),
): number | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  if (obtidoEm == null || !Number.isFinite(obtidoEm) || agora - obtidoEm > VAGAS_CACHE_MAX_MS) return null;
  const verificado = ms(updatedAtISO);
  if (!Number.isFinite(verificado) || agora - verificado > VAGAS_VERIFICACAO_MAX_MS) return null;
  return total;
}

export type NoticiaHome = { id: string; title: string; published_at?: string | null };

/** Notícia mais recente publicada nas últimas 48 h, ou null (copy neutra). Data futura absurda é ignorada. */
export function noticiaRecenteHome<T extends NoticiaHome>(artigos: readonly T[], agora: number = Date.now()): T | null {
  let melhor: T | null = null;
  let melhorMs = -Infinity;
  for (const a of artigos) {
    if (!a || !a.id || !a.title?.trim()) continue;
    const t = ms(a.published_at);
    if (!Number.isFinite(t) || agora - t > NOTICIA_MAX_MS || t - agora > HORA) continue;
    if (t > melhorMs) { melhor = a; melhorMs = t; }
  }
  return melhor;
}
