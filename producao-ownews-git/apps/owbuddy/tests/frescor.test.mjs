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

test('notícia: só manchete das últimas 48 h, a mais recente', () => {
  const a = [
    { id: '1', title: 'Antiga', published_at: '2026-10-16T10:00:00Z' },
    { id: '2', title: 'Recente', published_at: '2026-10-19T13:50:00Z' },
    { id: '3', title: 'Ontem', published_at: '2026-10-18T10:00:00Z' },
    { id: '4', title: 'Futuro absurdo', published_at: '2026-10-25T10:00:00Z' },
    { id: '5', title: '', published_at: '2026-10-19T17:00:00Z' },
  ];
  assert.equal(F.noticiaRecenteHome(a, AGORA).id, '2');
  assert.equal(F.noticiaRecenteHome([a[0]], AGORA), null);
  assert.equal(F.noticiaRecenteHome([], AGORA), null);
  assert.equal(F.noticiaRecenteHome([{ id: 'x', title: 'Sem data', published_at: '' }], AGORA), null);
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
