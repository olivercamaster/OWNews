/**
 * Datas importantes — camada sobre EventoPessoal (o MESMO cadastro que aparece no
 * calendário da Minha Escala). Nada de calendário paralelo.
 *
 * Regras puras e determinísticas:
 *  - recorrência 'anual' repete no mesmo dia/mês; 29/02 cai em 28/02 nos anos não bissextos;
 *  - "estado da escala no dia" vem de estadoEscalaNoDia() (regra canônica calcEscalaISO +
 *    exceções de dobra/férias, igual ao calendário) — nenhuma conta de ciclo aqui.
 */
import type { EscalaConfig, EventoPessoal, EventoTipo } from './types';
import { diasEntreISO, isoValido } from './escala';
import { estadoEscalaNoDia, type EstadoEscalaNoDia } from './escala-calendario';
import { ocorrenciaNoAno } from './ocorrencia';
export { ocorrenciaNoAno, eventoOcorreEm } from './ocorrencia';

export const TIPOS_EVENTO_CADASTRO: EventoTipo[] = [
  'ANIVERSARIO', 'CURSO', 'CONSULTA', 'COMPROMISSO', 'TRABALHO', 'DOCUMENTO', 'PESSOAL', 'OUTRO',
];

export const LABEL_EVENTO: Record<EventoTipo, string> = {
  ANIVERSARIO: 'Aniversário',
  CURSO: 'Curso',
  CONSULTA: 'Consulta',
  COMPROMISSO: 'Compromisso',
  TRABALHO: 'Trabalho',
  DOCUMENTO: 'Documento',
  PESSOAL: 'Pessoal',
  OUTRO: 'Outro',
  VIAGEM: 'Viagem',
  DATA_ESPECIAL: 'Data especial',
};

/** Relações sugeridas no aniversário — neutras, opcionais; o app não infere gênero. */
export const RELACOES_PESSOA = ['Companheira/o', 'Filho/a', 'Pai', 'Mãe', 'Irmão/ã', 'Amigo/a', 'Familiar', 'Outro'] as const;

/** Antecedência padrão do lembrete (dias antes), por tipo. */
export const LEMBRETE_PADRAO_DIAS: Record<EventoTipo, number[]> = {
  ANIVERSARIO: [7, 1],
  CURSO: [7, 1],
  CONSULTA: [1],
  COMPROMISSO: [1],
  TRABALHO: [1],
  DOCUMENTO: [7, 1],
  PESSOAL: [1],
  OUTRO: [1],
  VIAGEM: [1],
  DATA_ESPECIAL: [1],
};

export function recorrenciaPadrao(tipo: EventoTipo): 'nenhuma' | 'anual' {
  return tipo === 'ANIVERSARIO' ? 'anual' : 'nenhuma';
}

export function diasLembrete(ev: EventoPessoal): number[] {
  const d = Array.isArray(ev.lembrete_dias) ? ev.lembrete_dias : LEMBRETE_PADRAO_DIAS[ev.tipo] ?? [1];
  return [...new Set(d.filter(n => Number.isInteger(n) && n >= 0 && n <= 60))].sort((a, b) => b - a);
}

/** Título exibido: o que o usuário escreveu; aniversário sem título vira "Aniversário de <pessoa>". */
export function tituloEvento(ev: EventoPessoal): string {
  const nome = ev.nome?.trim();
  if (nome) return nome;
  if (ev.tipo === 'ANIVERSARIO' && ev.pessoa?.trim()) return `Aniversário de ${ev.pessoa.trim()}`;
  return LABEL_EVENTO[ev.tipo] ?? 'Evento';
}

export interface Ocorrencia {
  /** Dia da ocorrência (YYYY-MM-DD). Em evento de vários dias em andamento, é o próprio hoje. */
  iso: string;
  /** Dias de calendário a partir de hoje (0 = hoje). */
  dias: number;
  emAndamento: boolean;
}

/** Próxima ocorrência (>= hoje) ou null se o evento já passou. */
export function proximaOcorrencia(ev: EventoPessoal, hojeISO: string): Ocorrencia | null {
  if (ev._deleted || !isoValido(ev.data_ini)) return null;
  if (ev.recorrencia === 'anual') {
    const ano = Number(hojeISO.slice(0, 4));
    // Nunca antes do ano em que foi cadastrado como data inicial? Aniversário é passado por natureza:
    // a recorrência vale para qualquer ano.
    let iso = ocorrenciaNoAno(ev.data_ini, ano);
    if (iso < hojeISO) iso = ocorrenciaNoAno(ev.data_ini, ano + 1);
    return { iso, dias: diasEntreISO(hojeISO, iso), emAndamento: false };
  }
  const fim = ev.data_fim && isoValido(ev.data_fim) && ev.data_fim >= ev.data_ini ? ev.data_fim : ev.data_ini;
  if (fim < hojeISO) return null;
  if (ev.data_ini < hojeISO) return { iso: hojeISO, dias: 0, emAndamento: true };
  return { iso: ev.data_ini, dias: diasEntreISO(hojeISO, ev.data_ini), emAndamento: false };
}

/** "Você estará embarcado nessa data." etc. Null sem escala. */
export function fraseEscalaNaData(estado: EstadoEscalaNoDia | null, ehHoje: boolean): string | null {
  if (!estado) return null;
  const v = ehHoje ? 'Você está' : 'Você estará';
  if (estado.isEmbarque) return ehHoje ? 'Hoje é dia de embarque.' : 'É dia de embarque.';
  if (estado.isDesembarque) return ehHoje ? 'Hoje é dia de desembarque.' : 'É dia de desembarque.';
  switch (estado.kind) {
    case 'EMBARCADO': return `${v} embarcado nessa data.`;
    case 'FOLGA':     return `${v} de folga nessa data.`;
    case 'DOBRA':     return 'Dobra marcada nessa data.';
    case 'FERIAS':    return `${v} de férias nessa data.`;
    default:          return null;
  }
}

export function escalaNaData(escala: EscalaConfig | null, iso: string): EstadoEscalaNoDia | null {
  return escala ? estadoEscalaNoDia(escala, escala.excecoes ?? [], iso) : null;
}
