import type { EscalaConfig, EscalaSecundaria, JanelaJuntos } from './types';
import { calcEscala } from './escala';

function msParaISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function isoParaMs(iso: string): number {
  return new Date(iso + 'T12:00:00Z').getTime();
}

// Busca janelas de folga em comum — idêntico ao OWNews worker.js linha 17238
export function encontrarJanelasJuntos(
  configA: EscalaConfig,
  configB: EscalaConfig,
  fromISO: string = new Date().toISOString().slice(0, 10),
  maxDias = 180,
  maxJanelas = 5,
): JanelaJuntos[] {
  const janelas: JanelaJuntos[] = [];
  let emJanela = false;
  let inicioJanela = '';
  const fromMs = isoParaMs(fromISO);

  for (let i = 0; i < maxDias; i++) {
    const ms = fromMs + i * 86400000;
    const stA = calcEscala(configA, new Date(ms));
    const stB = calcEscala(configB, new Date(ms));
    const juntos = !stA?.embarcado && !stB?.embarcado;
    const iso = msParaISO(ms);

    if (juntos && !emJanela) {
      emJanela = true;
      inicioJanela = iso;
    } else if (!juntos && emJanela) {
      emJanela = false;
      const fimMs = ms - 86400000;
      janelas.push({
        inicio: inicioJanela,
        fim: msParaISO(fimMs),
        dias: Math.round((fimMs - isoParaMs(inicioJanela)) / 86400000) + 1,
      });
      if (janelas.length >= maxJanelas) break;
    }
  }

  if (emJanela) {
    const fimMs = fromMs + (maxDias - 1) * 86400000;
    janelas.push({
      inicio: inicioJanela,
      fim: msParaISO(fimMs),
      dias: Math.round((fimMs - isoParaMs(inicioJanela)) / 86400000) + 1,
    });
  }

  return janelas;
}

export function secundariaParaConfig(s: EscalaSecundaria): EscalaConfig {
  return {
    tipo: s.tipo,
    diasEmbarcado: s.diasEmbarcado,
    diasFolga: s.diasFolga,
    dataRef: s.dataRef,
    tipoRef: s.tipoRef,
  };
}
