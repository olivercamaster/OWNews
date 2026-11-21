// P0 de 21/11/2026 — fluxo de notícias estrangulado (2–4 publicações/dia contra ~10). Causas provadas e testadas aqui
// sobre o worker.js REAL: filtro internacional "quase só Brasil", veredito de escopo da IA oscilante virando reprovação
// definitiva, extrator que descartava corpo de parágrafo único, ANTAQ migrada para o gov.br Volto e watchdog sem visão
// de vazão em 7 dias. Uso: node --test tests/missao_2111_test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let W;
before(async () => {
  let src = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8').replace(/^const ([A-Z_0-9]+) = /gm, 'var $1 = ');
  src += '\nexport { selecaoInternacional, gerarCamadaEditorialIA, extrairConteudoMateria, extrairItensANTAQApi, conteudoGovBrVolto, calcularSaudeEditorial, SINAL_OFFSHORE_FORTE };\n';
  const f = path.join(os.tmpdir(), `m2111-worker-${process.pid}.mjs`);
  fs.writeFileSync(f, src);
  W = await import('file://' + f);
});

test('F) Brasil primeiro não é Brasil-only: FPSO, sonda, subsea, M&A e descomissionamento internacionais entram (títulos reais 16–20/11)', () => {
  for (const t of ['TechnipFMC scores double offshore Guyana', 'Subsea7 selected for deepwater tieback offshore US',
    'Seatrium on FPSO duty for ExxonMobil’s seventh oil project in Guyanese waters', 'FPSO revamp to begin next year as Navitas addresses contractor challenges',
    '$960 million deal enabling NEO NEXT+ to bring EnQuest’s UK North Sea business into its fold', 'Shell kicks off gas production from its deepwater project in Southeast Asia',
    'Azule Energy wraps up divestment of two Angolan offshore blocks', 'Boskalis Subsea Services joins one of UK’s largest offshore decommissioning programs',
    'Fugro completes ultra-deepwater survey offshore Angola']) assert.equal(W.selecaoInternacional(t).publicar, true, t);
  // não vira portal genérico de energia
  for (const t of ['Woodside and Trafigura sign off on decade-long LNG deal', 'NKT’s Karlskrona offshore cable factory expansion set to start operations in Q2 2027',
    'Aberdeen subsea robotics firm secures first offshore wind contract in Taiwan', 'CETO wave energy unit makes a splash at BiMEP',
    'Purus takes delivery of first methanol-ready Damen CSOV', 'Scotland-England Subsea Power Link Secures Marine License',
    'Energos puts Hanwha Power in charge of FSRU conversion with another on the cards', 'Fincantieri\'s WASS, Bharat Dynamics Partner on Underwater Defense Systems in India'])
    assert.equal(W.selecaoInternacional(t).publicar, false, t);
});

test('B) "nenhuma" da IA com sinal offshore explícito ganha 2ª redação (não morre como definitiva na 1ª oscilação)', async () => {
  let chamadas = 0;
  const env = { AI: { run: async () => { chamadas++; return { response: JSON.stringify({ relacao_offshore: 'nenhuma', titulo: 'x', buddy: 'x', corpo: ['x'], impacto: '' }) }; } } };
  const material = 'A Brava Energia concluiu a aquisição dos 65% restantes dos direitos de concessão dos campos Pescada, Arabaiana e Dentão, no Polo Pescada, a 31 km da costa do Rio Grande do Norte. '.repeat(3);
  const r = await W.gerarCamadaEditorialIA(env, { title: 'BRAVA ENERGIA CONCLUI AQUISIÇÃO E ASSUME 100% DO POLO PESCADA', summary: 'Brava assume Polo Pescada.' }, material, 1, {});
  assert.equal(chamadas, 2, 'pediu a 2ª redação');
  assert.deepEqual(r.motivos, ['fora_escopo'], 'duas vezes "nenhuma" continua fora de escopo (régua não muda)');
  chamadas = 0;
  await W.gerarCamadaEditorialIA(env, { title: 'Governo e aéreas contestam modelo da ANP para certificado de SAF', summary: 'SAF.' }, 'Companhias aéreas e o governo contestam a proposta da ANP para o certificado de combustível sustentável de aviação. '.repeat(4), 1, {});
  assert.equal(chamadas, 1, 'sem sinal offshore: 1 chamada, fora de escopo direto');
});

