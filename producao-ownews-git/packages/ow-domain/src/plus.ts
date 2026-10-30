/**
 * OWBuddy Free + OWBuddy Premium — regras puras do acesso (entitlement OWBUDDY_PLUS).
 *
 * Matriz de produto (docs/OWBUDDY-FREE-PREMIUM.md): Minha Escala, Minha Mala, Minha Viagem,
 * Certificados, Contatos e o Meu Histórico básico são FREE PARA SEMPRE. Premium é a camada que
 * CRUZA os módulos (Buddy inteligente, alertas de mala/viagem/documentos) e o Histórico avançado.
 *
 * Duas fontes de Premium:
 *  - a LOJA (Google Play / App Store): assinatura, preço e período — nada disso é escrito aqui;
 *  - o período de boas-vindas de 45 dias (local, sem cobrança, sem cartão e sem conta), que
 *    começa quando a pessoa configura a escala pela primeira vez.
 * Entitlement controla RECURSOS, nunca a posse dos dados: nada aqui apaga ou esconde dado.
 *
 * Sem storage, sem rede, sem relógio implícito (`agora` sempre injetado).
 */
import type { Certificado, ChecklistData, Viagem } from './types';

/**
 * Venda da assinatura nas lojas. DESLIGADA até a missão "OWBuddy Premium / Play Billing": sem
 * produto cadastrado na Google Play/App Store, o app não fala com a loja (nenhuma consulta,
 * nenhuma compra) e a tela Premium diz que a assinatura ainda não está disponível. O período de
 * 45 dias e tudo o que é Free funcionam normalmente. O modo de teste (preview) simula a loja.
 */
export const ASSINATURA_PREMIUM_LIBERADA = false;

/** O único entitlement do app. A UI pergunta só "tem OWBUDDY_PLUS?". */
export const ENTITLEMENT_PLUS = 'OWBUDDY_PLUS';

/**
 * IDs de produto — os MESMOS nas duas lojas (Google Play: ID do produto de assinatura;
 * App Store: Product ID da assinatura auto-renovável). Estáveis: depois de criados nas lojas
 * não podem ser reaproveitados, então não mudam.
 */
export const PRODUTO_PLUS_MENSAL = 'owbuddy_plus_monthly';
/** Reservado para o plano anual (ainda NÃO configurado nas lojas: não é consultado nem vendido). */
export const PRODUTO_PLUS_ANUAL = 'owbuddy_plus_annual';
/** Produtos consultados e oferecidos hoje. */
export const PRODUTOS_OFERECIDOS: readonly string[] = [PRODUTO_PLUS_MENSAL];
/** Qualquer assinatura ativa destes produtos dá OWBUDDY_PLUS (o anual já entra quando existir). */
export const PRODUTOS_QUE_DAO_PLUS: readonly string[] = [PRODUTO_PLUS_MENSAL, PRODUTO_PLUS_ANUAL];

/**
 * Sem conseguir falar com a loja (sem internet, loja fora), quem a loja confirmou como Plus
 * continua Plus por até 7 dias desde a última confirmação. Nunca vale para quem não era Plus.
 */
export const CARENCIA_OFFLINE_DIAS = 7;
const DIA_MS = 86_400_000;

// ─── Recursos Premium ────────────────────────────────────────────────────────

/**
 * O que o Premium acrescenta. Telas inteiras NÃO entram aqui: Escala, Mala, Viagem,
 * Certificados, Contatos e o Histórico básico ficam abertos para todos.
 */
export type RecursoPlus = 'buddy_inteligente' | 'alertas_inteligentes' | 'historico_avancado';

export const RECURSO_PLUS: Record<RecursoPlus, { titulo: string; beneficio: string }> = {
  buddy_inteligente: {
    titulo: 'Buddy cuida do seu ciclo',
    beneficio: 'O Buddy cruza escala, mala, viagem e documentos e mostra no Início o que importa agora: a mala que falta, o voo de amanhã, o documento que vence antes do embarque.',
  },
  alertas_inteligentes: {
    titulo: 'Alertas da mala, viagem e documentos',
    beneficio: 'Lembretes na véspera da mala incompleta, do horário da viagem e dos documentos que vencem antes do próximo ciclo.',
  },
  historico_avancado: {
    titulo: 'Histórico de carreira',
    beneficio: 'Dias embarcado por ano e no total, unidades por onde passou, filtros por ano e unidade e a viagem levada direto para o histórico.',
  },
};

