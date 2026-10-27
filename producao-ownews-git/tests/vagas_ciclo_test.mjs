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
  '\nexport const __t = { reconciliarVagas, classificarPaginaSF, classificarPaginaGupy, blocoVagasHome, alertasRadarVagas, chaveVaga, VAGAS_RADAR, vagasAbertasEspecificas, getVagasRadar, refreshVagasRadar, renderVagasIndex, renderVagaDetalhe, slugVaga };\n');
const T = (await import(pathToFileURL(arq).href)).__t;
fs.rmSync(tmp, { recursive: true, force: true });

let pass = 0, fail = 0;
const test = async (nome, fn) => { try { await fn(); pass++; console.log('  ✓ ' + nome); } catch (e) { fail++; console.log('  ✗ ' + nome + '\n      ' + e.message); } };
const expect = (c, m) => { if (!c) throw new Error(m || 'falhou'); };

const vaga = (id, extra) => Object.assign({ titulo: 'Técnico ' + id, empresa: 'Subsea7', local: 'Offshore', plataforma: 'successfactors', external_job_id: id,
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
    if (u.includes('/search/results')) return modo === 'fora' ? resp(503, '') : resp(200, busca);
    const id = (u.match(/\/(\d+)\/$/) || [])[1];
    if (id === '2220002' && modo === 'preenchida') return resp(200, '<p>Sorry, this position has been filled.</p>');
    if (id) return resp(200, '<span itemprop="title">Técnico ' + id + '</span> Job Closing Date: <span>7 Nov 2099</span>');
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

console.log('\n' + pass + ' passaram, ' + fail + ' falharam');
process.exit(fail ? 1 : 0);
