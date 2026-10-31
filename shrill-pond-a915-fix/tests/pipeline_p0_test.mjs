// P0 31/10/2026 — "collector vivo, mas sem publicar". Testa o worker.js REAL (sem cópia de funções):
// orçamento de subrequests, memória antes do download, falha técnica ≠ reprovação, matéria sensível,
// watchdog (silêncio editorial x pipeline travado). Uso: node --test tests/pipeline_p0_test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let W;
before(async () => {
  let src = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8')
    .replace(/^const ([A-Z_0-9]+) = /gm, 'var $1 = ')
    // A IA é injetada pelo teste (globalThis.__IA); o resto do pipeline é o código de produção.
    .replace('async function gerarCamadaEditorialIA(', 'async function gerarCamadaEditorialIA(...a) { return globalThis.__IA(...a); }\nasync function __gerarCamadaEditorialIAOriginal(');
  src += '\nexport { BuddyIAPoller as BuddyIAPoller_, processarNoticias, comOrcamento, saldoOrcamento, decisaoFalhaTecnica, diagnosticarPipeline, calcularSaudeEditorial, decisaoMemoriaRejeicao, sha256, ORC_LIMITE, CUSTO_PAUTA_PT };\n';
  const f = path.join(os.tmpdir(), `p0-worker-${process.pid}.mjs`);
  fs.writeFileSync(f, src);
  W = await import('file://' + f);
});

const SB = 'https://sb.teste';
const HORA = 3600e3;
const iso = (h) => new Date(Date.now() - h * HORA).toISOString();
const PAGINA = (t) => `<html><head><meta property="og:title" content="${t}"><meta name="description" content="Resumo da matéria com mais de quarenta caracteres para o teste."><meta property="article:published_time" content="${iso(1)}"></head><body><article><p>${'Parágrafo com fatos da fonte sobre a operação offshore. '.repeat(12)}</p></article></body></html>`;

/** Ambiente simulado: Supabase, páginas, DO real (BuddyIAPoller) com storage em memória. Conta subrequests. */
function ambiente({ insercao = 201, existentes = [] } = {}) {
  const cont = { rede: 0, supabase: 0, do: 0, ia: 0, inseridos: [] };
  const storage = new Map();
  const state = { storage: {
    get: async (k) => storage.get(k), put: async (k, v) => { storage.set(k, v); }, delete: async (ks) => { for (const k of [].concat(ks)) storage.delete(k); },
    list: async ({ prefix }) => new Map([...storage].filter(([k]) => k.startsWith(prefix))), getAlarm: async () => 1, setAlarm: async () => {} } };
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith(SB)) {
      cont.supabase++;
      if ((init.method || 'GET') === 'POST') {
        const corpo = JSON.parse(init.body);
        if (insercao !== 201) return new Response('{"code":"23514","message":"new row violates check constraint \\"articles_status_check\\""}', { status: insercao });
        cont.inseridos.push(corpo);
        return new Response('', { status: 201 });
      }
      if (u.includes('original_url=in.')) return Response.json(existentes.map((x) => ({ original_url: x })));
      return Response.json([]);
    }
    cont.rede++;
    return new Response(PAGINA(decodeURIComponent(u.split('/').pop())), { status: 200, headers: { 'content-type': 'text/html' } });
  };
  let doObj;
  const stub = { fetch: async (req, init) => { cont.do++; const r = typeof req === 'string' ? new Request(req, init) : req; return doObj.fetch(r); } };
  const env = { SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_ANON_KEY: 'k', AI: { run: async () => ({}) },
    BUDDY_IA_DO: { idFromName: () => 'g', get: () => stub }, SAUDE_KV: { get: async () => null, put: async () => {} } };
  doObj = new W.BuddyIAPoller_(state, env);
  return { env, cont, storage };
}
const item = (n, h = 2) => ({ title: `Pauta ${n} sobre contrato de sonda offshore`, url: `https://fonte.teste/materia-${n}`, publishedAt: iso(h) });
const aprovada = (art) => ({ ok: true, tentativas: 1, titulo: art.title, buddy_summary: 'Resumo OWNews '.repeat(6), why_it_matters: 'Impacto para o trabalhador offshore '.repeat(3), corpo: 'Corpo OWNews próprio. '.repeat(20) });

