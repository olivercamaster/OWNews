/**
 * Meu Histórico — registro do que REALMENTE aconteceu na vida offshore.
 *
 *   ESCALA    = planejado (calcEscalaISO, nunca alterado daqui).
 *   HISTÓRICO = realizado (só entra o que a pessoa confirmou ou registrou).
 *
 * Regras puras (sem storage, sem rede, sem relógio implícito: `hoje` sempre injetado).
 * Nada aqui grava na escala nem deriva ciclos passados dela: a escala só SUGERE o ciclo
 * atual, e a sugestão só vira registro quando a pessoa confirma.
 *
 * Convenção de duração (a mesma da escala): Dia 1 = dia do embarque; o desembarque é o
 * primeiro dia fora. 16/10 → 30/10 = 14 dias embarcado (diferença de datas, não inclusiva).
 */
import type { EscalaConfig, Viagem, ViagemTipo } from './types';
import { diasEntreISO, isoValido, resumoEscala, somarDiasISO } from './escala';

export const HISTORICO_VERSAO = 1;

export type TipoAcontecimentoHist =
  | 'HOTEL' | 'VOO' | 'ONIBUS' | 'VAN' | 'CARRO' | 'TRANSFER' | 'HELICOPTERO' | 'BASE'
  | 'EMBARQUE' | 'DESEMBARQUE' | 'CASA' | 'TREINAMENTO' | 'DOBRA' | 'TRANSFERIDO' | 'ATRASO' | 'OUTRO';

/** Ordem dos chips no cadastro (a do pedido do produto). */
export const TIPOS_ACONTECIMENTO_HIST: TipoAcontecimentoHist[] = [
  'HOTEL', 'VOO', 'ONIBUS', 'VAN', 'CARRO', 'TRANSFER', 'HELICOPTERO', 'BASE',
  'EMBARQUE', 'DESEMBARQUE', 'CASA', 'TREINAMENTO', 'DOBRA', 'TRANSFERIDO', 'ATRASO', 'OUTRO',
];

/** "Transferido" fica exatamente assim: não é sinônimo de cancelado nem de desviado. */
export const LABEL_ACONTECIMENTO_HIST: Record<TipoAcontecimentoHist, string> = {
  HOTEL: 'Hotel', VOO: 'Voo', ONIBUS: 'Ônibus', VAN: 'Van', CARRO: 'Carro', TRANSFER: 'Transfer',
  HELICOPTERO: 'Helicóptero', BASE: 'Base', EMBARQUE: 'Embarque', DESEMBARQUE: 'Desembarque',
  CASA: 'Casa', TREINAMENTO: 'Treinamento', DOBRA: 'Dobra', TRANSFERIDO: 'Transferido',
  ATRASO: 'Atraso', OUTRO: 'Outro',
};

/** Tipos que guardam origem/destino (trecho). Número só no voo. */
export const TIPOS_COM_TRECHO: ReadonlyArray<TipoAcontecimentoHist> = ['VOO', 'HELICOPTERO', 'ONIBUS', 'VAN', 'CARRO', 'TRANSFER'];
/** Tipos que guardam um nome/local (hotel, base, treinamento). */
export const TIPOS_COM_LOCAL: ReadonlyArray<TipoAcontecimentoHist> = ['HOTEL', 'BASE', 'TREINAMENTO'];

export interface RegistroEmbarque {
  /** Estável (nunca índice de array). */
  id: string;
  /** Data REAL do embarque (YYYY-MM-DD, dia civil local). */
  embarque: string;
  /** Data REAL do desembarque; null = em andamento. */
  desembarque: string | null;
  unidade?: string;
  /** Unidade do catálogo do Radar Offshore escolhida pela pessoa (contexto; o nome acima continua mandando). */
  unidade_ref?: { id: string; slug: string };
  empresa?: string;
  funcao?: string;
  obs?: string;
  /** Salvo com data de embarque que ainda não chegou: não é realizado até a pessoa confirmar. */
  planejado?: boolean;
  /** Foto do PLANEJADO no momento do registro (só para comparar; nunca é a data real). */
  previsto?: { embarque?: string; desembarque?: string };
  /** De onde nasceu: cadastro manual ou revisão do ciclo sugerido pela escala. */
  fonte: 'manual' | 'escala';
  criado_em: string;
  updated_at: string;
}

