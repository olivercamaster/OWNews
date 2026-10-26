#!/usr/bin/env node
/* Auditoria final da Home (26/10/2026) — trava as correções de qualidade:
 * foto com apóstrofo, miniaturas de Últimas sob demanda, rótulo da manchete
 * legível, preço do Mercado Offshore inteiro, cotação implausível fora e aba
 * Home funcional. Sem rede. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONT = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'worker.js'), 'utf8');
let pass = 0, fail = 0;
const test = (nome, fn) => { try { fn(); pass++; console.log('  ✓ ' + nome); } catch (e) { fail++; console.log('  ✗ ' + nome + '\n      ' + e.message); } };
const expect = (c, m) => { if (!c) throw new Error(m || 'falhou'); };
const RE_CSS_URL = /\.replace\(\/\['"\(\) \]\/g, \(?c\)? => '%' \+ c\.charCodeAt\(0\)\.toString\(16\)\.toUpperCase\(\)\)/g;

console.log('\nHome — qualidade (auditoria final)');
test("foto com ' \" ( ) ou espaço não quebra o background (cliente e servidor)", () => {
  expect((FRONT.match(RE_CSS_URL) || []).length === 2, 'codificação ausente em imagemDe/imagemComFallbackServidor');
  const cod = (u) => u.replace(/['"() ]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  const css = "background-image:url('" + cod("https://x.biz/media/Reach Subsea and Eidesvik's (1).jpg") + "')";
  expect(css === "background-image:url('https://x.biz/media/Reach%20Subsea%20and%20Eidesvik%27s%20%281%29.jpg')", css);
});
test('Últimas: miniaturas das linhas só baixam perto da tela (SSR e cliente); renderUltimas intocado', () => {
  expect(FRONT.includes("homeSsrCapa(n, 'row-thumb', true)"), 'SSR');
  expect(FRONT.includes("homeSsrCapa(h, 'cover')") && FRONT.includes("homeSsrCapa(n, 'thumb')") && FRONT.includes("homeSsrCapa(d, 'thumb')"), 'manchete/secundárias/destaque não são adiados');
  expect(/<div class="row-thumb" \\\$\{capaAtributos\(img, true\)\}>/.test(FRONT), 'cliente');
  const ult = FRONT.slice(FRONT.indexOf('function renderUltimas(lista){'), FRONT.indexOf('function renderMercado(lista'));
  expect(!ult.includes('observarCapas') && !ult.includes('capaAtributos(img, true)'), 'renderUltimas é congelado (Home 3.0)');
  expect((FRONT.match(/renderUltimas\((?:noticias\.slice\(0, 5\)|ultimas)\);\n\s*observarCapas\(document\.getElementById\('ultimasBody'\)\);/g) || []).length === 2 && FRONT.includes("renderAirports(SEED_AEROPORTOS);\nobservarCapas(document.getElementById('ultimasBody'));"), 'observador');
  expect(FRONT.includes("rootMargin: '600px 0px'") && FRONT.includes("if (!('IntersectionObserver' in window)) { raiz.querySelectorAll('[data-bg]').forEach(aplicar); return; }"), 'sem IO aplica na hora');
});
test('rótulo da manchete legível sobre foto clara', () => {
  expect(/\.lead \.eyebrow\{text-shadow:[^}]+\}/.test(FRONT));
});
test('Mercado Offshore: "R$" não se separa do valor', () => {
  expect(FRONT.includes('.mo-preco,.mo-preco-row>span{white-space:nowrap}') && FRONT.includes('.mo-preco-row{display:flex;flex-wrap:wrap;'));
});
test('Mercado Agora: câmbio/commodity com variação ≥ 15% não aparece', () => {
  const fn = FRONT.slice(FRONT.indexOf('function renderMercadoAgora(macro){'), FRONT.indexOf('const BOLSA_PAIS'));
  expect(fn.includes("if (typeof m.variacao_percent === 'number' && Math.abs(m.variacao_percent) >= 15) return '';"));
});
test('aba Home da barra inferior leva ao topo (âncora existe)', () => {
  expect(FRONT.includes('<a href="#top" class="active">') && !FRONT.includes('href="#inicio"'));
});

console.log('\n' + pass + ' passaram, ' + fail + ' falharam');
process.exit(fail ? 1 : 0);
