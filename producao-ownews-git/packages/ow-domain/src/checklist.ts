import type { ChecklistData, ChecklistItem, EscalaResumo } from './types';

/** Dia LOCAL "YYYY-MM-DD" (mesma regra de escala.ts/hojeISO; local para manter este módulo sem dependências). */
function hojeLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
 * Embarque para o qual a mala está sendo preparada. No PRÓPRIO dia do embarque
 * (embarcado, Dia 1) ainda é o de hoje — a pessoa costuma conferir a mala nessa
 * manhã; a partir do Dia 2 passa a ser o próximo (após a folga).
 */
export function cicloAlvoChecklist(resumo: EscalaResumo): string | null {
  if (resumo.estado === 'EMBARCADO' && resumo.calc?.diaDoBloco === 1) return resumo.hojeISO;
  return resumo.proximoEmbarqueISO;
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
 * Garante que a lista existe, pertence ao embarque-alvo e usa vocabulário canônico.
 *
 * O reset (desmarcar recorrentes, tirar os "só deste embarque") só acontece quando o
 * embarque da lista JÁ PASSOU — `ciclo` anterior ao alvo e anterior a hoje. Abrir o app,
 * editar a escala ou um relógio voltado para trás nunca apagam marcações:
 *   - sem lista            → cria padrão
 *   - lista sem ciclo      → adota o alvo, marcações intactas
 *   - alvo mais adiante e o embarque da lista já começou → reset (novo ciclo)
 *   - alvo mais adiante, embarque da lista ainda por vir (escala editada) → só re-chaveia
 *   - alvo ANTES do ciclo da lista (relógio/escala para trás) → nada muda
 */
export function sincronizarChecklistComCiclo(
  data: ChecklistData | null,
  alvoISO: string | null,
  hoje: string = hojeLocal(),
): { data: ChecklistData; alterado: boolean; resetado: boolean } {
  // Lista vazia é escolha do usuário (ocultou tudo) — não recria; "Restaurar itens padrão" traz de volta.
  if (!data || !Array.isArray(data.items)) {
    return { data: criarChecklistPadrao(alvoISO), alterado: true, resetado: false };
  }
  const { data: migrada, migrado } = normalizarChecklistCats(data);
  if (!alvoISO || migrada.ciclo === alvoISO) return { data: migrada, alterado: migrado, resetado: false };
  if (migrada.ciclo && migrada.ciclo > alvoISO) return { data: migrada, alterado: migrado, resetado: false };
  if (migrada.ciclo && migrada.ciclo < hoje) {
    return { data: resetarChecklistParaCiclo(migrada, alvoISO), alterado: true, resetado: true };
  }
  return { data: { ...migrada, ciclo: alvoISO }, alterado: true, resetado: false };
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

/** Id único mesmo com dois toques no mesmo milissegundo. */
function novoIdItem(data: ChecklistData): string {
  let id: string;
  do id = 'custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  while (data.items.some(i => i.id === id));
  return id;
}

export const QTD_MAX_ITEM = 99;

/** Quantidade válida (1–99, inteira); qualquer outra coisa vira 1. */
export function normalizarQtd(q: unknown): number {
  const n = typeof q === 'number' ? Math.floor(q) : typeof q === 'string' ? parseInt(q, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.min(n, QTD_MAX_ITEM) : 1;
}

/** Quantidade do item (ausente = 1). */
export function qtdItem(item: ChecklistItem): number {
  return normalizarQtd(item.q);
}

/** Grava a quantidade só quando passa de 1 — a lista continua igual à do OWNews web. */
function comQtd(item: ChecklistItem, q: number | undefined): ChecklistItem {
  if (q === undefined) return item;
  const n = normalizarQtd(q);
  const novo = { ...item };
  if (n > 1) novo.q = n; else delete novo.q;
  return novo;
}

/**
 * Adiciona item personalizado (cat padrão = personalizados). `todoEmbarque` = levar em
 * todo embarque (recorrente, padrão); false = só neste embarque (sai na virada do ciclo).
 * Texto vazio ou repetido (mesmo nome, ignorando maiúsculas) não duplica.
 */
export function addItem(data: ChecklistData, texto: string, cat = 'personalizados', todoEmbarque = true, quantidade?: number): ChecklistData {
  const t = texto.trim();
  if (!t || data.items.some(i => i.t.trim().toLowerCase() === t.toLowerCase())) return data;
  let item: ChecklistItem = { id: novoIdItem(data), t, cat, ok: false };
  if (!todoEmbarque) item.rec = false;
  item = comQtd(item, quantidade);
  return { ...data, items: [...data.items, item] };
}

/** Item vale para todos os embarques? (ausente = sim, regra do web). */
export function ehRecorrente(item: ChecklistItem): boolean {
  return item.rec !== false;
}

export function removeItem(data: ChecklistData, id: string): ChecklistData {
  return {
    ...data,
    items: data.items.filter(item => item.id !== id),
  };
}

/**
 * Renomeia um item (texto vazio = sem mudança) e, se informados, muda "todo embarque" e a
 * quantidade. Vale também para item padrão: o id continua o mesmo, então a edição da pessoa
 * nunca é desfeita por "Restaurar itens padrão" nem pela virada do ciclo.
 */
export function editarItem(data: ChecklistData, id: string, texto: string, todoEmbarque?: boolean, quantidade?: number): ChecklistData {
  const t = texto.trim();
  if (!t) return data;
  return {
    ...data,
    items: data.items.map(item => {
      if (item.id !== id) return item;
      const novo: ChecklistItem = comQtd({ ...item, t }, quantidade);
      if (todoEmbarque === true) delete novo.rec;
      else if (todoEmbarque === false) novo.rec = false;
      return novo;
    }),
  };
}

/**
 * Sobe (-1) ou desce (+1) o item uma posição DENTRO da categoria dele (a tela agrupa por
 * categoria). Na ponta, nada muda. Os outros itens não saem do lugar.
 */
export function moverItem(data: ChecklistData, id: string, direcao: -1 | 1): ChecklistData {
  const idx = data.items.findIndex(i => i.id === id);
  if (idx < 0) return data;
  const cat = normalizarCat(data.items[idx]!.cat);
  let alvo = idx + direcao;
  while (alvo >= 0 && alvo < data.items.length && normalizarCat(data.items[alvo]!.cat) !== cat) alvo += direcao;
  if (alvo < 0 || alvo >= data.items.length) return data;
  const items = data.items.slice();
  [items[idx], items[alvo]] = [items[alvo]!, items[idx]!];
  return { ...data, items };
}

/** Posição do item dentro da categoria: pode subir / pode descer. */
export function podeMoverItem(data: ChecklistData, id: string): { subir: boolean; descer: boolean } {
  const item = data.items.find(i => i.id === id);
  if (!item) return { subir: false, descer: false };
  const mesmos = data.items.filter(i => normalizarCat(i.cat) === normalizarCat(item.cat));
  const pos = mesmos.indexOf(item);
  return { subir: pos > 0, descer: pos >= 0 && pos < mesmos.length - 1 };
}

/** "8 de 11 itens prontos" / "Mala pronta" / "Lista vazia". */
export function progressoMala(data: ChecklistData): { total: number; feitos: number; pendentes: number; texto: string } {
  const { total, feitos, pendentes } = contarPendentes(data);
  const texto = total === 0 ? 'Lista vazia'
    : pendentes === 0 ? 'Mala pronta'
    : `${feitos} de ${total} ${total === 1 ? 'item pronto' : 'itens prontos'}`;
  return { total, feitos, pendentes, texto };
}

/** Reset controlado: desmarca tudo, mantém os itens e o ciclo. */
export function desmarcarTodos(data: ChecklistData): ChecklistData {
  return { ...data, items: data.items.map(item => (item.ok ? { ...item, ok: false } : item)) };
}

// ─── Itens padrão: ocultar / restaurar ─────────────────────────────────────
// O catálogo base (ITENS_PADRAO) nunca é alterado. "Ocultar" um item padrão é
// tirá-lo da lista pessoal (mesmo formato {items, ciclo} do OWNews web);
// "Restaurar" devolve os que faltam, desmarcados, na ordem do catálogo.

const IDS_PADRAO = new Set(ITENS_PADRAO.map(i => i.id));

export function ehItemPadrao(id: string): boolean {
  return IDS_PADRAO.has(id);
}

/** Quantos itens do catálogo padrão não estão na lista pessoal. */
export function contarPadraoOcultos(data: ChecklistData): number {
  const presentes = new Set(data.items.map(i => i.id));
  return ITENS_PADRAO.filter(i => !presentes.has(i.id)).length;
}

/** Devolve à lista os itens padrão ocultos; personalizados e marcações ficam intactos. */
export function restaurarItensPadrao(data: ChecklistData): ChecklistData {
  const presentes = new Set(data.items.map(i => i.id));
  const faltando = ITENS_PADRAO.filter(i => !presentes.has(i.id)).map(i => ({ ...i, ok: false }));
  if (faltando.length === 0) return data;
  return { ...data, items: [...data.items, ...faltando] };
}
