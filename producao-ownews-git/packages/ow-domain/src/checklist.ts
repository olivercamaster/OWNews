import type { ChecklistData, ChecklistItem } from './types';

// ─── Vocabulário canônico de categorias ────────────────────────────────────
// Adotado em S2 (2026-10-05). Web usa E/P; app usa este vocabulário.
// NUNCA remover uma categoria desta lista — dados armazenados dependem.

export const CATS_CANONICAS = [
  'documentos',
  'epi',
  'roupas',
  'higiene',
  'eletronicos',
  'medicamentos',
  'personalizados',
] as const;

export type CatCanonica = typeof CATS_CANONICAS[number];

export const LABEL_CAT: Record<string, string> = {
  documentos: 'Documentos',
  epi: 'EPI / Trabalho',
  roupas: 'Roupas',
  higiene: 'Higiene',
  eletronicos: 'Eletrônicos',
  medicamentos: 'Medicamentos',
  personalizados: 'Personalizados',
};

export const ICON_CAT: Record<string, string> = {
  documentos: 'document-text-outline',
  epi: 'shield-checkmark-outline',
  roupas: 'shirt-outline',
  higiene: 'water-outline',
  eletronicos: 'phone-portrait-outline',
  medicamentos: 'medkit-outline',
  personalizados: 'star-outline',
};

// Ordem de exibição (mesmo para telas)
export const ORDEM_CATS = CATS_CANONICAS;

/**
 * Normaliza uma categoria legada para o vocabulário canônico.
 * Garante retrocompatibilidade com dados gravados em versões antigas.
 *
 * Legados conhecidos:
 *  saude    → medicamentos  (domínio anterior)
 *  extras   → personalizados (domínio anterior)
 *  custom   → personalizados (addItem padrão anterior)
 *  E        → higiene       (web "essencial")
 *  P        → personalizados (web "pessoal")
 *  Qualquer outra coisa desconhecida → personalizados
 */
export function normalizarCat(cat: string | undefined): string {
  const c = (cat ?? '').toLowerCase().trim();
  if ((CATS_CANONICAS as readonly string[]).includes(c)) return c;
  if (c === 'saude') return 'medicamentos';
  if (c === 'extras') return 'personalizados';
  if (c === 'custom') return 'personalizados';
  if (c === 'e') return 'higiene';
  if (c === 'p') return 'personalizados';
  return 'personalizados';
}

/**
 * Migra categorias legadas em uma ChecklistData sem perder itens.
 * Operação idempotente; segura chamar sempre ao carregar do storage.
 */
export function normalizarChecklistCats(data: ChecklistData): { data: ChecklistData; migrado: boolean } {
  let migrado = false;
  const items = data.items.map(item => {
    const normalizada = normalizarCat(item.cat);
    if (normalizada !== item.cat) {
      migrado = true;
      return { ...item, cat: normalizada };
    }
    return item;
  });
  return { data: migrado ? { ...data, items } : data, migrado };
}

// ─── Itens padrão ─────────────────────────────────────────────────────────
// Representativos e práticos; sem EPI (muito específico por empresa).

export const ITENS_PADRAO: Omit<ChecklistItem, 'ok'>[] = [
  // Documentos
  { id: 'aso',           t: 'ASO (Atestado de Saúde Ocupacional)', cat: 'documentos' },
  { id: 'identidade',    t: 'Identidade / Passaporte',             cat: 'documentos' },
  // Roupas
  { id: 'chinelo',       t: 'Chinelo',                             cat: 'roupas' },
  { id: 'academia',      t: 'Roupa de academia',                   cat: 'roupas' },
  // Higiene
  { id: 'desodorante',   t: 'Desodorante',                         cat: 'higiene' },
  { id: 'escova',        t: 'Escova de dente',                     cat: 'higiene' },
  { id: 'pasta',         t: 'Pasta de dente',                      cat: 'higiene' },
  // Eletrônicos
  { id: 'carregador',    t: 'Carregador',                          cat: 'eletronicos' },
  { id: 'fone',          t: 'Fone de ouvido',                      cat: 'eletronicos' },
  // Medicamentos
  { id: 'medicamentos',  t: 'Medicamentos',                        cat: 'medicamentos' },
  // Personalizados (espaço para o usuário — começa vazio, itens abaixo como exemplo)
  { id: 'chocolate',     t: 'Chocolate',                           cat: 'personalizados', rec: true },
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
 * Vira o ciclo da lista para um novo embarque — mesma regra do OWNews web:
 * itens com `rec:false` saem; demais permanecem com `ok:false`.
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
 * Garante que a lista existe, pertence ao próximo embarque e usa vocabulário canônico.
 * Sem lista → cria padrão. Ciclo diferente → reset. Cats legadas → migra.
 */
export function sincronizarChecklistComCiclo(
  data: ChecklistData | null,
  nextEmbarqueISO: string | null,
): { data: ChecklistData; alterado: boolean; resetado: boolean } {
  if (!data || !Array.isArray(data.items) || data.items.length === 0) {
    return { data: criarChecklistPadrao(nextEmbarqueISO), alterado: true, resetado: false };
  }
  if (nextEmbarqueISO && data.ciclo !== nextEmbarqueISO) {
    const resetada = resetarChecklistParaCiclo(data, nextEmbarqueISO);
    const { data: migrada } = normalizarChecklistCats(resetada);
    return { data: migrada, alterado: true, resetado: true };
  }
  // Mesmo ciclo: apenas migrar cats se necessário
  const { data: migrada, migrado } = normalizarChecklistCats(data);
  return { data: migrada, alterado: migrado, resetado: false };
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

/** Adiciona item customizado; cat padrão = personalizados. */
export function addItem(data: ChecklistData, texto: string, cat = 'personalizados'): ChecklistData {
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
