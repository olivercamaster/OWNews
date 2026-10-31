import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./_ts-resolver.mjs', import.meta.url);
let F;
before(async () => { F = await import('../src/frescor.ts'); });

const AGORA = Date.parse('2026-10-19T18:00:00Z');
const H = 3600_000;

test('vagas: número só com lista recente E verificação recente', () => {
  assert.equal(F.contadorVagasHome(14, AGORA, '2026-10-19T14:44:53Z', AGORA), 14);
  assert.equal(F.contadorVagasHome(14, AGORA - 23 * H, '2026-10-19T14:44:53Z', AGORA), 14);
  assert.equal(F.contadorVagasHome(14, AGORA - 25 * H, '2026-10-19T14:44:53Z', AGORA), null, 'cache velho');
  assert.equal(F.contadorVagasHome(14, AGORA, '2026-10-15T00:00:00Z', AGORA), null, 'verificação velha');
  assert.equal(F.contadorVagasHome(14, AGORA, null, AGORA), null, 'sem updated_at (cache antigo)');
  assert.equal(F.contadorVagasHome(0, AGORA, '2026-10-19T14:44:53Z', AGORA), null);
  assert.equal(F.contadorVagasHome(14, undefined, '2026-10-19T14:44:53Z', AGORA), null);
});

test('notícia: idade curta — uma regra só para o Buddy', () => {
  assert.equal(F.idadeCurta('2026-10-19T17:59:40Z', AGORA), 'agora');
  assert.equal(F.idadeCurta('2026-10-19T18:05:00Z', AGORA), 'agora', 'fonte com relógio adiantado');
  assert.equal(F.idadeCurta('2026-10-19T17:45:00Z', AGORA), '15min');
  assert.equal(F.idadeCurta('2026-10-19T16:00:00+00:00', AGORA), '2h');
  assert.equal(F.idadeCurta('2026-10-19T12:59:00.123-03:00', AGORA), '2h', 'offset BRT');
  assert.equal(F.idadeCurta('2026-10-18T17:00:00Z', AGORA), '1d');
  assert.equal(F.idadeCurta('', AGORA), '');
  assert.equal(F.idadeCurta('lixo', AGORA), '');
});

const hAtras = (h) => new Date(AGORA - h * H).toISOString();
const N = (id, h, score, title) => ({ id, title: title || `Fato ${id}x com empresa${id} e navio${id}`, published_at: hAtras(h), editorial_score: score });
const ids = (l) => l.map((x) => x.id);

test('destaques: 3 boas recentes → 3; 2 → 2; 1 → 1; 10 → no máximo 3', () => {
  assert.deepEqual(ids(F.destaquesHome([N('a', 1, 90), N('b', 3, 85), N('c', 5, 80)], AGORA)), ['a', 'b', 'c']);
  assert.deepEqual(ids(F.destaquesHome([N('a', 1, 90), N('b', 3, 85), N('x', 2, 20)], AGORA)), ['a', 'b'], 'fraca não completa');
  assert.deepEqual(ids(F.destaquesHome([N('a', 2, 90), N('x', 1, 30)], AGORA)), ['a']);
  const dez = Array.from({ length: 10 }, (_, k) => N('n' + k, k + 0.5, 70 + k));
  assert.equal(F.destaquesHome(dez, AGORA).length, 3);
});

test('destaques: relevância × recência (breaking de 2 h e contrato de 5 h acima da técnica de 20 min)', () => {
  const l = [
    N('tecnica', 0.33, 55, 'Nota técnica sobre calibração de sensores em laboratório'),
    N('contrato', 5, 100, 'Petrobras contrata nova sonda por US$ 1 bilhão para Búzios'),
    N('breaking', 2, 80, 'Incêndio atinge plataforma na Bacia de Campos'),
    N('velha', 30, 106, 'Grande descoberta anunciada há mais de um dia na Margem Equatorial'),
  ];
  assert.deepEqual(ids(F.destaquesHome(l, AGORA)), ['contrato', 'breaking', 'tecnica']);
  assert.ok(!ids(F.destaquesHome(l, AGORA)).includes('velha'), 'com notícia de hoje, a de 30 h fica de fora');
});

