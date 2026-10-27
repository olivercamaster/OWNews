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

console.log('\nHome — hierarquia editorial (27/10/2026)');
const MAIN = FRONT.slice(FRONT.indexOf('<main class="container" id="conteudo">'), FRONT.indexOf('</main>', FRONT.indexOf('<main class="container" id="conteudo">')));
test('segunda metade: M&E → Operações → Últimas → Explica → Central → OffshoreWorks → Eventos → OWBuddy', () => {
  const pos = ['id="destaque"', 'id="vagas-agora"', 'id="mercadoOffshore"', 'id="mercado"', 'id="operacoes"', 'id="ultimas"', 'id="baiaSocial"', 'id="carreiras"', 'id="loja"', 'id="homeAgenda"', 'id="ecossistema"'].map((m) => [m, MAIN.indexOf(m)]);
  for (const [m, i] of pos) expect(i > 0, m + ' ausente');
  for (let i = 1; i < pos.length; i++) expect(pos[i][1] > pos[i - 1][1], pos[i][0] + ' fora de ordem');
  // Explica é injetado no SSR logo antes da Central
  expect(FRONT.includes("html.replace('<section class=\"ed-section\" id=\"carreiras\">', blocoExplicaHome() + '<section class=\"ed-section\" id=\"carreiras\">')"), 'Explica antes da Central');
});
test('seleção das Últimas continua sequencial (Aconteceu → Últimas → M&E → Operações), sem segunda regra', () => {
  const i = FRONT.indexOf('const ultimasHoje = proximosUltimas(poolElegivelHoje, 6);');
  expect(i > 0 && i < FRONT.indexOf("selecionarEditorial(poolElegivelHoje, 'mercado', 4)") && FRONT.indexOf("selecionarEditorial(poolElegivelHoje, 'mercado', 4)") < FRONT.indexOf("selecionarEditorial(poolElegivelHoje, 'operacoes', 5)"));
  expect((FRONT.match(/function proximosUltimas\(/g) || []).length === 1, 'uma seleção só');
});
test('newsletter fora da Home (envio nunca ativado), /newsletter e API preservados', () => {
  expect(!MAIN.includes('nlHomeForm') && !MAIN.includes('class="newsletter"') && !FRONT.includes('.nl-home-form{') && !FRONT.includes("getElementById('newsletterBtn')"));
  expect(FRONT.includes('url.pathname === "/newsletter"') && FRONT.includes('url.pathname === "/api/newsletter/subscribe"'), 'rotas');
});
test('Central Offshore no celular: 2 colunas de links, toque ≥ 44 px, nada escondido', () => {
  expect(FRONT.includes('@media(min-width:360px) and (max-width:699px){#carreiras .cof-grid{gap:10px}') && FRONT.includes('#carreiras .cof-links a{align-items:center;min-height:44px;'));
  const m = FRONT.match(/@media\(min-width:360px\) and \(max-width:699px\)\{#carreiras[^\n]*/)[0];
  expect(!/display:none|font-size/.test(m), 'não esconde nem reduz fonte');
});
test('Mercado & Energia e Operações (abaixo da dobra): capas só baixam perto da tela', () => {
  const f = FRONT.slice(FRONT.indexOf('function renderMercado(lista, fallbackEditorial){'), FRONT.indexOf('Radar Offshore + Giro 24h'));
  expect((f.match(/capaAtributos\(img, true\)/g) || []).length === 3 && (f.match(/observarCapas\(el\);/g) || []).length === 3 && !f.includes('capaAtributos(img)}'));
});

console.log('\n' + pass + ' passaram, ' + fail + ' falharam');
process.exit(fail ? 1 : 0);