/** O que o Premium acrescenta (tela OWBuddy Premium). */
export const BENEFICIOS_PLUS: readonly string[] = [
  'Buddy cruzando escala, mala, viagem e documentos no Início',
  'Buddy Agora completo, com os próximos passos do embarque',
  'Alertas de mala, viagem e documentos',
  'Resumo de carreira: dias embarcado por ano e no total',
  'Filtros do histórico por ano e unidade',
  'Viagem levada direto para o Meu Histórico',
];

/** O que é do OWBuddy Free para sempre (aparece na tela Premium para não haver dúvida). */
export const RECURSOS_FREE: readonly string[] = [
  'Minha Escala, calendário e contagem para embarque e casa',
  'Minha Mala completa, editável e offline',
  'Minha Viagem, Certificados e Contatos do embarque',
  'Meu Histórico: registrar, consultar, editar e excluir',
  'Lembretes da escala e datas importantes',
  'Compartilhar escala, Cruzar escalas, Notícias e Vagas',
];

// ─── Período Premium de boas-vindas (45 dias) ────────────────────────────────

export const TRIAL_PREMIUM_DIAS = 45;
/** A partir de quantos dias restantes o Início avisa (uma vez) que o período está acabando. */
export const TRIAL_AVISO_FIM_DIAS = 3;

/**
 * Registro local do período de boas-vindas. `visto` é o maior relógio já visto no aparelho:
 * voltar a data do celular não devolve dias (o tempo efetivo nunca anda para trás).
 */
export interface TrialPremium {
  v: 1;
  inicio: number;
  visto: number;
  /** Aviso "termina em breve" já mostrado uma vez no Início. */
  avisoPerto?: boolean;
  /** Explicação do fim já mostrada (e escolhida: Conhecer / Continuar no Free). */
  avisoFim?: boolean;
}

export function lerTrialPremium(raw: unknown): TrialPremium | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || typeof r.inicio !== 'number' || !Number.isFinite(r.inicio)) return null;
  const visto = typeof r.visto === 'number' && Number.isFinite(r.visto) ? Math.max(r.visto, r.inicio) : r.inicio;
  return { v: 1, inicio: r.inicio, visto, avisoPerto: r.avisoPerto === true, avisoFim: r.avisoFim === true };
}

/** Começa o período (uma vez só). Já existindo, devolve o mesmo registro. */
export function iniciarTrialPremium(atual: TrialPremium | null, agora: number): TrialPremium {
  return atual ?? { v: 1, inicio: agora, visto: agora };
}

/** Avança o relógio visto (nunca recua). Devolve o MESMO objeto quando nada muda. */
export function tocarTrialPremium(t: TrialPremium, agora: number): TrialPremium {
  return agora > t.visto ? { ...t, visto: agora } : t;
}

export interface StatusTrial {
  ativo: boolean;
  /** Dias restantes (1–45) enquanto ativo; 0 depois. */
  diasRestantes: number;
  terminou: boolean;
  /** Fim do período (ms). */
  fim: number;
}

/** Status do período no instante efetivo max(agora, visto). */
export function statusTrialPremium(t: TrialPremium | null, agora: number): StatusTrial | null {
  if (!t) return null;
  const efetivo = Math.max(agora, t.visto);
  const fim = t.inicio + TRIAL_PREMIUM_DIAS * DIA_MS;
  if (efetivo >= fim) return { ativo: false, diasRestantes: 0, terminou: true, fim };
  return { ativo: true, diasRestantes: Math.max(1, Math.ceil((fim - efetivo) / DIA_MS)), terminou: false, fim };
}

/** "45 dias restantes" / "1 dia restante". */
export function textoDiasRestantes(n: number): string {
  return n === 1 ? '1 dia restante' : `${n} dias restantes`;
}

// ─── Períodos (vêm da loja) ──────────────────────────────────────────────────

export type UnidadePeriodo = 'dia' | 'semana' | 'mes' | 'ano';
export interface PeriodoLoja { unidade: UnidadePeriodo; quantidade: number }

