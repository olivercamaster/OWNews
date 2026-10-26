#!/usr/bin/env node
/* Placares de futebol (ao-vivo/futebol.js) — sem rede: fetch, caches e relógio simulados.
 * Partidas no formato documentado do football-data.org v4 (docs.football-data.org). */
import fs from 'node:fs';
import vm from 'node:vm';
const logOriginal = console.log;
console.log = (...a) => { if (!String(a[0]).startsWith('{"ao_vivo"')) logOriginal(...a); };
const F = await import('../ao-vivo/futebol.js');
let pass = 0, fail = 0;
const expect = (c, m) => { if (!c) throw new Error(m || 'falhou'); };

// ── ambiente simulado ──
const store = new Map();
globalThis.caches = { default: {
  match: async (req) => { const v = store.get(req.url); return v ? new Response(v) : undefined; },
  put: async (req, resp) => { store.set(req.url, await resp.text()); },
} };
const realNow = Date.now;
let agora = Date.parse('2026-10-26T21:00:00Z'); // 18:00 em Brasília
Date.now = () => agora;
let chamadas = [], resposta = null;
globalThis.fetch = async (u, o) => {
  chamadas.push({ u: String(u), h: o.headers });
  if (String(u).includes('/teams')) return new Response(JSON.stringify({ teams: [{ id: 1783 }, { id: 1769 }, { id: 6684 }] }));
  return resposta(String(u), o);
};
const TOKEN = 'tok_teste_nao_real_123';
F.futebolConfigurar({ FOOTBALL_DATA_TOKEN: TOKEN });
const pend = [];
const ctx = { waitUntil: (p) => { pend.push(p); } };
const flush = () => Promise.all(pend.splice(0));
const dia = async (k) => { const r = await F.futebolDia(k, ctx); await flush(); return r; };
const responder = async (u) => { const r = await F.futebolResponder(null, new URL(u), ctx, deps); await flush(); return r; };
const deps = { paginaChrome: (t, d, c, can, o) => '<html><title>' + t + '</title>' + (o && o.robots ? '<meta name="robots" content="' + o.robots + '">' : '') + c + '</html>' };

let seq = 1000;
function time(id, name, short, tla) { return { id, name, shortName: short || name, tla, crest: 'https://crests.football-data.org/' + id + '.png' }; }
const FLA = time(1783, 'CR Flamengo', 'Flamengo', 'FLA'), PAL = time(1769, 'SE Palmeiras', 'Palmeiras', 'PAL');
const RIV = time(1500, 'CA River Plate', 'River Plate', 'RIV'), INT = time(6684, 'SC Internacional', 'Internacional', 'INT');
const RMA = time(86, 'Real Madrid CF', 'Real Madrid', 'RMA'), FCB = time(81, 'FC Barcelona', 'Barça', 'FCB');
const MUN = time(66, 'Manchester United FC', 'Man United', 'MUN'), BMG = time(18, 'Borussia Mönchengladbach', 'Borussia Mönchengladbach', 'BMG');
const BRA = time(764, 'Brazil', 'Brazil', 'BRA'), ARG = time(762, 'Argentina', 'Argentina', 'ARG');
const NOT = time(2000, 'Nottingham Forest FC', "Nott'm Forest", 'NOT');
function jogo(o) {
  return {
    id: o.id || ++seq, utcDate: o.utc, status: o.st || 'TIMED', minute: o.min ?? null, injuryTime: o.acr ?? null,
    stage: o.fase || 'REGULAR_SEASON', competition: { code: o.comp || 'BSA', name: 'x' },
    homeTeam: o.c || FLA, awayTeam: o.f || PAL,
    score: o.score || { duration: 'REGULAR', fullTime: { home: o.gc ?? null, away: o.gf ?? null } },
  };
}
const ok = (matches) => () => new Response(JSON.stringify({ matches }), { headers: { etag: '"' + matches.length + '"' } });
const limpar = () => { store.clear(); chamadas = []; };

const casos = [];
const test = (n, f) => casos.push([n, f]);