export interface AcontecimentoHist {
  id: string;
  registroId: string;
  tipo: TipoAcontecimentoHist;
  data: string;
  hora?: string;
  titulo?: string;
  local?: string;
  origem?: string;
  destino?: string;
  numero?: string;
  obs?: string;
  /** Salvo com data futura: aparece como "Planejado" até a pessoa marcar como realizado. */
  planejado?: boolean;
  /** Acontecimento mantido pelo próprio registro (datas principais / dobra confirmada). */
  auto?: 'embarque' | 'desembarque' | 'dobra';
  /** Chave de deduplicação de importação (ex.: Minha Viagem). */
  importadoDe?: string;
  /** Ordem de criação — desempate estável da linha do tempo. */
  seq: number;
  criado_em: string;
  updated_at: string;
}

export interface HistoricoData {
  v: typeof HISTORICO_VERSAO;
  registros: RegistroEmbarque[];
  acontecimentos: AcontecimentoHist[];
  /** Próximo número de ordem de criação. */
  seq: number;
}

export function historicoVazio(): HistoricoData {
  return { v: HISTORICO_VERSAO, registros: [], acontecimentos: [], seq: 1 };
}

// ─── Leitura tolerante ──────────────────────────────────────────────────────

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function semVazios<T extends object>(o: T): T {
  const r = { ...o } as Record<string, unknown>;
  for (const k of Object.keys(r)) if (r[k] === undefined) delete r[k];
  return r as T;
}

function txt(v: unknown, max = 120): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, max);
  return t ? t : undefined;
}

export interface LeituraHistorico {
  data: HistoricoData;
  /** Itens ilegíveis ignorados — o storage guarda uma cópia do bruto antes de regravar. */
  descartados: number;
  /** Versão mais nova que este app conhece: não regravar por cima. */
  versaoDesconhecida: boolean;
}

/** Nunca lança. Valor ilegível vira histórico vazio, com contagem para backup. */
/** Referência ao Radar só com forma válida; qualquer outra coisa é ignorada (o registro fica). */
function refUnidade(r: unknown): { id: string; slug: string } | undefined {
  if (!r || typeof r !== 'object') return undefined;
  const o = r as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.slice(0, 80) : '', slug = typeof o.slug === 'string' ? o.slug.slice(0, 100) : '';
  return /^[a-z]+-[A-Za-z0-9-]+$/.test(id) && /^[a-z0-9-]+$/.test(slug) ? { id, slug } : undefined;
}

export function lerHistorico(raw: unknown): LeituraHistorico {
  const vazio = { data: historicoVazio(), descartados: 0, versaoDesconhecida: false };
  if (raw == null) return vazio;
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ...vazio, descartados: 1 };
  const o = raw as Record<string, unknown>;
  const versaoDesconhecida = typeof o.v === 'number' && o.v > HISTORICO_VERSAO;
  let descartados = 0;

  const registros: RegistroEmbarque[] = [];
  const ids = new Set<string>();
  for (const r of Array.isArray(o.registros) ? o.registros : []) {
    const x = r as Record<string, unknown>;
    const id = txt(x?.id, 64);
    const des = x?.desembarque == null ? null : x.desembarque;
    if (!id || ids.has(id) || !isoValido(x.embarque) || (des !== null && !isoValido(des))) { descartados++; continue; }
    ids.add(id);
    const prev = x.previsto as Record<string, unknown> | undefined;
    registros.push(semVazios({
      id,
      embarque: x.embarque as string,
      desembarque: des as string | null,
      unidade: txt(x.unidade, 80), empresa: txt(x.empresa, 80), funcao: txt(x.funcao, 80), obs: txt(x.obs, 300),
      unidade_ref: refUnidade(x.unidade_ref),
      planejado: x.planejado === true ? true : undefined,
      previsto: prev && typeof prev === 'object' && (isoValido(prev.embarque) || isoValido(prev.desembarque)) ? semVazios({
        embarque: isoValido(prev.embarque) ? prev.embarque as string : undefined,
        desembarque: isoValido(prev.desembarque) ? prev.desembarque as string : undefined,
      }) : undefined,
      fonte: x.fonte === 'escala' ? 'escala' : 'manual',
      criado_em: txt(x.criado_em, 40) ?? '',
      updated_at: txt(x.updated_at, 40) ?? '',
    }));
  }

  const acontecimentos: AcontecimentoHist[] = [];
  const idsAc = new Set<string>();
  let maxSeq = 0;
  for (const a of Array.isArray(o.acontecimentos) ? o.acontecimentos : []) {
    const x = a as Record<string, unknown>;
    const id = txt(x?.id, 64);
    const tipo = x?.tipo as TipoAcontecimentoHist;
    if (!id || idsAc.has(id) || !ids.has(x.registroId as string) || !TIPOS_ACONTECIMENTO_HIST.includes(tipo) || !isoValido(x.data)) {
      descartados++; continue;
    }
    idsAc.add(id);
    const seq = typeof x.seq === 'number' && Number.isFinite(x.seq) ? x.seq : 0;
    maxSeq = Math.max(maxSeq, seq);
    acontecimentos.push(semVazios({
      id, registroId: x.registroId as string, tipo, data: x.data as string,
      hora: typeof x.hora === 'string' && HORA_RE.test(x.hora) ? x.hora : undefined,
      titulo: txt(x.titulo, 80), local: txt(x.local, 80), origem: txt(x.origem, 60), destino: txt(x.destino, 60),
      numero: txt(x.numero, 20), obs: txt(x.obs, 300),
      planejado: x.planejado === true ? true : undefined,
      auto: x.auto === 'embarque' || x.auto === 'desembarque' || x.auto === 'dobra' ? x.auto : undefined,
      importadoDe: txt(x.importadoDe, 160),
      seq, criado_em: txt(x.criado_em, 40) ?? '', updated_at: txt(x.updated_at, 40) ?? '',
    }));
  }
  const seqSalvo = typeof o.seq === 'number' && Number.isFinite(o.seq) ? o.seq : 1;
  return {
    data: { v: HISTORICO_VERSAO, registros, acontecimentos, seq: Math.max(seqSalvo, maxSeq + 1) },
    descartados,
    versaoDesconhecida,
  };
}

