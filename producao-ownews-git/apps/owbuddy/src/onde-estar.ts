/**
 * "Onde preciso estar?" — derivado da Minha Viagem JÁ cadastrada (não é outro sistema
 * de viagem). Só aparece na véspera e no dia da viagem; só mostra campos que o usuário
 * preencheu — nada inventado. Arquivo puro (testado em tests/companheiro.test.mjs).
 *
 * Mapa: nunca geocodificamos. Aeroporto conhecido usa as coordenadas da tabela de
 * transporte.ts; texto livre (rodoviária, hotel, ponto) vai como BUSCA para o app de
 * mapas que o sistema escolher (Android geo:, iOS Apple Maps, web Google Maps).
 */
import { TIPO_LABELS, getAeroporto, hojeISO, somarDiasISO } from '@owbuddy/domain';
import type { EscalaConfig, Viagem } from '@owbuddy/domain';
import { resolverAeroporto, type Plataforma } from './transporte';
import { normalizeHora } from './hora-utils';

export interface LinhaOnde { rotulo: string; valor: string }

export interface LocalMapa {
  nome: string;
  latitude?: number;
  longitude?: number;
}

export interface OndeEstar {
  quando: 'HOJE' | 'AMANHA';
  titulo: string;
  linhas: LinhaOnde[];
  mapa: LocalMapa | null;
}

const temTexto = (s?: string | null): s is string => !!s && !!s.trim();

/** null fora da véspera/dia da viagem ou sem viagem. */
export function ondePrecisoEstar(viagem: Viagem | null, escala: EscalaConfig | null, agora: Date = new Date(), embarqueISO?: string | null): OndeEstar | null {
  if (!viagem?.data) return null;
  const hoje = hojeISO(agora);
  const quando = viagem.data === hoje ? 'HOJE' : viagem.data === somarDiasISO(hoje, 1) ? 'AMANHA' : null;
  if (!quando) return null;

  const deEmbarque = !!embarqueISO && embarqueISO === viagem.data;
  const titulo = deEmbarque
    ? (quando === 'HOJE' ? 'Seu embarque é hoje' : 'Seu embarque é amanhã')
    : (quando === 'HOJE' ? 'Sua viagem é hoje' : 'Sua viagem é amanhã');

  const hora = viagem.hora ? normalizeHora(viagem.hora) : '';
  const linhas: LinhaOnde[] = [];
  let mapa: LocalMapa | null = null;

  switch (viagem.tipo) {
    case 'AVIAO': {
      const voo = [viagem.empresa, viagem.num_voo].filter(temTexto).join(' ');
      if (hora || voo) linhas.push({ rotulo: 'Voo', valor: [hora, voo].filter(Boolean).join(' · ') });
      const aero = resolverAeroporto(viagem.origem);
      if (aero) {
        linhas.push({ rotulo: 'Aeroporto', valor: aero.nome });
        mapa = { nome: aero.nome, latitude: aero.latitude, longitude: aero.longitude };
      } else if (temTexto(viagem.origem)) {
        linhas.push({ rotulo: 'Aeroporto', valor: viagem.origem.trim() });
        mapa = { nome: `Aeroporto ${viagem.origem.trim()}` };
      }
      if (temTexto(viagem.destino)) linhas.push({ rotulo: 'Destino', valor: viagem.destino.trim() });
      if (temTexto(viagem.assento)) linhas.push({ rotulo: 'Assento', valor: viagem.assento.trim() });
      break;
    }
    case 'ONIBUS':
      if (hora) linhas.push({ rotulo: 'Ônibus', valor: hora });
      if (temTexto(viagem.origem)) {
        linhas.push({ rotulo: 'Saída', valor: viagem.origem.trim() });
        mapa = { nome: viagem.origem.trim() };
      }
      if (temTexto(viagem.destino)) linhas.push({ rotulo: 'Destino', valor: viagem.destino.trim() });
      if (temTexto(viagem.empresa)) linhas.push({ rotulo: 'Empresa', valor: viagem.empresa.trim() });
      if (temTexto(viagem.poltrona)) linhas.push({ rotulo: 'Poltrona', valor: viagem.poltrona.trim() });
      break;
    case 'VAN':
    case 'EMPRESA':
      if (hora) linhas.push({ rotulo: viagem.tipo === 'VAN' ? 'Van' : 'Saída', valor: hora });
      if (temTexto(viagem.ponto)) {
        linhas.push({ rotulo: 'Local', valor: viagem.ponto.trim() });
        mapa = { nome: viagem.ponto.trim() };
      }
      if (temTexto(viagem.destino)) linhas.push({ rotulo: 'Destino', valor: viagem.destino.trim() });
      break;
    case 'CARRO':
      if (hora) linhas.push({ rotulo: 'Saída', valor: hora });
      if (temTexto(viagem.destino)) {
        linhas.push({ rotulo: 'Destino', valor: viagem.destino.trim() });
        mapa = { nome: viagem.destino.trim() };
      }
      break;
    default:
      if (hora) linhas.push({ rotulo: TIPO_LABELS[viagem.tipo] ?? 'Saída', valor: hora });
      if (temTexto(viagem.ponto)) { linhas.push({ rotulo: 'Local', valor: viagem.ponto.trim() }); mapa = { nome: viagem.ponto.trim() }; }
      if (temTexto(viagem.destino)) linhas.push({ rotulo: 'Destino', valor: viagem.destino.trim() });
  }

  // Base cadastrada na escala (heliporto/aeroporto offshore) — dado real do usuário.
  const base = escala?.aeroporto ? getAeroporto(escala.aeroporto) : undefined;
  if (deEmbarque && base) linhas.push({ rotulo: 'Base', valor: `${base.nome} (${base.code})` });

  return { quando, titulo, linhas, mapa };
}