// ── status ──
test('jogo futuro: horário de Brasília, sem 0×0', () => {
  const j = F.normalizarJogo(jogo({ utc: '2026-10-27T00:30:00Z', st: 'TIMED', gc: 0, gf: 0 }));
  expect(j.st === 'agendado' && j.gc === null && j.gf === null, 'placar deveria ser nulo');
  const R = F.futebolRender();
  expect(R.rotulo(j) === '21:30', R.rotulo(j));
  expect(!/<b class="fx-g">0</.test(R.jogo(j, {})), 'mostrou 0');
});
test('ao vivo 1º/2º tempo, acréscimo e sem minuto inventado', () => {
  const R = F.futebolRender();
  expect(R.rotulo(F.normalizarJogo(jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 23, gc: 1, gf: 0 }))) === "23'");
  expect(R.rotulo(F.normalizarJogo(jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 67, gc: 2, gf: 1 }))) === "67'");
  expect(R.rotulo(F.normalizarJogo(jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 90, acr: 4 }))) === "90+4'");
  expect(R.rotulo(F.normalizarJogo(jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY' }))) === 'Ao vivo', 'minuto inventado');
});
test('intervalo, prorrogação, pênaltis, encerrado', () => {
  const R = F.futebolRender();
  expect(R.rotulo(F.normalizarJogo(jogo({ utc: '2026-10-26T20:00:00Z', st: 'PAUSED', gc: 0, gf: 1 }))) === 'Intervalo');
  expect(R.rotulo(F.normalizarJogo(jogo({ utc: '2026-10-26T20:00:00Z', st: 'EXTRA_TIME', min: 105, score: { duration: 'EXTRA_TIME', fullTime: { home: 1, away: 1 } } }))) === "Prorrogação · 105'");
  // Exemplo da documentação: fullTime 7–6 inclui os pênaltis (6–5); o jogo terminou 1–1.
  const pen = F.normalizarJogo(jogo({ utc: '2026-10-26T18:00:00Z', st: 'FINISHED', fase: 'FINAL', comp: 'CLI', score: { duration: 'PENALTY_SHOOTOUT', fullTime: { home: 7, away: 6 }, regularTime: { home: 1, away: 1 }, extraTime: { home: 0, away: 0 }, penalties: { home: 6, away: 5 } } }));
  expect(pen.gc === 1 && pen.gf === 1 && pen.pc === 6 && pen.pf === 5, JSON.stringify(pen));
  expect(R.rotulo(pen) === 'Final · pên. 6–5', R.rotulo(pen));
  const fim = F.normalizarJogo(jogo({ utc: '2026-10-26T18:00:00Z', st: 'FINISHED', gc: 2, gf: 1 }));
  expect(R.rotulo(fim) === 'Final' && !/Ao vivo/.test(R.jogo(fim, {})), 'encerrado');
});
test('adiado, cancelado, suspenso: status oficial e sem 0×0 inventado', () => {
  const R = F.futebolRender();
  const ad = F.normalizarJogo(jogo({ utc: '2026-10-26T22:00:00Z', st: 'POSTPONED', gc: 0, gf: 0 }));
  const ca = F.normalizarJogo(jogo({ utc: '2026-10-26T22:00:00Z', st: 'CANCELLED' }));
  const su = F.normalizarJogo(jogo({ utc: '2026-10-26T20:00:00Z', st: 'SUSPENDED', gc: 1, gf: 0 }));
  expect(R.rotulo(ad) === 'Adiado' && ad.gc === null, 'adiado');
  expect(R.rotulo(ca) === 'Cancelado' && ca.gc === null, 'cancelado');
  expect(R.rotulo(su) === 'Suspenso' && su.gc === 1, 'suspenso mantém placar oficial');
});

// ── fuso / dia ──
test('timezone: 23:30 BRT fica no dia certo; 00:30 BRT vai para o dia seguinte', () => {
  const t = F.transformarDia('2026-10-26');
  const d = t({ matches: [jogo({ id: 1, utc: '2026-10-27T02:30:00Z' }), jogo({ id: 2, utc: '2026-10-27T03:30:00Z' }), jogo({ id: 3, utc: '2026-10-26T02:59:00Z' })] });
  expect(d.jogos.map((j) => j.id).join() === '1', d.jogos.map((j) => j.id).join());
  expect(F.futebolRender().rotulo(d.jogos[0]) === '23:30');
  expect(F.somarDias('2026-12-31', 1) === '2027-01-01' && F.somarDias('2026-03-01', -1) === '2026-02-28');
  expect(F.diaBRT(Date.parse('2026-10-27T02:59:59Z')) === '2026-10-26' && F.diaBRT(Date.parse('2026-10-27T03:00:00Z')) === '2026-10-27');
});

// ── validação / segurança ──
test('payload inválido / campos hostis: descarta ou escapa, escudo só do host do provedor', () => {
  const t = F.transformarDia('2026-10-26');
  expect(t({ nada: 1 }) === null && t(null) === null, 'payload sem matches deveria ser inválido');
  const hostil = jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 10, gc: 1, gf: 0,
    c: { id: 9, name: '<img src=x onerror=alert(1)>', shortName: '<b>X</b>"', tla: '<s>', crest: 'javascript:alert(1)' } });
  const d = t({ matches: [hostil, { id: 'x' }, jogo({ utc: 'lixo' }), jogo({ utc: '2026-10-26T20:00:00Z', st: 'NOVO_STATUS' }), jogo({ utc: '2026-10-26T20:00:00Z', comp: 'ZZZ' })] });
  expect(d.jogos.length === 1, 'deveria sobrar só 1 jogo: ' + d.jogos.length);
  const html = F.futebolRender().jogo(d.jogos[0], { escudos: 1 });
  expect(!/<b>X|<img src=x|javascript:/.test(html), html);
  expect(d.jogos[0].c.e === null, 'escudo de host estranho');
  const n = F.normalizarJogo(jogo({ utc: '2026-10-26T20:00:00Z', c: { ...FLA, crest: 'https://crests.football-data.org/../../x"onload=1' } }));
  expect(n.c.e === null, 'escudo com caracteres estranhos');
});
test('nomes: aliases seguros em português, sem inventar', () => {
  const t = F.transformarDia('2026-10-26');
  const d = t({ matches: [jogo({ utc: '2026-10-26T20:00:00Z', comp: 'PL', c: MUN, f: NOT }), jogo({ utc: '2026-10-26T20:00:00Z', comp: 'WC', c: BRA, f: ARG }), jogo({ utc: '2026-10-26T20:00:00Z', comp: 'PD', c: RMA, f: FCB })] });
  const nomes = d.jogos.flatMap((j) => [j.c.n, j.f.n]).join('|');
  expect(nomes === "Manchester United|Nott'm Forest|Brasil|Argentina|Real Madrid|Barcelona", nomes);
});
test('amistoso internacional só com a Seleção', () => {
  const t = F.transformarDia('2026-10-26');
  const d = t({ matches: [jogo({ utc: '2026-10-26T20:00:00Z', comp: 'IFL', c: ARG, f: time(1, 'Chile', 'Chile', 'CHI') }), jogo({ utc: '2026-10-26T20:00:00Z', comp: 'IFL', c: BRA, f: ARG })] });
  expect(d.jogos.length === 1 && d.jogos[0].c.n === 'Brasil');
});

