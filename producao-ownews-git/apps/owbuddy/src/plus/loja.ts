/**
 * OWBuddy+ — contrato com a loja. A UI nunca fala com a loja: só com `useOwBuddyPlus()`
 * (src/plus/acesso.tsx), que usa UMA destas implementações:
 *
 *  - loja-nativa.ts  → Google Play Billing / StoreKit 2 via expo-iap (Android e iOS).
 *  - loja-teste.ts   → cenários simulados; só existe com modo de teste permitido (dev / preview web).
 *  - lojaIndisponivel → web sem modo de teste: não há loja, ninguém compra nada.
 */
import { Platform } from 'react-native';
import { ASSINATURA_PREMIUM_LIBERADA, modoTestePermitido } from '@owbuddy/domain';
import type { CachePlus, ConsultaLoja, PlataformaLoja, ProdutoPlus, TrialPremium } from '@owbuddy/domain';

export type MotivoErroLoja = 'offline' | 'loja' | 'indisponivel';

export type ConsultaProduto =
  | { tipo: 'ok'; produto: ProdutoPlus }
  | { tipo: 'erro'; motivo: MotivoErroLoja };

export type ResultadoCompra = 'concluida' | 'cancelada' | 'pendente' | 'ja_assinante' | 'offline' | 'erro';
export type ResultadoRestaurar = 'encontrada' | 'nenhuma' | 'offline' | 'erro';

export interface LojaPlus {
  plataforma: PlataformaLoja | 'indisponivel';
  /** Assinatura que dá direito agora (consulta à loja; nunca a um relógio local). */
  consultar(): Promise<ConsultaLoja>;
  /** Preço, periodicidade e período gratuito (só se elegível), como a loja informa. */
  produto(): Promise<ConsultaProduto>;
  /** Abre a confirmação OFICIAL da loja. Só é chamada por toque consciente no botão. */
  comprar(p: ProdutoPlus): Promise<ResultadoCompra>;
  restaurar(): Promise<ResultadoRestaurar>;
  /** Abre a gestão de assinatura da loja. false = não deu para abrir. */
  gerenciar(produtoId: string | null): Promise<boolean>;
  /** Só a loja de teste: cache simulado do cenário (ignora o cache real). */
  cacheSimulado?(): CachePlus | null;
  /** Só a loja de teste: lê o cenário escolhido antes do primeiro uso. */
  preparar?(): Promise<void>;
  /** Só a loja de teste: período de 45 dias do cenário (undefined = usa o registro real). */
  trialSimulado?(): TrialPremium | null | undefined;
  /** Avisa quando a loja entrega algo fora de uma compra em andamento (renovação, pendente pago). */
  aoMudar?(cb: () => void): () => void;
}

/**
 * Modo de teste: SÓ em desenvolvimento (__DEV__) ou no preview web exportado com
 * EXPO_PUBLIC_OWBUDDY_PLUS_TESTE=1. Build nativo de produção: sempre false (__DEV__ é false e a
 * plataforma não é web). A variável precisa aparecer literal para o Expo embutir no build.
 */
export function modoTesteAtivo(): boolean {
  return modoTestePermitido({
    dev: typeof __DEV__ !== 'undefined' && __DEV__ === true,
    plataforma: Platform.OS,
    flag: process.env.EXPO_PUBLIC_OWBUDDY_PLUS_TESTE,
  });
}

/** Sem loja (web, ou venda ainda desligada): ninguém assina — é Free, não erro. */
export const lojaIndisponivel: LojaPlus = {
  plataforma: 'indisponivel',
  consultar: async () => ({ tipo: 'ok', status: { ativo: false, produtoId: null, renovaAutomaticamente: null, fimDoPeriodo: null, pendente: false } }),
  produto: async () => ({ tipo: 'erro', motivo: 'indisponivel' }),
  comprar: async () => 'erro',
  restaurar: async () => 'erro',
  gerenciar: async () => false,
};

let escolhida: LojaPlus | null = null;

export function lojaPlus(): LojaPlus {
  if (escolhida) return escolhida;
  if (modoTesteAtivo()) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    escolhida = (require('./loja-teste') as typeof import('./loja-teste')).lojaTeste;
  } else if (ASSINATURA_PREMIUM_LIBERADA && (Platform.OS === 'android' || Platform.OS === 'ios')) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    escolhida = (require('./loja-nativa') as typeof import('./loja-nativa')).lojaNativa;
  } else {
    escolhida = lojaIndisponivel;
  }
  return escolhida;
}
