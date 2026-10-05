import { EscalaConfig, EscalaCalc, Momento, MomentoTipo } from './types';

const TIPOS_PRESET: Record<string, [number, number]> = {
  '14x14': [14, 14],
  '14x21': [14, 21],
  '28x28': [28, 28],
  '21x21': [21, 21],
  '7x7':   [7, 7],
};

export function calcEscala(config: EscalaConfig, today: Date = new Date()): EscalaCalc | null {
  try {
    const preset = TIPOS_PRESET[config.tipo];
    const dEm = preset ? preset[0] : (parseInt(String(config.diasEmbarcado ?? ''), 10) || 0);
    const dFo = preset ? preset[1] : (parseInt(String(config.diasFolga ?? ''), 10) || 0);
    if (!dEm || !dFo || isNaN(dEm) || isNaN(dFo)) return null;

    const refUTC = new Date(config.dataRef + 'T12:00:00Z').getTime();
    if (isNaN(refUTC)) return null;

    const anchor = config.tipoRef === 'embarquei' ? refUTC : refUTC - dEm * 86400000;
    const ciclo = dEm + dFo;
    const agoraMs = today.getTime();
    const fase = ((Math.round((agoraMs - anchor) / 86400000) % ciclo) + ciclo) % ciclo;

    return {
      embarcado: fase < dEm,
      diasRestantes: fase < dEm ? dEm - fase : ciclo - fase,
      dEm,
      dFo,
      ciclo,
      diaDoBloco: fase < dEm ? fase + 1 : fase - dEm + 1,
    };
  } catch {
    return null;
  }
}

export function calcEscalaParaDia(config: EscalaConfig, isoDate: string): EscalaCalc | null {
  return calcEscala(config, new Date(isoDate + 'T12:00:00Z'));
}

export function calcularMomento(config: EscalaConfig | null | undefined, today: Date = new Date()): Momento {
  if (!config || !config.tipo) return { tipo: 'SEM_ESCALA' };

  const result = calcEscala(config, today);
  if (!result) return { tipo: 'SEM_ESCALA' };

  if (result.embarcado) {
    const diasDesembarque = result.diasRestantes;
    return {
      tipo: diasDesembarque <= 2 ? 'DESEMBARQUE_PROXIMO' : 'EMBARCADO',
      diasDesembarque,
    };
  }

  const diasEmbarque = result.diasRestantes;
  let tipo: MomentoTipo;
  if (diasEmbarque === 0)      tipo = 'VESPERA_EMBARQUE';
  else if (diasEmbarque <= 2)  tipo = 'EMBARQUE_PROXIMO';
  else if (diasEmbarque <= 5)  tipo = 'EMBARQUE_DISTANTE';
  else                         tipo = 'FOLGA';

  return { tipo, diasEmbarque };
}

export function proximaDataEmbarque(config: EscalaConfig, today: Date = new Date()): Date | null {
  const result = calcEscala(config, today);
  if (!result) return null;
  if (result.embarcado) return null;
  const ms = today.getTime() + result.diasRestantes * 86400000;
  return new Date(ms);
}

export function proximaDataDesembarque(config: EscalaConfig, today: Date = new Date()): Date | null {
  const result = calcEscala(config, today);
  if (!result) return null;
  if (!result.embarcado) return null;
  const ms = today.getTime() + result.diasRestantes * 86400000;
  return new Date(ms);
}
