import type { EscalaConfig, EscalaSecundaria, Excecao, JanelaJuntos } from './types';
import { ESCALA_TIPOS, calcEscalaISO, diasDoCiclo, hojeISO, isoParaMs, isoValido, msParaISO, proximoEmbarqueISO } from './escala';

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

// ─── Cruzar 2.1 — gerenciamento e leitura por dia ───────────────────────────
//
// Tudo opera sobre a MESMA lista (ownews_cruzar_v2) e o MESMO registro por id:
// não há segundo modelo. A matemática é sempre secundariaParaConfig + estaLivreNoDia.

/** Estado real do dia para você e a outra pessoa (sem gênero: "a pessoa"). */
export type EstadoCruzado = 'JUNTOS' | 'SO_VOCE_LIVRE' | 'SO_PESSOA_LIVRE' | 'AMBOS_A_BORDO';

export interface CruzamentoDia {
  sec: EscalaSecundaria;
  estado: EstadoCruzado;
}

export function escalasVisiveis(lista: EscalaSecundaria[]): EscalaSecundaria[] {
  return lista.filter(s => !s.oculta);
}

/**
 * Pessoas VISÍVEIS com estado calculável neste dia — "juntos" primeiro.
 * Escala (sua ou dela) incompleta → a pessoa fica de fora; nunca inventa estado.
 */
export function cruzamentosDoDia(principal: EscalaConfig, lista: EscalaSecundaria[], iso: string): CruzamentoDia[] {
  const eu = estaLivreNoDia(principal, iso);
  if (eu === null) return [];
  const out: CruzamentoDia[] = [];
  for (const sec of escalasVisiveis(lista)) {
    const ela = estaLivreNoDia(secundariaParaConfig(sec), iso);
    if (ela === null) continue;
    const estado: EstadoCruzado = eu && ela ? 'JUNTOS' : eu ? 'SO_VOCE_LIVRE' : ela ? 'SO_PESSOA_LIVRE' : 'AMBOS_A_BORDO';
    out.push({ sec, estado });
  }
  return out.sort((a, b) => Number(b.estado === 'JUNTOS') - Number(a.estado === 'JUNTOS'));
}

/** Quem está de folga junto com você neste dia (só visíveis). */
export function juntosNoDia(principal: EscalaConfig, lista: EscalaSecundaria[], iso: string): EscalaSecundaria[] {
  return cruzamentosDoDia(principal, lista, iso).filter(c => c.estado === 'JUNTOS').map(c => c.sec);
}

/** Próximo embarque da pessoa (mesma regra da sua escala). */
export function proximoEmbarqueSecundaria(sec: EscalaSecundaria, today: Date = new Date()): string | null {
  return proximoEmbarqueISO(secundariaParaConfig(sec), today);
}

/** "14 × 14" ou "10 × 20" (personalizada). */
export function rotuloCicloSecundaria(sec: EscalaSecundaria): string {
  if (sec.tipo === 'custom') return sec.diasEmbarcado && sec.diasFolga ? `${sec.diasEmbarcado} × ${sec.diasFolga}` : 'Personalizada';
  return ESCALA_TIPOS.find(t => t.value === sec.tipo)?.label ?? sec.tipo;
}

/** Cria ou edita pelo id, mantendo a posição na lista (editar não reordena). */
export function salvarEscalaSecundaria(lista: EscalaSecundaria[], sec: EscalaSecundaria): EscalaSecundaria[] {
  const i = lista.findIndex(s => s.id === sec.id);
  if (i < 0) return [...lista, sec];
  const nova = lista.slice();
  nova[i] = sec;
  return nova;
}

export function removerEscalaSecundaria(lista: EscalaSecundaria[], id: string): EscalaSecundaria[] {
  return lista.filter(s => s.id !== id);
}

/** Oculta/mostra sem tocar em nenhum outro campo. */
export function definirOcultaSecundaria(lista: EscalaSecundaria[], id: string, oculta: boolean): EscalaSecundaria[] {
  return lista.map(s => {
    if (s.id !== id) return s;
    const { oculta: _antes, ...resto } = s;
    return oculta ? { ...resto, oculta: true } : resto;
  });
}
