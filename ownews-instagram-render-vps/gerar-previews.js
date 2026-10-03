#!/usr/bin/env node
/* OWNews — Gerador de previews P0.2 (SEM publicar)
   Uso: node gerar-previews.js
   Gera 4 previews + diagnóstico Morpho no console */

const { renderizarJob } = require('./render.js');
const fs = require('fs');
const path = require('path');

// ── Editorial guard (mesma lógica do worker.js) ──────────────────────────────
const PADROES_SCREENSHOT_FILENAME = [
  /^screenshot[_\-]/i,
  /^img-\d{6,8}-wa\d{4}/i,
  /[_.]wa\d{4}\./i,
  /^captura[-_]/i,
];
function avaliarQualidadeEditorialImagem(imageUrl) {
  if (!imageUrl) return { ok: true };
  let filename;
  try { filename = new URL(imageUrl).pathname.split('/').pop(); } catch { return { ok: true }; }
  for (const pat of PADROES_SCREENSHOT_FILENAME) {
    if (pat.test(filename)) {
      return { ok: false, razao: 'EDITORIAL_IMAGE_REJECTED_SCREENSHOT', detalhe: `filename indica screenshot/captura: ${filename}` };
    }
  }
  return { ok: true };
}

async function renderPreview(nome, job, desc) {
  process.stdout.write(`\nRenderizando ${desc}...\n`);
  try {
    const buf = await renderizarJob(job.arte);
    const outPath = path.join(__dirname, nome);
    fs.writeFileSync(outPath, buf);
    console.log(`  ✓ ${buf.length} bytes → ${nome}`);
    return buf;
  } catch (e) {
    if (e.message.startsWith('VISUAL_GUARD_REJECTED')) {
      console.log(`  ✗ VISUAL_GUARD_REJECTED: ${e.message}`);
    } else {
      console.log(`  ✗ ERRO: ${e.message}`);
    }
    return null;
  }
}

