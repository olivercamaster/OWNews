#!/usr/bin/env node
/* Checagem de ativação dos placares (não vai para o bundle).
 * Uso: FOOTBALL_DATA_TOKEN=… node ao-vivo/validar-futebol.mjs
 * Confere (evidência real, plano FREE — R$ 0): token válido, competições
 * cobertas, jogos de hoje normalizados, placar/minuto ao vivo, escudo servido,
 * headers de cota e nomes dos ids de teamBoost. Nunca imprime o token.
 * Gasta ~17 requisições, espaçadas para caber em 10/min. */
import { FUTEBOL_CONFIG as C, futebolConfigurar, transformarDia, diaBRT, somarDias } from './futebol.js';
const token = process.env.FOOTBALL_DATA_TOKEN;
if (!token) { console.error('FOOTBALL_DATA_TOKEN ausente'); process.exit(2); }
futebolConfigurar({ FOOTBALL_DATA_TOKEN: token });
const get = async (p) => {
  const r = await fetch(C.api + p, { headers: { 'X-Auth-Token': token } });
  return { status: r.status, restantes: r.headers.get('x-requests-available-minute'), reset: r.headers.get('x-requestcounter-reset'), json: r.ok ? await r.json() : null };
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const comps = await get('/competitions');
if (comps.status !== 200) { console.error('token recusado: HTTP ' + comps.status); process.exit(1); }
const disponiveis = new Set(comps.json.competitions.map((c) => c.code));
for (const [cod, cfg] of Object.entries(C.competicoes)) console.log((disponiveis.has(cod) ? 'listada   ' : 'AUSENTE   ') + cod + ' ' + cfg.nome);

const hoje = diaBRT(Date.now());
const m = await get('/matches?dateFrom=' + hoje + '&dateTo=' + somarDias(hoje, 1));
console.log('\n/matches hoje: HTTP ' + m.status + ', cota: ' + m.restantes + ' restantes no minuto, reset em ' + m.reset + ' s');
if (m.json) {
  const porComp = {};
  for (const x of m.json.matches) porComp[x.competition.code] = (porComp[x.competition.code] || 0) + 1;
  console.log('competições no plano com jogo hoje:', JSON.stringify(porComp));
  const d = transformarDia(hoje)(m.json);
  console.log('jogos normalizados para /jogos: ' + d.jogos.length);
  for (const j of d.jogos.slice(0, 5)) console.log('  ', j.comp, j.c.n, j.gc ?? '', '×', j.gf ?? '', j.f.n, j.st, j.min ?? '');
  const comMinuto = m.json.matches.filter((x) => x.status === 'IN_PLAY');
  if (comMinuto.length) console.log('ao vivo agora: ' + comMinuto.length + ' jogo(s); campo minute presente: ' + comMinuto.every((x) => 'minute' in x) + '; placar parcial: ' + comMinuto.every((x) => x.score && x.score.fullTime && x.score.fullTime.home != null));
  else console.log('nenhum jogo ao vivo neste momento (rode de novo durante uma rodada para ver placar/minuto ao vivo)');
  const comBSA = m.json.matches.find((x) => x.competition.code === 'BSA');
  console.log('Brasileirão no plano: ' + (disponiveis.has('BSA') ? 'sim' : 'NÃO') + (comBSA ? ' (jogo hoje: ' + comBSA.homeTeam.shortName + ' × ' + comBSA.awayTeam.shortName + ')' : ''));
  const crest = m.json.matches.map((x) => x.homeTeam && x.homeTeam.crest).find((u) => /^https:\/\/crests\.football-data\.org\/\d+\.png$/.test(u || ''));
  if (crest) { const r = await fetch(crest); const b = r.ok ? (await r.arrayBuffer()).byteLength : 0; console.log('escudo PNG: HTTP ' + r.status + ', ' + b + ' bytes' + (b > C.escudoMaxBytes ? ' (acima do teto: cai para a sigla)' : '')); }
}
console.log('\nteamBoost (confira os nomes):');
for (const id of Object.keys(C.teamBoost)) {
  const t = await get('/teams/' + id);
  console.log('  ' + id + ' → ' + (t.json ? t.json.name : 'HTTP ' + t.status));
  await espera(6500); // respeita 10 req/min do plano gratuito
}
