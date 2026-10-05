/**
 * Reconciliação dispositivo ⇄ conta OW (user_metadata) — regras puras.
 * Testa o domínio REAL (packages/ow-domain/src/sync-merge.ts) via _ts-resolver.
 * Roda com: node --test tests/sync-merge.test.mjs   (Node >= 22.18)
 */
process.env.TZ = 'America/Sao_Paulo';

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./_ts-resolver.mjs', import.meta.url);

let D;
before(async () => {
  D = await import('../../../packages/ow-domain/src/index.ts');
});

const WEB = { tipo: '14x14', diasEmbarcado: 14, diasFolga: 14, data: '2026-10-01', tipoRef: 'embarquei', aeroporto: 'SBME', excecoes: [] };
const BUDDY_V1 = { data: { tipo: '14x21', dataRef: '2026-09-20', tipoRef: 'desembarquei' } };

// ─── escolherEscalaDaNuvem ─────────────────────────────────────────────────

test('nuvem vazia → null', () => {
  assert.equal(D.escolherEscalaDaNuvem(null), null);
  assert.equal(D.escolherEscalaDaNuvem({}), null);
  assert.equal(D.escolherEscalaDaNuvem({ escala_config: { tipo: 'xx' } }), null);
});

test('lê escala_config do web (formato plano + salvo_em)', () => {
  const r = D.escolherEscalaDaNuvem({ escala_config: { ...WEB, salvo_em: '2026-10-05T10:00:00Z' } });
  assert.equal(r.origem, 'web');
  assert.deepEqual({ tipo: r.cfg.tipo, dataRef: r.cfg.dataRef, aeroporto: r.cfg.aeroporto }, { tipo: '14x14', dataRef: '2026-10-01', aeroporto: 'SBME' });
  assert.equal(r.at, Date.parse('2026-10-05T10:00:00Z'));
});

test('lê ownews_minha_escala legado do Buddy', () => {
  const r = D.escolherEscalaDaNuvem({ ownews_minha_escala: { ...BUDDY_V1, updated_at: 1759600000000 } });
  assert.equal(r.origem, 'buddy');
  assert.equal(r.cfg.tipo, '14x21');
  assert.equal(r.at, 1759600000000);
});

test('com os dois presentes, o mais recente vence; empate → web', () => {
  const web = { ...WEB, salvo_em: '2026-10-05T10:00:00Z' };
  const buddyNovo = { ...BUDDY_V1, updated_at: '2026-10-06T10:00:00Z' };
  const buddyVelho = { ...BUDDY_V1, updated_at: '2026-10-01T10:00:00Z' };
  assert.equal(D.escolherEscalaDaNuvem({ escala_config: web, ownews_minha_escala: buddyNovo }).origem, 'buddy');
  assert.equal(D.escolherEscalaDaNuvem({ escala_config: web, ownews_minha_escala: buddyVelho }).origem, 'web');
  const empate = { ...BUDDY_V1, updated_at: '2026-10-05T10:00:00Z' };
  assert.equal(D.escolherEscalaDaNuvem({ escala_config: web, ownews_minha_escala: empate }).origem, 'web');
});

// ─── escalaConfigParaNuvem / podeGravarEscalaNaNuvem ──────────────────────

test('escalaConfigParaNuvem produz exatamente o que o web lê', () => {
  const out = D.escalaConfigParaNuvem({ tipo: 'custom', diasEmbarcado: 21, diasFolga: 21, dataRef: '2026-10-01', tipoRef: 'embarquei' }, '2026-10-05T12:00:00Z');
  assert.deepEqual(out, {
    tipo: 'personalizada', diasEmbarcado: 21, diasFolga: 21, data: '2026-10-01', tipoRef: 'embarquei',
    aeroporto: '', excecoes: [], salvo_em: '2026-10-05T12:00:00Z',
  });
  // round-trip: o web devolve e o app entende
  const volta = D.escolherEscalaDaNuvem({ escala_config: out });
  assert.equal(volta.cfg.tipo, 'custom');
  assert.equal(volta.cfg.diasEmbarcado, 21);
});

