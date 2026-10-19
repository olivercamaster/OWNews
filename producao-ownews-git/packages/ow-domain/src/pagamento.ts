/**
 * Meu Pagamento — DATA PROVÁVEL de pagamento a partir da REGRA que o usuário cadastrou.
 * Nunca pede valor de salário. Nunca afirma certeza: é estimativa ("Pagamento previsto").
 *
 * Dias úteis = segunda a sexta, menos (opcional) os FERIADOS NACIONAIS de lei, tirados da
 * mesma lista canônica do calendário (datasImportantesDoAno, paridade OWNews):
 * 01/01, Sexta-feira Santa, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11, 25/12.
 * NÃO entram: Carnaval (ponto facultativo), Páscoa (domingo), datas comemorativas,
 * feriados estaduais/municipais — o app diz isso ao usuário.
 */
import { datasImportantesDoAno } from './escala-calendario';
import { diasEntreISO, isoValido, somarDiasISO } from './escala';

export type RegraPagamento = 'ULTIMO_UTIL' | 'PRIMEIRO_UTIL' | 'QUINTO_UTIL' | 'DIA_FIXO' | 'NESIMO_UTIL';
export type AjusteFimDeSemana = 'ANTECIPAR' | 'POSTERGAR' | 'SEM_AJUSTE';

export interface ConfigPagamento {
  v: 1;
  empresa?: string;
  regra: RegraPagamento;
  /** DIA_FIXO: dia do mês (1–31; em mês menor, vira o último dia). */
  dia?: number;
  /** NESIMO_UTIL ("Personalizado"): n-ésimo dia útil (1–20). */
  nUtil?: number;
  /** Só para DIA_FIXO (as regras de dia útil já caem em dia útil). */
  ajuste: AjusteFimDeSemana;
  considerarFeriados: boolean;
  /** Aviso na Home/lembrete: dias antes (0 = desligado). */
  avisoDias: 0 | 1 | 3 | 7 | 15;
  updated_at?: string;
}

export const LABEL_REGRA: Record<RegraPagamento, string> = {
  ULTIMO_UTIL: 'Último dia útil do mês',
  PRIMEIRO_UTIL: 'Primeiro dia útil do mês',
  QUINTO_UTIL: 'Quinto dia útil do mês',
  DIA_FIXO: 'Dia fixo',
  NESIMO_UTIL: 'Personalizado (n-ésimo dia útil)',
};

export const LABEL_AJUSTE: Record<AjusteFimDeSemana, string> = {
  ANTECIPAR: 'Antecipar para o dia útil anterior',
  POSTERGAR: 'Passar para o próximo dia útil',
  SEM_AJUSTE: 'Sem ajuste / a empresa define',
};

export const AVISO_PAGAMENTO_OPCOES = [0, 1, 3, 7, 15] as const;

export const CONFIG_PAGAMENTO_PADRAO: ConfigPagamento = {
  v: 1, regra: 'ULTIMO_UTIL', ajuste: 'ANTECIPAR', considerarFeriados: true, avisoDias: 7,
};

const cacheFeriados = new Map<number, Set<string>>();

/** Feriados nacionais de lei no ano (ISO), derivados da lista canônica. */
export function feriadosNacionaisISO(ano: number): Set<string> {
  let s = cacheFeriados.get(ano);
  if (!s) {
    s = new Set(
      datasImportantesDoAno(ano)
        .filter(f => f.tipo === 'feriado' && f.nome !== 'Carnaval' && f.nome !== 'Páscoa')
        .map(f => new Date(f.data).toISOString().slice(0, 10)),
    );
    cacheFeriados.set(ano, s);
  }
  return s;
}

