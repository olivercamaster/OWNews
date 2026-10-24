/**
 * Lembretes LOCAIS do OWBuddy — planejamento puro (sem expo-notifications).
 *
 * O app chama planejarLembretes() sempre que abre ou que o usuário muda escala,
 * checklist, certificados ou viagem; cancela tudo o que agendou antes e agenda
 * de novo a lista devolvida. Nada sai do aparelho: não há servidor de push.
 *
 * Cadência conservadora (no máximo LEMBRETES_MAX agendados):
 *   embarque     — 3 dias antes (09:00) e véspera (18:00), só do PRÓXIMO embarque
 *   checklist    — 2 dias antes do embarque (19:00), só se ainda há item pendente
 *   certificados — 30 e 7 dias antes da validade (09:00)
 *   viagem       — véspera (20:00) e 3 h antes do horário, quando há horário
 *   datas        — antecedência do evento (padrão por tipo: aniversário/curso 7 e 1 dia;
 *                  compromisso/consulta 1 dia) às 09:00 — um aviso por evento por dia
 *   pagamento    — N dias antes da data provável (padrão 7) às 09:00
 * O texto da notificação aparece na tela bloqueada: nunca leva localizador,
 * nome de certificado, itens do checklist, destino, nome de pessoa ou título do evento
 * (só o TIPO: "Aniversário em 7 dias").
 */
import type { Certificado, ChecklistData, EscalaConfig, EventoPessoal, Viagem } from './types';
import { LABEL_EVENTO, diasLembrete, proximaOcorrencia } from './datas-importantes';
import { proximosPagamentos, type ConfigPagamento } from './pagamento';
import { hojeISO, isoValido, resumoEscala, somarDiasISO } from './escala';
import { contarPendentes, sincronizarChecklistComCiclo } from './checklist';
import { TIPO_LABELS } from './viagem';
import { avisoDiasDocumento } from './certs';

export type LembreteTipo = 'embarque' | 'checklist' | 'certificado' | 'viagem' | 'evento' | 'pagamento';

export interface PrefsLembretes {
  /** Interruptor geral (o usuário pode desligar tudo). */
  ativo: boolean;
  embarque: boolean;
  checklist: boolean;
  certificados: boolean;
  viagem: boolean;
  /** Datas importantes (aniversário, curso, compromisso...). */
  datas: boolean;
  pagamento: boolean;
}

export const PREFS_LEMBRETES_PADRAO: PrefsLembretes = {
  ativo: false, // só liga quando o usuário aceita — nunca por padrão
  embarque: true,
  checklist: true,
  certificados: true,
  viagem: true,
  datas: true,
  pagamento: true,
};

export interface LembretePlanejado {
  /** Estável: o mesmo evento gera o mesmo id (evita duplicar ao replanejar). */
  id: string;
  tipo: LembreteTipo;
  /** Instante LOCAL "YYYY-MM-DDTHH:mm" (fuso do aparelho). */
  quando: string;
  titulo: string;
  corpo: string;
  /** Rota do app aberta ao tocar (deep link interno). */
  rota: string;
}

export const LEMBRETES_MAX = 30;

