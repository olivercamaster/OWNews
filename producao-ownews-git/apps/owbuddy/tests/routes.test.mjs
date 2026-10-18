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

// Missão 006 native screens
test('Screen: Notícias → /noticias (stack)', () => {
  assert.ok(existsSync(stackRoute('noticias')), 'noticias.tsx não encontrado');
});
test('Screen: Vagas → /vagas (stack)', () => {
  assert.ok(existsSync(stackRoute('vagas')), 'vagas.tsx não encontrado');
});
test('Screen: Aeroportos → /aeroportos (stack)', () => {
  assert.ok(existsSync(stackRoute('aeroportos')), 'aeroportos.tsx não encontrado');
});

// Missão 007 new screen
test('Screen: Ferramentas → /ferramentas (stack)', () => {
  assert.ok(existsSync(stackRoute('ferramentas')), 'ferramentas.tsx não encontrado');
});

// Missão 007 Adendo — Minha Escala
test('Screen: Escala hub → /escala (stack)', () => {
  assert.ok(existsSync(stackRoute('escala')), 'escala.tsx não encontrado');
});
test('Screen: Exceção form → /escala-excecao-form (stack modal)', () => {
  assert.ok(existsSync(stackRoute('escala-excecao-form')), 'escala-excecao-form.tsx não encontrado');
});
test('Telas legadas sem entrada foram removidas (substituídas por escala-evento-form)', () => {
  for (const r of ['meteorologia', 'escala-data-form', 'escala-viagem-form']) {
    assert.ok(!existsSync(stackRoute(r)), `${r}.tsx deveria ter sido removido`);
  }
});
test('Screen: Cruzar escalas → /escala-cruzar (stack)', () => {
  assert.ok(existsSync(stackRoute('escala-cruzar')), 'escala-cruzar.tsx não encontrado');
});
test('Screen: Escala secundária form → /escala-secundaria-form (stack modal)', () => {
  assert.ok(existsSync(stackRoute('escala-secundaria-form')), 'escala-secundaria-form.tsx não encontrado');
});

// Root layout
test('Root _layout.tsx exists', () => {
  assert.ok(existsSync(resolve(appDir, '_layout.tsx')), '_layout.tsx não encontrado');
});

test('Tabs _layout.tsx exists', () => {
  assert.ok(existsSync(resolve(appDir, '(tabs)/_layout.tsx')), '(tabs)/_layout.tsx não encontrado');
});

// ─── Varredura: toda rota usada no código existe como tela ──────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs';

function arquivos(dir) {
  return readdirSync(dir).flatMap(n => {
    const p = resolve(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(tsx?|mjs)$/.test(n) ? [p] : [];
  });
}

/** "/noticia/123" → existe app/noticia/[id].tsx? "/mala" → (tabs)/mala.tsx? */
function rotaExiste(rota) {
  const limpa = rota.split('?')[0].replace(/\/$/, '') || '/';
  if (limpa === '/') return existsSync(tabRoute('index'));
  const partes = limpa.slice(1).split('/');
  const candidatos = [resolve(appDir, ...partes) + '.tsx', resolve(appDir, '(tabs)', ...partes) + '.tsx'];
  if (partes.length === 2) candidatos.push(...readdirSync(resolve(appDir)).filter(n => n === partes[0]).flatMap(d =>
    readdirSync(resolve(appDir, d)).filter(f => /^\[.+\]\.tsx$/.test(f)).map(f => resolve(appDir, d, f))));
  return candidatos.some(existsSync);
}

test('todo router.push/navigate/replace e pathname no código aponta para uma tela existente', () => {
  const fontes = [...arquivos(appDir), ...arquivos(resolve(__dir, '../src'))];
  const rotas = new Set();
  for (const f of fontes) {
    const txt = readFileSync(f, 'utf8');
    for (const m of txt.matchAll(/router\.(?:push|navigate|replace)\(\s*(['`])([^'`$]+)\1/g)) rotas.add(m[2]);
    for (const m of txt.matchAll(/pathname:\s*'([^']+)'/g)) rotas.add(m[1]);
    for (const m of txt.matchAll(/router\.(?:push|navigate|replace)\(`([^`]*?)\$\{/g)) rotas.add(m[1] + 'x');
  }
  assert.ok(rotas.size >= 15, `poucas rotas encontradas: ${[...rotas]}`);
  for (const r of rotas) assert.ok(rotaExiste(r), `rota sem tela: ${r}`);
});

test('rotas abertas por notificação (lembretes) existem', () => {
  const txt = readFileSync(resolve(__dir, '../src/notifications.ts'), 'utf8');
  const lista = /ROTAS_PERMITIDAS = \[([^\]]+)\]/.exec(txt)[1].match(/'([^']+)'/g).map(x => x.slice(1, -1));
  const dominio = readFileSync(resolve(__dir, '../../../packages/ow-domain/src/lembretes.ts'), 'utf8');
  for (const m of dominio.matchAll(/rota: '([^']+)'/g)) assert.ok(lista.includes(m[1]), `rota ${m[1]} não permitida`);
  for (const r of lista) assert.ok(rotaExiste(r), `rota de lembrete sem tela: ${r}`);
});

test('toda Stack.Screen do layout raiz tem arquivo', () => {
  const txt = readFileSync(resolve(appDir, '_layout.tsx'), 'utf8');
  for (const m of txt.matchAll(/name="([^"]+)"/g)) {
    if (m[1] === '(tabs)') continue;
    assert.ok(existsSync(resolve(appDir, m[1] + '.tsx')), `Stack.Screen sem arquivo: ${m[1]}`);
  }
});
