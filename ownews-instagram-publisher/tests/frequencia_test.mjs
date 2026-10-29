// Frequência do feed (2026-10-29): SEG/QUA/SEX 15h Brasília + breaking excepcional.
// Roda o worker real com fetch e KV simulados — nenhuma chamada de rede.
//   node tests/frequencia_test.mjs
import assert from 'node:assert/strict';
import worker, { __t } from '../worker.js';

const { ehSlotNormal, proximoSlot, motivoBreaking, avaliarEspacamento, CRON_SLOT, CRON_BREAKING } = __t;
const H = 3600000;

// ---------- ambiente simulado ----------
function criarAmbiente({ articles = [], posts = [], agora, historicoFalha = false }) {
  const kv = new Map();
  const estado = { articles, posts, agora, chamadas: [] };
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    estado.chamadas.push(url.pathname);
    const json = (x) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.pathname === '/rest/v1/articles') {
      const desde = (url.searchParams.get('published_at') || 'gte.1970-01-01').slice(4);
      const idEq = url.searchParams.get('id');
      let lista = estado.articles.filter((a) => a.published_at >= desde && new Date(a.published_at).getTime() <= estado.agora);
      if (idEq) lista = estado.articles.filter((a) => `eq.${a.id}` === idEq);
      return json(lista.sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, Number(url.searchParams.get('limit') || 1000)));
    }
    if (url.pathname === '/rest/v1/instagram_posts') {
      if (historicoFalha) return new Response('erro', { status: 503 });
      let lista = estado.posts.filter((p) => new Date(p.published_at || p.created_at).getTime() <= estado.agora);
      if (url.searchParams.get('status') === 'eq.published') lista = lista.filter((p) => p.status === 'published');
      const desde = url.searchParams.get('published_at');
      if (desde) lista = lista.filter((p) => p.published_at >= desde.slice(4));
      return json(lista.sort((a, b) => (b.published_at || b.created_at).localeCompare(a.published_at || a.created_at)));
    }
    return new Response('not found', { status: 404 }); // imagens: sem rede no teste
  };
  const env = {
    SUPABASE_URL: 'https://supa.test',
    INSTAGRAM_DRY_RUN: 'true',
    RENDER_SHARED_SECRET: 'segredo-teste',
    SAUDE_KV: {
      async get(k) { return kv.has(k) ? kv.get(k) : null; },
      async put(k, v) { kv.set(k, v); },
    },
  };
  const job = async () => { const b = kv.get('render_job_current'); return b ? JSON.parse(b) : null; };
  return { env, estado, kv, job };
}

async function dispararCron(env, cron, quandoIso) {
  const promessas = [];
  await worker.scheduled({ cron, scheduledTime: new Date(quandoIso).getTime() }, env, { waitUntil: (p) => promessas.push(p) });
  await Promise.all(promessas);
}

function artigo(id, title, horasAtras, agora, extra = {}) {
  return { id, title, summary: extra.summary || '', image_url: extra.image_url || 'https://example.com/foto.jpg', image_credit: extra.image_credit || 'Fonte', original_url: `https://ownews.com.br/noticia?id=${id}`, published_at: new Date(agora - horasAtras * H).toISOString() };
}

const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

// Semana de referência: 2 a 8 de novembro de 2026 (seg a dom). 15:00 BRT = 18:00 UTC.
const SEG = '2026-11-02T18:00:00Z', TER = '2026-11-03T18:00:00Z', QUA = '2026-11-04T18:00:00Z';
const QUI = '2026-11-05T18:00:00Z', SEX = '2026-11-06T18:00:00Z', SAB = '2026-11-07T18:00:00Z', DOM = '2026-11-08T18:00:00Z';