export interface EntradaLembretes {
  escala: EscalaConfig | null;
  checklist: ChecklistData | null;
  certs: Certificado[];
  viagem: Viagem | null;
  /** Datas importantes (opcional para chamadores antigos). */
  eventos?: EventoPessoal[];
  pagamento?: ConfigPagamento | null;
  prefs: PrefsLembretes;
  agora?: Date;
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** Instante local "YYYY-MM-DDTHH:mm" de um Date. */
export function instanteLocal(d: Date): string {
  return `${hojeISO(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" → Date no fuso do aparelho. */
export function dataDoInstante(quando: string): Date {
  const [dia, hora] = quando.split('T');
  const [y, m, d] = (dia ?? '').split('-').map(Number);
  const [h, mi] = (hora ?? '00:00').split(':').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, 0, 0);
}

const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function menosHoras(iso: string, hora: string, horas: number): string | null {
  const m = HORA_RE.exec(hora);
  if (!m) return null;
  let total = Number(m[1]) * 60 + Number(m[2]) - horas * 60;
  let dia = iso;
  while (total < 0) { total += 1440; dia = somarDiasISO(dia, -1); }
  return `${dia}T${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

function dataBR(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function planejarLembretes(e: EntradaLembretes): LembretePlanejado[] {
  if (!e.prefs.ativo) return [];
  const agora = e.agora ?? new Date();
  const agoraStr = instanteLocal(agora);
  const lista: LembretePlanejado[] = [];
  const add = (l: LembretePlanejado) => { if (l.quando > agoraStr) lista.push(l); };

  const resumo = resumoEscala(e.escala, agora);
  const emb = resumo.proximoEmbarqueISO;

  // Mala do PRÓXIMO embarque (mesma régua de ciclo do Meu Embarque — nunca a lista velha).
  const pendentesMala = emb && e.checklist && Array.isArray(e.checklist.items)
    ? contarPendentes(sincronizarChecklistComCiclo(e.checklist, emb, hojeISO(agora)).data).pendentes
    : 0;
  const v = e.viagem;
  const horaViagem = v?.hora && HORA_RE.test(v.hora) ? v.hora : null;
  // Viagem no dia do embarque: a véspera vira UM aviso só (embarque + viagem + mala).
  const viagemNoEmbarque = !!(emb && v && isoValido(v.data) && v.data === emb && e.prefs.embarque);

  if (emb && e.prefs.embarque) {
    add({
      id: `embarque-3d-${emb}`, tipo: 'embarque', quando: `${somarDiasISO(emb, -3)}T09:00`,
      titulo: 'Embarque em 3 dias', corpo: `Seu próximo embarque é em ${dataBR(emb)}.`, rota: '/escala',
    });
    const partes = [`Amanhã (${dataBR(emb)}) é dia de embarque.`];
    if (viagemNoEmbarque && v) {
      const tipo = v.tipo === 'AVIAO' ? 'Voo' : (TIPO_LABELS[v.tipo] ?? 'Viagem');
      partes.push(horaViagem ? `${tipo} às ${horaViagem}.` : `${tipo} amanhã.`);
    }
    if (e.prefs.checklist && pendentesMala > 0) {
      partes.push(pendentesMala === 1 ? 'Falta 1 item na mala.' : `Faltam ${pendentesMala} itens na mala.`);
    }
    add({
      id: `embarque-1d-${emb}`, tipo: 'embarque', quando: `${somarDiasISO(emb, -1)}T18:00`,
      titulo: 'Embarque amanhã', corpo: partes.join(' '), rota: viagemNoEmbarque ? '/viagem' : '/escala',
    });
  }

  if (emb && e.prefs.checklist && pendentesMala > 0) {
    add({
      id: `checklist-2d-${emb}`, tipo: 'checklist', quando: `${somarDiasISO(emb, -2)}T19:00`,
      titulo: 'Mala',
      corpo: pendentesMala === 1
        ? 'Embarque em 2 dias. Falta 1 item na mala.'
        : `Embarque em 2 dias. Faltam ${pendentesMala} itens na mala.`,
      rota: '/mala',
    });
  }

  if (e.prefs.certificados) {
    const hoje = hojeISO(agora);
    const ativos = e.certs
      .filter(c => !c._deleted && isoValido(c.validade) && c.validade! >= hoje)
      .sort((a, b) => (a.validade! < b.validade! ? -1 : 1));
    for (const c of ativos) {
      // "Avisar antes" escolhido no cadastro (padrão 30) + reforço 7 dias antes.
      const aviso = avisoDiasDocumento(c);
      for (const antes of aviso > 7 ? [aviso, 7] : [aviso]) {
        add({
          id: `cert-${antes}d-${c.id}-${c.validade}`, tipo: 'certificado',
          quando: `${somarDiasISO(c.validade!, -antes)}T09:00`,
          titulo: 'Documento perto do vencimento',
          corpo: `Um dos seus documentos vence em ${antes} ${antes === 1 ? 'dia' : 'dias'} (${dataBR(c.validade!)}). Confira em Certificados.`,
          rota: '/certs',
        });
      }
    }
  }

  if (v && e.prefs.viagem && isoValido(v.data)) {
    const tipo = TIPO_LABELS[v.tipo] ?? 'Viagem';
    const hora = horaViagem;
    if (!viagemNoEmbarque) {
      add({
        id: `viagem-1d-${v.data}`, tipo: 'viagem', quando: `${somarDiasISO(v.data, -1)}T20:00`,
        titulo: 'Viagem amanhã',
        corpo: hora ? `${tipo} amanhã às ${hora}.` : `${tipo} amanhã.`,
        rota: '/viagem',
      });
    }
    const tresHoras = hora ? menosHoras(v.data, hora, 3) : null;
    if (tresHoras) {
      add({
        id: `viagem-3h-${v.data}-${hora}`, tipo: 'viagem', quando: tresHoras,
        titulo: 'Viagem em 3 horas', corpo: `${tipo} às ${hora}.`, rota: '/viagem',
      });
    }
  }

  if (e.prefs.datas !== false && e.eventos?.length) {
    const hoje = hojeISO(agora);
    for (const ev of e.eventos) {
      const oc = proximaOcorrencia(ev, hoje);
      if (!oc || oc.emAndamento) continue;
      const tipo = LABEL_EVENTO[ev.tipo] ?? 'Evento';
      for (const antes of diasLembrete(ev)) {
        add({
          id: `evento-${antes}d-${ev.id}-${oc.iso}`, tipo: 'evento',
          quando: `${somarDiasISO(oc.iso, -antes)}T09:00`,
          titulo: antes === 0 ? `${tipo} hoje` : antes === 1 ? `${tipo} amanhã` : `${tipo} em ${antes} dias`,
          corpo: `Em ${dataBR(oc.iso)}. Toque para ver no OWBuddy.`,
          rota: '/proximos',
        });
      }
    }
  }

  if (e.prefs.pagamento !== false && e.pagamento && e.pagamento.avisoDias > 0) {
    for (const pg of proximosPagamentos(e.pagamento, hojeISO(agora), 2)) {
      const antes = e.pagamento.avisoDias;
      add({
        id: `pagamento-${antes}d-${pg.iso}`, tipo: 'pagamento',
        quando: `${somarDiasISO(pg.iso, -antes)}T09:00`,
        titulo: antes === 1 ? 'Pagamento previsto amanhã' : `Pagamento previsto em ${antes} dias`,
        corpo: `Data provável ${dataBR(pg.iso)}, pela regra que você cadastrou.`,
        rota: '/pagamento',
      });
    }
  }

  // Mais próximos primeiro; ids únicos; teto (iOS aceita até 64 agendados).
  const vistos = new Set<string>();
  return lista
    .sort((a, b) => (a.quando < b.quando ? -1 : a.quando > b.quando ? 1 : 0))
    .filter(l => (vistos.has(l.id) ? false : (vistos.add(l.id), true)))
    .slice(0, LEMBRETES_MAX);
}
