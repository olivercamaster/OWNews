/**
 * Compartilhar minha escala — dados da IMAGEM (só a escala).
 *
 * Privacidade por construção: a entrada é apenas a configuração da escala e o mês.
 * Nada de nome, telefone, empresa, unidade, voo, hotel, documentos, contatos,
 * eventos pessoais ou dobra/férias — esses dados nem chegam a esta função.
 */
import type { EscalaConfig } from './types';
import { calcEscalaISO, diasDoCiclo } from './escala';

export type DiaCompartilhado = 'EMBARCADO' | 'FOLGA';

export interface CelulaCompartilhada {
  dia: number;
  iso: string;
  tipo: DiaCompartilhado;
  embarque: boolean;
  desembarque: boolean;
}

export interface MesCompartilhado {
  /** "NOVEMBRO 2026" */
  titulo: string;
  /** "14 × 14" */
  ciclo: string;
  /** Semanas de domingo a sábado; null = fora do mês. */
  semanas: (CelulaCompartilhada | null)[][];
  diasEmbarcado: number;
  diasFolga: number;
  embarques: string[];
  desembarques: string[];
}

export const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Mês da escala para a imagem (mes 1–12). null sem escala válida. */
export function mesCompartilhado(config: EscalaConfig | null, ano: number, mes: number): MesCompartilhado | null {
  if (!config) return null;
  const ciclo = diasDoCiclo(config);
  if (!ciclo) return null;
  // Só os campos do ciclo: nem aeroporto, nem exceções, nem metadados entram.
  const base: EscalaConfig = { tipo: config.tipo, dataRef: config.dataRef, tipoRef: config.tipoRef, diasEmbarcado: config.diasEmbarcado, diasFolga: config.diasFolga };
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const primeiroDow = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const celulas: (CelulaCompartilhada | null)[] = Array.from({ length: primeiroDow }, () => null);
  const out = { diasEmbarcado: 0, diasFolga: 0, embarques: [] as string[], desembarques: [] as string[] };
  for (let d = 1; d <= diasNoMes; d++) {
    const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const c = calcEscalaISO(base, iso);
    if (!c) return null;
    const primeiro = c.diaDoBloco === 1;
    const cel: CelulaCompartilhada = {
      dia: d, iso, tipo: c.embarcado ? 'EMBARCADO' : 'FOLGA',
      embarque: primeiro && c.embarcado, desembarque: primeiro && !c.embarcado,
    };
    if (c.embarcado) out.diasEmbarcado++; else out.diasFolga++;
    if (cel.embarque) out.embarques.push(iso);
    if (cel.desembarque) out.desembarques.push(iso);
    celulas.push(cel);
  }
  while (celulas.length % 7 !== 0) celulas.push(null);
  const semanas: (CelulaCompartilhada | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return {
    titulo: `${MESES_PT[mes - 1]!.toUpperCase()} ${ano}`,
    ciclo: `${ciclo.dEm} × ${ciclo.dFo}`,
    semanas,
    ...out,
  };
}

/** Nome de arquivo neutro (sem dado pessoal). */
export function nomeArquivoEscala(ano: number, mes: number): string {
  return `minha-escala-${ano}-${String(mes).padStart(2, '0')}.png`;
}
