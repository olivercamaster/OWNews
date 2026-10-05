import type { ChecklistData, ChecklistItem } from './types';

export const ITENS_PADRAO: Omit<ChecklistItem, 'ok'>[] = [
  { id: 'desodorante',  t: 'Desodorante',        cat: 'higiene' },
  { id: 'escova',       t: 'Escova de dente',     cat: 'higiene' },
  { id: 'pasta',        t: 'Pasta de dente',      cat: 'higiene' },
  { id: 'medicamentos', t: 'Medicamentos',        cat: 'saude' },
  { id: 'carregador',   t: 'Carregador',          cat: 'eletronicos' },
  { id: 'fone',         t: 'Fone de ouvido',      cat: 'eletronicos' },
  { id: 'chinelo',      t: 'Chinelo',             cat: 'roupas' },
  { id: 'academia',     t: 'Roupa de academia',   cat: 'roupas' },
  { id: 'chocolate',    t: 'Chocolate',           cat: 'extras' },
  { id: 'cafe',         t: 'Café',                cat: 'extras' },
];

export function criarChecklistPadrao(ciclo: string | null): ChecklistData {
  return {
    items: ITENS_PADRAO.map(item => ({ ...item, ok: false })),
    ciclo,
  };
}

export function deveResetarChecklist(data: ChecklistData, nextEmbarqueISO: string): boolean {
  return data.ciclo !== nextEmbarqueISO;
}

/**
 * Vira o ciclo da lista para um novo embarque — mesma regra do OWNews web
 * (renderPage em /meu-embarque): itens continuam (NUNCA são perdidos), só o
 * `ok` volta para false; itens marcados `rec:false` ("somente este embarque")
 * saem da lista.
 */
export function resetarChecklistParaCiclo(data: ChecklistData, cicloISO: string): ChecklistData {
  return {
    items: data.items
      .filter(i => i.rec !== false)
      .map(i => ({ ...i, ok: false })),
    ciclo: cicloISO,
  };
}

/**
 * Garante que a lista existe e pertence ao próximo embarque.
 * - sem lista salva → cria a padrão (ciclo = próximo embarque ou null)
 * - lista com ciclo diferente do próximo embarque → reset (regra do web)
 * - sem escala (nextEmbarqueISO null) → mantém a lista como está, sem churn
 */
export function sincronizarChecklistComCiclo(
  data: ChecklistData | null,
  nextEmbarqueISO: string | null,
): { data: ChecklistData; alterado: boolean; resetado: boolean } {
  if (!data || !Array.isArray(data.items) || data.items.length === 0) {
    return { data: criarChecklistPadrao(nextEmbarqueISO), alterado: true, resetado: false };
  }
  if (nextEmbarqueISO && data.ciclo !== nextEmbarqueISO) {
    return { data: resetarChecklistParaCiclo(data, nextEmbarqueISO), alterado: true, resetado: true };
  }
  return { data, alterado: false, resetado: false };
}

export function contarPendentes(data: ChecklistData): { total: number; feitos: number; pendentes: number } {
  const total = data.items.length;
  const feitos = data.items.filter(i => i.ok).length;
  return { total, feitos, pendentes: total - feitos };
}

export function toggleItem(data: ChecklistData, id: string): ChecklistData {
  return {
    ...data,
    items: data.items.map(item =>
      item.id === id ? { ...item, ok: !item.ok } : item
    ),
  };
}

export function addItem(data: ChecklistData, texto: string, cat = 'custom'): ChecklistData {
  const id = 'custom_' + Date.now();
  return {
    ...data,
    items: [...data.items, { id, t: texto, cat, ok: false }],
  };
}

export function removeItem(data: ChecklistData, id: string): ChecklistData {
  return {
    ...data,
    items: data.items.filter(item => item.id !== id),
  };
}
