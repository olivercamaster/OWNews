// '14x28' existe no OWNews web; 'custom' equivale a 'personalizada' no web (ver escala-codec.ts)
export type EscalaTipo = '14x14' | '14x21' | '14x28' | '28x28' | '21x21' | '7x7' | 'custom';
export type TipoRef = 'embarquei' | 'desembarquei';

export interface Excecao {
  id: string;
  tipo: 'dobra' | 'ferias';
  ini: string;  // YYYY-MM-DD
  fim: string;  // YYYY-MM-DD
}

export interface DataPessoal {
  id: string;
  nome: string;
  start_date: string;  // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
}

export interface ViagemFolga {
  id: string;
  destino: string;
  data_ini: string;  // YYYY-MM-DD
  data_fim: string;  // YYYY-MM-DD
  obs?: string;
}

export interface EscalaSecundaria {
  id: string;
  nome: string;
  relacao?: string;
  tipo: EscalaTipo;
  diasEmbarcado?: number;
  diasFolga?: number;
  dataRef: string;
  tipoRef: TipoRef;
}

export type DayKind = 'EMBARCADO' | 'FOLGA' | 'DOBRA' | 'FERIAS' | 'SEM_ESCALA';

export interface FeriadoBR {
  nome: string;
  tipo: 'feriado' | 'comemorativa';
  data: number;  // UTC ms
}

export interface DayInfo {
  iso: string;
  kind: DayKind;
  isEmbarque: boolean;
  isDesembarque: boolean;
  diaDoBloco: number;
  feriado?: FeriadoBR;
  excecao?: Excecao;
  datasPessoais: DataPessoal[];
  viagensFolga: ViagemFolga[];
  isHoje: boolean;
}

export interface JanelaJuntos {
  inicio: string;  // ISO
  fim: string;     // ISO
  dias: number;
}

export interface EscalaConfig {
  tipo: EscalaTipo;
  dataRef: string;      // YYYY-MM-DD (no OWNews web o campo chama-se `data`)
  tipoRef: TipoRef;
  diasEmbarcado?: number;
  diasFolga?: number;
  aeroporto?: string;   // ICAO code — e.g. 'SBME'
  excecoes?: Excecao[];
  updated_at?: string;  // ISO datetime, preenchido pelo storage
}

/** Estado macro da escala — base dos 3 estados da Home e do Meu Embarque. */
export type EscalaEstado = 'SEM_ESCALA' | 'DE_FOLGA' | 'EMBARCADO';

/**
 * Resumo pronto para UI. Tudo que as telas precisam sem refazer aritmética.
 * `hojeISO` é a data local (não UTC) usada em todos os cálculos.
 */
export interface EscalaResumo {
  estado: EscalaEstado;
  hojeISO: string;
  calc: EscalaCalc | null;
  /** Próximo embarque (sempre preenchido quando há escala, inclusive embarcado). */
  proximoEmbarqueISO: string | null;
  /** Próximo desembarque (sempre preenchido quando há escala, inclusive de folga). */
  proximoDesembarqueISO: string | null;
  /** Dias até o próximo embarque (0 = hoje). */
  diasParaEmbarque: number | null;
  /** Dias até o próximo desembarque (0 = hoje). */
  diasParaDesembarque: number | null;
  /** 0..1 — progresso dentro do bloco atual (embarque ou folga). */
  progresso: number;
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
  diaDoBloco: number;
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
  /** Recorrente (mantido entre ciclos). Ausente = true — mesma regra do OWNews web. */
  rec?: boolean;
}

export interface ChecklistData {
  items: ChecklistItem[];
  /** ISO do embarque ao qual esta lista pertence; null quando ainda sem escala (igual ao web). */
  ciclo: string | null;
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