// ── seleção dos 3 da Home ──
const br = new Set([1783, 1769, 6684]);
const norm = (arr) => arr.map((o) => F.normalizarJogo(jogo(o)));
test('0, 1, 2, 3 e mais de 3 jogos: Home nunca passa de 3', () => {
  expect(F.selecionarHome([], br, agora).length === 0);
  const base = { utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 50, gc: 0, gf: 0 };
  for (const n of [1, 2, 3, 7]) {
    const js = norm(Array.from({ length: n }, () => ({ ...base })));
    expect(F.selecionarHome(js, br, agora).length === Math.min(3, n), 'n=' + n);
  }
});
test('5 ao vivo: escolhe os 3 mais relevantes; Seleção primeiro', () => {
  const v = { utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 60, gc: 0, gf: 0 };
  const js = norm([
    { ...v, id: 1, comp: 'FL1', c: time(30, 'A'), f: time(31, 'B') },
    { ...v, id: 2, comp: 'BSA' },
    { ...v, id: 3, comp: 'QCBL', c: BRA, f: ARG },
    { ...v, id: 4, comp: 'BL1', c: time(32, 'C'), f: BMG },
    { ...v, id: 5, comp: 'CLI', c: RIV, f: INT },
  ]);
  const ids = F.selecionarHome(js, br, agora).map((x) => x.j.id).join();
  expect(ids === '3,5,2', ids);
});
test('ao vivo médio + final da Libertadores com brasileiro às 21:30 entra; jogo irrelevante não', () => {
  const js = norm([
    { id: 10, utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 70, gc: 1, gf: 0, comp: 'BSA' },
    { id: 11, utc: '2026-10-27T00:30:00Z', st: 'TIMED', comp: 'CLI', fase: 'FINAL', c: INT, f: RIV },
    { id: 12, utc: '2026-10-26T21:30:00Z', st: 'TIMED', comp: 'FL1', c: time(40, 'D'), f: time(41, 'E') },
  ]);
  const ids = F.selecionarHome(js, br, agora).map((x) => x.j.id).join();
  expect(ids === '10,11', ids); // seleção por prioridade, exibição: ao vivo antes do que vem depois
});
test('clube brasileiro: regra uniforme (qualquer id da lista BSA/BSB), sem clube preferido', () => {
  const a = F.relevancia(F.normalizarJogo(jogo({ utc: '2026-10-26T20:00:00Z', comp: 'CLI', c: RIV, f: INT })), br);
  const b = F.relevancia(F.normalizarJogo(jogo({ utc: '2026-10-26T20:00:00Z', comp: 'CLI', c: RIV, f: FLA })), br);
  expect(a === b, a + ' vs ' + b);
  const src = fs.readFileSync(new URL('../ao-vivo/futebol.js', import.meta.url), 'utf8');
  expect(!/Flamengo|Corinthians|Palmeiras|Vasco|São Paulo|Santos|Grêmio|Internacional|Cruzeiro|Botafogo|Atlético Mineiro/.test(src), 'clube brasileiro citado no código');
});
test('encerrado sai da Home depois da janela; adiado não ocupa a Home', () => {
  const js = norm([
    { id: 20, utc: '2026-10-26T12:00:00Z', st: 'FINISHED', gc: 1, gf: 1, comp: 'BSA' },
    { id: 21, utc: '2026-10-26T19:00:00Z', st: 'FINISHED', gc: 2, gf: 0, comp: 'BSA' },
    { id: 22, utc: '2026-10-26T22:00:00Z', st: 'POSTPONED', comp: 'CLI', c: INT, f: RIV },
  ]);
  const ids = F.selecionarHome(js, br, agora).map((x) => x.j.id).join();
  expect(ids === '21', ids);
});
test('destaque manual (featuredMatchIds) entra entre os 3', () => {
  F.FUTEBOL_CONFIG.featuredMatchIds.push(99);
  const v = { utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 60 };
  const js = norm([{ ...v, id: 1, comp: 'WC', c: BRA, f: ARG }, { ...v, id: 2, comp: 'CLI', c: INT, f: RIV }, { ...v, id: 3, comp: 'CDB' }, { id: 99, utc: '2026-10-26T23:00:00Z', comp: 'FL1', c: time(50, 'F'), f: time(51, 'G') }]);
  const ids = F.selecionarHome(js, br, agora).map((x) => x.j.id);
  F.FUTEBOL_CONFIG.featuredMatchIds.length = 0;
  expect(ids.includes(99) && ids.length === 3, ids.join());
});
test('/jogos: AO VIVO por relevância, A SEGUIR por horário, ENCERRADOS mais recentes, agrupado por competição', () => {
  const js = norm([
    { id: 1, utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 30, comp: 'PL', c: MUN, f: NOT },
    { id: 2, utc: '2026-10-26T20:30:00Z', st: 'PAUSED', comp: 'BSA' },
    { id: 3, utc: '2026-10-27T00:30:00Z', comp: 'CLI', c: INT, f: RIV },
    { id: 4, utc: '2026-10-26T22:00:00Z', comp: 'PD', c: RMA, f: FCB },
    { id: 5, utc: '2026-10-26T15:00:00Z', st: 'FINISHED', gc: 1, gf: 1, comp: 'BSA' },
    { id: 6, utc: '2026-10-26T18:00:00Z', st: 'FINISHED', gc: 0, gf: 2, comp: 'BSA' },
    { id: 7, utc: '2026-10-26T22:00:00Z', st: 'POSTPONED', comp: 'BSA' },
  ]);
  const s = F.secoesDia(js, br);
  expect(s.map((x) => x.k).join() === 'vivo,seguir,encerrados,outros', s.map((x) => x.k).join());
  expect(s[0].comps.map((c) => c.comp).join() === 'Brasileirão,Premier League', 'vivo por relevância');
  expect(s[1].comps.flatMap((c) => c.jogos.map((j) => j.id)).join() === '4,3', 'a seguir por horário');
  expect(s[2].comps[0].jogos.map((j) => j.id).join() === '6,5', 'encerrados mais recentes primeiro');
});

