import { strict as assert } from 'assert';
import { test } from 'node:test';

const ITENS_PADRAO = [
  { id: 'desodorante', t: 'Desodorante', cat: 'higiene' },
  { id: 'escova', t: 'Escova de dente', cat: 'higiene' },
  { id: 'medicamentos', t: 'Medicamentos', cat: 'saude' },
  { id: 'carregador', t: 'Carregador', cat: 'eletronicos' },
];

function criarChecklistPadrao(ciclo) {
  return { items: ITENS_PADRAO.map(i => ({ ...i, ok: false })), ciclo };
}

function contarPendentes(data) {
  const total = data.items.length;
  const feitos = data.items.filter(i => i.ok).length;
  return { total, feitos, pendentes: total - feitos };
}

function toggleItem(data, id) {
  return { ...data, items: data.items.map(i => i.id === id ? { ...i, ok: !i.ok } : i) };
}

function deveResetarChecklist(data, nextEmbarqueISO) {
  return data.ciclo !== nextEmbarqueISO;
}

test('criar checklist padrão: todos pendentes', () => {
  const c = criarChecklistPadrao('2026-11-01');
  assert.equal(c.ciclo, '2026-11-01');
  assert.equal(c.items.every(i => !i.ok), true);
});

test('contar pendentes: inicial = todos pendentes', () => {
  const c = criarChecklistPadrao('2026-11-01');
  const r = contarPendentes(c);
  assert.equal(r.pendentes, ITENS_PADRAO.length);
  assert.equal(r.feitos, 0);
});

test('toggle marca como feito', () => {
  let c = criarChecklistPadrao('2026-11-01');
  c = toggleItem(c, 'desodorante');
  assert.equal(c.items.find(i => i.id === 'desodorante').ok, true);
  assert.equal(contarPendentes(c).feitos, 1);
});

test('toggle duplo volta ao estado original', () => {
  let c = criarChecklistPadrao('2026-11-01');
  c = toggleItem(c, 'desodorante');
  c = toggleItem(c, 'desodorante');
  assert.equal(c.items.find(i => i.id === 'desodorante').ok, false);
});

test('resetar: ciclo diferente → deve resetar', () => {
  const c = criarChecklistPadrao('2026-10-01');
  assert.equal(deveResetarChecklist(c, '2026-11-01'), true);
});

test('resetar: mesmo ciclo → não deve resetar', () => {
  const c = criarChecklistPadrao('2026-11-01');
  assert.equal(deveResetarChecklist(c, '2026-11-01'), false);
});

test('editarItem renomeia sem mexer no estado; texto vazio não muda nada', async () => {
  const D = await import('../src/checklist.ts');
  const base = { ciclo: '2026-11-09', items: [{ id: 'a', t: 'A', cat: 'roupas', ok: true }, { id: 'b', t: 'B', cat: 'roupas', ok: false }] };
  const e = D.editarItem(base, 'a', '  Casaco  ');
  assert.equal(e.items[0].t, 'Casaco');
  assert.equal(e.items[0].ok, true);
  assert.equal(D.editarItem(base, 'a', '   '), base);
});

test('desmarcarTodos mantém itens e ciclo', async () => {
  const D = await import('../src/checklist.ts');
  const base = { ciclo: '2026-11-09', items: [{ id: 'a', t: 'A', cat: 'roupas', ok: true }, { id: 'b', t: 'B', cat: 'roupas', ok: false }] };
  const r = D.desmarcarTodos(base);
  assert.equal(r.ciclo, base.ciclo);
  assert.deepEqual(r.items.map(i => [i.id, i.ok]), [['a', false], ['b', false]]);
});
