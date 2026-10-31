/**
 * RADAR → CANDIDATOS DE PAUTA. Compara o snapshot anterior com o novo e descreve o que mudou
 * na base oficial. Nada é publicado: a lista fica para a redação (rota interna do worker).
 * Toda variação traz valor anterior, atual, absoluta e percentual calculadas aqui (testadas).
 */
import { mesPorExtenso, variacao } from '../lib/texto.mjs';

const fmt = (n) => Math.round(n).toLocaleString('pt-BR');

export function detectarPautas(anterior, novo, { detectadoEm = new Date().toISOString() } = {}) {
  if (!anterior) return [];
  const pautas = [];
  const add = (tipo, titulo, detalhe, extra = {}) => pautas.push({ tipo, titulo, detalhe, fonte: 'ANP', detectado_em: detectadoEm, ...extra });
  const mapa = (l) => new Map((l || []).map((x) => [x.id, x]));

  const uA = mapa(anterior.unidades), uN = mapa(novo.unidades);
  for (const [id, u] of uN) {
    if (!uA.has(id)) add(u.categoria === 'sonda' ? 'nova_sonda' : 'nova_unidade',
      `${u.nome} aparece na base oficial da ANP`, u.categoria === 'sonda' ? `Sonda com atividade registrada em campo marítimo (${u.campos.map((c) => c.nome).join(', ')}).` : `Instalação de produção (${u.tipo || 'tipo não informado'}) na bacia ${u.bacia || 'não informada'}.`, { entidade: id });
    else if (u.operador && uA.get(id).operador && u.operador !== uA.get(id).operador) add('mudanca_operador', `Operador de ${u.nome} mudou na base da ANP`, `Antes: ${uA.get(id).operador}. Agora: ${u.operador}.`, { entidade: id });
  }
  for (const [id, u] of uA) if (!uN.has(id)) add('unidade_saiu', `${u.nome} saiu da base da ANP`, 'Pode indicar fim de operação, troca de base ou mudança de nome — confirmar antes de publicar.', { entidade: id });

  const cA = mapa(anterior.campos), cN = mapa(novo.campos);
  for (const [id, c] of cN) {
    if (!cA.has(id)) add('novo_campo', `Novo campo marítimo na base: ${c.nome}`, `Bacia ${c.bacia || 'não informada'}, situação ${c.situacao || 'não informada'}.`, { entidade: id });
    else if (c.situacao !== cA.get(id).situacao) add('mudanca_situacao_campo', `${c.nome} mudou de situação: ${cA.get(id).situacao} → ${c.situacao}`, '', { entidade: id });
  }

  // produção: novo mês de referência → variação mês contra mês (nacional, mar)
  const pA = anterior.producao, pN = novo.producao;
  if (pN && pN.mes_referencia && pA && pA.mes_referencia !== pN.mes_referencia && pN.nacional.length >= 2) {
    const [ant, atu] = pN.nacional.slice(-2);
    const v = variacao(atu.petroleo_bbl_d, ant.petroleo_bbl_d);
    if (v) add('producao_mensal', `Produção de petróleo no mar em ${mesPorExtenso(atu.mes)}: ${fmt(atu.petroleo_bbl_d)} barris/dia`,
      `${mesPorExtenso(ant.mes)}: ${fmt(ant.petroleo_bbl_d)} barris/dia. Variação: ${v.absoluta >= 0 ? '+' : ''}${fmt(v.absoluta)} barris/dia (${v.percentual === null ? 'n/d' : `${v.percentual >= 0 ? '+' : ''}${v.percentual.toFixed(1).replace('.', ',')}%`}).`,
      { dados: { mes: atu.mes, anterior: ant.petroleo_bbl_d, atual: atu.petroleo_bbl_d, ...v } });
  }

  // exploração: novas declarações de comercialidade e descobertas
  const dcA = new Set((anterior.exploracao?.declaracoes || []).map((x) => `${x.area}|${x.data}`));
  for (const x of novo.exploracao?.declaracoes || []) if (!dcA.has(`${x.area}|${x.data}`)) add('declaracao_comercialidade', `Declaração de comercialidade: ${x.area}`, `${x.operador || 'Operador não informado'} · bacia ${x.bacia || 'não informada'} · ${x.data}.`);
  const descA = new Set((anterior.exploracao?.pocos || []).filter((p) => p.descoberta).map((p) => p.poco));
  for (const p of novo.exploracao?.pocos || []) if (p.descoberta && !descA.has(p.poco)) add('nova_descoberta', `Notificação de descoberta no poço ${p.poco}`, `${p.operador || ''} · bloco ${p.bloco || 'n/i'} · ${p.fluido || 'fluido não informado'}.`);

  // previsões: nova referência anual
  if ((novo.futuro?.exploracao_prevista_mar?.ano_referencia || 0) > (anterior.futuro?.exploracao_prevista_mar?.ano_referencia || 0)) add('nova_previsao', 'ANP publicou nova previsão de atividades exploratórias', `Ano de referência ${novo.futuro.exploracao_prevista_mar.ano_referencia}.`);
  return pautas;
}
