// Radar Offshore — testes sem rede. node tests/radar_test.mjs
// Usa fixtures pequenas no formato REAL da ANP (cabeçalhos copiados das bases de 31/10/2026).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FONTES } from '../fontes.mjs';
import { lerCsv, csvParaObjetos, decodificar, numero, dataIso, mesIso, coordenada, slug, nomeExibicao, variacao, diasNoMes, M3_PARA_BARRIL } from '../lib/texto.mjs';
import { lerFonte, escolherArquivos } from '../ingestao/anp.mjs';
import { construirSnapshot, agregarProducao, atribuirSlugs, coordenadaValida } from '../ingestao/normalizar.mjs';
import { relacionarNoticias, citaCampo, termosUnidade, contemFrase, vagasPorOperador } from '../ingestao/noticias.mjs';
import { detectarPautas } from '../ingestao/pautas.mjs';
import { simplificarAnel } from '../ingestao/geo.mjs';
import worker, { __limparMemoria } from '../worker/index.mjs';
import { fichaIndexavel } from '../worker/paginas.mjs';
import { ambiente } from './_ambiente.mjs';

const testes = [];
const teste = (n, f) => testes.push([n, f]);
const enc = (s) => new TextEncoder().encode(s);
const latin1 = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));

// ─── fixtures no formato da ANP ───
const CSV_PLAT = '﻿[SIGLA DA INSTALAÇÃO],[NOME DA INSTALAÇÃO],[CAMPOS],[BACIA],[OPERADOR],[CLASSIFICAÇÃO],[LÂMINA D\'ÁGUA (m)],[SISTEMA DE ESCOAMENTO],[ANO DE INÍCIO DE OPERAÇÃO],[LATITUDE],[LONGITUDE],[CAPACIDADE DE PRODUÇÃO DE PETRÓLEO (bbl/d)],[CAPACIDADE DE PRODUÇÃO DE GÁS NATURAL (Mil m³/d)]\n'
  + 'FPBAR,FPSO ALMIRANTE BARROSO,BÚZIOS / TAMBUATÁ,Santos,PETRÓLEO BRASILEIRO S.A. - PETROBRAS,Floating Production Storage Offloading - FPSO,1900,Navio Aliviador,2023,"-24,59253250","-42,56725167",173640,6291\n'
  + 'P58,PETROBRAS 58,JUBARTE,Campos,PETRÓLEO BRASILEIRO S.A. - PETROBRAS,Floating Production Storage Offloading - FPSO,1400,Navio Aliviador,2014,"-21,2","-40,0",180000,6000\n'
  + 'XYZ,PLATAFORMA SEM COORDENADA,BÚZIOS,Santos,EMPRESA SEM CNPJ LTDA,Plataforma Fixa - Jaqueta,100,Oleoduto,1990,"","",1000,10\n';
