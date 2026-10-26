/* OWNews AO VIVO — Placares de futebol (serviço de consulta rápida).
 *
 * Só placar, status e horário. Sem notícias, odds ou apostas.
 * Fluxo: football-data.org (v4) → snapshot no Cache API do PoP (ao-vivo/snapshot.js)
 * → JSON mínimo (/api/live/featured, /api/live/today) e HTML pronto (Home, /jogos).
 * O navegador nunca fala com o provedor; o token é secret do Worker
 * (FOOTBALL_DATA_TOKEN). Sem token, nada aparece e nada é consultado.
 *
 * Operação R$ 0 (decisão do proprietário, 26/10/2026): plano FREE do
 * football-data.org — 12 competições, placar com alguns minutos de atraso,
 * 10 requisições/min por chave, sem cartão. Nada de plano pago. O cadenciamento
 * abaixo cabe na cota mesmo com vários PoPs; cota baixa/429 → ver snapshot.js.
 */
import { buscarSnapshot, lerSnapshot } from './snapshot.js';

// ─── Configuração central (pesos, competições, destaques) ────────────────
export const FUTEBOL_CONFIG = {
  api: 'https://api.football-data.org/v4',
  atribuicao: 'Football data provided by the Football-Data.org API',
  escudos: true,
  // Escudos passam pelo OWNews (/api/live/escudo/<id>.png): só PNG do host do
  // provedor, até escudoMaxBytes (SVGs chegam a ~300 KB), cache de 30 dias.
  escudoMaxBytes: 24 * 1024,
  homeMax: 3,
  // competitionsEnabled + competitionWeight. Códigos do football-data.org
  // (validados em /v4/competitions). Só aparece o que o plano cobre — no FREE:
  // BSA, CL, PL, PD, SA, BL1, FL1, WC, EC (e ELC, DED, PPL, fora desta lista).
  // As demais ficam configuradas, sem custo, para o dia em que houver fonte gratuita.
  // soComBrasil: a competição só entra quando a Seleção joga.
  competicoes: {
    WC: { nome: 'Copa do Mundo', peso: 90 },
    WCF: { nome: 'Copa do Mundo Feminina', peso: 60 },
    CA: { nome: 'Copa América', peso: 80 },
    QCBL: { nome: 'Eliminatórias', peso: 75 },
    FCWC: { nome: 'Mundial de Clubes', peso: 70 },
    CLI: { nome: 'Libertadores', peso: 70 },
    CDB: { nome: 'Copa do Brasil', peso: 66 },
    BSA: { nome: 'Brasileirão', peso: 64, nacional: true },
    CL: { nome: 'Champions League', peso: 52 },
    CS: { nome: 'Sul-Americana', peso: 50 },
    EC: { nome: 'Eurocopa', peso: 50 },
    PL: { nome: 'Premier League', peso: 34 },
    BSB: { nome: 'Série B', peso: 30, nacional: true },
    EL: { nome: 'Europa League', peso: 30 },
    PD: { nome: 'La Liga', peso: 30 },
    SA: { nome: 'Campeonato Italiano', peso: 26 },
    BL1: { nome: 'Bundesliga', peso: 24 },
    FL1: { nome: 'Ligue 1', peso: 20 },
    UCL: { nome: 'Conference League', peso: 15 },
    IFL: { nome: 'Amistoso internacional', peso: 20, soComBrasil: true },
  },
  pesos: {
    nationalTeamBoost: 60,     // Seleção Brasileira (masculina ou feminina)
    brazilianTeamBoost: 30,    // clube brasileiro fora de competição nacional
    finalBoost: 50,
    semifinalBoost: 25,
    quarterBoost: 10,
    classicoBoost: 20,
    liveBoost: 100,
    upcomingImportantBoost: 40,
    finishedRecentBoost: 20,
  },
  // teamBoost por id do provedor (vale igual para qualquer competição).
  // Grandes clubes internacionais: nomes só como referência de validação.
  teamBoost: {
    86: 12, /* Real Madrid */ 81: 12, /* Barcelona */ 64: 12, /* Liverpool */
    65: 12, /* Manchester City */ 66: 10, /* Manchester United */ 57: 10, /* Arsenal */
    61: 8, /* Chelsea */ 5: 12, /* Bayern */ 4: 8, /* Dortmund */ 108: 10, /* Inter */
    98: 10, /* Milan */ 109: 8, /* Juventus */ 524: 10, /* PSG */ 78: 8, /* Atlético de Madrid */
  },
  classicos: [],            // pares [idA, idB] — clássico identificável por configuração
  featuredMatchIds: [],     // destaque editorial manual: entra entre os 3 da Home
  relevanciaMinimaHome: 30, // abaixo disso o jogo nunca vai para a Home
  topoFases: ['FINAL'],     // ao vivo com Seleção ou nestas fases sobe para o topo da Home
  selecao: ['Brazil'],
  // Competições de onde vem a lista de clubes brasileiros (regra uniforme).
  // (BSB não está no plano FREE: consultá-la gastaria cota com 403.)
  competicoesClubesBr: ['BSA'],
  // displayName: só aliases seguros (abreviações do provedor e seleções).
  nomes: {
    'Man United': 'Manchester United', 'Man City': 'Manchester City', 'Barça': 'Barcelona',
    'Atleti': 'Atlético de Madrid', 'Brazil': 'Brasil', 'Argentina': 'Argentina',
    'Germany': 'Alemanha', 'Spain': 'Espanha', 'France': 'França', 'England': 'Inglaterra',
    'Italy': 'Itália', 'Netherlands': 'Holanda', 'Portugal': 'Portugal', 'Uruguay': 'Uruguai',
    'Colombia': 'Colômbia', 'Paraguay': 'Paraguai', 'Peru': 'Peru', 'Chile': 'Chile',
    'Ecuador': 'Equador', 'Bolivia': 'Bolívia', 'Venezuela': 'Venezuela', 'Belgium': 'Bélgica',
    'Croatia': 'Croácia', 'Mexico': 'México', 'United States': 'Estados Unidos', 'Japan': 'Japão',
    'Morocco': 'Marrocos', 'Switzerland': 'Suíça', 'Denmark': 'Dinamarca', 'Senegal': 'Senegal',
  },
  // Intervalos (s) entre consultas ao provedor, por PoP. Orçamento: FREE = 10
  // req/min por chave; o placar do FREE já vem com minutos de atraso, então
  // consultar mais rápido que 1 min não melhora nada. Futuro/encerrado: cache longo.
  intervalos: { aoVivo: 60, perto: 120, hojeFuturo: 900, semJogo: 3600, ontem: 43200, amanha: 21600 },
  // Cota (headers do provedor): com ≤ cotaBaixa requisições no minuto, o que
  // não é jogo ao vivo relevante espera fatorCotaBaixa× mais.
  cotaBaixa: 3,
  fatorCotaBaixa: 4,
  pertoMin: 20,             // a partir de N min do início, modo "perto"
  encerradoNaHomeH: 4,      // jogo encerrado sai do destaque N h após o início
};

