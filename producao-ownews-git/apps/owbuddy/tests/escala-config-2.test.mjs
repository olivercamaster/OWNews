/**
 * Configuração de Escala 2.0 (2026-10-24) — regressões do teste real do dono:
 *  A) o seletor abria em "agosto/2024" (posição visual desalinhada do estado);
 *  B) "embarque 16/10/2026" configurado em 24/10 virava "embarquei hoje"
 *     (na web a rolagem não atualizava a seleção e o OK salvava o dia inicial).
 * "Hoje" é sempre injetado — nada depende do relógio real.
 */
process.env.TZ = 'America/Sao_Paulo';

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./_ts-resolver.mjs', import.meta.url);

let D, S;
before(async () => {
  D = await import('../../../packages/ow-domain/src/index.ts');
  S = await import('../src/data-seletor.ts');
});

const meioDia = iso => new Date(`${iso}T12:00:00-03:00`);
const cfg = (dataRef, tipo = '14x14', tipoRef = 'embarquei') => ({ tipo, dataRef, tipoRef });
const CASO = cfg('2026-10-16');
const HOJE = meioDia('2026-10-24');

// ─── Caso real obrigatório ──────────────────────────────────────────────────

test('caso real: embarque 16/10/2026, hoje 24/10/2026, 14x14 → EMBARCADO Dia 9, desembarque 30/10, embarque 13/11', () => {
  const r = D.resumoEscala(CASO, HOJE);
  assert.equal(r.estado, 'EMBARCADO');
  assert.equal(r.calc.diaDoBloco, 9);
  assert.equal(r.diasParaDesembarque, 6);
  assert.equal(r.proximoDesembarqueISO, '2026-10-30');
  assert.equal(r.proximoEmbarqueISO, '2026-11-13');
  const isEmbarkToday = D.estadoEscalaNoDia(CASO, [], r.hojeISO).isEmbarque;
  assert.equal(isEmbarkToday, false);
  const home = D.contextoHome(r, D.calcularMomento(CASO, HOJE), null);
  assert.equal(home.titulo, 'Você está embarcado');
  assert.equal(home.destaque, 'Dia 9 de 14');
  assert.equal(home.detalhe, 'Faltam 6 dias pra casa.');
});

test('caso real dia a dia: 16–29/10 embarcado Dia 1–14, 30/10 folga Dia 1 (desembarque), 12/11 folga Dia 14, 13/11 embarque', () => {
  for (let i = 0; i < 14; i++) {
    const iso = D.somarDiasISO('2026-10-16', i);
    const e = D.estadoEscalaNoDia(CASO, [], iso);
    assert.equal(e.kind, 'EMBARCADO', iso);
    assert.equal(e.diaDoBloco, i + 1, iso);
    assert.equal(e.isEmbarque, i === 0, iso);
  }
  const d30 = D.estadoEscalaNoDia(CASO, [], '2026-10-30');
  assert.deepEqual([d30.kind, d30.diaDoBloco, d30.isDesembarque], ['FOLGA', 1, true]);
  const d12 = D.estadoEscalaNoDia(CASO, [], '2026-11-12');
  assert.deepEqual([d12.kind, d12.diaDoBloco], ['FOLGA', 14]);
  const d13 = D.estadoEscalaNoDia(CASO, [], '2026-11-13');
  assert.deepEqual([d13.kind, d13.diaDoBloco, d13.isEmbarque], ['EMBARCADO', 1, true]);
});

test('referência = hoje → Dia 1, "Hoje é dia de embarque" (isEmbarkToday = true)', () => {
  const c = cfg('2026-10-24');
  const r = D.resumoEscala(c, HOJE);
  assert.equal(r.calc.diaDoBloco, 1);
  assert.equal(D.estadoEscalaNoDia(c, [], r.hojeISO).isEmbarque, true);
  assert.equal(D.contextoHome(r, D.calcularMomento(c, HOJE), null).titulo, 'Hoje é dia de embarque');
});

test('referência = ontem → Dia 2, "Você embarcou ontem" (nunca "hoje")', () => {
  const c = cfg('2026-10-23');
  const r = D.resumoEscala(c, HOJE);
  assert.equal(r.calc.diaDoBloco, 2);
  assert.equal(D.contextoHome(r, D.calcularMomento(c, HOJE), null).titulo, 'Você embarcou ontem');
});

test('desembarque hoje → folga Dia 1, "Desembarque hoje"', () => {
  const c = cfg('2026-10-10'); // 10–23 embarcado, 24/10 = folga D1
  const r = D.resumoEscala(c, HOJE);
  assert.equal(r.estado, 'DE_FOLGA');
  assert.equal(D.contextoHome(r, D.calcularMomento(c, HOJE), null).titulo, 'Desembarque hoje');
});

