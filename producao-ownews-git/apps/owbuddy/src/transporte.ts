/**
 * Transporte terrestre — só ENCAMINHA para o app oficial; o OWBuddy não pede corrida,
 * não paga, não lê nem guarda localização (a origem é definida pela própria Uber/99).
 *
 * Uber — link universal OFICIAL (developer.uber.com › Ride Requests › Deep links):
 *   https://m.uber.com/looking?drop[0]={"latitude":..,"longitude":..,"addressLine1":..,"addressLine2":..}
 *   Abre o app se instalado; senão loja (Android/iOS) ou m.uber.com (web). Só usamos destino
 *   com COORDENADAS conhecidas (a doc não garante endereço sem lat/long); sem destino, abre
 *   o fluxo da Uber para o usuário digitar. `client_id` é opcional aqui: sem cadastro de
 *   app na Uber o link funciona; com cadastro, preencher UBER_CLIENT_ID.
 *
 * 99 — auditoria (2026-10-19): não há deep link nem link universal DOCUMENTADO para abrir
 *   corrida com destino. Não inventamos "99://". O botão abre a página OFICIAL do app na
 *   loja (Android com.taxis99, iOS id553663691 — mostra "Abrir" se instalado) e, na web,
 *   99app.com. O destino é informado pelo usuário dentro da 99.
 *
 * Arquivo puro (sem React Native) — testado em tests/transporte.test.mjs.
 */
import { AEROPORTOS_ESCALA } from '@owbuddy/domain';
import type { EscalaConfig, Viagem } from '@owbuddy/domain';

export const UBER_CLIENT_ID = '';
export const NOVENTA_E_NOVE_COM_DESTINO = false;

export type Plataforma = 'android' | 'ios' | 'web';

export interface Destino {
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
}

// Aeroportos comerciais mais usados por quem embarca + bases offshore (coordenadas do terminal).
const AEROPORTOS: { codigos: string[]; nomes: string[]; nome: string; endereco: string; lat: number; lon: number }[] = [
  { codigos: ['GIG', 'SBGL'], nomes: ['galeão', 'galeao', 'tom jobim'], nome: 'Aeroporto do Galeão (GIG)', endereco: 'Rio de Janeiro, RJ', lat: -22.8099, lon: -43.2506 },
  { codigos: ['SDU', 'SBRJ'], nomes: ['santos dumont'], nome: 'Aeroporto Santos Dumont (SDU)', endereco: 'Rio de Janeiro, RJ', lat: -22.9105, lon: -43.1631 },
  { codigos: ['GRU', 'SBGR'], nomes: ['guarulhos'], nome: 'Aeroporto de Guarulhos (GRU)', endereco: 'Guarulhos, SP', lat: -23.4356, lon: -46.4731 },
  { codigos: ['CGH', 'SBSP'], nomes: ['congonhas'], nome: 'Aeroporto de Congonhas (CGH)', endereco: 'São Paulo, SP', lat: -23.6261, lon: -46.6564 },
  { codigos: ['VCP', 'SBKP'], nomes: ['viracopos'], nome: 'Aeroporto de Viracopos (VCP)', endereco: 'Campinas, SP', lat: -23.0074, lon: -47.1345 },
  { codigos: ['CNF', 'SBCF'], nomes: ['confins'], nome: 'Aeroporto de Confins (CNF)', endereco: 'Confins, MG', lat: -19.6244, lon: -43.9719 },
  { codigos: ['VIX', 'SBVT'], nomes: ['vitória', 'vitoria'], nome: 'Aeroporto de Vitória (VIX)', endereco: 'Vitória, ES', lat: -20.2581, lon: -40.2864 },
  { codigos: ['MEA', 'SBME'], nomes: ['macaé', 'macae'], nome: 'Aeroporto de Macaé (MEA)', endereco: 'Macaé, RJ', lat: -22.3431, lon: -41.7660 },
  { codigos: ['CAW', 'SBCP'], nomes: ['campos dos goytacazes'], nome: 'Aeroporto de Campos (CAW)', endereco: 'Campos dos Goytacazes, RJ', lat: -21.6983, lon: -41.3017 },
  { codigos: ['CFB', 'SBCB'], nomes: ['cabo frio'], nome: 'Aeroporto de Cabo Frio (CFB)', endereco: 'Cabo Frio, RJ', lat: -22.9210, lon: -42.0743 },
  { codigos: ['BSB', 'SBBR'], nomes: ['brasília', 'brasilia'], nome: 'Aeroporto de Brasília (BSB)', endereco: 'Brasília, DF', lat: -15.8697, lon: -47.9208 },
  { codigos: ['SSA', 'SBSV'], nomes: ['salvador'], nome: 'Aeroporto de Salvador (SSA)', endereco: 'Salvador, BA', lat: -12.9086, lon: -38.3225 },
  { codigos: ['REC', 'SBRF'], nomes: ['recife'], nome: 'Aeroporto do Recife (REC)', endereco: 'Recife, PE', lat: -8.1265, lon: -34.9236 },
  { codigos: ['FOR', 'SBFZ'], nomes: ['fortaleza'], nome: 'Aeroporto de Fortaleza (FOR)', endereco: 'Fortaleza, CE', lat: -3.7763, lon: -38.5326 },
  { codigos: ['POA', 'SBPA'], nomes: ['porto alegre'], nome: 'Aeroporto de Porto Alegre (POA)', endereco: 'Porto Alegre, RS', lat: -29.9939, lon: -51.1714 },
  { codigos: ['CWB', 'SBCT'], nomes: ['curitiba'], nome: 'Aeroporto de Curitiba (CWB)', endereco: 'São José dos Pinhais, PR', lat: -25.5285, lon: -49.1758 },
  { codigos: ['FLN', 'SBFL'], nomes: ['florianópolis', 'florianopolis'], nome: 'Aeroporto de Florianópolis (FLN)', endereco: 'Florianópolis, SC', lat: -27.6703, lon: -48.5525 },
  { codigos: ['AJU', 'SBAR'], nomes: ['aracaju'], nome: 'Aeroporto de Aracaju (AJU)', endereco: 'Aracaju, SE', lat: -10.9840, lon: -37.0703 },
  { codigos: ['NAT', 'SBSG'], nomes: ['natal'], nome: 'Aeroporto de Natal (NAT)', endereco: 'São Gonçalo do Amarante, RN', lat: -5.7681, lon: -35.3761 },
];