const C = FUTEBOL_CONFIG;
const VIVO = { vivo: 1, intervalo: 1, prorrogacao: 1, penaltis: 1 };
const STATUS = {
  SCHEDULED: 'agendado', TIMED: 'agendado', IN_PLAY: 'vivo', PAUSED: 'intervalo',
  EXTRA_TIME: 'prorrogacao', PENALTY_SHOOTOUT: 'penaltis', FINISHED: 'encerrado',
  AWARDED: 'decidido', SUSPENDED: 'suspenso', POSTPONED: 'adiado', CANCELLED: 'cancelado',
};

let token = '', atraso = true, apiBase = C.api;
export function futebolConfigurar(env) {
  token = (env && env.FOOTBALL_DATA_TOKEN) || '';
  // Plano FREE = placar com atraso (aviso discreto). Só um plano em tempo real
  // desligaria o aviso — e o OWNews não paga plano.
  atraso = !(env && env.FUTEBOL_PLACAR_TEMPO_REAL === '1');
  const dev = env && env.FUTEBOL_API_BASE_DEV; // só wrangler dev local: nunca manda o token para fora de 127.0.0.1
  apiBase = typeof dev === 'string' && /^http:\/\/127\.0\.0\.1:\d+$/.test(dev) ? dev : C.api;
}
export const futebolAtivo = () => !!token;

// ─── Datas em America/Sao_Paulo ──────────────────────────────────────────
const FMT_DIA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
export const diaBRT = (ms) => FMT_DIA.format(new Date(ms));
export function somarDias(dia, n) {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}
export const DIAS = { ontem: -1, hoje: 0, amanha: 1 };

// ─── Adaptador football-data.org v4 → modelo neutro ──────────────────────
const int = (v) => (Number.isInteger(v) && v >= 0 && v < 1000 ? v : null); // placar/minuto
const idOk = (v) => (Number.isInteger(v) && v > 0 && v < 1e9 ? v : null);
const txt = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) : '');
function time(t) {
  if (!t || typeof t !== 'object') return null;
  const original = txt(t.shortName, 40) || txt(t.name, 40);
  if (!original) return null;
  const nome = C.nomes[txt(t.name, 40)] || C.nomes[original] || original;
  const tla = txt(t.tla, 4).toUpperCase();
  const sigla = /^[A-Z0-9]{2,4}$/.test(tla) ? tla : nome.replace(/[^A-Za-zÀ-ú0-9 ]/g, '').split(/\s+/).map((p) => p[0] || '').join('').slice(0, 3).toUpperCase();
  const me = typeof t.crest === 'string' && /^https:\/\/crests\.football-data\.org\/(\d{1,9})\.(?:png|svg)$/.exec(t.crest);
  const e = me ? '/api/live/escudo/' + me[1] + '.png' : null;
  return { id: idOk(t.id), n: nome, s: sigla, e, sel: C.selecao.includes(txt(t.name, 40)) };
}

