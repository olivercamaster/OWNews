/**
 * Card principal do Início — local de embarque (aeroporto/base) por REGRA DE ESTADO.
 * Embarcado: nenhum local no card. Antes do embarque: continua como logística.
 * Relógio SEMPRE injetado; TZ fixo.
 */
process.env.TZ = 'America/Sao_Paulo';

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register('./_ts-resolver.mjs', import.meta.url);

let D;
before(async () => {
  D = await import('../../../packages/ow-domain/src/index.ts');
});

const dia = (iso, h = 12) => { const [y, mo, d] = iso.split('-').map(Number); return new Date(y, mo - 1, d, h, 0); };
const somar = (iso, n) => { const d = dia(iso); d.setDate(d.getDate() + n); return d; };
const contextoEm = (cfg, data) => {
  const resumo = D.resumoEscala(cfg, data);
  return D.contextoHome(resumo, D.calcularMomento(cfg, data), { total: 0, feitos: 0, pendentes: 0 });
};
// Locais quaisquer: a regra não conhece aeroporto nenhum.
const LOCAIS = ['SBJR · Jacarepaguá', 'SBME · Macaé', 'SBCB · Cabo Frio', 'Base Imbetiba'];

test('card principal: EMBARCADO nunca mostra aeroporto/base, para qualquer local', () => {
  for (const local of LOCAIS) assert.equal(D.localNoCardPrincipal('EMBARCADO', local), null);
});

test('card principal: antes do embarque o local continua (pré-embarque e folga)', () => {
  for (const local of LOCAIS) {
    assert.equal(D.localNoCardPrincipal('PRE_EMBARQUE', local), local);
    assert.equal(D.localNoCardPrincipal('FOLGA', local), local);
  }
  assert.equal(D.localNoCardPrincipal('PRE_EMBARQUE', null), null);
  assert.equal(D.localNoCardPrincipal('PRE_EMBARQUE', '  '), null);
  assert.equal(D.localNoCardPrincipal('SEM_ESCALA', 'SBJR · Jacarepaguá'), null);
});

test('card principal: ciclo inteiro (14x14, 14x21, 21x21) — local some exatamente nos dias EMBARCADO', () => {
  for (const tipo of ['14x14', '14x21', '21x21']) {
    const cfg = { tipo, dataRef: '2026-10-16', tipoRef: 'embarquei', aeroporto: 'SBJR' };
    let embarcados = 0, outros = 0;
    for (let n = -30; n < 60; n++) {
      for (const h of [0, 6, 12, 23]) {
        const data = somar('2026-10-16', n); data.setHours(h);
        const ctx = contextoEm(cfg, data);
        const local = D.localNoCardPrincipal(ctx.tipo, 'SBJR · Jacarepaguá');
        if (ctx.tipo === 'EMBARCADO') { embarcados++; assert.equal(local, null, `${tipo} ${data.toISOString()}`); }
        else { outros++; assert.equal(local, 'SBJR · Jacarepaguá', `${tipo} ${data.toISOString()} (${ctx.tipo})`); }
      }
    }
    assert.ok(embarcados > 0 && outros > 0);
  }
});

test('card principal: Dia 1 e Dia 5 embarcado — texto do card sem local; datas e contagem intactas', () => {
  const cfg = { tipo: '14x14', dataRef: '2026-10-25', tipoRef: 'embarquei', aeroporto: 'SBJR' };
  const d1 = contextoEm(cfg, dia('2026-10-25'));
  assert.equal(d1.tipo, 'EMBARCADO');
  assert.equal(d1.titulo, 'Hoje é dia de embarque');
  assert.equal(d1.destaque, 'Dia 1 de 14');
  assert.equal(d1.detalhe, 'Faltam 14 dias pra casa.');
  assert.equal(D.localNoCardPrincipal(d1.tipo, 'SBJR · Jacarepaguá'), null);
  const d5 = contextoEm(cfg, dia('2026-10-29'));
  assert.equal(d5.destaque, 'Dia 5 de 14');
  assert.equal(d5.detalhe, 'Faltam 10 dias pra casa.');
  assert.equal(D.localNoCardPrincipal(d5.tipo, 'SBJR · Jacarepaguá'), null);
  for (const c of [d1, d5]) assert.ok(!/SBJR|Jacarepagu|aeroporto|base/i.test(Object.values(c).join(' ')));
});

test('card principal: o hero renderiza só o local filtrado pela regra, sem aeroporto hardcoded', () => {
  const src = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
  const hero = src.slice(src.indexOf('function HomeHero('), src.indexOf('function DestaqueInstrumento'));
  assert.ok(hero.length > 200);
  assert.match(hero, /const local = localNoCardPrincipal\(contexto\.tipo, aeroporto\)/);
  assert.match(hero, /\{local \? \(/);
  assert.ok(!/\{aeroporto\b/.test(hero), 'o hero não pode exibir o aeroporto cru');
  assert.ok(!/SBJR|Jacarepagu/.test(src), 'nenhum aeroporto hardcoded na Home');
  const dominio = readFileSync(new URL('../../../packages/ow-domain/src/home-contexto.ts', import.meta.url), 'utf8');
  assert.ok(!/SBJR|Jacarepagu/.test(dominio));
});