teste('A/C/E — segunda, quarta e sexta 15h BRT são slots', () => {
  for (const d of [SEG, QUA, SEX]) assert.equal(ehSlotNormal(new Date(d)), true, d);
});
teste('B/D/F/G — terça, quinta, sábado e domingo não têm slot', () => {
  for (const d of [TER, QUI, SAB, DOM]) assert.equal(ehSlotNormal(new Date(d)), false, d);
});
teste('N — timezone: 15:00 Brasília = 18:00 UTC; 17:00 UTC (14h) e 15:00 UTC (12h) não valem', () => {
  assert.equal(ehSlotNormal(new Date('2026-11-02T17:00:00Z')), false);
  assert.equal(ehSlotNormal(new Date('2026-11-02T15:00:00Z')), false);
  assert.equal(ehSlotNormal(new Date('2026-11-02T18:59:00Z')), true);
  assert.equal(ehSlotNormal(new Date('2026-11-02T19:00:00Z')), false);
  assert.equal(proximoSlot(new Date('2026-10-29T12:00:00Z')), '2026-10-30T18:00:00.000Z'); // qui → sex 15h
  assert.equal(proximoSlot(new Date('2026-10-30T18:30:00Z')), '2026-11-02T18:00:00.000Z'); // sex depois do slot → seg
  assert.equal(__t.ultimoSlot(new Date('2026-11-01T12:00:00Z')), '2026-10-30T18:00:00.000Z'); // dom → sex anterior
  assert.equal(__t.ultimoSlot(new Date('2026-11-02T18:00:30Z')), '2026-11-02T18:00:00.000Z');
});
teste('cron do slot dispara 17h e 18h UTC só em SEG/QUA/SEX', () => {
  assert.equal(CRON_SLOT, '0 17,18 * * MON,WED,FRI');
  assert.equal(CRON_BREAKING, '30 * * * *');
});

teste('A/E — cron do slot na segunda e sexta 15h enfileira o melhor candidato', async () => {
  for (const d of [SEG, SEX]) {
    const agora = new Date(d).getTime();
    const amb = criarAmbiente({ agora, articles: [artigo('a1', 'Petrobras contrata nova sonda para o pré-sal', 2, agora)] });
    await dispararCron(amb.env, CRON_SLOT, d);
    const job = await amb.job();
    assert.ok(job, d);
    assert.equal(job.publicar.janela, 'slot_15h');
    assert.equal(job.publicar.articleId, 'a1');
  }
});
teste('B/D/F/G — cron do slot fora de SEG/QUA/SEX 15h não faz nada (nem rede, nem KV)', async () => {
  for (const d of [TER, QUI, SAB, DOM, '2026-11-02T17:00:00Z']) {
    const agora = new Date(d).getTime();
    const amb = criarAmbiente({ agora, articles: [artigo('a1', 'Petrobras contrata nova sonda para o pré-sal', 2, agora)] });
    await dispararCron(amb.env, CRON_SLOT, d);
    assert.equal(await amb.job(), null, d);
    assert.equal(amb.estado.chamadas.length, 0, d);
    assert.equal(amb.kv.size, 0, d);
  }
});
teste('crons antigos (12h diário, institucional domingo) são ignorados', async () => {
  const agora = new Date('2026-11-03T15:00:00Z').getTime();
  const amb = criarAmbiente({ agora, articles: [artigo('a1', 'Petrobras contrata nova sonda para o pré-sal', 2, agora)] });
  await dispararCron(amb.env, '0 15 * * MON-SAT', '2026-11-03T15:00:00Z');
  await dispararCron(amb.env, '0 16 * * SUN', '2026-11-08T16:00:00Z');
  assert.equal(await amb.job(), null);
  assert.equal(amb.kv.size, 0);
});

