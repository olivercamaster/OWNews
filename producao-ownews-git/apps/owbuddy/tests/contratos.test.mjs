/**
 * Contratos OWNews → OWBuddy (offline, com fixtures) + rede segura.
 *
 * O app NÃO tem cérebro editorial: só exibe matéria com os quatro blocos
 * canônicos (Buddy resume, corpo OWNews, Impacto, fonte). Estes testes garantem
 * que item fora do padrão é descartado — nunca completado pelo app.
 * Contrato AO VIVO: `node tests/contrato-live.mjs` (precisa de internet).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createServer } from 'node:http';

register('./_ts-resolver.mjs', import.meta.url);
const C = await import('../src/contratos.ts');
const N = await import('../src/net.ts');

const OK = {
  id: 'a1', title: 'Petrobras contrata FPSO para Búzios',
  summary: null, corpo: 'Primeiro parágrafo.\n\nSegundo parágrafo.',
  buddy_summary: 'Resumo do Buddy.', why_it_matters: 'Impacto para quem embarca.',
  image_url: 'https://img.example/x.jpg', image_credit: 'Petrobras',
  original_url: 'https://petrobras.com.br/x', published_at: '2026-10-17T12:00:00+00:00',
  url: 'https://ownews.com.br/noticia?id=a1',
  explica: [{ slug: 'fpso', titulo: 'O que é FPSO?', url: 'https://ownews.com.br/explica/fpso' }, { slug: 'x', titulo: 'y', url: 'javascript:alert(1)' }],
  thin: false, indexacao: 'INDEXABLE', editorial_score: 90,
};

test('matéria completa passa e mantém só os campos canônicos', () => {
  const a = C.normalizarArtigo(OK);
  assert.ok(a);
  assert.deepEqual(Object.keys(a).sort(), ['buddy_summary', 'corpo', 'editorial_score', 'explica', 'id', 'image_credit', 'image_url', 'original_url', 'published_at', 'title', 'url', 'why_it_matters'].sort());
  assert.equal(a.explica.length, 1, 'link javascript: do Explica descartado');
  assert.ok(!('summary' in a), 'lead da fonte nunca entra no app');
});

test('sem Buddy, sem corpo, sem Impacto ou URL fora do OWNews → descartada (o app não completa)', () => {
  for (const campo of ['buddy_summary', 'corpo', 'why_it_matters', 'id', 'title']) {
    assert.equal(C.normalizarArtigo({ ...OK, [campo]: null }), null, campo);
    assert.equal(C.normalizarArtigo({ ...OK, [campo]: '   ' }), null, campo + ' vazio');
  }
  assert.equal(C.normalizarArtigo({ ...OK, url: 'https://outro-site.com/noticia?id=a1' }), null);
  assert.equal(C.normalizarArtigo({ ...OK, url: 'javascript:alert(1)' }), null);
  // formato antigo (schema 2 sem corpo, com summary da fonte) não aparece
  const antigo = { ...OK }; delete antigo.corpo; antigo.summary = 'lead da fonte';
  assert.equal(C.normalizarArtigo(antigo), null);
});

test('URLs não-http viram null; imagem opcional', () => {
  const a = C.normalizarArtigo({ ...OK, image_url: 'file:///etc/passwd', original_url: 'intent://x' });
  assert.equal(a.image_url, null);
  assert.equal(a.original_url, '');
  assert.equal(C.normalizarArtigo({ ...OK, image_url: null }).image_url, null);
});

test('feed: lista inválida → []; itens ruins somem, bons ficam na ordem', () => {
  assert.deepEqual(C.normalizarFeed(null), []);
  assert.deepEqual(C.normalizarFeed({ articles: 'x' }), []);
  const f = C.normalizarFeed({ articles: [OK, { ...OK, id: 'b', corpo: null }, { ...OK, id: 'c' }, 7, null] });
  assert.deepEqual(f.map(a => a.id), ['a1', 'c']);
});

test('feed: mesma matéria repetida aparece uma vez; editorial_score passa (ou null)', () => {
  const f = C.normalizarFeed({ articles: [{ ...OK, editorial_score: 90 }, { ...OK }, { ...OK, id: 'c', editorial_score: 'x' }] });
  assert.deepEqual(f.map(a => a.id), ['a1', 'c']);
  assert.equal(f[0].editorial_score, 90);
  assert.equal(f[1].editorial_score, null);
  assert.equal(C.normalizarFeed({ articles: [{ ...OK, editorial_score: '85' }] })[0].editorial_score, 85);
});

test('parágrafos do corpo: separados por linha em branco, espaços normalizados', () => {
  assert.deepEqual(C.paragrafos('A  b.\n\n\n C.\n \nD'), ['A b.', 'C.', 'D']);
});

test('urlExternaSegura: só http(s)', () => {
  assert.equal(N.urlExternaSegura('https://ownews.com.br/x'), 'https://ownews.com.br/x');
  assert.equal(N.urlExternaSegura('http://a.b'), 'http://a.b');
  for (const u of ['javascript:alert(1)', 'intent://x#Intent;end', 'file:///x', 'owbuddy://escala', '', null, 3, 'https://a b']) {
    assert.equal(N.urlExternaSegura(u), null, String(u));
  }
});

test('buscarJson: ok, HTTP 500, JSON inválido, timeout e offline — nunca lança', async () => {
  const srv = createServer((req, res) => {
    if (req.url === '/ok') { res.setHeader('content-type', 'application/json'); res.end('{"a":1}'); }
    else if (req.url === '/500') { res.statusCode = 500; res.end('x'); }
    else if (req.url === '/lixo') { res.end('<html>'); }
    else if (req.url === '/lento') { setTimeout(() => res.end('{}'), 2000); }
  });
  await new Promise(r => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    assert.deepEqual(await N.buscarJson(base + '/ok'), { ok: true, data: { a: 1 } });
    assert.deepEqual(await N.buscarJson(base + '/500'), { ok: false, motivo: 'http', status: 500 });
    assert.deepEqual(await N.buscarJson(base + '/lixo'), { ok: false, motivo: 'formato' });
    assert.deepEqual(await N.buscarJson(base + '/lento', 150), { ok: false, motivo: 'timeout' });
    assert.deepEqual(await N.buscarJson('http://127.0.0.1:1/nada', 2000), { ok: false, motivo: 'offline' });
  } finally {
    srv.closeAllConnections?.();
    srv.close();
  }
});
