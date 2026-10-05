/**
 * Sincronização dispositivo ⇄ conta OW (Supabase user_metadata).
 *
 * AINDA NÃO é chamado por nenhuma tela (login no Buddy é opcional e não há
 * fluxo de conta ativo). Está aqui para que, quando a conta única OW entrar no
 * app, o Buddy fale o MESMO dialeto do OWNews web:
 *
 *   escala_config  ← fonte de verdade da Minha Escala (formato plano do web)
 *   certificados   ← merge por id, mais recente vence, tombstones _deleted
 *
 * Regras (docs/OW_PLATAFORMA.md): nunca apagar dado do outro lado; nunca
 * sobrescrever uma escala mais nova editada no web; chaves legadas
 * `ownews_minha_escala` / `ownews_certificados` continuam sendo LIDAS.
 */
import type { BuddyPrefs, ChecklistData, Viagem } from '@owbuddy/domain';
import {
  carimboParaMs,
  escalaConfigParaNuvem,
  escolherEscalaDaNuvem,
  mesclarCertificados,
  podeGravarEscalaNaNuvem,
} from '@owbuddy/domain';
import { getBuddyPrefs, getCerts, getChecklist, getEscala, getViagem, setBuddyPrefs, setCerts, setChecklist, setEscala } from './storage';
import { getUserMetadata, updateUserMetadata } from './auth';

// Campos sensíveis que NUNCA saem do dispositivo
const PRIVATE_VIAGEM_FIELDS: Array<keyof Viagem> = ['localizador', 'obs', 'assento', 'poltrona'];

function stripPrivateViagemFields(v: Viagem | null | undefined): Partial<Viagem> | null {
  if (!v) return null;
  const safe = { ...v };
  for (const field of PRIVATE_VIAGEM_FIELDS) {
    delete safe[field];
  }
  return safe;
}

// Pull nuvem → local. Nunca destrutivo: só substitui quando a nuvem é mais nova
// ou quando o dispositivo ainda não tem o dado.
export async function pullFromServer(): Promise<void> {
  const meta = await getUserMetadata();
  if (!meta) return;

  const nuvem = escolherEscalaDaNuvem(meta);
  if (nuvem) {
    const local = await getEscala();
    if (!local || nuvem.at > carimboParaMs(local.updated_at)) {
      await setEscala(nuvem.cfg);
    }
  }

  const localCerts = await getCerts();
  const merged = mesclarCertificados(localCerts, meta.certificados, meta.ownews_certificados);
  if (merged.length !== localCerts.length || merged.some((c, i) => c !== localCerts[i])) {
    await setCerts(merged);
  }

  const serverChecklist = meta.ownews_checklist_mala as ChecklistData | null | undefined;
  if (serverChecklist?.items && !(await getChecklist())) {
    await setChecklist(serverChecklist);
  }

  const serverPrefs = meta.ownews_buddy_prefs as BuddyPrefs | null | undefined;
  if (serverPrefs) {
    const localPrefs = await getBuddyPrefs(); // nunca null (devolve padrão sem updated_at)
    if (carimboParaMs(serverPrefs.updated_at) > carimboParaMs(localPrefs.updated_at)) {
      await setBuddyPrefs(serverPrefs);
    }
  }
}

// Push local → nuvem (PATCH: chaves ausentes aqui são mantidas pelo GoTrue)
export async function pushToServer(): Promise<{ error: string | null }> {
  const [meta, escala, certs, checklist, viagem, prefs] = await Promise.all([
    getUserMetadata(),
    getEscala(),
    getCerts(),
    getChecklist(),
    getViagem(),
    getBuddyPrefs(),
  ]);

  const agora = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: Date.now() };

  if (escala) {
    // Legado Buddy (compatível com builds antigos) …
    patch.ownews_minha_escala = { data: escala, updated_at: agora };
    // … e o formato que o OWNews web lê — só quando não há escala mais nova na nuvem.
    if (podeGravarEscalaNaNuvem(escala, escolherEscalaDaNuvem(meta))) {
      patch.escala_config = escalaConfigParaNuvem(escala, escala.updated_at ?? agora);
    }
  }
  if (certs.length > 0) {
    // Mesma chave do web; inclui tombstones para a remoção propagar.
    patch.certificados = mesclarCertificados(certs, meta?.certificados, meta?.ownews_certificados);
  }
  if (checklist?.ciclo) patch.ownews_checklist_mala = checklist;
  const safeViagem = stripPrivateViagemFields(viagem);
  if (safeViagem) patch.ownews_minha_viagem = safeViagem;
  if (prefs) patch.ownews_buddy_prefs = prefs;

  return updateUserMetadata(patch);
}

// Full sync: pull first (nuvem mais nova vence), then push deltas
export async function syncAll(): Promise<{ error: string | null }> {
  try {
    await pullFromServer();
    return pushToServer();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Sync error' };
  }
}
