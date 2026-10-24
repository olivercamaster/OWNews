/**
 * Ações do Meu Histórico usadas por mais de uma tela (Home, Histórico, Próximos dias).
 * Tudo local (storage.ts). Nenhuma delas recebe ou grava a escala.
 */
import { adiarFinalizacao, dispensarSugestao, finalizarRegistro, hojeISO } from '@owbuddy/domain';
import type { PendenciaFinalizar, SugestaoCiclo } from '@owbuddy/domain';
import { alterarHistorico, getAvisosHistorico, setAvisosHistorico } from './storage';
import { analytics } from './analytics';

/** Id estável e único (nunca índice de array). */
export function novoIdHistorico(prefixo: 'he' | 'ha'): string {
  return `${prefixo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** "Registrar hoje" / "Confirmar 30/10": o desembarque real é o previsto — escolha explícita da pessoa. */
export async function confirmarDesembarquePrevisto(p: PendenciaFinalizar): Promise<void> {
  await alterarHistorico(h => finalizarRegistro(h, p.registro.id, p.desembarquePrevisto, new Date().toISOString()));
  analytics.track('embarque_editado', { origem: 'finalizar' });
}

/** "Agora não" na finalização (anti-spam: não pergunta de novo antes de amanhã / 3 dias). */
export async function adiarPendencia(p: PendenciaFinalizar): Promise<void> {
  await setAvisosHistorico(adiarFinalizacao(await getAvisosHistorico(), p, hojeISO()));
}

/** "Agora não" na sugestão do ciclo atual (não volta para este ciclo). */
export async function dispensarSugestaoCiclo(s: SugestaoCiclo): Promise<void> {
  await setAvisosHistorico(dispensarSugestao(await getAvisosHistorico(), s));
}