/** ISO 8601 da Google Play ("P1M", "P7D", "P1W", "P1Y", "P3M"). Formato desconhecido → null. */
export function periodoISO(s: unknown): PeriodoLoja | null {
  if (typeof s !== 'string') return null;
  const m = /^P(\d+)([DWMY])$/.exec(s.trim().toUpperCase());
  if (!m) return null;
  const quantidade = Number(m[1]);
  if (!Number.isInteger(quantidade) || quantidade <= 0) return null;
  const unidade = ({ D: 'dia', W: 'semana', M: 'mes', Y: 'ano' } as const)[m[2] as 'D' | 'W' | 'M' | 'Y'];
  return { unidade, quantidade };
}

/** Unidade da App Store ("day" | "week" | "month" | "year"). Outra coisa → null. */
export function unidadeLoja(s: unknown): UnidadePeriodo | null {
  const u = typeof s === 'string' ? s.trim().toLowerCase() : '';
  return u === 'day' ? 'dia' : u === 'week' ? 'semana' : u === 'month' ? 'mes' : u === 'year' ? 'ano' : null;
}

const NOME_UNIDADE: Record<UnidadePeriodo, [string, string]> = {
  dia: ['dia', 'dias'], semana: ['semana', 'semanas'], mes: ['mês', 'meses'], ano: ['ano', 'anos'],
};

/** "1 mês", "7 dias", "2 semanas", "1 ano". */
export function textoDuracao(p: PeriodoLoja): string {
  const [um, varios] = NOME_UNIDADE[p.unidade];
  return `${p.quantidade} ${p.quantidade === 1 ? um : varios}`;
}

/** "R$ 4,90/mês", "R$ 49,90/ano", "R$ 12,90 a cada 3 meses" — preço SEMPRE o texto da loja. */
export function precoComPeriodo(preco: string, p: PeriodoLoja): string {
  if (p.quantidade === 1) return `${preco}/${NOME_UNIDADE[p.unidade][0]}`;
  return `${preco} a cada ${textoDuracao(p)}`;
}

/** "mensal" / "anual" / "a cada 3 meses" (para a renovação). */
export function textoRecorrencia(p: PeriodoLoja): string {
  if (p.quantidade === 1) {
    return p.unidade === 'mes' ? 'todo mês' : p.unidade === 'ano' ? 'todo ano' : p.unidade === 'semana' ? 'toda semana' : 'todo dia';
  }
  return `a cada ${textoDuracao(p)}`;
}

// ─── Produto (normalizado a partir da resposta da loja) ──────────────────────

export type PlataformaLoja = 'android' | 'ios' | 'teste';

export interface ProdutoPlus {
  id: string;
  plataforma: PlataformaLoja;
  /** Preço localizado EXATAMENTE como a loja devolveu (moeda e formato do país). */
  preco: string;
  /** Periodicidade da cobrança (da loja). */
  periodo: PeriodoLoja;
  /** Período gratuito SÓ quando a loja informou que esta pessoa tem direito. */
  gratis: PeriodoLoja | null;
  /** Android: token da oferta que será comprada (com ou sem período gratuito). */
  ofertaAndroid?: string;
}

/** Formato (estrutural) do que a Google Play Billing devolve via expo-iap. */
export interface FaseAndroid {
  priceAmountMicros: string;
  formattedPrice: string;
  billingPeriod: string;
  billingCycleCount: number;
  /** 1 = recorrente infinita (preço base); 2 = número finito de ciclos; 3 = sem recorrência. */
  recurrenceMode: number;
}
export interface OfertaAndroid {
  id?: string | null;
  basePlanIdAndroid?: string | null;
  offerTokenAndroid?: string | null;
  pricingPhasesAndroid?: { pricingPhaseList: FaseAndroid[] } | null;
}
export interface AssinaturaAndroidLoja {
  id: string;
  platform?: string;
  subscriptionOffers?: OfertaAndroid[] | null;
}

/**
 * Google Play: a loja só devolve as ofertas a que a pessoa tem direito. Se houver uma oferta
 * cuja primeira fase custa 0 e depois vira o preço base, há período gratuito; senão, compra-se
 * o plano base. Ofertas com preço promocional pago são ignoradas (nunca anunciamos o que não
 * explicamos). Dados incompletos → null (a tela mostra erro, não um preço inventado).
 */
