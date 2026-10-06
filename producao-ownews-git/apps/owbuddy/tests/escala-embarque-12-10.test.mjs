/**
 * Regressão P0 — "EMBARQUE 12/10/2026 (14x14) virou 10/10 no app".
 *
 * Regra de negócio (idêntica ao OWNews web):
 *   dataRef=2026-10-12, tipoRef=embarquei  →  12/10 é EXATAMENTE o dia 1 embarcado.
 *   25/10 = EMB D14 · 26/10 = FOLGA D1 · 08/11 = FOLGA D14 · 09/11 = EMB D1.
 *   10/10 e 11/10 pertencem à folga ANTERIOR (nunca ao novo embarque).
 *
 * Todos os testes usam o domínio REAL (packages/ow-domain/src) — nenhuma
 * reimplementação inline. TZ fixado em America/Sao_Paulo antes de qualquer Date.
 */
process.env.TZ = 'America/Sao_Paulo';

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./_ts-resolver.mjs', import.meta.url);

let D;
before(async () => {
  D = await import('../../../packages/ow-domain/src/index.ts');
});

const CFG = Object.freeze({ tipo: '14x14', dataRef: '2026-10-12', tipoRef: 'embarquei' });
// meio-dia local em São Paulo — longe de qualquer virada de dia
const meioDia = iso => new Date(`${iso}T12:00:00-03:00`);

// ─── calcEscalaParaDia: o ciclo exato ─────────────────────────────────────

test('12/10 é EXATAMENTE o dia 1 embarcado (não 10/10, não 13/10)', () => {
  const r = D.calcEscalaParaDia(CFG, '2026-10-12');
  assert.equal(r.embarcado, true);
  assert.equal(r.diaDoBloco, 1);
  assert.equal(r.diasRestantes, 14);
});

test('25/10 = embarcado dia 14 (último dia a bordo)', () => {
  const r = D.calcEscalaParaDia(CFG, '2026-10-25');
  assert.equal(r.embarcado, true);
  assert.equal(r.diaDoBloco, 14);
  assert.equal(r.diasRestantes, 1);
});

test('26/10 = folga dia 1', () => {
  const r = D.calcEscalaParaDia(CFG, '2026-10-26');
  assert.equal(r.embarcado, false);
  assert.equal(r.diaDoBloco, 1);
});

test('08/11 = folga dia 14 (último dia de folga)', () => {
  const r = D.calcEscalaParaDia(CFG, '2026-11-08');
  assert.equal(r.embarcado, false);
  assert.equal(r.diaDoBloco, 14);
  assert.equal(r.diasRestantes, 1);
});

test('09/11 = próximo embarque, dia 1', () => {
  const r = D.calcEscalaParaDia(CFG, '2026-11-09');
  assert.equal(r.embarcado, true);
  assert.equal(r.diaDoBloco, 1);
});

test('10/10 e 11/10 NÃO fazem parte do novo embarque (folga anterior, dias 13 e 14)', () => {
  const d10 = D.calcEscalaParaDia(CFG, '2026-10-10');
  const d11 = D.calcEscalaParaDia(CFG, '2026-10-11');
  assert.equal(d10.embarcado, false);
  assert.equal(d10.diaDoBloco, 13);
  assert.equal(d11.embarcado, false);
  assert.equal(d11.diaDoBloco, 14);
  assert.equal(d11.diasRestantes, 1, 'na véspera falta exatamente 1 dia para embarcar');
});

test('ciclo inteiro de 28 dias a partir de 12/10 é contíguo e sem furos', () => {
  for (let i = 0; i < 56; i++) {
    const iso = D.somarDiasISO('2026-10-12', i);
    const r = D.calcEscalaParaDia(CFG, iso);
    const esperadoEmb = (i % 28) < 14;
    const esperadoDia = (i % 28) < 14 ? (i % 28) + 1 : (i % 28) - 14 + 1;
    assert.equal(r.embarcado, esperadoEmb, `${iso} embarcado`);
    assert.equal(r.diaDoBloco, esperadoDia, `${iso} diaDoBloco`);
  }
});

// ─── resumoEscala / countdown (Home, Meu Embarque, Minha Escala) ─────────