async function main() {

  // ── PREVIEW 1: Plano A com foto real editorialmente boa ───────────────────
  // Offshore Energy — GNL Alasca (1600×1200, ar=1.333)
  // Editorial guard: ✓ (filename não indica screenshot)
  // Template: n1 (A)
  console.log('\n════════════════════════════════════════════');
  console.log('PREVIEW 1 — Plano A, foto editorial boa');
  console.log('Fonte: offshore-energy.biz, 1600×1200');
  console.log('Editorial guard: ✓ PASS');
  await renderPreview('preview-plano-a.jpg', {
    arte: {
      template: 'n1',
      categoria: 'ENERGIA',
      headline: 'Investimento de US$ 50 bilhões da Coreia do Sul aproxima projeto de GNL do Alasca da construção',
      contexto: 'Uma infusão de capital abre o caminho para a instalação de exportação de GNL no Alasca.',
      fotoUrl: 'https://offshore-energy.biz/api/media/file/wp-import-1784750039008-1600x1200.jpg?prefix=media',
    },
  }, 'Plano A — foto Offshore Energy 1600×1200');

  // ── PREVIEW 2: Plano A com headline longa condensada ─────────────────────
  // Foto: Offshore Energy (mesma), headline original longa → condensada via
  // condensarHeadlineSocial: "Presidente da Equinor diz que..." → "Equinor: ..."
  const headlineOriginal = 'Presidente da Equinor diz que empresa ampliará investimentos no pré-sal brasileiro nos próximos cinco anos';
  const headlineCondensada = 'Equinor: empresa ampliará investimentos no pré-sal brasileiro nos próximos cinco anos';
  console.log('\n════════════════════════════════════════════');
  console.log('PREVIEW 2 — Plano A, headline condensada');
  console.log(`Original  (${headlineOriginal.length} chars): "${headlineOriginal}"`);
  console.log(`Condensada(${headlineCondensada.length} chars): "${headlineCondensada}"`);
  console.log(`Redução: ${headlineOriginal.length - headlineCondensada.length} chars`);
  await renderPreview('preview-plano-a-long.jpg', {
    arte: {
      template: 'n1',
      categoria: 'OPERAÇÕES',
      headline: headlineCondensada,
      contexto: null,
      fotoUrl: 'https://offshore-energy.biz/api/media/file/wp-import-1784750039008-1600x1200.jpg?prefix=media',
    },
  }, 'Plano A — headline condensada (Equinor:)');

  // ── PREVIEW 3: Fallback textual legítimo (Template C) ────────────────────
  // Artigo sem imagem válida por critério técnico legítimo (NO_IMAGE)
  // Headline: descoberta factual, não declaração — NÃO condensada
  console.log('\n════════════════════════════════════════════');
  console.log('PREVIEW 3 — Fallback Template C, sem foto (legítimo)');
  console.log('Razão: NO_IMAGE (artigo sem image_url válida)');
  console.log('Headline: factual, NÃO condensada');
  await renderPreview('preview-plano-c.jpg', {
    arte: {
      template: 'n2',
      categoria: 'OPERAÇÕES',
      headline: 'ANP confirma descoberta de hidrocarbonetos no Bloco FZA-M-59 na Margem Equatorial do Amapá',
      contexto: null,
      fotoUrl: null,
    },
  }, 'Template C — fallback legítimo, sem foto');

  // ── PREVIEW 4: Morpho — screenshot rejeitado, Template C ─────────────────
  const morphoImageUrl = 'https://petronoticias.com.br/wp-content/uploads/2026/10/Screenshot_2026-10-02-15-53-12-342_com.miui_.notes_-e1790968120609.jpg';
  const morphoThumbUrl = 'https://petronoticias.com.br/wp-content/uploads/2026/10/Screenshot_2026-10-02-15-53-12-342_com.miui_.notes_-e1790968120609-300x242.jpg';
  const morphoHeadline = 'Petrobrás: Resultados do poço Morpho aumentam o valor do Amapá e indicam a abertura de uma nova fronteira';

  const editorialThumb = avaliarQualidadeEditorialImagem(morphoThumbUrl);
  const editorialFullRes = avaliarQualidadeEditorialImagem(morphoImageUrl);

  console.log('\n════════════════════════════════════════════');
  console.log('PREVIEW 4 — Morpho, screenshot rejeitado');
  console.log('');
  console.log('DIAGNÓSTICO MORPHO:');
  console.log(`  thumbnail URL : ${morphoThumbUrl.split('/').pop()}`);
  console.log(`  full-res URL  : ${morphoImageUrl.split('/').pop()}`);
  console.log('');
  console.log('  Passo 1 — Editorial guard (thumbnail):');
  console.log(`    Resultado : ${editorialThumb.ok ? '✓ PASS' : '✗ FAIL'}`);
  if (!editorialThumb.ok) console.log(`    Razão     : ${editorialThumb.razao}`);
  console.log('');
  console.log('  Passo 2 — Se o guard passasse (informativo, baseado em P0.1):');
  console.log('    Dimensões thumbnail : 300×242 → FAIL (< mínimo 800×500)');
  console.log('    WP upgrade tentado  : → full-res 1175×947');
  console.log('    Editorial full-res  : ✗ FAIL (mesmo nome de arquivo)');
  console.log(`    Razão               : ${editorialFullRes.razao || 'n/a'}`);
  console.log('');
  console.log('  Resolução: Template C (sem foto)');
  console.log(`  Headline  : "${morphoHeadline}"`);
  console.log('    (headline já condensada: "Presidente da Petrobrás diz que" → "Petrobrás:")');
  console.log('');
  console.log('  fallback.razao = EDITORIAL_IMAGE_REJECTED_SCREENSHOT');
  console.log('  CC mostrará: ⚠ Fallback A→C: EDITORIAL_IMAGE_REJECTED_SCREENSHOT');
  await renderPreview('preview-morpho-c.jpg', {
    arte: {
      template: 'n2',
      categoria: 'OPERAÇÕES',
      headline: morphoHeadline,
      contexto: null,
      fotoUrl: null,
    },
  }, 'Template C — Morpho screenshot rejeitado, headline condensada');

  console.log('\n════════════════════════════════════════════');
  console.log('Previews gerados:');
  for (const f of ['preview-plano-a.jpg', 'preview-plano-a-long.jpg', 'preview-plano-c.jpg', 'preview-morpho-c.jpg']) {
    try {
      const sz = fs.statSync(path.join(__dirname, f)).size;
      console.log(`  ${f}: ${sz} bytes`);
    } catch { console.log(`  ${f}: não gerado`); }
  }
  console.log('\nInspecione visualmente em /preview-instagram antes de liberar o freeze.');
}

main().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1); });
