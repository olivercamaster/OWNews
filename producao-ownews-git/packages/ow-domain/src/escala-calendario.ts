import type { EscalaConfig, Excecao, EventoPessoal, DayInfo, DayKind, FeriadoBR } from './types';
import { calcEscala, hojeISO } from './escala';

// Algoritmo de Gauss/Meeus — idêntico ao OWNews worker.js linha 15980
export function pascoaUTC(ano: number): number {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(ano, mes - 1, dia);
}

function segundoDomingoUTC(ano: number, mesIdx0: number): number {
  const dow = new Date(Date.UTC(ano, mesIdx0, 1)).getUTCDay();
  const primeiroDomingo = dow === 0 ? 1 : 8 - dow;
  return Date.UTC(ano, mesIdx0, primeiroDomingo + 7);
}

// Feriados e comemorativas brasileiras — mesma lista do OWNews worker.js linha 15990
export function datasImportantesDoAno(ano: number): FeriadoBR[] {
  const pascoa = pascoaUTC(ano);
  const carnaval = pascoa - 47 * 86400000;
  const sextaSanta = pascoa - 2 * 86400000;
  return [
    { nome: 'Ano-Novo',                 tipo: 'feriado',      data: Date.UTC(ano, 0, 1) },
    { nome: 'Carnaval',                 tipo: 'feriado',      data: carnaval },
    { nome: 'Sexta-feira Santa',        tipo: 'feriado',      data: sextaSanta },
    { nome: 'Páscoa',                   tipo: 'feriado',      data: pascoa },
    { nome: 'Tiradentes',               tipo: 'feriado',      data: Date.UTC(ano, 3, 21) },
    { nome: 'Dia do Trabalho',          tipo: 'feriado',      data: Date.UTC(ano, 4, 1) },
    { nome: 'Dia das Mães',             tipo: 'comemorativa', data: segundoDomingoUTC(ano, 4) },
    { nome: 'Dia dos Pais',             tipo: 'comemorativa', data: segundoDomingoUTC(ano, 7) },
    { nome: '7 de Setembro',            tipo: 'feriado',      data: Date.UTC(ano, 8, 7) },
    { nome: 'Dia das Crianças',         tipo: 'feriado',      data: Date.UTC(ano, 9, 12) },
    { nome: 'Finados',                  tipo: 'feriado',      data: Date.UTC(ano, 10, 2) },
    { nome: 'Proclamação da República', tipo: 'feriado',      data: Date.UTC(ano, 10, 15) },
    { nome: 'Consciência Negra',        tipo: 'feriado',      data: Date.UTC(ano, 10, 20) },
    { nome: 'Natal',                    tipo: 'feriado',      data: Date.UTC(ano, 11, 25) },
  ];
}

// 6 hubs offshore conforme OWNews /minha-escala form
export const AEROPORTOS_ESCALA = [
  { code: 'SBJR', nome: 'Jacarepaguá',       cidade: 'Rio de Janeiro',        uf: 'RJ', lat: -22.9874, lon: -43.3691 },
  { code: 'SBMI', nome: 'Maricá',             cidade: 'Maricá',                uf: 'RJ', lat: -22.9192, lon: -42.8282 },
  { code: 'SBCB', nome: 'Cabo Frio',          cidade: 'Cabo Frio',             uf: 'RJ', lat: -22.9210, lon: -42.0743 },
  { code: 'SBME', nome: 'Macaé',              cidade: 'Macaé',                 uf: 'RJ', lat: -22.3431, lon: -41.7660 },
  { code: 'SBVT', nome: 'Vitória',            cidade: 'Vitória',               uf: 'ES', lat: -20.2583, lon: -40.2861 },
  { code: 'SBFS', nome: 'Farol de São Tomé',  cidade: 'Campos dos Goytacazes', uf: 'RJ', lat: -22.0531, lon: -41.0563 },
] as const;

export type AeroportoEscala = typeof AEROPORTOS_ESCALA[number];

export function getAeroporto(code: string): AeroportoEscala | undefined {
  return AEROPORTOS_ESCALA.find(a => a.code === code);
}

function msParaISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Dobra/férias são APENAS visuais (paridade OWNews web): mudam a cor do dia,
 * mas o ciclo base (embarcado/folga, diaDoBloco, marcadores de transição)
 * continua vindo de calcEscala sem nenhum deslocamento.
 */
function kindParaDia(
  config: EscalaConfig,
  excecoes: Excecao[],
  iso: string,
): { kind: DayKind; diaDoBloco: number; isEmbarque: boolean; isDesembarque: boolean } {
  const date = new Date(iso + 'T12:00:00Z');
  const base = calcEscala(config, date);
  if (!base) return { kind: 'SEM_ESCALA', diaDoBloco: 0, isEmbarque: false, isDesembarque: false };
  const exc = excecoes.find(e => iso >= e.ini && iso <= e.fim);
  let kind: DayKind;
  if (exc?.tipo === 'dobra') kind = 'DOBRA';
  else if (exc?.tipo === 'ferias') kind = 'FERIAS';
  else kind = base.embarcado ? 'EMBARCADO' : 'FOLGA';
  // web: if(st.diaDoBloco===1) classes += status==="embarcado" ? " embarque" : " desembarque"
  const primeiroDia = base.diaDoBloco === 1;
  return {
    kind,
    diaDoBloco: base.diaDoBloco,
    isEmbarque: primeiroDia && base.embarcado,
    isDesembarque: primeiroDia && !base.embarcado,
  };
}

export function infoParaDia(
  config: EscalaConfig,
  excecoes: Excecao[],
  eventosPessoais: EventoPessoal[],
  iso: string,
  todayISO: string,
): DayInfo {
  const { kind, diaDoBloco, isEmbarque, isDesembarque } = kindParaDia(config, excecoes, iso);

  const ano = parseInt(iso.slice(0, 4));
  const feriado = datasImportantesDoAno(ano).find(f => msParaISO(f.data) === iso);

  return {
    iso,
    kind,
    isEmbarque,
    isDesembarque,
    diaDoBloco,
    feriado,
    excecao: excecoes.find(e => iso >= e.ini && iso <= e.fim),
    eventosPessoais: eventosPessoais.filter(
      e => !e._deleted && iso >= e.data_ini && iso <= (e.data_fim ?? e.data_ini),
    ),
    isHoje: iso === todayISO,
  };
}

export function gerarMesDias(
  config: EscalaConfig,
  excecoes: Excecao[],
  eventosPessoais: EventoPessoal[],
  ano: number,
  mes: number,  // 1–12
  todayISO: string = hojeISO(),
): DayInfo[] {
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const result: DayInfo[] = [];
  for (let d = 1; d <= diasNoMes; d++) {
    const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    result.push(infoParaDia(config, excecoes, eventosPessoais, iso, todayISO));
  }
  return result;
}