test('resumoEscala em 05/10: DE_FOLGA dia 8 de 14, faltam 7 dias, embarca 12/10, desembarca 26/10', () => {
  const r = D.resumoEscala(CFG, meioDia('2026-10-05'));
  assert.equal(r.estado, 'DE_FOLGA');
  assert.equal(r.hojeISO, '2026-10-05');
  assert.equal(r.calc.diaDoBloco, 8);
  assert.equal(r.calc.dFo, 14);
  assert.equal(r.diasParaEmbarque, 7);
  assert.equal(r.proximoEmbarqueISO, '2026-10-12');
  assert.equal(r.proximoDesembarqueISO, '2026-10-26');
  // O sintoma do bug era "Dia 10 de 14 · 5 dias p/ embarque" (anchor 10/10):
  assert.notEqual(r.calc.diaDoBloco, 10);
  assert.notEqual(r.diasParaEmbarque, 5);
});

test('resumoEscala em 11/10 (véspera): faltam 1 dia; em 12/10: EMBARCADO dia 1 de 14', () => {
  const vespera = D.resumoEscala(CFG, meioDia('2026-10-11'));
  assert.equal(vespera.estado, 'DE_FOLGA');
  assert.equal(vespera.diasParaEmbarque, 1);
  assert.equal(vespera.proximoEmbarqueISO, '2026-10-12');

  const dia1 = D.resumoEscala(CFG, meioDia('2026-10-12'));
  assert.equal(dia1.estado, 'EMBARCADO');
  assert.equal(dia1.calc.diaDoBloco, 1);
  assert.equal(dia1.calc.dEm, 14);
  assert.equal(dia1.diasParaDesembarque, 14);
  assert.equal(dia1.proximoDesembarqueISO, '2026-10-26');
  assert.equal(dia1.proximoEmbarqueISO, '2026-11-09');
  assert.equal(dia1.progresso, 1 / 14);
});

test('resumoEscala em 25/10: EMBARCADO dia 14, desembarca amanhã (26/10)', () => {
  const r = D.resumoEscala(CFG, meioDia('2026-10-25'));
  assert.equal(r.estado, 'EMBARCADO');
  assert.equal(r.calc.diaDoBloco, 14);
  assert.equal(r.diasParaDesembarque, 1);
  assert.equal(r.proximoDesembarqueISO, '2026-10-26');
  assert.equal(r.progresso, 1);
});

test('proximoEmbarqueISO / proximoDesembarqueISO (funções soltas) batem com o resumo', () => {
  assert.equal(D.proximoEmbarqueISO(CFG, meioDia('2026-10-05')), '2026-10-12');
  assert.equal(D.proximoDesembarqueISO(CFG, meioDia('2026-10-05')), '2026-10-26');
  assert.equal(D.proximoEmbarqueISO(CFG, meioDia('2026-10-26')), '2026-11-09');
  assert.equal(D.proximoDesembarqueISO(CFG, meioDia('2026-11-09')), '2026-11-23');
});

test('calcularMomento em 05/10 = FOLGA com 7 dias p/ embarque (Home)', () => {
  const m = D.calcularMomento(CFG, meioDia('2026-10-05'));
  assert.equal(m.tipo, 'FOLGA');
  assert.equal(m.diasEmbarque, 7);
});

// ─── Calendário (Minha Escala) ────────────────────────────────────────────

