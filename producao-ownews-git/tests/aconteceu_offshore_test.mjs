#!/usr/bin/env node
/* ACONTECEU NO OFFSHORE = 4 notícias (1 manchete + 3 secundárias), sempre que
 * existirem 4 válidas — e nenhum serviço da Home (placares, módulo AO VIVO/
 * eleição, Vagas, Aeroportos…) consome essas vagas. Proteção contra a
 * regressão recorrente "mexemos em outra parte da Home e sumiu uma notícia".
 *
 * Usa as funções REAIS do worker.js (seleção + SSR do bloco) sobre o markup
 * REAL do bloco, e o módulo REAL de placares (ao-vivo/futebol.js) com
 * snapshot no formato neutro (independe do provedor). Sem rede. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONT = fs.readFileSync(path.join(DIR, '..', 'worker.js'), 'utf8');
const trecho = (ini, fim) => {
  const a = FRONT.indexOf(ini); if (a < 0) throw new Error('marcador ausente: ' + ini);
  const b = FRONT.indexOf(fim, a); if (b < 0) throw new Error('marcador ausente: ' + fim);
  return FRONT.slice(a, b);
};
const src = [
  trecho('/* ACONTECEU NO OFFSHORE — quantidade fixa', '// Home 3.0: resumo institucional'),
  trecho('const FONTES_INTERNACIONAIS_SERVIDOR', '/* ==== CAMADA EDITORIAL: INICIO ===='),
  trecho('/* ==== CAMADA EDITORIAL: INICIO ====', '/* ==== CAMADA EDITORIAL: FIM ==== */'),
  trecho('/* ==== QUALIDADE EDITORIAL 2.1: INICIO ====', '/* ==== QUALIDADE EDITORIAL 2.1: FIM ==== */'),
  trecho('const PALAVRAS_BREAKING_SERVIDOR', '/* Bloco estático "OWNews Explica"'),
  trecho('function injetarNoticiasHome(html, noticias, agora)', 'async function responderHomeSelecao'),
  trecho('function tempoRelativoOuData(data, agora)', 'const PALAVRAS_IRRELEVANTES_RELACIONADAS'),
].join('\n');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
const H = new Function('escaparHTML', 'decodificarEntidadesHTMLServidor', 'imagemComFallbackServidor', 'deckNoticiaOWNews',
  src + '\nreturn { injetarNoticiasHome, selecionarHomeServidor, ACONTECEU_NOTICIAS_VISIVEIS, ACONTECEU_SECUNDARIAS };'
)(esc, (s) => s, (n) => ({ src: n.image_url || '/capa-editorial.jpg' }), () => '');

// Markup real do bloco (cabeçalho + #destaque), cercado de serviços da Home.
const ini = FRONT.indexOf('<div class="aconteceu-head"');
const BLOCO = FRONT.slice(ini, FRONT.indexOf('</section>', ini) + '</section>'.length);
const AEROPORTOS = '<section class="ops" id="aeroportos" aria-label="Aeroportos"><div class="ops-card">SBME</div></section>';
const VAGAS = '<section class="ed-section vagas-home-section" id="vagas-agora"><article class="vaga-card-home">Vaga 1</article><article class="vaga-card-home">Vaga 2</article><article class="vaga-card-home">Vaga 3</article></section>';
const ULTIMAS = '<div class="latest-body" id="ultimasBody"></div>';
const pagina = (extra) => '<main class="container" id="conteudo">' + (extra || '') + '<div class="ticker-wrap">Giro</div>' + AEROPORTOS + BLOCO + VAGAS + ULTIMAS + '</main>';

// Notícias elegíveis (texto próprio OWNews, pautas e fotos distintas).
const AGORA = Date.parse('2026-10-26T15:00:00Z');
const CORPO = 'Primeiro parágrafo da matéria OWNews com fatos e contexto suficientes para leitura completa, escrito a partir do material da fonte e revisado pelo gate editorial do portal.\n\nSegundo parágrafo com o contexto do setor offshore, detalhes do contrato, prazos, operadora envolvida e o que muda para quem trabalha embarcado nas unidades da bacia.';
const TEMAS = ['Equinor anuncia descoberta no mar do Norte', 'Sindicato aprova acordo coletivo na Bahia', 'ANP divulga produção recorde de agosto',
  'Navio de apoio chega ao porto do Açu', 'Seadrill renova sonda na Malásia', 'Leilão de áreas atrai sete operadoras', 'Helicóptero ganha nova base em Jacarepaguá',
  'Shell investe em captura de carbono', 'Estaleiro gaúcho retoma obras de casco', 'Preço do Brent recua com estoques altos', 'Prio conclui aquisição de campo maduro'];
