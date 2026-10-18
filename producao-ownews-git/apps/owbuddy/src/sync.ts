/**
 * Sincronização dispositivo ⇄ conta OW (Supabase user_metadata).
 *
 * Chamado pela tela Meu Buddy → Conta OW (login e botão Sincronizar). Conta é
 * OPCIONAL: sem login nada disto roda e o app funciona 100% local.
 * Fala o MESMO dialeto do OWNews web:
 *
 *   escala_config        ← fonte de verdade da Minha Escala (formato plano do web)
 *   ownews_minha_escala  ← legado Buddy (builds antigos)
 *   certificados         ← merge por id, mais recente vence, tombstones _deleted
 *   ownews_checklist_mala← lista do Meu Embarque (só preenche aparelho sem lista)
 *   ownews_buddy_prefs   ← tom/tratamento/apelido, mais recente vence
 *
 * NUNCA sincroniza: Minha Viagem (itinerário é privado — e a cópia parcial que
 * builds antigos enviavam é apagada da conta no próximo sync), eventos/datas
 * pessoais do app, escalas secundárias (Cruzar), cidade, notícias, lembretes.
 *
 * Regras (docs/OW_PLATAFORMA.md): nunca apagar dado do outro lado; nunca
 * sobrescrever uma escala mais nova editada no web; chaves legadas
 * `ownews_minha_escala` / `ownews_certificados` continuam sendo LIDAS.
 */
import type { BuddyPrefs, ChecklistData } from '@owbuddy/domain';
import {
  carimboParaISO,
  carimboParaMs,
  escalaConfigParaNuvem,
  escolherEscalaDaNuvem,
  mesclarCertificados,
  nuvemDeveSubstituirLocal,
  podeGravarEscalaNaNuvem,
} from '@owbuddy/domain';
import { getBuddyPrefs, getCerts, getChecklist, getEscala, setBuddyPrefs, setCerts, setChecklist, setEscala } from './storage';
import { getUserMetadata, mensagemErroConta, updateUserMetadata } from './auth';

// Pull nuvem → local. Nunca destrutivo: só substitui quando a nuvem é mais nova
// ou quando o dispositivo ainda não tem o dado.
export async function pullFromServer(): Promise<void> {
  const meta = await getUserMetadata();
  if (!meta) return;

  const nuvem = escolherEscalaDaNuvem(meta);
  if (nuvem) {
    const local = await getEscala();
    // Regra pura do domínio (nuvemDeveSubstituirLocal): a conta só substitui a
    // escala deste aparelho quando é ESTRITAMENTE mais nova. A cópia gravada
    // carrega o carimbo da NUVEM (não "agora") e origem 'conta' — auditável na
    // tela Minha Escala e nunca inflada para parecer uma edição recente.
    if (nuvemDeveSubstituirLocal(local, nuvem)) {
      await setEscala(nuvem.cfg, { origem: 'conta', updatedAt: carimboParaISO(nuvem.at) });
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
  const [meta, escala, certs, checklist, prefs] = await Promise.all([
    getUserMetadata(),
    getEscala(),
    getCerts(),
    getChecklist(),
    getBuddyPrefs(),
  ]);

  const agora = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: Date.now() };

  if (escala) {
    // Legado Buddy (compatível com builds antigos) — carimbo REAL da edição, não o
    // instante do push: senão cada sync "renova" uma escala antiga e ela passa a
    // vencer de uma edição mais recente feita em outro lugar.
    patch.ownews_minha_escala = { data: escala, updated_at: escala.updated_at ?? agora };
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
  // Viagem nunca vai para a conta; remove a cópia parcial de builds antigos.
  if (meta && meta.ownews_minha_viagem != null) patch.ownews_minha_viagem = null;
  if (prefs) patch.ownews_buddy_prefs = prefs;

  return updateUserMetadata(patch);
}

// Full sync: pull first (nuvem mais nova vence), then push deltas.
// Falha (rede, sessão expirada) nunca apaga nem altera dado local.
export async function syncAll(): Promise<{ error: string | null }> {
  try {
    await pullFromServer();
    return await pushToServer();
  } catch (e) {
    return { error: mensagemErroConta({ message: e instanceof Error ? e.message : 'network' }) };
  }
}