const plataformas = csvParaObjetos(CSV_PLAT.replace(/^﻿/, ''), ',').linhas;
const campos = [
  { CODIGO_CAMPO: '4598', CAMPO: 'BÚZIOS', SIGLA_CAMPO: 'BUZ', BACIA: 'Santos', ESTADO: 'Rio de Janeiro', OPERADOR: 'PETROBRAS', AMBIENTE: 'Mar', RODADA: 'CO', NOME_CONTRATO: 'BÚZIOS', SITUACAO_CAMPO: 'Produção', DATA_INICIO_PRODUCAO: '04/04/2018', DATA_ASSINATURA: '03/09/2010' },
  { CODIGO_CAMPO: '682', CAMPO: 'TAMBUATÁ', SIGLA_CAMPO: 'TBT', BACIA: 'Santos', OPERADOR: 'PETROBRAS', AMBIENTE: 'Mar', SITUACAO_CAMPO: 'Desenvolvimento' },
  { CODIGO_CAMPO: '15', CAMPO: 'JUBARTE', SIGLA_CAMPO: 'JUB', BACIA: 'Campos', OPERADOR: 'PETROBRAS', AMBIENTE: 'Mar', SITUACAO_CAMPO: 'Produção' },
  { CODIGO_CAMPO: '900', CAMPO: 'CARMÓPOLIS', SIGLA_CAMPO: 'CP', BACIA: 'Sergipe', OPERADOR: 'CARMO ENERGY', AMBIENTE: 'Terra', SITUACAO_CAMPO: 'Produção' },
];
const concessionarios = [
  { CODIGO_CAMPO: '4598', CAMPO: 'BÚZIOS', 'RAZAO_SOCIAL/CONCESSIONARIO': 'PETRÓLEO BRASILEIRO S.A. - PETROBRAS', CNPJ: '33000167000101', 'PARTICIPACAO (%)': '88,99', OPERADOR: 'S' },
  { CODIGO_CAMPO: '4598', CAMPO: 'BÚZIOS', 'RAZAO_SOCIAL/CONCESSIONARIO': 'CNOOC PETROLEUM BRASIL LTDA', CNPJ: '11111111000111', 'PARTICIPACAO (%)': '7,34', OPERADOR: 'N' },
  { CODIGO_CAMPO: '682', CAMPO: 'TAMBUATÁ', 'RAZAO_SOCIAL/CONCESSIONARIO': 'PETRÓLEO BRASILEIRO S.A. - PETROBRAS', CNPJ: '33000167000101', 'PARTICIPACAO (%)': '100,00', OPERADOR: 'S' },
  { CODIGO_CAMPO: '15', CAMPO: 'JUBARTE', 'RAZAO_SOCIAL/CONCESSIONARIO': 'PETRÓLEO BRASILEIRO S.A. - PETROBRAS', CNPJ: '33000167000101', 'PARTICIPACAO (%)': '100,00', OPERADOR: 'S' },
];
const sondas = [
  { Sigla_da_sonda: 'NS-55', Nome_da_sonda: 'WEST JUPITER', Campo: 'BÚZIOS', Operador_da_sonda: 'SEADRILL' },
  { Sigla_da_sonda: 'Ns-48', Nome_da_sonda: 'WEST CARINA', Campo: 'JUBARTE', Operador_da_sonda: 'SEADRILL' },
  { Sigla_da_sonda: 'SPT-1', Nome_da_sonda: 'SONDA TERRESTRE', Campo: 'CARMÓPOLIS', Operador_da_sonda: 'PERBRAS' },
  { Sigla_da_sonda: 'NS-99', Nome_da_sonda: 'WEST JUPITERR', Campo: 'BÚZIOS', Operador_da_sonda: 'OUTRA EMPRESA' },
];
const prod = (mes, campo, poco, inst, oleo, cond, gasA, gasN) => ({ 'Mês/Ano': mes, Campo: campo, 'Poço': poco, 'Instalação': inst, 'Produção de Óleo (m³)': oleo, 'Produção de Condensado (m³)': cond, 'Produção de Gás Associado (Mm³)': gasA, 'Produção de Gás Não Associado (Mm³)': gasN });
const producao = [
  prod('07/2026', 'BÚZIOS', 'P1', 'FPSO ALMIRANTE BARROSO', '310.000,00', '0,00', '9.300,000', '0,000'),
  prod('08/2026', 'BÚZIOS', 'P1', 'FPSO ALMIRANTE BARROSO', '300.000,00', '1.000,00', '9.000,000', '300,000'),
  prod('08/2026', 'BÚZIOS', 'P2', 'FPSO ALMIRANTE BARROSO', '0,00', '0,00', '0,000', '0,000'),
  prod('08/2026', 'JUBARTE', 'J1', 'PETROBRAS 58', '62.000,00', '0,00', '1.550,000', '0,000'),
];
const snapBase = (extra = {}) => construirSnapshot({ plataformas, sondas, campos, concessionarios, producao, anoSondas: 2026, agora: '2026-10-31T00:00:00Z', ...extra });

