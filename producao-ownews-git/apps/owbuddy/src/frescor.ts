/**
 * Regras de frescor da Home (puras, sem RN — testadas em tests/frescor.test.mjs).
 * A Home só mostra número/manchete quando o dado é REAL e recente; senão, copy neutra.
 */

const HORA = 3600_000;

/** Lista obtida há no máximo 24 h (rede agora ou cache do aparelho). */
export const VAGAS_CACHE_MAX_MS = 24 * HORA;
/** OWNews verificou alguma vaga nos portais oficiais há no máximo 72 h (`updated_at`). */
export const VAGAS_VERIFICACAO_MAX_MS = 72 * HORA;
/** Destaques da Home: nada com mais de 48 h (mesma janela das Últimas do OWNews). */
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

/** Idade curta da notícia ("agora", "15min", "2h", "1d") — regra ÚNICA de tempo das notícias no Buddy. */
export function idadeCurta(iso: string | null | undefined, agora: number = Date.now()): string {
  const t = ms(iso);
  if (!Number.isFinite(t)) return '';
  const min = Math.floor((agora - t) / 60_000);
  if (min < 1) return 'agora';           // inclui relógio da fonte levemente adiantado
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/*
 * Destaques da Home (Offshore Agora → Notícias): até 3 matérias que importam AGORA.
 * Mesma regra da Home do OWNews (worker.js, selecionarHomeServidor / Topo Fresco) — não é um
 * segundo sistema de importância: relevância = editorial_score do pipeline (0–100) + bônus de
 * urgência no título; pontuação = relevância × fator de frescor (1 até 6 h → 0,45 em 24 h).
 * Mudou lá → muda aqui (constantes com o mesmo nome) e em tests/frescor.test.mjs.
 */
export const HOME_SCORE_FORTE = 50;
export const HOME_BONUS_URGENCIA = 10;
export const HOME_TOPO_MAX_H = 24;
export const DESTAQUES_MAX = 3;
const TOLERANCIA_FUTURO_H = 0.25;
const PALAVRAS_URGENCIA = ['acidente', 'explosão', 'explosao', 'vazamento', 'greve', 'parada de produção', 'parada de producao', 'interdição', 'interdicao', 'morte', 'fatal', 'resgate', 'incêndio', 'incendio'];

export type NoticiaDestaque = NoticiaHome & { editorial_score?: number | null };

export function fatorFrescor(h: number): number {
  if (!Number.isFinite(h) || h < -TOLERANCIA_FUTURO_H || h > HOME_TOPO_MAX_H) return 0;
  if (h <= 6) return 1;
  if (h <= 12) return 1 - 0.15 * (h - 6) / 6;
  if (h <= 18) return 0.85 - 0.2 * (h - 12) / 6;
  return 0.65 - 0.2 * (h - 18) / 6;
}

/** Sem editorial_score (cache de versão anterior do app): neutro, no limiar de "forte". */
export function relevancia(n: NoticiaDestaque): number {
  const s = typeof n.editorial_score === 'number' && Number.isFinite(n.editorial_score) ? n.editorial_score : HOME_SCORE_FORTE;
  const base = Math.max(0, Math.min(100, s));
  const titulo = String(n.title || '').toLowerCase();
  return base + (PALAVRAS_URGENCIA.some(p => titulo.includes(p)) ? HOME_BONUS_URGENCIA : 0);
}

// Tokenização e limiar idênticos a q21Tokens/similaridadeTextos/mesmaPautaHome do worker OWNews.
const STOP = new Set(('a o e de da do das dos em no na nos nas um uma uns umas para por com sem que se ao aos as os mais menos como ja foi sao ser esta este essa esse isso isto pela pelo pelas pelos entre sobre apos ate tambem ainda seu sua seus suas nao sim muito mas ou quando onde qual quais the and for with from that this was were has have its are will into than over after said').split(' '));
function tokens(t: string): string[] {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
}
function contencao(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  return a.filter(w => sb.has(w)).length / a.length;
}
/** Mesma pauta: ≥ 60% das palavras úteis de CADA título estão no outro (mesma regra da Home OWNews). */
export function mesmaPauta(a: string, b: string): boolean {
  const ta = tokens(a), tb = tokens(b);
  return Math.min(contencao(ta, tb), contencao(tb, ta)) >= 0.6;
}

/**
 * 1 a 3 destaques, ordenados por relevância × frescor. Só matéria das últimas 24 h com relevância
 * forte (≥ 50); sem nenhuma em 24 h, até 2 das últimas 48 h (a Home não fica vazia num dia parado,
 * mas também não é tomada por notícia velha). Pauta repetida não ocupa outra vaga; falta de foto
 * não importa (a Home não tem imagem). Lista vazia → a Home mostra a copy neutra.
 */
export function destaquesHome<T extends NoticiaDestaque>(artigos: readonly T[], agora: number = Date.now()): T[] {
  const vistos = new Set<string>();
  const validos: { a: T; h: number; pts: number }[] = [];
  for (const a of artigos) {
    if (!a || !a.id || !a.title?.trim() || vistos.has(a.id)) continue;
    vistos.add(a.id);
    const t = ms(a.published_at);
    if (!Number.isFinite(t)) continue;
    const h = (agora - t) / HORA;
    if (h < -TOLERANCIA_FUTURO_H || h > NOTICIA_MAX_MS / HORA) continue;
    if (relevancia(a) < HOME_SCORE_FORTE) continue;
    validos.push({ a, h, pts: relevancia(a) * fatorFrescor(h) });
  }
  const escolher = (pool: typeof validos, max: number, ordem: (x: (typeof validos)[0], y: (typeof validos)[0]) => number) => {
    const out: T[] = [];
    for (const c of [...pool].sort(ordem)) {
      if (out.length >= max) break;
      if (out.some(x => mesmaPauta(x.title, c.a.title))) continue;
      out.push(c.a);
    }
    return out;
  };
  const topo = validos.filter(c => c.h <= HOME_TOPO_MAX_H);
  if (topo.length) return escolher(topo, DESTAQUES_MAX, (x, y) => y.pts - x.pts || x.h - y.h);
  // Dia parado: as mais recentes de 24–48 h (score não decide fora da janela do topo).
  return escolher(validos, 2, (x, y) => x.h - y.h);
}

/** Clima da cidade (pessoal/urbano — NUNCA meteorologia offshore/operacional). */
export const CLIMA_ATUAL_MAX_MS = 1 * HORA;
export const CLIMA_ARMAZENADO_MAX_MS = 6 * HORA;

/**
 * 'atual'      — até 1 h: mostra temperatura e condição normalmente;
 * 'armazenado' — até 6 h (ex.: offline): mostra com "às HH:MM";
 * 'antigo'     — mais que isso: NÃO mostra condição como atual (só a cidade).
 */
export function frescorClima(cachedAt: number | null | undefined, agora: number = Date.now()): 'atual' | 'armazenado' | 'antigo' {
  if (cachedAt == null || !Number.isFinite(cachedAt)) return 'antigo';
  const idade = agora - cachedAt;
  if (idade <= CLIMA_ATUAL_MAX_MS) return 'atual';
  if (idade <= CLIMA_ARMAZENADO_MAX_MS) return 'armazenado';
  return 'antigo';
}
