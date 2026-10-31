// Bloqueio de publicação em inglês (2026-10-31). Incidente: o post de 30/10 15h saiu com
// "Petrobras hits paydirt for third time in ultra-deep Amapá waters ..." porque o coletor
// tratava "tem acento → é português" (o "á" de Amapá). Casos reais do acervo; sem rede.
//   node tests/idioma_ptbr_test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker, { __t } from '../worker.js';

const RAIZ = new URL('../../', import.meta.url).pathname;
const ler = (rel) => readFileSync(RAIZ + rel, 'utf8');
const bloco = (src) => src.slice(src.indexOf('// <idioma-ptbr>'), src.indexOf('// </idioma-ptbr>') + '// </idioma-ptbr>'.length);
const ARQS = ['producao-ownews-git/worker.js', 'shrill-pond-a915-fix/worker.js', 'ownews-instagram-publisher/worker.js'];
const { idiomaTexto, textoEmIngles, textoPostEmIngles, contextoPublico, gerarLegendaNoticia, validarCaption, falhaFiltroDuro } = __t;
const H = 3600000;

const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

// ---------- coletor: funções reais extraídas do worker ----------
function extrairFuncao(src, assinatura) {
  const a = src.indexOf(assinatura); if (a < 0) throw new Error('ausente: ' + assinatura);
  let d = 0, i = src.indexOf('{', a);
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; }
  return src.slice(a, i + 1);
}
const COLETOR = ler('shrill-pond-a915-fix/worker.js');
const coletor = new Function(bloco(COLETOR) + '\n' + extrairFuncao(COLETOR, 'function precisaTraduzir(') + '\n' + extrairFuncao(COLETOR, 'function campoPublicoEmIngles(') +
  '\nreturn { precisaTraduzir, campoPublicoEmIngles };')();

const EN_REAIS = [
  'Petrobras hits paydirt for third time in ultra-deep Amapá waters as Equatorial Margin’s oil arsenal grows',
  "Petrobras' third discovery off the coast of Amapá has strengthened Equatorial Margin's emerging oil frontier.",
  'Transocean Ltd. Provides Quarterly Fleet Status Report',
  'Transocean Ltd. Announces $80 Million Contract For Ultra-Deepwater Drillship',
  'Transocean Ltd. Announces Second Quarter 2026 Earnings Release Date',
  'SBM Offshore announces that it has been awarded contracts by Petróleo Brasileiro S.A. (Petrobras) for two FPSOs',
  'This fresh oil discovery off Brazil’s northern coast encountered a new oil-bearing section at a well in ultra-deep waters',
  'SoundWaters, Derecktor Shipyards compartilham Inside Look into R/V Brewer',
];
const PT_REAIS = [
  'Petrobras anuncia 3ª descoberta de petróleo em poço na Foz do Amazonas',
  'MDIC propõe prioridade à indústria no gas release; Abrace quer incluir Braskem',
  'ANP realiza 2° Workshop para debater Gas Release',
  'FPSO ONE GUYANA, da SBM Offshore, completa um ano de operação na Guiana',
  'ACUA Ocean, Forssea Robotics conduz a integração ROV-USV',
  'Web Oil & Gas anuncia entrada no mercado subsea brasileiro',
  'SBM Offshore premia equipes que impulsionam a excelência',
  'Transocean fecha contrato de US$ 300 milhões com a ONGC para navio-sonda na Índia',
  'Royalties: valores referentes à produção de agosto foram distribuídos hoje a estados e municípios',
  'Aumento do percentual de mulheres embarcadas ainda é desafio para o setor de petróleo e gás',
  'PPSA participa da Gas Week 2026',
  'TDI-Brooks selecionado para pesquisa geotécnica offshore Timor-Leste',
];

teste('bloco <idioma-ptbr> idêntico no portal, no coletor e no publisher do Instagram', () => {
  const b = ARQS.map((f) => bloco(ler(f)));
  assert.ok(b[0].length > 500, 'bloco presente no portal');
  assert.equal(b[1], b[0], 'coletor = portal');
  assert.equal(b[2], b[0], 'publisher = portal');
});

