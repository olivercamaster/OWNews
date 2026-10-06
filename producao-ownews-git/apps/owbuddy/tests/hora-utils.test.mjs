import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./_ts-resolver.mjs', import.meta.url);

let normalizeHora;
before(async () => {
  const m = await import('../src/hora-utils.ts');
  normalizeHora = m.normalizeHora;
});

test('normalizeHora vazio retorna vazio', () => {
  assert.equal(normalizeHora(''), '');
  assert.equal(normalizeHora(undefined), '');
});

test('normalizeHora "1945" -> "19:45"', () => {
  assert.equal(normalizeHora('1945'), '19:45');
});

test('normalizeHora "0830" -> "08:30"', () => {
  assert.equal(normalizeHora('0830'), '08:30');
});

test('normalizeHora "945" -> "09:45"', () => {
  assert.equal(normalizeHora('945'), '09:45');
});

test('normalizeHora "0945" -> "09:45"', () => {
  assert.equal(normalizeHora('0945'), '09:45');
});

test('normalizeHora "19:45" passa sem alteração', () => {
  assert.equal(normalizeHora('19:45'), '19:45');
});

test('normalizeHora "8:30" retorna inalterado (sem normalização por <3 dígitos limpos)', () => {
  // "8:30" → clean = "830" (3 chars) → "08:30"
  assert.equal(normalizeHora('8:30'), '08:30');
});