export function produtoAndroid(p: AssinaturaAndroidLoja | null | undefined): ProdutoPlus | null {
  if (!p || typeof p.id !== 'string') return null;
  let base: { preco: string; periodo: PeriodoLoja; token: string } | null = null;
  let trial: { preco: string; periodo: PeriodoLoja; gratis: PeriodoLoja; token: string } | null = null;
  for (const o of p.subscriptionOffers ?? []) {
    const fases = o?.pricingPhasesAndroid?.pricingPhaseList ?? [];
    const token = o?.offerTokenAndroid;
    if (!token || fases.length === 0) continue;
    const ultima = fases[fases.length - 1]!;
    const periodo = periodoISO(ultima.billingPeriod);
    if (ultima.recurrenceMode !== 1 || !periodo || !ultima.formattedPrice || ultima.priceAmountMicros === '0') continue;
    if (fases.length === 1) {
      if (!base) base = { preco: ultima.formattedPrice, periodo, token };
      continue;
    }
    if (fases.length === 2 && fases[0]!.priceAmountMicros === '0') {
      const p0 = periodoISO(fases[0]!.billingPeriod);
      const ciclos = Number(fases[0]!.billingCycleCount) || 1;
      if (p0 && !trial) trial = { preco: ultima.formattedPrice, periodo, gratis: { unidade: p0.unidade, quantidade: p0.quantidade * ciclos }, token };
    }
  }
  if (trial) return { id: p.id, plataforma: 'android', preco: trial.preco, periodo: trial.periodo, gratis: trial.gratis, ofertaAndroid: trial.token };
  if (base) return { id: p.id, plataforma: 'android', preco: base.preco, periodo: base.periodo, gratis: null, ofertaAndroid: base.token };
  return null;
}

/** Formato (estrutural) do que a App Store (StoreKit 2) devolve via expo-iap. */
export interface AssinaturaIOSLoja {
  id: string;
  displayPrice?: string | null;
  subscriptionPeriodUnitIOS?: string | null;
  subscriptionPeriodNumberIOS?: string | number | null;
  subscriptionGroupIdIOS?: string | null;
  subscriptionOffers?: Array<{
    type?: string | null;
    paymentMode?: string | null;
    period?: { unit?: string | null; value?: number | null } | null;
    periodCount?: number | null;
  }> | null;
}

/**
 * App Store: preço e período do produto; período gratuito só se a oferta introdutória for
 * "free-trial" E a App Store disser que a pessoa é elegível (`elegivel === true`).
 * Elegibilidade desconhecida (null) → não promete período gratuito.
 */
export function produtoIOS(p: AssinaturaIOSLoja | null | undefined, elegivel: boolean | null): ProdutoPlus | null {
  if (!p || typeof p.id !== 'string' || !p.displayPrice) return null;
  const unidade = unidadeLoja(p.subscriptionPeriodUnitIOS);
  const qtd = Number(p.subscriptionPeriodNumberIOS ?? 1) || 1;
  if (!unidade) return null;
  let gratis: PeriodoLoja | null = null;
  if (elegivel === true) {
    const intro = (p.subscriptionOffers ?? []).find(o => o?.type === 'introductory' && o?.paymentMode === 'free-trial');
    const u = unidadeLoja(intro?.period?.unit);
    const v = Number(intro?.period?.value) || 0;
    if (intro && u && v > 0) gratis = { unidade: u, quantidade: v * (Number(intro.periodCount) || 1) };
  }
  return { id: p.id, plataforma: 'ios', preco: p.displayPrice, periodo: { unidade, quantidade: qtd }, gratis };
}

// ─── Estado da assinatura (o que a loja confirmou) ───────────────────────────

export interface StatusLoja {
  /** Existe assinatura que dá direito AGORA (inclui cancelada com período pago restante e período gratuito). */
  ativo: boolean;
  produtoId: string | null;
  /** false = renovação automática desligada (cancelada, mas ainda ativa até o fim do período). */
  renovaAutomaticamente: boolean | null;
  /** Fim do período atual — só quando a loja informa (App Store). Google Play no app: null. */
  fimDoPeriodo: number | null;
  /** Compra feita mas pagamento ainda não confirmado pela loja (ex.: boleto). Não libera. */
  pendente: boolean;
}

