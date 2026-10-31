// Estresse / pior caso do orçamento de subrequests (P0 31/10/2026). Worker REAL, ambiente simulado.
// Dia muito movimentado: 6 fontes na MESMA invocação, 90 pautas (novas, duplicadas, memória, falhas
// técnicas, sensíveis). Prova: (1) nenhuma invocação passa do orçamento nem do limite do plano;
// (2) zero perda silenciosa — toda pauta recebida termina num estado contabilizado;
// (3) o que foi adiado entra nas execuções seguintes sem duplicar gravação.
// Uso: node --test tests/estresse_orcamento_test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LIMITE_PLANO = 50;
let W;
before(async () => {
  let src = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8')
    .replace(/^const ([A-Z_0-9]+) = /gm, 'var $1 = ')
    .replace('async function gerarCamadaEditorialIA(', 'async function gerarCamadaEditorialIA(...a) { return globalThis.__IA(...a); }\nasync function __gerarCamadaEditorialIAOriginal(');
  src += '\nexport { BuddyIAPoller as BuddyIAPoller_, processarNoticiasComDedupe, comOrcamento, comSaldoFonte, sha256, ORC_LIMITE };\n';
  const f = path.join(os.tmpdir(), `estresse-worker-${process.pid}.mjs`);
  fs.writeFileSync(f, src);
  W = await import('file://' + f);
});

const SB = 'https://sb.teste';
const iso = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const PAGINA = (t) => `<html><head><meta property="og:title" content="${t}"><meta name="description" content="Resumo da matéria com mais de quarenta caracteres para o teste."></head><body><article><p>${'Fatos da fonte sobre a operação offshore. '.repeat(15)}</p></article></body></html>`;

/** Banco, páginas e DO (classe real) persistentes entre invocações; contador de subrequests por invocação. */
function mundo() {
  const banco = new Map();            // original_url -> artigo gravado
  const storage = new Map();          // storage do BuddyIAPoller
  const cont = { n: 0 };
  const state = { storage: {
    get: async (k) => storage.get(k), put: async (k, v) => { storage.set(k, v); }, delete: async (ks) => { for (const k of [].concat(ks)) storage.delete(k); },
    list: async ({ prefix }) => new Map([...storage].filter(([k]) => k.startsWith(prefix))), getAlarm: async () => 1, setAlarm: async () => {} } };
  globalThis.fetch = async (url, init = {}) => {
    cont.n++;
    const u = String(url);
    if (u.startsWith(SB)) {
      if ((init.method || 'GET') === 'POST') {
        const a = JSON.parse(init.body);
        if (/recusa-banco/.test(a.original_url)) return new Response('{"code":"23514"}', { status: 400 });
        if (banco.has(a.original_url)) return new Response('{"code":"23505"}', { status: 409 });
        banco.set(a.original_url, a);
        return new Response('', { status: 201 });
      }
      const m = /original_url=in\.\(([^)]*)\)/.exec(decodeURIComponent(u));
      if (m) return Response.json(m[1].split(',').map((x) => x.replace(/^"|"$/g, '')).filter((x) => banco.has(x)).map((x) => ({ original_url: x })));
      return Response.json([]);
    }
    if (/pagina-quebrada/.test(u)) return new Response('erro', { status: 503 });
    return new Response(PAGINA(decodeURIComponent(u.split('/').pop()).replace(/-/g, ' ')), { status: 200, headers: { 'content-type': 'text/html' } });
  };
  let doObj;
  const stub = { fetch: async (req, init) => { cont.n++; return doObj.fetch(typeof req === 'string' ? new Request(req, init) : req); } };
  const env = { SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_ANON_KEY: 'k', AI: { run: async () => ({}) },
    BUDDY_IA_DO: { idFromName: () => 'g', get: () => stub }, SAUDE_KV: { get: async () => null, put: async () => {} } };
  doObj = new W.BuddyIAPoller_(state, env);
  return { env, banco, storage, cont };
}

// IA simulada: fora de escopo (reprova), erro técnico ou aprova — decidido pelo título.
globalThis.__IA = async (art) => {
  globalThis.__chamadasIA = (globalThis.__chamadasIA || 0) + 1;
  if (/irrelevante/.test(art.title)) return { ok: false, tentativas: 1, motivos: ['fora_escopo'] };
  if (/ia-falha/.test(art.title)) return { ok: false, erro: 'Too many subrequests by single Worker invocation' };
  return { ok: true, tentativas: 1, titulo: art.title, buddy_summary: 'Resumo OWNews '.repeat(6), why_it_matters: 'Impacto para o trabalhador offshore '.repeat(3), corpo: 'Corpo OWNews próprio. '.repeat(20) };
};

