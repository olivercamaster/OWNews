// Critério editorial (Brasil primeiro, classe A/B/C/D), imagem válida ou fallback e alerta de mix
// — 03/11/2026. Testa o worker.js REAL. Uso: node --test tests/editorial_test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let W;
before(async () => {
  let src = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8').replace(/^const ([A-Z_0-9]+) = /gm, 'var $1 = ');
  src += '\nexport { noticiaRelevante, selecaoInternacional, classeEditorial, dimensoesImagem, avaliarImagem, validarImagemRemota, diagnosticarMix, calcularSaudeEditorial };\n';
  const f = path.join(os.tmpdir(), `editorial-worker-${process.pid}.mjs`);
  fs.writeFileSync(f, src);
  W = await import('file://' + f);
});

test('internacional: só entra com Brasil, trabalhador/acidente, grande evento ou empresa com presença no Brasil', () => {
  const sim = (t, m) => assert.deepEqual(W.selecaoInternacional(t), { publicar: true, motivo: m }, t);
  const nao = (t) => assert.equal(W.selecaoInternacional(t).publicar, false, t);
  sim('Petrobras hits paydirt for third time in ultra-deep Amapá waters', 'brasil');
  sim('SBM Offshore signed contracts for Petrobras’ FPSOs SEAP-I and SEAP-II', 'brasil');
  sim('Fatal rig incident: Search still underway for two missing workers off Gabon', 'trabalhador_ou_acidente');
  sim('DP crews are the new bottleneck: how OSV operators can staff vessels faster', 'trabalhador_ou_acidente');
  sim('North Sea gas discovery twice as big after appraisal success', 'grande_evento');
  sim('Noble rigs’ $560 million drilling gigs push fleet backlog to $6.7 billion', 'grande_evento');
  sim('Subsea7 wins EPCI contract for fast-track oil development off Norway', 'empresa_no_brasil');
  nao('Gas flows from Southeast Asian offshore field 21 months after FID');
  nao('DEME and Prysmian start cable installation for Dutch offshore grid connections');
  nao('MOL and Deutsche ReGas shake hands on FSRU for German LNG terminal');
  nao('SBM Offshore Half Year 2026 Earnings');
  nao('Chevron keeps ADES’ 2007-built jack-up rig busy in Angolan waters for another year');
});

test('nacional: Petrobras + E&P/operação é pauta; Petrobras sozinha não', () => {
  assert.equal(W.noticiaRelevante('Produção própria de O&G da Petrobras cresceu 11,7% em um ano'), true);
  assert.equal(W.noticiaRelevante('Vast realiza 3 operações simultâneas de transbordo para Petrobras pela primeira vez'), true);
  assert.equal(W.noticiaRelevante('Petrobras patrocina festival de cinema'), false);
});

test('classe: A fonte oficial BR, B imprensa BR ou internacional com Brasil, C internacional', () => {
  assert.equal(W.classeEditorial('ANP', 'Produção bate recorde'), 'A');
  assert.equal(W.classeEditorial('Petrobras', 'x'), 'A');
  assert.equal(W.classeEditorial('Eixos', 'x'), 'B');
  assert.equal(W.classeEditorial('Offshore Energy', 'Petrobras hits paydirt in Amapá'), 'B');
  assert.equal(W.classeEditorial('Offshore Energy', 'Fatal rig incident off Gabon'), 'C');
});

// Cabeçalhos mínimos reais de cada formato (sem decodificar a imagem inteira).
const png = (w, h) => { const b = new Uint8Array(32); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h); return b; };
const jpeg = (w, h) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...new Array(14).fill(0), 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0, 0, 0, 0, 0]);
const webpX = (w, h) => { const b = new Uint8Array(30); b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58]); const W1 = w - 1, H1 = h - 1; b.set([W1 & 255, (W1 >> 8) & 255, (W1 >> 16) & 255, H1 & 255, (H1 >> 8) & 255, (H1 >> 16) & 255], 24); return b; };
const gif = (w, h) => { const b = new Uint8Array(30); b.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, w & 255, w >> 8, h & 255, h >> 8]); return b; };