export type ConsultaLoja =
  | { tipo: 'ok'; status: StatusLoja }
  | { tipo: 'erro'; motivo: 'offline' | 'loja' | 'indisponivel' };

/** Última confirmação da loja guardada no aparelho (não é trial; não guarda token nem recibo). */
export interface CachePlus {
  v: 1;
  plus: boolean;
  /** Quando a loja confirmou pela última vez (ms). */
  conferidoEm: number;
  fimDoPeriodo: number | null;
  /** Já teve Plus neste aparelho — só para dizer "seu acesso terminou" em vez de "experimente". */
  jaTevePlus: boolean;
}

export function lerCachePlus(raw: unknown): CachePlus | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || typeof r.plus !== 'boolean' || typeof r.conferidoEm !== 'number' || !Number.isFinite(r.conferidoEm)) return null;
  return {
    v: 1,
    plus: r.plus,
    conferidoEm: r.conferidoEm,
    fimDoPeriodo: typeof r.fimDoPeriodo === 'number' && Number.isFinite(r.fimDoPeriodo) ? r.fimDoPeriodo : null,
    jaTevePlus: r.jaTevePlus === true || r.plus,
  };
}

/** Só uma resposta CONFIRMADA da loja muda o cache; erro de rede nunca rebaixa ninguém. */
export function atualizarCachePlus(cache: CachePlus | null, consulta: ConsultaLoja, agora: number): CachePlus | null {
  if (consulta.tipo !== 'ok') return cache;
  const s = consulta.status;
  return { v: 1, plus: s.ativo, conferidoEm: agora, fimDoPeriodo: s.ativo ? s.fimDoPeriodo : null, jaTevePlus: (cache?.jaTevePlus ?? false) || s.ativo };
}

export type EstadoPlus = 'carregando' | 'plus' | 'free' | 'erro';

/** Nível do produto: o que a pessoa tem agora (a UI de recursos só olha `plus`). */
export type NivelPremium = 'free' | 'premium_trial' | 'premium_active' | 'premium_expired';

export interface AcessoPlus {
  estado: EstadoPlus;
  /** A ÚNICA pergunta da UI: este usuário tem Premium agora (assinatura OU período de 45 dias)? */
  plus: boolean;
  nivel: NivelPremium;
  /** De onde veio a resposta. */
  origem: 'loja' | 'cache' | 'trial' | 'nenhuma';
  /** Período de boas-vindas (null = ainda não começou: a pessoa não configurou a escala). */
  trial: StatusTrial | null;
  /** Já teve Premium (assinatura ou período de boas-vindas) e não tem mais. */
  expirou: boolean;
  /** Plus ativo com renovação desligada (continua até o fim do período). */
  cancelado: boolean;
  /** Fim do período atual, só quando a loja informa. */
  fimDoPeriodo: number | null;
  /** Pagamento aguardando confirmação da loja. */
  pendente: boolean;
  /** Erro: por quê a loja não respondeu (para o texto, nunca para decidir acesso). */
  motivoErro: 'offline' | 'loja' | 'indisponivel' | null;
}

function cacheValeOffline(cache: CachePlus | null, agora: number): boolean {
  return !!cache && cache.plus && agora - cache.conferidoEm <= CARENCIA_OFFLINE_DIAS * DIA_MS && agora >= cache.conferidoEm - DIA_MS;
}

const BASE: Omit<AcessoPlus, 'estado' | 'plus' | 'origem' | 'nivel'> = {
  trial: null, expirou: false, cancelado: false, fimDoPeriodo: null, pendente: false, motivoErro: null,
};

/**
 * Resposta única de acesso.
 *  - consulta null = a loja ainda não respondeu: usa a última confirmação (sem piscar cadeado);
 *    sem confirmação anterior → "carregando" (nem libera nem tranca).
 *  - loja respondeu → vale a loja.
 *  - loja não respondeu → quem era Plus continua Plus na carência; senão "erro" (sem acesso Plus,
 *    sem preço, sem afirmar que a assinatura acabou).
 */