test('A) extrator: corpo num único parágrafo longo em <div class="entry"> (PetroNotícias/MODEC) não vira "sem_material"', () => {
  const corpo = 'A MODEC, em parceria com a Toray, desenvolveu uma solução de reparo estrutural permanente para sua frota de FPSOs com fibra de carbono. '.repeat(14);
  const html = `<html><body><div class="post"><div class="entry"><p style="text-align: justify;"><img src="x.jpg">${corpo}</p></div></div><footer><p>Você receberá um e-mail com um link para confirmar sua inscrição no informativo da casa.</p></footer></body></html>`;
  const t = W.extrairConteudoMateria(html);
  assert.ok(t.length > 1400 && t.startsWith('A MODEC'), t.slice(0, 80));
  // HTML inteiro sem contêiner: o teto anti-JS de 1.400 por parágrafo continua valendo
  assert.equal(W.extrairConteudoMateria(`<html><body><p>${'x'.repeat(2000)}</p></body></html>`), '');
});

test('A) ANTAQ (gov.br Volto): lista vem da API do portal e o corpo dos blocos html', async () => {
  const lista = JSON.stringify({ items: [
    { '@id': 'https://www.gov.br/antaq/pt-br/central-de-conteudos/noticias/antaq-abre-consulta-publica-sobre-afretamento-no-apoio-maritimo', title: 'ANTAQ abre consulta pública sobre regras de afretamento de embarcações no apoio marítimo', effective: '2026-11-11T13:00:00+00:00' },
    { '@id': 'https://outro.site/x', title: 'fora do domínio' }] });
  const itens = W.extrairItensANTAQApi(lista);
  assert.equal(itens.length, 1); assert.equal(itens[0].source, 'ANTAQ'); assert.ok(itens[0].publishedAt);
  assert.deepEqual(W.extrairItensANTAQApi('<!doctype html>'), []);
  const orig = globalThis.fetch; let pedida = '';
  globalThis.fetch = async (u) => { pedida = String(u); return new Response(JSON.stringify({ blocks_layout: { items: ['a', 'b', 'c'] }, blocks: {
    a: { '@type': 'html', html: '<p>' + 'Está aberto o período de contribuições da Audiência Pública sobre afretamento de embarcações no apoio marítimo e na cabotagem. '.repeat(4) + '</p>' },
    b: { '@type': 'title' }, c: { '@type': 'html', html: '<p>Assessoria de Comunicação e Cerimonial — Canais de atendimento da agência reguladora federal</p>' } } }), { status: 200 }); };
  try {
    const t = await W.conteudoGovBrVolto('https://www.gov.br/antaq/pt-br/central-de-conteudos/noticias/x');
    assert.match(pedida, /^https:\/\/www\.gov\.br\/antaq\/\+\+api\+\+\/pt-br\//);
    assert.ok(t && t.length >= 300 && !/Assessoria/.test(t));
    assert.equal(await W.conteudoGovBrVolto('https://petronoticias.com.br/x'), null, 'só gov.br');
  } finally { globalThis.fetch = orig; }
});

test('watchdog: vazão baixa em 7 dias com pauta chegando → POSSÍVEL ESTRANGULAMENTO, mesmo publicando 2/dia', () => {
  const agora = Date.parse('2026-11-21T19:00:00Z');
  const art = [{ buddy_source: 'ownews', published_at: new Date(agora - 8 * 3600e3).toISOString(), created_at: new Date(agora - 8 * 3600e3).toISOString(), image_credit: 'Eixos', title: 'x' }];
  const g7 = { execucoes: 354, publicadas: 14, ia_avaliadas: 124, taxa_aprovacao_ia: 11, internacional_rotina: 479 };
  const s = W.calcularSaudeEditorial({ agora, artigos: art, gate: { '24h': {}, '7d': g7, janelas: { '6h': {} } }, automacao: {} });
  assert.equal(s.status, 'VERMELHO'); assert.match(s.motivos.join(' '), /ESTRANGULAMENTO EDITORIAL \(7 dias\): 14 publicadas/);
  // vazão normal (≥ 3/dia) não alarma
  const ok = W.calcularSaudeEditorial({ agora, artigos: art, gate: { '24h': {}, '7d': Object.assign({}, g7, { publicadas: 40 }), janelas: { '6h': {} } }, automacao: {} });
  assert.ok(!/ESTRANGULAMENTO/.test(ok.motivos.join(' ')));
  // pouco histórico (deploy recente) não alarma
  const novo = W.calcularSaudeEditorial({ agora, artigos: art, gate: { '24h': {}, '7d': Object.assign({}, g7, { execucoes: 30 }), janelas: { '6h': {} } }, automacao: {} });
  assert.ok(!/ESTRANGULAMENTO/.test(novo.motivos.join(' ')));
});
