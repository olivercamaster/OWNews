import type { EscalaConfig, EscalaCalc, EscalaResumo, EscalaTipo, Momento, MomentoTipo } from './types';

const DIA_MS = 86400000;

/**
 * Presets de ciclo. Mesma tabela do OWNews web (14x14, 14x21, 14x28) + presets
 * extras do app (28x28, 21x21, 7x7). 'custom' usa diasEmbarcado/diasFolga.
 */
export const TIPOS_PRESET: Readonly<Record<string, readonly [number, number]>> = {
  '14x14': [14, 14],
  '14x21': [14, 21],
  '14x28': [14, 28],
  '28x28': [28, 28],
  '21x21': [21, 21],
  '7x7':   [7, 7],
};

/** Lista para UI (chips de seleção) — única fonte de verdade para as telas. */
export const ESCALA_TIPOS: ReadonlyArray<{ value: EscalaTipo; label: string }> = [
  { value: '14x14',  label: '14 × 14' },
  { value: '14x21',  label: '14 × 21' },
  { value: '14x28',  label: '14 × 28' },
  { value: '28x28',  label: '28 × 28' },
  { value: '21x21',  label: '21 × 21' },
  { value: '7x7',    label: '7 × 7' },
  { value: 'custom', label: 'Personalizada' },
];

export const MOMENTO_LABEL: Readonly<Record<MomentoTipo, string>> = {
  SEM_ESCALA:          '',
  FOLGA:               'De folga',
  EMBARQUE_DISTANTE:   'Embarque se aproxima',
  EMBARQUE_PROXIMO:    'Embarque em breve',
  VESPERA_EMBARQUE:    'Véspera do embarque',
  EMBARCADO:           'Embarcado',
  DESEMBARQUE_PROXIMO: 'Desembarque próximo',
};

