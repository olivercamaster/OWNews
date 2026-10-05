/**
 * Codec de persistência da Minha Escala.
 *
 * Existem três formatos no mundo real e todos precisam continuar lendo:
 *
 *  (web)  OWNews localStorage `ownews_minha_escala` — objeto plano:
 *         { tipo:'14x14'|'14x21'|'14x28'|'personalizada', diasEmbarcado, diasFolga,
 *           data:'YYYY-MM-DD', tipoRef, aeroporto, excecoes }
 *  (v1)   OWBuddy até Missão 007 — { data: { tipo, dataRef, ... , updated_at } }
 *  (v2)   OWBuddy a partir deste checkpoint — { v:2, data:{...}, updated_at }
 *
 * `normalizeEscalaConfig` aceita qualquer um deles (e também um EscalaConfig cru)
 * e devolve sempre um EscalaConfig válido ou null. `toWebEscalaConfig` faz o
 * caminho inverso para quando o app precisar falar com o web/Supabase.
 */
import type { EscalaConfig, EscalaSecundaria, EscalaTipo, Excecao, TipoRef } from './types';
import { TIPOS_PRESET, msParaISO } from './escala';

export const ESCALA_SCHEMA_VERSION = 2;

export interface EscalaEnvelope {
  v: number;
  data: EscalaConfig;
  updated_at: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function asInt(x: unknown): number | undefined {
  const n = typeof x === 'number' ? x : parseInt(String(x ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function normalizarTipo(raw: unknown): EscalaTipo | null {
  const t = String(raw ?? '');
  if (t === 'personalizada' || t === 'custom') return 'custom';
  if (t in TIPOS_PRESET) return t as EscalaTipo;
  return null;
}

function normalizarTipoRef(raw: unknown): TipoRef {
  return raw === 'desembarquei' ? 'desembarquei' : 'embarquei';
}

function normalizarDataRef(raw: unknown): string | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return msParaISO(raw);
  if (typeof raw !== 'string') return null;
  if (ISO_DATE.test(raw)) return raw;
  // Aceita ISO datetime ("2026-10-01T00:00:00.000Z") — recorta a data
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function normalizarExcecoes(raw: unknown): Excecao[] {
  if (!Array.isArray(raw)) return [];
  const out: Excecao[] = [];
  for (const e of raw) {
    if (!isObj(e)) continue;
    const tipo = e.tipo === 'ferias' ? 'ferias' : e.tipo === 'dobra' ? 'dobra' : null;
    const ini = normalizarDataRef(e.ini);
    const fim = normalizarDataRef(e.fim) ?? ini;
    if (!tipo || !ini || !fim) continue;
    out.push({ id: String(e.id ?? `exc_${ini}_${fim}`), tipo, ini, fim });
  }
  return out;
}

/** Normaliza um objeto de configuração "plano" (web ou app) para EscalaConfig. */
function normalizarPlano(raw: Record<string, unknown>): EscalaConfig | null {
  const tipo = normalizarTipo(raw.tipo);
  if (!tipo) return null;
  // app: dataRef | web: data (string) | cruzar web: refUTC (ms)
  const dataRef = normalizarDataRef(raw.dataRef ?? raw.data ?? raw.refUTC);
  if (!dataRef) return null;

  const cfg: EscalaConfig = {
    tipo,
    dataRef,
    tipoRef: normalizarTipoRef(raw.tipoRef),
  };
  const dEm = asInt(raw.diasEmbarcado ?? raw.diasEmb);
  const dFo = asInt(raw.diasFolga);
  if (dEm !== undefined) cfg.diasEmbarcado = dEm;
  if (dFo !== undefined) cfg.diasFolga = dFo;
  if (tipo === 'custom' && (!cfg.diasEmbarcado || !cfg.diasFolga)) return null;
  if (typeof raw.aeroporto === 'string' && raw.aeroporto) cfg.aeroporto = raw.aeroporto;
  const excecoes = normalizarExcecoes(raw.excecoes);
  if (excecoes.length) cfg.excecoes = excecoes;
  if (typeof raw.updated_at === 'string') cfg.updated_at = raw.updated_at;
  return cfg;
}

/**
 * Lê qualquer formato conhecido. Nunca lança.
 * Retorna null quando não há escala utilizável — nesse caso o chamador NÃO deve
 * apagar o valor salvo (pode ser um formato futuro); apenas trata como "sem escala".
 */
export function normalizeEscalaConfig(raw: unknown): EscalaConfig | null {
  try {
    if (!isObj(raw)) return null;
    // v1 / v2: envelope com `data` sendo objeto
    if (isObj(raw.data)) {
      const inner = normalizarPlano(raw.data);
      if (inner && typeof raw.updated_at === 'string' && !inner.updated_at) inner.updated_at = raw.updated_at;
      return inner;
    }
    // web (data: string) ou app cru (dataRef)
    return normalizarPlano(raw);
  } catch {
    return null;
  }
}

export function toEscalaEnvelope(cfg: EscalaConfig, updatedAt: string = new Date().toISOString()): EscalaEnvelope {
  return { v: ESCALA_SCHEMA_VERSION, data: { ...cfg, updated_at: updatedAt }, updated_at: updatedAt };
}

/** Formato plano que o OWNews web lê (localStorage e user_metadata.escala_config). */
export function toWebEscalaConfig(cfg: EscalaConfig): Record<string, unknown> {
  const preset = TIPOS_PRESET[cfg.tipo];
  const webTipo = cfg.tipo === '14x14' || cfg.tipo === '14x21' || cfg.tipo === '14x28' ? cfg.tipo : 'personalizada';
  return {
    tipo: webTipo,
    diasEmbarcado: preset ? preset[0] : cfg.diasEmbarcado,
    diasFolga: preset ? preset[1] : cfg.diasFolga,
    data: cfg.dataRef,
    tipoRef: cfg.tipoRef,
    aeroporto: cfg.aeroporto ?? '',
    excecoes: cfg.excecoes ?? [],
  };
}

// ─── Cruzar escalas (ownews_cruzar_v2) ──────────────────────────────────────
//
// web: { id, nome, relacao, icon, diasEmb, diasFolga, refUTC(ms), tipoRef }
// app: EscalaSecundaria { id, nome, relacao?, tipo, diasEmbarcado?, diasFolga?, dataRef, tipoRef }

export function normalizeEscalaSecundaria(raw: unknown): EscalaSecundaria | null {
  try {
    if (!isObj(raw)) return null;
    const nome = typeof raw.nome === 'string' ? raw.nome.trim() : '';
    if (!nome) return null;

    let tipo = normalizarTipo(raw.tipo);
    const dEm = asInt(raw.diasEmbarcado ?? raw.diasEmb);
    const dFo = asInt(raw.diasFolga);
    if (!tipo) {
      // web não guarda `tipo`: deriva do par de dias
      if (dEm === 14 && dFo === 14) tipo = '14x14';
      else if (dEm === 14 && dFo === 21) tipo = '14x21';
      else if (dEm === 14 && dFo === 28) tipo = '14x28';
      else if (dEm && dFo) tipo = 'custom';
      else return null;
    }
    const dataRef = normalizarDataRef(raw.dataRef ?? raw.refUTC ?? raw.data);
    if (!dataRef) return null;
    if (tipo === 'custom' && (!dEm || !dFo)) return null;

    const sec: EscalaSecundaria = {
      id: String(raw.id ?? `sec_${dataRef}_${nome}`),
      nome,
      tipo,
      dataRef,
      tipoRef: normalizarTipoRef(raw.tipoRef),
    };
    if (typeof raw.relacao === 'string' && raw.relacao) sec.relacao = raw.relacao;
    if (tipo === 'custom') { sec.diasEmbarcado = dEm; sec.diasFolga = dFo; }
    return sec;
  } catch {
    return null;
  }
}

export function normalizeEscalasSecundarias(raw: unknown): EscalaSecundaria[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeEscalaSecundaria).filter((s): s is EscalaSecundaria => s !== null);
}