function diaDaSemana(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

export function ehFimDeSemana(iso: string): boolean {
  const w = diaDaSemana(iso);
  return w === 0 || w === 6;
}

export function ehFeriadoNacional(iso: string): boolean {
  return feriadosNacionaisISO(Number(iso.slice(0, 4))).has(iso);
}

export function ehDiaUtil(iso: string, considerarFeriados: boolean): boolean {
  return !ehFimDeSemana(iso) && !(considerarFeriados && ehFeriadoNacional(iso));
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function isoDe(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function nesimoUtil(ano: number, mes: number, n: number, feriados: boolean): string {
  let conta = 0;
  const ult = ultimoDiaDoMes(ano, mes);
  for (let d = 1; d <= ult; d++) {
    const iso = isoDe(ano, mes, d);
    if (ehDiaUtil(iso, feriados) && ++conta === n) return iso;
  }
  return ultimoUtil(ano, mes, feriados); // mês com menos dias úteis que n: último útil
}

function ultimoUtil(ano: number, mes: number, feriados: boolean): string {
  for (let d = ultimoDiaDoMes(ano, mes); d >= 1; d--) {
    const iso = isoDe(ano, mes, d);
    if (ehDiaUtil(iso, feriados)) return iso;
  }
  return isoDe(ano, mes, ultimoDiaDoMes(ano, mes));
}

export interface DataPagamento {
  iso: string;
  /** Data "nominal" antes do ajuste (DIA_FIXO). */
  nominal: string;
  ajustado: boolean;
  /** Por que mudou: fim de semana ou feriado nacional. */
  motivoAjuste?: 'fim_de_semana' | 'feriado';
}

/** Data provável no mês (ano, mes 1–12) pela regra. */
export function dataPagamentoNoMes(cfg: ConfigPagamento, ano: number, mes: number): DataPagamento {
  const f = cfg.considerarFeriados;
  switch (cfg.regra) {
    case 'ULTIMO_UTIL': { const iso = ultimoUtil(ano, mes, f); return { iso, nominal: iso, ajustado: false }; }
    case 'PRIMEIRO_UTIL': { const iso = nesimoUtil(ano, mes, 1, f); return { iso, nominal: iso, ajustado: false }; }
    case 'QUINTO_UTIL': { const iso = nesimoUtil(ano, mes, 5, f); return { iso, nominal: iso, ajustado: false }; }
    case 'NESIMO_UTIL': {
      const n = Math.min(20, Math.max(1, Math.round(cfg.nUtil ?? 1)));
      const iso = nesimoUtil(ano, mes, n, f); return { iso, nominal: iso, ajustado: false };
    }
    case 'DIA_FIXO':
    default: {
      const dia = Math.min(ultimoDiaDoMes(ano, mes), Math.max(1, Math.round(cfg.dia ?? 1)));
      const nominal = isoDe(ano, mes, dia);
      if (cfg.ajuste === 'SEM_AJUSTE' || ehDiaUtil(nominal, f)) return { iso: nominal, nominal, ajustado: false };
      const motivoAjuste = ehFimDeSemana(nominal) ? 'fim_de_semana' : 'feriado';
      const passo = cfg.ajuste === 'ANTECIPAR' ? -1 : 1;
      let iso = nominal;
      do { iso = somarDiasISO(iso, passo); } while (!ehDiaUtil(iso, f));
      return { iso, nominal, ajustado: true, motivoAjuste };
    }
  }
}

/** Próximas `n` datas prováveis a partir de hoje (inclusive). Mês anterior entra porque "antecipar" pode puxar o pagamento de um mês para o fim do anterior. */
export function proximosPagamentos(cfg: ConfigPagamento, hojeISO: string, n = 3): DataPagamento[] {
  if (!isoValido(hojeISO)) return [];
  let ano = Number(hojeISO.slice(0, 4));
  let mes = Number(hojeISO.slice(5, 7)) - 1;
  if (mes === 0) { mes = 12; ano--; }
  const out: DataPagamento[] = [];
  for (let i = 0; i < n + 3 && out.length < n; i++) {
    const r = dataPagamentoNoMes(cfg, ano, mes);
    if (r.iso >= hojeISO && !out.some(o => o.iso === r.iso)) out.push(r);
    mes++; if (mes > 12) { mes = 1; ano++; }
  }
  return out;
}

export function proximoPagamento(cfg: ConfigPagamento | null, hojeISO: string): (DataPagamento & { dias: number }) | null {
  if (!cfg) return null;
  const p = proximosPagamentos(cfg, hojeISO, 1)[0];
  return p ? { ...p, dias: diasEntreISO(hojeISO, p.iso) } : null;
}

/** Texto curto da regra para transparência ("Último dia útil do mês · feriados nacionais considerados"). */
export function descreverRegra(cfg: ConfigPagamento): string {
  const base = cfg.regra === 'DIA_FIXO'
    ? `Todo dia ${cfg.dia ?? 1}${cfg.ajuste === 'SEM_AJUSTE' ? '' : cfg.ajuste === 'ANTECIPAR' ? ' · antecipa se não for dia útil' : ' · adia se não for dia útil'}`
    : cfg.regra === 'NESIMO_UTIL' ? `${cfg.nUtil ?? 1}º dia útil do mês` : LABEL_REGRA[cfg.regra];
  return `${base} · ${cfg.considerarFeriados ? 'feriados nacionais considerados' : 'só fins de semana considerados'}`;
}

/** Normaliza o que veio do storage (versões futuras/antigas não quebram). */
export function normalizarConfigPagamento(raw: unknown): ConfigPagamento | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<ConfigPagamento>;
  const regras: RegraPagamento[] = ['ULTIMO_UTIL', 'PRIMEIRO_UTIL', 'QUINTO_UTIL', 'DIA_FIXO', 'NESIMO_UTIL'];
  if (!r.regra || !regras.includes(r.regra)) return null;
  const ajustes: AjusteFimDeSemana[] = ['ANTECIPAR', 'POSTERGAR', 'SEM_AJUSTE'];
  return {
    v: 1,
    empresa: typeof r.empresa === 'string' && r.empresa.trim() ? r.empresa.trim().slice(0, 60) : undefined,
    regra: r.regra,
    dia: Number.isFinite(r.dia) ? Math.min(31, Math.max(1, Math.round(r.dia!))) : undefined,
    nUtil: Number.isFinite(r.nUtil) ? Math.min(20, Math.max(1, Math.round(r.nUtil!))) : undefined,
    ajuste: r.ajuste && ajustes.includes(r.ajuste) ? r.ajuste : 'ANTECIPAR',
    considerarFeriados: r.considerarFeriados !== false,
    avisoDias: ([0, 1, 3, 7, 15] as number[]).includes(r.avisoDias as number) ? r.avisoDias! : 7,
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : undefined,
  };
}
