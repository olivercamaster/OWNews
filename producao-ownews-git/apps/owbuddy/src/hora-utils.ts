export function normalizeHora(raw: string | undefined): string {
  if (!raw) return '';
  const clean = raw.replace(/\D/g, '');
  if (clean.length === 4) {
    const h = clean.slice(0, 2);
    const m = clean.slice(2);
    return `${h}:${m}`;
  }
  if (clean.length === 3) {
    const h = clean.slice(0, 1).padStart(2, '0');
    const m = clean.slice(1);
    return `${h}:${m}`;
  }
  return raw;
}
