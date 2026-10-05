/**
 * Verifica que cada rota referenciada nos CTAs da Home existe como arquivo no disco.
 * Rotas de tab: app/(tabs)/<name>.tsx
 * Rotas de stack: app/<name>.tsx
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dir, '../app');

function tabRoute(name) {
  return resolve(appDir, `(tabs)/${name}.tsx`);
}
function stackRoute(name) {
  return resolve(appDir, `${name}.tsx`);
}

// CTA cards in Home
test('CTA: Minha Escala → /escala-config (stack)', () => {
  assert.ok(existsSync(stackRoute('escala-config')), 'escala-config.tsx não encontrado');
});

test('CTA: Lista Inteligente → /mala (tab)', () => {
  assert.ok(existsSync(tabRoute('mala')), 'mala.tsx não encontrado');
});

test('CTA: Minha Viagem → /viagem (tab)', () => {
  assert.ok(existsSync(tabRoute('viagem')), 'viagem.tsx não encontrado');
});

test('CTA: Certificados → /certs (tab)', () => {
  assert.ok(existsSync(tabRoute('certs')), 'certs.tsx não encontrado');
});

// Header button
test('Header: Buddy config → /buddy-config (stack modal)', () => {
  assert.ok(existsSync(stackRoute('buddy-config')), 'buddy-config.tsx não encontrado');
});

// Tab bar screens
test('Tab: Hoje (index) exists', () => {
  assert.ok(existsSync(tabRoute('index')), 'index.tsx não encontrado');
});

test('Tab: Lista (mala) exists', () => {
  assert.ok(existsSync(tabRoute('mala')), 'mala.tsx não encontrado');
});

test('Tab: Viagem exists', () => {
  assert.ok(existsSync(tabRoute('viagem')), 'viagem.tsx não encontrado');
});

test('Tab: Docs (certs) exists', () => {
  assert.ok(existsSync(tabRoute('certs')), 'certs.tsx não encontrado');
});

// Root layout
test('Root _layout.tsx exists', () => {
  assert.ok(existsSync(resolve(appDir, '_layout.tsx')), '_layout.tsx não encontrado');
});

test('Tabs _layout.tsx exists', () => {
  assert.ok(existsSync(resolve(appDir, '(tabs)/_layout.tsx')), '(tabs)/_layout.tsx não encontrado');
});
