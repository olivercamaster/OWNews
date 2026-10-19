/**
 * Notificações LOCAIS do OWBuddy (expo-notifications). Não há push remoto:
 * nenhum servidor, nenhum token, nenhum dado sai do aparelho para agendar.
 *
 * Fluxo:
 *  - desligado por padrão; o usuário liga em Meu Buddy → Lembretes, e só então
 *    o sistema pede permissão;
 *  - replanejarLembretes() cancela TUDO o que o app agendou e agenda de novo a
 *    lista de planejarLembretes() (domínio puro, testado). É chamado ao abrir o
 *    app, ao voltar para ele e depois de salvar escala/checklist/certs/viagem;
 *  - tocar na notificação abre a rota do app (data.rota).
 * Sem permissão (negada/não suportada) tudo segue funcionando; nada é bloqueado.
 *
 * Requer BUILD NATIVO com expo-notifications (versionCode 12+). Em binários
 * antigos o módulo nativo não existe: todas as funções viram no-op seguras.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { planejarLembretes, dataDoInstante, PREFS_LEMBRETES_PADRAO } from '@owbuddy/domain';
import type { PrefsLembretes } from '@owbuddy/domain';
import { getCerts, getChecklist, getEscala, getEventosPessoais, getPagamento, getViagem } from './storage';
import { analytics } from './analytics';

type NotificationsModule = typeof import('expo-notifications');

const PREFS_KEY = 'owbuddy_lembretes_prefs';
const CANAL = 'lembretes';
const ROTAS_PERMITIDAS = ['/escala', '/mala', '/viagem', '/certs', '/proximos', '/pagamento'];

let mod: NotificationsModule | null | undefined;

/** Carrega o módulo nativo só se existir neste binário (OTA em build antigo não quebra). */
function N(): NotificationsModule | null {
  if (mod !== undefined) return mod;
  if (Platform.OS === 'web') return (mod = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('expo-notifications') as NotificationsModule;
  } catch {
    mod = null;
  }
  return mod;
}

export function notificacoesDisponiveis(): boolean {
  return N() !== null;
}

export async function getPrefsLembretes(): Promise<PrefsLembretes> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? { ...PREFS_LEMBRETES_PADRAO, ...JSON.parse(raw) } : { ...PREFS_LEMBRETES_PADRAO };
  } catch {
    return { ...PREFS_LEMBRETES_PADRAO };
  }
}

export async function setPrefsLembretes(p: PrefsLembretes): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {}
}

export type EstadoPermissao = 'concedida' | 'negada' | 'nao_perguntada' | 'indisponivel';

export async function estadoPermissao(): Promise<EstadoPermissao> {
  const n = N();
  if (!n) return 'indisponivel';
  try {
    const s = await n.getPermissionsAsync();
    if (s.granted || s.ios?.status === n.IosAuthorizationStatus.PROVISIONAL) return 'concedida';
    return s.canAskAgain ? 'nao_perguntada' : 'negada';
  } catch {
    return 'indisponivel';
  }
}

async function garantirCanal(n: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await n.setNotificationChannelAsync(CANAL, {
    name: 'Lembretes do OWBuddy',
    description: 'Escala, viagem, Meu Embarque, certificados, datas importantes e pagamento',
    importance: n.AndroidImportance.DEFAULT,
  });
}

/** Pede permissão (Android 13+ / iOS). Devolve o estado final. */
export async function pedirPermissao(): Promise<EstadoPermissao> {
  const n = N();
  if (!n) return 'indisponivel';
  try {
    await garantirCanal(n); // Android 13+: o diálogo só aparece com um canal criado
    const atual = await n.getPermissionsAsync();
    if (atual.granted) return 'concedida';
    const s = await n.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    return s.granted ? 'concedida' : s.canAskAgain ? 'nao_perguntada' : 'negada';
  } catch {
    return 'indisponivel';
  }
}

/**
 * Cancela o que o app agendou e agenda de novo. Nunca lança.
 * Devolve quantos lembretes ficaram agendados.
 */
export async function replanejarLembretes(): Promise<number> {
  const n = N();
  if (!n) return 0;
  try {
    const prefs = await getPrefsLembretes();
    await n.cancelAllScheduledNotificationsAsync();
    if (!prefs.ativo || (await estadoPermissao()) !== 'concedida') return 0;
    await garantirCanal(n);
    const [escala, checklist, certs, viagem, eventos, pagamento] = await Promise.all([
      getEscala(), getChecklist(), getCerts(), getViagem(), getEventosPessoais(), getPagamento(),
    ]);
    const plano = planejarLembretes({ escala, checklist, certs, viagem, eventos, pagamento, prefs });
    for (const l of plano) {
      await n.scheduleNotificationAsync({
        identifier: l.id,
        content: { title: l.titulo, body: l.corpo, data: { rota: l.rota } },
        trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: dataDoInstante(l.quando), channelId: CANAL },
      });
    }
    return plano.length;
  } catch {
    return 0;
  }
}

/** Desliga tudo (interruptor geral). */
export async function desligarLembretes(): Promise<void> {
  const prefs = await getPrefsLembretes();
  await setPrefsLembretes({ ...prefs, ativo: false });
  const n = N();
  if (n) await n.cancelAllScheduledNotificationsAsync().catch(() => {});
}

function abrirRota(data: unknown): void {
  const rota = (data as { rota?: unknown } | null)?.rota;
  if (typeof rota === 'string' && ROTAS_PERMITIDAS.includes(rota)) {
    analytics.track('lembrete_aberto', { rota });
    router.push(rota as never);
  }
}

/**
 * Instala o handler (mostrar com o app aberto) e o listener de toque.
 * Chamar uma vez no layout raiz; devolve a função de limpeza.
 */
export function instalarNotificacoes(): () => void {
  const n = N();
  if (!n) return () => {};
  try {
    n.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const sub = n.addNotificationResponseReceivedListener(resp => {
      abrirRota(resp.notification.request.content.data);
    });
    // App aberto a partir de uma notificação com o app fechado (cold start)
    n.getLastNotificationResponseAsync()
      .then(resp => {
        if (resp) {
          abrirRota(resp.notification.request.content.data);
          n.clearLastNotificationResponseAsync?.().catch(() => {});
        }
      })
      .catch(() => {});
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