test('não sobrescreve escala_config mais nova editada no web', () => {
  const local = { tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'embarquei', updated_at: '2026-10-05T10:00:00Z' };
  const nuvemNova = D.escolherEscalaDaNuvem({ escala_config: { ...WEB, salvo_em: '2026-10-06T10:00:00Z' } });
  const nuvemVelha = D.escolherEscalaDaNuvem({ escala_config: { ...WEB, salvo_em: '2026-10-04T10:00:00Z' } });
  assert.equal(D.podeGravarEscalaNaNuvem(local, nuvemNova), false);
  assert.equal(D.podeGravarEscalaNaNuvem(local, nuvemVelha), true);
  assert.equal(D.podeGravarEscalaNaNuvem(local, null), true);
  assert.equal(D.podeGravarEscalaNaNuvem(null, null), false);
  // local sem carimbo nunca clobba uma nuvem carimbada
  assert.equal(D.podeGravarEscalaNaNuvem({ ...local, updated_at: undefined }, nuvemVelha), false);
});

// ─── mesclarCertificados ──────────────────────────────────────────────────

test('merge por id: mais recente vence, nunca perde item, tombstone propaga', () => {
  const local = [
    { id: 'a', nome: 'HUET', validade: '2027-01-01', updated_at: '2026-10-05T00:00:00Z' },
    { id: 'b', nome: 'CBSP', validade: '2026-12-01' },
  ];
  const web = [
    { id: 'a', nome: 'HUET', validade: '2028-01-01', updated_at: '2026-10-06T00:00:00Z' }, // mais novo
    { id: 'c', nome: 'NR-33', validade: '2026-11-01', updated_at: '2026-09-01T00:00:00Z', _deleted: true },
  ];
  const legado = [{ id: 'd', nome: 'ASO', validade: '2026-10-30' }];
  const m = D.mesclarCertificados(local, web, legado, null, 'lixo');
  const byId = Object.fromEntries(m.map(c => [c.id, c]));
  assert.equal(m.length, 4);
  assert.equal(byId.a.validade, '2028-01-01');
  assert.equal(byId.b.validade, '2026-12-01');
  assert.equal(byId.c._deleted, true);
  assert.equal(byId.d.nome, 'ASO');
  assert.deepEqual(D.certificadosVisiveis(m).map(c => c.id).sort(), ['a', 'b', 'd']);
});

test('sem carimbo nos dois lados, local vence (não há como decidir)', () => {
  const local = [{ id: 'a', nome: 'HUET', validade: '2027-01-01' }];
  const web = [{ id: 'a', nome: 'HUET', validade: '2020-01-01' }];
  assert.equal(D.mesclarCertificados(local, web)[0].validade, '2027-01-01');
});

test('carimboParaMs aceita number, ISO e lixo', () => {
  assert.equal(D.carimboParaMs(123), 123);
  assert.equal(D.carimboParaMs('2026-10-05T00:00:00Z'), Date.parse('2026-10-05T00:00:00Z'));
  assert.equal(D.carimboParaMs('x'), 0);
  assert.equal(D.carimboParaMs(undefined), 0);
  assert.equal(D.carimboParaMs(NaN), 0);
});

// ─── encontrarJanelasJuntos: default = dia LOCAL ──────────────────────────

test('encontrarJanelasJuntos sem fromISO parte de D.hojeISO() (local), não de UTC', () => {
  const A = { tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'embarquei' };
  const B = { tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'desembarquei' };
  const semArg = D.encontrarJanelasJuntos(A, B);
  const comHoje = D.encontrarJanelasJuntos(A, B, D.hojeISO());
  assert.deepEqual(semArg, comHoje);
});
