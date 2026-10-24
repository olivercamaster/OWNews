import type { Certificado, CertCalc, CertStatus, DocumentoTipo } from './types';
import { diasEntreISO, hojeISO, isoValido } from './escala';

// ─── Documentos (mesma lista, mesmo armazenamento dos certificados) ─────────

export const DOCUMENTO_TIPOS: ReadonlyArray<{ value: DocumentoTipo; label: string }> = [
  { value: 'CERTIFICADO', label: 'Certificado' },
  { value: 'PASSAPORTE', label: 'Passaporte' },
  { value: 'CNH', label: 'CNH' },
  { value: 'ASO', label: 'ASO' },
  { value: 'OUTRO', label: 'Outro' },
];

/** Opções de "Avisar antes" (dias). */
export const AVISO_DOCUMENTO_OPCOES: readonly number[] = [7, 15, 30, 60, 90];
export const AVISO_DOCUMENTO_PADRAO = 30;

export function tipoDocumento(c: Pick<Certificado, 'tipo'>): DocumentoTipo {
  return c.tipo && DOCUMENTO_TIPOS.some(t => t.value === c.tipo) ? c.tipo : 'CERTIFICADO';
}

/** Nome sugerido para os tipos de nome único (Passaporte, CNH, ASO). */
export function nomePadraoDocumento(tipo: DocumentoTipo): string {
  return tipo === 'PASSAPORTE' ? 'Passaporte' : tipo === 'CNH' ? 'CNH' : tipo === 'ASO' ? 'ASO' : '';
}

export function avisoDiasDocumento(c: Pick<Certificado, 'aviso_dias'>): number {
  const n = c.aviso_dias;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 365 ? n : AVISO_DOCUMENTO_PADRAO;
}

/** Validação do formulário — mensagem humana ou null. */
export function validarDocumento(d: Partial<Certificado>): string | null {
  if (!d.nome?.trim()) return tipoDocumento(d) === 'CERTIFICADO' ? 'Dê um nome ao certificado.' : 'Dê um nome ao documento.';
  if (d.validade && !isoValido(d.validade)) return 'A data de validade não é válida.';
  return null;
}

export function calcCertStatus(cert: Certificado, today: Date = new Date()): CertCalc {
  if (!cert.validade) {
    return { status: 'sem-data', critico: false, dias: null, label: 'Sem data' };
  }

  // Dias de calendário a partir de HOJE NO FUSO DO APARELHO (setUTCHours virava
  // o dia às 21:00 de Brasília e mostrava "vence amanhã" no dia do vencimento).
  if (!isoValido(cert.validade)) {
    return { status: 'sem-data', critico: false, dias: null, label: 'Data inválida' };
  }
  const dias = diasEntreISO(hojeISO(today), cert.validade);

  let status: CertStatus;
  let critico: boolean;
  let label: string;

  if (dias < 0) {
    status = 'vencido';
    critico = true;
    label = `Vencido há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`;
  } else if (dias === 0) {
    status = 'vence-hoje';
    critico = true;
    label = 'Vence hoje';
  } else if (dias <= 7) {
    status = 'atencao';
    critico = true;
    label = `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  } else if (dias <= (cert.aviso_dias != null ? avisoDiasDocumento(cert) : 90)) {
    // Janela de atenção = "Avisar antes" do documento (sem escolha: 90 dias, regra antiga).
    status = 'atencao';
    critico = false;
    label = `Vence em ${dias} dias`;
  } else {
    status = 'valido';  // dentro do prazo e fora da janela de aviso
    critico = false;
    label = 'Válido';
  }

  return { status, critico, dias, label };
}

export function certsPrecisandoAtencao(certs: Certificado[], today: Date = new Date()): Certificado[] {
  return certs
    .filter(c => !c._deleted)
    .filter(c => {
      if (!c.validade) return false;
      const calc = calcCertStatus(c, today);
      return calc.status !== 'valido' && calc.status !== 'sem-data';
    });
}