// ─── Resumo antes de confirmar ─────────────────────────────────────────────

test('confirmação antes de salvar: mesma regra canônica, sem data de cadastro', () => {
  const c = D.confirmacaoEscala(CASO, HOJE);
  assert.deepEqual(c, {
    ciclo: '14 × 14', dataRefISO: '2026-10-16', futura: false, estado: 'EMBARCADO',
    hoje: 'Embarcado · Dia 9 de 14', proximoDesembarqueISO: '2026-10-30', proximoEmbarqueISO: '2026-11-13',
  });
  // salvar/configurar em outro dia não muda nada: só dataRef importa
  const comCarimbo = { ...CASO, updated_at: '2026-10-24T23:50:00.000Z', origem: 'dispositivo' };
  assert.deepEqual(D.confirmacaoEscala(comCarimbo, HOJE), c);
  assert.equal(D.confirmacaoEscala({ tipo: '14x14', tipoRef: 'embarquei' }, HOJE), null, 'sem data → sem resumo (nada fingido)');
});

test('data futura: permitida (pode ser o próximo embarque), sinalizada e coerente', () => {
  const c = D.confirmacaoEscala(cfg('2026-11-13'), HOJE);
  assert.equal(c.futura, true);
  // 13/11 como embarque implica o mesmo ciclo do caso real
  assert.equal(c.hoje, 'Embarcado · Dia 9 de 14');
  assert.equal(c.proximoEmbarqueISO, '2026-11-13');
});

// ─── Datas: meses atrás, ano anterior, 23:59, 00:01, fuso ─────────────────────

test('referência meses atrás e no ano anterior: mesma fase do ciclo', () => {
  // 16/10 − 28·k dias está sempre na mesma fase de um 14x14
  for (const k of [3, 6, 13]) {
    const ref = D.somarDiasISO('2026-10-16', -28 * k);
    assert.equal(D.resumoEscala(cfg(ref), HOJE).calc.diaDoBloco, 9, ref);
  }
  assert.ok(D.somarDiasISO('2026-10-16', -28 * 13) < '2026-01-01', 'ano anterior coberto');
});

test('23:59 e 00:01 em São Paulo: o dia vira pelo relógio LOCAL (não UTC)', () => {
  const r2359 = D.resumoEscala(CASO, new Date(2026, 9, 24, 23, 59)); // 02:59Z do dia 25
  assert.equal(r2359.hojeISO, '2026-10-24');
  assert.equal(r2359.calc.diaDoBloco, 9);
  const r0001 = D.resumoEscala(CASO, new Date(2026, 9, 25, 0, 1));
  assert.equal(r0001.hojeISO, '2026-10-25');
  assert.equal(r0001.calc.diaDoBloco, 10);
  const r2101 = D.resumoEscala(CASO, new Date('2026-10-24T21:01:00-03:00')); // já é dia 25 em UTC
  assert.equal(r2101.calc.diaDoBloco, 9, '21h BRT não pula para o dia seguinte');
});

test('16/10 nunca vira 15/10 ou 17/10: dataRef é dia civil e só existe no formato YYYY-MM-DD', () => {
  for (const h of [0, 1, 20, 21, 22, 23]) {
    const r = D.resumoEscala(CASO, new Date(2026, 9, 16, h, 30));
    assert.equal(r.calc.diaDoBloco, 1, `16/10 ${h}h30`);
  }
});

// ─── Persistência / offline / edição ─────────────────────────────────────────

test('reload/offline: só a referência é persistida; o Dia N é derivado no dia de abrir', () => {
  const env = D.toEscalaEnvelope(CASO, '2026-10-24T12:00:00.000Z');
  const json = JSON.stringify(env);
  assert.ok(!/diaDoBloco|"dia"|Dia 9/.test(json), 'Dia N não pode ser gravado');
  const lido = D.normalizeEscalaConfig(JSON.parse(json));
  assert.equal(lido.dataRef, '2026-10-16');
  assert.equal(D.resumoEscala(lido, meioDia('2026-10-24')).calc.diaDoBloco, 9);
  assert.equal(D.resumoEscala(lido, meioDia('2026-10-27')).calc.diaDoBloco, 12, 'os dias passam sozinhos');
});

test('editar referência: nova data recalcula tudo; escala antiga não é migrada para hoje', () => {
  const antiga = cfg('2025-03-02');
  assert.equal(D.normalizeEscalaConfig(D.toEscalaEnvelope(antiga)).dataRef, '2025-03-02');
  const editada = { ...antiga, dataRef: '2026-10-16' };
  assert.equal(D.resumoEscala(editada, HOJE).calc.diaDoBloco, 9);
});

