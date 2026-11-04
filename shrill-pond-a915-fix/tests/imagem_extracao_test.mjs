// Extração de imagem (04/11/2026): versão grande do srcset, exceções do filtro de nome e o que continua
// barrado. Testa o worker.js REAL. Uso: node --test tests/imagem_extracao_test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let W;
before(async () => {
  let src = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8').replace(/^const ([A-Z_0-9]+) = /gm, 'var $1 = ');
  src += '\nexport { extrairImagemPrincipal, maiorVersaoImagem };\n';
  const f = path.join(os.tmpdir(), `img-worker-${process.pid}.mjs`);
  fs.writeFileSync(f, src);
  W = await import('file://' + f);
});

const PN = 'https://petronoticias.com.br/bndes-aprova-financiamento/';
test('PetroNotícias: miniatura de 300 px no src → maior versão da MESMA foto no srcset', () => {
  const html = '<html><body><img class="alignleft size-medium wp-image-289386" src="https://petronoticias.com.br/wp-content/uploads/2026/11/NavioDeApoio_SiteBram-300x200.jpg" width="300" height="200" srcset="https://petronoticias.com.br/wp-content/uploads/2026/11/NavioDeApoio_SiteBram-300x200.jpg 300w, https://petronoticias.com.br/wp-content/uploads/2026/11/NavioDeApoio_SiteBram-768x512.jpg 768w, https://petronoticias.com.br/wp-content/uploads/2026/11/NavioDeApoio_SiteBram.jpg 813w" /></body></html>';
  assert.equal(W.extrairImagemPrincipal(html, PN), 'https://petronoticias.com.br/wp-content/uploads/2026/11/NavioDeApoio_SiteBram.jpg');
});

test('srcset nunca troca a foto por outra imagem, nem escolhe acima de 1600 px', () => {
  const tag = '<img src="https://x.test/up/foto-a-300x200.jpg" srcset="https://x.test/up/foto-a-300x200.jpg 300w, https://x.test/up/outra-foto.jpg 1200w, https://x.test/up/foto-a-1024x683.jpg 1024w, https://x.test/up/foto-a.jpg 2048w">';
  assert.equal(W.maiorVersaoImagem(tag, 'https://x.test/up/foto-a-300x200.jpg', 'https://x.test/n/'), 'https://x.test/up/foto-a-1024x683.jpg');
  assert.equal(W.maiorVersaoImagem('<img src="https://x.test/a.jpg">', 'https://x.test/a.jpg', 'https://x.test/'), 'https://x.test/a.jpg', 'sem srcset fica a original');
});

test('filtro de nome: "sem_logo" e imagem na pasta da própria notícia (gov.br) passam; logo e banner solto não', () => {
  const og = (u) => `<html><head><meta property="og:image" content="${u}"></head><body></body></html>`;
  assert.equal(W.extrairImagemPrincipal(og('https://www.presalpetroleo.gov.br/wp-content/uploads/2026/10/leilao_gas_680x380_sem_logo.png'), 'https://www.presalpetroleo.gov.br/noticias/ppsa-publica-edital/'), 'https://www.presalpetroleo.gov.br/wp-content/uploads/2026/10/leilao_gas_680x380_sem_logo.png');
  const mme = 'https://www.gov.br/mme/pt-br/assuntos/noticias/outubro-26/mme-destaca-avancos-na-eolica';
  assert.equal(W.extrairImagemPrincipal(og(mme + '/banner-portal-1.png'), mme), mme + '/banner-portal-1.png');
  assert.equal(W.extrairImagemPrincipal(og('https://www.gov.br/anp/logo.png'), 'https://www.gov.br/anp/pt-br/noticia-x'), null, 'logo do órgão');
  assert.equal(W.extrairImagemPrincipal(og('https://site.test/wp-content/uploads/banner-assine.jpg'), 'https://site.test/materia-qualquer/'), null, 'banner fora da pasta da notícia');
  assert.equal(W.extrairImagemPrincipal(og('http://www.epe.gov.br/PublishingImages/Logos/epe_logo_facebook.jpg'), 'https://www.epe.gov.br/pt/imprensa/noticias/x'), null, 'logo da EPE');
});

test('og:image válida da fonte continua sendo a escolhida', () => {
  const html = '<html><head><meta property="og:image" content="https://uploads.eixos.com.br/2026/10/foto.webp"></head><body><article><img src="https://uploads.eixos.com.br/2026/10/outra.webp"></article></body></html>';
  assert.equal(W.extrairImagemPrincipal(html, 'https://eixos.com.br/x/'), 'https://uploads.eixos.com.br/2026/10/foto.webp');
});