let seq = 0;
const art = (horas, score) => { seq++; return {
  id: 'n' + seq, title: TEMAS[seq % TEMAS.length] + ' (' + seq + ')', summary: 'Resumo ' + seq, content: CORPO, buddy_source: 'ownews',
  image_url: 'https://img.example/' + seq + '.jpg', image_credit: 'Fonte' + seq, original_url: 'https://fonte.example/materia-' + seq,
  published_at: new Date(AGORA - horas * 3600000).toISOString(), editorial_score: score,
}; };
const ordenar = (l) => l.slice().sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
const DEZ = ordenar([art(1, 70), art(2, 85), art(3, 60), art(4, 75), art(6, 66), art(8, 58), art(11, 72), art(15, 64), art(20, 80), art(30, 90)]);

// Conta o que o leitor vê no bloco: manchete + secundárias, com os ids.
function bloco(html) {
  const a = html.indexOf('id="destaque"'), b = html.indexOf('</section>', a);
  const sec = html.slice(html.lastIndexOf('<section', a), b);
  const ids = [...sec.matchAll(/href="\/noticia\?id=([^"]+)"/g)].map((m) => decodeURIComponent(m[1]));
  return {
    principal: (sec.match(/class="lead-ssr-link"/g) || []).length,
    secundarias: (sec.match(/<article class="highlight">/g) || []).length,
    ids, oculto: /<section class="masthead[^"]*" hidden/.test(sec), classe: (/<section class="(masthead[^"]*)"/.exec(sec) || [])[1],
  };
}
const render = (noticias, extra) => H.injetarNoticiasHome(pagina(extra), noticias, new Date(AGORA));

// ── Placares reais (ao-vivo/futebol.js) com snapshot neutro no cache ──
const store = new Map();
globalThis.caches = { default: {
  match: async (req) => { const v = store.get(req.url); return v ? new Response(v) : undefined; },
  put: async (req, resp) => { store.set(req.url, await resp.text()); },
} };
const logOriginal = console.log;
console.log = (...a) => { if (!String(a[0]).startsWith('{"ao_vivo"')) logOriginal(...a); };
const F = await import('../ao-vivo/futebol.js');
const realNow = Date.now;
Date.now = () => AGORA;
const timeF = (id, n, s, sel) => ({ id, n, s, e: null, sel: !!sel });
const jogoF = (id, cod, st, min, sel) => ({ id, cod, comp: F.FUTEBOL_CONFIG.competicoes[cod].nome, fase: 'REGULAR_SEASON', st, min, acr: null,
  ini: new Date(AGORA - 50 * 60000).toISOString(), dur: 'REGULAR', c: timeF(id * 10, sel ? 'Brasil' : 'Mandante ' + id, 'MAN', sel), f: timeF(id * 10 + 1, 'Visitante ' + id, 'VIS'), gc: 1, gf: 0, pc: null, pf: null });
function placares(jogos) {
  store.clear();
  const dia = F.diaBRT(AGORA);
  store.set('https://ownews-ao-vivo.interno/' + encodeURIComponent('futebol-dia-' + dia),
    JSON.stringify({ dados: { dia, jogos }, consultadoEm: AGORA, atualizadoEm: AGORA, falhaEm: null, falhas: 0 }));
}
const JOGOS = [jogoF(1, 'BSA', 'vivo', 63), jogoF(2, 'CL', 'vivo', 20), jogoF(3, 'PL', 'intervalo', null), jogoF(4, 'PD', 'vivo', 70)];
// Módulo genérico de serviço ao vivo (o formato que a cobertura de eleição usou).
const MODULO_AO_VIVO = '<section class="ao-vivo-faixa" id="eleicoes-home"><article class="highlight-like">Apuração 98%</article></section>';

