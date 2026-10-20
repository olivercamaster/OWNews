/**
 * Ícones das escalas do Cruzar — vetoriais (Ionicons), iguais em Android, iOS e web.
 * Antes eram emojis ('🤜🤛' quebrava em dois glifos em vários aparelhos).
 * O valor salvo em `EscalaSecundaria.icon` passa a ser a CHAVE abaixo; emojis antigos
 * já salvos continuam sendo lidos pelo mapa LEGADO (nada é migrado nem perdido).
 */
export const ICONES_RELACAO = {
  coracao: 'heart',
  irmaos: 'people',
  amizade: 'happy',
  familia: 'home',
  colega: 'briefcase',
  outro: 'link',
  estrela: 'star',
  barco: 'boat',
} as const;

export type IconeRelacao = keyof typeof ICONES_RELACAO;
export type IoniconRelacao = (typeof ICONES_RELACAO)[IconeRelacao];

/** Nome falado (leitor de tela / testes) de cada ícone. */
export const NOME_ICONE: Record<IconeRelacao, string> = {
  coracao: 'Coração', irmaos: 'Pessoas', amizade: 'Rosto feliz', familia: 'Casa',
  colega: 'Maleta', outro: 'Link', estrela: 'Estrela', barco: 'Barco',
};

export const ICONES_ORDEM: IconeRelacao[] = ['coracao', 'irmaos', 'amizade', 'familia', 'colega', 'outro', 'estrela', 'barco'];

const LEGADO: Record<string, IconeRelacao> = {
  '❤️': 'coracao', '❤': 'coracao',
  '🤜🤛': 'irmaos',
  '🤝': 'amizade',
  '👥': 'familia',
  '⚓': 'colega',
  '🔗': 'outro',
  '⭐': 'estrela',
  '🛳️': 'barco', '🛳': 'barco',
};

/** Chave canônica para qualquer valor salvo (chave nova, emoji antigo ou vazio). */
export function chaveIconeRelacao(valor: string | null | undefined): IconeRelacao {
  if (valor && valor in ICONES_RELACAO) return valor as IconeRelacao;
  if (valor && LEGADO[valor]) return LEGADO[valor]!;
  return 'outro';
}

export function ioniconRelacao(valor: string | null | undefined): IoniconRelacao {
  return ICONES_RELACAO[chaveIconeRelacao(valor)];
}
