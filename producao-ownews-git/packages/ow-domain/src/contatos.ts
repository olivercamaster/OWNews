/**
 * Contatos do embarque — lista pequena e PRIVADA (logística, hotel, agência...).
 * Fica só no aparelho: não sincroniza, não vai para analytics, nunca aparece em
 * notificação nem no compartilhamento da escala. Aqui só regras puras.
 */

export type ContatoTipo = 'LOGISTICA' | 'HOTEL' | 'AGENCIA' | 'SUPERVISOR' | 'RH' | 'BASE' | 'OUTRO';

export interface ContatoEmbarque {
  id: string;
  nome: string;
  tipo: ContatoTipo;
  telefone: string;
  obs?: string;
  updated_at?: string;
}

export const CONTATO_TIPOS: ReadonlyArray<{ value: ContatoTipo; label: string }> = [
  { value: 'LOGISTICA', label: 'Logística' },
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'AGENCIA', label: 'Agência' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'RH', label: 'RH' },
  { value: 'BASE', label: 'Base' },
  { value: 'OUTRO', label: 'Outro' },
];

export function labelTipoContato(t: ContatoTipo): string {
  return CONTATO_TIPOS.find(x => x.value === t)?.label ?? 'Outro';
}

/** Só dígitos (mantém o + inicial de número internacional). */
export function digitosTelefone(tel: string): string {
  const t = (tel ?? '').trim();
  return (t.startsWith('+') ? '+' : '') + t.replace(/\D/g, '');
}

/** Telefone utilizável para ligar: 8 a 15 dígitos (fixo, celular, 0800, internacional). */
export function telefoneValido(tel: string): boolean {
  const n = digitosTelefone(tel).replace('+', '').length;
  return n >= 8 && n <= 15;
}

/** "tel:" — abre o discador com o número; não liga sozinho. */
export function linkLigar(tel: string): string | null {
  return telefoneValido(tel) ? `tel:${digitosTelefone(tel)}` : null;
}

/**
 * Link oficial do WhatsApp (wa.me) — só abre a conversa, SEM texto pré-preenchido.
 * Número brasileiro com DDD (10–11 dígitos) ganha o 55; com + usa o código informado.
 * Fixo sem DDD, 0800 e números curtos não têm WhatsApp → null.
 */
export function linkWhatsApp(tel: string): string | null {
  const d = digitosTelefone(tel);
  if (!telefoneValido(d) || d.replace('+', '').startsWith('0')) return null;
  let n = d.replace('+', '');
  if (!d.startsWith('+')) {
    if (n.length === 10 || n.length === 11) n = '55' + n;
    else if (!(n.startsWith('55') && (n.length === 12 || n.length === 13))) return null;
  }
  return `https://wa.me/${n}`;
}

/** "(22) 99999-1234" para exibição (mantém o texto original quando não é BR). */
export function formatarTelefone(tel: string): string {
  const d = digitosTelefone(tel);
  if (d.startsWith('+')) return tel.trim();
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel.trim();
}

/** Mensagem humana ou null. */
export function validarContato(c: Partial<ContatoEmbarque>): string | null {
  if (!c.nome?.trim()) return 'Dê um nome ao contato (ex.: Logística Macaé).';
  if (!c.telefone?.trim()) return 'Informe o telefone.';
  if (!telefoneValido(c.telefone)) return 'Esse telefone parece incompleto. Inclua o DDD.';
  return null;
}

const TIPOS = new Set(CONTATO_TIPOS.map(t => t.value));

/** Leitura tolerante do armazenamento: descarta lixo, nunca lança. */
export function normalizarContatos(raw: unknown): ContatoEmbarque[] {
  if (!Array.isArray(raw)) return [];
  const out: ContatoEmbarque[] = [];
  const ids = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const c = r as Record<string, unknown>;
    if (typeof c.id !== 'string' || !c.id || ids.has(c.id)) continue;
    if (typeof c.nome !== 'string' || typeof c.telefone !== 'string') continue;
    ids.add(c.id);
    out.push({
      id: c.id,
      nome: c.nome,
      tipo: TIPOS.has(c.tipo as ContatoTipo) ? (c.tipo as ContatoTipo) : 'OUTRO',
      telefone: c.telefone,
      obs: typeof c.obs === 'string' && c.obs ? c.obs : undefined,
      updated_at: typeof c.updated_at === 'string' ? c.updated_at : undefined,
    });
  }
  return out;
}

/** Cria ou atualiza (por id). Sem id → novo. */
export function salvarContato(lista: ContatoEmbarque[], c: Omit<ContatoEmbarque, 'id'> & { id?: string }, agoraISO: string = new Date().toISOString()): ContatoEmbarque[] {
  const limpo = { nome: c.nome.trim(), tipo: c.tipo, telefone: c.telefone.trim(), obs: c.obs?.trim() || undefined, updated_at: agoraISO };
  if (c.id && lista.some(x => x.id === c.id)) return lista.map(x => (x.id === c.id ? { ...x, ...limpo } : x));
  let id: string;
  do id = 'ct_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  while (lista.some(x => x.id === id));
  return [...lista, { id, ...limpo }];
}

export function removerContato(lista: ContatoEmbarque[], id: string): ContatoEmbarque[] {
  return lista.filter(x => x.id !== id);
}