/* ─── texto / CSV ─── */
teste('CSV: aspas, vírgula decimal e separador ";"', () => {
  assert.deepEqual(lerCsv('a,"b,c","d ""x"""\n1,2,3\n'), [['a', 'b,c', 'd "x"'], ['1', '2', '3']]);
  assert.deepEqual(lerCsv('x;y\r\n1;2\r\n', ';'), [['x', 'y'], ['1', '2']]);
});
teste('decodificação: ISO-8859-1 da exploração e UTF-8 com BOM; UTF-8 inválido acusa erro', () => {
  assert.equal(decodificar(latin1('POÇO ANP'), 'iso-8859-1'), 'POÇO ANP');
  assert.equal(decodificar(enc('﻿ok'), 'utf-8'), 'ok');
  assert.throws(() => decodificar(latin1('POÇO'), 'utf-8'));
});
teste('números, datas e coordenadas no padrão ANP', () => {
  assert.equal(numero('1.234,56'), 1234.56);
  assert.equal(numero('-24,55964917'), -24.55964917);
  assert.equal(numero('173640'), 173640);
  assert.equal(numero(''), null);
  assert.equal(dataIso('04/04/2018'), '2018-04-04');
  assert.equal(dataIso('31/02/2026'), null);
  assert.equal(mesIso('08/2026'), '2026-08');
  assert.ok(Math.abs(coordenada('-21:20:01,787') - -21.333830) < 1e-5);
  assert.equal(coordenadaValida(-24.6, -42.5), true);
  assert.equal(coordenadaValida(24.6, -42.5), false, 'hemisfério errado é descartado, não corrigido');
});
teste('nomes: siglas e marcas preservadas; slug estável', () => {
  assert.equal(nomeExibicao('FPSO ALMIRANTE BARROSO'), 'FPSO Almirante Barroso');
  assert.equal(nomeExibicao('TOTALENERGIES EP'), 'TotalEnergies EP');
  assert.equal(slug('FPSO Alexandre de Gusmão'), 'fpso-alexandre-de-gusmao');
});

/* ─── validação de dataset ─── */
teste('dataset inválido NÃO passa: coluna faltando, HTML no lugar do CSV, volume implausível', () => {
  const f = FONTES.plataformas;
  assert.throws(() => lerFonte(f, enc('[SIGLA DA INSTALAÇÃO],[NOME DA INSTALAÇÃO]\nA,B\n')), /colunas essenciais ausentes/);
  assert.throws(() => lerFonte(f, enc('<!doctype html><html>manutenção</html>')), /HTML/);
  assert.throws(() => lerFonte(f, enc(CSV_PLAT)), /volume implausível/, '3 linhas < mínimo de 40');
  const grande = CSV_PLAT + Array.from({ length: 50 }, (_, i) => `S${i},UNIDADE ${i},BÚZIOS,Santos,X,FPSO,1,x,2020,"-24","-42",1,1`).join('\n');
  assert.equal(lerFonte(f, enc(grande)).linhas.length, 53);
});
teste('arquivo vigente: nomes mensais inconsistentes da ANP → o mais recente', () => {
  const links = ['https://x/pads-andamento/2026/pads-andamento_fev_2026.csv', 'https://x/pads-andamento/2026/pads-andamento-set.csv', 'https://x/pads-andamento/2025/pads-andamento-dez.csv', 'https://x/pads-andamento/2026/pads-andamento_abr_2026.csv'];
  assert.equal(escolherArquivos(links, FONTES.pads_andamento)[0].url, 'https://x/pads-andamento/2026/pads-andamento-set.csv');
  const prodLinks = ['https://x/pm/producao-mar-2025.csv', 'https://x/pm/producao-mar-2026.csv', 'https://x/pm/producao-mar-2019.csv'];
  assert.deepEqual(escolherArquivos(prodLinks, FONTES.producao_mar).map((a) => a.ano), [2026, 2025], 'série de 12 meses: ano atual + anterior');
});

/* ─── normalização / identidade ─── */
teste('identidade conservadora: nome parecido NÃO une; sigla minúscula normalizada; terra fica fora', () => {
  const s = snapBase();
  const ids = s.unidades.map((u) => u.id);
  assert.ok(ids.includes('sonda-ns-55') && ids.includes('sonda-ns-99'), 'WEST JUPITER e WEST JUPITERR continuam separadas');
  assert.ok(ids.includes('sonda-ns-48'), '"Ns-48" vira NS-48');
  assert.ok(!ids.some((i) => i.includes('spt')), 'sonda de terra fora do Radar Offshore');
  assert.equal(s.campos.length, 3, 'só campos no mar');
  assert.ok(!s.campos.some((c) => c.nome === 'Carmópolis'));
});
teste('operador por CNPJ: plataforma e campo = mesma Petrobras; sem CNPJ vira entidade própria + revisão', () => {
  const s = snapBase();
  const p = s.operadores.find((o) => o.cnpj === '33000167000101');
  assert.equal(p.nome, 'Petrobras');
  assert.deepEqual(p.unidades.sort(), ['plat-FPBAR', 'plat-P58']);
  assert.equal(p.campos.length, 3);
  assert.ok(s.revisao.some((r) => r.tipo === 'operador_sem_cnpj'));
  assert.ok(s.operadores.some((o) => o.nome === 'Seadrill' && o.sondas.length === 2));
});
teste('slugs estáveis: uma vez atribuído, não muda; colisão ganha sufixo da sigla', () => {
  const a = atribuirSlugs([{ id: 'x1', nome: 'Unidade', sufixo: 'A1' }, { id: 'x2', nome: 'Unidade', sufixo: 'B2' }]);
  assert.deepEqual(a, { x1: 'unidade', x2: 'unidade-b2' });
  const b = atribuirSlugs([{ id: 'x1', nome: 'Unidade Renomeada', sufixo: 'A1' }], { x1: 'unidade' });
  assert.equal(b.x1, 'unidade', 'renomear na ANP não quebra a URL');
});
teste('coordenada ausente → null (nunca inventada) e registrada para revisão', () => {
  const s = snapBase();
  const u = s.unidades.find((x) => x.id === 'plat-XYZ');
  assert.equal(u.lat, null);
  assert.ok(s.revisao.some((r) => r.tipo === 'coordenada_invalida' && r.id === 'plat-XYZ'));
});