teste('H — notícia comum fora do slot não vai pro feed pelo cron de breaking', async () => {
  const d = '2026-11-03T14:30:00Z'; // terça 11:30
  const agora = new Date(d).getTime();
  const amb = criarAmbiente({ agora, articles: [artigo('c1', 'Petrobras divulga calendário de paradas programadas no pré-sal', 1, agora)] });
  await dispararCron(amb.env, CRON_BREAKING, d);
  assert.equal(await amb.job(), null);
  assert.equal(amb.kv.size, 0, 'checagem sem ação não grava KV');
});
teste('I — breaking válida na terça entra pelo fluxo extraordinário', async () => {
  const d = '2026-11-03T14:30:00Z';
  const agora = new Date(d).getTime();
  const amb = criarAmbiente({ agora, articles: [
    artigo('c1', 'Petrobras divulga calendário de paradas programadas no pré-sal', 1, agora),
    artigo('b1', 'Petrobras anuncia descoberta de petróleo em águas ultraprofundas da Bacia de Santos', 1, agora),
  ] });
  await dispararCron(amb.env, CRON_BREAKING, d);
  const job = await amb.job();
  assert.ok(job);
  assert.equal(job.publicar.janela, 'breaking');
  assert.equal(job.publicar.articleId, 'b1');
});
teste('I — breaking fora de 07:30–21:30 Brasília espera', async () => {
  const d = '2026-11-03T03:30:00Z'; // 00:30 BRT
  const agora = new Date(d).getTime();
  const amb = criarAmbiente({ agora, articles: [artigo('b1', 'Petrobras anuncia descoberta de petróleo na Bacia de Santos', 1, agora)] });
  await dispararCron(amb.env, CRON_BREAKING, d);
  assert.equal(await amb.job(), null);
  assert.equal(amb.estado.chamadas.length, 0);
});
teste('breaking: classificação determinística', () => {
  const sim = [
    ['Petrobras anuncia descoberta de petróleo em novo poço do pré-sal', ''],
    ['FPSO Almirante Tamandaré inicia produção no campo de Búzios', ''],
    ['Shell conclui aquisição de participação em bloco do pré-sal', 'A compra envolve ativos no Brasil'],
    ['Petrobras assina contrato de US$ 3 bilhões para afretamento de FPSO', ''],
    ['Incêndio em plataforma na Bacia de Campos mobiliza equipes', ''],
    ['Governo publica decreto que muda regras de exploração de petróleo offshore no Brasil', ''],
  ];
  for (const [t, s] of sim) assert.ok(motivoBreaking({ title: t, summary: s }), t);
  const nao = [
    ['Petrobras divulga calendário de paradas programadas no pré-sal', ''],
    ['Fugro recebe contrato para pesquisa de UXO em parque eólico', ''], // sem Brasil
    ['Equinor descobre gás no Mar do Norte', 'Descoberta na Noruega'], // sem Brasil
    ['ANP publica boletim mensal de produção', ''],
    ['Petrobras contrata nova sonda para o pré-sal', ''], // contrato sem valor bilionário
    ['PPSA realiza 10º Leilão Spot na próxima quarta-feira', 'Leilão de petróleo da União'], // rotina
    ['MME enviará decreto da eólica offshore à Casa Civil nas próximas semanas', 'Brasil'], // intenção, não fato
  ];
  for (const [t, s] of nao) assert.equal(motivoBreaking({ title: t, summary: s }), null, t);
});

