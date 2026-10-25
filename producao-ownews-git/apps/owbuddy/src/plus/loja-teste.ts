/**
 * OWBuddy+ SIMULADO — só para validar telas antes das lojas estarem configuradas.
 * Escolhida por lojaPlus() apenas quando modoTesteAtivo() (dev / preview web com a flag).
 * Preço e período aqui são fictícios e a tela avisa isso; nada é cobrado.
 */
import { CARENCIA_OFFLINE_DIAS, PRODUTO_PLUS_MENSAL, cenarioTesteValido } from '@owbuddy/domain';
import type { CachePlus, CenarioTestePlus, ConsultaLoja, ProdutoPlus } from '@owbuddy/domain';
import { getCenarioTestePlus, setCenarioTestePlus } from '../storage';
import { perguntar } from '../confirmar';
import type { ConsultaProduto, LojaPlus, ResultadoCompra, ResultadoRestaurar } from './loja';

/** Cenário inicial do preview: usuário novo, Free, com período gratuito disponível. */
export const CENARIO_TESTE_PADRAO: CenarioTestePlus = 'free_trial';
const DIA = 86_400_000;

let cenario: CenarioTestePlus = CENARIO_TESTE_PADRAO;
let leitura: Promise<void> | null = null;
const ouvintes = new Set<() => void>();

/** ?plus=<cenário> na URL do preview (web) escolhe o cenário. */
function cenarioDaUrl(): CenarioTestePlus | null {
  try {
    const q = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search).get('plus') : null;
    return cenarioTesteValido(q) ? q : null;
  } catch { return null; }
}

/** Uma leitura só, compartilhada: consulta e produto chegam juntos e esperam a mesma. */
function garantirLido(): Promise<void> {
  if (!leitura) {
    leitura = (async () => {
      const url = cenarioDaUrl();
      if (url) { cenario = url; await setCenarioTestePlus(url); return; }
      const salvo = await getCenarioTestePlus();
      if (cenarioTesteValido(salvo)) cenario = salvo;
    })();
  }
  return leitura;
}

export async function cenarioTesteAtual(): Promise<CenarioTestePlus> {
  await garantirLido();
  return cenario;
}

export async function definirCenarioTeste(c: CenarioTestePlus): Promise<void> {
  await garantirLido();
  cenario = c;
  await setCenarioTestePlus(c);
  ouvintes.forEach(cb => cb());
}

function produtoSimulado(gratis: boolean): ProdutoPlus {
  return {
    id: PRODUTO_PLUS_MENSAL,
    plataforma: 'teste',
    preco: 'R$ 0,00',
    periodo: { unidade: 'mes', quantidade: 1 },
    gratis: gratis ? { unidade: 'mes', quantidade: 1 } : null,
  };
}

export const lojaTeste: LojaPlus = {
  plataforma: 'teste',

  async consultar(): Promise<ConsultaLoja> {
    await garantirLido();
    switch (cenario) {
      case 'plus': return { tipo: 'ok', status: { ativo: true, produtoId: PRODUTO_PLUS_MENSAL, renovaAutomaticamente: true, fimDoPeriodo: null, pendente: false } };
      case 'plus_cancelado': return { tipo: 'ok', status: { ativo: true, produtoId: PRODUTO_PLUS_MENSAL, renovaAutomaticamente: false, fimDoPeriodo: Date.now() + 12 * DIA, pendente: false } };
      case 'carregando': return new Promise<ConsultaLoja>(() => {});
      case 'erro': return { tipo: 'erro', motivo: 'loja' };
      case 'offline_plus': return { tipo: 'erro', motivo: 'offline' };
      default: return { tipo: 'ok', status: { ativo: false, produtoId: null, renovaAutomaticamente: null, fimDoPeriodo: null, pendente: false } };
    }
  },

  async produto(): Promise<ConsultaProduto> {
    await garantirLido();
    if (cenario === 'carregando') return new Promise<ConsultaProduto>(() => {});
    if (cenario === 'erro') return { tipo: 'erro', motivo: 'loja' };
    if (cenario === 'offline_plus') return { tipo: 'erro', motivo: 'offline' };
    return { tipo: 'ok', produto: produtoSimulado(cenario === 'free_trial') };
  },

  async comprar(): Promise<ResultadoCompra> {
    const ok = await perguntar(
      'Compra simulada',
      'Modo de teste: nada é cobrado. No aparelho, aqui abriria a confirmação oficial da Google Play ou da App Store.',
      'Simular assinatura',
    );
    if (!ok) return 'cancelada';
    await definirCenarioTeste('plus');
    return 'concluida';
  },

  async restaurar(): Promise<ResultadoRestaurar> {
    await garantirLido();
    if (cenario === 'erro') return 'erro';
    if (cenario === 'offline_plus') return 'offline';
    return cenario === 'plus' || cenario === 'plus_cancelado' ? 'encontrada' : 'nenhuma';
  },

  async gerenciar(): Promise<boolean> {
    await perguntar('Gerenciar assinatura (teste)', 'No aparelho, aqui abriria a página de assinaturas da Google Play ou da App Store.', 'OK', 'Fechar');
    return true;
  },

  preparar: garantirLido,

  cacheSimulado(): CachePlus | null {
    const agora = Date.now();
    switch (cenario) {
      case 'expirado': return { v: 1, plus: false, conferidoEm: agora - DIA, fimDoPeriodo: null, jaTevePlus: true };
      case 'offline_plus': return { v: 1, plus: true, conferidoEm: agora - Math.min(2, CARENCIA_OFFLINE_DIAS - 1) * DIA, fimDoPeriodo: null, jaTevePlus: true };
      case 'plus': case 'plus_cancelado': return { v: 1, plus: true, conferidoEm: agora - DIA, fimDoPeriodo: null, jaTevePlus: true };
      default: return null;
    }
  },

  aoMudar(cb) {
    ouvintes.add(cb);
    return () => { ouvintes.delete(cb); };
  },
};