/* ─── produção (matemática) ─── */
teste('produção: petróleo = óleo + condensado em barris/dia pelos dias do mês; gás = associado + não associado', () => {
  const a = agregarProducao(producao);
  const ago = a.nacional.find((x) => x.mes === '2026-08');
  assert.equal(ago.petroleo_bbl_d, Math.round(((300000 + 1000 + 62000) * M3_PARA_BARRIL) / 31));
  assert.equal(ago.gas_mil_m3_d, Math.round(((9000 + 300 + 1550) / 31) * 10) / 10);
  assert.equal(ago.pocos, 2, 'poço sem produção não conta');
  assert.equal(diasNoMes('2026-02'), 28);
  assert.equal(diasNoMes('2028-02'), 29);
});
teste('variação: absoluta, percentual e base zero (nunca percentual inventado)', () => {
  assert.deepEqual(variacao(110, 100), { absoluta: 10, percentual: 10 });
  assert.deepEqual(variacao(90, 100), { absoluta: -10, percentual: -10 });
  assert.deepEqual(variacao(5, 0), { absoluta: 5, percentual: null });
  assert.equal(variacao(null, 1), null);
});
teste('unidade e campo recebem a produção do mês de referência', () => {
  const s = snapBase();
  assert.equal(s.producao.mes_referencia, '2026-08');
  const fpbar = s.unidades.find((u) => u.id === 'plat-FPBAR');
  assert.equal(fpbar.producao.petroleo_bbl_d, Math.round((301000 * M3_PARA_BARRIL) / 31));
  assert.equal(s.campos.find((c) => c.nome === 'Búzios').serie.length, 2);
});

/* ─── pautas ─── */
teste('pautas: nova sonda, saída de unidade, novo mês com variação correta — nada publicado', () => {
  const ant = snapBase({ producao: producao.filter((p) => p['Mês/Ano'] === '07/2026') });
  const novo = snapBase({ sondas: [...sondas, { Sigla_da_sonda: 'NS-70', Nome_da_sonda: 'NOVA SONDA', Campo: 'BÚZIOS', Operador_da_sonda: 'X' }], plataformas: plataformas.slice(0, 2) });
  const p = detectarPautas(ant, novo, { detectadoEm: 't' });
  assert.ok(p.some((x) => x.tipo === 'nova_sonda' && /Nova Sonda/.test(x.titulo)));
  assert.ok(p.some((x) => x.tipo === 'unidade_saiu'));
  const m = p.find((x) => x.tipo === 'producao_mensal');
  const jul = Math.round((310000 * M3_PARA_BARRIL) / 31), ago = Math.round((363000 * M3_PARA_BARRIL) / 31);
  assert.equal(m.dados.absoluta, ago - jul);
  assert.ok(Math.abs(m.dados.percentual - ((ago - jul) / jul) * 100) < 1e-9);
  assert.equal(detectarPautas(null, novo).length, 0, 'primeira carga não gera pauta');
});