test('calendário de outubro: verde exatamente de 12 a 25; 10 e 11 em folga', () => {
  const dias = D.gerarMesDias(CFG, [], [], [], 2026, 10, '2026-10-05');
  const verdes = dias.filter(d => d.kind === 'EMBARCADO').map(d => parseInt(d.iso.slice(8), 10));
  assert.deepEqual(verdes, [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);
  const by = Object.fromEntries(dias.map(d => [d.iso, d]));
  assert.equal(by['2026-10-10'].kind, 'FOLGA');
  assert.equal(by['2026-10-11'].kind, 'FOLGA');
  assert.equal(by['2026-10-12'].isEmbarque, true, 'marcador de embarque no dia 12');
  assert.equal(by['2026-10-10'].isEmbarque, false);
  assert.equal(by['2026-10-26'].isDesembarque, true, 'marcador de desembarque no dia 26');
  assert.equal(by['2026-10-05'].isHoje, true);
});

test('calendário de novembro: folga 1–8, embarque dia 9 (marcador), verde 9–22', () => {
  const dias = D.gerarMesDias(CFG, [], [], [], 2026, 11, '2026-10-05');
  const by = Object.fromEntries(dias.map(d => [d.iso, d]));
  for (let i = 1; i <= 8; i++) assert.equal(by[`2026-11-0${i}`].kind, 'FOLGA', `01..08/11 folga (${i})`);
  assert.equal(by['2026-11-08'].diaDoBloco, 14);
  assert.equal(by['2026-11-09'].kind, 'EMBARCADO');
  assert.equal(by['2026-11-09'].isEmbarque, true);
  const verdes = dias.filter(d => d.kind === 'EMBARCADO').map(d => parseInt(d.iso.slice(8), 10));
  assert.deepEqual(verdes, Array.from({ length: 14 }, (_, i) => 9 + i));
});

// ─── Fuso horário: "2026-10-12" NUNCA vira 11/10 nem 13/10 ───────────────

test('fronteira de fuso (BRT): 23:59 de 11/10 ainda é folga D14; 00:00 de 12/10 já é EMB D1', () => {
  // 2026-10-12T02:59:59Z == 11/10 23:59:59 em São Paulo
  const antes = D.resumoEscala(CFG, new Date('2026-10-12T02:59:59Z'));
  assert.equal(antes.hojeISO, '2026-10-11');
  assert.equal(antes.estado, 'DE_FOLGA');
  assert.equal(antes.calc.diaDoBloco, 14);
  // 2026-10-12T03:00:00Z == 12/10 00:00:00 em São Paulo
  const depois = D.resumoEscala(CFG, new Date('2026-10-12T03:00:00Z'));
  assert.equal(depois.hojeISO, '2026-10-12');
  assert.equal(depois.estado, 'EMBARCADO');
  assert.equal(depois.calc.diaDoBloco, 1);
  // 2026-10-13T02:30:00Z == 12/10 23:30 em São Paulo — ainda dia 1, não dia 2
  const noite = D.resumoEscala(CFG, new Date('2026-10-13T02:30:00Z'));
  assert.equal(noite.hojeISO, '2026-10-12');
  assert.equal(noite.calc.diaDoBloco, 1);
});

test('isoParaMs/msParaISO/normalizarDia preservam o dia civil "2026-10-12" (ida e volta)', () => {
  assert.equal(D.msParaISO(D.isoParaMs('2026-10-12')), '2026-10-12');
  assert.equal(D.msParaISO(D.normalizarDia(new Date('2026-10-12T00:00:00-03:00'))), '2026-10-12');
  assert.equal(D.msParaISO(D.normalizarDia(new Date('2026-10-12T23:59:59-03:00'))), '2026-10-12');
  assert.equal(D.hojeISO(new Date('2026-10-12T00:00:00-03:00')), '2026-10-12');
  assert.equal(D.hojeISO(new Date('2026-10-12T23:59:59-03:00')), '2026-10-12');
  assert.equal(D.diasEntreISO('2026-10-12', '2026-10-25'), 13);
  assert.equal(D.diasEntreISO('2026-10-12', '2026-11-09'), 28);
});

// ─── Codec: nenhum formato de storage desloca a dataRef ──────────────────

test('todos os formatos de storage (web plano, v1, v2, BR, refUTC, datetime) dão dataRef 2026-10-12 e EMB D1 em 12/10', () => {
  const variantes = {
    'app cru':        { tipo: '14x14', dataRef: '2026-10-12', tipoRef: 'embarquei' },
    'web plano':      { tipo: '14x14', diasEmbarcado: 14, diasFolga: 14, data: '2026-10-12', tipoRef: 'embarquei', aeroporto: '', excecoes: [] },
    'v1 envelope':    { data: { tipo: '14x14', dataRef: '2026-10-12', tipoRef: 'embarquei', updated_at: '2026-10-05T10:00:00.000Z' } },
    'v2 envelope':    { v: 2, data: { tipo: '14x14', dataRef: '2026-10-12', tipoRef: 'embarquei' }, updated_at: '2026-10-05T10:00:00.000Z' },
    'data BR':        { tipo: '14x14', data: '12/10/2026', tipoRef: 'embarquei' },
    'datetime UTC':   { tipo: '14x14', data: '2026-10-12T00:00:00.000Z', tipoRef: 'embarquei' },
    'refUTC 00Z':     { tipo: '14x14', refUTC: Date.parse('2026-10-12T00:00:00Z'), tipoRef: 'embarquei' },
    'refUTC 12Z':     { tipo: '14x14', refUTC: Date.UTC(2026, 9, 12, 12), tipoRef: 'embarquei' },
    'tipoRef EMBARQUE (legado)': { tipo: '14x14', data: '2026-10-12', tipoRef: 'EMBARQUE' },
    'tipoRef ausente':           { tipo: '14x14', data: '2026-10-12' },
  };
  for (const [nome, raw] of Object.entries(variantes)) {
    const cfg = D.normalizeEscalaConfig(raw);
    assert.ok(cfg, `${nome}: normaliza`);
    assert.equal(cfg.dataRef, '2026-10-12', `${nome}: dataRef`);
    assert.equal(cfg.tipoRef, 'embarquei', `${nome}: tipoRef`);
    const r = D.calcEscalaParaDia(cfg, '2026-10-12');
    assert.equal(r.embarcado && r.diaDoBloco === 1, true, `${nome}: 12/10 = EMB D1`);
    assert.equal(D.calcEscalaParaDia(cfg, '2026-10-10').embarcado, false, `${nome}: 10/10 NÃO embarcado`);
  }
});

test('round-trip app → web → app (toWebEscalaConfig/normalize) mantém 12/10 e o codec preserva origem/carimbo', () => {
  const web = D.toWebEscalaConfig(CFG);
  assert.equal(web.data, '2026-10-12');
  assert.equal(web.tipoRef, 'embarquei');
  const volta = D.normalizeEscalaConfig(web);
  assert.equal(volta.dataRef, '2026-10-12');

  const env = D.toEscalaEnvelope({ ...CFG, origem: 'conta' }, '2026-10-03T09:00:00.000Z');
  const lido = D.normalizeEscalaConfig(env);
  assert.equal(lido.dataRef, '2026-10-12');
  assert.equal(lido.origem, 'conta');
  assert.equal(lido.updated_at, '2026-10-03T09:00:00.000Z', 'carimbo explícito é preservado (não vira "agora")');
  assert.equal(D.normalizeEscalaConfig({ ...CFG, origem: 'lixo' }).origem, undefined);
});

// ─── Dobra / férias: visuais, nunca alteram a dataRef nem o dia 1 ─────────

test('dobra em 10–11/10 e férias em 20–22/10 não deslocam o ciclo nem a dataRef', () => {
  const excecoes = [
    { id: 'd1', tipo: 'dobra',  ini: '2026-10-10', fim: '2026-10-11' },
    { id: 'f1', tipo: 'ferias', ini: '2026-10-20', fim: '2026-10-22' },
  ];
  const cfg = { ...CFG, excecoes };
  assert.equal(cfg.dataRef, '2026-10-12');
  const dias = D.gerarMesDias(cfg, excecoes, [], [], 2026, 10, '2026-10-05');
  const by = Object.fromEntries(dias.map(d => [d.iso, d]));
  assert.equal(by['2026-10-10'].kind, 'DOBRA');
  assert.equal(by['2026-10-11'].kind, 'DOBRA');
  assert.equal(by['2026-10-12'].kind, 'EMBARCADO');
  assert.equal(by['2026-10-12'].diaDoBloco, 1);
  assert.equal(by['2026-10-12'].isEmbarque, true);
  assert.equal(by['2026-10-21'].kind, 'FERIAS');
  assert.equal(by['2026-10-21'].diaDoBloco, 10, 'dia do bloco base continua contando por baixo das férias');
  assert.equal(by['2026-10-25'].kind, 'EMBARCADO');
  assert.equal(by['2026-10-25'].diaDoBloco, 14);
  assert.equal(by['2026-10-26'].kind, 'FOLGA');
  // resumo em 05/10 idêntico ao da config sem exceções
  const semExc = D.resumoEscala(CFG, meioDia('2026-10-05'));
  const comExc = D.resumoEscala(cfg, meioDia('2026-10-05'));
  assert.deepEqual(comExc, semExc);
});

// ─── Sync conta OW: config antiga da nuvem NUNCA sobrescreve a nova do aparelho ─

test('nuvemDeveSubstituirLocal: escala 12/10 editada no aparelho vence uma 10/10 mais antiga na conta', () => {
  const local = { ...CFG, updated_at: '2026-10-05T18:00:00.000Z', origem: 'dispositivo' };
  const nuvemVelha = D.escolherEscalaDaNuvem({
    escala_config: { tipo: '14x14', diasEmbarcado: 14, diasFolga: 14, data: '2026-10-10', tipoRef: 'embarquei', salvo_em: '2026-10-03T10:00:00.000Z' },
  });
  assert.equal(nuvemVelha.cfg.dataRef, '2026-10-10');
  assert.equal(D.nuvemDeveSubstituirLocal(local, nuvemVelha), false);
  // legado Buddy antigo na nuvem também não vence
  const legadoVelho = D.escolherEscalaDaNuvem({
    ownews_minha_escala: { data: { tipo: '14x14', dataRef: '2026-10-10', tipoRef: 'embarquei' }, updated_at: '2026-10-04T10:00:00.000Z' },
  });
  assert.equal(D.nuvemDeveSubstituirLocal(local, legadoVelho), false);
});

test('nuvemDeveSubstituirLocal: só uma edição ESTRITAMENTE mais nova na conta substitui; empate → local', () => {
  const local = { ...CFG, updated_at: '2026-10-05T18:00:00.000Z' };
  const mk = salvo_em => D.escolherEscalaDaNuvem({ escala_config: { tipo: '14x14', data: '2026-10-19', tipoRef: 'embarquei', salvo_em } });
  assert.equal(D.nuvemDeveSubstituirLocal(local, mk('2026-10-06T08:00:00.000Z')), true);
  assert.equal(D.nuvemDeveSubstituirLocal(local, mk('2026-10-05T18:00:00.000Z')), false);
  assert.equal(D.nuvemDeveSubstituirLocal(local, mk('2026-10-05T17:59:59.000Z')), false);
});

test('nuvemDeveSubstituirLocal: sem escala local → nuvem entra; local sem carimbo → local vence; sem nuvem → nada', () => {
  const nuvem = D.escolherEscalaDaNuvem({ escala_config: { tipo: '14x14', data: '2026-10-10', tipoRef: 'embarquei', salvo_em: '2026-10-03T10:00:00.000Z' } });
  assert.equal(D.nuvemDeveSubstituirLocal(null, nuvem), true);
  assert.equal(D.nuvemDeveSubstituirLocal(undefined, nuvem), true);
  assert.equal(D.nuvemDeveSubstituirLocal({ ...CFG }, nuvem), false, 'config local sem updated_at nunca é trocada em silêncio');
  assert.equal(D.nuvemDeveSubstituirLocal({ ...CFG, updated_at: 'lixo' }, nuvem), false);
  assert.equal(D.nuvemDeveSubstituirLocal({ ...CFG, updated_at: '2026-10-05T18:00:00.000Z' }, null), false);
  assert.equal(D.nuvemDeveSubstituirLocal(null, null), false);
});

test('carimboParaISO: carimbo da nuvem é preservado ao gravar localmente (não vira "agora")', () => {
  const at = Date.parse('2026-10-03T10:00:00.000Z');
  assert.equal(D.carimboParaISO(at), '2026-10-03T10:00:00.000Z');
  assert.equal(D.carimboParaISO(0), undefined);
  assert.equal(D.carimboParaISO(NaN), undefined);
  const env = D.toEscalaEnvelope({ ...CFG, origem: 'conta' }, D.carimboParaISO(at));
  assert.equal(env.updated_at, '2026-10-03T10:00:00.000Z');
  assert.equal(env.data.updated_at, '2026-10-03T10:00:00.000Z');
  // e, puxada com o carimbo real, uma edição local posterior volta a vencer no push
  const local = D.normalizeEscalaConfig(env);
  const nuvem = D.escolherEscalaDaNuvem({ escala_config: { ...D.toWebEscalaConfig(CFG), salvo_em: '2026-10-03T10:00:00.000Z' } });
  assert.equal(D.podeGravarEscalaNaNuvem(local, nuvem), true);
  assert.equal(D.nuvemDeveSubstituirLocal(local, nuvem), false, 'mesma versão: não regrava');
});