const FONTES = ['PetroNotícias', 'Eixos', 'Sindipetro NF', 'FUP', 'Portos e Navios', 'MegaWhat'];
function diaMovimentado() {
  const lotes = {};
  let k = 0;
  for (const f of FONTES) {
    lotes[f] = Array.from({ length: 15 }, (_, i) => {
      k++;
      const tipo = k % 15 === 0 ? 'recusa-banco' : k % 11 === 0 ? 'ia-falha' : k % 7 === 0 ? 'irrelevante' : k % 13 === 0 ? 'pagina-quebrada' : 'boa';
      // Títulos distintos (sem colisão no anti-duplicata por título).
      const titulo = `${tipo} ${f} contrato sonda ${['alfa', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar'][i]} ${k}x${k * 7}`;
      return { title: titulo, url: `https://fonte.teste/${tipo}/${encodeURIComponent(titulo.replace(/ /g, '-'))}`, publishedAt: iso(1 + (i % 5)), source: f };
    });
  }
  return lotes;
}
const ESTADOS = ['inserida', 'duplicada', 'antiga', 'editorial_incomplete', 'adiada_orcamento', 'adiada_tecnico', 'tecnico_esgotado', 'erro', 'retida_para_revisao', 'bloqueada_idioma_en', 'fonte_adiada'];

/** Uma invocação = todas as fontes com o MESMO orçamento (como o alarme do EditorialPoller). */
async function invocacao(m, lotes) {
  m.cont.n = 0;
  const env = W.comOrcamento(m.env);
  const contagem = {}; let recebidas = 0, puladasDup = 0;
  for (const f of FONTES) {
    // Mesmo caminho dos executores: comSaldoFonte decide ANTES de baixar o feed.
    const r = await W.comSaldoFonte(env, f, async () => { m.cont.n++; return W.processarNoticiasComDedupe(env, f, lotes[f], {}); });
    recebidas += lotes[f].length;
    if (r.adiada_orcamento) { contagem.fonte_adiada = (contagem.fonte_adiada || 0) + lotes[f].length; continue; }
    puladasDup += (r.puladas_por_duplicidade || []).length;
    for (const n of r.noticias || []) contagem[n.status] = (contagem[n.status] || 0) + 1;
  }
  return { subrequests: m.cont.n, orcamento: env.__orc.usados, contagem, recebidas, puladasDup };
}

test('pior caso: nenhuma invocação passa do orçamento; nada some; adiadas avançam sem duplicar', async () => {
  const m = mundo();
  const lotes = diaMovimentado();
  // 10 pautas já reprovadas antes (memória) e 6 já no banco (duplicadas).
  for (const it of lotes['Eixos'].slice(0, 10)) m.storage.set('rej:' + await W.sha256(it.url), { t: Date.now(), c: 'definitiva', n: 1, m: ['fora_escopo'] });
  for (const it of lotes['MegaWhat'].slice(0, 6)) m.banco.set(it.url, { original_url: it.url });
  const linhas = [];
  let maxSub = 0, minMargem = Infinity;
  for (let exec = 1; exec <= 30; exec++) {
    const r = await invocacao(m, lotes);
    maxSub = Math.max(maxSub, r.subrequests);
    minMargem = Math.min(minMargem, LIMITE_PLANO - r.subrequests);
    // Zero perda silenciosa: recebidas = soma de estados explícitos (+ puladas pelo anti-duplicata de título).
    const soma = Object.values(r.contagem).reduce((a, b) => a + b, 0) + r.puladasDup;
    assert.equal(soma, r.recebidas, `exec ${exec}: ${JSON.stringify(r.contagem)}`);
    assert.ok(Object.keys(r.contagem).every((s) => ESTADOS.includes(s)), 'só estados conhecidos: ' + Object.keys(r.contagem));
    assert.ok(r.subrequests <= W.ORC_LIMITE, `exec ${exec}: ${r.subrequests} subrequests (orçamento ${W.ORC_LIMITE})`);
    assert.ok(r.subrequests < LIMITE_PLANO, `exec ${exec}: ${r.subrequests} < ${LIMITE_PLANO}`);
    console.log(`exec ${String(exec).padStart(2)}: subrequests=${r.subrequests} orçamento=${r.orcamento} ${JSON.stringify(r.contagem)}`);
    if (!r.contagem.adiada_orcamento && !r.contagem.adiada_tecnico && !r.contagem.fonte_adiada) break;
  }
  console.log(linhas.join('\n'));
  console.log(`MAX subrequests=${maxSub} | ORC_LIMITE=${W.ORC_LIMITE} | limite plano=${LIMITE_PLANO} | margem mínima=${minMargem}`);
  // Idempotência: cada URL gravada uma vez só; todas as boas acabaram no banco.
  // (as 10 primeiras do Eixos estavam na memória de reprovação de propósito: bloqueá-las é o certo)
  const naMemoria = new Set(lotes['Eixos'].slice(0, 10).map((i) => i.url));
  const boas = Object.values(lotes).flat().filter((i) => /^boa /.test(i.title) && !naMemoria.has(i.url));
  const faltam = [];
  for (const i of boas.filter((x) => !m.banco.has(x.url))) faltam.push(i.title + ' tec=' + JSON.stringify(m.storage.get('tec:' + await W.sha256(i.url)) || null));
  assert.ok(!faltam.length, `boas gravadas: ${boas.length - faltam.length}/${boas.length}\n` + faltam.join('\n'));
  // Falha técnica nunca virou reprovação editorial.
  for (const it of Object.values(lotes).flat().filter((i) => /ia-falha|recusa-banco|pagina-quebrada/.test(i.url) && !naMemoria.has(i.url))) {
    assert.equal(m.storage.get('rej:' + await W.sha256(it.url)), undefined, 'técnica não entra na memória editorial: ' + it.title);
  }
});
