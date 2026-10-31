/**
 * Minha Unidade + Radar Offshore no OWBuddy (2026-10-31).
 * Texto livre sempre funciona; o catálogo só sugere; nada sai do aparelho; escala e histórico intactos.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

register('./_ts-resolver.mjs', import.meta.url);
let D;
before(async () => { D = await import('../../../packages/ow-domain/src/index.ts'); });
const RAIZ = new URL('..', import.meta.url).pathname;
const ler = (rel) => readFileSync(join(RAIZ, rel), 'utf8');

const U = (o) => ({ id: 'sonda-ns-55', slug: 'west-jupiter', nome: 'West Jupiter', tipo: 'Navio-sonda', categoria: 'sonda', sigla: 'NS-55', bacia: null, operador: { id: 'op-seadrill', nome: 'Seadrill', slug: 'seadrill' }, campos: ['Búzios'], ...o });
const CATALOGO = [
  U(),
  U({ id: 'sonda-ns-62', slug: 'west-auriga', nome: 'West Auriga', sigla: 'NS-62' }),
  U({ id: 'plat-P58', slug: 'petrobras-58', nome: 'Petrobras 58', tipo: 'FPSO', categoria: 'producao', sigla: 'P58', operador: { id: 'op-33000167000101', nome: 'Petrobras', slug: 'petrobras' } }),
  U({ id: 'plat-FPBAR', slug: 'fpso-almirante-barroso', nome: 'FPSO Almirante Barroso', tipo: 'FPSO', categoria: 'producao', sigla: 'FPBAR', operador: { id: 'op-33000167000101', nome: 'Petrobras', slug: 'petrobras' } }),
];
const PACOTE = {
  versao: 1, atualizado_em: '2026-10-31T15:00:00Z', base_url: 'https://ownews.com.br/radar-offshore', unidades: CATALOGO,
  noticias_unidades: { 'sonda-ns-55': [{ id: 'n1', titulo: 'West Jupiter recebe contrato', data: '2026-10-20' }, { id: 'n2', titulo: 'West Jupiter chega a Búzios', data: '2026-10-10' }] },
  noticias_operadores: { 'op-seadrill': [{ id: 'n1', titulo: 'West Jupiter recebe contrato', data: '2026-10-20' }, { id: 'n9', titulo: 'Seadrill divulga balanço global', data: '2026-10-15' }] },
};

test('autocomplete: "West Ju" sugere West Jupiter primeiro; "P-58" acha Petrobras 58; 1 letra não sugere', () => {
  assert.equal(D.sugerirUnidades(CATALOGO, 'West Ju')[0].nome, 'West Jupiter');
  assert.equal(D.sugerirUnidades(CATALOGO, 'p-58')[0].nome, 'Petrobras 58');
  assert.equal(D.sugerirUnidades(CATALOGO, 'almirante')[0].nome, 'FPSO Almirante Barroso');
  assert.deepEqual(D.sugerirUnidades(CATALOGO, 'W'), []);
  assert.ok(D.sugerirUnidades(CATALOGO, 'west').length <= 6);
});

test('texto livre: unidade desconhecida salva normalmente, sem catálogo e sem internet', () => {
  const mu = D.definirMinhaUnidade('  Navio Desconhecido 7 ', null, '2026-10-31T12:00:00Z');
  assert.deepEqual(mu, { v: 1, nome: 'Navio Desconhecido 7', radar: null, definida_em: '2026-10-31T12:00:00Z' });
  assert.equal(D.definirMinhaUnidade('   ', null, 'x'), null);
  const ctx = D.contextoMinhaUnidade(mu, null);
  assert.equal(ctx.nome, 'Navio Desconhecido 7');
  assert.equal(ctx.unidade, null);
  assert.equal(ctx.url, null);
});

test('unidade conhecida: referência estável + nome preservado; catálogo muda de nome → id ainda acha', () => {
  const mu = D.definirMinhaUnidade('West Jupiter', { id: 'sonda-ns-55', slug: 'west-jupiter' }, 't');
  const renomeado = { ...PACOTE, unidades: [U({ nome: 'West Jupiter (NS-55)', slug: 'west-jupiter-ns-55' })] };
  const ctx = D.contextoMinhaUnidade(mu, renomeado);
  assert.equal(ctx.nome, 'West Jupiter', 'o nome da pessoa fica');
  assert.equal(ctx.unidade.id, 'sonda-ns-55');
  assert.equal(ctx.url, 'https://ownews.com.br/radar-offshore/unidades/west-jupiter-ns-55');
  assert.equal(D.lerMinhaUnidade(JSON.parse(JSON.stringify(mu))).radar.id, 'sonda-ns-55');
  assert.equal(D.lerMinhaUnidade({ v: 1, nome: 'X', radar: { id: '<script>', slug: '../' } }).radar, null, 'referência inválida é ignorada');
});

test('notícias da UNIDADE separadas das da EMPRESA (sem repetir); "novas" conta só as não vistas', () => {
  const mu = D.definirMinhaUnidade('West Jupiter', { id: 'sonda-ns-55', slug: 'west-jupiter' }, 't');
  const ctx = D.contextoMinhaUnidade(mu, PACOTE, ['n2']);
  assert.deepEqual(ctx.noticiasUnidade.map((n) => n.id), ['n1', 'n2']);
  assert.deepEqual(ctx.noticiasOperador.map((n) => n.id), ['n9'], 'balanço global da Seadrill fica em "empresa"');
  assert.equal(ctx.novas, 1);
});

test('card da Início: só embarcado, com unidade do catálogo e notícia nova', () => {
  const mu = D.definirMinhaUnidade('West Jupiter', { id: 'sonda-ns-55', slug: 'west-jupiter' }, 't');
  const ctx = D.contextoMinhaUnidade(mu, PACOTE, []);
  assert.deepEqual(D.cardMinhaUnidadeHome(ctx, true), { nome: 'West Jupiter', novas: 2 });
  assert.equal(D.cardMinhaUnidadeHome(ctx, false), null, 'em casa: não ocupa a Início');
  assert.equal(D.cardMinhaUnidadeHome(D.contextoMinhaUnidade(mu, PACOTE, ['n1', 'n2']), true), null, 'nada novo: some');
  assert.equal(D.cardMinhaUnidadeHome(D.contextoMinhaUnidade(D.definirMinhaUnidade('Livre', null, 't'), PACOTE), true), null);
});

test('histórico antigo: só SUGERE associação com nome exato e único; nunca altera sozinho', () => {
  assert.equal(D.unidadeComNomeExato(CATALOGO, 'west jupiter').id, 'sonda-ns-55');
  assert.equal(D.unidadeComNomeExato(CATALOGO, 'P-58').id, 'plat-P58');
  assert.equal(D.unidadeComNomeExato(CATALOGO, 'West'), null, 'parcial não');
  assert.equal(D.unidadeComNomeExato(CATALOGO, ''), null);
  const leitura = D.lerHistorico({ v: 1, registros: [{ id: 'r1', embarque: '2026-10-16', desembarque: '2026-10-30', unidade: 'West Jupiter', fonte: 'manual', criado_em: 't', updated_at: 't' }] });
  assert.equal(leitura.data.registros[0].unidade_ref, undefined, 'registro antigo continua sem referência');
  const comRef = D.lerHistorico({ v: 1, registros: [{ id: 'r1', embarque: '2026-10-16', desembarque: '2026-10-30', unidade: 'Wj', unidade_ref: { id: 'sonda-ns-55', slug: 'west-jupiter' }, fonte: 'manual', criado_em: 't', updated_at: 't' }] });
  assert.deepEqual(comRef.data.registros[0].unidade_ref, { id: 'sonda-ns-55', slug: 'west-jupiter' });
  assert.equal(comRef.data.registros[0].unidade, 'Wj', 'o texto da pessoa continua');
  const tela = ler('app/historico-registro.tsx');
  assert.match(tela, /const \[associarRadar\] = useAcaoUnica/, 'associar só por toque');
});

test('pacote da rede inválido não quebra: lixo → null; itens ruins descartados; base_url só ownews.com.br', () => {
  assert.equal(D.lerPacoteRadar(null), null);
  assert.equal(D.lerPacoteRadar({ versao: 2, unidades: [] }), null);
  const p = D.lerPacoteRadar({ versao: 1, base_url: 'https://evil.example/x', unidades: [{ id: 'x', slug: 'y', nome: 'Z' }, CATALOGO[0]], noticias_unidades: { a: 'x' } });
  assert.equal(p.unidades.length, 1);
  assert.equal(p.base_url, 'https://ownews.com.br/radar-offshore');
});

test('privacidade: unidade só no aparelho — fora do sync, sem nome/id em analytics, pacote público filtrado aqui', () => {
  assert.doesNotMatch(ler('src/sync.ts'), /MINHA_UNIDADE|getMinhaUnidade|unidade_ref/);
  const st = ler('src/storage.ts');
  assert.match(st, /MINHA_UNIDADE:\s+'owbuddy_minha_unidade'/, 'prefixo owbuddy_: "Apagar dados" também apaga');
  for (const f of ['app/minha-unidade.tsx', 'src/components/CampoUnidade.tsx', 'src/components/CardMinhaUnidade.tsx', 'app/historico-registro.tsx', 'app/historico-form.tsx']) {
    for (const m of ler(f).matchAll(/analytics\.track\(([^)]*)\)/g)) assert.doesNotMatch(m[1], /nome|unidade\.|\.id|slug|texto/, `${f}: ${m[1]}`);
  }
  const api = ler('src/api.ts');
  assert.match(api, /RADAR_PACOTE_URL = `\$\{BASE_URL\}\/radar-offshore\/api\/buddy`/);
  assert.doesNotMatch(api, /api\/unidade\?/, 'o app nunca pergunta pela unidade específica');
});

test('escala intacta: Minha Unidade não lê nem grava a escala; tela não altera ciclo', () => {
  const tela = ler('app/minha-unidade.tsx');
  assert.doesNotMatch(tela, /setEscala|deleteEscala|alterarHistorico/);
  assert.doesNotMatch(ler('../../packages/ow-domain/src/escala.ts'), /unidade|radar/i);
  assert.match(tela, /Isso não muda sua escala, seus embarques nem seu histórico\./);
});

test('offline: campo é texto livre; sugestões só com pacote já guardado; sem rede no meio da digitação', () => {
  const campo = ler('src/components/CampoUnidade.tsx');
  assert.match(campo, /onChangeText=\{\(t\) => onChange\(t, null\)\}/, 'digitar sempre aceita texto');
  assert.doesNotMatch(campo.slice(campo.indexOf('export function CampoUnidade')), /fetch\(/, 'nenhuma letra vai para a rede');
  assert.match(ler('src/api.ts'), /return cached \? \{ pacote: cached\.data, cachedAt: cached\.cachedAt, fromCache: true \} : null;/);
});