let pass = 0, fail = 0;
async function test(nome, fn) {
  try { await fn(); pass++; logOriginal('  ✓ ' + nome); } catch (e) { fail++; logOriginal('  ✗ ' + nome + '\n      ' + e.message); }
}
const expect = (c, m) => { if (!c) throw new Error(m || 'falhou'); };
function quatro(r, ctx) {
  expect(r.principal === 1 && r.secundarias === 3, ctx + ': ' + r.principal + ' principal + ' + r.secundarias + ' secundárias');
  expect(r.ids.length === 4 && new Set(r.ids).size === 4, ctx + ': ids ' + r.ids.join(','));
  expect(!r.oculto && r.classe === 'masthead three-laterais', ctx + ': classe ' + r.classe);
}

logOriginal('\nAconteceu no Offshore — 4 notícias, serviços fora da contagem');
await test('regra central: 4 visíveis = 1 principal + 3 secundárias', () => {
  expect(H.ACONTECEU_NOTICIAS_VISIVEIS === 4 && H.ACONTECEU_SECUNDARIAS === 3);
});
await test('10 notícias elegíveis → exatamente 1 + 3 = 4', () => quatro(bloco(render(DEZ)), 'base'));
await test('com placares na Home → continua 4 (placar fora do bloco)', async () => {
  F.futebolConfigurar({ FOOTBALL_DATA_TOKEN: 'tok_teste' }); placares(JOGOS);
  const html = await F.futebolModuloHome(render(DEZ));
  expect(html.includes('id="futebolHome"') || /fx-/.test(html), 'módulo de placares não entrou');
  quatro(bloco(html), 'futebol');
  const sec = html.slice(html.indexOf('id="destaque"'), html.indexOf('</section>', html.indexOf('id="destaque"')));
  expect(!/fx-/.test(sec), 'placar dentro do bloco editorial');
});
await test('placar com Seleção ao vivo (sobe para o topo) → continua 4', async () => {
  F.futebolConfigurar({ FOOTBALL_DATA_TOKEN: 'tok_teste' }); placares([jogoF(9, 'QCBL', 'vivo', 30, true), ...JOGOS]);
  quatro(bloco(await F.futebolModuloHome(render(DEZ))), 'futebol topo');
});
await test('com módulo AO VIVO/eleitoral → continua 4', () => quatro(bloco(render(DEZ, MODULO_AO_VIVO)), 'eleição'));
await test('com Vagas e Aeroportos na página → continua 4', () => {
  const r = bloco(render(DEZ));
  quatro(r, 'vagas');
  expect(render(DEZ).includes('vaga-card-home') && render(DEZ).includes('id="aeroportos"'));
});
await test('futebol desativado (sem credencial) → continua 4 e Home intacta', async () => {
  F.futebolConfigurar({}); placares(JOGOS);
  const base = render(DEZ);
  const html = await F.futebolModuloHome(base);
  expect(html === base, 'Home mudou sem placares');
  quatro(bloco(html), 'sem futebol');
});
await test('nova notícia entra → continua 4; as anteriores descem e a que sai do bloco vai para Últimas', () => {
  const antes = bloco(render(DEZ)).ids;
  const nova = art(0.1, 95);
  const html = render(ordenar([nova, ...DEZ]));
  const depois = bloco(html);
  quatro(depois, 'nova');
  expect(depois.ids.includes(nova.id), 'nova não entrou');
  for (const id of antes.filter((x) => !depois.ids.includes(x))) {
    expect(html.slice(html.indexOf('id="ultimasBody"')).includes('id=' + id), id + ' sumiu da Home');
  }
});
await test('sem duplicação: principal nunca repete nas secundárias (id e pauta)', () => {
  const dup = Object.assign(art(0.5, 99), { title: DEZ[0].title + ' ' });
  const r = bloco(render(ordenar([dup, ...DEZ])));
  quatro(r, 'dup');
  const s = H.selecionarHomeServidor(ordenar([dup, ...DEZ]), AGORA);
  const titulos = [s.hero, ...s.laterais].map((n) => n.title.trim());
  expect(new Set(titulos).size === 4, 'mesma pauta duas vezes: ' + titulos.join(' / '));
});
await test('foto repetida não derruba notícia: entra com a capa editorial', () => {
  const l = DEZ.slice(0, 4).map((n) => Object.assign({}, n, { image_url: 'https://img.example/igual.jpg' }));
  const s = H.selecionarHomeServidor(l, AGORA);
  expect(s.laterais.length === 3, 'laterais=' + s.laterais.length);
  const fotos = [s.hero, ...s.laterais].map((n) => n.image_url).filter(Boolean);
  expect(new Set(fotos).size === fotos.length, 'foto repetida exibida');
  quatro(bloco(render(l)), 'foto');
});
await test('menos de 4 válidas → mostra as que existem, sem inventar nem repetir', () => {
  const tres = DEZ.slice(0, 3);
  const r = bloco(render(tres));
  expect(r.principal === 1 && r.secundarias === 2 && new Set(r.ids).size === 3, JSON.stringify(r));
});
await test('notícia válida de 24–48h completa o bloco (janela segura das Últimas)', () => {
  const l = ordenar([art(2, 70), art(5, 60), art(30, 80), art(40, 60), art(60, 99)]);
  const s = H.selecionarHomeServidor(l, AGORA);
  expect(s.laterais.length === 3 && !s.laterais.some((n) => Date.parse(n.published_at) < AGORA - 48 * 3600000), 'fora da janela');
  quatro(bloco(render(l)), '48h');
});

