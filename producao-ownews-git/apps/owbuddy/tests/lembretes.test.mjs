/**
 * Lembretes locais (packages/ow-domain/src/lembretes.ts): cadência, privacidade
 * do texto, desligamento e limites. Puro — não depende de expo-notifications.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./_ts-resolver.mjs', import.meta.url);
const D = await import('../../../packages/ow-domain/src/index.ts');

const ESCALA = { tipo: '14x14', dataRef: '2026-11-09', tipoRef: 'embarquei' }; // folga hoje (18/10)
const ATIVO = { ...D.PREFS_LEMBRETES_PADRAO, ativo: true };
const AGORA = new Date(2026, 9, 18, 10, 0); // 18/10/2026 10:00 local
const CHECK = { ciclo: '2026-11-09', items: [{ id: 'a', t: 'Passaporte XYZ', cat: 'documentos', ok: false }, { id: 'b', t: 'b', cat: 'roupas', ok: true }] };

const base = (extra = {}) => ({ escala: ESCALA, checklist: CHECK, certs: [], viagem: null, prefs: ATIVO, agora: AGORA, ...extra });

test('desligado por padrão: nada é agendado sem o usuário aceitar', () => {
  assert.equal(D.PREFS_LEMBRETES_PADRAO.ativo, false);
  assert.deepEqual(D.planejarLembretes(base({ prefs: D.PREFS_LEMBRETES_PADRAO })), []);
});

test('embarque: 3 dias antes 09:00 e véspera 18:00 do PRÓXIMO embarque', () => {
  const l = D.planejarLembretes(base()).filter(x => x.tipo === 'embarque');
  assert.deepEqual(l.map(x => x.quando), ['2026-11-06T09:00', '2026-11-08T18:00']);
  assert.ok(l.every(x => x.rota === '/escala'));
});

test('checklist: 2 dias antes 19:00 só se há pendência; texto sem conteúdo da lista', () => {
  const l = D.planejarLembretes(base()).filter(x => x.tipo === 'checklist');
  assert.equal(l.length, 1);
  assert.equal(l[0].quando, '2026-11-07T19:00');
  assert.equal(l[0].corpo, 'Embarque em 2 dias. Falta 1 item na mala.');
  assert.ok(!l[0].corpo.includes('Passaporte'), 'item do checklist não vai para a tela bloqueada');
  const tudoFeito = { ...CHECK, items: CHECK.items.map(i => ({ ...i, ok: true })) };
  assert.equal(D.planejarLembretes(base({ checklist: tudoFeito })).filter(x => x.tipo === 'checklist').length, 0);
});

test('certificados: 30 e 7 dias antes; vencido ou apagado não gera; nome nunca aparece', () => {
  const certs = [
    { id: '1', nome: 'HUET', validade: '2026-12-31' },
    { id: '2', nome: 'BOSIET', validade: '2026-10-01' },             // vencido
    { id: '3', nome: 'NR-35', validade: '2027-01-15', _deleted: true }, // apagado
    { id: '4', nome: 'CBSP', validade: '2026-10-22' },               // 7d já passou, 30d também
  ];
  const l = D.planejarLembretes(base({ certs })).filter(x => x.tipo === 'certificado');
  assert.deepEqual(l.map(x => x.quando), ['2026-12-01T09:00', '2026-12-24T09:00']);
  for (const x of l) for (const c of certs) assert.ok(!x.corpo.includes(c.nome) && !x.titulo.includes(c.nome));
});

test('viagem: véspera 20:00 e 3 h antes; atravessa meia-noite; sem localizador/destino no texto', () => {
  const viagem = { tipo: 'AVIAO', data: '2026-10-25', hora: '01:30', localizador: 'ABC123', destino: 'MAE', num_voo: 'LA1' };
  const l = D.planejarLembretes(base({ viagem })).filter(x => x.tipo === 'viagem');
  assert.deepEqual(l.map(x => x.quando), ['2026-10-24T20:00', '2026-10-24T22:30']);
  for (const x of l) assert.ok(!/ABC123|MAE|LA1/.test(x.corpo + x.titulo));
  // sem horário: só véspera
  const s = D.planejarLembretes(base({ viagem: { tipo: 'ONIBUS', data: '2026-10-25' } })).filter(x => x.tipo === 'viagem');
  assert.equal(s.length, 1);
  assert.equal(s[0].corpo, 'Ônibus amanhã.');
});

test('nada no passado; ordenado; ids estáveis; teto de LEMBRETES_MAX', () => {
  const certs = Array.from({ length: 40 }, (_, i) => ({ id: 'c' + i, nome: 'x', validade: D.somarDiasISO('2026-12-01', i) }));
  const l = D.planejarLembretes(base({ certs }));
  assert.ok(l.length <= D.LEMBRETES_MAX);
  const agoraStr = D.instanteLocal(AGORA);
  assert.ok(l.every(x => x.quando > agoraStr));
  assert.deepEqual([...l].sort((a, b) => (a.quando < b.quando ? -1 : 1)), l);
  const l2 = D.planejarLembretes(base({ certs }));
  assert.deepEqual(l.map(x => x.id), l2.map(x => x.id));
  assert.equal(new Set(l.map(x => x.id)).size, l.length);
});

test('preferências por tipo; sem escala → sem embarque/checklist', () => {
  const soCert = { ...ATIVO, embarque: false, checklist: false, viagem: false };
  const certs = [{ id: '1', nome: 'x', validade: '2027-01-20' }];
  const l = D.planejarLembretes(base({ prefs: soCert, certs }));
  assert.ok(l.length > 0 && l.every(x => x.tipo === 'certificado'));
  const semEscala = D.planejarLembretes(base({ escala: null }));
  assert.ok(semEscala.every(x => x.tipo !== 'embarque' && x.tipo !== 'checklist'));
});

test('instanteLocal ⇄ dataDoInstante (fuso do aparelho)', () => {
  const d = D.dataDoInstante('2026-11-08T18:00');
  assert.equal(d.getFullYear(), 2026); assert.equal(d.getMonth(), 10); assert.equal(d.getDate(), 8);
  assert.equal(d.getHours(), 18); assert.equal(D.instanteLocal(d), '2026-11-08T18:00');
});