export function normalizarJogo(m) {
  if (!m || typeof m !== 'object' || !idOk(m.id)) return null;
  const st = STATUS[m.status];
  const ini = Date.parse(m.utcDate);
  const comp = m.competition && C.competicoes[m.competition.code];
  const c = time(m.homeTeam), f = time(m.awayTeam);
  if (!st || !isFinite(ini) || !comp || !c || !f) return null;
  const sc = m.score || {};
  const dur = ['EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(sc.duration) ? sc.duration : 'REGULAR';
  const par = (o) => (o && typeof o === 'object' ? [int(o.home ?? o.homeTeam), int(o.away ?? o.awayTeam)] : [null, null]);
  let [gc, gf] = par(sc.fullTime);
  const [pc, pf] = par(sc.penalties);
  // fullTime inclui os pênaltis da disputa: o placar do jogo é tempo normal + prorrogação.
  if (dur === 'PENALTY_SHOOTOUT') {
    const [rc, rf] = par(sc.regularTime), [ec, ef] = par(sc.extraTime);
    if (rc != null && rf != null) { gc = rc + (ec || 0); gf = rf + (ef || 0); }
    else if (gc != null && pc != null) { gc -= pc; gf -= pf; }
  }
  const semPlacar = st === 'agendado' || st === 'adiado' || st === 'cancelado';
  return {
    id: m.id, cod: m.competition.code, comp: comp.nome, fase: txt(m.stage, 24), st,
    min: VIVO[st] ? int(m.minute) : null, acr: VIVO[st] ? int(m.injuryTime) : null,
    ini: new Date(ini).toISOString(), dur, c, f,
    gc: semPlacar ? null : gc, gf: semPlacar ? null : gf,
    pc: dur === 'PENALTY_SHOOTOUT' ? pc : null, pf: dur === 'PENALTY_SHOOTOUT' ? pf : null,
  };
}

export function transformarDia(dia) {
  return (j) => {
    if (!j || !Array.isArray(j.matches)) return null;
    const jogos = [];
    for (const m of j.matches.slice(0, 600)) {
      const n = normalizarJogo(m);
      if (!n || diaBRT(Date.parse(n.ini)) !== dia) continue;
      if (C.competicoes[n.cod].soComBrasil && !n.c.sel && !n.f.sel) continue;
      jogos.push(n);
    }
    return { dia, jogos };
  };
}

// ─── Relevância (determinística, só configuração) ───────────────────────
export function relevancia(j, clubesBr) {
  const p = C.pesos, comp = C.competicoes[j.cod];
  let r = comp ? comp.peso : 0;
  if (j.c.sel || j.f.sel) r += p.nationalTeamBoost;
  if (!comp.nacional && clubesBr && (clubesBr.has(j.c.id) || clubesBr.has(j.f.id))) r += p.brazilianTeamBoost;
  if (j.fase === 'FINAL') r += p.finalBoost;
  else if (j.fase === 'SEMI_FINALS') r += p.semifinalBoost;
  else if (j.fase === 'QUARTER_FINALS') r += p.quarterBoost;
  r += (C.teamBoost[j.c.id] || 0) + (C.teamBoost[j.f.id] || 0);
  if (C.classicos.some(([a, b]) => (a === j.c.id && b === j.f.id) || (a === j.f.id && b === j.c.id))) r += p.classicoBoost;
  if (C.featuredMatchIds.includes(j.id)) r += 1000;
  return r;
}

// Prioridade na Home = relevância + momento (ao vivo > grande jogo a seguir > recém-encerrado).
export function prioridadeHome(j, r, agora) {
  const p = C.pesos, ini = Date.parse(j.ini), minAte = (ini - agora) / 60000;
  if (VIVO[j.st]) return r + p.liveBoost;
  if (j.st === 'agendado') return minAte < -180 ? -1 : r + p.upcomingImportantBoost - Math.max(0, minAte) / 12;
  if (j.st === 'encerrado' || j.st === 'decidido') {
    const h = (agora - ini) / 3600000;
    return h < C.encerradoNaHomeH ? r + p.finishedRecentBoost - h * 10 : -1;
  }
  return -1; // adiado/cancelado/suspenso não ocupam a Home
}

export function selecionarHome(jogos, clubesBr, agora) {
  return jogos
    .map((j) => { const r = relevancia(j, clubesBr); return { j, r, p: prioridadeHome(j, r, agora) }; })
    .filter((x) => x.p > 0 && x.r >= C.relevanciaMinimaHome)
    .sort((a, b) => b.p - a.p || Date.parse(a.j.ini) - Date.parse(b.j.ini) || a.j.id - b.j.id)
    .slice(0, C.homeMax)
    // Escolhe por prioridade; exibe ao vivo → a seguir (por horário) → encerrados.
    .sort((a, b) => grupoHome(a.j) - grupoHome(b.j) || (grupoHome(a.j) === 1 ? Date.parse(a.j.ini) - Date.parse(b.j.ini) : b.p - a.p));
}
const grupoHome = (j) => (VIVO[j.st] ? 0 : j.st === 'agendado' ? 1 : 2);

const ORDEM_SECOES = [['vivo', 'Ao vivo'], ['seguir', 'A seguir'], ['encerrados', 'Encerrados'], ['outros', 'Adiados, suspensos e cancelados']];
export function secoesDia(jogos, clubesBr) {
  const sec = { vivo: [], seguir: [], encerrados: [], outros: [] };
  for (const j of jogos) {
    const k = VIVO[j.st] ? 'vivo' : j.st === 'agendado' ? 'seguir' : (j.st === 'encerrado' || j.st === 'decidido') ? 'encerrados' : 'outros';
    sec[k].push({ j, r: relevancia(j, clubesBr), t: Date.parse(j.ini) });
  }
  const cmp = {
    vivo: (a, b) => b.r - a.r || a.t - b.t,
    seguir: (a, b) => a.t - b.t || b.r - a.r,
    encerrados: (a, b) => b.t - a.t || b.r - a.r,
    outros: (a, b) => a.t - b.t,
  };
  return ORDEM_SECOES.filter(([k]) => sec[k].length).map(([k, titulo]) => {
    const grupos = new Map();
    for (const x of sec[k].sort(cmp[k])) { if (!grupos.has(x.j.comp)) grupos.set(x.j.comp, []); grupos.get(x.j.comp).push(x); }
    // Grupo herda a posição do seu melhor jogo (vivo: mais relevante; demais: ordem do critério da seção).
    const lista = [...grupos.entries()].map(([comp, xs]) => ({ comp, xs, rMax: Math.max(...xs.map((x) => x.r)) }));
    if (k === 'vivo') lista.sort((a, b) => b.rMax - a.rMax);
    return { k, titulo, comps: lista.map((g) => ({ comp: g.comp, jogos: g.xs.map((x) => x.j) })) };
  });
}

// ─── Provedor + cache ────────────────────────────────────────────────────
function intervaloDia(diaChave) {
  return (dados) => {
    const agora = Date.now(), I = C.intervalos;
    const js = (dados && dados.jogos) || [];
    if (js.some((j) => VIVO[j.st])) return I.aoVivo;
    const ag = js.filter((j) => j.st === 'agendado').map((j) => (Date.parse(j.ini) - agora) / 60000);
    if (ag.some((m) => m <= C.pertoMin && m > -180)) return I.perto;
    if (diaChave === 'ontem') return I.ontem;
    if (diaChave === 'amanha') return I.amanha;
    return ag.some((m) => m > 0) ? I.hojeFuturo : I.semJogo;
  };
}
// Jogo ao vivo que iria para a Home: este snapshot fura a economia de cota baixa.
const vivoRelevante = (dados) => ((dados && dados.jogos) || []).some((j) => VIVO[j.st] && relevancia(j, null) >= C.relevanciaMinimaHome);
// football-data.org: X-Requests-Available-Minute / X-RequestCounter-Reset (s).
const lerCota = (h) => ({ restantes: h.get('x-requests-available-minute'), resetS: h.get('x-requestcounter-reset') });
const COTA = { lerCota, cotaBaixa: C.cotaBaixa, fatorCotaBaixa: C.fatorCotaBaixa };

async function clubesBrasileiros(ctx) {
  const ids = new Set();
  await Promise.all(C.competicoesClubesBr.map(async (cod) => {
    const { snap } = await buscarSnapshot({
      chave: 'futebol-clubes-' + cod, url: apiBase + '/competitions/' + cod + '/teams', ctx,
      headers: { 'X-Auth-Token': token }, intervaloS: 86400, retencaoS: 604800, ...COTA,
      transformar: (j) => (j && Array.isArray(j.teams) ? j.teams.map((t) => idOk(t && t.id)).filter(Boolean) : null),
    });
    if (snap && snap.dados) for (const id of snap.dados) ids.add(id);
  }));
  return ids;
}

export async function futebolDia(diaChave, ctx, soCache) {
  const dia = somarDias(diaBRT(Date.now()), DIAS[diaChave]);
  const chave = 'futebol-dia-' + dia;
  if (!token) return { dia, snap: null };
  if (soCache) return { dia, snap: await lerSnapshot(chave), clubesBr: null };
  const [{ snap }, clubesBr] = await Promise.all([
    buscarSnapshot({
      chave, url: apiBase + '/matches?dateFrom=' + dia + '&dateTo=' + somarDias(dia, 1), ctx,
      headers: { 'X-Auth-Token': token }, intervaloS: intervaloDia(diaChave), timeoutMs: 4000, ...COTA, prioritario: vivoRelevante,
      transformar: transformarDia(dia),
    }),
    clubesBrasileiros(ctx),
  ]);
  return { dia, snap, clubesBr };
}

// Próxima consulta do navegador (s): rápida só com jogo ao vivo ou começando.
function proximaCliente(jogos, agora) {
  if (jogos.some((j) => VIVO[j.st])) return C.intervalos.aoVivo;
  const ag = jogos.filter((j) => j.st === 'agendado').map((j) => (Date.parse(j.ini) - agora) / 1000);
  if (ag.some((s) => s <= C.pertoMin * 60 && s > -10800)) return C.intervalos.perto;
  const prox = ag.filter((s) => s > 0).sort((a, b) => a - b)[0];
  return prox ? Math.max(60, Math.min(900, Math.round(prox - C.pertoMin * 60))) : 0;
}

function base(snap, jogos) {
  return {
    // Hora da última consulta bem-sucedida (304 conta: o placar foi conferido).
    ok: true, ativo: !!token, atraso, atualizadoEm: (snap && (snap.okEm || snap.atualizadoEm)) || null,
    falha: !!(snap && snap.falhaEm), proxima: proximaCliente(jogos, Date.now()),
  };
}

export function payloadDestaque(snap, clubesBr) {
  const jogos = (snap && snap.dados && snap.dados.jogos) || [];
  const sel = selecionarHome(jogos, clubesBr, Date.now());
  // Navegador só reconsulta por jogo que pode aparecer na Home (auditoria
  // 26/10: jogo irrelevante ao vivo fazia polling de 60 s com o módulo oculto).
  const candidatos = jogos.filter((j) => relevancia(j, clubesBr) >= C.relevanciaMinimaHome);
  return {
    ...base(snap, candidatos),
    topo: sel.some((x) => VIVO[x.j.st] && (x.j.c.sel || x.j.f.sel || C.topoFases.includes(x.j.fase))),
    jogos: sel.map((x) => { const { cod, fase, ...min } = x.j; return min; }),
  };
}

export function payloadDia(dia, snap, clubesBr) {
  const jogos = (snap && snap.dados && snap.dados.jogos) || [];
  return { ...base(snap, jogos), dia, secoes: secoesDia(jogos, clubesBr) };
}

// ─── Render (fonte única: roda no Worker e, via toString, no navegador) ──
// Autocontida de propósito (ES5, sem referências externas).
export function futebolRender() {
  var VIVO = { vivo: 1, intervalo: 1, prorrogacao: 1, penaltis: 1 };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function hora(iso, seg) {
    try { return new Date(iso).toLocaleTimeString('pt-BR', seg ? { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' } : { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }
  function rotulo(j) {
    var pen = j.pc != null && j.pf != null ? ' · pên. ' + j.pc + '–' + j.pf : '';
    var min = j.min != null ? (j.acr ? j.min + '+' + j.acr : j.min) + "'" : '';
    switch (j.st) {
      case 'agendado': return hora(j.ini);
      case 'vivo': return min || 'Ao vivo';
      case 'intervalo': return 'Intervalo';
      case 'prorrogacao': return 'Prorrogação' + (min ? ' · ' + min : '');
      case 'penaltis': return 'Pênaltis' + pen;
      case 'encerrado': return 'Final' + (j.dur === 'EXTRA_TIME' ? ' · prorrogação' : '') + pen;
      case 'decidido': return 'Resultado declarado';
      case 'suspenso': return 'Suspenso';
      case 'adiado': return 'Adiado';
      case 'cancelado': return 'Cancelado';
    }
    return '';
  }
  function time(t, g, o) {
    var img = o.escudos && t.e ? '<img src="' + esc(t.e) + '" width="22" height="22" alt="" decoding="async"' + (o.lazy ? ' loading="lazy"' : ' fetchpriority="low"') + ' referrerpolicy="no-referrer" onerror="this.remove()">' : '';
    return '<div class="fx-t"><span class="fx-esc" aria-hidden="true">' + esc(t.s) + img + '</span><span class="fx-n">' + esc(t.n) + '</span><b class="fx-g">' + (g == null ? '' : g) + '</b></div>';
  }
  function jogo(j, o) {
    var v = VIVO[j.st] ? ' fx-vivo' : '';
    var a = j.c.n + ' ' + (j.gc == null ? '' : j.gc) + ' × ' + (j.gf == null ? '' : j.gf) + ' ' + j.f.n + ', ' + rotulo(j);
    return '<div class="fx-j' + v + ' fx-' + j.st + '" role="group" aria-label="' + esc(a) + '">' + (o.comp ? '<div class="fx-comp">' + esc(j.comp) + '</div>' : '') +
      time(j.c, j.gc, o) + time(j.f, j.gf, o) + '<div class="fx-s">' + esc(rotulo(j)) + '</div></div>';
  }
  function atualizado(d, seg) {
    if (!d.atualizadoEm) return '';
    var velho = Date.now() - d.atualizadoEm > Math.max(180, (d.proxima || 0) * 4) * 1000;
    return (d.falha || velho ? 'Última atualização ' : 'Atualizado ') + hora(d.atualizadoEm, seg) + (velho ? ' · Dados podem estar desatualizados.' : '') + (d.atraso ? ' · placar pode ter alguns minutos de atraso' : '');
  }
  function home(d, o) {
    var vivo = d.jogos.some(function (j) { return VIVO[j.st]; });
    var h = '<div class="fx-head"><span class="fx-tit">' + (vivo ? 'Futebol' : 'Jogos de hoje') + '</span>' + (vivo ? '<span class="fx-badge">Ao vivo</span>' : '') + '</div><div class="fx-lista">';
    for (var i = 0; i < d.jogos.length; i++) h += jogo(d.jogos[i], { comp: 1, escudos: o.escudos });
    return h + '</div><div class="fx-pe"><span class="fx-atu">' + esc(atualizado(d)) + '</span><a class="fx-cta" href="/jogos">Todos os jogos de hoje →</a></div>';
  }
  function pagina(d, o) {
    if (!d.ativo) return '<p class="fj-vazio">Placares indisponíveis no momento.</p>';
    if (!d.secoes.length) return '<p class="fj-vazio">' + (d.atualizadoEm ? 'Nenhum jogo das competições acompanhadas nesta data.' : 'Placares temporariamente indisponíveis. Tentando novamente…') + '</p>';
    var h = '';
    for (var i = 0; i < d.secoes.length; i++) {
      var s = d.secoes[i];
      h += '<section class="fj-sec fj-' + s.k + '"><h2 class="fj-h">' + esc(s.titulo) + '</h2>';
      for (var k = 0; k < s.comps.length; k++) {
        h += '<div class="fj-comp"><h3>' + esc(s.comps[k].comp) + '</h3><div class="fj-grade">';
        for (var m = 0; m < s.comps[k].jogos.length; m++) h += jogo(s.comps[k].jogos[m], { lazy: 1, escudos: o.escudos });
        h += '</div></div>';
      }
      h += '</section>';
    }
    return h;
  }
  return { esc: esc, hora: hora, rotulo: rotulo, jogo: jogo, home: home, pagina: pagina, atualizado: atualizado };
}
const R = futebolRender();

// Script do navegador: atualiza só quando há motivo (ao vivo/perto do início),
// guarda o último snapshot no localStorage e nunca apaga o placar por falha.
function scriptCliente(alvoId, modo, url, dados, ls) {
  // __name: o bundler do wrangler injeta __name(fn,"nome") em funções; o navegador não tem.
  return '<script>(function(){var __name=function(f){return f};var R=(' + futebolRender.toString() + ')();var E=document.getElementById(' + JSON.stringify(alvoId) + '),U=' + JSON.stringify(url) +
    ',M=' + JSON.stringify(modo) + ',K=' + JSON.stringify(ls) + ',O={escudos:' + (C.escudos ? 1 : 0) + '},d=' + JSON.stringify(dados).replace(/</g, '\\u003c') + ',t,ult=Date.now();' +
    'function pinta(x){if(M==="home"){if(!x.jogos||!x.jogos.length){E.hidden=true;return}E.innerHTML=R.home(x,O);E.hidden=false}else{document.getElementById("fjCorpo").innerHTML=R.pagina(x,O);var a=document.getElementById("fjAtu");if(a)a.textContent=R.atualizado(x,1)}}' +
    'function aviso(){if(!d)return;d.falha=true;var a=E.querySelector(".fx-atu")||document.getElementById("fjAtu");if(a)a.textContent=R.atualizado(d,M!=="home")}' +
    'function agenda(s){clearTimeout(t);if(s>0)t=setTimeout(vai,s*1000)}' +
    'function vai(){if(document.hidden){agenda(d&&d.proxima||0);return}ult=Date.now();fetch(U,{cache:"no-store"}).then(function(r){return r.json()}).then(function(x){if(!x||!x.ok)throw 0;d=x;pinta(x);try{localStorage.setItem(K,JSON.stringify(x))}catch(e){}}).catch(aviso).then(function(){agenda(d&&d.proxima||0)})}' +
    'if(!d){try{var c=JSON.parse(localStorage.getItem(K)||"null");if(c&&c.ok){d=c;pinta(c)}}catch(e){}}' +
    'document.addEventListener("visibilitychange",function(){if(!document.hidden&&d&&d.proxima&&Date.now()-ult>d.proxima*1000)vai()});addEventListener("online",vai);' +
    'if(!d||!d.atualizadoEm||Date.now()-d.atualizadoEm>20000)vai();else agenda(d.proxima)})();</script>';
}

// ─── CSS (tokens do OWNews; vermelho só no selo/ponto ao vivo) ───────────
const CSS = '<style>' +
  '.fx{margin:14px 0;padding:14px 16px;border:1px solid var(--line-soft,var(--line));border-radius:12px;background:var(--navy-900)}' +
  // Depois de "Aconteceu no Offshore": respiro de seção, para não parecer parte do bloco editorial.
  '#destaque~.fx{margin-top:28px}' +
  '.fx-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}' +
  '.fx-tit{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--white)}' +
  '.fx-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--white)}' +
  '.fx-badge::after{content:"";width:7px;height:7px;border-radius:50%;background:#e5484d}' +
  '.fx-lista{display:grid;grid-template-columns:1fr;gap:0}' +
  '.fx-lista>.fx-j+.fx-j{border-top:1px solid var(--line-soft,var(--line))}' +
  '.fx-j{min-width:0;padding:10px 0}' +
  '.fx-comp{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--cyan);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '.fx-t{display:grid;grid-template-columns:22px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:28px}' +
  '.fx-esc{position:relative;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:7px;font-weight:800;color:var(--muted);background:var(--navy-800);overflow:hidden}' +
  '.fx-esc img{position:absolute;inset:0;width:22px;height:22px;object-fit:contain;background:var(--navy-900)}' +
  '.fx-n{font-size:15px;font-weight:600;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '.fx-g{font-size:22px;font-weight:800;line-height:1;color:var(--white);font-variant-numeric:tabular-nums;min-width:1ch;text-align:right}' +
  '.fx-s{margin-top:4px;text-align:right;font-size:12px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums}' +
  '.fx-vivo .fx-s{color:#e5484d}.fx-agendado .fx-s{color:var(--cyan);font-size:13px}' +
  '.fx-encerrado .fx-g,.fx-decidido .fx-g{color:var(--muted)}' +
  '.fx-adiado .fx-s,.fx-cancelado .fx-s,.fx-suspenso .fx-s{text-transform:uppercase;letter-spacing:.06em}' +
  '.fx-pe{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding-top:10px;border-top:1px solid var(--line-soft,var(--line))}' +
  '.fx-atu{font-size:11px;color:var(--muted-dim,var(--muted))}' +
  '.fx-cta{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--cyan);text-decoration:none}' +
  '@media(min-width:760px){.fx-lista{grid-template-columns:repeat(3,minmax(0,1fr));gap:0 22px}.fx-lista>.fx-j+.fx-j{border-top:0}.fx-lista>.fx-j{border-left:1px solid var(--line-soft,var(--line));padding-left:22px}.fx-lista>.fx-j:first-child{border-left:0;padding-left:0}}' +
  '</style>';

const CSS_PAGINA = '<style>' +
  '.fj{max-width:1080px;margin:0 auto;padding:8px 0 32px}' +
  '.fj h1{margin:0;font-size:clamp(26px,6vw,36px);letter-spacing:-.01em}' +
  '.fj-sub{margin:4px 0 0;color:var(--muted);font-size:14px}' +
  '.fj-data{margin:10px 0 0;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--cyan)}' +
  '.fj-dias{display:flex;gap:6px;margin:16px 0 4px}' +
  '.fj-dias a{flex:0 0 auto;padding:8px 16px;border:1px solid var(--line);border-radius:999px;font-size:13px;font-weight:700;color:var(--muted);text-decoration:none}' +
  '.fj-dias a[aria-current]{background:var(--cyan);border-color:var(--cyan);color:var(--navy-950)}' +
  '.fj-sec{margin-top:22px}' +
  '.fj-h{margin:0 0 6px;font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--white)}' +
  '.fj-vivo .fj-h{display:flex;align-items:center;gap:8px}.fj-vivo .fj-h::before{content:"";flex:0 0 8px;height:8px;border-radius:50%;background:#e5484d}' +
  '.fj-comp h3{margin:14px 0 6px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--cyan)}' +
  '.fj-grade{display:grid;grid-template-columns:1fr;gap:8px}' +
  '.fj-grade .fx-j{padding:10px 14px;border:1px solid var(--line-soft,var(--line));border-radius:10px;background:var(--navy-900)}' +
  '@media(min-width:720px){.fj-grade{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(min-width:1080px){.fj-grade{grid-template-columns:repeat(3,minmax(0,1fr))}}' +
  '.fj-vazio{margin:28px 0;color:var(--muted)}' +
  '.fj-rodape{margin-top:28px;font-size:11px;color:var(--muted-dim,var(--muted))}' +
  '</style>';

// ─── Home ────────────────────────────────────────────────────────────────
// Lê só o cache do PoP (a Home nunca espera o provedor). Sem jogo relevante:
// nada é injetado além de um contêiner oculto que o script preenche se surgir.
const ANCORAS_HOME = ['<section class="ed-section vagas-home-section" id="vagas-agora"', '<section class="ed-section mo-section" id="mercadoOffshore"', '<section class="ops" id="aeroportos"'];
export async function futebolModuloHome(html) {
  if (!token) return html;
  let dados = null, topo = false;
  try {
    const { snap } = await futebolDia('hoje', null, true);
    const clubes = await Promise.all(C.competicoesClubesBr.map((cod) => lerSnapshot('futebol-clubes-' + cod)));
    if (snap && snap.dados) {
      dados = payloadDestaque(snap, new Set(clubes.flatMap((x) => (x && x.dados) || [])));
      topo = dados.topo;
    }
  } catch { dados = null; }
  const tem = dados && dados.jogos.length;
  const modulo = CSS + '<section class="fx" id="futebolAoVivo" aria-label="Futebol: jogos de hoje"' + (tem ? '' : ' hidden') + '>' +
    (tem ? R.home(dados, { escudos: C.escudos }) : '') + '</section>' +
    scriptCliente('futebolAoVivo', 'home', '/api/live/featured', tem ? dados : null, 'ow-futebol-home');
  // Serviço depois do conteúdo: logo após "Aconteceu no Offshore" (antes de
  // Vagas/Mercado), nunca empurrando as notícias. Exceção aprovada: Seleção
  // ou final ao vivo sobe para o topo.
  if (topo) { const a = '<main class="container" id="conteudo">'; return html.includes(a) ? html.replace(a, a + modulo) : html; }
  const ancora = ANCORAS_HOME.find((a) => html.includes(a));
  return ancora ? html.replace(ancora, modulo + ancora) : html;
}

// ─── Rotas ───────────────────────────────────────────────────────────────
const json = (obj, status) => new Response(JSON.stringify(obj), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=15', 'X-Robots-Tag': 'noindex' },
});
const TITULOS = { hoje: 'Jogos de hoje', ontem: 'Jogos de ontem', amanha: 'Jogos de amanhã' };
const FMT_LONGO = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });

// Proxy de escudo: id numérico → PNG do provedor, com teto de tamanho e cache longo.
async function escudo(url, ctx) {
  const m = /^\/api\/live\/escudo\/(\d{1,9})\.png$/.exec(url.pathname);
  if (!m || !token) return new Response(null, { status: 404 });
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const k = new Request('https://ownews-ao-vivo.interno/escudo/' + m[1]);
  if (cache) { const r = await cache.match(k).catch(() => null); if (r) return r; }
  let resp = new Response(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=86400' } });
  try {
    const r = await fetch('https://crests.football-data.org/' + m[1] + '.png', { signal: AbortSignal.timeout(4000) });
    const tipo = r.headers.get('content-type') || '';
    const buf = r.ok && tipo.startsWith('image/png') ? await r.arrayBuffer() : null;
    if (buf && buf.byteLength > 0 && buf.byteLength <= C.escudoMaxBytes) {
      resp = new Response(buf, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=2592000, immutable', 'X-Content-Type-Options': 'nosniff' } });
    }
  } catch { return new Response(null, { status: 404 }); } // falha transitória: não grava
  if (cache) ctx.waitUntil(cache.put(k, resp.clone()).catch(() => {}));
  return resp;
}

export async function futebolResponder(request, url, ctx, deps) {
  if (url.pathname.startsWith('/api/live/escudo/')) return escudo(url, ctx);
  const diaChave = url.searchParams.get('dia') || 'hoje';
  if (!(diaChave in DIAS)) return json({ ok: false, erro: 'dia inválido' }, 400);
  if (url.pathname === '/api/live/featured') {
    if (!token) return json({ ok: true, ativo: false, jogos: [], proxima: 0 });
    const { snap, clubesBr } = await futebolDia('hoje', ctx);
    return json(payloadDestaque(snap, clubesBr));
  }
  const { dia, snap, clubesBr } = token ? await futebolDia(diaChave, ctx) : { dia: somarDias(diaBRT(Date.now()), DIAS[diaChave]), snap: null };
  const dados = payloadDia(dia, snap, clubesBr);
  if (url.pathname === '/api/live/today') return json(dados);
  // /jogos
  const dataTxt = FMT_LONGO.format(new Date(dia + 'T12:00:00Z'));
  const nav = Object.keys(DIAS).map((k) => '<a href="/jogos' + (k === 'hoje' ? '' : '?dia=' + k) + '"' + (k === diaChave ? ' aria-current="page"' : '') + '>' + { ontem: 'Ontem', hoje: 'Hoje', amanha: 'Amanhã' }[k] + '</a>').join('');
  const conteudo = CSS + CSS_PAGINA + '<div class="fj" id="fj"><h1>' + TITULOS[diaChave] + '</h1><p class="fj-sub">Placares e resultados do dia.</p>' +
    '<p class="fj-data">' + R.esc(dataTxt.charAt(0).toUpperCase() + dataTxt.slice(1)) + '</p><nav class="fj-dias" aria-label="Dia">' + nav + '</nav>' +
    '<div id="fjCorpo">' + R.pagina(dados, { escudos: C.escudos }) + '</div>' +
    '<p class="fj-rodape"><span id="fjAtu">' + R.esc(R.atualizado(dados, 1)) + '</span><br>Horários de Brasília. ' + C.atribuicao + '.</p></div>' +
    (token ? scriptCliente('fj', 'pagina', '/api/live/today?dia=' + diaChave, dados, 'ow-futebol-' + diaChave) : '');
  const html = deps.paginaChrome('Jogos de hoje e placares ao vivo | OWNews',
    'Acompanhe jogos de hoje, placares e resultados de forma rápida no OWNews.', conteudo,
    '/jogos' + (diaChave === 'hoje' ? '' : '?dia=' + diaChave),
    { robots: !token || diaChave !== 'hoje' ? 'noindex, follow' : undefined });
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=15' } });
}