/* ─── notícias relacionadas (falsos positivos reais) ─── */
const art = (id, title, buddy_summary = '') => ({ id, title, buddy_summary, published_at: '2026-10-20T10:00:00Z' });
teste('notícias: "Petrobras (58%)" não é a P-58; "P-58" é', () => {
  const s = snapBase();
  const rel = relacionarNoticias([art('a', 'Petrobras 58% e sócios arrematam blocos'), art('b', 'P-58 volta a produzir após parada')], s, { agora: Date.parse('2026-10-31') });
  assert.deepEqual((rel.unidades['plat-P58'] || []).map((n) => n.id), ['b']);
  assert.ok(termosUnidade({ nome_anp: 'PETROBRAS 58', nome: 'Petrobras 58' }).every((t) => t !== 'PETROBRAS 58'));
});
teste('notícias: campo só com "campo(s)" antes; Búzios cidade não; listas sim; frase solta não', () => {
  const k = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const palavras = new Set(['BUZIOS', 'TAMBUATA', 'JUBARTE']);
  assert.equal(citaCampo(k('Festival de verão em Búzios'), 'BUZIOS', palavras), false);
  assert.equal(citaCampo(k('PPSA vende cargas dos campos de Tambuatá e Búzios'), 'BUZIOS', palavras), true);
  assert.equal(citaCampo(k('campo de testes na região de Búzios'), 'BUZIOS', palavras), false);
  assert.equal(citaCampo(k('Jubarte aparece em Abrolhos'), 'JUBARTE', palavras), false);
});
teste('notícias: unidade citada só no fim do resumo não conta (só título + 1ª frase)', () => {
  const s = snapBase();
  const rel = relacionarNoticias([art('x', 'Leilão de petróleo da União', 'A PPSA vendeu cargas. Elas vieram do FPSO Almirante Barroso e de outras.')], s, { agora: Date.parse('2026-10-31') });
  assert.equal(rel.unidades['plat-FPBAR'], undefined);
  assert.ok(contemFrase('A FPSO ALMIRANTE BARROSO B', 'FPSO ALMIRANTE BARROSO'));
});
teste('vagas por operador: só empresa com alias revisado e vaga real', () => {
  const ops = [{ id: 'op-seadrill', nome: 'Seadrill' }, { id: 'op-x', nome: 'Empresa' }];
  const v = vagasPorOperador([{ empresa: 'Seadrill', titulo: 'Sondador', local: 'Macaé' }, { empresa: 'Outra', titulo: 'X' }], ops);
  assert.deepEqual(Object.keys(v), ['op-seadrill']);
});
teste('geometria simplificada mantém anel fechado e válido', () => {
  const anel = [[-40, -22], [-40.001, -22], [-39.9, -22], [-39.9, -22.1], [-40, -22.1], [-40, -22]];
  const r = simplificarAnel(anel, 0.5);
  assert.ok(r.length >= 4);
  assert.deepEqual(r[0], r[r.length - 1]);
});

/* ─── worker (páginas, API, segurança, SEO, freshness, PT-BR) ─── */
async function preparar() {
  __limparMemoria();
  const { env, ctx, gravados } = ambiente(null);
  const s = snapBase();
  const meta = { gerado_em: '2026-10-31T12:00:00Z', fontes: { plataformas: { nome: 'Plataformas em operação', arquivo: 'https://www.gov.br/anp/x.csv', referencia: null, baixado_em: '2026-10-31T09:00:00Z', status: 'ok' }, producao_mar: { nome: 'Produção de petróleo e gás natural no mar, por poço (mensal)', arquivo: 'https://www.gov.br/anp/y.csv', referencia: '2026', baixado_em: '2026-10-31T09:00:00Z', status: 'falhou' } } };
  const put = (k, v) => gravados.set(k, JSON.stringify(v));
  put('radar:meta', meta); put('radar:resumo', s.resumo); put('radar:unidades', s.unidades); put('radar:campos', s.campos); put('radar:operadores', s.operadores);
  put('radar:producao', s.producao); put('radar:exploracao', s.exploracao); put('radar:futuro', s.futuro); put('radar:busca', s.unidades.map((u) => ({ id: u.id, slug: u.slug, nome: u.nome, categoria: u.categoria, tipo: u.tipo, sigla: u.sigla })));
  put('radar:noticias', { unidades: { 'sonda-ns-55': [{ id: 'n1', titulo: '<script>alert(1)</script> West Jupiter', data: '2026-10-20' }] }, campos: {}, operadores: {} });
  return { env, ctx, s };
}
const pedir = (env, ctx, rota, init) => worker.fetch(new Request(`https://ownews.com.br/radar-offshore${rota}`, init), env, ctx);

