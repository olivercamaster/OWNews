// Dicas Offshore — catálogo validado + barreira (08/11/2026, incidente CIM/CIR).
// Testa o worker.js REAL. Uso: node --test tests/dicas_test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let W;
before(async () => {
  let src = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8').replace(/^const ([A-Z_0-9]+) = /gm, 'var $1 = ');
  src += '\nexport { diaDeCicloDica, proximoCicloDica, dataBRTString, TelegramAgendadorPoller as Agendador_, DICAS_CATALOGO, validarTextoDica, validadeDicaExpirada, revalidarDica, escolherDicaValidada, textoTelegramDica, resumoCatalogoDicas };\n';
  const f = path.join(os.tmpdir(), `dicas-worker-${process.pid}.mjs`);
  fs.writeFileSync(f, src);
  W = await import('file://' + f);
});
const AGORA = Date.parse('2026-11-08T15:00:00Z');
const fato = { c: 'x', u: 'https://www.gov.br/x', e: 'Caderneta de Inscrição e Registro', em: '2026-11-08' };
const dica = (t, extra) => Object.assign({ id: 'teste', st: 'V', r: 'A', n: [], f: [fato], t }, extra || {});
const motivos = (d) => W.validarTextoDica(d).motivos.join(' ');

test('A) "CIM — Carteira de Inscrição Marítima" → BLOCK', () => {
  assert.equal(W.validarTextoDica(dica('CIM — Carteira de Inscrição Marítima: exigida para embarque em plataformas e navios.')).veredito, 'BLOCK');
  assert.equal(W.validarTextoDica(dica('Caderneta de Inscrição Marítima (CIM): exigida para trabalho a bordo de navio-plataforma.')).veredito, 'BLOCK');
});
test('B) "CIR — Caderneta de Inscrição e Registro" com fonte oficial → PASS', () => {
  assert.equal(W.validarTextoDica(dica('CIR — Caderneta de Inscrição e Registro: documento do aquaviário cadastrado pela Marinha do Brasil.')).veredito, 'PASS');
});
test('C) sigla certa + expansão errada → BLOCK', () => {
  assert.match(motivos(dica('CIR (Carteira de Inscrição Marítima): documento da Marinha para quem trabalha a bordo de unidades.')), /expansao_nao_confirmada:CIR/);
  assert.match(motivos(dica('Carteira de Inscrição Marítima (CIR): documento da Marinha para quem trabalha a bordo de unidades.')), /expansao_nao_confirmada:CIR/);
});
test('D) sigla inventada → BLOCK', () => {
  assert.match(motivos(dica('O treinamento XQTR é exigido de todo trabalhador embarcado em plataformas offshore no Brasil.')), /sigla_nao_confirmada:XQTR/);
});
test('E) número sem suporte → BLOCK', () => {
  assert.match(motivos(dica('A NR-37 exige 3 exercícios de abandono por embarque para todos os trabalhadores a bordo.', { n: ['37'] })), /numero_sem_fonte:3/);
});
test('F) prazo/validade sem fonte → BLOCK', () => {
  assert.match(motivos(dica('A CIR vale por 5 anos e precisa ser renovada na Capitania dos Portos mais próxima de você.')), /numero_sem_fonte:5/);
});
test('G) fonte indisponível na revalidação de claim crítico → BLOCK', async () => {
  const vencida = dica('CIR — Caderneta de Inscrição e Registro: documento do aquaviário cadastrado pela Marinha do Brasil.', { f: [Object.assign({}, fato, { em: '2026-01-01' })] });
  const orig = globalThis.fetch; globalThis.fetch = async () => { throw new Error('rede'); };
  try {
    const e = await W.escolherDicaValidada(AGORA, {}, {});
    assert.ok(e.dica, 'catálogo real segue funcionando');
    assert.deepEqual(await W.revalidarDica(vencida), { ok: false, motivo: 'fonte_indisponivel' });
  } finally { globalThis.fetch = orig; }
});
test('H) dica bloqueada + outra validada → escolhe a outra', async () => {
  const primeira = (await W.escolherDicaValidada(AGORA, {}, {})).dica;
  const cat = W.DICAS_CATALOGO; const i = cat.indexOf(primeira); const orig = primeira.t;
  primeira.t = 'Texto com sigla inventada QZXW que nunca foi conferida em nenhuma fonte oficial.';
  try {
    const e = await W.escolherDicaValidada(AGORA, {}, {});
    assert.notEqual(e.dica.id, primeira.id);
    assert.equal(e.tentativas[0].id, primeira.id); assert.equal(e.tentativas[0].veredito, 'BLOCK');
  } finally { cat[i].t = orig; }
});
test('I) nenhuma dica validada → não publica', async () => {
  const cat = W.DICAS_CATALOGO; const salvo = cat.map((d) => d.st);
  cat.forEach((d) => { d.st = 'R'; });
  try {
    const e = await W.escolherDicaValidada(AGORA, {}, {});
    assert.equal(e.dica, null); assert.equal(e.motivo, 'nenhuma_dica_validada');
  } finally { cat.forEach((d, k) => { d.st = salvo[k]; }); }
});
test('J) validação vencida → revalida antes; trecho encontrado → PASS, ausente → BLOCK', async () => {
  const cir = W.DICAS_CATALOGO.find((d) => d.id === 'cir');
  const futuro = Date.parse('2027-06-01T15:00:00Z');
  assert.equal(W.validadeDicaExpirada(cir, futuro), true);
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response('<p>Caderneta de Inscrição e Registro (CIR) ... modelo 1034</p>', { status: 200 });
  try { assert.deepEqual(await W.revalidarDica(cir), { ok: true }); } finally { globalThis.fetch = orig; }
  globalThis.fetch = async () => new Response('<p>página mudou</p>', { status: 200 });
  try { assert.equal((await W.revalidarDica(cir)).ok, false); } finally { globalThis.fetch = orig; }
  // Fonte em PDF não se confere no Worker: vencida = fora da rotação até nova auditoria.
  assert.equal((await W.revalidarDica(W.DICAS_CATALOGO.find((d) => d.id === 'ciplat'))).motivo, 'fonte_pdf_exige_auditoria');
});
test('K) falha do validador → não publica claim crítico', async () => {
  const cat = W.DICAS_CATALOGO; const salvo = cat.map((d) => d.st);
  const unica = cat.find((d) => d.id === 'cir'); cat.forEach((d) => { if (d !== unica) d.st = 'R'; });
  try {
    const e = await W.escolherDicaValidada(Date.parse('2027-06-01T15:00:00Z'), {}, { revalidar: async () => { throw new Error('quebrou'); } });
    assert.equal(e.dica, null); assert.match(e.tentativas[0].motivos.join(), /validador_falhou/);
  } finally { cat.forEach((d, k) => { d.st = salvo[k]; }); }
});
test('L) termos técnicos legítimos não geram falso positivo: TODO o catálogo validado passa', () => {
  for (const d of W.DICAS_CATALOGO.filter((x) => x.st === 'V')) assert.equal(W.validarTextoDica(d).veredito, 'PASS', d.id + ' ' + motivos(d));
});
test('catálogo: nenhuma dica bloqueada ou em revisão tem texto em rotação; risco A sempre com fonte e data', () => {
  for (const d of W.DICAS_CATALOGO) {
    if (d.st !== 'V') assert.ok(!d.t, d.id + ' fora da rotação não deve ter texto publicável');
    if (d.st === 'V' && d.r === 'A') assert.ok((d.f || []).every((x) => x.u && x.e && /^\d{4}-\d{2}-\d{2}$/.test(x.em)), d.id);
  }
  assert.ok(!W.DICAS_CATALOGO.some((d) => d.st === 'V' && /\bCIM\b|Inscrição Marítima/.test(d.t)));
});
test('dedupe nunca escolhe dica não validada e evita repetir em 30 dias', async () => {
  const validas = W.DICAS_CATALOGO.filter((d) => d.st === 'V');
  const enviadas = Object.fromEntries(validas.slice(0, -1).map((d) => [d.id, AGORA - 86400000]));
  const e = await W.escolherDicaValidada(AGORA, enviadas, {});
  assert.equal(e.dica.st, 'V'); assert.equal(e.dica.id, validas[validas.length - 1].id);
});
test('texto do Telegram: dica regulatória mostra a fonte; prática não', () => {
  assert.match(W.textoTelegramDica(W.DICAS_CATALOGO.find((d) => d.id === 'cir')), /Fonte: Marinha do Brasil/);
  assert.doesNotMatch(W.textoTelegramDica(W.DICAS_CATALOGO.find((d) => d.id === 'familia')), /Fonte:/);
});