teste('J — notícia já publicada não é escolhida de novo (nem como breaking)', async () => {
  const agora = new Date(SEX).getTime();
  const amb = criarAmbiente({ agora,
    articles: [artigo('a1', 'Petrobras contrata nova sonda para o pré-sal', 2, agora), artigo('a2', 'ANP aprova plano de desenvolvimento de campo offshore', 3, agora)],
    posts: [{ article_id: 'a1', headline: 'Petrobras contrata nova sonda para o pré-sal', status: 'published', post_type: 'noticia', janela: 'breaking', created_at: new Date(agora - 30 * H).toISOString(), published_at: new Date(agora - 30 * H).toISOString() }] });
  await dispararCron(amb.env, CRON_SLOT, SEX);
  assert.equal((await amb.job()).publicar.articleId, 'a2');
});
teste('K — notícia atual melhor vence a antiga que "esperava na fila"', async () => {
  const agora = new Date(QUA).getTime();
  const amb = criarAmbiente({ agora, articles: [
    artigo('velha', 'Petrobras amplia produção offshore em Campos', 22, agora),
    artigo('nova', 'Petrobras confirma nova plataforma para o pré-sal', 2, agora),
  ] });
  await dispararCron(amb.env, CRON_SLOT, QUA);
  assert.equal((await amb.job()).publicar.articleId, 'nova');
});
teste('K — com assunto e frescor iguais, a notícia ligada ao Brasil vence', async () => {
  const agora = new Date(SEG).getTime();
  const amb = criarAmbiente({ agora, articles: [
    artigo('irl', 'Fugro completa campanha offshore para eólica da Irlanda', 2, agora),
    artigo('br', 'Plataforma P-82 deixa estaleiro rumo ao campo de Búzios', 2, agora, { summary: 'A unidade da Petrobras segue para o Brasil' }),
  ] });
  await dispararCron(amb.env, CRON_SLOT, SEG);
  assert.equal((await amb.job()).publicar.articleId, 'br');
});
teste('K — matéria de 30h atrás nunca entra no slot', async () => {
  const agora = new Date(QUA).getTime();
  const amb = criarAmbiente({ agora, articles: [artigo('velha', 'Petrobras amplia produção offshore em Campos', 30, agora)] });
  await dispararCron(amb.env, CRON_SLOT, QUA);
  assert.equal(await amb.job(), null);
});
teste('L — sem conteúdo bom o bastante, o slot não publica (e registra o motivo)', async () => {
  const agora = new Date(SEG).getTime();
  const amb = criarAmbiente({ agora, articles: [artigo('fraca', 'Feira regional reúne expositores', 2, agora, { image_url: null })] });
  await dispararCron(amb.env, CRON_SLOT, SEG);
  assert.equal(await amb.job(), null);
  const exec = JSON.parse(amb.kv.get('instagram_ultima_execucao'));
  assert.equal(exec.resultado, 'skip');
  assert.match(exec.motivo, /abaixo do limiar do feed/);
});
teste('M — breaking sexta 13:30 suprime o slot das 15h', async () => {
  const agora = new Date(SEX).getTime();
  const amb = criarAmbiente({ agora,
    articles: [artigo('a2', 'Petrobras confirma nova plataforma para o pré-sal', 2, agora)],
    posts: [{ article_id: 'b1', headline: 'Petrobras anuncia descoberta no pré-sal', status: 'published', post_type: 'noticia', janela: 'breaking', created_at: new Date(agora - 1.5 * H).toISOString(), published_at: new Date(agora - 1.5 * H).toISOString() }] });
  await dispararCron(amb.env, CRON_SLOT, SEX);
  assert.equal(await amb.job(), null);
  assert.match(JSON.parse(amb.kv.get('instagram_ultima_execucao')).motivo, /slot suprimido/);
});
teste('M — breaking logo depois do slot espera 3h; e no máximo 1 breaking a cada 7 dias', () => {
  const agora = new Date('2026-11-06T19:30:00Z').getTime();
  const slot = { janela: 'slot_15h', published_at: new Date(SEX).toISOString() };
  assert.equal(avaliarEspacamento('breaking', { ok: true, posts: [slot] }, agora).ok, false);
  assert.equal(avaliarEspacamento('breaking', { ok: true, posts: [slot] }, agora + 2 * H).ok, true);
  const brk = { janela: 'breaking', published_at: new Date(agora - 3 * 24 * H).toISOString() };
  assert.match(avaliarEspacamento('breaking', { ok: true, posts: [brk] }, agora).motivo, /limite de 1 breaking/);
  assert.equal(avaliarEspacamento('breaking', { ok: true, posts: [{ ...brk, published_at: new Date(agora - 8 * 24 * H).toISOString() }] }, agora).ok, true);
  // slot com post há 13h segue normal
  assert.equal(avaliarEspacamento('slot', { ok: true, posts: [{ janela: 'breaking', published_at: new Date(agora - 13 * H).toISOString() }] }, agora).ok, true);
});
teste('falha ao ler histórico = não publica (fail-safe)', async () => {
  const agora = new Date(SEG).getTime();
  const amb = criarAmbiente({ agora, historicoFalha: true, articles: [artigo('a1', 'Petrobras contrata nova sonda para o pré-sal', 2, agora)] });
  await dispararCron(amb.env, CRON_SLOT, SEG);
  assert.equal(await amb.job(), null);
});
teste('job em andamento nunca é sobrescrito', async () => {
  const agora = new Date(SEG).getTime();
  const amb = criarAmbiente({ agora, articles: [artigo('a1', 'Petrobras contrata nova sonda para o pré-sal', 2, agora)] });
  amb.kv.set('render_job_current', JSON.stringify({ id: 'x', status: 'in_progress' }));
  await dispararCron(amb.env, CRON_SLOT, SEG);
  assert.equal((await amb.job()).id, 'x');
});
teste('rotas /run-* exigem segredo (antes eram abertas)', async () => {
  const amb = criarAmbiente({ agora: Date.now() });
  for (const r of ['/run-meio-dia', '/run-slot', '/run-breaking', '/run-institucional', '/run-manha', '/run-lancamento-real']) {
    const resp = await worker.fetch(new Request('https://ig.test' + r), amb.env, {});
    assert.equal(resp.status, 401, r);
  }
  assert.equal(await amb.job(), null);
});
teste('saúde: próxima janela e slot_hoje', async () => {
  const amb = criarAmbiente({ agora: Date.now() });
  const r = await (await worker.fetch(new Request('https://ig.test/saude-fragment'), amb.env, {})).json();
  assert.ok(ehSlotNormal(new Date(r.proxima_janela)));
  assert.equal(typeof r.slot_hoje, 'boolean');
  assert.equal(r.proximo_institucional, null);
});

let falhas = 0;
for (const [nome, fn] of testes) {
  try { await fn(); console.log('ok  ', nome); }
  catch (e) { falhas++; console.log('FAIL', nome, '\n     ', e.message); }
}
console.log(`\n${testes.length - falhas}/${testes.length} testes ok`);
process.exit(falhas ? 1 : 0);