export function resolverAcessoPlus(consulta: ConsultaLoja | null, cache: CachePlus | null, agora: number): AcessoPlus {
  if (consulta === null) {
    if (cacheValeOffline(cache, agora)) return { ...BASE, estado: 'plus', plus: true, nivel: 'premium_active', origem: 'cache', fimDoPeriodo: cache!.fimDoPeriodo };
    if (cache && !cache.plus) return { ...BASE, estado: 'free', plus: false, nivel: cache.jaTevePlus ? 'premium_expired' : 'free', origem: 'cache', expirou: cache.jaTevePlus };
    return { ...BASE, estado: 'carregando', plus: false, nivel: 'free', origem: 'nenhuma' };
  }
  if (consulta.tipo === 'ok') {
    const s = consulta.status;
    if (s.ativo) {
      return { ...BASE, estado: 'plus', plus: true, nivel: 'premium_active', origem: 'loja', cancelado: s.renovaAutomaticamente === false, fimDoPeriodo: s.fimDoPeriodo };
    }
    const jaTeve = cache?.jaTevePlus ?? false;
    return { ...BASE, estado: 'free', plus: false, nivel: jaTeve ? 'premium_expired' : 'free', origem: 'loja', expirou: jaTeve, pendente: s.pendente };
  }
  if (cacheValeOffline(cache, agora)) {
    return { ...BASE, estado: 'plus', plus: true, nivel: 'premium_active', origem: 'cache', fimDoPeriodo: cache!.fimDoPeriodo, motivoErro: consulta.motivo };
  }
  return { ...BASE, estado: 'erro', plus: false, nivel: 'free', origem: cache ? 'cache' : 'nenhuma', motivoErro: consulta.motivo };
}

/**
 * Junta a resposta da loja com o período de boas-vindas. Assinatura confirmada sempre vence;
 * sem ela, o período ativo libera o Premium sem depender da loja (nem de internet).
 */
export function combinarComTrial(acesso: AcessoPlus, trial: StatusTrial | null): AcessoPlus {
  if (acesso.plus) return { ...acesso, trial };
  if (trial?.ativo) {
    return { ...acesso, estado: 'plus', plus: true, nivel: 'premium_trial', origem: 'trial', trial, expirou: false };
  }
  const expirou = acesso.expirou || !!trial?.terminou;
  return { ...acesso, trial, expirou, nivel: expirou ? 'premium_expired' : acesso.nivel };
}

// ─── Textos transparentes (antes de qualquer compra) ─────────────────────────

export interface OfertaTexto {
  /** Rótulo do botão que abre a confirmação da LOJA. */
  cta: string;
  /** Linha principal: "1 mês grátis" ou "R$ 4,90/mês". */
  destaque: string;
  /** Linha de apoio: "Depois, R$ 4,90/mês" (só com período gratuito). */
  depois: string | null;
  /** Frase obrigatória ao lado do botão. */
  aviso: string;
  /** Renovação automática, em linguagem simples. */
  renovacao: string;
  /** Como cancelar e o que acontece se cancelar (por loja). */
  cancelamento: string;
}

export function ofertaTexto(p: ProdutoPlus): OfertaTexto {
  const preco = precoComPeriodo(p.preco, p.periodo);
  const loja = p.plataforma === 'ios' ? 'App Store' : p.plataforma === 'android' ? 'Google Play' : 'loja';
  if (p.gratis) {
    const dur = textoDuracao(p.gratis);
    return {
      cta: 'Experimentar OWBuddy Premium',
      destaque: `${dur} grátis`,
      depois: `Depois, ${preco}`,
      aviso: `Após o período gratuito de ${dur}, a assinatura passa a ser ${preco}, salvo cancelamento.`,
      renovacao: `Renovação automática ${textoRecorrencia(p.periodo)} até você cancelar, conforme as condições exibidas pela ${loja}.`,
      cancelamento: p.plataforma === 'ios'
        ? 'Cancele quando quiser em Ajustes › Assinaturas. Para não ser cobrado, cancele até 24 horas antes do fim do período gratuito.'
        : `Cancele quando quiser na ${loja}. Cancelando durante o período gratuito, não há cobrança.`,
    };
  }
  return {
    cta: 'Assinar OWBuddy Premium',
    destaque: preco,
    depois: null,
    aviso: `A assinatura custa ${preco}, salvo cancelamento.`,
    renovacao: `Renovação automática ${textoRecorrencia(p.periodo)} até você cancelar, conforme as condições exibidas pela ${loja}.`,
    cancelamento: p.plataforma === 'ios'
      ? 'Cancele quando quiser em Ajustes › Assinaturas, até 24 horas antes da próxima renovação.'
      : `Cancele quando quiser na ${loja}. O acesso continua até o fim do período já pago.`,
  };
}