teste('o incidente: título com "Amapá" é inglês (acento não decide)', () => {
  assert.equal(idiomaTexto(EN_REAIS[0]), 'en');
  assert.equal(idiomaTexto(EN_REAIS[1]), 'en');
});

teste('textos em inglês reais do acervo → inglês', () => {
  for (const t of EN_REAIS) assert.equal(textoEmIngles(t), true, t);
});

teste('títulos em português reais (com termos técnicos em inglês) nunca são bloqueados', () => {
  for (const t of PT_REAIS) assert.equal(textoEmIngles(t), false, t);
});

teste('coletor: fonte internacional traduz tudo que não é claramente PT; fonte BR só o que é inglês', () => {
  const { precisaTraduzir } = coletor;
  assert.equal(precisaTraduzir(EN_REAIS[0], true), true, 'o título do incidente agora é traduzido');
  assert.equal(precisaTraduzir('Electrical fault triggers rig intervention', true), true, 'indefinido de fonte EN: traduz');
  assert.equal(precisaTraduzir(PT_REAIS[0], true), false);
  assert.equal(precisaTraduzir('PPSA participa da Gas Week 2026', false), false);
  assert.equal(precisaTraduzir(EN_REAIS[2], false), true);
});

teste('coletor: barreira final aponta o campo público em inglês (título, resumo, Buddy, impacto, corpo)', () => {
  const { campoPublicoEmIngles } = coletor;
  const pt = { title: PT_REAIS[0], summary: 'A Petrobras confirmou o terceiro poço.', buddy_summary: 'A Petrobras confirmou petróleo no poço Morpho.', why_it_matters: 'Amplia a fronteira da Margem Equatorial.', content: 'O poço Morpho fica a 175 km da costa do Amapá.' };
  assert.equal(campoPublicoEmIngles(pt), null);
  assert.equal(campoPublicoEmIngles({ ...pt, title: EN_REAIS[0] }), 'title');
  assert.equal(campoPublicoEmIngles({ ...pt, summary: EN_REAIS[1] }), 'summary');
  assert.equal(campoPublicoEmIngles({ ...pt, content: EN_REAIS[6] }), 'content');
  assert.equal(campoPublicoEmIngles({ ...pt, summary: null }), null, 'resumo vazio é aceito');
});

