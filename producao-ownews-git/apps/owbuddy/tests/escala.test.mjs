/**
 * Testes de paridade das regras de negócio da Minha Escala.
 * Mesmas regras do OWNews worker.js — resultados devem ser idênticos.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Reimplementação inline das funções puras (sem dependência de transpiler)
// Espelha exatamente as funções de packages/ow-domain/src/escala.ts e escala-calendario.ts

const TIPOS_PRESET = {
  '14x14': [14, 14], '14x21': [14, 21], '14x28': [14, 28], '28x28': [28, 28], '21x21': [21, 21], '7x7': [7, 7],
};

function calcEscala(config, today = new Date()) {
  const preset = TIPOS_PRESET[config.tipo];
  const dEm = preset ? preset[0] : (parseInt(String(config.diasEmbarcado ?? ''), 10) || 0);
  const dFo = preset ? preset[1] : (parseInt(String(config.diasFolga ?? ''), 10) || 0);
  if (!dEm || !dFo) return null;
  const refUTC = new Date(config.dataRef + 'T12:00:00Z').getTime();
  const anchor = config.tipoRef === 'embarquei' ? refUTC : refUTC - dEm * 86400000;
  const ciclo = dEm + dFo;
  const agoraMs = today.getTime();
  const fase = ((Math.round((agoraMs - anchor) / 86400000) % ciclo) + ciclo) % ciclo;
  return {
    embarcado: fase < dEm,
    diasRestantes: fase < dEm ? dEm - fase : ciclo - fase,
    dEm, dFo, ciclo,
    diaDoBloco: fase < dEm ? fase + 1 : fase - dEm + 1,
  };
}

function calcEscalaParaDia(config, isoDate) {
  return calcEscala(config, new Date(isoDate + 'T12:00:00Z'));
}

function pascoaUTC(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(ano, mes - 1, dia);
}

function encontrarJanelasJuntos(configA, configB, fromISO, maxDias = 180, maxJanelas = 5) {
  const fromMs = new Date(fromISO + 'T12:00:00Z').getTime();
  const janelas = [];
  let emJanela = false, inicioJanela = '';
  for (let i = 0; i < maxDias; i++) {
    const ms = fromMs + i * 86400000;
    const stA = calcEscala(configA, new Date(ms));
    const stB = calcEscala(configB, new Date(ms));
    const juntos = !stA?.embarcado && !stB?.embarcado;
    const iso = new Date(ms).toISOString().slice(0, 10);
    if (juntos && !emJanela) { emJanela = true; inicioJanela = iso; }
    else if (!juntos && emJanela) {
      emJanela = false;
      const fimMs = ms - 86400000;
      janelas.push({ inicio: inicioJanela, fim: new Date(fimMs).toISOString().slice(0, 10),
        dias: Math.round((fimMs - new Date(inicioJanela + 'T12:00:00Z').getTime()) / 86400000) + 1 });
      if (janelas.length >= maxJanelas) break;
    }
  }
  if (emJanela) {
    const fimMs = fromMs + (maxDias - 1) * 86400000;
    janelas.push({ inicio: inicioJanela, fim: new Date(fimMs).toISOString().slice(0, 10),
      dias: Math.round((fimMs - new Date(inicioJanela + 'T12:00:00Z').getTime()) / 86400000) + 1 });
  }
  return janelas;
}

// ─── Regimes ───────────────────────────────────────────────────────────────

test('14x14: embarcou em 2026-10-01, hoje é 2026-10-05 → embarcado dia 5 de 14', () => {
  const r = calcEscala({ tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'embarquei' }, new Date('2026-10-05T12:00:00Z'));
  assert.equal(r.embarcado, true);
  assert.equal(r.diaDoBloco, 5);
  assert.equal(r.diasRestantes, 10);
});

test('14x14: embarcou em 2026-10-01, hoje é 2026-10-15 → primeiro dia folga', () => {
  const r = calcEscala({ tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'embarquei' }, new Date('2026-10-15T12:00:00Z'));
  assert.equal(r.embarcado, false);
  assert.equal(r.diaDoBloco, 1);
  assert.equal(r.diasRestantes, 14);
});

test('14x14: desembarcou em 2026-10-15, hoje é 2026-10-15 → primeiro dia folga', () => {
  const r = calcEscala({ tipo: '14x14', dataRef: '2026-10-15', tipoRef: 'desembarquei' }, new Date('2026-10-15T12:00:00Z'));
  assert.equal(r.embarcado, false);
  assert.equal(r.diaDoBloco, 1);
});

test('14x21: embarcou 2026-10-01, hoje 2026-10-14 → último dia embarcado', () => {
  const r = calcEscala({ tipo: '14x21', dataRef: '2026-10-01', tipoRef: 'embarquei' }, new Date('2026-10-14T12:00:00Z'));
  assert.equal(r.embarcado, true);
  assert.equal(r.diaDoBloco, 14);
  assert.equal(r.diasRestantes, 1);
});

test('21x21: verifica ciclo de 42 dias', () => {
  const r = calcEscala({ tipo: '21x21', dataRef: '2026-10-01', tipoRef: 'embarquei' }, new Date('2026-10-22T12:00:00Z'));
  assert.equal(r.embarcado, false);
  assert.equal(r.ciclo, 42);
});

test('custom 7x7: ciclo correto', () => {
  const r = calcEscala({ tipo: 'custom', diasEmbarcado: 7, diasFolga: 7, dataRef: '2026-10-01', tipoRef: 'embarquei' }, new Date('2026-10-08T12:00:00Z'));
  assert.equal(r.embarcado, false);
  assert.equal(r.ciclo, 14);
});

// ─── Virada de mês / ano ───────────────────────────────────────────────────

test('virada de mês: embarcou 2026-10-25, hoje 2026-11-03 → embarcado dia 10', () => {
  const r = calcEscala({ tipo: '14x14', dataRef: '2026-10-25', tipoRef: 'embarquei' }, new Date('2026-11-03T12:00:00Z'));
  assert.equal(r.embarcado, true);
  assert.equal(r.diaDoBloco, 10);
});

test('virada de ano: embarcou 2026-12-28, hoje 2027-01-03 → embarcado dia 7', () => {
  const r = calcEscala({ tipo: '14x14', dataRef: '2026-12-28', tipoRef: 'embarquei' }, new Date('2027-01-03T12:00:00Z'));
  assert.equal(r.embarcado, true);
  assert.equal(r.diaDoBloco, 7);
});

test('fevereiro não-bissexto: embarcou 2026-02-20, hoje 2026-02-28 → dia 9', () => {
  const r = calcEscala({ tipo: '14x14', dataRef: '2026-02-20', tipoRef: 'embarquei' }, new Date('2026-02-28T12:00:00Z'));
  assert.equal(r.embarcado, true);
  assert.equal(r.diaDoBloco, 9);
});

test('ano bissexto 2028: fevereiro tem 29 dias (data válida, primeiro dia de folga)', () => {
  // 2028-02-15 + 14 dias de embarque = 2028-02-29 é primeiro dia de folga (fase=14)
  const r = calcEscala({ tipo: '14x14', dataRef: '2028-02-15', tipoRef: 'embarquei' }, new Date('2028-02-29T12:00:00Z'));
  assert.equal(r.embarcado, false);
  assert.equal(r.diaDoBloco, 1);
});

// ─── Dobra / Férias (visual — não altera ciclo) ────────────────────────────

test('dobra não altera o ciclo após o período', () => {
  const config = { tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'embarquei', excecoes: [{ id: 'e1', tipo: 'dobra', ini: '2026-10-10', fim: '2026-10-14' }] };
  // Em 2026-10-20 (6 dias de folga após término do embarque em 15/10):
  const r = calcEscala(config, new Date('2026-10-20T12:00:00Z'));
  assert.equal(r.embarcado, false);
  assert.equal(r.diaDoBloco, 6); // day 6 of folga — not shifted by dobra
});

test('férias não altera o ciclo após o período', () => {
  const config = { tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'embarquei', excecoes: [{ id: 'e1', tipo: 'ferias', ini: '2026-10-15', fim: '2026-10-25' }] };
  // 2026-10-28 = dia 27 do ciclo (0-based), fase=27 ≥ 14 → folga, não alterado pelas férias
  const r = calcEscala(config, new Date('2026-10-28T12:00:00Z'));
  assert.equal(r.embarcado, false); // still folga, cycle not changed
});

// ─── Feriados ──────────────────────────────────────────────────────────────

test('Páscoa 2026 cai em 5 de abril', () => {
  const ms = pascoaUTC(2026);
  const d = new Date(ms);
  assert.equal(d.getUTCMonth(), 3); // abril = index 3
  assert.equal(d.getUTCDate(), 5);
});

test('Páscoa 2027 cai em 28 de março', () => {
  const ms = pascoaUTC(2027);
  const d = new Date(ms);
  assert.equal(d.getUTCMonth(), 2); // março = index 2
  assert.equal(d.getUTCDate(), 28);
});

test('Páscoa 2028 cai em 16 de abril (ano bissexto)', () => {
  const ms = pascoaUTC(2028);
  const d = new Date(ms);
  assert.equal(d.getUTCMonth(), 3);
  assert.equal(d.getUTCDate(), 16);
});

// ─── Cruzar escalas ────────────────────────────────────────────────────────

test('cruzar: dois 14x14 com mesmo anchor → folga em comum a cada ciclo', () => {
  const configA = { tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'embarquei' };
  const configB = { tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'embarquei' };
  const janelas = encontrarJanelasJuntos(configA, configB, '2026-10-15', 30, 3);
  assert.ok(janelas.length > 0, 'deve encontrar pelo menos uma janela');
  assert.equal(janelas[0].dias, 14, 'janela deve ter 14 dias quando ciclos idênticos');
});

test('cruzar: escalas defasadas encontram folga em comum', () => {
  const configA = { tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'embarquei' };
  const configB = { tipo: '14x14', dataRef: '2026-10-08', tipoRef: 'embarquei' };
  const janelas = encontrarJanelasJuntos(configA, configB, '2026-10-01', 180, 5);
  assert.ok(janelas.length > 0, 'deve encontrar janelas para escalas defasadas');
  for (const j of janelas) {
    assert.ok(j.dias > 0);
    assert.ok(j.inicio <= j.fim);
  }
});

test('cruzar: retorna array vazio se nunca há folga em comum (período curto)', () => {
  // A embarca 01, B embarca 01 mas 28x28 — durante os primeiros 14 dias A embarca, B fica
  const configA = { tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'embarquei' };
  const configB = { tipo: '28x28', dataRef: '2026-10-01', tipoRef: 'embarquei' };
  // Checar apenas os primeiros 14 dias — ambos embarcados
  const janelas = encontrarJanelasJuntos(configA, configB, '2026-10-01', 14, 5);
  assert.equal(janelas.length, 0);
});

// ─── Contagem regressiva ──────────────────────────────────────────────────

test('contagem regressiva: embarcado, faltam X dias exatos', () => {
  const r = calcEscala({ tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'embarquei' }, new Date('2026-10-10T12:00:00Z'));
  assert.equal(r.embarcado, true);
  assert.equal(r.diasRestantes, 5); // 14 - 10 + 1 = 5
});

test('contagem regressiva: de folga, faltam X dias pro embarque', () => {
  const r = calcEscala({ tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'embarquei' }, new Date('2026-10-20T12:00:00Z'));
  assert.equal(r.embarcado, false);
  assert.equal(r.diasRestantes, 9); // dia 6 de folga, faltam 14-6+1=9
});

// ─── Por dia (calcEscalaParaDia) ──────────────────────────────────────────

test('calcEscalaParaDia: data específica retorna resultado correto', () => {
  const r = calcEscalaParaDia({ tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'embarquei' }, '2026-10-07');
  assert.equal(r.embarcado, true);
  assert.equal(r.diaDoBloco, 7);
});

test('calcEscalaParaDia: segundo ciclo correto', () => {
  // Segundo embarque começa em 2026-10-29 (14 embarcado + 14 folga = 28 dias após 01/10)
  const r = calcEscalaParaDia({ tipo: '14x14', dataRef: '2026-10-01', tipoRef: 'embarquei' }, '2026-10-29');
  assert.equal(r.embarcado, true);
  assert.equal(r.diaDoBloco, 1);
});
