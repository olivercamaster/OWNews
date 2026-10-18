#!/usr/bin/env node
/**
 * Contrato AO VIVO OWNews → OWBuddy. Rode depois de qualquer deploy do worker
 * ownews-git que mexa em /api/buddy/*:
 *
 *   node apps/owbuddy/tests/contrato-live.mjs
 *
 * Sai com código 1 se um endpoint quebrar o que o app espera. Não escreve nada.
 */
import { register } from 'node:module';

register('./_ts-resolver.mjs', import.meta.url);
const C = await import('../src/contratos.ts');

const BASE = process.env.OWNEWS_BASE ?? 'https://ownews.com.br';
const falhas = [];
const ok = (cond, msg) => { if (!cond) falhas.push(msg); };

async function get(path) {
  const r = await fetch(BASE + path, { headers: { Accept: 'application/json' } });
  ok(r.ok, `${path}: HTTP ${r.status}`);
  return r.ok ? r.json() : null;
}

const feed = await get('/api/buddy/feed');
if (feed) {
  ok(feed.schema_version === 2, `feed: schema_version=${feed.schema_version}`);
  const brutos = Array.isArray(feed.articles) ? feed.articles : [];
  const validos = C.normalizarFeed(feed);
  ok(brutos.length > 0, 'feed: lista vazia');
  ok(validos.length === brutos.length, `feed: ${brutos.length - validos.length} item(ns) fora do contrato`);
  ok(brutos.every(a => a.summary == null), 'feed: summary (lead da fonte) voltou a ser enviado');
  ok(brutos.every(a => a.indexacao === 'INDEXABLE'), 'feed: item não indexável no app');
  ok(brutos.every(a => !String(a.image_url ?? '').includes('&amp;')), 'feed: image_url com &amp;');
}

const vagas = await get('/api/buddy/vagas');
if (vagas) {
  ok(Array.isArray(vagas.vagas), 'vagas: sem lista');
  ok((vagas.vagas ?? []).every(v => v.id && v.titulo && v.empresa), 'vagas: item sem id/titulo/empresa');
}

const unidades = await get('/api/buddy/unidades');
if (unidades) {
  ok(Array.isArray(unidades.unidades) && unidades.unidades.length > 0, 'unidades: lista vazia');
  ok((unidades.unidades ?? []).every(u => u.slug && u.nome && ['real', 'fallback'].includes(u.image_status)), 'unidades: slug/nome/image_status');
}

const aero = await get('/api/buddy/aeroportos');
if (aero) {
  ok(Array.isArray(aero.aeroportos) && aero.aeroportos.length >= 6, 'aeroportos: menos de 6 bases');
  ok((aero.aeroportos ?? []).every(a => a.codigo && a.nome && (a.horarioUTC == null || /^\d{1,2}:\d{2}/.test(a.horarioUTC))), 'aeroportos: codigo/nome/horarioUTC');
  ok(typeof aero.fetched_at === 'string', 'aeroportos: fetched_at');
}

if (falhas.length) {
  console.error('CONTRATO QUEBRADO:\n - ' + falhas.join('\n - '));
  process.exit(1);
}
console.log(`CONTRATO OK — feed ${feed?.articles?.length ?? 0} · vagas ${vagas?.vagas?.length ?? 0} · unidades ${unidades?.unidades?.length ?? 0} · aeroportos ${aero?.aeroportos?.length ?? 0}`);
