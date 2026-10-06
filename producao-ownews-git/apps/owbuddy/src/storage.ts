import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EscalaConfig, EscalaOrigem, Certificado, ChecklistData, Viagem, BuddyPrefs, DataPessoal, ViagemFolga, EscalaSecundaria } from '@owbuddy/domain';
import { normalizeEscalaConfig, normalizeEscalasSecundarias, toEscalaEnvelope } from '@owbuddy/domain';
import type { City } from './cities';

// Storage keys — alinhados com OWNews localStorage keys para futura sync Supabase.
// NUNCA renomear: dados de usuários já instalados dependem destes nomes.
export const KEYS = {
  ESCALA:           'ownews_minha_escala',
  CERTS:            'ownews_certificados',
  CHECKLIST:        'ownews_checklist_mala',
  VIAGEM:           'ownews_minha_viagem',
  BUDDY:            'ownews_buddy_prefs',
  CITY:             'owbuddy_city_pref',
  DATAS_PESSOAIS:   'ownews_minha_escala_datas_pessoais',
  VIAGENS_FOLGA:    'owbuddy_viagens_folga',
  ESCALAS_CRUZAR:  'ownews_cruzar_v2',
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

// Escala — envelope versionado { v: 2, data: EscalaConfig, updated_at }.
// Leitura tolerante: aceita v1 ({ data }), o formato plano do OWNews web e
// EscalaConfig cru (ver packages/ow-domain/src/escala-codec.ts). Um valor
// ilegível vira "sem escala" mas NÃO é apagado.
export async function getEscala(): Promise<EscalaConfig | null> {
  const raw = await get<unknown>(KEYS.ESCALA);
  return normalizeEscalaConfig(raw);
}

// Toda gravação vinda das telas é uma edição DESTE aparelho (origem 'dispositivo',
// carimbo = agora). Só o sync grava com origem 'conta' e preserva o carimbo da nuvem —
// assim a cópia local nunca "parece mais nova" do que realmente é.
export async function setEscala(
  cfg: EscalaConfig,
  meta?: { origem?: EscalaOrigem; updatedAt?: string },
): Promise<void> {
  const origem = meta?.origem ?? 'dispositivo';
  await set(KEYS.ESCALA, toEscalaEnvelope({ ...cfg, origem }, meta?.updatedAt));
}

export async function deleteEscala(): Promise<void> {
  await remove(KEYS.ESCALA);
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

// City preference (no GPS required)
export async function getCityPref(): Promise<City | null> {
  return get<City>(KEYS.CITY);
}

export async function setCityPref(city: City): Promise<void> {
  await set(KEYS.CITY, city);
}

// Datas pessoais (aniversários, compromissos, etc.)
export async function getDatasPessoais(): Promise<DataPessoal[]> {
  return (await get<DataPessoal[]>(KEYS.DATAS_PESSOAIS)) ?? [];
}

export async function setDatasPessoais(datas: DataPessoal[]): Promise<void> {
  await set(KEYS.DATAS_PESSOAIS, datas);
}

// Viagens na folga
export async function getViagensFolga(): Promise<ViagemFolga[]> {
  return (await get<ViagemFolga[]>(KEYS.VIAGENS_FOLGA)) ?? [];
}

export async function setViagensFolga(viagens: ViagemFolga[]): Promise<void> {
  await set(KEYS.VIAGENS_FOLGA, viagens);
}

// Escalas secundárias para cruzar — aceita também o formato do OWNews web
// ({ diasEmb, diasFolga, refUTC, ... }) via codec.
export async function getEscalasCruzar(): Promise<EscalaSecundaria[]> {
  return normalizeEscalasSecundarias(await get<unknown>(KEYS.ESCALAS_CRUZAR));
}

export async function setEscalasCruzar(escalas: EscalaSecundaria[]): Promise<void> {
  await set(KEYS.ESCALAS_CRUZAR, escalas);
}
