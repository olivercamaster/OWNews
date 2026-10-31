/**
 * Notícias OWNews relacionadas às entidades do Radar — casamento CONSERVADOR.
 *
 *  - Texto analisado: título + PRIMEIRA frase do resumo do Buddy (o resto do resumo e o corpo
 *    citam unidades de passagem — "cargas da P-74, P-75…" não é notícia da P-74). Operadora:
 *    só o título.
 *  - Unidade: nome completo como frase exata (sem acento/caixa). Nome de uma palavra só e sem
 *    número (ex.: "Carolina") NÃO casa sozinho — é comum demais.
 *    Nome oficial "PETROBRAS 58" NÃO é termo ("Petrobras (58%)…" casaria): só o alias "P-58".
 *  - Campo: só com a palavra "campo(s)" antes ("campo de Búzios", "campos de Búzios e Mero") —
 *    Búzios é cidade, Jubarte é baleia, Bacalhau é peixe.
 *  - Operador: aliases revisados à mão (ALIASES_OPERADOR); sem alias, nome completo de 2+ palavras.
 *  - Notícia da UNIDADE ≠ notícia da OPERADORA: listas separadas.
 */
import { chaveNome } from '../lib/texto.mjs';

/** Aliases revisados (chave = nome curto ANP em chaveNome). Só nomes inequívocos no setor. */
export const ALIASES_OPERADOR = {
  PETROBRAS: ['PETROBRAS'],
  'SHELL BRASIL': ['SHELL'],
  EQUINOR: ['EQUINOR'],
  TOTALENERGIES: ['TOTALENERGIES'],
  'TOTALENERGIES EP': ['TOTALENERGIES'],
  'TRIDENT ENERGY': ['TRIDENT ENERGY'],
  PERENCO: ['PERENCO'],
  KAROON: ['KAROON'],
  'BW ENERGY': ['BW ENERGY'],
  'BRAVA ENERGIA': ['BRAVA ENERGIA'],
  'PRIO BRAVO': ['PRIO'], 'PRIO FORTE': ['PRIO'], 'PRIO TIGRIS': ['PRIO'],
  SEADRILL: ['SEADRILL'],
  'TRANSOCEAN BRASIL': ['TRANSOCEAN'],
  CONSTELLATION: ['CONSTELLATION'],
  VALARIS: ['VALARIS'],
  FORESEA: ['FORESEA'],
  'NOBLE CORPORATION': ['NOBLE CORPORATION'],
  'VENTURA PETROLEO S A': ['VENTURA PETROLEO'],
  ETESCO: ['ETESCO'],
  FORESEA2: ['FORESEA'],
  'OCYAN S A': ['OCYAN'], 'OCYAN 2': ['OCYAN'],
};

/**
 * Vagas reais do Radar de Vagas por operador: empresa da vaga = alias revisado do operador
 * (nome exato, sem inferir vaga pelo setor). Devolve id → { total, exemplos[≤3] }.
 */
export function vagasPorOperador(vagas, operadores) {
  const out = {};
  for (const o of operadores) {
    const termos = new Set(termosOperador(o));
    if (!termos.size) continue;
    const minhas = (vagas || []).filter((v) => v && termos.has(chaveNome(v.empresa)));
    if (minhas.length) out[o.id] = { empresa: String(minhas[0].empresa).slice(0, 80), total: minhas.length, exemplos: minhas.slice(0, 3).map((v) => ({ titulo: String(v.titulo || '').slice(0, 120), local: String(v.local || '').slice(0, 60) })) };
  }
  return out;
}

/** Termos da unidade (frases em chaveNome) — vazio = não casa automaticamente. */
export function termosUnidade(u) {
  const termos = new Set();
  for (const n of [u.nome_anp, u.nome]) {
    const k = chaveNome(n);
    if (!k) continue;
    const num = /^(?:PETROBRAS|PLATAFORMA)\s+(\d{1,3})$/.exec(k);
    if (num) { termos.add(`P ${num[1]}`); continue; }
    if (k.split(' ').length >= 2 || /\d/.test(k)) termos.add(k);
  }
  return [...termos];
}

/** Frase inteira dentro do texto já normalizado (com bordas de palavra). */
export function contemFrase(textoChave, frase) {
  return frase && ` ${textoChave} `.includes(` ${frase} `);
}

/**
 * Campo citado com "campo(s)" antes, inclusive em listas ("campos de Búzios, Sépia e Mero").
 * Entre "campo(s)" e o nome só podem vir conectores ou palavras de OUTROS nomes de campo
 * (`palavrasCampos`): "campo de testes na região de Búzios" não casa.
 */
const CONECTORES = new Set(['DE', 'DO', 'DA', 'DOS', 'DAS', 'E', 'NO', 'NA', 'NOS', 'NAS']);
export function citaCampo(textoChave, nomeCampoChave, palavrasCampos = new Set()) {
  if (!nomeCampoChave) return false;
  const tokens = textoChave.split(' ');
  const alvo = nomeCampoChave.split(' ');
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== 'CAMPO' && tokens[i] !== 'CAMPOS') continue;
    for (let j = i + 1; j <= i + 10 && j < tokens.length; j++) {
      if (alvo.every((t, k) => tokens[j + k] === t)) return true;
      if (!CONECTORES.has(tokens[j]) && !palavrasCampos.has(tokens[j])) break;
    }
  }
  return false;
}

export function primeiraFrase(s) {
  const t = String(s || '').trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  return (m ? m[1] : t).slice(0, 400);
}

export function termosOperador(o) {
  const k = chaveNome(o.nome);
  if (ALIASES_OPERADOR[k]) return ALIASES_OPERADOR[k];
  return k.split(' ').length >= 2 ? [k] : [];
}

/**
 * Relaciona notícias (mais recentes primeiro) às entidades. Devolve { unidades, campos,
 * operadores }: id → [{ id, titulo, data }] (no máximo `max` por entidade, últimos 12 meses).
 */
export function relacionarNoticias(artigos, snap, { max = 8, agora = Date.now() } = {}) {
  const limite = agora - 365 * 86400000;
  const textos = artigos
    .filter((a) => a && a.id && a.title && Date.parse(a.published_at) >= limite)
    .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)))
    .map((a) => ({ a, k: chaveNome(`${a.title} . ${primeiraFrase(a.buddy_summary)}`), t: chaveNome(a.title) }));
  const out = { unidades: {}, campos: {}, operadores: {} };
  const anexar = (grupo, id, a) => {
    const l = (out[grupo][id] = out[grupo][id] || []);
    if (l.length < max && !l.some((x) => x.id === a.id)) l.push({ id: a.id, titulo: String(a.title).slice(0, 200), data: String(a.published_at).slice(0, 10) });
  };
  for (const u of snap.unidades) {
    const termos = termosUnidade(u);
    if (!termos.length) continue;
    for (const { a, k } of textos) if (termos.some((t) => contemFrase(k, t))) anexar('unidades', u.id, a);
  }
  const palavrasCampos = new Set(snap.campos.flatMap((c) => chaveNome(c.nome_anp).split(' ')));
  for (const c of snap.campos) {
    const alvo = chaveNome(c.nome_anp);
    for (const { a, k } of textos) if (citaCampo(k, alvo, palavrasCampos)) anexar('campos', c.id, a);
  }
  for (const o of snap.operadores) {
    const termos = termosOperador(o);
    if (!termos.length) continue;
    for (const { a, t: titulo } of textos) if (termos.some((t) => contemFrase(titulo, t))) anexar('operadores', o.id, a);
  }
  return out;
}