// ─── Seletor de data ────────────────────────────────────────────────────────

test('seletor SEM valor salvo abre no dia/mês/ano LOCAL de hoje (nunca 2024 fixo)', () => {
  assert.deepEqual(S.dataInicialSeletor(undefined, new Date(2026, 9, 24, 23, 59)), { d: 24, m: 10, y: 2026 });
  assert.deepEqual(S.dataInicialSeletor('', new Date(2026, 9, 25, 0, 1)), { d: 25, m: 10, y: 2026 });
  assert.deepEqual(S.dataInicialSeletor(undefined, new Date(2027, 0, 1, 9)), { d: 1, m: 1, y: 2027 });
});

test('seletor COM valor salvo abre na data salva (edição)', () => {
  assert.deepEqual(S.dataInicialSeletor('2026-10-16', new Date(2026, 9, 24)), { d: 16, m: 10, y: 2026 });
});

test('anos do seletor: 2024, 2025, 2027… alcançáveis; ano salvo antigo sempre presente', () => {
  const anos = S.anosDoSeletor(new Date(2026, 9, 24));
  for (const y of [2018, 2024, 2025, 2026, 2027, 2036]) assert.ok(anos.includes(y), String(y));
  assert.ok(S.anosDoSeletor(new Date(2026, 9, 24), '2009-05-01').includes(2009));
  assert.equal(new Set(anos).size, anos.length);
});

test('data por extenso mostra exatamente o que o OK vai salvar', () => {
  assert.equal(S.dataPorExtenso(16, 10, 2026), 'sexta, 16 de outubro de 2026');
  assert.equal(S.dataPorExtenso(29, 2, 2028), 'terça, 29 de fevereiro de 2028');
});

// ─── Ciclos suportados ──────────────────────────────────────────────────────

test('todos os ciclos: Dia 1, meio, último embarcado, desembarque, folga Dia 1, último de folga, próximo embarque', () => {
  const casos = [['14x14', 14, 14], ['14x21', 14, 21], ['14x28', 14, 28], ['28x28', 28, 28], ['21x21', 21, 21], ['7x7', 7, 7]];
  for (const [tipo, dEm, dFo] of casos) {
    const c = cfg('2026-10-16', tipo);
    const at = n => D.estadoEscalaNoDia(c, [], D.somarDiasISO('2026-10-16', n));
    assert.deepEqual([at(0).kind, at(0).diaDoBloco, at(0).isEmbarque], ['EMBARCADO', 1, true], tipo);
    assert.equal(at(Math.floor(dEm / 2)).diaDoBloco, Math.floor(dEm / 2) + 1, tipo);
    assert.deepEqual([at(dEm - 1).kind, at(dEm - 1).diaDoBloco], ['EMBARCADO', dEm], tipo);
    assert.deepEqual([at(dEm).kind, at(dEm).diaDoBloco, at(dEm).isDesembarque], ['FOLGA', 1, true], tipo);
    assert.deepEqual([at(dEm + dFo - 1).kind, at(dEm + dFo - 1).diaDoBloco], ['FOLGA', dFo], tipo);
    assert.deepEqual([at(dEm + dFo).kind, at(dEm + dFo).diaDoBloco], ['EMBARCADO', 1], tipo);
    const r = D.resumoEscala(c, meioDia('2026-10-16'));
    assert.equal(r.proximoDesembarqueISO, D.somarDiasISO('2026-10-16', dEm), tipo);
    assert.equal(r.proximoEmbarqueISO, D.somarDiasISO('2026-10-16', dEm + dFo), tipo);
  }
  const custom = { tipo: 'custom', diasEmbarcado: 21, diasFolga: 28, dataRef: '2026-10-16', tipoRef: 'embarquei' };
  assert.equal(D.resumoEscala(custom, HOJE).calc.diaDoBloco, 9);
  assert.equal(D.confirmacaoEscala(custom, HOJE).ciclo, '21 × 28');
});

test('virada de mês, de ano, fevereiro e ano bissexto', () => {
  // ano: embarque 25/12/2027 → 07/01/2028 último dia, 08/01 desembarque
  const ano = cfg('2027-12-25');
  assert.equal(D.estadoEscalaNoDia(ano, [], '2028-01-07').diaDoBloco, 14);
  assert.equal(D.estadoEscalaNoDia(ano, [], '2028-01-08').isDesembarque, true);
  // bissexto: 20/02/2028 → 29/02 é Dia 10; 04/03 desembarque
  const bis = cfg('2028-02-20');
  assert.equal(D.estadoEscalaNoDia(bis, [], '2028-02-29').diaDoBloco, 10);
  assert.equal(D.estadoEscalaNoDia(bis, [], '2028-03-05').isDesembarque, true);
  // fevereiro comum: 20/02/2027 → 05/03 é o Dia 14, 06/03 desembarque (28 dias em fevereiro)
  const fev = cfg('2027-02-20');
  assert.equal(D.estadoEscalaNoDia(fev, [], '2027-03-05').diaDoBloco, 14);
  assert.equal(D.estadoEscalaNoDia(fev, [], '2027-03-06').isDesembarque, true);
  assert.equal(D.isoValido('2027-02-29'), false);
  // mês: 25/10 → 07/11 último dia
  assert.equal(D.estadoEscalaNoDia(cfg('2026-10-25'), [], '2026-11-07').diaDoBloco, 14);
});