// ─── Datas ──────────────────────────────────────────────────────────────────
//
// Regra: a escala é contada em DIAS DE CALENDÁRIO LOCAL. O OWNews web faz
// Date.UTC(ano, mes, dia) a partir da data local do navegador e compara com a
// referência também em UTC-meia-noite — ou seja, aritmética em dias inteiros.
// Aqui normalizamos tudo para 12:00Z do dia local, o que evita o salto de dia
// às 21:00 (Brasília) que acontecia ao usar Date.now() cru.

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** Data LOCAL do dispositivo em YYYY-MM-DD (nunca use toISOString() para isso). */
export function hojeISO(today: Date = new Date()): string {
  return `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
}

/** Converte um Date arbitrário no instante 12:00Z do seu dia de calendário local. */
export function normalizarDia(today: Date): number {
  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12);
}

export function isoParaMs(iso: string): number {
  return new Date(iso + 'T12:00:00Z').getTime();
}

export function msParaISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function somarDiasISO(iso: string, dias: number): string {
  return msParaISO(isoParaMs(iso) + dias * DIA_MS);
}

/** Diferença em dias de calendário (b - a). */
export function diasEntreISO(aISO: string, bISO: string): number {
  return Math.round((isoParaMs(bISO) - isoParaMs(aISO)) / DIA_MS);
}

// ─── Ciclo ──────────────────────────────────────────────────────────────────

export function diasDoCiclo(config: EscalaConfig): { dEm: number; dFo: number } | null {
  const preset = TIPOS_PRESET[config.tipo];
  const dEm = preset ? preset[0] : (parseInt(String(config.diasEmbarcado ?? ''), 10) || 0);
  const dFo = preset ? preset[1] : (parseInt(String(config.diasFolga ?? ''), 10) || 0);
  if (!dEm || !dFo || isNaN(dEm) || isNaN(dFo)) return null;
  return { dEm, dFo };
}

/**
 * Motor da escala — paridade exata com OWNews worker.js (calcularEscala /
 * calcEscalaCentral / calcNextEmbarque):
 *   anchor = tipoRef==='embarquei' ? refUTC : refUTC - dEm*dia
 *   fase   = ((round((hoje-anchor)/dia) % ciclo) + ciclo) % ciclo
 *   embarcado = fase < dEm
 * Dobra e férias NÃO entram aqui: são apenas visuais (igual ao web).
 */
export function calcEscala(config: EscalaConfig, today: Date = new Date()): EscalaCalc | null {
  try {
    const dias = diasDoCiclo(config);
    if (!dias) return null;
    const { dEm, dFo } = dias;

    const refUTC = isoParaMs(config.dataRef);
    if (isNaN(refUTC)) return null;

    const anchor = config.tipoRef === 'embarquei' ? refUTC : refUTC - dEm * DIA_MS;
    const ciclo = dEm + dFo;
    const agoraMs = normalizarDia(today);
    const fase = ((Math.round((agoraMs - anchor) / DIA_MS) % ciclo) + ciclo) % ciclo;

    return {
      embarcado: fase < dEm,
      diasRestantes: fase < dEm ? dEm - fase : ciclo - fase,
      dEm,
      dFo,
      ciclo,
      diaDoBloco: fase < dEm ? fase + 1 : fase - dEm + 1,
    };
  } catch {
    return null;
  }
}

export function calcEscalaParaDia(config: EscalaConfig, isoDate: string): EscalaCalc | null {
  return calcEscala(config, new Date(isoDate + 'T12:00:00Z'));
}

// ─── Próximas transições ────────────────────────────────────────────────────
//
// Igual ao web calcNextEmbarque: o próximo embarque existe mesmo quando
// embarcado (fim do embarque atual + folga). Idem para desembarque na folga.

export function proximoEmbarqueISO(config: EscalaConfig, today: Date = new Date()): string | null {
  const calc = calcEscala(config, today);
  if (!calc) return null;
  const dias = calc.embarcado ? calc.diasRestantes + calc.dFo : calc.diasRestantes;
  return somarDiasISO(hojeISO(today), dias);
}

export function proximoDesembarqueISO(config: EscalaConfig, today: Date = new Date()): string | null {
  const calc = calcEscala(config, today);
  if (!calc) return null;
  const dias = calc.embarcado ? calc.diasRestantes : calc.diasRestantes + calc.dEm;
  return somarDiasISO(hojeISO(today), dias);
}

/** @deprecated use proximoEmbarqueISO — mantido por compatibilidade (null quando embarcado). */
export function proximaDataEmbarque(config: EscalaConfig, today: Date = new Date()): Date | null {
  const calc = calcEscala(config, today);
  if (!calc || calc.embarcado) return null;
  return new Date(normalizarDia(today) + calc.diasRestantes * DIA_MS);
}

/** @deprecated use proximoDesembarqueISO — mantido por compatibilidade (null quando de folga). */
export function proximaDataDesembarque(config: EscalaConfig, today: Date = new Date()): Date | null {
  const calc = calcEscala(config, today);
  if (!calc || !calc.embarcado) return null;
  return new Date(normalizarDia(today) + calc.diasRestantes * DIA_MS);
}

// ─── Resumo para UI ─────────────────────────────────────────────────────────

const RESUMO_VAZIO = (hoje: string): EscalaResumo => ({
  estado: 'SEM_ESCALA',
  hojeISO: hoje,
  calc: null,
  proximoEmbarqueISO: null,
  proximoDesembarqueISO: null,
  diasParaEmbarque: null,
  diasParaDesembarque: null,
  progresso: 0,
});

/**
 * Único ponto de entrada das telas (Home, Escala hub, Meu Embarque).
 * Nunca lança; sem escala válida retorna estado SEM_ESCALA.
 */
export function resumoEscala(config: EscalaConfig | null | undefined, today: Date = new Date()): EscalaResumo {
  const hoje = hojeISO(today);
  if (!config) return RESUMO_VAZIO(hoje);
  const calc = calcEscala(config, today);
  if (!calc) return RESUMO_VAZIO(hoje);

  const diasParaEmbarque = calc.embarcado ? calc.diasRestantes + calc.dFo : calc.diasRestantes;
  const diasParaDesembarque = calc.embarcado ? calc.diasRestantes : calc.diasRestantes + calc.dEm;
  const tamanhoBloco = calc.embarcado ? calc.dEm : calc.dFo;

  return {
    estado: calc.embarcado ? 'EMBARCADO' : 'DE_FOLGA',
    hojeISO: hoje,
    calc,
    proximoEmbarqueISO: somarDiasISO(hoje, diasParaEmbarque),
    proximoDesembarqueISO: somarDiasISO(hoje, diasParaDesembarque),
    diasParaEmbarque,
    diasParaDesembarque,
    progresso: tamanhoBloco > 0 ? Math.min(1, Math.max(0, calc.diaDoBloco / tamanhoBloco)) : 0,
  };
}

// ─── Momento (Buddy Voice) ──────────────────────────────────────────────────

export function calcularMomento(config: EscalaConfig | null | undefined, today: Date = new Date()): Momento {
  if (!config || !config.tipo) return { tipo: 'SEM_ESCALA' };

  const result = calcEscala(config, today);
  if (!result) return { tipo: 'SEM_ESCALA' };

  if (result.embarcado) {
    const diasDesembarque = result.diasRestantes;
    return {
      tipo: diasDesembarque <= 2 ? 'DESEMBARQUE_PROXIMO' : 'EMBARCADO',
      diasDesembarque,
    };
  }

  const diasEmbarque = result.diasRestantes;
  let tipo: MomentoTipo;
  if (diasEmbarque === 0)      tipo = 'VESPERA_EMBARQUE';
  else if (diasEmbarque <= 2)  tipo = 'EMBARQUE_PROXIMO';
  else if (diasEmbarque <= 5)  tipo = 'EMBARQUE_DISTANTE';
  else                         tipo = 'FOLGA';

  return { tipo, diasEmbarque };
}

/** Texto curto do momento, ex.: "Embarcado · 9d para desembarque". */
export function descreverMomento(momento: Momento): string {
  const label = MOMENTO_LABEL[momento.tipo];
  if (!label) return '';
  if (momento.diasEmbarque != null) return `${label} · ${momento.diasEmbarque}d para embarque`;
  if (momento.diasDesembarque != null) return `${label} · ${momento.diasDesembarque}d para desembarque`;
  return label;
}
