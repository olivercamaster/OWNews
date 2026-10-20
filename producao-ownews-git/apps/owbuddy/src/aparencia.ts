// Preferência de aparência — regras puras (sem React Native; testadas em Node).
// Guardada numa chave PRÓPRIA (KEYS.APARENCIA): nunca dentro de outro objeto de
// preferências, então gravar/ler a aparência não toca escala, Home, Buddy etc.
import type { TemaEfetivo } from './theme';

export type ModoAparencia = 'auto' | 'escuro' | 'claro';

/** Usuário novo (ou valor ilegível): acompanha o celular. */
export const MODO_APARENCIA_PADRAO: ModoAparencia = 'auto';

export const OPCOES_APARENCIA: ReadonlyArray<{ modo: ModoAparencia; titulo: string; sub: string; icone: 'phone-portrait-outline' | 'moon-outline' | 'sunny-outline' }> = [
  { modo: 'auto',   titulo: 'Automático', sub: 'Usar a aparência do celular', icone: 'phone-portrait-outline' },
  { modo: 'escuro', titulo: 'Escuro',     sub: 'Visual premium navy',          icone: 'moon-outline' },
  { modo: 'claro',  titulo: 'Claro',      sub: 'Visual premium claro',         icone: 'sunny-outline' },
];

/**
 * Lê o valor salvo de forma tolerante: aceita o formato atual ('auto' | 'escuro' | 'claro'),
 * sinônimos de builds/testes antigos ('dark', 'light', 'system'…) e o envelope { modo }.
 * Qualquer outra coisa → Automático (nunca lança, nunca apaga nada).
 */
export function normalizarModoAparencia(raw: unknown): ModoAparencia {
  const v = raw && typeof raw === 'object' && 'modo' in (raw as Record<string, unknown>)
    ? (raw as Record<string, unknown>).modo
    : raw;
  if (typeof v !== 'string') return MODO_APARENCIA_PADRAO;
  switch (v.trim().toLowerCase()) {
    case 'escuro': case 'dark': return 'escuro';
    case 'claro': case 'light': return 'claro';
    case 'auto': case 'automatico': case 'automático': case 'system': case 'sistema': return 'auto';
    default: return MODO_APARENCIA_PADRAO;
  }
}

/** Tema que de fato aparece. Sistema sem preferência conhecida → escuro (identidade OWBuddy). */
export function resolverTema(modo: ModoAparencia, sistema: 'light' | 'dark' | null | undefined): TemaEfetivo {
  if (modo === 'escuro') return 'escuro';
  if (modo === 'claro') return 'claro';
  return sistema === 'light' ? 'claro' : 'escuro';
}

/** Barra de status do celular: ícones claros sobre o escuro, escuros sobre o claro. */
export function estiloStatusBar(tema: TemaEfetivo): 'light' | 'dark' {
  return tema === 'claro' ? 'dark' : 'light';
}
