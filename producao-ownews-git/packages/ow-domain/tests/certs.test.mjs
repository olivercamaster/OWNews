import { strict as assert } from 'assert';
import { test } from 'node:test';

function calcCertStatus(cert, today = new Date()) {
  if (!cert.validade) return { status: 'sem-data', critico: false, dias: null, label: 'Sem data' };
  const todayUTC = new Date(today); todayUTC.setUTCHours(12, 0, 0, 0);
  const validadeUTC = new Date(cert.validade + 'T12:00:00Z');
  const dias = Math.round((validadeUTC.getTime() - todayUTC.getTime()) / 86400000);
  if (dias < 0)    return { status: 'vencido',    critico: true,  dias, label: `Vencido há ${Math.abs(dias)} ${Math.abs(dias)===1?'dia':'dias'}` };
  if (dias === 0)  return { status: 'vence-hoje', critico: true,  dias, label: 'VENCE HOJE' };
  if (dias <= 7)   return { status: 'atencao',    critico: true,  dias, label: `Vence em ${dias} ${dias===1?'dia':'dias'}` };
  if (dias <= 90)  return { status: 'atencao',    critico: false, dias, label: `Vence em ${dias} dias` };
  return { status: 'valido', critico: false, dias, label: 'Válido' };
}

const today = new Date('2026-10-05T12:00:00Z');

test('sem data → sem-data', () => {
  const r = calcCertStatus({ id: '1', nome: 'OPITO' }, today);
  assert.equal(r.status, 'sem-data');
  assert.equal(r.critico, false);
  assert.equal(r.dias, null);
});

test('vence hoje (0 dias) → vence-hoje crítico', () => {
  const r = calcCertStatus({ id: '1', nome: 'OPITO', validade: '2026-10-05' }, today);
  assert.equal(r.status, 'vence-hoje');
  assert.equal(r.critico, true);
  assert.equal(r.label, 'VENCE HOJE');
});

test('vence amanhã (1 dia) → atencao crítico', () => {
  const r = calcCertStatus({ id: '1', nome: 'HUET', validade: '2026-10-06' }, today);
  assert.equal(r.status, 'atencao');
  assert.equal(r.critico, true);
  assert.equal(r.dias, 1);
});

test('vence em 30 dias → atencao não crítico', () => {
  const r = calcCertStatus({ id: '1', nome: 'HUET', validade: '2026-11-04' }, today);
  assert.equal(r.status, 'atencao');
  assert.equal(r.critico, false);
  assert.equal(r.dias, 30);
});

test('vence em 91 dias → valido', () => {
  const r = calcCertStatus({ id: '1', nome: 'BOSIET', validade: '2027-01-04' }, today);
  assert.equal(r.status, 'valido');
  assert.equal(r.critico, false);
  assert.equal(r.label, 'Válido');
});

test('vencido há 5 dias → vencido crítico', () => {
  const r = calcCertStatus({ id: '1', nome: 'H2S', validade: '2026-09-30' }, today);
  assert.equal(r.status, 'vencido');
  assert.equal(r.critico, true);
  assert.equal(r.dias, -5);
  assert.equal(r.label, 'Vencido há 5 dias');
});
