import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./_ts-resolver.mjs', import.meta.url);
let T;
before(async () => { T = await import('../src/transporte.ts'); });

test('Uber: destino conhecido vira link universal oficial com coordenadas', () => {
  const d = T.destinoDaViagem({ tipo: 'AVIAO', data: '2026-10-24', origem: 'GIG', destino: 'Macaé' });
  assert.equal(d.nome, 'Aeroporto do Galeão (GIG)');
  const u = new URL(T.linkUber(d));
  assert.equal(u.origin + u.pathname, 'https://m.uber.com/looking');
  const drop = JSON.parse(u.searchParams.get('drop[0]'));
  assert.deepEqual([drop.latitude, drop.longitude, drop.addressLine1], [-22.8099, -43.2506, 'Aeroporto do Galeão (GIG)']);
  assert.ok(!u.search.includes('pickup'), 'origem fica com a Uber (sem localização no OWBuddy)');
});

test('Uber: sem destino (ou destino desconhecido) abre o fluxo oficial sem drop', () => {
  assert.equal(T.linkUber(null), 'https://m.uber.com/looking');
  assert.equal(T.destinoDaViagem({ tipo: 'AVIAO', data: '2026-10-24', origem: 'Aeroporto da minha cidade' }), null);
  assert.equal(T.destinoDaViagem({ tipo: 'ONIBUS', data: '2026-10-24', origem: 'GIG' }), null, 'só avião vai para aeroporto');
  assert.equal(T.destinoDaViagem(null), null);
});

test('reconhece aeroporto por código IATA/ICAO ou nome', () => {
  assert.equal(T.resolverAeroporto('Santos Dumont').nome, 'Aeroporto Santos Dumont (SDU)');
  assert.equal(T.resolverAeroporto('saindo de SBGR').nome, 'Aeroporto de Guarulhos (GRU)');
  assert.equal(T.resolverAeroporto('Macae').nome, 'Aeroporto de Macaé (MEA)');
  assert.equal(T.resolverAeroporto(''), null);
});

test('base de embarque da escala (heliporto canônico)', () => {
  const b = T.destinoDaBase({ tipo: '14x14', dataRef: '2026-10-19', tipoRef: 'embarquei', aeroporto: 'SBJR' });
  assert.equal(b.nome, 'Base Jacarepaguá (SBJR)');
  assert.equal(T.destinoDaBase(null), null);
});

test('99: sem deep link documentado → página oficial por plataforma, nunca esquema inventado', () => {
  assert.equal(T.NOVENTA_E_NOVE_COM_DESTINO, false);
  assert.equal(T.link99('android'), 'https://play.google.com/store/apps/details?id=com.taxis99');
  assert.equal(T.link99('ios'), 'https://apps.apple.com/br/app/id553663691');
  assert.equal(T.link99('web'), 'https://99app.com/');
  for (const p of ['android', 'ios', 'web']) assert.match(T.link99(p), /^https:\/\//);
});

test('opções de destino: viagem ativa, base, sem viagem', () => {
  const esc = { tipo: '14x14', dataRef: '2026-10-19', tipoRef: 'embarquei', aeroporto: 'SBME' };
  const v = { tipo: 'AVIAO', data: '2026-10-24', origem: 'SDU' };
  assert.deepEqual(T.opcoesTransporte(v, esc).map(o => o.id), ['viagem', 'base']);
  assert.deepEqual(T.opcoesTransporte(null, null), []);
  assert.deepEqual(T.opcoesTransporte(null, esc).map(o => o.id), ['base']);
});
