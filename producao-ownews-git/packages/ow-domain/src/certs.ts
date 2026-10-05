import { Certificado, CertCalc, CertStatus } from './types';

export function calcCertStatus(cert: Certificado, today: Date = new Date()): CertCalc {
  if (!cert.validade) {
    return { status: 'sem-data', critico: false, dias: null, label: 'Sem data' };
  }

  const todayUTC = new Date(today);
  todayUTC.setUTCHours(12, 0, 0, 0);
  const validadeUTC = new Date(cert.validade + 'T12:00:00Z');
  const dias = Math.round((validadeUTC.getTime() - todayUTC.getTime()) / 86400000);

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
