/**
 * Rede do OWBuddy — um único jeito de chamar a internet.
 *
 * - Timeout com AbortController + setTimeout (AbortSignal.timeout não é
 *   garantido no Hermes; quando faltava, o fetch lançava e o app caía
 *   direto no estado "offline").
 * - Nunca lança: devolve { ok:false, motivo } para a tela decidir a mensagem.
 */
export type RespostaJson<T> =
  | { ok: true; data: T }
  | { ok: false; motivo: 'offline' | 'timeout' | 'http' | 'formato'; status?: number };

export const TIMEOUT_PADRAO_MS = 10_000;

export async function buscarJson<T>(url: string, timeoutMs = TIMEOUT_PADRAO_MS): Promise<RespostaJson<T>> {
  const ctrl = new AbortController();
  let estourou = false;
  const timer = setTimeout(() => { estourou = true; ctrl.abort(); }, timeoutMs);
  try {
    const resp = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!resp.ok) return { ok: false, motivo: 'http', status: resp.status };
    try {
      return { ok: true, data: (await resp.json()) as T };
    } catch {
      return { ok: false, motivo: 'formato' };
    }
  } catch {
    return { ok: false, motivo: estourou ? 'timeout' : 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

/** Só abre http(s) — URL vinda da API nunca dispara outro esquema (intent:, javascript:, file:). */
export function urlExternaSegura(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const u = url.trim();
  return /^https?:\/\/[^\s]+$/i.test(u) ? u : null;
}
