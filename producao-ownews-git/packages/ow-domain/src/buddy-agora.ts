/**
 * Buddy Agora — motor contextual (puro, local, determinístico, sem rede e sem IA).
 *
 * Junta o que JÁ existe — Minha Escala, Meu Embarque, Minha Viagem, Certificados,
 * Datas importantes (EventoPessoal) e Meu Pagamento — numa lista normalizada de
 * acontecimentos. Nada é armazenado: tudo é derivado a cada chamada.
 *
 * Ordenação (explícita e testada):
 *   1. faixa de tempo: HOJE → AMANHÃ → PRÓXIMOS 7 DIAS → PRÓXIMOS 30 DIAS → MAIS ADIANTE
 *   2. criticidade dentro da faixa: certificado ≤ 7 dias → viagem → embarque/desembarque →
 *      checklist → curso → consulta/compromisso/trabalho/documento (e certificado > 7 dias) →
 *      aniversário → pessoal/outro → pagamento
 *   3. data, hora, título, id.
 */
import type { Certificado, ChecklistData, EscalaConfig, EventoPessoal, EventoTipo, Viagem } from './types';
import { diasEntreISO, hojeISO as hojeISOde, isoValido, resumoEscala } from './escala';
import { calcCertStatus } from './certs';
import { contarPendentes, sincronizarChecklistComCiclo } from './checklist';
import { TIPO_LABELS } from './viagem';
import { escalaNaData, fraseEscalaNaData, proximaOcorrencia, tituloEvento } from './datas-importantes';
import { proximoPagamento, type ConfigPagamento } from './pagamento';

export type AcontecimentoTipo = 'EMBARQUE' | 'DESEMBARQUE' | 'VIAGEM' | 'CERTIFICADO' | 'CHECKLIST' | 'PAGAMENTO' | 'EVENTO';
export type AcontecimentoOrigem = 'escala' | 'viagem' | 'certificado' | 'checklist' | 'evento' | 'pagamento';
export type Faixa = 'HOJE' | 'AMANHA' | 'SEMANA' | 'MES' | 'DEPOIS';

export const LABEL_FAIXA: Record<Faixa, string> = {
  HOJE: 'Hoje', AMANHA: 'Amanhã', SEMANA: 'Esta semana', MES: 'Próximos 30 dias', DEPOIS: 'Mais adiante',
};
export const ORDEM_FAIXAS: Faixa[] = ['HOJE', 'AMANHA', 'SEMANA', 'MES', 'DEPOIS'];

export type AcaoAcontecimento =
  | { tipo: 'presente'; label: string }
  | { tipo: 'transporte'; label: string }
  | { tipo: 'rota'; label: string; rota: string; params?: Record<string, string> };

export interface Acontecimento {
  id: string;
  tipo: AcontecimentoTipo;
  /** Tipo do evento pessoal (só em tipo EVENTO). */
  subtipo?: EventoTipo;
  titulo: string;
  dataISO: string;
  hora?: string;
  /** Dias até a data (0 = hoje; negativo só para certificado já vencido). */
  dias: number;
  faixa: Faixa;
  /** Criticidade dentro da faixa (menor = mais importante). */
  criticidade: number;
  recorrencia: 'nenhuma' | 'anual' | 'mensal' | 'ciclo';
  origem: AcontecimentoOrigem;
  /** Tela de origem (toque na linha). */
  rota: string;
  rotaParams?: Record<string, string>;
  /** No máximo UMA ação principal. */
  acao?: AcaoAcontecimento;
  /** Texto de apoio curto (estado da escala na data, regra do pagamento...). */
  detalhe?: string;
  notificavel: boolean;
  /** Pagamento: dentro da janela de aviso escolhida (Home só mostra se true). */
  dentroDoAviso?: boolean;
  /** Evento: pessoa/relação para a tela de presentes (nunca vai para analytics). */
  meta?: { pessoa?: string; relacao?: string; eventoId?: string; emAndamento?: boolean };
}

export interface EntradaBuddyAgora {
  escala: EscalaConfig | null;
  checklist: ChecklistData | null;
  certs: Certificado[];
  viagem: Viagem | null;
  eventos: EventoPessoal[];
  pagamento: ConfigPagamento | null;
  hoje?: Date;
  /** Horizonte em dias (padrão 366). */
  horizonte?: number;
}

export function faixaDe(dias: number): Faixa {
  if (dias <= 0) return 'HOJE';
  if (dias === 1) return 'AMANHA';
  if (dias <= 7) return 'SEMANA';
  if (dias <= 30) return 'MES';
  return 'DEPOIS';
}

const CRIT_EVENTO: Record<EventoTipo, number> = {
  CURSO: 4, CONSULTA: 5, COMPROMISSO: 5, TRABALHO: 5, DOCUMENTO: 5,
  ANIVERSARIO: 6, PESSOAL: 7, OUTRO: 7, DATA_ESPECIAL: 7, VIAGEM: 7,
};

