// Pipeline editorial v2 (03/11/2026): pacote de contexto, fidelidade do título e valor editorial.
// Testa o worker.js REAL, sem rede (fetch simulado). Uso: node --test tests/pipeline_v2_test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let W;
before(async () => {
  let src = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8').replace(/^const ([A-Z_0-9]+) = /gm, 'var $1 = ');
  src += '\nexport { verificarFidelidadeTitulo, avaliarValorEditorial, montarPacoteContexto, blocoContextoRedacao, classeFonte, extrairLinksPrimarios };\n';
  const f = path.join(os.tmpdir(), `v2-worker-${process.pid}.mjs`);
  fs.writeFileSync(f, src);
  W = await import('file://' + f);
});

test('fidelidade: tradução que muda a ação, a empresa ou o número é reprovada', () => {
  const ok = (o, f) => assert.equal(W.verificarFidelidadeTitulo(o, f).ok, true, f);
  const nao = (o, f, m) => assert.ok(W.verificarFidelidadeTitulo(o, f).motivos.some((x) => x.startsWith(m)), f);
  // Caso real de 03/11: "shedding its stake" virou "perda".
  nao('Shell shedding its stake in Australian LNG project', 'Shell registra perda em projeto de GNL na Austrália', 'titulo:sentido');
  ok('Shell shedding its stake in Australian LNG project', 'Shell vende participação em projeto de GNL na Austrália');
  nao('Petrobras hits paydirt for third time in ultra-deep Amapá waters', 'Poço seco no Amapá frustra Petrobras', 'titulo:sentido');
  nao('SBM Offshore wins contract for two FPSOs', 'Modec conquista contrato de duas plataformas', 'titulo:sem_entidade');
  nao('Noble rigs’ $560 million drilling gigs', 'Noble fecha contratos de US$ 650 milhões', 'titulo:numero');
  ok('Fatal rig incident: Search still underway for two missing workers off Gabon', 'Busca por dois trabalhadores desaparecidos continua no Gabão');
  ok('Produção da Petrobras cresce 11,7% em um ano', 'Produção da Petrobras cresce 11,7% em um ano');
});

const pac = (o) => Object.assign({ fonte_classe: 'PRESS_BR', radar: [], radar_base: null, historico: [], primaria: null }, o);
const P74 = { tipo: 'Unidade', nome: 'Petrobras 74 (P-74)', dados: ['produção de 142.300 bbl/d de petróleo em set/2026', 'campo de Búzios'] };

test('valor: HIGH só quando o texto USA o contexto; uma fonte parafraseada é LOW', () => {
  const v = (p, corpo, fonte = 'Petronotícias', t = 'x') => W.avaliarValorEditorial({ pacote: p, corpo, fonte, tituloOriginal: t });
  assert.equal(v(pac({ radar: [P74] }), 'A P-74 produziu 142.300 barris por dia em setembro, segundo a ANP.').valor, 'HIGH');
  assert.equal(v(pac({ radar: [P74] }), 'A P-74 passará por manutenção.').valor, 'LOW', 'Radar disponível mas não usado');
  assert.equal(v(pac({ historico: [{ id: '1', titulo: 'x', data: '2026-10-30' }] }), 'Em 30/10, o OWNews noticiou a chegada da sonda.').valor, 'HIGH');
  assert.equal(v(pac({ primaria: { url: 'https://www.gov.br/anp/x', texto: 'y' } }), 'texto').valor, 'HIGH');
  assert.equal(v(pac(), 'A ANP divulgou o boletim.', 'ANP').valor, 'MEDIUM', 'fato oficial brasileiro');
  assert.equal(v(pac(), 'Um acidente na plataforma deixou feridos.').valor, 'MEDIUM', 'urgente pode ser curto');
  assert.equal(v(pac(), 'Empresa anuncia novo contrato de apoio.').valor, 'LOW');
  assert.equal(v(pac(), 'Contrato.', 'Offshore Energy', 'Gas flows from Southeast Asian offshore field').valor, 'LOW');
});

test('classe da fonte: oficial BR, imprensa BR, internacional com Brasil, internacional', () => {
  assert.equal(W.classeFonte('ANP', 'x'), 'OFFICIAL_BR');
  assert.equal(W.classeFonte('Eixos', 'x'), 'PRESS_BR');
  assert.equal(W.classeFonte('Offshore Energy', 'Petrobras hits paydirt in Amapá'), 'INTL_BR');
  assert.equal(W.classeFonte('Offshore Energy', 'Gas flows off Malaysia'), 'INTL');
});

test('links primários: só domínios oficiais citados no corpo, no máximo 2', () => {
  const html = '<article><a href="https://www.gov.br/anp/pt-br/x">ANP</a> <a href="https://petrobras.com.br/fatos">P</a> <a href="https://www.gov.br/mme/y">MME</a> <a href="https://facebook.com/z">f</a></article>';
  const l = W.extrairLinksPrimarios(html, 'https://petronoticias.com.br/a');
  assert.ok(l.length >= 1 && l.length <= 2, JSON.stringify(l));
  assert.ok(l.every((u) => !/facebook/.test(u)));
});

test('pacote: histórico só com relação forte (palavra inteira) e gasto contado', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (u) => {
    u = String(u);
    if (u.includes('/radar-offshore/api/contexto')) return Response.json({ entidades: [P74], atualizado_em: '2026-10-31' });
    if (u.includes('/rest/v1/articles')) return Response.json([
      { id: 'a', title: 'P-74 retoma produção após parada', created_at: '2026-10-20T10:00:00Z', original_url: 'https://x/1' },
      { id: 'b', title: 'P-740 é ficção', created_at: '2026-10-19T10:00:00Z', original_url: 'https://x/2' },
      { id: 'c', title: 'Mesma matéria', created_at: '2026-10-18T10:00:00Z', original_url: 'https://x/atual' }]);
    return new Response('x', { status: 404 });
  };
  try {
    const gasto = { n: 0 };
    const p = await W.montarPacoteContexto({ SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_KEY: 'k' }, { fonte: 'ANP', tituloOriginal: 'P-74', titulo: 'P-74 bate recorde', resumo: '', linksPrimarios: [], url: 'https://x/atual', gasto });
    assert.deepEqual(p.historico.map((h) => h.id), ['a']);
    assert.equal(gasto.n, 2, 'Radar + histórico; fonte oficial não busca documento primário');
    const bloco = W.blocoContextoRedacao(p);
    assert.match(bloco, /Em 20\/10\/2026, o OWNews publicou/);
    assert.match(bloco, /base de 31\/10\/2026/);
    // Radar fora do ar: pacote vazio, nada inventado.
    globalThis.fetch = async () => { throw new Error('rede'); };
    const v = await W.montarPacoteContexto({}, { fonte: 'Eixos', titulo: 't', linksPrimarios: [], gasto: { n: 0 } });
    assert.equal(W.blocoContextoRedacao(v), '');
  } finally { globalThis.fetch = orig; }
});
