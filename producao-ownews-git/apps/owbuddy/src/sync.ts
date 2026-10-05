import type { BuddyPrefs, Certificado, ChecklistData, EscalaConfig, Viagem } from '@owbuddy/domain';
import { getBuddyPrefs, getCerts, getChecklist, getEscala, getViagem, setBuddyPrefs, setCerts, setChecklist, setEscala, setViagem } from './storage';
import { getUserMetadata, updateUserMetadata } from './auth';

// Campos sensíveis que NUNCA saem do dispositivo
const PRIVATE_VIAGEM_FIELDS: Array<keyof Viagem> = ['localizador', 'obs', 'assento', 'poltrona'];

type SyncableData = {
  escala?: EscalaConfig | null;
  certificados?: Certificado[];
  checklist_mala?: ChecklistData;
  viagem?: Partial<Viagem> | null;
  buddy_prefs?: BuddyPrefs;
  updated_at?: number;
};

function stripPrivateViagemFields(v: Viagem | null | undefined): Partial<Viagem> | null {
  if (!v) return null;
  const safe = { ...v };
  for (const field of PRIVATE_VIAGEM_FIELDS) {
    delete safe[field];
  }
  return safe;
}

// Pull from server → merge with local (server wins on newer updated_at)
export async function pullFromServer(): Promise<void> {
  const meta = await getUserMetadata();
  if (!meta) return;

  const serverUpdatedAt = (meta.updated_at as number) ?? 0;
  const localUpdatedAt = Date.now(); // will compare per-field

  const serverEscala = meta.ownews_minha_escala as { data: EscalaConfig; updated_at: number } | null;
  if (serverEscala?.data) {
    const localEscala = await getEscala();
    const localAt = (localEscala as unknown as { updated_at?: number })?.updated_at ?? 0;
    if ((serverEscala.updated_at ?? 0) > localAt) {
      await setEscala(serverEscala.data);
    }
  }

  const serverCerts = meta.ownews_certificados as Certificado[] | null;
  if (Array.isArray(serverCerts)) {
    await setCerts(serverCerts);
  }

  const serverChecklist = meta.ownews_checklist_mala as ChecklistData | null;
  if (serverChecklist) {
    await setChecklist(serverChecklist);
  }

  const serverPrefs = meta.ownews_buddy_prefs as BuddyPrefs | null;
  if (serverPrefs) {
    await setBuddyPrefs(serverPrefs);
  }
}

// Push local → server (merge: server fields not present locally are kept)
export async function pushToServer(): Promise<{ error: string | null }> {
  const [escala, certs, checklist, viagem, prefs] = await Promise.all([
    getEscala(),
    getCerts(),
    getChecklist(),
    getViagem(),
    getBuddyPrefs(),
  ]);

  const safeViagem = stripPrivateViagemFields(viagem);

  const patch: Record<string, unknown> = {
    updated_at: Date.now(),
  };

  if (escala) patch.ownews_minha_escala = { data: escala, updated_at: Date.now() };
  if (certs.length > 0) patch.ownews_certificados = certs;
  if (checklist?.ciclo) patch.ownews_checklist_mala = checklist;
  if (safeViagem) patch.ownews_minha_viagem = safeViagem;
  if (prefs) patch.ownews_buddy_prefs = prefs;

  return updateUserMetadata(patch);
}

// Full sync: pull first (server wins on conflict), then push deltas
export async function syncAll(): Promise<{ error: string | null }> {
  try {
    await pullFromServer();
    return pushToServer();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Sync error' };
  }
}