// ─── Consistência entre telas (mesma referência, mesmo "hoje") ───────────────

test('cross-feature: Home, calendário, Meu Embarque, Buddy Agora, Próximos e lembretes concordam', () => {
  const r = D.resumoEscala(CASO, HOJE);
  // Calendário de outubro/novembro
  const out = D.gerarMesDias(CASO, [], [], 2026, 10, r.hojeISO);
  const nov = D.gerarMesDias(CASO, [], [], 2026, 11, r.hojeISO);
  const hojeCal = out.find(d => d.isHoje);
  assert.equal(hojeCal.iso, '2026-10-24');
  assert.equal(hojeCal.kind, 'EMBARCADO');
  assert.equal(hojeCal.diaDoBloco, r.calc.diaDoBloco);
  assert.deepEqual(out.filter(d => d.isEmbarque).map(d => d.iso), ['2026-10-16']);
  // 02/10 = desembarque do ciclo anterior; 30/10 = o deste embarque
  assert.deepEqual(out.filter(d => d.isDesembarque).map(d => d.iso), ['2026-10-02', '2026-10-30']);
  assert.deepEqual(nov.filter(d => d.isEmbarque).map(d => d.iso), ['2026-11-13']);
  assert.ok(out.filter(d => d.iso >= '2026-10-16' && d.iso <= '2026-10-29').every(d => d.kind === 'EMBARCADO'));
  assert.ok([...out, ...nov].filter(d => d.iso >= '2026-10-30' && d.iso <= '2026-11-12').every(d => d.kind === 'FOLGA'));
  // Meu Embarque usa proximoEmbarqueISO (após a folga) — futuro, nunca 16/10
  assert.equal(r.proximoEmbarqueISO, '2026-11-13');
  // Buddy Agora / Próximos: desembarque 30/10 e embarque 13/11, nada no passado
  const ac = D.gerarAcontecimentos({ escala: CASO, checklist: null, certs: [], viagem: null, eventos: [], pagamento: null, hoje: HOJE });
  const esc = ac.filter(a => a.origem === 'escala');
  assert.deepEqual(esc.map(a => [a.tipo, a.dataISO]).sort(), [['DESEMBARQUE', '2026-10-30'], ['EMBARQUE', '2026-11-13']]);
  assert.ok(ac.every(a => a.dataISO >= '2026-10-24'), 'evento no passado');
  assert.ok(!ac.some(a => a.dataISO === '2026-10-16'));
  // Lembretes: derivados do próximo embarque, nenhum no passado
  const lem = D.planejarLembretes({ escala: CASO, checklist: null, certs: [], viagem: null, prefs: { ...D.PREFS_LEMBRETES_PADRAO, ativo: true }, agora: HOJE });
  const embs = lem.filter(l => l.tipo === 'embarque').map(l => l.quando).sort();
  assert.deepEqual(embs, ['2026-11-10T09:00', '2026-11-12T18:00']);
  assert.ok(lem.every(l => l.quando > '2026-10-24T12:00'));
  assert.ok(!lem.some(l => /hoje/i.test(l.titulo) && l.tipo === 'embarque'));
});

test('cruzar: cada pessoa mantém a própria referência; a principal não é afetada', () => {
  const ana = { id: 'a', nome: 'Ana', tipo: '14x14', dataRef: '2026-10-30', tipoRef: 'embarquei' };
  // Ana embarca quando eu desembarco → nunca de folga juntos
  assert.equal(D.juntosNoDia(CASO, [ana], '2026-10-24').length, 0);
  assert.equal(D.juntosNoDia(CASO, [ana], '2026-11-05').length, 0);
  const bia = { id: 'b', nome: 'Bia', tipo: '14x14', dataRef: '2026-10-16', tipoRef: 'embarquei' };
  assert.equal(D.juntosNoDia(CASO, [bia], '2026-11-05').length, 1, 'mesmo ciclo → folga juntos');
  assert.equal(D.resumoEscala(CASO, HOJE).calc.diaDoBloco, 9);
});