// ─── Duração e estado ───────────────────────────────────────────────────────

/** Dias embarcado: desembarque − embarque (16/10 → 30/10 = 14). null em andamento. */
export function diasEmbarcado(r: Pick<RegistroEmbarque, 'embarque' | 'desembarque'>): number | null {
  if (!r.desembarque) return null;
  return Math.max(0, diasEntreISO(r.embarque, r.desembarque));
}

/** Em andamento: "Dia N registrado" — Dia 1 = dia do embarque real (independe da escala). */
export function diaRegistrado(r: Pick<RegistroEmbarque, 'embarque'>, hoje: string): number {
  return diasEntreISO(r.embarque, hoje) + 1;
}

export type EstadoRegistro = 'PLANEJADO' | 'EM_ANDAMENTO' | 'CONCLUIDO';

export function estadoRegistro(r: RegistroEmbarque): EstadoRegistro {
  if (r.planejado) return 'PLANEJADO';
  return r.desembarque ? 'CONCLUIDO' : 'EM_ANDAMENTO';
}

/** Ano em que o registro é contado: o do embarque real (documentado e testado). */
export function anoDoRegistro(r: RegistroEmbarque): number {
  return Number(r.embarque.slice(0, 4));
}

/** Diferença entre o desembarque real e o previsto (positivo = depois do previsto). */
export function atrasoDesembarque(r: RegistroEmbarque): number | null {
  if (!r.desembarque || !r.previsto?.desembarque) return null;
  return diasEntreISO(r.previsto.desembarque, r.desembarque);
}

// ─── Linha do tempo ─────────────────────────────────────────────────────────

/**
 * Ordenação: data → horário → ordem de criação. Sem horário, alguns tipos têm posição
 * natural no dia (desembarque abre o dia; hotel, embarque e casa fecham); os demais ficam
 * depois dos que têm horário, na ordem em que foram registrados (estável).
 */
const HORA_IMPLICITA: Partial<Record<TipoAcontecimentoHist, string>> = {
  DESEMBARQUE: '00:00', HOTEL: '23:00', EMBARQUE: '23:58', CASA: '23:59',
};
const HORA_SEM = '22:00';

export function chaveHora(a: Pick<AcontecimentoHist, 'tipo' | 'hora'>): string {
  return a.hora ?? HORA_IMPLICITA[a.tipo] ?? HORA_SEM;
}

export function compararAcontecimentosHist(a: AcontecimentoHist, b: AcontecimentoHist): number {
  return a.data.localeCompare(b.data)
    || chaveHora(a).localeCompare(chaveHora(b))
    || a.seq - b.seq
    || a.id.localeCompare(b.id);
}

/** Linha do tempo de um registro (inclui o que acontece antes do embarque e depois do desembarque). */
export function linhaDoTempo(h: HistoricoData, registroId: string): AcontecimentoHist[] {
  return h.acontecimentos.filter(a => a.registroId === registroId).sort(compararAcontecimentosHist);
}