const sem = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Reconhece aeroporto pelo código (IATA/ICAO) ou nome no texto que o usuário digitou. */
export function resolverAeroporto(texto: string | null | undefined): Destino | null {
  if (!texto?.trim()) return null;
  const t = texto.trim();
  const codigos: string[] = t.toUpperCase().match(/\b[A-Z]{3,4}\b/g) ?? [];
  const norm = sem(t);
  const a = AEROPORTOS.find(x => x.codigos.some(c => codigos.includes(c)))
    ?? AEROPORTOS.find(x => x.nomes.some(n => norm.includes(sem(n))));
  return a ? { nome: a.nome, endereco: a.endereco, latitude: a.lat, longitude: a.lon } : null;
}

/** Aeroporto de PARTIDA da viagem de avião (para onde a pessoa precisa ir). */
export function destinoDaViagem(v: Viagem | null): Destino | null {
  if (!v || v.tipo !== 'AVIAO') return null;
  return resolverAeroporto(v.origem);
}

/** Base de embarque da escala (heliporto/aeroporto offshore cadastrado). */
export function destinoDaBase(escala: EscalaConfig | null): Destino | null {
  const b = escala?.aeroporto ? AEROPORTOS_ESCALA.find(a => a.code === escala.aeroporto) : undefined;
  return b ? { nome: `Base ${b.nome} (${b.code})`, endereco: `${b.cidade}, ${b.uf}`, latitude: b.lat, longitude: b.lon } : null;
}

export function linkUber(destino: Destino | null): string {
  const params: string[] = [];
  if (UBER_CLIENT_ID) params.push(`client_id=${encodeURIComponent(UBER_CLIENT_ID)}`);
  if (destino) {
    const drop = { latitude: destino.latitude, longitude: destino.longitude, addressLine1: destino.nome, addressLine2: destino.endereco };
    params.push(`drop[0]=${encodeURIComponent(JSON.stringify(drop))}`);
  }
  return `https://m.uber.com/looking${params.length ? '?' + params.join('&') : ''}`;
}

/** 99: página oficial (sem deep link de destino documentado). */
export function link99(plataforma: Plataforma): string {
  if (plataforma === 'android') return 'https://play.google.com/store/apps/details?id=com.taxis99';
  if (plataforma === 'ios') return 'https://apps.apple.com/br/app/id553663691';
  return 'https://99app.com/';
}

export interface OpcaoDestino {
  id: string;
  label: string;
  destino: Destino | null;
}

/** "Para onde você está indo?": aeroporto da viagem e base de embarque, quando conhecidos. */
export function opcoesTransporte(viagem: Viagem | null, escala: EscalaConfig | null): OpcaoDestino[] {
  const out: OpcaoDestino[] = [];
  const aero = destinoDaViagem(viagem);
  if (aero) out.push({ id: 'viagem', label: 'Aeroporto da minha viagem', destino: aero });
  const base = destinoDaBase(escala);
  if (base) out.push({ id: 'base', label: 'Minha base de embarque', destino: base });
  return out;
}