const ORDEM_FAIXA: Record<Faixa, number> = { HOJE: 0, AMANHA: 1, SEMANA: 2, MES: 3, DEPOIS: 4 };

export function compararAcontecimentos(a: Acontecimento, b: Acontecimento): number {
  return ORDEM_FAIXA[a.faixa] - ORDEM_FAIXA[b.faixa]
    || a.criticidade - b.criticidade
    || a.dias - b.dias
    || (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99')
    || a.titulo.localeCompare(b.titulo, 'pt-BR')
    || a.id.localeCompare(b.id);
}

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function ddmm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "Hoje · 08:00", "Amanhã", "23/10 · daqui a 4 dias". */
export function quandoTexto(dias: number, iso: string, hora?: string): string {
  const h = hora ? ` · ${hora}` : '';
  if (dias < 0) return `${ddmm(iso)} · há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`;
  if (dias === 0) return `Hoje${h}`;
  if (dias === 1) return `Amanhã${h}`;
  return `${ddmm(iso)}${h} · daqui a ${dias} dias`;
}

function montar(a: Omit<Acontecimento, 'faixa'>): Acontecimento {
  return { ...a, faixa: faixaDe(a.dias) };
}

export function gerarAcontecimentos(e: EntradaBuddyAgora): Acontecimento[] {
  const agora = e.hoje ?? new Date();
  const hoje = hojeISOde(agora);
  const horizonte = e.horizonte ?? 366;
  const lista: Acontecimento[] = [];
  const resumo = resumoEscala(e.escala, agora);

  // ── Escala ──
  if (resumo.calc) {
    if (resumo.proximoEmbarqueISO && resumo.diasParaEmbarque != null) {
      lista.push(montar({
        id: `embarque-${resumo.proximoEmbarqueISO}`, tipo: 'EMBARQUE', titulo: 'Embarque',
        dataISO: resumo.proximoEmbarqueISO, dias: resumo.diasParaEmbarque, criticidade: 2,
        recorrencia: 'ciclo', origem: 'escala', rota: '/escala', notificavel: true,
        acao: { tipo: 'rota', label: 'Ver checklist', rota: '/mala' },
      }));
    }
    if (resumo.estado === 'EMBARCADO' && resumo.proximoDesembarqueISO && resumo.diasParaDesembarque != null) {
      lista.push(montar({
        id: `desembarque-${resumo.proximoDesembarqueISO}`, tipo: 'DESEMBARQUE', titulo: 'Desembarque',
        dataISO: resumo.proximoDesembarqueISO, dias: resumo.diasParaDesembarque, criticidade: 2,
        recorrencia: 'ciclo', origem: 'escala', rota: '/escala', notificavel: false,
      }));
    }
    // ── Checklist incompleto perto do embarque (mesma regra de ciclo do Meu Embarque) ──
    if (resumo.estado === 'DE_FOLGA' && resumo.proximoEmbarqueISO && resumo.diasParaEmbarque != null && resumo.diasParaEmbarque <= 7) {
      const lista2 = sincronizarChecklistComCiclo(e.checklist, resumo.proximoEmbarqueISO).data;
      const { pendentes } = contarPendentes(lista2);
      if (pendentes > 0) {
        lista.push(montar({
          id: `checklist-${resumo.proximoEmbarqueISO}`, tipo: 'CHECKLIST',
          titulo: pendentes === 1 ? 'Falta 1 item para o embarque' : `Faltam ${pendentes} itens para o embarque`,
          dataISO: resumo.proximoEmbarqueISO, dias: resumo.diasParaEmbarque, criticidade: 3,
          recorrencia: 'ciclo', origem: 'checklist', rota: '/mala', notificavel: true,
        }));
      }
    }
  }

  // ── Viagem ──
  const v = e.viagem;
  if (v && isoValido(v.data) && v.data >= hoje) {
    const dias = diasEntreISO(hoje, v.data);
    if (dias <= horizonte) {
      const hora = v.hora && HORA_RE.test(v.hora) ? v.hora : undefined;
      const destino = v.destino?.trim();
      const titulo = v.tipo === 'AVIAO'
        ? (destino ? `Voo para ${destino}` : 'Voo')
        : (destino ? `${TIPO_LABELS[v.tipo] ?? 'Viagem'} para ${destino}` : TIPO_LABELS[v.tipo] ?? 'Viagem');
      lista.push(montar({
        id: `viagem-${v.data}`, tipo: 'VIAGEM', titulo, dataISO: v.data, hora, dias, criticidade: 1,
        recorrencia: 'nenhuma', origem: 'viagem', rota: '/viagem', notificavel: true,
        acao: { tipo: 'transporte', label: v.tipo === 'AVIAO' ? 'Ir para o aeroporto' : 'Transporte' },
      }));
    }
  }

  // ── Certificados (os existentes; nada duplicado) ──
  for (const c of e.certs) {
    if (c._deleted || !c.validade || !isoValido(c.validade)) continue;
    const calc = calcCertStatus(c, agora);
    if (calc.dias == null || calc.dias > 30 || calc.dias < -30) continue;
    const titulo = calc.dias < 0 ? `${c.nome} venceu` : calc.dias === 0 ? `${c.nome} vence hoje` : `${c.nome} vence`;
    lista.push({
      id: `cert-${c.id}-${c.validade}`, tipo: 'CERTIFICADO', titulo, dataISO: c.validade,
      dias: calc.dias, faixa: faixaDe(calc.dias), criticidade: calc.dias <= 7 ? 0 : 5,
      recorrencia: 'nenhuma', origem: 'certificado', rota: '/certs', notificavel: true,
      acao: { tipo: 'rota', label: 'Ver certificado', rota: '/certs' },
    });
  }

  // ── Datas importantes ──
  for (const ev of e.eventos) {
    const oc = proximaOcorrencia(ev, hoje);
    if (!oc || oc.dias > horizonte) continue;
    const hora = ev.hora_ini && HORA_RE.test(ev.hora_ini) ? ev.hora_ini : undefined;
    const acao: AcaoAcontecimento | undefined =
      ev.tipo === 'ANIVERSARIO' ? { tipo: 'presente', label: 'Ver ideia de presente' }
      : ev.tipo === 'CURSO' ? { tipo: 'rota', label: 'Ver detalhes', rota: '/escala-evento-form', params: { id: ev.id } }
      : undefined;
    lista.push(montar({
      id: `evento-${ev.id}-${oc.iso}`, tipo: 'EVENTO', subtipo: ev.tipo, titulo: tituloEvento(ev),
      dataISO: oc.iso, hora, dias: oc.dias, criticidade: CRIT_EVENTO[ev.tipo] ?? 7,
      recorrencia: ev.recorrencia === 'anual' ? 'anual' : 'nenhuma', origem: 'evento',
      rota: '/escala-evento-form', rotaParams: { id: ev.id },
      acao, detalhe: fraseEscalaNaData(escalaNaData(e.escala, oc.iso), oc.dias === 0) ?? undefined,
      notificavel: true,
      meta: { pessoa: ev.pessoa, relacao: ev.relacao, eventoId: ev.id, emAndamento: oc.emAndamento },
    }));
  }

  // ── Pagamento previsto ──
  const pg = proximoPagamento(e.pagamento, hoje);
  if (pg && e.pagamento) {
    lista.push(montar({
      id: `pagamento-${pg.iso}`, tipo: 'PAGAMENTO',
      titulo: pg.dias === 0 ? 'Pagamento previsto para hoje' : 'Pagamento previsto',
      dataISO: pg.iso, dias: pg.dias, criticidade: 8, recorrencia: 'mensal', origem: 'pagamento',
      rota: '/pagamento', notificavel: e.pagamento.avisoDias > 0,
      dentroDoAviso: e.pagamento.avisoDias > 0 && pg.dias <= e.pagamento.avisoDias,
      detalhe: 'Pela regra que você cadastrou.',
      acao: { tipo: 'rota', label: 'Ver regra', rota: '/pagamento' },
    }));
  }

  return lista.sort(compararAcontecimentos);
}

export interface OpcoesHome {
  max?: number;
  /** Tipos que a Home já mostra em outro lugar (ex.: embarque no card da escala). */
  excluirTipos?: AcontecimentoTipo[];
}

/**
 * Recorte compacto da Home: até `max` (3) itens dos próximos 30 dias. Pagamento só dentro
 * da janela de aviso. Devolve também o total para "Ver todos".
 */
export function acontecimentosParaHome(lista: Acontecimento[], o: OpcoesHome = {}): { itens: Acontecimento[]; total: number } {
  const max = o.max ?? 3;
  const excluir = new Set(o.excluirTipos ?? ['EMBARQUE', 'DESEMBARQUE']);
  const elegiveis = lista.filter(a =>
    !excluir.has(a.tipo)
    && a.dias <= 30
    && (a.tipo !== 'PAGAMENTO' || a.dentroDoAviso === true));
  return { itens: elegiveis.slice(0, max), total: lista.length };
}

/** Agrupa em seções Hoje / Amanhã / Esta semana / Próximos 30 dias / Mais adiante (vazias somem). */
export function agruparPorFaixa(lista: Acontecimento[]): { faixa: Faixa; label: string; itens: Acontecimento[] }[] {
  return ORDEM_FAIXAS
    .map(f => ({ faixa: f, label: LABEL_FAIXA[f], itens: lista.filter(a => a.faixa === f) }))
    .filter(g => g.itens.length > 0);
}
