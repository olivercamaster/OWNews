import { BuddyPrefs, BuddyTom, BuddyTrat, BuddyEventoKey, BuddyTemplateCtx, Momento } from './types';

function daySeed(): number {
  const d = new Date();
  return d.getUTCDate() + d.getUTCMonth() * 31;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[((seed % arr.length) + arr.length) % arr.length];
}

function composeOpener(prefs: BuddyPrefs, seed: number): string {
  const { tom, trat, apelido } = prefs;
  const nome = apelido?.trim() || '';

  if (tom === 'discreto') {
    return nome ? `${nome},` : '';
  }

  if (tom === 'buddy') {
    if (nome) {
      return pick([`${nome},`, 'Hey!', ''], seed);
    }
    const vocs: Record<BuddyTrat, string[]> = {
      neutro:    ['Hey!', ''],
      parceiro:  ['Hey, Buddy!', 'Ei,'],
      parceira:  ['Hey, Buddy!', 'Ei,'],
    };
    return pick(vocs[trat], seed);
  }

  if (tom === 'resenha') {
    if (nome) {
      return pick([`${nome},`, ''], Math.floor(seed / 3));
    }
    const vocs: Record<BuddyTrat, string[]> = {
      neutro:   ['Então...', ''],
      parceiro: ['Amigão,', 'Brother,', 'Cara,'],
      parceira: ['Amiga,', 'Mana,'],
    };
    return pick(vocs[trat], seed);
  }

  return '';
}

type TemplateVariant = (ctx: BuddyTemplateCtx) => string;

const TEMPLATES: Record<BuddyTom, Record<BuddyEventoKey, TemplateVariant[]>> = {
  discreto: {
    folga_distante:       [() => 'Aproveite a folga.',
                           (c) => c.dias != null ? `Embarque em ${c.dias} dias.` : 'Aproveite a folga.'],
    embarque_distante:    [(c) => `Embarque em ${c.dias} dias. Boa folga.`],
    embarque_proximo:     [(c) => `Faltam ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'} pro embarque.`,
                           (c) => `Embarque em ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'}. Verifique a mala.`],
    vespera_embarque:     [() => 'Amanhã é dia de embarcar.',
                           () => 'Embarque amanhã. Tudo pronto?'],
    embarcado:            [(c) => `Você está embarcado. Desembarque em ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'}.`],
    desembarque_proximo:  [(c) => `Desembarque em ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'}.`],
    viagem_amanha:        [() => 'Sua viagem é amanhã.'],
    mala_incompleta:      [(c) => `${c.pendentes} ${c.pendentes === 1 ? 'item pendente' : 'itens pendentes'} na mala.`],
    cert_vencendo:        [(c) => `${c.certNome} vence em breve.`],
  },
  buddy: {
    folga_distante:       [() => 'Aproveite a folga!',
                           () => 'Descanse bem.'],
    embarque_distante:    [(c) => `Embarque em ${c.dias} dias. Bora aproveitar a folga?`],
    embarque_proximo:     [(c) => `Faltam ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'} pro embarque. Bora conferir a mala?`,
                           (c) => `${c.dias} ${c.dias === 1 ? 'dia' : 'dias'} pro embarque. Tá de olho na mala?`],
    vespera_embarque:     [() => 'Amanhã tem embarque. Tudo certo com a mala e os documentos?',
                           () => 'Embarque amanhã! Checou tudo?'],
    embarcado:            [(c) => `Você tá embarcado. Desembarque em ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'}!`],
    desembarque_proximo:  [(c) => `Desembarque em ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'}. Quase lá!`],
    viagem_amanha:        [() => 'Amanhã tem viagem! Tá pronto?',
                           () => 'Viagem amanhã. Já deixou tudo encaminhado?'],
    mala_incompleta:      [(c) => `Ficaram ${c.pendentes} ${c.pendentes === 1 ? 'coisa' : 'coisas'} na mala.`],
    cert_vencendo:        [(c) => `${c.certNome} tá vencendo em breve. Dá uma olhada?`],
  },
  resenha: {
    folga_distante:       [() => 'Curte a folga aí.',
                           () => 'Sossega. Embarque longe ainda.'],
    embarque_distante:    [(c) => `Embarque em ${c.dias} dias. Tempo de sobra ainda.`],
    embarque_proximo:     [(c) => `Tá chegando a hora. ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'} pro embarque.`,
                           (c) => `${c.dias} ${c.dias === 1 ? 'dia' : 'dias'} pro embarque. Solta a mala do guarda-roupa.`],
    vespera_embarque:     [() => 'Amanhã tem serviço. Checou tudo mesmo?',
                           () => 'Embarque amanhã. Não esquece de nada.'],
    embarcado:            [(c) => `Tá embarcado. Desembarque em ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'}.`],
    desembarque_proximo:  [(c) => `Desembarque em ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'}. Quase em casa.`],
    viagem_amanha:        [() => 'Amanhã tem viagem. Não perde o horário.',
                           () => 'Viagem amanhã. Já sabe o que tá levando?'],
    mala_incompleta:      [(c) => `Ainda faltam ${c.pendentes} ${c.pendentes === 1 ? 'coisa' : 'coisas'} na mala.`],
    cert_vencendo:        [(c) => `${c.certNome} vencendo logo. Vai deixar pra última hora?`],
  },
};

export function gerarMensagem(
  prefs: BuddyPrefs,
  evento: BuddyEventoKey,
  ctx: BuddyTemplateCtx = {},
  seed?: number,
): string {
  const s = seed !== undefined ? seed : daySeed();
  const tom = (prefs.tom || 'discreto') as BuddyTom;
  const opener = composeOpener(prefs, s);
  const variants = (TEMPLATES[tom] || TEMPLATES.discreto)[evento] || TEMPLATES.discreto[evento];
  const template = pick(variants, Math.floor(s / 7));
  const body = template(ctx);
  return opener ? `${opener} ${body}` : body;
}

export function gerarMensagemMomento(momento: Momento, prefs: BuddyPrefs): string {
  const { tipo, diasEmbarque, diasDesembarque } = momento;
  switch (tipo) {
    case 'SEM_ESCALA':          return '';
    case 'FOLGA':
      if ((diasEmbarque || 0) > 5) return gerarMensagem(prefs, 'folga_distante', { dias: diasEmbarque });
      return gerarMensagem(prefs, 'embarque_distante', { dias: diasEmbarque });
    case 'EMBARQUE_DISTANTE':   return gerarMensagem(prefs, 'embarque_distante',  { dias: diasEmbarque });
    case 'EMBARQUE_PROXIMO':    return gerarMensagem(prefs, 'embarque_proximo',   { dias: diasEmbarque });
    case 'VESPERA_EMBARQUE':    return gerarMensagem(prefs, 'vespera_embarque',   {});
    case 'EMBARCADO':           return gerarMensagem(prefs, 'embarcado',          { dias: diasDesembarque });
    case 'DESEMBARQUE_PROXIMO': return gerarMensagem(prefs, 'desembarque_proximo',{ dias: diasDesembarque });
    default:                    return '';
  }
}

export const DEFAULT_BUDDY_PREFS: BuddyPrefs = {
  tom: 'discreto',
  trat: 'neutro',
  apelido: '',
};

export function getPreviewMensagem(prefs: BuddyPrefs, seed = 0): string {
  const momento: Momento = { tipo: 'EMBARQUE_PROXIMO', diasEmbarque: 2 };
  return gerarMensagemMomento(momento, prefs);
}
