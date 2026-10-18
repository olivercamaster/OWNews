import type { EscalaConfig, EscalaSecundaria, Excecao, JanelaJuntos } from './types';
import { calcEscalaISO, diasDoCiclo, hojeISO, isoParaMs, isoValido, msParaISO } from './escala';

/**
 * A pessoa está livre (fora de bordo) neste dia? Usa a regra canônica
 * calcEscalaISO e as exceções da PRÓPRIA escala: dobra = a bordo; férias = livre.
 * (O OWNews web ignora as exceções no Cruzar; aqui elas contam, porque uma dobra
 * marcada no calendário nunca pode virar "folga em comum".)
 */
export function estaLivreNoDia(config: EscalaConfig, iso: string, excecoes: Excecao[] = config.excecoes ?? []): boolean | null {
  const calc = calcEscalaISO(config, iso);
  if (!calc) return null;
  const exc = excecoes.find(e => iso >= e.ini && iso <= e.fim);
  if (exc?.tipo === 'dobra') return false;
  if (exc?.tipo === 'ferias') return true;
  return !calc.embarcado;
}

// Busca janelas de folga em comum — base: OWNews worker.js (Cruzar escalas).
// `fromISO` é data LOCAL (hojeISO), nunca toISOString() — ver escala.ts.
// Escala inválida (sem ciclo/data) → nenhuma janela (nunca "sempre de folga").
export function encontrarJanelasJuntos(
  configA: EscalaConfig,
  configB: EscalaConfig,
  fromISO: string = hojeISO(),
  maxDias = 180,
  maxJanelas = 5,
): JanelaJuntos[] {
  const janelas: JanelaJuntos[] = [];
  if (!diasDoCiclo(configA) || !diasDoCiclo(configB) || !isoValido(fromISO)) return janelas;
  let emJanela = false;
  let inicioJanela = '';
  const fromMs = isoParaMs(fromISO);

  for (let i = 0; i < maxDias; i++) {
    const ms = fromMs + i * 86400000;
    const iso = msParaISO(ms);
    const juntos = estaLivreNoDia(configA, iso) === true && estaLivreNoDia(configB, iso) === true;

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

  if (emJanela && janelas.length < maxJanelas) {
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