teste('coletor: tradução conferida, resumo sem tradução sai vazio e o acento não decide mais', () => {
  assert.doesNotMatch(COLETOR, /PT_DIACRITIC_RE/);
  assert.match(COLETOR, /if \(!trad \|\| textoEmIngles\(trad\)\) \{\n\s+resultado\.bloqueadas_idioma\+\+;/);
  assert.match(COLETOR, /resumoPublicado = tradRes && !textoEmIngles\(tradRes\) \? tradRes : null;/);
  assert.match(COLETOR, /const campoEN = campoPublicoEmIngles\(artigo\);\n\s+if \(campoEN\) \{/);
  // barreira vem ANTES da gravação
  assert.ok(COLETOR.indexOf('const campoEN = campoPublicoEmIngles(artigo);') < COLETOR.indexOf('await inserirArtigo(env, artigo);'));
});

teste('portal: Home do servidor não mostra título em inglês; indexação usa o mesmo detector', () => {
  const portal = ler('producao-ownews-git/worker.js');
  assert.match(portal, /lista\.filter\(\(n\) => !textoEmIngles\(n\.title\)\)/);
  assert.match(portal, /function tituloEmIngles\(titulo\) \{\n  return textoEmIngles\(titulo\);\n\}/);
});

teste('Instagram: título em inglês reprovado no filtro duro', () => {
  assert.match(falhaFiltroDuro({ title: EN_REAIS[0], summary: '' }), /inglês/);
  assert.equal(falhaFiltroDuro({ title: PT_REAIS[0], summary: '' }), null);
});

teste('Instagram: resumo em inglês não vai para a arte nem para a legenda', () => {
  const a = { id: 'x', title: 'Zupt e Mitang apoiam serviços submarinos no Brasil', summary: 'Zupt Has Signed A Framework Agreement With Mitang Brasil To Support Subsea Survey', image_credit: 'Marine Technology News' };
  assert.equal(contextoPublico(a), null);
  const legenda = gerarLegendaNoticia(a, a.title);
  assert.doesNotMatch(legenda, /Framework Agreement/);
  assert.equal(textoPostEmIngles(legenda), null);
  assert.match(legenda, /Fonte: Marine Technology News/, 'nome da fonte continua (atribuição)');
});

teste('Instagram: última barreira — legenda com linha em inglês não é publicada', async () => {
  const r = await validarCaption({ caption: EN_REAIS[0] + '\n\nMais detalhes e contexto no OWNews.\n\nFonte: Offshore Energy\n\nAcesse: ownews.com.br/noticia?id=1' });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /inglês/);
  assert.equal((await validarCaption({ caption: PT_REAIS[0] + '\n\nMais detalhes e contexto no OWNews.\n\nFonte: Offshore Energy\n\nAcesse: ownews.com.br/noticia?id=1' })).ok, true);
});

teste('reprodução do incidente: slot de sexta escolhe a matéria em PT, nunca a em inglês', async () => {
  const agora = Date.parse('2026-10-30T18:00:00Z'); // sex 15h Brasília
  const art = (id, title, horas, extra = {}) => ({ id, title, summary: extra.summary || '', image_url: 'https://example.com/f.jpg', image_credit: extra.fonte || 'Fonte', original_url: 'https://x/' + id, published_at: new Date(agora - horas * H).toISOString(), buddy_source: extra.bs || 'ownews' });
  const articles = [
    art('en1', EN_REAIS[0], 2, { summary: EN_REAIS[1], fonte: 'Offshore Energy' }),
    art('dup', 'Petrobras confirma terceira descoberta em águas ultraprofundas do Amapá', 2, { bs: 'duplicada' }),
    art('pt1', 'Petrobras anuncia nova descoberta de petróleo em poço na Bacia de Campos', 5, { fonte: 'Petrobras' }),
  ];
  const kv = new Map();
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const json = (x) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.pathname === '/rest/v1/articles') return json(articles);
    if (url.pathname === '/rest/v1/instagram_posts') return json([]);
    return new Response('nf', { status: 404 });
  };
  const env = { SUPABASE_URL: 'https://supa.test', INSTAGRAM_DRY_RUN: 'true', RENDER_SHARED_SECRET: 's', SAUDE_KV: { async get(k) { return kv.get(k) ?? null; }, async put(k, v) { kv.set(k, v); } } };
  const sel = await __t.selecionarCandidatoNoticia(env, { modo: 'slot', agora });
  assert.equal(sel.escolhido && sel.escolhido.id, 'pt1');
  assert.ok(sel.descartados.some((d) => d.id === 'en1' && /inglês/.test(d.motivo)), 'inglês descartado com motivo');
  assert.ok(sel.descartados.some((d) => d.id === 'dup' && /duplicada/.test(d.motivo)), 'duplicada descartada');
  const promessas = [];
  await worker.scheduled({ cron: __t.CRON_SLOT, scheduledTime: agora }, env, { waitUntil: (p) => promessas.push(p) });
  await Promise.all(promessas);
  const job = JSON.parse(kv.get('render_job_current'));
  assert.equal(job.publicar.articleId, 'pt1');
  assert.equal(textoPostEmIngles(job.arte.headline, job.arte.contexto, job.publicar.caption), null);
});

let falhas = 0;
for (const [nome, fn] of testes) {
  try { await fn(); console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + '\n      ' + e.message.split('\n').slice(0, 4).join('\n      ')); }
}
console.log(`\n${testes.length - falhas}/${testes.length} testes ok`);
process.exit(falhas ? 1 : 0);