// ── Cadência: 1 dica a cada 2 dias, 12:00 BRT, âncora 08/11/2026 ──
const brt12 = (dia) => Date.parse(dia + 'T15:00:00Z'); // 12:00 BRT
test('cadência: 08/11 sim, 09/11 não, 10/11 sim, 11/11 não, 12/11 sim', () => {
  const esperado = { '2026-11-08': true, '2026-11-09': false, '2026-11-10': true, '2026-11-11': false, '2026-11-12': true };
  for (const [dia, sim] of Object.entries(esperado)) assert.equal(W.diaDeCicloDica(brt12(dia)), sim, dia);
});
test('cadência: virada de mês (30/11 sim, 01/12 não, 02/12 sim) e de ano pela âncora real (31/12 não, 01/01 sim, 02/01 não)', () => {
  const esperado = { '2026-11-30': true, '2026-12-01': false, '2026-12-02': true, '2026-12-31': false, '2027-01-01': true, '2027-01-02': false, '2027-03-01': false, '2027-03-02': true };
  for (const [dia, sim] of Object.entries(esperado)) assert.equal(W.diaDeCicloDica(brt12(dia)), sim, dia);
});
test('cadência usa o dia de America/Sao_Paulo (não o de UTC)', () => {
  // 01:30 UTC de 09/11 ainda é 08/11 em São Paulo → dia de ciclo; 03:30 UTC de 09/11 já é 09/11 → não.
  assert.equal(W.diaDeCicloDica(Date.parse('2026-11-09T01:30:00Z')), true);
  assert.equal(W.diaDeCicloDica(Date.parse('2026-11-09T03:30:00Z')), false);
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  for (let t = Date.parse('2026-11-01T00:00:00Z'); t < Date.parse('2027-03-01T00:00:00Z'); t += 3600000 * 7) assert.equal(W.dataBRTString(t), fmt.format(t));
});
test('próxima execução: hoje 12:00 BRT se ainda não rodou; depois, +2 dias', () => {
  assert.equal(W.proximoCicloDica(Date.parse('2026-11-08T11:00:00Z'), false), '2026-11-08T15:00:00.000Z');
  assert.equal(W.proximoCicloDica(Date.parse('2026-11-08T16:00:00Z'), true), '2026-11-10T15:00:00.000Z');
  assert.equal(W.proximoCicloDica(Date.parse('2026-11-09T12:00:00Z'), false), '2026-11-10T15:00:00.000Z');
  assert.equal(W.proximoCicloDica(Date.parse('2026-12-31T12:00:00Z'), false), '2027-01-01T15:00:00.000Z');
});
function agendador() {
  const mem = new Map();
  const state = { storage: { get: async (k) => mem.get(k), put: async (k, v) => { mem.set(k, v); }, getAlarm: async () => 1, setAlarm: async () => {} } };
  return { ag: new W.Agendador_(state, { TELEGRAM_DRY_RUN: 'true' }), mem };
}
test('dia sem ciclo: não envia, segue a agenda e NÃO grava ciclo (nada vira falha no painel)', async () => {
  const { ag, mem } = agendador();
  await ag.enviarDica('2026-11-09', brt12('2026-11-09'));
  assert.equal(mem.get('dica_dia'), '2026-11-09'); assert.equal(mem.get('dica_ultimo_ciclo'), undefined);
  assert.equal(mem.get('dicas_enviadas'), undefined, 'nada enviado');
});
test('dia de ciclo: barreira + escolha validada; registra o ciclo (dry-run, nada sai)', async () => {
  const { ag, mem } = agendador();
  await ag.enviarDica('2026-11-08', brt12('2026-11-08'));
  const c = mem.get('dica_ultimo_ciclo');
  assert.equal(c.dia, '2026-11-08'); assert.ok(c.escolhida); assert.equal(c.dry_run, true);
});
test('ciclo bloqueado não desloca a agenda: 08/11 sem dica → 09/11 continua sem → 10/11 é ciclo', async () => {
  const cat = W.DICAS_CATALOGO; const salvo = cat.map((d) => d.st);
  const { ag, mem } = agendador();
  cat.forEach((d) => { d.st = 'R'; });
  try { await ag.enviarDica('2026-11-08', brt12('2026-11-08')); } finally { cat.forEach((d, k) => { d.st = salvo[k]; }); }
  assert.equal(mem.get('dica_ultimo_ciclo').enviado, false);
  assert.equal(W.diaDeCicloDica(brt12('2026-11-09')), false);
  assert.equal(W.diaDeCicloDica(brt12('2026-11-10')), true);
});
