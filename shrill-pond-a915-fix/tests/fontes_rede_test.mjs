// Download de página de fonte (05/11/2026): uma nova tentativa só para falha transitória.
// Uso: node --test tests/fontes_rede_test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let W;
before(async () => {
  let src = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8').replace(/^const ([A-Z_0-9]+) = /gm, 'var $1 = ');
  src += '\nexport { baixarPagina, restaurarSiglas };\n';
  const f = path.join(os.tmpdir(), `rede-worker-${process.pid}.mjs`);
  fs.writeFileSync(f, src);
  W = await import('file://' + f);
});
const comFetch = async (respostas, fn) => {
  const orig = globalThis.fetch; let n = 0;
  globalThis.fetch = async () => { const r = respostas[n++]; if (r instanceof Error) throw r; return r; };
  try { return await fn(() => n); } finally { globalThis.fetch = orig; }
};
test('503 e depois 200: tenta de novo e devolve a página', async () => {
  await comFetch([new Response('x', { status: 503 }), new Response('<html>ok</html>', { status: 200 })], async (n) => {
    assert.equal(await W.baixarPagina('https://epe.test/n'), '<html>ok</html>'); assert.equal(n(), 2);
  });
});
test('erro de rede e depois 200: tenta de novo', async () => {
  await comFetch([new TypeError('Network connection lost'), new Response('ok', { status: 200 })], async (n) => {
    assert.equal(await W.baixarPagina('https://epe.test/n'), 'ok'); assert.equal(n(), 2);
  });
});
test('404 é definitivo: uma chamada só', async () => {
  await comFetch([new Response('x', { status: 404 }), new Response('nunca', { status: 200 })], async (n) => {
    await assert.rejects(W.baixarPagina('https://epe.test/n'), /HTTP 404/); assert.equal(n(), 1);
  });
});
test('duas falhas transitórias: desiste com o motivo (no máximo 2 chamadas)', async () => {
  await comFetch([new Response('x', { status: 502 }), new Response('x', { status: 502 })], async (n) => {
    await assert.rejects(W.baixarPagina('https://epe.test/n'), /HTTP 502/); assert.equal(n(), 2);
  });
});

test('título: sigla da fonte volta em maiúsculas ("Plsv" → "PLSV", 05/11) sem inventar sigla', () => {
  assert.equal(W.restaurarSiglas('PLSV owned by DOF and TechnipFMC to work longer for Petrobras', 'Plsv de propriedade da DOF e da TechnipFMC vai trabalhar mais tempo para a Petrobras'), 'PLSV de propriedade da DOF e da TechnipFMC vai trabalhar mais tempo para a Petrobras');
  assert.equal(W.restaurarSiglas('Saipem7 gets CADE nod', 'Saipem7 recebe aval do Cade'), 'Saipem7 recebe aval do CADE');
  assert.equal(W.restaurarSiglas('No acronyms here', 'Sem siglas aqui'), 'Sem siglas aqui');
  assert.equal(W.restaurarSiglas('FPSO arrives', 'Os fpsos chegam'), 'Os fpsos chegam', 'plural não é a mesma palavra');
});
