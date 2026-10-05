import type { Viagem, ViagemTipo } from './types';
import { hojeISO, somarDiasISO } from './escala';

export const TIPO_LABELS: Record<ViagemTipo, string> = {
  AVIAO:   'Avião',
  ONIBUS:  'Ônibus',
  CARRO:   'Carro',
  VAN:     'Van / Translado',
  EMPRESA: 'Transporte da empresa',
  OUTRO:   'Outro',
};

export const TIPO_ICONS: Record<ViagemTipo, string> = {
  AVIAO:   '✈️',
  ONIBUS:  '🚌',
  CARRO:   '🚗',
  VAN:     '🚐',
  EMPRESA: '🏭',
  OUTRO:   '🧳',
};

export function getViagemRota(v: Viagem): string {
  if (v.origem && v.destino) return `${v.origem} → ${v.destino}`;
  if (v.destino) return `→ ${v.destino}`;
  if (v.empresa) return v.empresa;
  if (v.ponto) return v.ponto;
  return '';
}

export function getViagemResumo(v: Viagem): string {
  const label = TIPO_LABELS[v.tipo] || v.tipo;
  const rota = getViagemRota(v);
  return rota ? `${label} · ${rota}` : label;
}

export function viagemEAmanha(v: Viagem, today: Date = new Date()): boolean {
  if (!v.data) return false;
  return v.data === somarDiasISO(hojeISO(today), 1);
}

export function viagemEHoje(v: Viagem, today: Date = new Date()): boolean {
  if (!v.data) return false;
  return v.data === hojeISO(today);
}
