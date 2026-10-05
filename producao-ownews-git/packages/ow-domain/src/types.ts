export type EscalaTipo = '14x14' | '14x21' | '28x28' | '21x21' | '7x7' | 'custom';
export type TipoRef = 'embarquei' | 'desembarquei';

export interface EscalaConfig {
  tipo: EscalaTipo;
  dataRef: string;
  tipoRef: TipoRef;
  diasEmbarcado?: number;
  diasFolga?: number;
}

export type MomentoTipo =
  | 'SEM_ESCALA'
  | 'FOLGA'
  | 'EMBARQUE_DISTANTE'
  | 'EMBARQUE_PROXIMO'
  | 'VESPERA_EMBARQUE'
  | 'EMBARCADO'
  | 'DESEMBARQUE_PROXIMO';

export interface Momento {
  tipo: MomentoTipo;
  diasEmbarque?: number;
  diasDesembarque?: number;
}

export interface EscalaCalc {
  embarcado: boolean;
  diasRestantes: number;
  dEm: number;
  dFo: number;
  ciclo: number;
}

export type BuddyTom = 'discreto' | 'buddy' | 'resenha';
export type BuddyTrat = 'neutro' | 'parceiro' | 'parceira';

export interface BuddyPrefs {
  tom: BuddyTom;
  trat: BuddyTrat;
  apelido: string;
  updated_at?: string;
}

export type ViagemTipo = 'AVIAO' | 'ONIBUS' | 'CARRO' | 'VAN' | 'EMPRESA' | 'OUTRO';

export interface Viagem {
  tipo: ViagemTipo;
  data: string;
  hora?: string;
  empresa?: string;
  num_voo?: string;
  localizador?: string;
  origem?: string;
  destino?: string;
  poltrona?: string;
  assento?: string;
  ponto?: string;
  obs?: string;
  updated_at?: string;
}

export type CertStatus = 'valido' | 'atencao' | 'vence-hoje' | 'vencido' | 'sem-data';

export interface Certificado {
  id: string;
  nome: string;
  validade?: string;
  emissao?: string;
  instituicao?: string;
  obs?: string;
  _deleted?: boolean;
}

export interface CertCalc {
  status: CertStatus;
  critico: boolean;
  dias: number | null;
  label: string;
}

export interface ChecklistItem {
  id: string;
  t: string;
  cat: string;
  ok: boolean;
}

export interface ChecklistData {
  items: ChecklistItem[];
  ciclo: string;
}

export type BuddyEventoKey =
  | 'folga_distante'
  | 'embarque_distante'
  | 'embarque_proximo'
  | 'vespera_embarque'
  | 'embarcado'
  | 'desembarque_proximo'
  | 'viagem_amanha'
  | 'mala_incompleta'
  | 'cert_vencendo';

export interface BuddyTemplateCtx {
  dias?: number;
  pendentes?: number;
  certNome?: string;
}