/**
 * Links do mapa: [principal, reserva]. Android `geo:` abre o seletor de apps de mapa
 * (não exige Google Maps); se nada responder, a reserva abre no navegador.
 */
export function linksMapa(local: LocalMapa, plataforma: Plataforma): [string, string] {
  const temCoord = typeof local.latitude === 'number' && typeof local.longitude === 'number';
  const q = encodeURIComponent(local.nome);
  const coord = temCoord ? `${local.latitude},${local.longitude}` : '';
  const web = `https://www.google.com/maps/search/?api=1&query=${temCoord ? encodeURIComponent(coord) : q}`;
  if (plataforma === 'android') {
    return [temCoord ? `geo:${coord}?q=${coord}(${q})` : `geo:0,0?q=${q}`, web];
  }
  if (plataforma === 'ios') {
    return [temCoord ? `https://maps.apple.com/?ll=${coord}&q=${q}` : `https://maps.apple.com/?q=${q}`, web];
  }
  return [web, web];
}

// ─── Antes de embarcar (faltando poucos dias, ainda sem viagem amanhã/hoje) ──

export interface LinhaPreparacao {
  chave: 'viagem' | 'documentos';
  rotulo: string;
  valor: string;
  atencao: boolean;
  rota: '/viagem' | '/certs';
}

/**
 * Resumo enxuto da preparação: só o que existe. Viagem cadastrada → data/hora;
 * sem viagem → convite. Documentos: só aparece se a pessoa cadastrou algum.
 * (A mala já está no card da escala no pré-embarque — não repete aqui.)
 */
export function linhasPreparacao(
  viagem: Viagem | null,
  certs: { nome: string; validade?: string; _deleted?: boolean }[],
  embarqueISO: string,
  calc: (c: { nome: string; validade?: string }) => { status: string; dias: number | null },
): LinhaPreparacao[] {
  const out: LinhaPreparacao[] = [];
  if (viagem?.data && viagem.data >= somarDiasISO(embarqueISO, -3) && viagem.data <= embarqueISO) {
    const hora = viagem.hora ? normalizeHora(viagem.hora) : '';
    const dia = `${viagem.data.slice(8, 10)}/${viagem.data.slice(5, 7)}`;
    out.push({ chave: 'viagem', rotulo: TIPO_LABELS[viagem.tipo] ?? 'Viagem', valor: hora ? `${dia} · ${hora}` : dia, atencao: false, rota: '/viagem' });
  } else {
    out.push({ chave: 'viagem', rotulo: 'Viagem', valor: 'Cadastrar viagem', atencao: true, rota: '/viagem' });
  }
  const ativos = certs.filter(c => !c._deleted && c.validade);
  if (ativos.length > 0) {
    const problemas = ativos
      .map(c => ({ c, r: calc(c) }))
      .filter(x => x.r.status !== 'valido' && x.r.status !== 'sem-data')
      .sort((a, b) => (a.r.dias ?? 0) - (b.r.dias ?? 0));
    const p = problemas[0];
    const valor = !p ? 'Tudo certo'
      : problemas.length > 1 ? `${problemas.length} precisam de atenção`
      : p.r.dias! < 0 ? `${p.c.nome} vencido`
      : p.r.dias === 0 ? `${p.c.nome} vence hoje`
      : `${p.c.nome} vence em ${p.r.dias} ${p.r.dias === 1 ? 'dia' : 'dias'}`;
    out.push({ chave: 'documentos', rotulo: 'Documentos', valor, atencao: !!p, rota: '/certs' });
  }
  return out;
}
