// Formatting helpers — keep UI pt-BR, keep storage/API in ISO/UTC

/** YYYY-MM-DD → DD/MM/YYYY */
export function formatDateBR(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** DD/MM/YYYY → YYYY-MM-DD, or null if pattern doesn't match */
export function parseDateBR(brDate: string): string | null {
  const m = brDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** YYYY-MM-DD + "HH:MM" → "DD/MM/YYYY · HH:MM" */
export function formatDateTimeBR(isoDate: string | null | undefined, hora?: string | null): string {
  const d = formatDateBR(isoDate);
  if (!d) return '';
  return hora ? `${d} · ${hora}` : d;
}

/** Returns "Bom dia" / "Boa tarde" / "Boa noite" based on local hour */
export function saudacao(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Formats a timestamp as "HH:MM" in local time */
export function formatHoraBR(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Masks BR date input as user types: auto-inserts "/" after DD and MM */
export function maskDateBR(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Validates a BR date string DD/MM/YYYY */
export function isValidDateBR(br: string): boolean {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000) return false;
  return true;
}
