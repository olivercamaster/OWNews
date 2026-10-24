import type { EscalaResumo, Momento } from './types';

/**
 * Estado contextual da Home — só TEXTO a partir do que já foi calculado.
 * Nenhuma aritmética de datas aqui: os dias vêm de resumoEscala() e o corte
 * de pré-embarque vem de calcularMomento() (regra canônica calcEscalaISO).
 */
export type HomeContextoTipo = 'SEM_ESCALA' | 'PRE_EMBARQUE' | 'EMBARCADO' | 'FOLGA';

export interface HomeContexto {
  tipo: HomeContextoTipo;
  /** Rótulo curto em caixa alta (chip). Vazio sem escala. */
  kicker: string;
  /** Frase principal. */
  titulo: string;
  /** Linha de destaque (dia do bloco, contagem, itens preparados). */
  destaque: string | null;
  /** Frase de apoio, tom companheiro. */
  detalhe: string;
}

export interface HomeChecklistContagem {
  total: number;
  feitos: number;
  pendentes: number;
}

const MOMENTOS_PRE_EMBARQUE: ReadonlyArray<Momento['tipo']> = [
  'EMBARQUE_DISTANTE',
  'EMBARQUE_PROXIMO',
  'VESPERA_EMBARQUE',
];

function emDias(dias: number, hoje: string, amanha: string, plural: (n: number) => string): string {
  if (dias <= 0) return hoje;
  if (dias === 1) return amanha;
  return plural(dias);
}

export function contextoHome(
  resumo: EscalaResumo,
  momento: Momento,
  checklist: HomeChecklistContagem | null,
): HomeContexto {
  if (resumo.estado === 'SEM_ESCALA' || !resumo.calc) {
    return {
      tipo: 'SEM_ESCALA',
      kicker: '',
      titulo: 'Vamos começar pela sua escala',
      destaque: null,
      detalhe: 'Configure sua escala para eu acompanhar seu ciclo com você.',
    };
  }

  const { calc } = resumo;

  if (resumo.estado === 'EMBARCADO') {
    const dias = resumo.diasParaDesembarque ?? calc.diasRestantes;
    // "Embarque hoje/ontem" só pela diferença real entre hoje e o dia do
    // embarque calculado (Dia 1 = hoje) — nunca pela data em que o app foi configurado.
    const titulo = calc.diaDoBloco === 1 ? 'Hoje é dia de embarque'
      : calc.diaDoBloco === 2 ? 'Você embarcou ontem'
      : 'Você está embarcado';
    return {
      tipo: 'EMBARCADO',
      kicker: 'Embarcado',
      titulo,
      destaque: `Dia ${calc.diaDoBloco} de ${calc.dEm}`,
      detalhe: emDias(dias, 'Desembarque hoje.', 'Desembarque amanhã.',
        n => `${n} dias para o desembarque.`),
    };
  }

  const dias = resumo.diasParaEmbarque ?? calc.diasRestantes;

  if (MOMENTOS_PRE_EMBARQUE.includes(momento.tipo)) {
    const titulo = emDias(dias, 'Embarque hoje', 'Embarque amanhã', n => `Embarque em ${n} dias`);
    if (!checklist || checklist.total === 0) {
      return { tipo: 'PRE_EMBARQUE', kicker: 'Pré-embarque', titulo, destaque: null, detalhe: 'Monte sua lista no Meu Embarque.' };
    }
    const { total, feitos, pendentes } = checklist;
    return {
      tipo: 'PRE_EMBARQUE',
      kicker: 'Pré-embarque',
      titulo,
      destaque: `${feitos} de ${total} ${total === 1 ? 'item preparado' : 'itens preparados'}`,
      detalhe: pendentes === 0
        ? 'Tudo pronto. Bom embarque!'
        : pendentes === 1
          ? 'Você ainda tem 1 coisa para conferir.'
          : `Você ainda tem ${pendentes} coisas para conferir.`,
    };
  }

  return {
    tipo: 'FOLGA',
    kicker: 'De folga',
    titulo: calc.diaDoBloco === 1 ? 'Hoje é dia de desembarque' : 'Você está de folga',
    destaque: `Dia ${calc.diaDoBloco} de ${calc.dFo}`,
    detalhe: emDias(dias, 'Embarque hoje.', 'Próximo embarque amanhã.',
      n => `${n} dias para o próximo embarque.`),
  };
}
