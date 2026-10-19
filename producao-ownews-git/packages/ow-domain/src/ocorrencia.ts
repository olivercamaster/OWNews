import type { EventoPessoal } from './types';

/** Ocorrência de eventos no calendário — sem dependências (usado pelo calendário e pelas Datas importantes). */

function bissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Data da ocorrência anual em um ano (29/02 → 28/02 fora de ano bissexto). */
export function ocorrenciaNoAno(isoOriginal: string, ano: number): string {
  const mm = isoOriginal.slice(5, 7);
  let dd = isoOriginal.slice(8, 10);
  if (mm === '02' && dd === '29' && !bissexto(ano)) dd = '28';
  return `${String(ano).padStart(4, '0')}-${mm}-${dd}`;
}

/** O evento acontece neste dia? Respeita recorrência anual (vale para qualquer ano). */
export function eventoOcorreEm(ev: EventoPessoal, iso: string): boolean {
  if (ev._deleted || typeof ev.data_ini !== 'string' || !ISO_RE.test(ev.data_ini)) return false;
  if (ev.recorrencia === 'anual') return ocorrenciaNoAno(ev.data_ini, Number(iso.slice(0, 4))) === iso;
  return iso >= ev.data_ini && iso <= (ev.data_fim ?? ev.data_ini);
}