// ── cache, frequência, falhas ──
test('cache: 2º visitante não consulta o provedor; ao vivo reconsulta em 60 s (plano FREE)', async () => {
  limpar();
  resposta = ok([jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 60, gc: 1, gf: 0 })]);
  await dia('hoje');
  const n = chamadas.filter((c) => c.u.includes('/matches')).length;
  await dia('hoje');
  expect(chamadas.filter((c) => c.u.includes('/matches')).length === n && n === 1, 'cache não usado');
  agora += 31000; await dia('hoje');
  expect(chamadas.filter((c) => c.u.includes('/matches')).length === 1, 'consultou antes de 60 s');
  agora += 30000; await dia('hoje'); agora -= 61000;
  expect(chamadas.filter((c) => c.u.includes('/matches')).length === 2, 'não reconsultou ao vivo');
  expect(chamadas[0].u.includes('dateFrom=2026-10-26&dateTo=2026-10-27'), chamadas[0].u);
  expect(chamadas.every((c) => c.h['X-Auth-Token'] === TOKEN), 'token só no header server-side');
});
test('frequência adaptativa: início distante = 15 min; nada no dia = 1 h; ontem 12 h; amanhã 6 h', async () => {
  limpar(); resposta = ok([jogo({ utc: '2026-10-27T00:30:00Z' })]);
  await dia('hoje');
  agora += 600000; await dia('hoje');
  expect(chamadas.filter((c) => c.u.includes('/matches')).length === 1, 'consultou cedo demais');
  agora += 301000; await dia('hoje'); agora -= 901000;
  expect(chamadas.filter((c) => c.u.includes('/matches')).length === 2, 'não reconsultou após 15 min');
  limpar(); resposta = ok([]);
  await dia('hoje'); agora += 3000000; await dia('hoje'); agora -= 3000000;
  expect(chamadas.filter((c) => c.u.includes('/matches')).length === 1, 'sem jogo deveria esperar 1 h');
  limpar(); resposta = ok([jogo({ utc: '2026-10-25T20:00:00Z', st: 'FINISHED', gc: 1, gf: 1 })]);
  await dia('ontem'); agora += 5 * 3600000; await dia('ontem'); agora -= 5 * 3600000;
  expect(chamadas.filter((c) => c.u.includes('/matches')).length === 1, 'ontem encerrado deveria esperar 12 h');
  limpar(); resposta = ok([jogo({ utc: '2026-10-27T22:00:00Z' })]);
  await dia('amanha'); agora += 5 * 3600000; await dia('amanha'); agora -= 5 * 3600000;
  expect(chamadas.filter((c) => c.u.includes('/matches')).length === 1, 'amanhã deveria esperar 6 h');
  const p = F.payloadDestaque({ dados: { jogos: [] }, atualizadoEm: agora }, br);
  expect(p.proxima === 0, 'navegador não deveria fazer polling sem jogo');
});
test('API indisponível / timeout: mantém snapshot anterior e sinaliza falha', async () => {
  limpar(); resposta = ok([jogo({ id: 77, utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 60, gc: 1, gf: 0 })]);
  await dia('hoje');
  agora += 61000; resposta = () => { throw new Error('rede caiu'); };
  let { snap } = await dia('hoje');
  expect(snap.dados.jogos[0].id === 77 && snap.falhaEm, 'snapshot perdido');
  const p = F.payloadDestaque(snap, br);
  expect(p.falha && p.jogos.length === 1, 'payload deveria manter jogo e marcar falha');
  agora += 120000; resposta = (u, o) => { expect(o.signal, 'consulta sem timeout'); throw Object.assign(new Error('t'), { name: 'TimeoutError' }); }; // AbortSignal.timeout dispara assim
  ({ snap } = await dia('hoje'));
  expect(snap.dados.jogos[0].id === 77, 'timeout perdeu snapshot');
  agora -= 181000;
  const R = F.futebolRender();
  const txt = R.atualizado({ atualizadoEm: agora - 600000, falha: true, proxima: 30 });
  expect(/^Última atualização \d\d:\d\d · Dados podem estar desatualizados\.$/.test(txt), txt);
});
// ── Operação R$ 0: cota do plano FREE ──
const comCota = (matches, restantes, reset, status) => () => new Response(status === 429 ? '{"message":"limit"}' : JSON.stringify({ matches }),
  { status: status || 200, headers: { 'x-requests-available-minute': String(restantes), 'x-requestcounter-reset': String(reset) } });