// ─── Mutação (sempre devolve um novo objeto; nunca toca na escala) ─────────

/** Garante os acontecimentos automáticos (Embarque/Desembarque) do registro, sem duplicar. */
function sincronizarAutos(h: HistoricoData, r: RegistroEmbarque, agora: string): HistoricoData {
  let { acontecimentos, seq } = h;
  const garantir = (auto: 'embarque' | 'desembarque', data: string | null) => {
    const atual = acontecimentos.find(a => a.registroId === r.id && a.auto === auto);
    if (!data || r.planejado) {
      if (atual) acontecimentos = acontecimentos.filter(a => a !== atual);
      return;
    }
    if (atual) {
      if (atual.data !== data) acontecimentos = acontecimentos.map(a => (a === atual ? { ...a, data, updated_at: agora } : a));
      return;
    }
    acontecimentos = [...acontecimentos, {
      id: `${r.id}_${auto}`, registroId: r.id, tipo: auto === 'embarque' ? 'EMBARQUE' : 'DESEMBARQUE',
      data, auto, seq: seq++, criado_em: agora, updated_at: agora,
    }];
  };
  garantir('embarque', r.embarque);
  garantir('desembarque', r.desembarque);
  return { ...h, acontecimentos, seq };
}

export type ErroRegistro = 'SEM_EMBARQUE' | 'DESEMBARQUE_ANTES';

export function validarRegistro(r: Pick<RegistroEmbarque, 'embarque' | 'desembarque'>): ErroRegistro | null {
  if (!isoValido(r.embarque)) return 'SEM_EMBARQUE';
  if (r.desembarque && (!isoValido(r.desembarque) || r.desembarque < r.embarque)) return 'DESEMBARQUE_ANTES';
  return null;
}

/**
 * Cria ou atualiza (mesmo id → atualiza: um segundo toque em Salvar nunca duplica).
 * Recalcula os acontecimentos automáticos. A escala não é parâmetro: não há como alterá-la.
 */
export function salvarRegistro(h: HistoricoData, r: RegistroEmbarque, agora: string): HistoricoData {
  const limpo = semVazios({ ...r, updated_at: agora });
  const existe = h.registros.some(x => x.id === r.id);
  const registros = existe
    ? h.registros.map(x => (x.id === r.id ? { ...limpo, criado_em: x.criado_em || limpo.criado_em } : x))
    : [...h.registros, { ...limpo, criado_em: limpo.criado_em || agora }];
  return sincronizarAutos({ ...h, registros }, limpo, agora);
}

/** Exclui o registro e TODOS os acontecimentos dele. */
export function removerRegistro(h: HistoricoData, id: string): HistoricoData {
  return {
    ...h,
    registros: h.registros.filter(r => r.id !== id),
    acontecimentos: h.acontecimentos.filter(a => a.registroId !== id),
  };
}

/** Finaliza: grava o desembarque REAL (confirmado pela pessoa). */
export function finalizarRegistro(h: HistoricoData, id: string, desembarque: string, agora: string): HistoricoData {
  const r = h.registros.find(x => x.id === id);
  if (!r || desembarque < r.embarque) return h;
  return salvarRegistro(h, { ...r, desembarque, planejado: undefined }, agora);
}

/**
 * Cria ou atualiza um acontecimento (mesmo id → atualiza). Editar a data de um acontecimento
 * automático de Embarque/Desembarque corrige também a data principal do registro (dentro do
 * Histórico — nunca na escala).
 */
export function salvarAcontecimento(
  h: HistoricoData,
  a: Omit<AcontecimentoHist, 'seq' | 'criado_em' | 'updated_at'> & Partial<Pick<AcontecimentoHist, 'seq' | 'criado_em'>>,
  agora: string,
): HistoricoData {
  if (!h.registros.some(r => r.id === a.registroId)) return h;
  const atual = h.acontecimentos.find(x => x.id === a.id);
  let seq = h.seq;
  const novo: AcontecimentoHist = semVazios({
    ...a,
    seq: atual?.seq ?? a.seq ?? seq++,
    criado_em: atual?.criado_em ?? a.criado_em ?? agora,
    updated_at: agora,
  }) as AcontecimentoHist;
  const acontecimentos = atual ? h.acontecimentos.map(x => (x.id === a.id ? novo : x)) : [...h.acontecimentos, novo];
  let out: HistoricoData = { ...h, acontecimentos, seq };
  if (novo.auto === 'embarque' || novo.auto === 'desembarque') {
    const r = out.registros.find(x => x.id === novo.registroId)!;
    const campo = novo.auto;
    const nr = { ...r, [campo]: novo.data };
    if (!validarRegistro(nr)) out = { ...out, registros: out.registros.map(x => (x.id === r.id ? { ...nr, updated_at: agora } : x)) };
  }
  return out;
}

