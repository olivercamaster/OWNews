/**
 * Saudação + frase do dia — biblioteca EDITORIAL local (sem IA, sem rede).
 * Rotação determinística por dia: dentro do mesmo estilo e período, a frase muda todo dia
 * e só se repete depois de percorrer toda a lista (índice = dia % tamanho).
 * Sem religião, sem política, sem coach; poucas referências ao mar — de propósito.
 */
export type EstiloSaudacao = 'PARCEIRO' | 'DIRETO' | 'MOTIVACIONAL' | 'DISCRETO';
export type Periodo = 'manha' | 'tarde' | 'noite';

export const ESTILOS_SAUDACAO: EstiloSaudacao[] = ['PARCEIRO', 'DIRETO', 'MOTIVACIONAL', 'DISCRETO'];
export const LABEL_ESTILO_SAUDACAO: Record<EstiloSaudacao, string> = {
  PARCEIRO: 'Parceiro', DIRETO: 'Direto', MOTIVACIONAL: 'Motivacional', DISCRETO: 'Discreto',
};

type Frase = { t: string; p?: Periodo };

export const FRASES: Record<EstiloSaudacao, Frase[]> = {
  PARCEIRO: [
    { t: 'Bora fazer acontecer.' },
    { t: 'Seguimos na lida.' },
    { t: 'Um dia de cada vez, sem pressa e sem parar.' },
    { t: 'Bons ventos e águas tranquilas.' },
    { t: 'Tamo junto nessa.' },
    { t: 'Café passado, cabeça no lugar.' },
    { t: 'Organizado, tudo fica mais leve.' },
    { t: 'Hoje é dia de resolver pendência.' },
    { t: 'Bora pra cima, com calma.' },
    { t: 'Família perto, mesmo de longe.' },
    { t: 'Deu trabalho? Faz parte.' },
    { t: 'Cuidar de você também é serviço.' },
    { t: 'Conta comigo pra lembrar.' },
    { t: 'Mais um dia, mais uma marca no calendário.' },
    { t: 'Escala anotada, cabeça tranquila.' },
    { t: 'Nada como uma lista pronta.' },
    { t: 'Devagar também se chega.' },
    { t: 'Firme e sem estresse.' },
    { t: 'Começa leve que o dia rende.', p: 'manha' },
    { t: 'Primeiro o café, depois o mundo.', p: 'manha' },
    { t: 'Metade do dia vencida.', p: 'tarde' },
    { t: 'Segue o baile.', p: 'tarde' },
    { t: 'Mais um dia vencido.', p: 'noite' },
    { t: 'Descansa que amanhã tem mais.', p: 'noite' },
  ],
  DIRETO: [
    { t: 'Veja o que vem pela frente.' },
    { t: 'Confira seus próximos compromissos.' },
    { t: 'Confira a lista do embarque com antecedência.' },
    { t: 'Certificados em dia evitam correria.' },
    { t: 'Um olhar rápido nos próximos dias.' },
    { t: 'Tudo o que é seu, num só lugar.' },
    { t: 'Planeje a folga com a escala aberta.' },
    { t: 'Anote agora, esqueça depois.' },
    { t: 'Pendência pequena se resolve hoje.' },
    { t: 'Documentos: melhor conferir antes.' },
    { t: 'Uma coisa de cada vez.' },
    { t: 'Prioridade primeiro, o resto depois.' },
    { t: 'O que não está anotado se perde.' },
    { t: 'Antecedência é tranquilidade.' },
    { t: 'Confira o horário antes de sair.' },
    { t: 'Revise o que vence este mês.' },
    { t: 'Menos correria, mais controle.' },
    { t: 'Folga também se planeja.' },
    { t: 'Lembrou de algo? Anote aqui.' },
    { t: 'Bom momento para revisar o dia.', p: 'manha' },
    { t: 'Comece pelo mais importante.', p: 'manha' },
    { t: 'Ainda dá tempo de resolver hoje.', p: 'tarde' },
    { t: 'Deixe pronto o que for de amanhã.', p: 'noite' },
    { t: 'Amanhã começa hoje à noite.', p: 'noite' },
  ],
  MOTIVACIONAL: [
    { t: 'Um passo de cada vez.' },
    { t: 'Constância também leva longe.' },
    { t: 'Constância também é progresso.' },
    { t: 'Feito é melhor que perfeito.' },
    { t: 'Pouco todo dia vira muito.' },
    { t: 'Descanso também faz parte do trabalho.' },
    { t: 'Você já chegou longe.' },
    { t: 'Dia difícil também passa.' },
    { t: 'O básico bem feito resolve muito.' },
    { t: 'Disciplina hoje, folga tranquila amanhã.' },
    { t: 'Cada embarque é um passo a mais.' },
    { t: 'Paciência também é força.' },
    { t: 'Quem se prepara viaja mais leve.' },
    { t: 'Cuide da cabeça tanto quanto do corpo.' },
    { t: 'Pequenas vitórias contam.' },
    { t: 'Seu ritmo, seu caminho.' },
    { t: 'Firmeza sem pressa.' },
    { t: 'A saudade é grande porque o motivo é bom.' },
    { t: 'Dia novo, página nova.', p: 'manha' },
    { t: 'Hoje é um bom dia para começar.', p: 'manha' },
    { t: 'Segue no ritmo.', p: 'tarde' },
    { t: 'O dia ainda tem muito a render.', p: 'tarde' },
    { t: 'Amanhã tem mais.', p: 'noite' },
    { t: 'Hoje rendeu. Descanse.', p: 'noite' },
  ],
  DISCRETO: [
    { t: 'Tudo à mão.' },
    { t: 'Seu dia, organizado.' },
    { t: 'Sem pressa.' },
    { t: 'Calma e foco.' },
    { t: 'Bom trabalho.' },
    { t: 'Seus próximos dias, logo abaixo.' },
    { t: 'Um dia tranquilo.' },
    { t: 'Siga no seu ritmo.' },
    { t: 'Tudo anotado.' },
    { t: 'Pronto quando você estiver.' },
    { t: 'Pé no chão.' },
    { t: 'Leve e organizado.' },
    { t: 'Com calma.' },
    { t: 'No seu tempo.' },
    { t: 'Boa jornada.' },
    { t: 'Ao seu lado.' },
    { t: 'Passo firme.' },
    { t: 'Tudo no lugar.' },
    { t: 'Bom começo.', p: 'manha' },
    { t: 'Manhã tranquila.', p: 'manha' },
    { t: 'Boa sequência.', p: 'tarde' },
    { t: 'Tarde tranquila.', p: 'tarde' },
    { t: 'Bom descanso.', p: 'noite' },
    { t: 'Noite tranquila.', p: 'noite' },
  ],
};

