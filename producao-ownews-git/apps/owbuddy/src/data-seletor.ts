/**
 * Regras puras do OWDatePicker (testáveis sem React Native).
 */

/**
 * Anos do seletor: 8 para trás e 10 para frente do ano LOCAL atual, e
 * sempre o ano do valor salvo (emissão antiga de certificado, por exemplo).
 * Calculado na abertura — nunca fixo no carregamento do módulo.
 */
export function anosDoSeletor(hoje: Date, valor?: string): number[] {
  const atual = hoje.getFullYear();
  const y = valor && valor.length >= 10 ? parseInt(valor.slice(0, 4), 10) : atual;
  const ini = Math.min(atual - 8, y), fim = Math.max(atual + 10, y);
  return Array.from({ length: fim - ini + 1 }, (_, i) => ini + i);
}

/**
 * Data inicial do seletor. Sem valor salvo → HOJE no calendário LOCAL do
 * aparelho (só ponto de partida visual: nada é salvo até o OK). Com valor
 * salvo → o próprio valor.
 */
export function dataInicialSeletor(v: string | undefined, hoje: Date = new Date()): { d: number; m: number; y: number } {
  if (!v || v.length < 10) {
    return { d: hoje.getDate(), m: hoje.getMonth() + 1, y: hoje.getFullYear() };
  }
  return {
    y: parseInt(v.slice(0, 4), 10),
    m: parseInt(v.slice(5, 7), 10),
    d: parseInt(v.slice(8, 10), 10),
  };
}

const MESES_EXTENSO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
/** "sexta, 16 de outubro de 2026" — o que o OK vai salvar. */
export function dataPorExtenso(d: number, m: number, y: number): string {
  const sem = SEMANA[new Date(y, m - 1, d, 12).getDay()];
  return `${sem}, ${d} de ${MESES_EXTENSO[m - 1]} de ${y}`;
}