test('memória ANTES do download: pauta já reprovada não gasta página, banner nem IA', async () => {
  const { env, cont, storage } = ambiente();
  const it = item(1);
  storage.set('rej:' + await W.sha256(it.url), { t: Date.now(), c: 'definitiva', n: 1, m: ['fora_escopo'] });
  globalThis.__IA = async () => { cont.ia++; return { ok: false, motivos: ['x'] }; };
  const r = await W.processarNoticias(W.comOrcamento(env), 'Eixos', [it], {});
  assert.equal(r.noticias[0].motivo, 'reprovada_recente');
  assert.equal(cont.rede, 0, 'nenhuma página baixada');
  assert.equal(cont.ia, 0, 'nenhuma IA');
});

test('falha técnica não vira reprovação; backoff e desistência em 24 h (item venenoso isolado)', async () => {
  const { env, cont, storage } = ambiente();
  const it = item(2);
  globalThis.__IA = async () => { cont.ia++; return { ok: false, erro: 'Too many subrequests by single Worker invocation' }; };
  const r = await W.processarNoticias(W.comOrcamento(env), 'Eixos', [it], {});
  const h = await W.sha256(it.url);
  assert.equal(r.tecnicas, 1);
  assert.equal(storage.get('rej:' + h), undefined, 'erro técnico NÃO entra na memória de reprovação');
  assert.equal(storage.get('tec:' + h).n, 1);
  const r2 = await W.processarNoticias(W.comOrcamento(env), 'Eixos', [it], {});
  assert.equal(r2.noticias[0].status, 'adiada_tecnico', 'dentro do backoff não tenta de novo');
  assert.equal(W.decisaoFalhaTecnica({ n: 1, t: Date.now() - 21 * 60000 }, Date.now()), 'tentar', 'após 20 min tenta');
  assert.equal(W.decisaoFalhaTecnica({ n: 2, t: Date.now() - 30 * 60000 }, Date.now()), 'aguardar', '2ª falha: 40 min');
  assert.equal(W.decisaoFalhaTecnica({ n: 4, t: Date.now() - 5 * HORA }, Date.now()), 'esgotado');
  assert.equal(W.decisaoFalhaTecnica({ n: 4, t: Date.now() - 25 * HORA }, Date.now()), 'tentar', 'volta a tentar no dia seguinte');
});

test('uma pauta que o banco recusa não trava as outras do lote', async () => {
  const { env, cont, storage } = ambiente({ insercao: 400 });
  globalThis.__IA = async (art) => aprovada(art);
  const r = await W.processarNoticias(W.comOrcamento(env), 'Eixos', [item(3), item(4)], {});
  assert.equal(r.noticias.filter((n) => n.status === 'erro').length, 2, 'as duas foram tentadas');
  assert.equal(r.insercao_falhou, 2);
  for (const n of [3, 4]) assert.equal(storage.get('tec:' + await W.sha256(item(n).url)).n, 1);
  const iaAntes = cont.ia;
  const r2 = await W.processarNoticias(W.comOrcamento(env), 'Eixos', [item(3), item(4)], {});
  assert.ok(r2.noticias.every((n) => n.status === 'adiada_tecnico'), 'não volta a gastar IA na hora seguinte');
  assert.equal(cont.ia, iaAntes);
});