test('destaques: mesma pauta não ocupa três vagas; boa alternativa entra', () => {
  const l = [
    N('p1', 1, 100, 'Petrobras anuncia contrato da FPSO P-90 com a Seatrium'),
    N('p2', 2, 95, 'Petrobras detalha contrato da FPSO P-90 com a Seatrium'),
    N('p3', 3, 90, 'Seatrium confirma contrato da FPSO P-90 com a Petrobras'),
    N('o1', 4, 70, 'Foresea mobiliza sonda para campanha na Bacia de Santos'),
  ];
  assert.deepEqual(ids(F.destaquesHome(l, AGORA)), ['p1', 'o1']);
  assert.equal(F.mesmaPauta('Petrobras detalha contrato da FPSO P-90 com a Seatrium', 'Petrobras anuncia contrato da FPSO P-90 com a Seatrium'), true);
  assert.equal(F.mesmaPauta('Foresea mobiliza sonda para campanha na Bacia de Santos', 'Petrobras anuncia contrato da FPSO P-90 com a Seatrium'), false);
});

test('destaques: sem foto entra; duplicada aparece uma vez; dia parado usa até 2 de 24–48 h', () => {
  assert.deepEqual(ids(F.destaquesHome([{ ...N('s', 1, 80), image_url: null }], AGORA)), ['s']);
  assert.deepEqual(ids(F.destaquesHome([N('d', 1, 80), N('d', 1, 80), N('e', 2, 70)], AGORA)), ['d', 'e']);
  assert.deepEqual(ids(F.destaquesHome([N('o1', 30, 90), N('o2', 26, 60), N('o3', 40, 100), N('o4', 50, 100)], AGORA)), ['o2', 'o1']);
  assert.deepEqual(F.destaquesHome([N('z', 60, 100)], AGORA), [], 'nada com mais de 48 h');
  assert.deepEqual(F.destaquesHome([{ id: 'f', title: 'Data futura absurda', published_at: hAtras(-48), editorial_score: 90 }], AGORA), []);
  assert.deepEqual(ids(F.destaquesHome([{ id: 'c', title: 'Cache antigo sem score editorial', published_at: hAtras(3) }], AGORA)), ['c'], 'cache sem editorial_score continua válido');
  assert.deepEqual(F.destaquesHome([], AGORA), []);
});

test('Cruzar: ícones vetoriais; emojis antigos salvos continuam válidos', async () => {
  const R = await import('../src/relacao-icones.ts');
  const glifos = JSON.parse((await import('node:fs')).readFileSync(new URL('../../../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json', import.meta.url), 'utf8'));
  for (const k of R.ICONES_ORDEM) assert.ok(glifos[R.ioniconRelacao(k)] != null, `Ionicons sem ${R.ioniconRelacao(k)}`);
  assert.equal(R.chaveIconeRelacao('🤜🤛'), 'irmaos');
  assert.equal(R.ioniconRelacao('🤜🤛'), 'people');
  assert.equal(R.ioniconRelacao('❤️'), 'heart');
  assert.equal(R.ioniconRelacao('irmaos'), 'people');
  assert.equal(R.ioniconRelacao(undefined), 'link');
  assert.equal(R.ioniconRelacao('🦄'), 'link');
});

test('clima: atual até 1 h, armazenado até 6 h, antigo depois (não vira "agora")', () => {
  assert.equal(F.frescorClima(AGORA - 10 * 60e3, AGORA), 'atual');
  assert.equal(F.frescorClima(AGORA - 3 * H, AGORA), 'armazenado');
  assert.equal(F.frescorClima(AGORA - 7 * H, AGORA), 'antigo');
  assert.equal(F.frescorClima(null, AGORA), 'antigo');
});
