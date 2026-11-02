/**
 * Minha Função (2026-11-02): catálogo de Carreiras do OWNews (fixture gerada do worker real),
 * match determinístico e explicável, "quero embarcar" ≠ exercer a função, nada escondido,
 * alertas como consentimento separado, convite com pausa.
 * Títulos de vaga = títulos reais do Radar de Vagas (31/10/2026).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register('./_ts-resolver.mjs', import.meta.url);
let D, CAT;
before(async () => {
  D = await import('../../../packages/ow-domain/src/index.ts');
  CAT = D.lerCatalogoFuncoes(JSON.parse(readFileSync(new URL('./fixtures-catalogo-funcoes.json', import.meta.url), 'utf8')));
});
const AGORA = '2026-11-02T12:00:00Z';
const f = (slug) => CAT.funcoes.find((x) => x.slug === slug);
const trabalho = (slug, extra = {}) => D.definirMinhaFuncao({ situacao: 'trabalho', funcao: f(slug), ...extra }, AGORA);
const V = (id, titulo, categoria) => ({ id, titulo, categoria });
const VAGAS = [
  V('v1', 'Sondador Cyber | Cyber Driller', 'perfuracao'),
  V('v2', 'Operador de Posicionamento Dinâmico | Dynamic Positioning Operator', 'conves'),
  V('v3', 'Marinheira(o) de Máquinas', 'conves'),
  V('v4', 'Técnico de Segurança do Trabalho Offshore Temporário', 'sms'),
  V('v5', 'MSO - Soldador(a) I Escalador NI - OFFSHORE', 'manutencao'),
  V('v6', 'Operadora(o) de Convés (CONTRATO POR TEMPO DETERMINADO)', 'conves'),
  V('v7', 'Engenheiro (a) de Processos Jr.', 'engenharia'),
  V('v8', 'Assistant Driller', 'perfuracao'),
  V('v9', 'Estagiário(a) de QSMS', 'sms'),
  V('v10', 'Deck Pusher', 'conves'),
];

test('catálogo: 58 funções reais em 8 áreas, com termos e relações; lixo é descartado', () => {
  assert.equal(CAT.funcoes.length, 58);
  assert.equal(CAT.areas.length, 8);
  assert.ok(f('deck-pusher').relacionadas.includes('guindasteiro'));
  assert.deepEqual(f('torrista-derrickman').termos.sort(), ['Derrickman', 'Torrista', 'Torrista (Derrickman)'].sort());
  assert.equal(D.lerCatalogoFuncoes({ areas: [], funcoes: [] }), null);
  assert.equal(D.lerCatalogoFuncoes(null), null);
  assert.ok(!f('toolpusher').termos.includes('Pusher'), '"Pusher" casaria com Deck Pusher');
});

test('registro: área + função, troca, remover (null), texto livre separado, alertas só se marcado', () => {
  const m = trabalho('deck-pusher');
  assert.equal(m.area, 'deck'); assert.equal(m.funcao.slug, 'deck-pusher'); assert.equal(m.alertas, false, 'função não liga alerta');
  assert.equal(trabalho('guindasteiro').funcao.slug, 'guindasteiro');
  const livre = D.definirMinhaFuncao({ situacao: 'trabalho', area: 'engine', texto_livre: 'Operador de Sala de Controle' }, AGORA);
  assert.equal(livre.funcao, null); assert.equal(livre.texto_livre, 'Operador de Sala de Controle');
  assert.equal(D.definirMinhaFuncao({ situacao: 'trabalho' }, AGORA), null);
  assert.equal(trabalho('dpo', { alertas: true }).alertas, true);
  assert.deepEqual(D.lerMinhaFuncao(JSON.parse(JSON.stringify(m))), m, 'sobrevive a fechar/abrir (JSON)');
  assert.equal(D.lerMinhaFuncao({ situacao: 'trabalho', funcao: { slug: '<script>', nome: 'x' } }), null);
  const qe = D.definirMinhaFuncao({ situacao: 'quero_embarcar' }, AGORA);
  assert.equal(qe.situacao, 'quero_embarcar', '"quero embarcar" sem área é válido');
});

test('autocomplete: "deck" acha Deck Pusher; apelido acha a função; área filtra', () => {
  assert.ok(D.buscarFuncoes(CAT, 'deck').some((x) => x.slug === 'deck-pusher'));
  assert.equal(D.buscarFuncoes(CAT, 'derrickman')[0].slug, 'torrista-derrickman');
  assert.equal(D.buscarFuncoes(CAT, 'homem de area')[0].slug, 'roustabout');
  assert.ok(D.buscarFuncoes(CAT, 'tecnico', 'seguranca').every((x) => x.area === 'seguranca'));
  assert.deepEqual(D.buscarFuncoes(CAT, 'zzz'), []);
});

test('vagas: exata, relacionada, só área, incompatível — com o motivo exibível', () => {
  const dp = trabalho('deck-pusher');
  assert.deepEqual(D.classificarVaga(VAGAS[9], dp, CAT), { nivel: 'exata', motivo: 'Sua função' });
  assert.deepEqual(D.classificarVaga(VAGAS[5], dp, CAT), { nivel: 'area', motivo: 'Sua área: Deck' }, 'convés sem função nomeada = só área');
  assert.equal(D.classificarVaga(VAGAS[6], dp, CAT), null, 'engenharia de processos não é para Deck Pusher');
  const dr = trabalho('driller');
  assert.equal(D.classificarVaga(VAGAS[0], dr, CAT).nivel, 'exata', 'Cyber Driller');
  assert.equal(D.classificarVaga(VAGAS[7], dr, CAT).nivel, 'relacionada', 'Assistant Driller ≠ Driller (termo mais longo vence)');
  assert.equal(D.classificarVaga(VAGAS[1], trabalho('dpo'), CAT).nivel, 'exata', 'nome em inglês documentado');
  assert.equal(D.classificarVaga(VAGAS[2], trabalho('marinheiro-de-maquinas'), CAT).nivel, 'exata', 'Marinheira(o) de Máquinas');
  assert.equal(D.classificarVaga(VAGAS[3], trabalho('tecnico-seguranca-trabalho'), CAT).nivel, 'exata');
  assert.equal(D.classificarVaga(VAGAS[4], trabalho('welder'), CAT).nivel, 'exata', 'Soldador(a) = Welder (documentado)');
  assert.equal(D.classificarVaga(VAGAS[0], trabalho('tecnico-seguranca-trabalho'), CAT), null, 'perfuração não aparece para segurança');
});

test('vagas: "para você" e "na sua área" separados; nada some de "todas"', () => {
  const r = D.vagasParaFuncao(VAGAS, trabalho('deck-pusher'), CAT);
  assert.deepEqual(r.paraVoce.map((x) => x.vaga.id), ['v10']);
  assert.ok(r.naArea.map((x) => x.vaga.id).includes('v6'));
  assert.ok(!r.paraVoce.concat(r.naArea).some((x) => x.vaga.id === 'v7'));
  assert.deepEqual(D.vagasParaFuncao(VAGAS, null, CAT), { paraVoce: [], naArea: [] }, 'sem função: nada personalizado');
  assert.equal(VAGAS.length, 10, 'a lista original não é alterada');
});

test('quero embarcar: só vagas de entrada (na área de interesse) — não trata como quem já exerce', () => {
  const qe = D.definirMinhaFuncao({ situacao: 'quero_embarcar', area: 'seguranca' }, AGORA);
  const r = D.vagasParaFuncao(VAGAS, qe, CAT);
  assert.deepEqual(r.paraVoce.map((x) => [x.vaga.id, x.match.motivo]), [['v9', 'Para começar em Segurança']]);
  assert.ok(!r.paraVoce.some((x) => x.vaga.id === 'v4'), 'Técnico de Segurança experiente não é "para começar"');
  const qeDeck = D.definirMinhaFuncao({ situacao: 'quero_embarcar', funcao: f('deck-pusher') }, AGORA);
  assert.equal(D.classificarVaga(VAGAS[9], qeDeck, CAT).motivo, 'Função que você quer');
  assert.equal(D.noticiaRelacionada('Deck Pusher ganha nova norma', qeDeck, CAT), false);
});

test('vagas novas: só as "para você" ainda não vistas', () => {
  const dp = trabalho('deck-pusher');
  assert.deepEqual(D.vagasNovasParaFuncao(VAGAS, dp, CAT, []).map((v) => v.id), ['v10']);
  assert.deepEqual(D.vagasNovasParaFuncao(VAGAS, dp, CAT, ['v10']), []);
});

test('notícias: sinal só quando o título nomeia a função; nada é filtrado', () => {
  const dr = trabalho('driller');
  assert.equal(D.noticiaRelacionada('Foresea contrata Cyber Driller para nova sonda', dr, CAT), true);
  assert.equal(D.noticiaRelacionada('Assistant Driller: o que muda na nova NR', dr, CAT), false);
  assert.equal(D.noticiaRelacionada('Petrobras anuncia nova FPSO no pré-sal', dr, CAT), false, 'notícia geral: sem sinal, mas continua no feed');
  assert.equal(D.noticiaRelacionada('Deck tem nova regra de segurança', trabalho('deck-pusher'), CAT), false, '"deck" solto não conta');
});

test('conteúdos: ficha real da função + relacionadas; quero embarcar → guias de entrada', () => {
  const c = D.conteudosParaFuncao(trabalho('deck-pusher'), CAT);
  assert.equal(c[0].url, 'https://ownews.com.br/funcoes/deck-pusher');
  assert.ok(c.some((x) => x.tipo === 'relacionada'));
  const q = D.conteudosParaFuncao(D.definirMinhaFuncao({ situacao: 'quero_embarcar', area: 'deck' }, AGORA), CAT);
  assert.equal(q[0].url, 'https://ownews.com.br/comece-aqui');
  assert.ok(q.some((x) => x.url.endsWith('/funcoes/roustabout')), 'porta de entrada de Deck');
  assert.ok(q.every((x) => x.url.startsWith('https://ownews.com.br/')));
});

test('convite: aparece sem função; "Agora não" pausa 30 dias; com função nunca', () => {
  const t = Date.parse(AGORA);
  assert.equal(D.mostrarConviteFuncao(null, null, t), true);
  assert.equal(D.mostrarConviteFuncao(null, '2026-11-01T12:00:00Z', t), false);
  assert.equal(D.mostrarConviteFuncao(null, '2026-10-01T12:00:00Z', t), true);
  assert.equal(D.mostrarConviteFuncao(trabalho('dpo'), null, t), false);
});

test('privacidade: chave local fora do sync; analytics sem função', () => {
  const ler = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  assert.match(ler('../src/storage.ts'), /MINHA_FUNCAO:\s+'owbuddy_minha_funcao'/);
  assert.ok(!/minha_funcao/.test(ler('../src/sync.ts')), 'Minha Função não entra no sync');
  for (const arq of ['../app/minha-funcao.tsx', '../app/vagas.tsx']) {
    const s = ler(arq);
    for (const m of s.matchAll(/analytics\.track\([^)]*\)/g)) assert.ok(!/funcao\b|slug|area|nome/.test(m[0].replace(/'[a-z_]+'/, '')), `analytics sem dado da função: ${m[0]}`);
  }
});

test('rótulo', () => {
  assert.equal(D.rotuloMinhaFuncao(trabalho('deck-pusher'), CAT), 'Deck Pusher');
  assert.equal(D.rotuloMinhaFuncao(D.definirMinhaFuncao({ situacao: 'quero_embarcar', area: 'deck' }, AGORA), CAT), 'Quero embarcar · Deck');
  assert.equal(D.rotuloMinhaFuncao(null, CAT), null);
});
