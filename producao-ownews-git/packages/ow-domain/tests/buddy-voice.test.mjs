import { strict as assert } from 'assert';
import { test } from 'node:test';

// Inline implementation for pure-node testing
function daySeed() {
  const d = new Date(); return d.getUTCDate() + d.getUTCMonth() * 31;
}
function pick(arr, seed) {
  return arr[((seed % arr.length) + arr.length) % arr.length];
}
function composeOpener(prefs, seed) {
  const { tom, trat, apelido } = prefs;
  const nome = apelido?.trim() || '';
  if (tom === 'discreto') return nome ? `${nome},` : '';
  if (tom === 'buddy') {
    if (nome) return pick([`${nome},`, 'Hey!', ''], seed);
    const vocs = { neutro: ['Hey!', ''], parceiro: ['Hey, Buddy!', 'Ei,'], parceira: ['Hey, Buddy!', 'Ei,'] };
    return pick(vocs[trat], seed);
  }
  if (tom === 'resenha') {
    if (nome) return pick([`${nome},`, ''], Math.floor(seed / 3));
    const vocs = { neutro: ['Então...', ''], parceiro: ['Amigão,', 'Brother,', 'Cara,'], parceira: ['Amiga,', 'Mana,'] };
    return pick(vocs[trat], seed);
  }
  return '';
}

test('discreto+neutro sem apelido: sem abertura', () => {
  const opener = composeOpener({ tom: 'discreto', trat: 'neutro', apelido: '' }, 0);
  assert.equal(opener, '');
});

test('discreto+neutro COM apelido: usa só o apelido', () => {
  const opener = composeOpener({ tom: 'discreto', trat: 'neutro', apelido: 'Oliver' }, 0);
  assert.equal(opener, 'Oliver,');
});

test('buddy+parceiro sem apelido: usa vocativo (nunca concatena nome+vocativo)', () => {
  const opener = composeOpener({ tom: 'buddy', trat: 'parceiro', apelido: '' }, 0);
  assert.ok(['Hey, Buddy!', 'Ei,'].includes(opener), `Got unexpected opener: ${opener}`);
});

test('buddy+parceiro COM apelido: usa nome OU hey, NUNCA "Hey, Buddy! Oliver,"', () => {
  const opener = composeOpener({ tom: 'buddy', trat: 'parceiro', apelido: 'Oliver' }, 0);
  assert.ok(!opener.includes('Hey, Buddy!') || !opener.includes('Oliver'),
    `Opener concatenates vocativo+apelido: "${opener}"`);
});

test('resenha+parceiro sem apelido: usa vocativo brasileiro', () => {
  const opener = composeOpener({ tom: 'resenha', trat: 'parceiro', apelido: '' }, 0);
  assert.ok(['Amigão,', 'Brother,', 'Cara,'].includes(opener));
});

test('resenha+parceira COM apelido: usa só nome (seed 0)', () => {
  const opener = composeOpener({ tom: 'resenha', trat: 'parceira', apelido: 'Ana' }, 0);
  assert.ok(['Ana,', ''].includes(opener));
});

test('mensagem final nunca é "nome, vocativo, template"', () => {
  // Simulate message composition
  function compose(prefs, corpo) {
    const opener = composeOpener(prefs, 5);
    return opener ? `${opener} ${corpo}` : corpo;
  }
  const msg = compose({ tom: 'buddy', trat: 'parceiro', apelido: 'Oliver' }, 'Faltam 2 dias.');
  // Must NOT contain both a vocativo and the name
  const hasVocativo = msg.includes('Hey, Buddy!') || msg.includes('Ei,');
  const hasNome = msg.includes('Oliver');
  assert.ok(!(hasVocativo && hasNome), `Both vocativo and nome in: "${msg}"`);
});

test('seed determinístico: mesma semente = mesma mensagem', () => {
  const prefs = { tom: 'buddy', trat: 'neutro', apelido: '' };
  const o1 = composeOpener(prefs, 42);
  const o2 = composeOpener(prefs, 42);
  assert.equal(o1, o2);
});

test('seed diferente pode dar mensagem diferente', () => {
  const prefs = { tom: 'resenha', trat: 'parceiro', apelido: '' };
  const results = new Set();
  for (let s = 0; s < 20; s++) results.add(composeOpener(prefs, s));
  assert.ok(results.size > 1, 'Expected variety from different seeds');
});