test('matéria sensível é gravada fora do ar (rejected + is_sensitive + RETIDO), não como draft', async () => {
  const { env, cont } = ambiente();
  globalThis.__IA = async (art) => aprovada(art);
  const it = { title: 'Trabalhador morre em acidente a bordo de plataforma', url: 'https://fonte.teste/' + encodeURIComponent('Trabalhador morre em acidente a bordo de plataforma'), publishedAt: iso(1) };
  const r = await W.processarNoticias(W.comOrcamento(env), 'Eixos', [it], {});
  assert.equal(r.retidas, 1, JSON.stringify(r.noticias));
  const g = cont.inseridos[0];
  assert.equal(g.status, 'rejected');
  assert.equal(g.is_sensitive, true);
  assert.match(g.score_reason, /^\[RETIDO:/);
});

test('orçamento: sem saldo a pauta fica adiada (nada gravado) e entra na execução seguinte', async () => {
  const { env, cont } = ambiente();
  globalThis.__IA = async (art) => { cont.ia++; return aprovada(art); };
  const lote = Array.from({ length: 12 }, (_, k) => item(100 + k));
  const e1 = W.comOrcamento(env);
  const r = await W.processarNoticias(e1, 'Eixos', lote, {});
  const adiadas = r.noticias.filter((n) => n.status === 'adiada_orcamento').length;
  assert.ok(adiadas > 0, 'parte do lote foi adiada');
  assert.ok(e1.__orc.usados <= W.ORC_LIMITE, `usados ${e1.__orc.usados} <= ${W.ORC_LIMITE}`);
  assert.equal(cont.inseridos.length, r.inseridas);
  const r2 = await W.processarNoticias(W.comOrcamento(env), 'Eixos', lote, { }, );
  assert.ok(r2.inseridas > 0, 'execução seguinte avança');
});

test('idempotência: URL já no banco não grava de novo nem chama IA', async () => {
  const it = item(7);
  const { env, cont } = ambiente({ existentes: [it.url] });
  globalThis.__IA = async (art) => { cont.ia++; return aprovada(art); };
  const r = await W.processarNoticias(W.comOrcamento(env), 'Eixos', [it], {});
  assert.equal(r.noticias[0].status, 'duplicada');
  assert.equal(cont.inseridos.length, 0);
  assert.equal(cont.ia, 0);
});

test('watchdog — RECORRÊNCIA: roda, centenas passam, nada publica por erro sistêmico → travado', () => {
  const janela = { ia_avaliadas: 1, ia_aprovadas: 0, tecnicas: 6, adiadas_orcamento: 4, insercao_falhou: 0, barradas_memoria: 300, motivos: { ia_indisponivel: 2 } };
  const d = W.diagnosticarPipeline({ horasSemPublicar: 19, janela, fontesComErro: [] });
  assert.equal(d.estado, 'editorial_pipeline_stalled');
  const s = W.calcularSaudeEditorial({ agora: Date.now(), artigos: [{ buddy_source: 'ownews', published_at: iso(19), created_at: iso(19) }], gate: { '24h': {}, janelas: { '6h': janela } }, automacao: {} });
  assert.equal(s.status, 'VERMELHO');
  assert.equal(s.pipeline.estado, 'editorial_pipeline_stalled');
});

test('watchdog — dia fraco (só memória e pauta irrelevante) é silêncio editorial, não falha', () => {
  const janela = { ia_avaliadas: 2, ia_aprovadas: 0, tecnicas: 0, adiadas_orcamento: 0, barradas_memoria: 300, motivos: { reprovada_recente: 300 } };
  const d = W.diagnosticarPipeline({ horasSemPublicar: 19, janela, fontesComErro: [] });
  assert.equal(d.estado, 'silencio_editorial');
  const s = W.calcularSaudeEditorial({ agora: Date.now(), artigos: [{ buddy_source: 'ownews', published_at: iso(19), created_at: iso(19) }], gate: { '24h': {}, janelas: { '6h': janela } }, automacao: {} });
  assert.equal(s.status, 'AMARELO');
  assert.match(s.motivos.join(' '), /silêncio editorial/);
  assert.equal(W.diagnosticarPipeline({ horasSemPublicar: 2, janela, fontesComErro: [] }).estado, 'publicando');
  assert.equal(W.diagnosticarPipeline({ horasSemPublicar: 10, janela: { ia_avaliadas: 9, ia_aprovadas: 0 }, fontesComErro: [] }).estado, 'gate_reprovando_tudo');
});

test('memória não é censura permanente: corrigível recente ganha 1 recuperação; nada passa de 3 dias', () => {
  const agora = Date.now();
  assert.equal(W.decisaoMemoriaRejeicao({ c: 'corrigivel', n: 1, t: agora - 3 * HORA }, 5, agora), 'recuperar');
  assert.equal(W.decisaoMemoriaRejeicao({ c: 'definitiva', n: 1, t: agora - 3 * HORA }, 5, agora), 'bloquear');
  assert.equal(W.decisaoMemoriaRejeicao(null, 5, agora), 'avaliar', 'memória é por URL: outra matéria da mesma empresa/campo/sonda é avaliada');
});
