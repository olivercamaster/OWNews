/**
 * OWBuddy+ na loja de verdade — Google Play Billing (Android) e StoreKit 2 (iOS) via expo-iap.
 *
 * - Sem servidor próprio e sem serviço de terceiros: a conversa é só entre o aparelho e a loja.
 * - Nenhuma chave, segredo ou token vai no app; nada de compra é enviado ao OWNews/Supabase.
 * - Compra concluída é confirmada (acknowledge/finish) aqui, senão a Google Play estorna em 3 dias.
 * - Pagamento pendente (ex.: boleto) NÃO libera nada até a loja confirmar.
 */
import { Linking, Platform } from 'react-native';
import * as IAP from 'expo-iap';
import type { Purchase, ProductSubscription } from 'expo-iap';
import {
  PRODUTOS_OFERECIDOS, PRODUTOS_QUE_DAO_PLUS, PRODUTO_PLUS_MENSAL, produtoAndroid, produtoIOS,
} from '@owbuddy/domain';
import type { AssinaturaAndroidLoja, AssinaturaIOSLoja, ConsultaLoja, ProdutoPlus } from '@owbuddy/domain';
import type { ConsultaProduto, LojaPlus, MotivoErroLoja, ResultadoCompra, ResultadoRestaurar } from './loja';

const PACOTE_ANDROID = 'br.com.ownews.owbuddy';

let conexao: Promise<boolean> | null = null;
let pendenteCompra: ((r: ResultadoCompra) => void) | null = null;
const ouvintes = new Set<() => void>();

function motivoDoErro(e: unknown): MotivoErroLoja {
  const code = String((e as { code?: unknown })?.code ?? '');
  if (/network|service-disconnected|service-timeout|connection-closed/.test(code)) return 'offline';
  if (/billing-unavailable|iap-not-available|feature-not-supported/.test(code)) return 'indisponivel';
  return 'loja';
}

async function finalizar(p: Purchase): Promise<void> {
  try { await IAP.finishTransaction({ purchase: p, isConsumable: false }); } catch { /* a loja reapresenta depois */ }
}

function ehNossa(p: { productId?: string | null }): boolean {
  return !!p.productId && PRODUTOS_QUE_DAO_PLUS.includes(p.productId);
}

async function conectar(): Promise<boolean> {
  if (!conexao) {
    conexao = IAP.initConnection().then(() => {
      IAP.purchaseUpdatedListener(async (p: Purchase) => {
        if (!ehNossa(p)) return;
        if (p.purchaseState === 'purchased') {
          await finalizar(p);
          const r = pendenteCompra; pendenteCompra = null;
          r?.('concluida');
        } else if (p.purchaseState === 'pending') {
          const r = pendenteCompra; pendenteCompra = null;
          r?.('pendente');
        }
        ouvintes.forEach(cb => cb());
      });
      IAP.purchaseErrorListener((e) => {
        const r = pendenteCompra; pendenteCompra = null;
        if (!r) return;
        const code = String(e?.code ?? '');
        if (code === 'user-cancelled') r('cancelada');
        else if (code === 'already-owned') r('ja_assinante');
        else if (code === 'pending' || code === 'deferred-payment') r('pendente');
        else r(motivoDoErro(e) === 'offline' ? 'offline' : 'erro');
      });
      return true;
    }).catch(() => { conexao = null; return false; });
  }
  return conexao;
}

async function consultar(): Promise<ConsultaLoja> {
  if (!(await conectar())) return { tipo: 'erro', motivo: 'indisponivel' };
  try {
    // Android: só assinaturas ATIVAS (inclui canceladas ainda no período pago; exclui suspensas).
    // iOS: direitos atuais verificados pelo StoreKit 2.
    const compras = (await IAP.getAvailablePurchases(Platform.OS === 'ios' ? { onlyIncludeActiveItemsIOS: true } : undefined)) ?? [];
    const nossas = compras.filter(ehNossa);
    // Compra que ficou sem confirmação (app fechado no meio) — confirma agora.
    for (const p of nossas) {
      if (Platform.OS === 'android' && p.purchaseState === 'purchased' && (p as { isAcknowledgedAndroid?: boolean | null }).isAcknowledgedAndroid === false) {
        await finalizar(p);
      }
    }
    const pendente = nossas.some(p => p.purchaseState === 'pending');
    let ativo = false;
    let renova: boolean | null = null;
    let fim: number | null = null;
    let produtoId: string | null = null;
    if (Platform.OS === 'android') {
      const ok = nossas.find(p => p.purchaseState === 'purchased');
      if (ok) {
        ativo = true;
        produtoId = ok.productId;
        renova = (ok as { autoRenewingAndroid?: boolean | null }).autoRenewingAndroid ?? ok.isAutoRenewing ?? null;
      }
    } else {
      const subs = (await IAP.getActiveSubscriptions([...PRODUTOS_QUE_DAO_PLUS])) ?? [];
      const s = subs.find(x => x.isActive && ehNossa(x));
      if (s) {
        ativo = true;
        produtoId = s.productId;
        renova = s.renewalInfoIOS?.willAutoRenew ?? null;
        fim = typeof s.expirationDateIOS === 'number' ? s.expirationDateIOS : null;
      }
    }
    return { tipo: 'ok', status: { ativo, produtoId, renovaAutomaticamente: renova, fimDoPeriodo: fim, pendente: !ativo && pendente } };
  } catch (e) {
    return { tipo: 'erro', motivo: motivoDoErro(e) };
  }
}