export function periodoDoDia(hora: number): Periodo {
  if (hora >= 5 && hora < 12) return 'manha';
  if (hora >= 12 && hora < 18) return 'tarde';
  return 'noite';
}

const BASE: Record<Periodo, string> = { manha: 'Bom dia', tarde: 'Boa tarde', noite: 'Boa noite' };

/**
 * Vocativos da saudação (estilos Parceiro e Motivacional), um por dia.
 * Masculino: resenha respeitosa. Feminino: lista menor e sem "amiga"
 * (pedido do dono — soa condescendente). Sem tratamento: "Buddy".
 */
export const VOCATIVOS: Record<'neutro' | 'parceiro' | 'parceira', string[]> = {
  neutro: ['Buddy'],
  parceiro: ['Buddy', 'irmão', 'parceiro', 'parça', 'brother', 'bro', 'meu chapa', 'campeão', 'guerreiro', 'chefe', 'mestre', 'meu consagrado'],
  parceira: ['Buddy', 'parceira', 'guerreira', 'campeã', 'chefe'],
};

/**
 * "Bom dia, irmão!" / "Boa tarde, Oliver!" / "Boa noite."
 * - Parceiro/Motivacional: com nome, o nome em 2 de cada 3 dias e um
 *   vocativo no outro; sem nome, um vocativo do dia (sem tratamento → "Buddy").
 * - Direto/Discreto: só o nome, se houver.
 */
export function saudacaoTopo(
  agora: Date,
  estilo: EstiloSaudacao,
  nome?: string | null,
  trat?: 'neutro' | 'parceiro' | 'parceira' | null,
): string {
  const base = BASE[periodoDoDia(agora.getHours())];
  const n = nome?.trim();
  const informal = estilo === 'PARCEIRO' || estilo === 'MOTIVACIONAL';
  const fim = informal ? '!' : '.';
  if (!informal) return n ? `${base}, ${n}${fim}` : `${base}${fim}`;
  const dia = numeroDoDia(agora);
  const pool = VOCATIVOS[trat ?? 'neutro'] ?? VOCATIVOS.neutro;
  const voc = pool[dia % pool.length]!;
  if (n && (dia % 3 !== 0 || (trat ?? 'neutro') === 'neutro')) return `${base}, ${n}${fim}`;
  return `${base}, ${voc}${fim}`;
}

/** Número do dia LOCAL (estável o dia todo; muda à meia-noite do aparelho). */
export function numeroDoDia(agora: Date): number {
  return Math.floor(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) / 86400000);
}

const DESLOCAMENTO: Record<EstiloSaudacao, number> = { PARCEIRO: 0, DIRETO: 5, MOTIVACIONAL: 11, DISCRETO: 17 };

/** Frase do dia: muda a cada dia e não se repete em dias consecutivos (mesmo estilo/período). */
export function fraseDoDia(agora: Date, estilo: EstiloSaudacao): string {
  const p = periodoDoDia(agora.getHours());
  const pool = (FRASES[estilo] ?? FRASES.DISCRETO).filter(f => !f.p || f.p === p);
  const i = (numeroDoDia(agora) + DESLOCAMENTO[estilo]) % pool.length;
  return pool[i]!.t;
}
