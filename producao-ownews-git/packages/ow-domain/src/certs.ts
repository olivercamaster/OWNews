import type { Certificado, CertCalc, CertStatus } from './types';
import { diasEntreISO, hojeISO, isoValido } from './escala';

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
    label = 'VENCE HOJE';
  } else if (dias <= 7) {
    status = 'atencao';
    critico = true;
    label = `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  } else if (dias <= 90) {
    status = 'atencao';
    critico = false;
    label = `Vence em ${dias} dias`;
  } else {
    status = 'valido';
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