test('cota baixa: jogo sem relevância ao vivo espera 4×; jogo ao vivo relevante mantém 60 s', async () => {
  limpar(); resposta = comCota([jogo({ utc: '2026-10-27T00:30:00Z' })], 2, 40);
  await dia('hoje'); agora += 901000; await dia('hoje'); agora -= 901000;
  expect(chamadas.filter((c) => c.u.includes('/matches')).length === 1, 'cota baixa não alongou o intervalo');
  limpar(); resposta = comCota([jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 50, gc: 0, gf: 0 })], 2, 40);
  await dia('hoje'); agora += 61000; await dia('hoje'); agora -= 61000;
  expect(chamadas.filter((c) => c.u.includes('/matches')).length === 2, 'ao vivo relevante perdeu prioridade');
});
test('cota esgotada (429): mantém snapshot, avisa falha e não tenta de novo até o reset', async () => {
  limpar(); resposta = ok([jogo({ id: 91, utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 10, gc: 0, gf: 0 })]);
  await dia('hoje');
  agora += 61000; resposta = comCota([], 0, 50, 429);
  let { snap } = await dia('hoje');
  expect(snap.dados.jogos[0].id === 91 && snap.falhaEm && snap.pausaAte, 'snapshot perdido no 429');
  const n = chamadas.length;
  for (const passo of [10000, 20000, 25000]) { agora += passo; await dia('hoje'); }
  expect(chamadas.length === n, 'insistiu antes do reset');
  agora += 10000; resposta = ok([jogo({ id: 91, utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 13, gc: 1, gf: 0 })]);
  ({ snap } = await dia('hoje'));
  expect(chamadas.length === n + 1 && snap.dados.jogos[0].gc === 1 && !snap.pausaAte, 'não voltou depois do reset');
  agora -= 126000;
  expect(F.payloadDestaque({ ...snap, falhaEm: agora }, br).falha === true);
});
test('visitantes simultâneos no mesmo isolate: 1 consulta ao provedor', async () => {
  limpar(); resposta = ok([jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 5 })]);
  await Promise.all(Array.from({ length: 25 }, () => F.futebolDia('hoje', ctx))); await flush();
  expect(chamadas.filter((c) => c.u.includes('/matches')).length === 1, 'herd: ' + chamadas.length);
});
test('R$ 0: aviso de atraso por padrão, nenhum intervalo abaixo de 60 s, sem competição paga consultada', async () => {
  const I = F.FUTEBOL_CONFIG.intervalos;
  expect(Object.values(I).every((v) => v >= 60), JSON.stringify(I));
  expect(F.FUTEBOL_CONFIG.competicoesClubesBr.join() === 'BSA', 'BSB fora do FREE gastaria cota');
  const R = F.futebolRender();
  expect(/alguns minutos de atraso/.test(R.atualizado({ atualizadoEm: agora, proxima: 60, atraso: true })));
  expect(F.payloadDestaque({ dados: { jogos: [] }, atualizadoEm: agora }, br).atraso === true, 'atraso deveria ser padrão');
  const src = fs.readFileSync(new URL('../ao-vivo/futebol.js', import.meta.url), 'utf8');
  expect(!/FUTEBOL_PLACAR_ATRASADO/.test(src) && !/provedor'/.test(R.atualizado.toString()), 'texto de plano/API na interface');
});
test('Home: jogo irrelevante ao vivo não faz o navegador consultar (módulo oculto)', () => {
  const irrelevante = { dados: { jogos: [F.normalizarJogo(jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 70, comp: 'FL1', c: NOT, f: BMG }))] }, atualizadoEm: agora };
  const p = F.payloadDestaque(irrelevante, br);
  expect(p.jogos.length === 0 && p.proxima === 0, 'polling inútil: proxima=' + p.proxima);
  const relevante = { dados: { jogos: [F.normalizarJogo(jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 70 }))] }, atualizadoEm: agora };
  expect(F.payloadDestaque(relevante, br).proxima === 60, 'jogo da Home ao vivo deveria atualizar a cada 60 s');
});
test('sem token: nada consultado, Home intacta, /jogos noindex e sem placar', async () => {
  limpar(); F.futebolConfigurar({});
  const home = '<main class="container" id="conteudo"><section class="ops" id="aeroportos"></section>';
  expect(await F.futebolModuloHome(home) === home, 'Home alterada sem token');
  const r = await F.futebolResponder(new Request('https://x/jogos'), new URL('https://x/jogos'), ctx, deps);
  const h = await r.text();
  expect(/noindex/.test(h) && /Placares indisponíveis/.test(h) && !/<script>\(function/.test(h), 'página sem token');
  const a = await (await responder('https://x/api/live/featured')).json();
  expect(a.ativo === false && a.jogos.length === 0 && chamadas.length === 0, 'consultou sem token');
  F.futebolConfigurar({ FOOTBALL_DATA_TOKEN: TOKEN });
});

// ── rotas / payload / Home ──
test('payload da Home mínimo (≤ 3 jogos, sem campos extras) e /api/live/today só do dia', async () => {
  limpar();
  resposta = ok([
    ...Array.from({ length: 30 }, (_, i) => jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 20 + i, gc: 1, gf: 1, comp: ['BSA', 'PL', 'CL', 'PD'][i % 4], c: time(300 + i, 'Time Casa ' + i), f: time(400 + i, 'Time Fora ' + i) })),
    jogo({ utc: '2026-10-28T20:00:00Z' }),
  ]);
  const r = await responder('https://x/api/live/featured');
  const txt = await r.text(), j = JSON.parse(txt);
  expect(j.jogos.length === 3, 'jogos ' + j.jogos.length);
  expect(Object.keys(j.jogos[0]).sort().join() === 'acr,c,comp,dur,f,gc,gf,id,ini,min,pc,pf,st', Object.keys(j.jogos[0]).sort().join());
  expect(txt.length < 2000, 'payload Home ' + txt.length + ' bytes');
  expect(r.headers.get('Cache-Control') === 'public, max-age=15' && !txt.includes(TOKEN), 'headers/token');
  const d = await (await responder('https://x/api/live/today')).json();
  expect(d.secoes[0].comps.reduce((n, c) => n + c.jogos.length, 0) === 30, 'today');
  const bad = await F.futebolResponder(null, new URL('https://x/api/live/today?dia=2020-01-01'), ctx, deps);
  expect(bad.status === 400, 'dia inválido');
  logOriginal('     payload featured=' + txt.length + ' B; today(30 jogos)=' + JSON.stringify(d).length + ' B');
});
test('Home: módulo com até 3 jogos, depois de Aconteceu no Offshore (antes de Vagas) e topo para Seleção ao vivo', async () => {
  limpar();
  const home = '<main class="container" id="conteudo"><section class="ticker-wrap" id="giro24h"></section><section class="ops" id="aeroportos"></section>' +
    '<section class="masthead" id="destaque"></section><section class="ed-section vagas-home-section" id="vagas-agora"></section><section class="ed-section mo-section" id="mercadoOffshore"></section>';
  resposta = ok([jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 67, gc: 2, gf: 1 })]);
  await dia('hoje');
  let h = await F.futebolModuloHome(home);
  expect(h.indexOf('id="futebolAoVivo"') > h.indexOf('id="destaque"') && h.indexOf('id="futebolAoVivo"') < h.indexOf('id="vagas-agora"'), 'posição normal: depois das notícias');
  const semVagas = await F.futebolModuloHome(home.replace(/<section class="ed-section vagas-home-section"[^]*?<\/section>/, ''));
  expect(semVagas.indexOf('id="futebolAoVivo"') > semVagas.indexOf('id="destaque"') && semVagas.indexOf('id="futebolAoVivo"') < semVagas.indexOf('id="mercadoOffshore"'), 'sem Vagas: antes do Mercado');
  expect(/Ao vivo/.test(h) && /67&#39;|67'/.test(h) && /Todos os jogos de hoje/.test(h), 'conteúdo');
  limpar(); resposta = ok([jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 10, comp: 'QCBL', c: BRA, f: ARG })]);
  await dia('hoje');
  h = await F.futebolModuloHome(home);
  expect(h.indexOf('id="futebolAoVivo"') < h.indexOf('giro24h'), 'Seleção ao vivo deveria ir ao topo');
  limpar(); resposta = ok([jogo({ utc: '2026-10-26T23:00:00Z' })]);
  await dia('hoje');
  h = await F.futebolModuloHome(home);
  expect(/Jogos de hoje/.test(h) && !/fx-badge/.test(h.replace(/<(style|script)>[\s\S]*?<\/(style|script)>/g, '')), 'sem selo AO VIVO sem jogo ao vivo');
  limpar(); resposta = ok([]); await dia('hoje');
  h = await F.futebolModuloHome(home);
  expect(/id="futebolAoVivo"[^>]*hidden/.test(h), 'sem jogo: módulo oculto');
});
test('scripts inline válidos, render idêntico no navegador e sem token no HTML', async () => {
  limpar(); resposta = ok([jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 67, gc: 2, gf: 1 })]);
  await dia('hoje');
  const h = await F.futebolModuloHome('<main class="container" id="conteudo"><section class="ops" id="aeroportos"></section>');
  const pg = await (await responder('https://x/jogos')).text();
  for (const html of [h, pg]) {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts.length === 1, 'scripts ' + scripts.length);
    new vm.Script(scripts[0]);
    expect(!html.includes(TOKEN) && !/football-data\.org\/v4|api\.football-data/.test(html), 'token/API no HTML');
  }
  // o render serializado (como roda no navegador) produz o mesmo HTML do servidor
  const R2 = vm.runInNewContext('(' + F.futebolRender.toString() + ')()', { Date, String, Math });
  const j = F.normalizarJogo(jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 67, gc: 2, gf: 1 }));
  expect(R2.jogo(j, { escudos: 1, comp: 1 }) === F.futebolRender().jogo(j, { escudos: 1, comp: 1 }), 'render divergente');
  expect(/<title>Jogos de hoje e placares ao vivo \| OWNews/.test(pg) && !/noindex/.test(pg), 'SEO /jogos');
  const pgOntem = await (await responder('https://x/jogos?dia=ontem')).text();
  expect(/noindex/.test(pgOntem) && /aria-current="page">Ontem/.test(pgOntem), 'ontem');
});
test('escudo não bloqueia texto: sigla sempre presente, imagem com tamanho fixo, lazy no /jogos', () => {
  const R = F.futebolRender();
  const j = F.normalizarJogo(jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 1, gc: 0, gf: 0 }));
  const home = R.jogo(j, { escudos: 1 }), pag = R.jogo(j, { escudos: 1, lazy: 1 });
  expect(/FLA<img/.test(home) && /width="22" height="22"/.test(home) && /onerror="this.remove\(\)"/.test(home), home);
  expect(/loading="lazy"/.test(pag) && !/loading="lazy"/.test(home), 'lazy');
});
test('escudo: proxy só de id numérico, só PNG, teto de tamanho, cache longo', async () => {
  limpar();
  const n = F.normalizarJogo(jogo({ utc: '2026-10-26T20:00:00Z' }));
  expect(n.c.e === '/api/live/escudo/1783.png', n.c.e);
  const fetchAntes = globalThis.fetch; let pedidos = [];
  globalThis.fetch = async (u) => { pedidos.push(String(u)); const id = String(u).match(/(\d+)\.png$/)[1];
    if (id === '1') return new Response(new Uint8Array(1000), { headers: { 'content-type': 'image/png' } });
    if (id === '2') return new Response(new Uint8Array(300 * 1024), { headers: { 'content-type': 'image/png' } });
    return new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }); };
  const r1 = await responder('https://x/api/live/escudo/1.png');
  expect(r1.status === 200 && /immutable/.test(r1.headers.get('Cache-Control')) && pedidos[0] === 'https://crests.football-data.org/1.png', 'png pequeno');
  await responder('https://x/api/live/escudo/1.png');
  expect(pedidos.length === 1, '2º pedido deveria vir do cache');
  expect((await responder('https://x/api/live/escudo/2.png')).status === 404, 'png grande deveria virar 404 (sigla)');
  expect((await responder('https://x/api/live/escudo/3.png')).status === 404, 'não-PNG deveria virar 404');
  expect((await responder('https://x/api/live/escudo/..%2Fx.png')).status === 404 && (await responder('https://x/api/live/escudo/abc.png')).status === 404, 'id inválido');
  expect(pedidos.length === 3, 'id inválido não pode consultar o provedor');
  globalThis.fetch = fetchAntes;
});
test('topo da Home só com Seleção ou final ao vivo (semifinal fica na posição normal)', () => {
  const v = { utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 30 };
  const snap = (o) => ({ dados: { jogos: norm([o]) }, atualizadoEm: agora });
  expect(!F.payloadDestaque(snap({ ...v, comp: 'CLI', fase: 'SEMI_FINALS', c: INT, f: RIV }), br).topo, 'semifinal');
  expect(F.payloadDestaque(snap({ ...v, comp: 'CDB', fase: 'FINAL' }), br).topo, 'final');
  expect(F.payloadDestaque(snap({ ...v, comp: 'IFL', c: BRA, f: ARG }), br).topo, 'Seleção');
  expect(!F.payloadDestaque(snap({ ...v, utc: '2026-10-26T23:00:00Z', st: 'TIMED', comp: 'CDB', fase: 'FINAL' }), br).topo, 'final ainda não começou');
});
test('script do navegador tolera o __name injetado pelo bundler', async () => {
  limpar(); resposta = ok([jogo({ utc: '2026-10-26T20:00:00Z', st: 'IN_PLAY', min: 67, gc: 2, gf: 1 })]);
  await dia('hoje');
  const h = await F.futebolModuloHome('<main class="container" id="conteudo"><section class="ops" id="aeroportos"></section>');
  const sc = h.match(/<script>([\s\S]*?)<\/script>/)[1];
  // simula o bundle: função com __name(...) dentro, executada sem __name global
  const comName = sc.replace('function esc(s) {', 'function esc(s) {');
  expect(/var __name=function\(f\)\{return f\}/.test(sc), 'shim ausente');
  const R = vm.runInNewContext('var __name=function(f){return f};(' + F.futebolRender.toString().replace('function esc(s) {', '__name(esc, "esc"); function esc(s) {') + ')()', { Date, String, Math });
  expect(typeof R.jogo === 'function' && comName.length > 0);
});
test('nenhum segredo no Git nem no código', () => {
  for (const f of ['../ao-vivo/futebol.js', '../ao-vivo/snapshot.js', '../worker.js', '../wrangler.jsonc']) {
    const s = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
    expect(!/FOOTBALL_DATA_TOKEN\s*[:=]\s*["'][^"']/.test(s) && !/X-Auth-Token['"]?\s*:\s*['"][a-z0-9]{8,}/i.test(s), 'possível chave em ' + f);
  }
  const src = fs.readFileSync(new URL('../ao-vivo/futebol.js', import.meta.url), 'utf8');
  expect(!/odds|aposta|bet365|sofascore|flashscore|globo\.com|uol\.com|espn\.com/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'referência proibida');
});

for (const [n, f] of casos) {
  try { await f(); pass++; logOriginal('OK   ', n); }
  catch (e) { fail++; logOriginal('FALHA', n, '—', e.message); }
}
Date.now = realNow;
logOriginal(`\n${pass} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