// ─── Recorte Free (Início, Buddy Agora e lembretes) ──────────────────────────

/**
 * O "Buddy inteligente" é Premium: sem Premium, o herói do Início, o Buddy Agora e os lembretes
 * cruzam só escala, eventos e pagamento. Mala, viagem e documentos continuam abertos nas
 * próprias telas e NÃO são apagados nem alterados: só não entram no cruzamento.
 */
export function recorteFree<T extends { checklist: ChecklistData | null; certs: Certificado[]; viagem: Viagem | null }>(plus: boolean, d: T): T {
  if (plus) return d;
  return { ...d, checklist: null, certs: [], viagem: null };
}

// ─── Modo de teste (desenvolvimento) ─────────────────────────────────────────

/**
 * Cenários simulados existem SÓ em desenvolvimento (__DEV__) ou no preview web exportado com
 * EXPO_PUBLIC_OWBUDDY_PLUS_TESTE=1. Em build nativo de produção é sempre false.
 */
export function modoTestePermitido(o: { dev: boolean; plataforma: string; flag: string | undefined }): boolean {
  if (o.dev) return true;
  return o.plataforma === 'web' && o.flag === '1';
}

export type CenarioTestePlus =
  | 'novo_usuario' | 'trial_ativo' | 'trial_perto' | 'trial_terminou'
  | 'free_trial' | 'free_sem_trial' | 'plus' | 'plus_cancelado' | 'expirado' | 'carregando' | 'erro' | 'offline_plus';

export const CENARIOS_TESTE_PLUS: ReadonlyArray<{ id: CenarioTestePlus; rotulo: string }> = [
  { id: 'novo_usuario', rotulo: 'Usuário novo · período real de 45 dias' },
  { id: 'trial_ativo', rotulo: 'Premium de boas-vindas · 32 dias' },
  { id: 'trial_perto', rotulo: 'Premium de boas-vindas · faltam 2 dias' },
  { id: 'trial_terminou', rotulo: 'Período de 45 dias terminou' },
  { id: 'free_trial', rotulo: 'Free · loja com período grátis' },
  { id: 'free_sem_trial', rotulo: 'Free · loja sem período grátis' },
  { id: 'plus', rotulo: 'Premium assinado' },
  { id: 'plus_cancelado', rotulo: 'Premium cancelado (ainda ativo)' },
  { id: 'expirado', rotulo: 'Assinatura expirada' },
  { id: 'offline_plus', rotulo: 'Premium sem internet' },
  { id: 'carregando', rotulo: 'Loja carregando' },
  { id: 'erro', rotulo: 'Erro da loja' },
];

/**
 * Período de boas-vindas de cada cenário simulado: `undefined` = usa o registro REAL do
 * aparelho (começa ao configurar a escala); `null` = sem período; senão um registro fixo.
 */
export function trialDoCenario(c: CenarioTestePlus, agora: number): TrialPremium | null | undefined {
  const dia = DIA_MS;
  switch (c) {
    case 'novo_usuario': return undefined;
    case 'trial_ativo': return { v: 1, inicio: agora - (TRIAL_PREMIUM_DIAS - 32) * dia, visto: agora };
    case 'trial_perto': return { v: 1, inicio: agora - (TRIAL_PREMIUM_DIAS - 2) * dia - 3_600_000, visto: agora };
    case 'trial_terminou': return { v: 1, inicio: agora - (TRIAL_PREMIUM_DIAS + 1) * dia, visto: agora };
    default: return null;
  }
}

export function cenarioTesteValido(s: unknown): s is CenarioTestePlus {
  return typeof s === 'string' && CENARIOS_TESTE_PLUS.some(c => c.id === s);
}
