/**
 * OWBuddy+ — a ÚNICA camada de acesso do app.
 *
 *   const { plus } = useOwBuddyPlus();
 *
 * Telas e componentes só perguntam "tem Plus?". Assinatura ativa, período gratuito, compra
 * restaurada, cancelada-ainda-válida, expiração, erro, falta de internet e plataforma ficam
 * aqui e em @owbuddy/domain/plus. Nada de trial local: quem diz é a loja.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { atualizarCachePlus, resolverAcessoPlus } from '@owbuddy/domain';
import type { AcessoPlus, CachePlus, ConsultaLoja, ProdutoPlus } from '@owbuddy/domain';
import { getCachePlus, setCachePlus } from '../storage';
import { lojaPlus, modoTesteAtivo } from './loja';
import type { ConsultaProduto, ResultadoCompra, ResultadoRestaurar } from './loja';

export type EstadoProduto = { tipo: 'carregando' } | ConsultaProduto;

interface Estado {
  /** false até ler a última confirmação guardada (evita piscar cadeado ao abrir). */
  lido: boolean;
  acesso: AcessoPlus;
  produto: EstadoProduto;
}

let cache: CachePlus | null = null;
let estado: Estado = {
  lido: false,
  acesso: resolverAcessoPlus(null, null, Date.now()),
  produto: { tipo: 'carregando' },
};
const ouvintes = new Set<() => void>();
let iniciado = false;
let consultaEmCurso: Promise<void> | null = null;
let ultimaConsulta = 0;
/** Produto da assinatura ativa (para abrir a gestão certa na Google Play). */
let produtoAtivo: string | null = null;

const chaveAcesso = (e: Estado) => `${e.lido}|${e.acesso.estado}|${e.acesso.plus}`;

function publicar(parcial: Partial<Estado>): void {
  const antes = chaveAcesso(estado);
  estado = { ...estado, ...parcial };
  ouvintes.forEach(cb => cb());
  if (antes !== chaveAcesso(estado)) mudancasPlus.forEach(cb => cb(estado.acesso.plus));
}

const mudancasPlus = new Set<(plus: boolean) => void>();
/** Para quem não é tela (lembretes): avisa quando o acesso muda (inclusive ao sair de "carregando"). */
export function aoMudarAcessoPlus(cb: (plus: boolean) => void): () => void {
  mudancasPlus.add(cb);
  return () => { mudancasPlus.delete(cb); };
}

/** Leitura fora do React (ex.: replanejar lembretes). */
export function acessoPlusAtual(): AcessoPlus {
  return estado.acesso;
}

async function lerCache(): Promise<CachePlus | null> {
  const loja = lojaPlus();
  if (!loja.cacheSimulado) return getCachePlus();
  await loja.preparar?.();
  return loja.cacheSimulado();
}

async function gravarCache(c: CachePlus | null): Promise<void> {
  if (lojaPlus().cacheSimulado) return; // teste nunca escreve o cache real
  await setCachePlus(c);
}

/** Consulta a loja e resolve o acesso. Erro de rede nunca rebaixa quem a loja confirmou. */
export function atualizarAcessoPlus(): Promise<void> {
  if (consultaEmCurso) return consultaEmCurso;
  consultaEmCurso = (async () => {
    try {
      const consulta: ConsultaLoja = await lojaPlus().consultar();
      if (consulta.tipo === 'ok') produtoAtivo = consulta.status.ativo ? consulta.status.produtoId : null;
      if (lojaPlus().cacheSimulado) cache = lojaPlus().cacheSimulado!();
      const novo = atualizarCachePlus(cache, consulta, Date.now());
      if (novo !== cache) { cache = novo; await gravarCache(novo); }
      ultimaConsulta = Date.now();
      publicar({ acesso: resolverAcessoPlus(consulta, cache, Date.now()) });
    } finally {
      consultaEmCurso = null;
    }
  })();
  return consultaEmCurso;
}

/** Preço, período e período gratuito (só da loja). */
export async function carregarProdutoPlus(): Promise<void> {
  publicar({ produto: { tipo: 'carregando' } });
  publicar({ produto: await lojaPlus().produto() });
}

async function iniciar(): Promise<void> {
  if (iniciado) return;
  iniciado = true;
  cache = await lerCache();
  publicar({ lido: true, acesso: resolverAcessoPlus(null, cache, Date.now()) });
  lojaPlus().aoMudar?.(() => {
    if (lojaPlus().cacheSimulado) cache = lojaPlus().cacheSimulado!();
    atualizarAcessoPlus();
  });
  atualizarAcessoPlus();
}

/** Monta uma vez no _layout: inicia a consulta e reconsulta ao voltar para o app (no máx. 1×/min). */
export function useIniciarPlus(): void {
  useEffect(() => {
    iniciar();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active' && Date.now() - ultimaConsulta > 60_000) atualizarAcessoPlus();
    });
    return () => sub.remove();
  }, []);
}

function assinar(cb: () => void): () => void {
  ouvintes.add(cb);
  return () => { ouvintes.delete(cb); };
}
const ler = () => estado;

export interface OwBuddyPlus {
  /** A pergunta da UI. */
  plus: boolean;
  /** Já leu a última confirmação guardada (antes disso, telas Plus mostram só um carregamento discreto). */
  lido: boolean;
  acesso: AcessoPlus;
  produto: EstadoProduto;
  plataforma: ReturnType<typeof lojaPlus>['plataforma'];
  modoTeste: boolean;
  atualizar: () => Promise<void>;
  carregarProduto: () => Promise<void>;
  comprar: (p: ProdutoPlus) => Promise<ResultadoCompra>;
  restaurar: () => Promise<ResultadoRestaurar>;
  gerenciar: () => Promise<boolean>;
}

async function comprar(p: ProdutoPlus): Promise<ResultadoCompra> {
  // Já é assinante: não abre outra compra (sem cobrança duplicada).
  if (estado.acesso.plus && estado.acesso.origem === 'loja') return 'ja_assinante';
  const r = await lojaPlus().comprar(p);
  if (r === 'concluida' || r === 'ja_assinante' || r === 'pendente') await atualizarAcessoPlus();
  return r;
}

async function restaurar(): Promise<ResultadoRestaurar> {
  const r = await lojaPlus().restaurar();
  await atualizarAcessoPlus();
  return r;
}

async function gerenciar(): Promise<boolean> {
  return lojaPlus().gerenciar(estado.acesso.plus ? produtoAtivo : null);
}

export function useOwBuddyPlus(): OwBuddyPlus {
  const e = useSyncExternalStore(assinar, ler, ler);
  return {
    plus: e.acesso.plus,
    lido: e.lido,
    acesso: e.acesso,
    produto: e.produto,
    plataforma: lojaPlus().plataforma,
    modoTeste: modoTesteAtivo(),
    atualizar: atualizarAcessoPlus,
    carregarProduto: carregarProdutoPlus,
    comprar,
    restaurar,
    gerenciar,
  };
}

/** Só testes/preview: recomeça do zero depois de trocar o cenário simulado. */
export async function reiniciarAcessoPlusTeste(): Promise<void> {
  if (!modoTesteAtivo()) return;
  consultaEmCurso = null; // um cenário "carregando" deixa a consulta anterior presa para sempre
  cache = await lerCache();
  publicar({ acesso: resolverAcessoPlus(null, cache, Date.now()), produto: { tipo: 'carregando' } });
  await Promise.all([atualizarAcessoPlus(), carregarProdutoPlus()]);
}
