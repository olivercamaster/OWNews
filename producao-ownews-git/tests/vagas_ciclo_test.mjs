#!/usr/bin/env node
/* Ciclo de vida das vagas (auditoria 27/10/2026): entra, atualiza, não
   duplica, sai só com evidência, falha da fonte não apaga nada, histórico
   preservado, Home ≤ 3. Roda o worker.js real com KV e fetch simulados. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(DIR, '..', 'worker.js'), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ownews-vagas-'));
const arq = path.join(tmp, 'w.mjs');
fs.writeFileSync(arq, SRC.replace("from './ao-vivo/futebol.js'", 'from ' + JSON.stringify(pathToFileURL(path.join(DIR, '..', 'ao-vivo', 'futebol.js')).href)) +
  '\nexport const __t = { zerarEstado: () => { vagasEstado = null; }, localizacaoVaga, categoriaVaga, intercalarVagasPorEmpresa, cardVaga, reconciliarVagas, classificarPaginaSF, classificarPaginaGupy, blocoVagasHome, alertasRadarVagas, chaveVaga, VAGAS_RADAR, vagasAbertasEspecificas, getVagasRadar, refreshVagasRadar, renderVagasIndex, renderVagaDetalhe, slugVaga };\n');
const T = (await import(pathToFileURL(arq).href)).__t;
fs.rmSync(tmp, { recursive: true, force: true });

let pass = 0, fail = 0;
const test = async (nome, fn) => { try { await fn(); pass++; console.log('  ✓ ' + nome); } catch (e) { fail++; console.log('  ✗ ' + nome + '\n      ' + e.message); } };
const expect = (c, m) => { if (!c) throw new Error(m || 'falhou'); };

const vaga = (id, extra) => Object.assign({ titulo: 'Técnico ' + id, empresa: 'Subsea7', local: 'Offshore', pais_codigo: 'BR', plataforma: 'successfactors', external_job_id: id,
  application_url: 'https://careers.subsea7.com/job/Offshore-Tecnico/' + id + '/', fonte_oficial: true, status: 'OPEN', closing_date: '2099-12-31' }, extra || {});
const fonte = (...verificacoes) => ({ ok: true, verificacoes });
const ativa = (v) => ({ chave: T.chaveVaga(v), resultado: 'ativa', vaga: v });
const r = (v, resultado, motivo) => ({ chave: T.chaveVaga(v), resultado, motivo });
const rodar = (reg, fontes, quando) => T.reconciliarVagas(reg, fontes, [], quando || '2026-10-27T12:00:00Z');
const A = vaga('111'), B = vaga('222'), C = vaga('333');
const base = rodar({}, { sf: fonte(ativa(A), ativa(B), ativa(C)) }, '2026-10-26T00:00:00Z').registro;

console.log('\nVagas — ciclo de vida');
await test('A) vaga nova entra (first_seen = coleta)', () => {
  const D = vaga('444');
  const x = rodar(base, { sf: fonte(ativa(A), ativa(B), ativa(C), ativa(D)) });
  expect(x.resumo.sf.novas === 1 && x.registro['successfactors:444'].first_seen_at === '2026-10-27T12:00:00Z' && x.jobs.some((j) => j.external_job_id === '444'));
  expect(x.jobs.find((j) => j.external_job_id === '444').first_seen_at === '2026-10-27T12:00:00Z', 'first_seen exposto');
});
await test('B) vaga existente atualiza o mesmo registro (título, prazo, link)', () => {
  const A2 = vaga('111', { titulo: 'Técnico de Elétrica', closing_date: '2099-11-30' });
  const x = rodar(base, { sf: fonte(ativa(A2), ativa(B), ativa(C)) });
  const e = x.registro['successfactors:111'];
  expect(x.resumo.sf.atualizadas === 1 && e.dados.titulo === 'Técnico de Elétrica' && e.atualizado_em && e.first_seen_at === '2026-10-26T00:00:00Z');
  expect(Object.keys(x.registro).length === 3, 'criou registro novo');
});
await test('C) mesma vaga coletada duas vezes não duplica', () => {
  const x = rodar(base, { sf: fonte(ativa(A), ativa(A), ativa(B), ativa(C)) });
  expect(Object.keys(x.registro).length === 3 && x.jobs.filter((j) => j.external_job_id === '111').length === 1);
});
await test('D) ausente após coleta válida: 1ª vez segue ativa, 2ª sai; sinal explícito sai na hora', () => {
  const x1 = rodar(base, { sf: fonte(ativa(A), ativa(B), r(C, 'ausente')) });
  expect(x1.registro['successfactors:333'].status === 'ativa' && x1.registro['successfactors:333'].missing_count === 1, '1ª ausência não remove');
  const x2 = rodar(x1.registro, { sf: fonte(ativa(A), ativa(B), r(C, 'ausente')) }, '2026-10-27T18:00:00Z');
  const e = x2.registro['successfactors:333'];
  expect(e.status === 'removida' && e.removed_at === '2026-10-27T18:00:00Z' && /2 coletas/.test(e.motivo_saida) && !x2.jobs.some((j) => j.external_job_id === '333'));
  const x3 = rodar(base, { sf: fonte(ativa(A), ativa(B), r(C, 'encerrada', 'Subsea7: "position has been filled"')) });
  expect(x3.registro['successfactors:333'].status === 'removida' && /filled/.test(x3.registro['successfactors:333'].motivo_saida), 'explícita');
});
await test('E) erro/timeout/fonte fora do ar não remove nada', () => {
  const x = rodar(base, { sf: { ok: false, erro: 'SF search HTTP 503' } });
  expect(x.jobs.length === 3 && Object.values(x.registro).every((e) => e.status === 'ativa' && !e.missing_count));
  const y = rodar(base, { sf: fonte(r(A, 'erro', 'timeout'), r(B, 'erro'), r(C, 'erro')) });
  expect(y.jobs.length === 3 && Object.values(y.registro).every((e) => !e.missing_count), 'erro por vaga');
});
await test('F) resposta vazia/anormal (todas ausentes de uma vez) não remove', () => {
  for (let i = 0; i < 3; i++) {
    const x = rodar(base, { sf: fonte(r(A, 'ausente'), r(B, 'ausente'), r(C, 'ausente')) });
    expect(x.resumo.sf.anomalia && x.jobs.length === 3 && Object.values(x.registro).every((e) => !e.missing_count));
  }
});
await test('J) vaga que volta a aparecer na fonte é reconfirmada (reaberta)', () => {
  const fora = rodar(base, { sf: fonte(ativa(A), ativa(B), r(C, 'encerrada')) }).registro;
  const x = rodar(fora, { sf: fonte(ativa(A), ativa(B), ativa(C)) }, '2026-10-28T00:00:00Z');
  const e = x.registro['successfactors:333'];
  expect(e.status === 'ativa' && e.reaberta_em === '2026-10-28T00:00:00Z' && e.removed_at === null && x.resumo.sf.reabertas === 1);
});
await test('K) histórico preservado: encerrada continua no registro com datas', () => {
  const x = rodar(base, { sf: fonte(ativa(A), ativa(B), r(C, 'encerrada')) });
  const e = x.registro['successfactors:333'];
  expect(e && e.first_seen_at && e.last_seen_at && e.removed_at && e.dados && e.dados.titulo === 'Técnico 333');
});

console.log('\nVagas — sinais reais das fontes');
await test('Subsea7: "position has been filled" = encerrada; 404 = ausente; 503 = erro; página com título = ativa', () => {
  expect(T.classificarPaginaSF(200, '<p>Sorry, this position has been filled.</p>', 'u').resultado === 'encerrada');
  expect(T.classificarPaginaSF(404, '', 'u').resultado === 'ausente' && T.classificarPaginaSF(503, '', 'u').resultado === 'erro' && T.classificarPaginaSF(429, '', 'u').resultado === 'erro');
  const html = '<span itemprop="title">Marinheira(o) de Convés</span> Job Closing Date: <span>7 Nov 2026</span>';
  const c = T.classificarPaginaSF(200, html, 'https://careers.subsea7.com/job/Offshore-Marinheira/1366277955/');
  expect(c.resultado === 'ativa' && c.vaga.closing_date === '2026-11-07' && c.vaga.external_job_id === '1366277955');
  expect(T.classificarPaginaSF(200, '<html>página genérica de busca</html>', 'u').resultado === 'ausente');
});
await test('Gupy: published = ativa; outro status = encerrada; sem __NEXT_DATA__ ou 429 = erro', () => {
  const nd = (job) => '<script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: { job } } }) + '</script>';
  expect(T.classificarPaginaGupy(200, nd({ name: 'X', status: 'published' })).resultado === 'ativa');
  expect(T.classificarPaginaGupy(200, nd({ name: 'X', status: 'closed' })).resultado === 'encerrada' && T.classificarPaginaGupy(200, nd({ name: 'X', status: 'canceled' })).resultado === 'encerrada');
  expect(T.classificarPaginaGupy(200, '<html></html>').resultado === 'erro' && T.classificarPaginaGupy(429, '').resultado === 'erro' && T.classificarPaginaGupy(404, '').resultado === 'ausente');
});

console.log('\nVagas — site');
await test('G/I) Home: no máximo 3 cards, contador real, nunca vaga encerrada; Shell e Subsea7 preenchidas fora', () => {
  const lista = Array.from({ length: 9 }, (_, i) => vaga(String(500 + i), { empresa: ['PRIO', 'Ocyan', 'Subsea7'][i % 3] }));
  const h = T.blocoVagasHome(lista);
  expect((h.match(/class="vaga-card-home"/g) || []).length === 3 && h.includes('9 vagas publicadas'));
  expect(T.blocoVagasHome([]) === null, 'sem vaga: sem bloco');
  const vivas = T.vagasAbertasEspecificas(); // sem KV: array conferido à mão menos as encerradas
  expect(!vivas.some((v) => v.empresa === 'Shell') && !vivas.some((v) => ['1361734955', '1361733755', '1361968355', '1359683955'].includes(v.external_job_id)), 'encerradas na Home');
  expect(!SRC.includes('VAGAS_ABERTAS_ESPECIFICAS') && SRC.includes('<section class="ed-section vagas-home-section" id="vagas-agora" hidden></section>'), 'Home calculada no carregamento do módulo (relógio 1970)');
});
const kvCom = (cache) => { const puts = []; return { puts, PERGUNTE_IA_KV: { get: async () => JSON.parse(JSON.stringify(cache)), put: async (k, v, o) => { puts.push({ k, v: JSON.parse(v), o }); } } }; };
await test('H) /vagas e detalhe: encerrada não aparece como atual; URL antiga mostra "encerrada"', async () => {
  const reg = rodar(base, { sf: fonte(ativa(A), ativa(B), r(C, 'encerrada')) });
  const env = kvCom({ versao: 2, jobs: reg.jobs, registro: reg.registro, updated_at: new Date().toISOString(), sources: {} });
  const ctx = { waitUntil() {} };
  const html = await T.renderVagasIndex(env, ctx);
  const txt = typeof html === 'string' ? html : await html.text();
  expect(txt.includes('Técnico 111') && !txt.includes('Técnico 333'), 'encerrada listada');
  const det = await T.renderVagaDetalhe(T.slugVaga(C), env, ctx);
  const d = typeof det === 'string' ? det : (det && det.html) || JSON.stringify(det);
  expect(d && /OPORTUNIDADE ENCERRADA/.test(d) && !/CANDIDATAR-SE NO SITE OFICIAL/.test(d), 'detalhe da encerrada');
});
await test('coleta completa: falha da fonte não apaga; "filled" tira; KV sem expiração e com execuções', async () => {
  const realFetch = globalThis.fetch;
  let modo = 'ok';
  const busca = '<a data-url="/job/Offshore-Tecnico/1110001/"></a><a data-url="/job/Offshore-Tecnico/2220002/"></a>';
  globalThis.fetch = async (u) => {
    u = String(u);
    const resp = (status, body) => ({ ok: status === 200, status, redirected: false, text: async () => body, json: async () => JSON.parse(body) });
    if (u.includes('/search/results')) return modo === 'fora' ? resp(503, '') : resp(200, modo === 'preenchida' ? busca.split('</a>')[0] + '</a>' : busca);
    const id = (u.match(/\/(\d+)\/$/) || [])[1];
    if (id === '2220002' && modo === 'preenchida') return resp(200, '<p>Sorry, this position has been filled.</p>');
    if (id) return resp(200, '<span itemprop="title">Técnico ' + id + '</span><span class="jobGeoLocation">Macaé, BR </span> Job Closing Date: <span>7 Nov 2099</span>');
    if (u.includes('gupy.io')) return resp(200, '<script id="__NEXT_DATA__">' + JSON.stringify({ props: { pageProps: { job: { name: 'Vaga Gupy', status: 'published', expiresAt: '2099-12-31' } } } }) + '</script>');
    return resp(404, '{}');
  };
  try {
    let cache = null;
    const env = { PERGUNTE_IA_KV: { get: async () => cache && JSON.parse(JSON.stringify(cache)), put: async (k, v, o) => { expect(!o || !o.expirationTtl, 'KV com expiração apaga o histórico'); cache = JSON.parse(v); } } };
    await T.refreshVagasRadar(env);
    expect(cache && cache.versao === 2 && cache.registro['successfactors:2220002'].status === 'ativa' && cache.execucoes.length === 1, '1ª coleta');
    modo = 'fora'; await T.refreshVagasRadar(env);
    expect(cache.registro['successfactors:2220002'].status === 'ativa' && cache.sources.successfactors_subsea7.ok === false && cache.execucoes.length === 2, 'fonte fora do ar removeu');
    expect(T.alertasRadarVagas(cache, Date.now()).some((a) => /successfactors_subsea7: falhou/.test(a)), 'alerta de falha');
    modo = 'preenchida'; await T.refreshVagasRadar(env);
    const e = cache.registro['successfactors:2220002'];
    expect(e.status === 'removida' && /filled/.test(e.motivo_saida) && !cache.jobs.some((j) => j.external_job_id === '2220002'), 'preenchida continua');
    expect(cache.registro['workday:R209155'].status === 'removida', 'Shell encerrada no registro');
  } finally { globalThis.fetch = realFetch; }
});

console.log('\nVagas — descoberta automática (Gupy e Subsea7)');
const gupyLista = (jobs) => '<script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: { jobs } } }) + '</script>';
const gupyVaga = (job) => '<script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: { job } } }) + '</script>';
const end = { address: { country: 'Brasil', city: 'Macaé', stateShortName: 'RJ' } };
function fontesFalsas(cfg) {
  return async (u) => {
    u = String(u);
    const resp = (status, body) => ({ ok: status === 200, status, redirected: false, text: async () => body, json: async () => JSON.parse(body) });
    for (const [re, f] of cfg) { const m = u.match(re); if (m) { const x = f(m, u); return typeof x === 'number' ? resp(x, '') : resp(200, x); } }
    return resp(404, '');
  };
}
async function coletar(cfg, cacheInicial) {
  const realFetch = globalThis.fetch; globalThis.fetch = fontesFalsas(cfg);
  let cache = cacheInicial ? JSON.parse(JSON.stringify(cacheInicial)) : null;
  const env = { PERGUNTE_IA_KV: { get: async () => cache && JSON.parse(JSON.stringify(cache)), put: async (k, v) => { cache = JSON.parse(v); } } };
  try { await T.refreshVagasRadar(env); } finally { globalThis.fetch = realFetch; }
  return cache;
}
// Brava lista: 1 vaga conhecida (Bombeador), 1 nova offshore, 1 corporativa fora do foco.
const BRAVA = [{ id: 12401067, title: 'Bombeador Offshore', type: 'vacancy_type_effective', department: 'Operações', workplace: end },
  { id: 99000001, title: 'Supervisor (a) de Marinha Offshore', type: 'vacancy_type_effective', department: 'Gerência de Operações', workplace: end },
  { id: 99000002, title: 'Analista de Comunicação com Imprensa', type: 'vacancy_type_effective', department: 'Comunicação', workplace: end }];
const cfgBase = (extra) => (extra || []).concat([
  [/bravaenergia\.gupy\.io\/$/, () => gupyLista(BRAVA)],
  [/(prio|ocyan|foresea)\.gupy\.io\/$/, () => gupyLista([])],
  [/gupy\.io\/jobs\/(\d+)/, (m) => gupyVaga({ name: 'X', status: 'published', expiresAt: '2099-12-31' })],
  [/subsea7\.com\/sitemap\.xml/, () => '<loc>https://careers.subsea7.com/job/Rio-de-Janeiro-Analista-de-Suprimentos/1370000001/</loc><loc>https://careers.subsea7.com/job/Offshore-Trainee-3rd-Engineer-Deck/1370000002/</loc><loc>https://careers.subsea7.com/job/Houston-Senior-Engineer/1370000003/</loc>'],
  [/optionsFacetsDD_country=BR/, () => '<a data-url="/job/Rio-de-Janeiro-Analista-de-Suprimentos/1370000001/"></a>'],
  [/search\/results\?q=offshore/, () => '<a data-url="/job/Offshore-Trainee-3rd-Engineer-Deck/1370000002/"></a>'],
  [/\/1370000001\/$/, () => '<span itemprop="title">Analista de Suprimentos Sr</span><span class="jobGeoLocation">Rio de Janeiro, BR </span> Job Closing Date: 02/01/2027 | Inscrições até 06/11/2026'],
  [/\/1370000002\/$/, () => '<span itemprop="title">Trainee 3rd Engineer - Deck</span><span class="jobGeoLocation">Offshore, SG </span> Job Closing Date: 16 Nov 2026'],
  [/\/1370000003\/$/, () => '<span itemprop="title">Senior Engineer</span><span class="jobGeoLocation">Houston, US </span>'],
]);
await test('A) Gupy descobre vaga nova que não está no array manual; B) a conhecida não duplica', async () => {
  const c = await coletar(cfgBase());
  const nova = c.registro['gupy:99000001'];
  expect(nova && nova.status === 'ativa' && nova.dados.application_url === 'https://bravaenergia.gupy.io/jobs/99000001' && nova.dados.local === 'Macaé', 'nova Gupy');
  expect(c.jobs.filter((j) => j.external_job_id === '12401067').length === 1 && Object.keys(c.registro).filter((k) => k === 'gupy:12401067').length === 1, 'duplicou');
  expect(!c.registro['gupy:99000002'] && c.descartadas['gupy:99000002'] && /foco/.test(c.descartadas['gupy:99000002'].motivo), 'corporativa fora do foco entrou');
  expect(c.sources.gupy.por_empresa['Brava Energia'].listadas === 3 && c.sources.gupy.por_empresa['Brava Energia'].relevantes === 2, 'contagem por empresa');
  expect(T.slugVaga(nova.dados) !== 'brava-bombeador-offshore' && T.slugVaga(c.registro['gupy:12401067'].dados) === 'brava-bombeador-offshore', 'slug por empresa colide');
});
await test('C) vaga encerrada não ressuscita pelo array antigo nem pela listagem atrasada', async () => {
  const c1 = await coletar(cfgBase());
  c1.registro['gupy:12401067'].status = 'removida'; c1.registro['gupy:12401067'].removed_at = '2026-10-27T00:00:00Z';
  const c2 = await coletar(cfgBase([[/bravaenergia\.gupy\.io\/$/, () => gupyLista(BRAVA.slice(1))], [/gupy\.io\/jobs\/12401067/, () => gupyVaga({ name: 'Bombeador', status: 'closed' })]]), c1);
  expect(c2.registro['gupy:12401067'].status === 'removida' && !c2.jobs.some((j) => j.external_job_id === '12401067'), 'ressuscitou');
  expect(c2.registro['workday:R209155'].status === 'removida' && c2.registro['successfactors:1361734955'].status === 'removida', 'array manual reabriu encerradas');
});
await test('D) falha da Gupy (5xx, timeout, lista vazia anormal) não remove vagas', async () => {
  const c1 = await coletar(cfgBase());
  const c2 = await coletar(cfgBase([[/\.gupy\.io\/$/, () => 503], [/gupy\.io\/jobs/, () => 503]]), c1);
  expect(c2.sources.gupy.ok === false && c2.registro['gupy:99000001'].status === 'ativa' && !c2.registro['gupy:99000001'].missing_count, '5xx');
  const c3 = await coletar(cfgBase([[/bravaenergia\.gupy\.io\/$/, () => gupyLista([])]]), c1);
  expect(c3.registro['gupy:99000001'].status === 'ativa' && !c3.registro['gupy:99000001'].missing_count && c3.sources.gupy.por_empresa['Brava Energia'].ok === false, 'lista vazia anormal');
  const realFetch = globalThis.fetch; globalThis.fetch = async () => { throw new Error('timeout'); };
  let cache = JSON.parse(JSON.stringify(c1));
  try { await T.refreshVagasRadar({ PERGUNTE_IA_KV: { get: async () => cache, put: async (k, v) => { cache = JSON.parse(v); } } }); } finally { globalThis.fetch = realFetch; }
  expect(Object.values(cache.registro).filter((e) => e.status === 'ativa').length === Object.values(c1.registro).filter((e) => e.status === 'ativa').length, 'timeout removeu');
});
await test('vaga Gupy que sai da listagem é conferida na página: publicada fica, 2 ausências tiram', async () => {
  const c1 = await coletar(cfgBase());
  const semNova = cfgBase([[/bravaenergia\.gupy\.io\/$/, () => gupyLista([BRAVA[0], BRAVA[2]])]]);
  const c2 = await coletar(semNova, c1);
  expect(c2.registro['gupy:99000001'].status === 'ativa', 'publicada na página saiu');
  const some = cfgBase([[/bravaenergia\.gupy\.io\/$/, () => gupyLista([BRAVA[0], BRAVA[2]])], [/jobs\/99000001/, () => 404]]);
  const c3 = await coletar(some, c2), c4 = await coletar(some, c3);
  expect(c3.registro['gupy:99000001'].status === 'ativa' && c4.registro['gupy:99000001'].status === 'removida', '2 ausências');
});
await test('E) Subsea7: vaga brasileira sem "offshore" é encontrada (país BR); prazo "Inscrições até"', async () => {
  const c = await coletar(cfgBase());
  const e = c.registro['successfactors:1370000001'];
  expect(e && e.status === 'ativa' && e.dados.pais_codigo === 'BR' && e.dados.local === 'Rio de Janeiro' && e.dados.closing_date === '2026-11-06');
});
await test('F) Subsea7: vaga estrangeira não entra (Offshore, SG; Houston, US); a já publicada sai como "fora do Brasil"', async () => {
  const c = await coletar(cfgBase());
  expect(!c.registro['successfactors:1370000002'] && /Brasil/.test(c.descartadas['successfactors:1370000002'].motivo) && !c.registro['successfactors:1370000003'], 'estrangeira entrou');
  const antigo = JSON.parse(JSON.stringify(c));
  antigo.registro['successfactors:1370000002'] = { chave: 'successfactors:1370000002', status: 'ativa', empresa: 'Subsea7', titulo: 'Trainee 3rd Engineer - Deck', first_seen_at: '2026-10-27T00:00:00Z', last_seen_at: '2026-10-27T00:00:00Z', missing_count: 0,
    dados: { titulo: 'Trainee 3rd Engineer - Deck', empresa: 'Subsea7', plataforma: 'successfactors', external_job_id: '1370000002', application_url: 'https://careers.subsea7.com/job/Offshore-Trainee-3rd-Engineer-Deck/1370000002/' } };
  delete antigo.descartadas['successfactors:1370000002'];
  const d = await coletar(cfgBase(), antigo);
  expect(d.registro['successfactors:1370000002'].status === 'removida' && /fora do Brasil/.test(d.registro['successfactors:1370000002'].motivo_saida), 'publicada estrangeira ficou');
});
await test('G) first_seen fica, last_seen avança a cada coleta', async () => {
  const c1 = await coletar(cfgBase());
  const f1 = c1.registro['gupy:99000001'].first_seen_at;
  c1.registro['gupy:99000001'].last_seen_at = '2026-01-01T00:00:00Z';
  const c2 = await coletar(cfgBase(), c1);
  expect(c2.registro['gupy:99000001'].first_seen_at === f1 && c2.registro['gupy:99000001'].last_seen_at > '2026-01-01T00:00:00Z');
});
await test('H) Home segue com no máximo 3; I) worker abaixo do guard', () => {
  const muitas = Array.from({ length: 40 }, (_, i) => vaga(String(1380000000 + i), { empresa: ['PRIO', 'Brava Energia', 'Ocyan', 'Foresea', 'Subsea7'][i % 5] }));
  expect((T.blocoVagasHome(muitas).match(/class="vaga-card-home"/g) || []).length === 3);
  const mix = [vaga('1390000001', { empresa: 'PRIO', titulo: 'Analista de Planejamento', offshore_onshore: 'NAO_INFORMADO' }), vaga('1390000002', { empresa: 'Brava Energia', titulo: 'Supervisor de Marinha Offshore', offshore_onshore: 'OFFSHORE' })];
  expect(T.blocoVagasHome(mix).indexOf('Supervisor de Marinha') < T.blocoVagasHome(mix).indexOf('Analista de Planejamento'), 'Home: offshore primeiro');
  expect(Buffer.byteLength(SRC) < 1760000, 'worker.js ' + Buffer.byteLength(SRC));
});

console.log('\nVagas — somente Brasil');
await test('regra Brasil: local de trabalho decide, não a empresa; ambíguo e remoto sem país não publicam', () => {
  const casos = [
    ['Rio de Janeiro, Brazil', { local: 'Rio de Janeiro', pais: 'Brazil' }, true], ['Macaé, RJ', { local: 'Macaé, RJ' }, true], ['Brazil Offshore', { local: 'Brazil Offshore' }, true],
    ['Aberdeen, UK', { local: 'Aberdeen (Westhill), UK' }, false], ['Houston, USA', { local: 'Houston, TX, USA' }, false], ['Luanda, Angola', { local: 'Luanda, Angola' }, false],
    ['Georgetown, Guyana', { local: 'Georgetown, Guyana' }, false], ['desconhecida', {}, false], ['Remote + Brasil', { local: 'Remote', pais: 'Brasil' }, true],
    ['Remote sem país', { local: 'Remote' }, false], ['estrangeira no Brasil', { empresa: 'Shell', local: 'Macaé', pais_codigo: 'BR' }, true],
    ['brasileira no exterior', { empresa: 'PRIO', local: 'Houston', pais_codigo: 'US' }, false], ['Mossoró (acento no fim)', { local: 'Mossoró' }, true], ['Offshore sem país', { local: 'Offshore' }, false],
  ];
  for (const [nome, v, br] of casos) expect(T.localizacaoVaga(v).br === br, nome);
  expect(/amb[ií]gua/.test(T.localizacaoVaga({ local: 'Remote' }).motivo) && T.localizacaoVaga({ local: 'Luanda, Angola' }).exterior, 'motivos');
});
await test('estoque: vaga ativa que a coleta mostra fora do Brasil ou ambígua sai da área ativa (histórico preservado)', () => {
  const x = rodar(base, { sf: fonte(ativa(A), ativa(vaga('222', { pais_codigo: 'NO', local: 'Offshore' })), ativa(vaga('333', { pais_codigo: null, local: 'Offshore' }))) });
  const e2 = x.registro['successfactors:222'], e3 = x.registro['successfactors:333'];
  expect(e2.status === 'removida' && /fora do Brasil/.test(e2.motivo_saida) && e2.first_seen_at && e3.status === 'removida' && /ambígua/.test(e3.motivo_saida));
  expect(x.resumo.sf.internacionais === 1 && x.resumo.sf.ambiguas === 1 && x.jobs.length === 1);
});
await test('Subsea7 "Offshore" sem país: bloqueada; entra com filtro país=BR da Subsea7 ou verificação manual', async () => {
  const cfg = (faceta) => cfgBase([
    [/subsea7\.com\/sitemap\.xml/, () => '<loc>https://careers.subsea7.com/job/Offshore-Marinheira-de-Conves/1366277955/</loc><loc>https://careers.subsea7.com/job/Offshore-Operadora-de-Conves/1370000009/</loc>'],
    [/optionsFacetsDD_country=BR/, () => faceta ? '<a data-url="/job/Offshore-Operadora-de-Conves/1370000009/"></a>' : ''],
    [/search\/results\?q=offshore/, () => ''],
    [/\/(1366277955|1370000009)\/$/, (m) => '<span itemprop="title">Vaga ' + m[1] + '</span><span class="jobGeoLocation">Offshore </span> Missão do cargo'],
  ]);
  const sem = await coletar(cfg(false));
  expect(!sem.registro['successfactors:1370000009'] || sem.registro['successfactors:1370000009'].status !== 'ativa', 'ambígua publicada');
  expect(/amb[ií]gua/.test((sem.descartadas['successfactors:1370000009'] || {}).motivo || ''), 'motivo registrado');
  expect(sem.registro['successfactors:1366277955'].status === 'ativa' && sem.registro['successfactors:1366277955'].dados.pais_evidencia === 'verificacao_manual', 'manual');
  const com = await coletar(cfg(true));
  expect(com.registro['successfactors:1370000009'].status === 'ativa' && com.registro['successfactors:1370000009'].dados.pais_evidencia === 'faceta_br', 'filtro BR');
});

console.log('\nVagas — categorias, busca e ordem');
await test('categorias determinísticas (sem diferença de maiúscula/acento); sem regra → Outras', () => {
  const c = (t) => T.categoriaVaga({ titulo: t });
  const casos = [['Piloto ROV', 'subsea'], ['PILOTA(O) DE ROV', 'subsea'], ['Supervisor de ROV', 'subsea'], ['marinheiro', 'conves'], ['Marinheira(o) de Convés', 'conves'], ['Deck Crew', 'conves'],
    ['Deck Pusher', 'perfuracao'], ['DRILLER', 'perfuracao'], ['Assistant Driller', 'perfuracao'], ['Sondador', 'perfuracao'], ['Técnico Mecânico', 'manutencao'], ['MECANICO', 'manutencao'],
    ['Eletricista', 'manutencao'], ['Engenheiro de Projetos', 'engenharia'], ['Técnico de Segurança', 'sms'], ['HSE Advisor', 'sms'], ['Analista de Logística', 'operacoes'],
    ['Analista de RH', 'corporativo'], ['Banco de Talentos Offshore', 'banco'], ['Cozinheiro', 'outras']];
  for (const [titulo, cat] of casos) expect(c(titulo) === cat, titulo + ' → ' + c(titulo));
});
await test('"Todas": empresas intercaladas sem esconder vaga; dentro da empresa nova/prazo primeiro', () => {
  const l = [1, 2, 3, 4, 5].map((i) => vaga('70' + i, { empresa: 'Subsea7', closing_date: '2099-0' + i + '-01' })).concat([vaga('801', { empresa: 'PRIO' }), vaga('802', { empresa: 'Ocyan' }), vaga('803', { empresa: 'PRIO' })]);
  const o = T.intercalarVagasPorEmpresa(l);
  expect(o.length === l.length && new Set(o).size === l.length, 'escondeu/duplicou');
  const seq = o.map((v) => v.empresa);
  expect(seq.slice(0, 3).join() === 'Subsea7,PRIO,Ocyan' && seq[3] === 'Subsea7' && seq[4] === 'PRIO', seq.join());
  const s7 = o.filter((v) => v.empresa === 'Subsea7').map((v) => v.closing_date);
  expect(s7.join() === s7.slice().sort().join(), 'prazo dentro da empresa');
});
await test('/vagas: busca, categorias com contagem real, empresa, ordem; banco fora de "Todas"; card com cargo/empresa/local/prazo', async () => {
  const lista = [vaga('901', { titulo: 'Pilota(o) de ROV' }), vaga('902', { titulo: 'Marinheiro de Convés', empresa: 'Foresea' }), vaga('903', { titulo: 'Banco de Talentos Offshore', empresa: 'Brava Energia', job_type: 'banco de talentos' })];
  const env = kvCom({ versao: 2, jobs: lista, registro: {}, updated_at: new Date().toISOString(), sources: {} });
  T.zerarEstado();
  const h = await T.renderVagasIndex(env, { waitUntil() {} });
  const txt = typeof h === 'string' ? h : await h.text();
  expect(txt.includes('id="vagasBusca"') && /placeholder="Buscar cargo ou empresa"/.test(txt) && txt.includes('id="vagasEmpresa"') && txt.includes('<option value="prazo">Prazo próximo</option>'), 'controles');
  expect(/data-cat="todas"[^>]*>Todas <span>2<\/span>/.test(txt) && /data-cat="subsea"[^>]*>ROV\/Subsea <span>1<\/span>/.test(txt) && /data-cat="banco"[^>]*data-extra/.test(txt), 'chips');
  expect(/<option>Brava Energia<\/option><option>Foresea<\/option><option>Subsea7<\/option>/.test(txt), 'empresas das vagas ativas');
  expect(/no Brasil/.test(txt) && /src="\/js\/vagas\.js\?v=[0-9a-f]{10}"/.test(txt), 'contexto Brasil + script');
  expect(/<h3>Pilota\(o\) de ROV<\/h3><p class="vaga-meta"><strong>Subsea7<\/strong> · Offshore<\/p>/.test(txt) && /Inscrições até/.test(txt), 'card');
});
await test('script estático de /vagas versionado pelo sha256; app recebe categoria (campo novo, formato antigo intacto)', async () => {
  const js = fs.readFileSync(path.join(DIR, '..', 'public', 'js', 'vagas.js'));
  const h = (await import('node:crypto')).createHash('sha256').update(js).digest('hex').slice(0, 10);
  expect(SRC.includes("const VAGAS_JS_VERSAO = '" + h + "';"), 'VAGAS_JS_VERSAO desatualizada (' + h + ')');
  expect(/categoria: categoriaVaga\(v\),/.test(SRC) && /verificado_em: v\.verificado_em \|\| VAGAS_RADAR_VERIFICADO_EM,/.test(SRC), 'API do app');
});

console.log('\n' + pass + ' passaram, ' + fail + ' falharam');
process.exit(fail ? 1 : 0);