/** Exclui um acontecimento. O de Desembarque automático não apaga a data do registro
 *  (para isso existe "Editar embarque"); ele volta na próxima gravação do registro. */
export function removerAcontecimento(h: HistoricoData, id: string): HistoricoData {
  return { ...h, acontecimentos: h.acontecimentos.filter(a => a.id !== id) };
}

/** Dobra confirmada no fim do embarque: um acontecimento, sem inferir causa. Idempotente. */
export function registrarDobra(h: HistoricoData, registroId: string, agora: string): HistoricoData {
  const r = h.registros.find(x => x.id === registroId);
  const dias = r ? atrasoDesembarque(r) : null;
  if (!r || !dias || dias <= 0 || !r.previsto?.desembarque) return h;
  const id = `${registroId}_dobra`;
  return salvarAcontecimento(h, {
    id, registroId, tipo: 'DOBRA', data: r.previsto.desembarque, auto: 'dobra',
    titulo: dias === 1 ? 'Dobra de 1 dia' : `Dobra de ${dias} dias`,
  }, agora);
}

// ─── Duplicidade e sobreposição ─────────────────────────────────────────────

export function normalizarUnidade(u: string | undefined): string {
  return (u ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Mesma data de embarque e de desembarque (e mesma unidade quando as duas têm). */
export function registroDuplicado(h: HistoricoData, r: Pick<RegistroEmbarque, 'id' | 'embarque' | 'desembarque' | 'unidade'>): RegistroEmbarque | null {
  const u = normalizarUnidade(r.unidade);
  return h.registros.find(x =>
    x.id !== r.id
    && x.embarque === r.embarque
    && (x.desembarque ?? null) === (r.desembarque ?? null)
    && (!u || !x.unidade || normalizarUnidade(x.unidade) === u)) ?? null;
}

/** Fim exclusivo do período: o desembarque (dia fora); em andamento vai até hoje. */
function fimPeriodo(r: Pick<RegistroEmbarque, 'embarque' | 'desembarque'>, hoje: string): string {
  const fim = r.desembarque ?? (hoje > r.embarque ? somarDiasISO(hoje, 1) : somarDiasISO(r.embarque, 1));
  return fim > r.embarque ? fim : somarDiasISO(r.embarque, 1);
}

/** Outro registro cujo período se sobrepõe (embarcar no dia em que desembarcou não conta). */
export function registroSobreposto(h: HistoricoData, r: Pick<RegistroEmbarque, 'id' | 'embarque' | 'desembarque'>, hoje: string): RegistroEmbarque | null {
  const fimR = fimPeriodo(r, hoje);
  return h.registros.find(x => x.id !== r.id && x.embarque < fimR && r.embarque < fimPeriodo(x, hoje)) ?? null;
}

// ─── Lista, filtros e estatísticas ──────────────────────────────────────────

export interface ResumoHistorico {
  embarques: number;
  dias: number;
  unidades: number;
  /** Ano do primeiro registro concluído (só com dado real). */
  desde: number | null;
}

/** Só registros CONCLUÍDOS (realizados, com desembarque real). Nada estimado. */
export function resumoHistorico(registros: RegistroEmbarque[]): ResumoHistorico {
  const ok = registros.filter(r => estadoRegistro(r) === 'CONCLUIDO');
  const unidades = new Set(ok.map(r => normalizarUnidade(r.unidade)).filter(Boolean));
  return {
    embarques: ok.length,
    dias: ok.reduce((s, r) => s + (diasEmbarcado(r) ?? 0), 0),
    unidades: unidades.size,
    desde: ok.length ? Math.min(...ok.map(anoDoRegistro)) : null,
  };
}

export function compararRegistros(a: RegistroEmbarque, b: RegistroEmbarque): number {
  return b.embarque.localeCompare(a.embarque) || b.criado_em.localeCompare(a.criado_em) || a.id.localeCompare(b.id);
}

export interface GrupoAno {
  ano: number;
  resumo: ResumoHistorico;
  emAndamento: number;
  registros: RegistroEmbarque[];
}

export interface FiltroHistorico { ano?: number | null; unidade?: string | null }

/** Agrupa por ano (mais recente primeiro), já filtrado. Um passe só: aguenta centenas de registros. */
export function agruparPorAno(registros: RegistroEmbarque[], f: FiltroHistorico = {}): GrupoAno[] {
  const u = f.unidade ? normalizarUnidade(f.unidade) : '';
  const porAno = new Map<number, RegistroEmbarque[]>();
  for (const r of registros) {
    const ano = anoDoRegistro(r);
    if (f.ano && ano !== f.ano) continue;
    if (u && normalizarUnidade(r.unidade) !== u) continue;
    const l = porAno.get(ano);
    if (l) l.push(r); else porAno.set(ano, [r]);
  }
  return [...porAno.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([ano, lista]) => ({
      ano,
      resumo: resumoHistorico(lista),
      emAndamento: lista.filter(r => estadoRegistro(r) === 'EM_ANDAMENTO').length,
      registros: lista.sort(compararRegistros),
    }));
}

export function anosDoHistorico(registros: RegistroEmbarque[]): number[] {
  return [...new Set(registros.map(anoDoRegistro))].sort((a, b) => b - a);
}

/** Unidades já usadas (nome como a pessoa escreveu da última vez), mais recentes primeiro. */
export function unidadesDoHistorico(registros: RegistroEmbarque[]): string[] {
  const vistos = new Map<string, string>();
  for (const r of [...registros].sort(compararRegistros)) {
    const k = normalizarUnidade(r.unidade);
    if (k && !vistos.has(k)) vistos.set(k, r.unidade!.trim());
  }
  return [...vistos.values()];
}

/** Sugestões de preenchimento (toque para usar) a partir dos últimos registros — nunca automático. */
export function sugestoesCampo(registros: RegistroEmbarque[], campo: 'unidade' | 'funcao' | 'empresa', max = 3): string[] {
  const vistos = new Map<string, string>();
  for (const r of [...registros].sort(compararRegistros)) {
    const v = r[campo]?.trim();
    const k = normalizarUnidade(v);
    if (v && !vistos.has(k)) vistos.set(k, v);
    if (vistos.size >= max) break;
  }
  return [...vistos.values()];
}

// ─── Sugestão a partir da escala (planejado → revisão → realizado) ─────────

export interface SugestaoCiclo {
  /** Chave anti-spam (embarque previsto). */
  chave: string;
  embarquePrevisto: string;
  desembarquePrevisto: string;
  dEm: number;
  /** 'atual' = embarcado agora; 'ultimo' = desembarcou há poucos dias. */
  momento: 'atual' | 'ultimo';
  /** Dia do bloco embarcado quando 'atual' (1 = embarque hoje). */
  diaDoBloco: number | null;
}

/** Janela (dias de folga) em que ainda sugerimos registrar o embarque que acabou. */
export const DIAS_SUGERIR_ULTIMO = 7;
/** Tolerância (dias) para considerar que um registro já cobre o ciclo previsto. */
const TOLERANCIA_CICLO = 4;

/**
 * Ciclo atual (ou o que acabou de terminar) segundo a escala — SÓ como sugestão para revisão.
 * Nunca devolve ciclos antigos: a escala calcula o passado, mas isso não prova que aconteceu.
 */
export function sugestaoCicloAtual(escala: EscalaConfig | null, registros: RegistroEmbarque[], hojeD: Date): SugestaoCiclo | null {
  const res = resumoEscala(escala, hojeD);
  const c = res.calc;
  if (!c) return null;
  let emb: string, des: string, momento: SugestaoCiclo['momento'];
  if (res.estado === 'EMBARCADO') {
    emb = somarDiasISO(res.hojeISO, -(c.diaDoBloco - 1));
    des = somarDiasISO(emb, c.dEm);
    momento = 'atual';
  } else if (c.diaDoBloco <= DIAS_SUGERIR_ULTIMO) {
    des = somarDiasISO(res.hojeISO, -(c.diaDoBloco - 1));
    emb = somarDiasISO(des, -c.dEm);
    momento = 'ultimo';
  } else return null;
  // Já registrado (com a data real que for, perto da prevista) ou outro em andamento → nada a sugerir.
  const coberto = registros.some(r =>
    Math.abs(diasEntreISO(emb, r.embarque)) <= TOLERANCIA_CICLO
    || (estadoRegistro(r) === 'EM_ANDAMENTO' && r.embarque <= res.hojeISO));
  if (coberto) return null;
  return { chave: emb, embarquePrevisto: emb, desembarquePrevisto: des, dEm: c.dEm, momento, diaDoBloco: momento === 'atual' ? c.diaDoBloco : null };
}

// ─── Finalização (desembarque previsto chegou) ──────────────────────────────

export interface PendenciaFinalizar {
  registro: RegistroEmbarque;
  desembarquePrevisto: string;
  /** 0 = previsto para hoje; > 0 = passou há N dias. */
  diasDesde: number;
}

/** Registro em andamento cujo desembarque previsto já chegou (o mais antigo primeiro). */
export function pendenciaFinalizar(registros: RegistroEmbarque[], hoje: string): PendenciaFinalizar | null {
  const lista = registros
    .filter(r => estadoRegistro(r) === 'EM_ANDAMENTO' && r.previsto?.desembarque && r.previsto.desembarque <= hoje)
    .sort((a, b) => a.embarque.localeCompare(b.embarque));
  const r = lista[0];
  if (!r) return null;
  return { registro: r, desembarquePrevisto: r.previsto!.desembarque!, diasDesde: diasEntreISO(r.previsto!.desembarque!, hoje) };
}

/** Registro planejado cujo embarque já chegou: pedir confirmação (nunca virar realizado sozinho). */
export function planejadoAConfirmar(registros: RegistroEmbarque[], hoje: string): RegistroEmbarque | null {
  return registros.filter(r => r.planejado && r.embarque <= hoje).sort((a, b) => a.embarque.localeCompare(b.embarque))[0] ?? null;
}

// ─── Anti-spam dos avisos (Home / Buddy Agora) ──────────────────────────────

export interface AvisosHistorico {
  /** Sugestões de ciclo dispensadas ("Agora não"), por chave do ciclo. */
  dispensadas: string[];
  /** Finalização adiada: registroId → não perguntar antes desta data. */
  adiadoAte: Record<string, string>;
}

export function avisosVazios(): AvisosHistorico {
  return { dispensadas: [], adiadoAte: {} };
}

export function lerAvisos(raw: unknown): AvisosHistorico {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const dispensadas = Array.isArray(o.dispensadas) ? o.dispensadas.filter(isoValido).slice(-24) : [];
  const adiadoAte: Record<string, string> = {};
  if (o.adiadoAte && typeof o.adiadoAte === 'object') {
    for (const [k, v] of Object.entries(o.adiadoAte as Record<string, unknown>)) if (isoValido(v)) adiadoAte[k] = v;
  }
  return { dispensadas, adiadoAte };
}

/** Depois de 2 sugestões dispensadas, a Home para de sugerir (continua na tela do Histórico). */
export const MAX_DISPENSAS_HOME = 2;

/** "Agora não" na finalização: hoje → pergunta amanhã; atrasado → daqui a 3 dias. */
export function adiarFinalizacao(av: AvisosHistorico, p: PendenciaFinalizar, hoje: string): AvisosHistorico {
  return { ...av, adiadoAte: { ...av.adiadoAte, [p.registro.id]: somarDiasISO(hoje, p.diasDesde === 0 ? 1 : 3) } };
}

export function dispensarSugestao(av: AvisosHistorico, s: SugestaoCiclo): AvisosHistorico {
  return av.dispensadas.includes(s.chave) ? av : { ...av, dispensadas: [...av.dispensadas, s.chave].slice(-24) };
}

export type AvisoHistoricoHome =
  | { tipo: 'FINALIZAR'; pendencia: PendenciaFinalizar }
  | { tipo: 'SUGERIR'; sugestao: SugestaoCiclo };

/**
 * No máximo UM aviso discreto para a Home, só quando há ação útil:
 *   1. desembarque previsto chegou (respeita "Agora não");
 *   2. embarque atual ainda não registrado, nos 3 primeiros dias do embarque.
 */
export function avisoHistoricoHome(
  escala: EscalaConfig | null,
  h: HistoricoData,
  av: AvisosHistorico,
  hojeD: Date,
  hoje: string,
): AvisoHistoricoHome | null {
  const p = pendenciaFinalizar(h.registros, hoje);
  if (p) {
    const ate = av.adiadoAte[p.registro.id];
    return ate && ate > hoje ? null : { tipo: 'FINALIZAR', pendencia: p };
  }
  if (av.dispensadas.length >= MAX_DISPENSAS_HOME) return null;
  const s = sugestaoCicloAtual(escala, h.registros, hojeD);
  if (!s || s.momento !== 'atual' || (s.diaDoBloco ?? 99) > 3 || av.dispensadas.includes(s.chave)) return null;
  return { tipo: 'SUGERIR', sugestao: s };
}

// ─── Importar Minha Viagem ──────────────────────────────────────────────────

const VIAGEM_PARA_TIPO: Record<ViagemTipo, TipoAcontecimentoHist> = {
  AVIAO: 'VOO', ONIBUS: 'ONIBUS', CARRO: 'CARRO', VAN: 'VAN', EMPRESA: 'TRANSFER', OUTRO: 'OUTRO',
};

export function chaveImportacaoViagem(v: Viagem): string {
  return ['viagem', v.tipo, v.data, v.hora ?? '', (v.num_voo ?? '').trim().toUpperCase()].join(':');
}

/** A viagem cadastrada é deste ciclo? (ida até 5 dias antes do embarque, volta até 5 dias depois do desembarque). */
export function viagemDoRegistro(v: Viagem | null, r: RegistroEmbarque): boolean {
  if (!v || !isoValido(v.data)) return false;
  if (v.data >= somarDiasISO(r.embarque, -5) && v.data <= somarDiasISO(r.embarque, 1)) return true;
  const fim = r.desembarque ?? r.previsto?.desembarque;
  return !!fim && v.data >= somarDiasISO(fim, -1) && v.data <= somarDiasISO(fim, 5);
}

export function viagemJaImportada(h: HistoricoData, registroId: string, v: Viagem): boolean {
  const k = chaveImportacaoViagem(v);
  return h.acontecimentos.some(a => a.registroId === registroId && a.importadoDe === k);
}

/**
 * Copia a viagem para a linha do tempo (não move nem altera Minha Viagem). Só campos de
 * trajeto: nada de localizador, assento ou observação. Dois toques = um acontecimento.
 */
export function importarViagem(h: HistoricoData, registroId: string, v: Viagem, hoje: string, agora: string): HistoricoData {
  const reg = h.registros.find(r => r.id === registroId);
  if (!reg || !viagemDoRegistro(v, reg) || viagemJaImportada(h, registroId, v)) return h;
  const tipo = VIAGEM_PARA_TIPO[v.tipo] ?? 'OUTRO';
  return salvarAcontecimento(h, {
    id: `${registroId}_v_${v.data}_${(v.hora ?? '').replace(':', '')}_${v.tipo}`.toLowerCase(),
    registroId, tipo, data: v.data,
    hora: v.hora && HORA_RE.test(v.hora) ? v.hora : undefined,
    origem: txt(v.origem, 60), destino: txt(v.destino, 60),
    numero: tipo === 'VOO' ? txt(v.num_voo, 20) : undefined,
    planejado: v.data > hoje ? true : undefined,
    importadoDe: chaveImportacaoViagem(v),
  }, agora);
}

// ─── Textos ─────────────────────────────────────────────────────────────────

const MESES_CURTOS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** "16 OUT" */
export function diaMesCurto(iso: string): string {
  return `${iso.slice(8, 10)} ${MESES_CURTOS[Number(iso.slice(5, 7)) - 1]}`;
}

/** "16 OUT → 30 OUT" (ano no fim só quando muda: "28 DEZ 2025 → 11 JAN 2026"). */
export function periodoCurto(r: Pick<RegistroEmbarque, 'embarque' | 'desembarque'>): string {
  if (!r.desembarque) return `${diaMesCurto(r.embarque)} → …`;
  if (r.embarque.slice(0, 4) !== r.desembarque.slice(0, 4)) {
    return `${diaMesCurto(r.embarque)} ${r.embarque.slice(0, 4)} → ${diaMesCurto(r.desembarque)} ${r.desembarque.slice(0, 4)}`;
  }
  return `${diaMesCurto(r.embarque)} → ${diaMesCurto(r.desembarque)}`;
}

export function textoDias(n: number): string {
  return n === 1 ? '1 dia embarcado' : `${n.toLocaleString('pt-BR')} dias embarcado`;
}

/** Nome do registro na lista: a unidade, ou "Embarque" quando a pessoa não informou. */
export function nomeRegistro(r: Pick<RegistroEmbarque, 'unidade'>): string {
  return r.unidade?.trim() || 'Embarque';
}

/** Título do acontecimento na linha do tempo. */
export function tituloAcontecimentoHist(a: AcontecimentoHist): string {
  if (a.titulo) return a.titulo;
  const base = LABEL_ACONTECIMENTO_HIST[a.tipo];
  if (a.origem && a.destino) return `${base} ${a.origem} → ${a.destino}`;
  if (a.destino) return `${base} para ${a.destino}`;
  if (a.local) return `${base} · ${a.local}`;
  return base;
}