logOriginal('\nGuardas de código');
await test('seleção editorial não recebe nada de serviço (só a lista de notícias)', () => {
  expect(/function selecionarHomeServidor\(noticias, agoraMs\)/.test(FRONT));
  const sel = trecho('function selecionarHomeServidor(noticias, agoraMs)', '// Diagnóstico read-only');
  expect(!/futebol|VAGAS_|AEROPORTOS|eleic|AGENDA_|ESCALA|UNIDADES_RADAR/.test(sel), 'serviço dentro da seleção editorial');
  const fut = fs.readFileSync(path.join(DIR, '..', 'ao-vivo', 'futebol.js'), 'utf8');
  expect(!/highlightsList|heroCard|id="destaque"|masthead/.test(fut), 'placares tocam no bloco editorial');
});
await test('número único: sem "3" solto nas vagas de secundárias (servidor e cliente)', () => {
  const sel = trecho('function selecionarHomeServidor(noticias, agoraMs)', '// Diagnóstico read-only');
  expect(!/laterais\.length >= \d/.test(sel) && sel.includes('ACONTECEU_SECUNDARIAS'), 'servidor');
  const cli = trecho('const elegiveisLaterais', 'const usados = new Set([hero, ...destaques]');
  expect(!/destaques\.length >= \d/.test(cli) && (cli.match(/\$\{ACONTECEU_SECUNDARIAS\}/g) || []).length === 2, 'cliente');
});
await test('cliente completa vaga se uma secundária canônica faltar (não descarta a grade)', () => {
  expect(FRONT.includes('const extras = faltam > 0 ? destaques.filter(n => !idsCanon.has(n.id)).slice(0, faltam) : [];'));
  expect(!FRONT.includes('if (lateraisCanon.length === selCanon.laterais.length) destaques.splice'), 'regra antiga');
});
await test('CSS não esconde secundária em nenhuma largura', () => {
  const css = FRONT.slice(FRONT.indexOf('/* ---------- MASTHEAD'), FRONT.indexOf('/* Aconteceu no Offshore: entrada editorial'));
  expect(!/\.highlight[^{]*:(nth|last)[^{]*\{[^}]*display:\s*none/.test(css) && !/\.highlights[^{]*\{[^}]*(max-height|overflow:\s*hidden)/.test(css), 'regra que corta secundária');
});
await test('SSR aplica a classe do bloco (o replace casa com o markup real)', () => {
  expect(bloco(render(DEZ)).classe === 'masthead three-laterais');
  expect(bloco(render(ordenar([art(30, 90), art(40, 70)]))).oculto, 'sem manchete em 24h deveria ocultar');
});

Date.now = realNow;
logOriginal('\n' + pass + ' passaram, ' + fail + ' falharam');
process.exit(fail ? 1 : 0);