teste('worker: todas as páginas respondem; inexistente = 404 noindex', async () => {
  const { env, ctx, s } = await preparar();
  const rotas = ['', '/unidades', '/sondas', '/campos', '/operadores', '/producao', '/exploracao', '/futuro', '/mapa', '/fontes', ...s.unidades.map((u) => `/unidades/${u.slug}`), ...s.campos.map((c) => `/campos/${c.slug}`), ...s.operadores.map((o) => `/operadores/${o.slug}`)];
  for (const r of rotas) {
    const res = await pedir(env, ctx, r);
    assert.equal(res.status, 200, r);
    assert.equal(res.headers.get('x-radar-pagina'), '1');
    const p = await res.json();
    assert.ok(p.titulo && p.descricao && p.canonical && p.html, r);
    assert.doesNotMatch(p.html, /undefined|NaN|\[object Object\]|N\/A/, r);
  }
  const n = await (await pedir(env, ctx, '/unidades/nao-existe')).json();
  assert.equal(n.status, 404); assert.match(n.robots, /noindex/);
});
teste('worker: XSS escapado; fonte ANP, data de consulta e falha da fonte visíveis (freshness honesta)', async () => {
  const { env, ctx } = await preparar();
  const p = await (await pedir(env, ctx, '/unidades/west-jupiter')).json();
  assert.doesNotMatch(p.html, /<script>alert/);
  assert.match(p.html, /&lt;script&gt;/);
  const prod = await (await pedir(env, ctx, '/producao')).json();
  assert.match(prod.html, /Agência Nacional do Petróleo/);
  assert.match(prod.html, /base consultada em 31\/10\/2026/);
  assert.match(prod.html, /A ANP não respondeu na última verificação; exibindo a base de 31\/10\/2026/);
  assert.match(prod.html, /Consulte a fonte original para informações regulatórias/);
});
teste('worker: sem snapshot → página "indisponível" (503), nunca quebra', async () => {
  __limparMemoria();
  const { env, ctx } = ambiente(null);
  const p = await (await pedir(env, ctx, '')).json();
  assert.equal(p.status, 503);
  const api = await pedir(env, ctx, '/api/resumo');
  assert.equal(api.status, 503);
});
teste('worker: escrita só com segredo; chave fora da lista recusada; JSON inválido recusado', async () => {
  const { env, ctx } = await preparar();
  const sem = await worker.fetch(new Request('https://x/interno/snapshot?chave=radar:meta', { method: 'PUT', body: '{}' }), env, ctx);
  assert.equal(sem.status, 401);
  const h = { 'x-radar-secret': env.RADAR_INGEST_SECRET };
  assert.equal((await worker.fetch(new Request('https://x/interno/snapshot?chave=outra', { method: 'PUT', headers: h, body: '{}' }), env, ctx)).status, 400);
  assert.equal((await worker.fetch(new Request('https://x/interno/snapshot?chave=radar:meta', { method: 'PUT', headers: h, body: '{x' }), env, ctx)).status, 400);
  assert.equal((await worker.fetch(new Request('https://x/interno/snapshot?chave=radar:pautas', { method: 'PUT', headers: h, body: '[]' }), env, ctx)).status, 200);
  assert.equal((await pedir(env, ctx, '', { method: 'POST' })).status, 405);
});
teste('API: busca "west" → unidade; pacote do Buddy traz catálogo e notícias de todas; GeoJSON válido', async () => {
  const { env, ctx } = await preparar();
  const b = await (await pedir(env, ctx, '/api/busca?q=west')).json();
  assert.equal(b.unidades[0].nome, 'West Carina');
  const pac = await (await pedir(env, ctx, '/api/buddy')).json();
  assert.equal(pac.versao, 1);
  assert.ok(pac.unidades.some((u) => u.id === 'sonda-ns-55'));
  assert.ok(pac.noticias_unidades['sonda-ns-55']);
  const g = await (await pedir(env, ctx, '/api/geo/unidades')).json();
  assert.equal(g.type, 'FeatureCollection');
  assert.ok(g.features.every((f) => f.geometry.type === 'Point' && f.geometry.coordinates.length === 2));
  assert.equal(g.features.length, 2, 'unidade sem coordenada não vai para o mapa');
});
teste('SEO: sitemap com hub, seções e entidades; canonical por página; JSON-LD de unidade com geo', async () => {
  const { env, ctx, s } = await preparar();
  const xml = await (await pedir(env, ctx, '/sitemap.xml')).text();
  assert.match(xml, /<loc>https:\/\/ownews\.com\.br\/radar-offshore<\/loc>/);
  // Só fichas com dado próprio (fichaIndexavel); as demais ficam fora do sitemap.
  for (const u of s.unidades) assert.equal(xml.includes(`/radar-offshore/unidades/${u.slug}<`), fichaIndexavel('unidade', u, s.noticias), u.slug);
  assert.ok(s.unidades.some((u) => fichaIndexavel('unidade', u, s.noticias)), 'fixture tem ao menos uma unidade indexável');
  const p = await (await pedir(env, ctx, '/unidades/fpso-almirante-barroso')).json();
  assert.equal(p.canonical, '/radar-offshore/unidades/fpso-almirante-barroso');
  assert.equal(p.jsonLd['@type'], 'Place');
  assert.ok(p.jsonLd.geo.latitude < 0);
});
teste('PT-BR: nenhuma página do Radar sai em inglês (bloqueio de idioma do OWNews)', async () => {
  const src = readFileSync(new URL('../../ownews-instagram-publisher/worker.js', import.meta.url), 'utf8');
  const bloco = src.slice(src.indexOf('// <idioma-ptbr>'), src.indexOf('// </idioma-ptbr>'));
  const { idiomaTexto } = new Function(`${bloco}; return { idiomaTexto };`)();
  const { env, ctx } = await preparar();
  for (const r of ['', '/producao', '/futuro', '/exploracao', '/mapa', '/fontes', '/unidades/west-jupiter']) {
    const p = await (await pedir(env, ctx, r)).json();
    const texto = p.html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
    assert.notEqual(idiomaTexto(texto), 'en', r);
    assert.notEqual(idiomaTexto(p.titulo), 'en', r);
  }
});
teste('previsão marcada como previsão; análise marcada como análise', async () => {
  const { env, ctx } = await preparar();
  const p = await (await pedir(env, ctx, '/futuro')).json();
  assert.match(p.html, /Previsto — informado pelas operadoras à ANP\. Previsão não é fato realizado\./);
  assert.match(p.html, /Contexto OWNews — análise, não dado da ANP/);
  const e = await (await pedir(env, ctx, '/exploracao')).json();
  assert.match(e.html, /Realizado — dados da ANP/);
});