test('imagem: lê dimensões de JPEG, PNG, WebP e GIF; recusa logo, pixel, banner e não-foto', () => {
  assert.deepEqual(W.dimensoesImagem(jpeg(1200, 675)), { w: 1200, h: 675, tipo: 'jpeg' });
  assert.deepEqual(W.dimensoesImagem(png(800, 450)), { w: 800, h: 450, tipo: 'png' });
  assert.deepEqual(W.dimensoesImagem(webpX(1024, 576)), { w: 1024, h: 576, tipo: 'webp' });
  assert.deepEqual(W.dimensoesImagem(gif(1, 1)), { w: 1, h: 1, tipo: 'gif' });
  assert.equal(W.avaliarImagem('image/jpeg', jpeg(1200, 675)).ok, true);
  assert.equal(W.avaliarImagem('image/webp', webpX(1024, 576)).ok, true);
  assert.match(W.avaliarImagem('image/png', png(180, 60)).motivo, /^pequena/, 'logo');
  assert.match(W.avaliarImagem('image/gif', gif(1, 1)).motivo, /^pequena/, 'pixel de rastreamento');
  assert.match(W.avaliarImagem('image/jpeg', jpeg(1920, 300)).motivo, /^proporcao/, 'banner');
  assert.match(W.avaliarImagem('image/svg+xml', new Uint8Array(40)).motivo, /^nao_e_foto/);
  assert.match(W.avaliarImagem('text/html', new Uint8Array(40)).motivo, /^nao_e_foto/, 'página de erro no lugar da imagem');
  assert.equal(W.avaliarImagem('image/jpeg', new Uint8Array(40)).ok, false, 'arquivo corrompido');
  assert.equal(W.avaliarImagem(null, webpX(1024, 576)).ok, true, 'servidor sem content-type: decide pelos bytes');
  assert.equal(W.avaliarImagem('application/octet-stream', jpeg(1200, 675)).ok, true);
  const jpegGrande = new Uint8Array(30000); jpegGrande.set([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]);
  assert.equal(W.avaliarImagem('image/jpeg', jpegGrande).ok, true, 'JPEG com metadados > 64 KB');
  assert.equal(W.avaliarImagem(null, new Uint8Array(40)).ok, false, 'sem tipo e sem bytes de imagem');
});

test('imagem remota: 404 e erro de rede viram fallback; redirect para foto válida passa', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (u) => {
    if (/404/.test(u)) return new Response('x', { status: 404 });
    if (/rede/.test(u)) throw new Error('falha de rede');
    return new Response(jpeg(1200, 675), { status: 206, headers: { 'content-type': 'image/jpeg' } });
  };
  try {
    assert.deepEqual(await W.validarImagemRemota('https://x.test/404.jpg'), { ok: false, motivo: 'http_404' });
    assert.match((await W.validarImagemRemota('https://rede.test/a.jpg')).motivo, /^erro/);
    assert.equal((await W.validarImagemRemota('https://x.test/redir')).ok, true);
  } finally { globalThis.fetch = orig; }
});

const H = 3600e3;
const art = (h, fonte, title, img = 'https://x/a.jpg') => ({ buddy_source: 'ownews', created_at: new Date(Date.now() - h * H).toISOString(), published_at: new Date(Date.now() - h * H).toISOString(), image_credit: fonte, title, image_url: img });

test('mix: alerta quando quase tudo é internacional sem Brasil ou faltam matérias brasileiras', () => {
  const ruim = [1, 2, 3, 4, 5, 6, 7, 8].map((h) => art(h, 'Offshore Energy', 'Plataformas no Egito ' + h)).concat([art(30, 'ANP', 'Produção recorde')]);
  const d = W.diagnosticarMix(ruim, Date.now());
  assert.equal(d.estado, 'mix_editorial_degradado');
  assert.ok(d.motivos.some((m) => /internacionais sem ligação com o Brasil/.test(m)));
  assert.ok(d.motivos.some((m) => /30h sem matéria brasileira/.test(m)));
  const bom = [art(1, 'ANP', 'Produção recorde'), art(2, 'Eixos', 'Leilão'), art(3, 'Offshore Energy', 'Petrobras contrata FPSO para Búzios'), art(4, 'Offshore Energy', 'Acidente fatal no Gabão'), art(5, 'PPSA', 'Libra')];
  assert.equal(W.diagnosticarMix(bom, Date.now()).estado, 'ok');
  const semImg = [1, 2, 3, 4].map((h) => art(h, 'ANP', 'x' + h, null));
  assert.ok(W.diagnosticarMix(semImg, Date.now()).motivos.some((m) => /sem imagem própria/.test(m)));
  const s = W.calcularSaudeEditorial({ agora: Date.now(), artigos: ruim, gate: { '24h': {}, janelas: { '6h': {} } }, automacao: {} });
  assert.ok(s.motivos.some((m) => /MIX EDITORIAL DEGRADADO/.test(m)), 'aparece no /saude');
});

test('09/11 E) internacional de petróleo e gás offshore com ativo + ação entra; F) rotina (eólica, cabo, GNL) continua fora', () => {
  const sim = (t) => assert.equal(W.selecaoInternacional(t).publicar, true, t);
  const nao = (t) => assert.equal(W.selecaoInternacional(t).publicar, false, t);
  sim('Velesto’s 2010-built rig finds drilling job with Petronas');
  sim('Wison New Energies lays keel for Türkiye’s ultra-deepwater FPU');
  sim('Shell and Hornbeck Offshore seal multiple deals for deepwater services');
  sim('QatarEnergy buying 25% interest in Namibian offshore exploration license from Chevron');
  sim('Odfjell Drilling-managed rig lands multi-well North Sea job with UK oil & gas operator');
  nao('SSE secures grid connection consent for third phase of 4.1 GW offshore wind project');
  nao('Nexans to deliver 420 kilometers of cable for Greek interconnection');
  nao('TotalEnergies locks in LNG supply from ADNOC and offtake deal with Chinese firm');
  nao('10 MW tidal energy project gets EU seal for contribution to energy goals');
  nao('Excelerate and AxDo strike multi-year Bahamas LNG deal for Caribbean’s new terminal');
  assert.equal(W.selecaoInternacional('Workers strike at Norwegian platform over pay').publicar, true, 'greve de verdade continua entrando');
});
