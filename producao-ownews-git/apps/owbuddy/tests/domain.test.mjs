/**
 * Testes contra o domínio REAL (packages/ow-domain/src), não cópias inline.
 * Roda com: node --test tests/domain.test.mjs   (Node >= 22.18, type-stripping nativo)
 *
 * TZ é fixado em America/Sao_Paulo ANTES de qualquer Date para provar que a
 * escala é contada em dia de calendário local (bug do salto às 21:00 BRT).
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

const CFG = { tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'embarquei' };

// ─── hojeISO / normalização de dia local ───────────────────────────────────

test('hojeISO usa data LOCAL, não UTC (23:30 BRT ainda é o mesmo dia)', () => {
  // 2026-10-06T02:30Z == 2026-10-05 23:30 em São Paulo
  const d = new Date('2026-10-06T02:30:00Z');
  assert.equal(d.toISOString().slice(0, 10), '2026-10-06', 'sanidade: UTC já virou o dia');
  assert.equal(D.hojeISO(d), '2026-10-05');
});

test('calcEscala às 23:30 BRT não salta para o dia seguinte', () => {
  const r = D.calcEscala(CFG, new Date('2026-10-06T02:30:00Z')); // 05/10 23:30 local
  assert.equal(r.diaDoBloco, 5);
  assert.equal(r.diasRestantes, 10);
});

test('calcEscala às 00:30 BRT já conta o novo dia', () => {
  const r = D.calcEscala(CFG, new Date('2026-10-06T03:30:00Z')); // 06/10 00:30 local
  assert.equal(r.diaDoBloco, 6);
});

// ─── Paridade com OWNews web ───────────────────────────────────────────────

test('14x14 embarquei 01/10 → 05/10 embarcado dia 5, faltam 10', () => {
  const r = D.calcEscalaParaDia(CFG, '2026-10-05');
  assert.deepEqual(r, { embarcado: true, diasRestantes: 10, dEm: 14, dFo: 14, ciclo: 28, diaDoBloco: 5 });
});

test('14x28 (preset web) → ciclo 42', () => {
  const r = D.calcEscalaParaDia({ tipo: '14x28', dataRef: '2026-10-01', tipoRef: 'embarquei' }, '2026-10-20');
  assert.equal(r.ciclo, 42);
  assert.equal(r.embarcado, false);
  assert.equal(r.diaDoBloco, 6);
});

test('desembarquei: anchor = ref - dEm', () => {
  const r = D.calcEscalaParaDia({ tipo: '14x14', dataRef: '2026-10-15', tipoRef: 'desembarquei' }, '2026-10-15');
  assert.equal(r.embarcado, false);
  assert.equal(r.diaDoBloco, 1);
});

test('dobra e férias são apenas visuais: ciclo não desloca', () => {
  const cfg = { ...CFG, excecoes: [
    { id: 'a', tipo: 'dobra', ini: '2026-10-15', fim: '2026-10-18' },
    { id: 'b', tipo: 'ferias', ini: '2026-11-01', fim: '2026-11-10' },
  ] };
  assert.equal(D.calcEscalaParaDia(cfg, '2026-10-16').embarcado, false); // dobra: continua "folga" no motor
  assert.equal(D.calcEscalaParaDia(cfg, '2026-10-29').embarcado, true);  // 2º embarque intacto
  assert.equal(D.calcEscalaParaDia(cfg, '2026-10-29').diaDoBloco, 1);
});

// ─── Próximas transições (web calcNextEmbarque) ────────────────────────────

test('proximoEmbarqueISO de folga = hoje + diasRestantes', () => {
  const iso = D.proximoEmbarqueISO(CFG, new Date('2026-10-20T12:00:00Z'));
  assert.equal(iso, '2026-10-29');
});

test('proximoEmbarqueISO embarcado = fim do embarque + folga (como o web)', () => {
  const iso = D.proximoEmbarqueISO(CFG, new Date('2026-10-05T12:00:00Z'));
  assert.equal(iso, '2026-10-29');
});

test('proximoDesembarqueISO embarcado = hoje + diasRestantes', () => {
  assert.equal(D.proximoDesembarqueISO(CFG, new Date('2026-10-05T12:00:00Z')), '2026-10-15');
});

test('proximoDesembarqueISO de folga = próximo embarque + dEm', () => {
  assert.equal(D.proximoDesembarqueISO(CFG, new Date('2026-10-20T12:00:00Z')), '2026-11-12');
});

// ─── resumoEscala (3 estados) ──────────────────────────────────────────────

test('resumoEscala: SEM_ESCALA para null/config inválida', () => {
  assert.equal(D.resumoEscala(null).estado, 'SEM_ESCALA');
  assert.equal(D.resumoEscala({ tipo: 'custom', dataRef: '2026-10-01', tipoRef: 'embarquei' }).estado, 'SEM_ESCALA');
  assert.equal(D.resumoEscala({ tipo: '14x14', dataRef: 'xx', tipoRef: 'embarquei' }).estado, 'SEM_ESCALA');
});

test('resumoEscala: EMBARCADO com datas e progresso', () => {
  const r = D.resumoEscala(CFG, new Date('2026-10-05T12:00:00Z'));
  assert.equal(r.estado, 'EMBARCADO');
  assert.equal(r.hojeISO, '2026-10-05');
  assert.equal(r.diasParaDesembarque, 10);
  assert.equal(r.proximoDesembarqueISO, '2026-10-15');
  assert.equal(r.diasParaEmbarque, 24);
  assert.equal(r.proximoEmbarqueISO, '2026-10-29');
  assert.ok(Math.abs(r.progresso - 5 / 14) < 1e-9);
});

test('resumoEscala: DE_FOLGA', () => {
  const r = D.resumoEscala(CFG, new Date('2026-10-20T12:00:00Z'));
  assert.equal(r.estado, 'DE_FOLGA');
  assert.equal(r.calc.diaDoBloco, 6);
  assert.equal(r.diasParaEmbarque, 9);
  assert.equal(r.proximoEmbarqueISO, '2026-10-29');
});

// ─── Calendário: marcadores vêm do ciclo base (web: diaDoBloco===1) ────────

test('marcadores de embarque/desembarque ignoram dobra/férias', () => {
  const exc = [{ id: 'f', tipo: 'ferias', ini: '2026-10-27', fim: '2026-10-31' }];
  const d29 = D.infoParaDia(CFG, exc, [], [], '2026-10-29', '2026-10-05');
  assert.equal(d29.kind, 'FERIAS');
  assert.equal(d29.isEmbarque, true, 'dia 1 do embarque continua marcado mesmo dentro das férias');
  const d15 = D.infoParaDia(CFG, [], [], [], '2026-10-15', '2026-10-05');
  assert.equal(d15.isDesembarque, true);
  assert.equal(d15.kind, 'FOLGA');
});

test('gerarMesDias aceita todayISO explícito', () => {
  const dias = D.gerarMesDias(CFG, [], [], [], 2026, 10, '2026-10-05');
  assert.equal(dias.length, 31);
  assert.equal(dias[4].isHoje, true);
  assert.equal(dias.filter(d => d.isHoje).length, 1);
});

// ─── Codec: formatos web / v1 / v2 ─────────────────────────────────────────

test('normalizeEscalaConfig lê formato do OWNews web (data, personalizada)', () => {
  const web = { tipo: 'personalizada', diasEmbarcado: 21, diasFolga: 21, data: '2026-10-01', tipoRef: 'embarquei', aeroporto: 'SBME', excecoes: [{ id: 'e1', tipo: 'dobra', ini: '2026-10-10', fim: '2026-10-12' }] };
  const cfg = D.normalizeEscalaConfig(web);
  assert.equal(cfg.tipo, 'custom');
  assert.equal(cfg.dataRef, '2026-10-01');
  assert.equal(cfg.diasEmbarcado, 21);
  assert.equal(cfg.aeroporto, 'SBME');
  assert.equal(cfg.excecoes.length, 1);
  assert.equal(D.calcEscalaParaDia(cfg, '2026-10-05').diaDoBloco, 5);
});

test('normalizeEscalaConfig lê v1 { data: {...} } e v2 { v, data }', () => {
  const v1 = { data: { tipo: '14x21', dataRef: '2026-10-01', tipoRef: 'desembarquei', updated_at: '2026-10-01T00:00:00Z' } };
  const v2 = D.toEscalaEnvelope({ tipo: '7x7', dataRef: '2026-10-01', tipoRef: 'embarquei' }, '2026-10-05T00:00:00Z');
  assert.equal(v2.v, D.ESCALA_SCHEMA_VERSION);
  assert.equal(D.normalizeEscalaConfig(v1).tipo, '14x21');
  assert.equal(D.normalizeEscalaConfig(v1).updated_at, '2026-10-01T00:00:00Z');
  assert.equal(D.normalizeEscalaConfig(v2).tipo, '7x7');
  assert.equal(D.normalizeEscalaConfig(v2).updated_at, '2026-10-05T00:00:00Z');
});

test('normalizeEscalaConfig rejeita lixo sem lançar', () => {
  assert.equal(D.normalizeEscalaConfig(null), null);
  assert.equal(D.normalizeEscalaConfig('x'), null);
  assert.equal(D.normalizeEscalaConfig({ data: 'not-a-date' }), null);
  assert.equal(D.normalizeEscalaConfig({ tipo: '99x99', dataRef: '2026-10-01' }), null);
  assert.equal(D.normalizeEscalaConfig({ tipo: 'custom', dataRef: '2026-10-01', tipoRef: 'embarquei' }), null);
});

test('toWebEscalaConfig produz o formato plano que o web lê', () => {
  const web = D.toWebEscalaConfig({ tipo: '28x28', dataRef: '2026-10-01', tipoRef: 'embarquei' });
  assert.equal(web.tipo, 'personalizada');
  assert.equal(web.diasEmbarcado, 28);
  assert.equal(web.data, '2026-10-01');
  assert.equal(D.toWebEscalaConfig({ tipo: '14x28', dataRef: '2026-10-01', tipoRef: 'embarquei' }).tipo, '14x28');
});

test('normalizeEscalaSecundaria lê o formato web do cruzar (refUTC, diasEmb)', () => {
  const web = { id: 'abc', nome: 'Ana', relacao: 'Companheira', icon: '❤️', diasEmb: 14, diasFolga: 21, refUTC: Date.UTC(2026, 9, 1), tipoRef: 'embarquei' };
  const s = D.normalizeEscalaSecundaria(web);
  assert.equal(s.tipo, '14x21');
  assert.equal(s.dataRef, '2026-10-01');
  assert.equal(s.nome, 'Ana');
  const custom = D.normalizeEscalaSecundaria({ ...web, diasEmb: 10, diasFolga: 20 });
  assert.equal(custom.tipo, 'custom');
  assert.equal(custom.diasEmbarcado, 10);
  assert.equal(D.normalizeEscalasSecundarias([web, null, { nome: '' }]).length, 1);
});

// ─── Checklist: ciclo (paridade web renderPage) ────────────────────────────

test('sincronizarChecklistComCiclo cria padrão quando não há lista', () => {
  const r = D.sincronizarChecklistComCiclo(null, '2026-10-29');
  assert.equal(r.alterado, true);
  assert.equal(r.resetado, false);
  assert.equal(r.data.ciclo, '2026-10-29');
  assert.ok(r.data.items.length > 0);
});

test('virada de ciclo: itens preservados, ok resetado, rec:false removido', () => {
  const data = { ciclo: '2026-10-01', items: [
    { id: 'a', t: 'A', cat: 'x', ok: true },
    { id: 'b', t: 'B', cat: 'x', ok: true, rec: false },
    { id: 'c', t: 'C', cat: 'x', ok: false, rec: true },
  ] };
  const r = D.sincronizarChecklistComCiclo(data, '2026-10-29');
  assert.equal(r.resetado, true);
  assert.deepEqual(r.data.items.map(i => i.id), ['a', 'c']);
  assert.ok(r.data.items.every(i => i.ok === false));
  assert.equal(r.data.ciclo, '2026-10-29');
});

test('mesmo ciclo ou sem escala: nada muda (sem churn)', () => {
  const data = { ciclo: '2026-10-29', items: [{ id: 'a', t: 'A', cat: 'x', ok: true }] };
  assert.equal(D.sincronizarChecklistComCiclo(data, '2026-10-29').alterado, false);
  const semEscala = D.sincronizarChecklistComCiclo(data, null);
  assert.equal(semEscala.alterado, false);
  assert.equal(semEscala.data.items[0].ok, true);
});

// ─── Viagem: hoje/amanhã em data local ─────────────────────────────────────

test('viagemEHoje/viagemEAmanha usam dia local', () => {
  const now = new Date('2026-10-06T02:30:00Z'); // 05/10 23:30 BRT
  assert.equal(D.viagemEHoje({ tipo: 'AVIAO', data: '2026-10-05' }, now), true);
  assert.equal(D.viagemEAmanha({ tipo: 'AVIAO', data: '2026-10-06' }, now), true);
  assert.equal(D.viagemEHoje({ tipo: 'AVIAO', data: '2026-10-06' }, now), false);
});