teste('indexação: só ficha com dado próprio entra no índice e no sitemap (AdSense, baixo valor)', async () => {
  const prod = { petroleo_bbl_d: 1000, gas_mil_m3_d: 10 };
  assert.equal(fichaIndexavel('unidade', { categoria: 'producao', producao: prod }), true);
  assert.equal(fichaIndexavel('unidade', { categoria: 'producao', producao: null }), false);
  assert.equal(fichaIndexavel('unidade', { categoria: 'sonda', producao: null }), false, 'sonda: só a lista /sondas');
  assert.equal(fichaIndexavel('campo', { producao: prod }), true);
  assert.equal(fichaIndexavel('campo', { producao: { petroleo_bbl_d: 0, gas_mil_m3_d: 0 } }), false);
  assert.equal(fichaIndexavel('operador', { id: 'op-1', producao: prod }, { operadores: { 'op-1': [{ titulo: 'x' }] } }), true);
  assert.equal(fichaIndexavel('operador', { id: 'op-1', producao: prod }, { operadores: {} }), false);
  const { env, ctx } = await preparar();
  const xml = await (await pedir(env, ctx, '/sitemap.xml')).text();
  const locs = [...xml.matchAll(/<loc>[^<]*\/(unidades|campos|operadores)\/([^<]+)<\/loc>/g)];
  for (const [, tipo, slug] of locs) {
    const p = await (await pedir(env, ctx, `/${tipo}/${slug}`)).json();
    assert.ok(!/noindex/.test(p.robots || ''), `no sitemap mas noindex: ${tipo}/${slug}`);
  }
});

let falhas = 0;
for (const [n, f] of testes) {
  try { await f(); console.log('ok   ' + n); } catch (e) { falhas++; console.log('FALHA ' + n + '\n      ' + String(e.message).split('\n').slice(0, 4).join('\n      ')); }
}
console.log(`\n${testes.length - falhas}/${testes.length} testes ok`);
process.exit(falhas ? 1 : 0);
