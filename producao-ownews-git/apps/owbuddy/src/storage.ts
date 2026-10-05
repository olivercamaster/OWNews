import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EscalaConfig, Certificado, ChecklistData, Viagem, BuddyPrefs } from '@owbuddy/domain';

// Storage keys — must match OWNews localStorage keys for future Supabase sync
const KEYS = {
  ESCALA:    'ownews_minha_escala',
  CERTS:     'ownews_certificados',
  CHECKLIST: 'ownews_checklist_mala',
  VIAGEM:    'ownews_minha_viagem',
  BUDDY:     'ownews_buddy_prefs',
} as const;

async function get<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function set(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

// Escala — stored as { data: EscalaConfig }
export async function getEscala(): Promise<EscalaConfig | null> {
  const raw = await get<{ data: EscalaConfig }>(KEYS.ESCALA);
  return raw?.data ?? null;
}

export async function setEscala(cfg: EscalaConfig): Promise<void> {
  await set(KEYS.ESCALA, { data: { ...cfg, updated_at: new Date().toISOString() } });
}

// Certificados
export async function getCerts(): Promise<Certificado[]> {
  return (await get<Certificado[]>(KEYS.CERTS)) ?? [];
}

export async function setCerts(certs: Certificado[]): Promise<void> {
  await set(KEYS.CERTS, certs);
}

// Checklist
export async function getChecklist(): Promise<ChecklistData | null> {
  return get<ChecklistData>(KEYS.CHECKLIST);
}

export async function setChecklist(data: ChecklistData): Promise<void> {
  await set(KEYS.CHECKLIST, data);
}

// Viagem
export async function getViagem(): Promise<Viagem | null> {
  return get<Viagem>(KEYS.VIAGEM);
}

export async function setViagem(v: Viagem): Promise<void> {
  await set(KEYS.VIAGEM, { ...v, updated_at: new Date().toISOString() });
}

export async function deleteViagem(): Promise<void> {
  await remove(KEYS.VIAGEM);
}

// Buddy prefs
export async function getBuddyPrefs(): Promise<BuddyPrefs> {
  const prefs = await get<BuddyPrefs>(KEYS.BUDDY);
  return prefs ?? { tom: 'discreto', trat: 'neutro', apelido: '' };
}

export async function setBuddyPrefs(prefs: BuddyPrefs): Promise<void> {
  await set(KEYS.BUDDY, { ...prefs, updated_at: new Date().toISOString() });
}
