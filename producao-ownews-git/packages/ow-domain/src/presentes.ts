/**
 * Ideias de presente — lista EDITORIAL local e determinística (sem IA, sem loja,
 * sem preço real, sem afiliado). Faixa de preço e categoria só filtram ideias.
 * Arquitetura pronta para, no futuro, cada ideia ganhar um `destino` (loja/parceiro).
 */
export type FaixaPreco = 'ATE_50' | '50_100' | '100_200' | '200_500' | 'ACIMA_500';
export type CategoriaPresente =
  | 'FLORES' | 'BELEZA' | 'MODA' | 'EXPERIENCIA' | 'RESTAURANTE' | 'TECNOLOGIA' | 'PERSONALIZADO' | 'OUTRO';

export const LABEL_FAIXA_PRECO: Record<FaixaPreco, string> = {
  ATE_50: 'Até R$ 50', '50_100': 'R$ 50–100', '100_200': 'R$ 100–200', '200_500': 'R$ 200–500', ACIMA_500: 'Acima de R$ 500',
};
export const LABEL_CATEGORIA_PRESENTE: Record<CategoriaPresente, string> = {
  FLORES: 'Flores', BELEZA: 'Perfume/beleza', MODA: 'Moda', EXPERIENCIA: 'Experiência',
  RESTAURANTE: 'Restaurante', TECNOLOGIA: 'Tecnologia', PERSONALIZADO: 'Presente personalizado', OUTRO: 'Outro',
};
export const FAIXAS_PRECO = Object.keys(LABEL_FAIXA_PRECO) as FaixaPreco[];
export const CATEGORIAS_PRESENTE = Object.keys(LABEL_CATEGORIA_PRESENTE) as CategoriaPresente[];

export interface IdeiaPresente {
  id: string;
  titulo: string;
  dica: string;
  categoria: CategoriaPresente;
  faixas: FaixaPreco[];
  /** Combina bem com quem está longe (entrega/agendamento durante o embarque). */
  aDistancia?: boolean;
}

const TODAS: FaixaPreco[] = ['ATE_50', '50_100', '100_200', '200_500', 'ACIMA_500'];

export const IDEIAS_PRESENTE: IdeiaPresente[] = [
  { id: 'flores-entrega', titulo: 'Flores com entrega agendada', dica: 'Dá para agendar antes de embarcar e chegar no dia certo.', categoria: 'FLORES', faixas: ['50_100', '100_200', '200_500'], aDistancia: true },
  { id: 'flores-vaso', titulo: 'Planta em vaso', dica: 'Dura mais que um buquê e lembra você por semanas.', categoria: 'FLORES', faixas: ['ATE_50', '50_100'] },
  { id: 'perfume', titulo: 'Perfume', dica: 'Vale conferir antes qual fragrância a pessoa já usa.', categoria: 'BELEZA', faixas: ['100_200', '200_500', 'ACIMA_500'] },
  { id: 'kit-cuidados', titulo: 'Kit de cuidados (hidratante, sabonete, óleo)', dica: 'Funciona bem em qualquer faixa.', categoria: 'BELEZA', faixas: ['ATE_50', '50_100', '100_200'] },
  { id: 'peca-roupa', titulo: 'Peça de roupa ou acessório', dica: 'Guarde a nota para troca de tamanho.', categoria: 'MODA', faixas: ['50_100', '100_200', '200_500'] },
  { id: 'relogio-joia', titulo: 'Relógio ou semijoia', dica: 'Presente que fica.', categoria: 'MODA', faixas: ['200_500', 'ACIMA_500'] },
  { id: 'experiencia-dia', titulo: 'Experiência (spa, aula, passeio)', dica: 'Marque para a sua folga e vão juntos.', categoria: 'EXPERIENCIA', faixas: ['100_200', '200_500', 'ACIMA_500'] },
  { id: 'show-ingresso', titulo: 'Ingresso para show, teatro ou jogo', dica: 'Confira a data com a sua escala antes de comprar.', categoria: 'EXPERIENCIA', faixas: ['100_200', '200_500', 'ACIMA_500'] },
  { id: 'viagem-curta', titulo: 'Fim de semana fora', dica: 'Planeje para a próxima folga.', categoria: 'EXPERIENCIA', faixas: ['ACIMA_500'] },
  { id: 'jantar', titulo: 'Jantar em um lugar especial', dica: 'Reserve para um dia em que você estará de folga.', categoria: 'RESTAURANTE', faixas: ['100_200', '200_500', 'ACIMA_500'] },
  { id: 'cafe-manha', titulo: 'Cesta de café da manhã', dica: 'Pode ser entregue mesmo com você embarcado.', categoria: 'RESTAURANTE', faixas: ['50_100', '100_200'], aDistancia: true },
  { id: 'fone', titulo: 'Fone de ouvido ou caixa de som', dica: 'Útil no dia a dia.', categoria: 'TECNOLOGIA', faixas: ['100_200', '200_500', 'ACIMA_500'] },
  { id: 'acessorio-celular', titulo: 'Acessório para o celular', dica: 'Carregador portátil, suporte, capa.', categoria: 'TECNOLOGIA', faixas: ['ATE_50', '50_100', '100_200'] },
  { id: 'album-fotos', titulo: 'Álbum ou porta-retrato com fotos de vocês', dica: 'Personalizado vale mais que caro.', categoria: 'PERSONALIZADO', faixas: ['ATE_50', '50_100', '100_200'] },
  { id: 'caneca-carta', titulo: 'Item personalizado + carta escrita à mão', dica: 'Escreva antes de embarcar e deixe guardado.', categoria: 'PERSONALIZADO', faixas: ['ATE_50', '50_100'] },
  { id: 'livro', titulo: 'Livro', dica: 'De um autor ou assunto de que a pessoa gosta.', categoria: 'OUTRO', faixas: ['ATE_50', '50_100'] },
  { id: 'vale-presente', titulo: 'Vale-presente', dica: 'A pessoa escolhe; bom quando você está embarcado.', categoria: 'OUTRO', faixas: TODAS, aDistancia: true },
  { id: 'videochamada', titulo: 'Mensagem em vídeo ou videochamada no dia', dica: 'Não custa nada e conta muito.', categoria: 'OUTRO', faixas: TODAS, aDistancia: true },
];

/**
 * Ideias filtradas. Ordem estável: as que funcionam à distância primeiro quando você estará embarcado.
 */
export function ideiasDePresente(o: { faixa?: FaixaPreco | null; categoria?: CategoriaPresente | null; embarcadoNaData?: boolean }): IdeiaPresente[] {
  return IDEIAS_PRESENTE
    .filter(i => !o.faixa || i.faixas.includes(o.faixa))
    .filter(i => !o.categoria || i.categoria === o.categoria)
    .map((i, idx) => ({ i, idx }))
    .sort((a, b) => (o.embarcadoNaData ? Number(!!b.i.aDistancia) - Number(!!a.i.aDistancia) : 0) || a.idx - b.idx)
    .map(x => x.i);
}