async function produto(): Promise<ConsultaProduto> {
  if (!(await conectar())) return { tipo: 'erro', motivo: 'indisponivel' };
  try {
    const lista = ((await IAP.fetchProducts({ skus: [...PRODUTOS_OFERECIDOS], type: 'subs' })) ?? []) as ProductSubscription[];
    const p = lista.find(x => x.id === PRODUTO_PLUS_MENSAL);
    if (!p) return { tipo: 'erro', motivo: 'loja' };
    let normal: ProdutoPlus | null;
    if (p.platform === 'android') {
      normal = produtoAndroid(p as unknown as AssinaturaAndroidLoja);
    } else {
      const grupo = (p as { subscriptionGroupIdIOS?: string | null }).subscriptionGroupIdIOS;
      const elegivel = grupo ? await IAP.isEligibleForIntroOfferIOS(grupo).catch(() => null) : null;
      normal = produtoIOS(p as unknown as AssinaturaIOSLoja, elegivel);
    }
    return normal ? { tipo: 'ok', produto: normal } : { tipo: 'erro', motivo: 'loja' };
  } catch (e) {
    return { tipo: 'erro', motivo: motivoDoErro(e) };
  }
}

async function comprar(p: ProdutoPlus): Promise<ResultadoCompra> {
  if (!(await conectar())) return 'erro';
  if (pendenteCompra) return 'erro';
  return new Promise<ResultadoCompra>(resolve => {
    pendenteCompra = resolve;
    const req = Platform.OS === 'android'
      ? { google: { skus: [p.id], subscriptionOffers: p.ofertaAndroid ? [{ sku: p.id, offerToken: p.ofertaAndroid }] : [] } }
      : { apple: { sku: p.id } };
    IAP.requestPurchase({ type: 'subs', request: req }).catch((e: unknown) => {
      if (pendenteCompra !== resolve) return;
      pendenteCompra = null;
      const code = String((e as { code?: unknown })?.code ?? '');
      resolve(code === 'user-cancelled' ? 'cancelada' : code === 'already-owned' ? 'ja_assinante' : motivoDoErro(e) === 'offline' ? 'offline' : 'erro');
    });
  });
}

async function restaurar(): Promise<ResultadoRestaurar> {
  if (!(await conectar())) return 'erro';
  try {
    await IAP.restorePurchases();
  } catch (e) {
    return motivoDoErro(e) === 'offline' ? 'offline' : 'erro';
  }
  const c = await consultar();
  if (c.tipo === 'erro') return c.motivo === 'offline' ? 'offline' : 'erro';
  return c.status.ativo ? 'encontrada' : 'nenhuma';
}

async function gerenciar(produtoId: string | null): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      await IAP.deepLinkToSubscriptions();
      return true;
    }
    if (produtoId) {
      await IAP.deepLinkToSubscriptions({ skuAndroid: produtoId, packageNameAndroid: PACOTE_ANDROID });
      return true;
    }
  } catch { /* cai no link geral */ }
  const url = Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
  return Linking.openURL(url).then(() => true, () => false);
}

export const lojaNativa: LojaPlus = {
  plataforma: Platform.OS === 'ios' ? 'ios' : 'android',
  consultar,
  produto,
  comprar,
  restaurar,
  gerenciar,
  aoMudar(cb) {
    ouvintes.add(cb);
    return () => { ouvintes.delete(cb); };
  },
};
