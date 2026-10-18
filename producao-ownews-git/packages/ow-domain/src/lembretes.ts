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
 * O texto da notificação aparece na tela bloqueada: nunca leva localizador,
 * nome de certificado, itens do checklist ou destino.
 */
import type { Certificado, ChecklistData, EscalaConfig, Viagem } from './types';
import { hojeISO, isoValido, resumoEscala, somarDiasISO } from './escala';
import { contarPendentes } from './checklist';
import { TIPO_LABELS } from './viagem';

export type LembreteTipo = 'embarque' | 'checklist' | 'certificado' | 'viagem';

export interface PrefsLembretes {
  /** Interruptor geral (o usuário pode desligar tudo). */
  ativo: boolean;
  embarque: boolean;
  checklist: boolean;
  certificados: boolean;
  viagem: boolean;
}

export const PREFS_LEMBRETES_PADRAO: PrefsLembretes = {
  ativo: false, // só liga quando o usuário aceita — nunca por padrão
  embarque: true,
  checklist: true,
  certificados: true,
  viagem: true,
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

export const LEMBRETES_MAX = 20;

export interface EntradaLembretes {
  escala: EscalaConfig | null;
  checklist: ChecklistData | null;
  certs: Certificado[];
  viagem: Viagem | null;
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

  if (emb && e.prefs.embarque) {
    add({
      id: `embarque-3d-${emb}`, tipo: 'embarque', quando: `${somarDiasISO(emb, -3)}T09:00`,
      titulo: 'Embarque em 3 dias', corpo: `Seu próximo embarque é em ${dataBR(emb)}.`, rota: '/escala',
    });
    add({
      id: `embarque-1d-${emb}`, tipo: 'embarque', quando: `${somarDiasISO(emb, -1)}T18:00`,
      titulo: 'Embarque amanhã', corpo: `Amanhã (${dataBR(emb)}) é dia de embarque. Bom descanso hoje.`, rota: '/escala',
    });
  }

  if (emb && e.prefs.checklist && e.checklist && Array.isArray(e.checklist.items)) {
    const { pendentes } = contarPendentes(e.checklist);
    if (pendentes > 0) {
      add({
        id: `checklist-2d-${emb}`, tipo: 'checklist', quando: `${somarDiasISO(emb, -2)}T19:00`,
        titulo: 'Meu Embarque',
        corpo: pendentes === 1
          ? 'Ainda falta 1 item na sua lista. Vai lembrando, eu guardo pra você.'
          : `Ainda faltam ${pendentes} itens na sua lista. Vai lembrando, eu guardo pra você.`,
        rota: '/mala',
      });
    }
  }

  if (e.prefs.certificados) {
    const hoje = hojeISO(agora);
    const ativos = e.certs
      .filter(c => !c._deleted && isoValido(c.validade) && c.validade! >= hoje)
      .sort((a, b) => (a.validade! < b.validade! ? -1 : 1));
    for (const c of ativos) {
      for (const antes of [30, 7]) {
        add({
          id: `cert-${antes}d-${c.id}-${c.validade}`, tipo: 'certificado',
          quando: `${somarDiasISO(c.validade!, -antes)}T09:00`,
          titulo: 'Certificado perto do vencimento',
          corpo: `Um dos seus certificados vence em ${antes} dias (${dataBR(c.validade!)}). Confira em Certificados.`,
          rota: '/certs',
        });
      }
    }
  }

  const v = e.viagem;
  if (v && e.prefs.viagem && isoValido(v.data)) {
    const tipo = TIPO_LABELS[v.tipo] ?? 'Viagem';
    const hora = v.hora && HORA_RE.test(v.hora) ? v.hora : null;
    add({
      id: `viagem-1d-${v.data}`, tipo: 'viagem', quando: `${somarDiasISO(v.data, -1)}T20:00`,
      titulo: 'Viagem amanhã',
      corpo: hora ? `${tipo} amanhã às ${hora}.` : `${tipo} amanhã.`,
      rota: '/viagem',
    });
    const tresHoras = hora ? menosHoras(v.data, hora, 3) : null;
    if (tresHoras) {
      add({
        id: `viagem-3h-${v.data}-${hora}`, tipo: 'viagem', quando: tresHoras,
        titulo: 'Viagem em 3 horas', corpo: `${tipo} às ${hora}.`, rota: '/viagem',
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
