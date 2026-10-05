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
