#!/usr/bin/env node
/* OWNews — gerador de previews A/B para inspeção visual (SEM publicar)
   Uso: node gerar-previews.js
   Gera: preview-plano-a.jpg, preview-plano-b.jpg no mesmo diretório */

const { renderizarJob } = require('./render.js');
const fs = require('fs');
const path = require('path');

async function main() {
  // ── PLANO A: Template n1 com foto real ──────────────────────────────────
  // Artigo: Offshore Energy — Korea do Sul / GNL Alasca (1600×1200, ar=1.333)
  const jobA = {
    tipo: 'noticia',
    arte: {
      template: 'n1',
      categoria: 'ENERGIA',
      headline: 'Investimento de US$ 50 bilhões da Coreia do Sul aproxima projeto de GNL do Alasca da construção',
      contexto: 'Uma infusão de capital abre o caminho para a instalação de exportação de GNL no Alasca.',
      fotoUrl: 'https://offshore-energy.biz/api/media/file/wp-import-1784750039008-1600x1200.jpg?prefix=media',
    },
  };

  // ── PLANO A com foto Morpho (WP upgrade: 300×242 → 1175×947) ────────────
  // Demonstra o comportamento do upgrade de thumbnail WP
  const jobAMorpho = {
    tipo: 'noticia',
    arte: {
      template: 'n1',
      categoria: 'OPERAÇÕES',
      headline: 'Presidente da Petrobrás diz que resultados do poço Morpho aumentam o valor do Amapá',
      contexto: null,
      fotoUrl: 'https://petronoticias.com.br/wp-content/uploads/2026/10/Screenshot_2026-10-02-15-53-12-342_com.miui_.notes_-e1790968120609.jpg',
    },
  };

  // ── PLANO B (Template C): Artigo sem foto ────────────────────────────────
  // Headline normalizada em sentence case (sem Title Case)
  const jobB = {
    tipo: 'noticia',
    arte: {
      template: 'n2',
      categoria: 'OPERAÇÕES',
      headline: 'Presidente da Petrobrás diz que resultados do poço Morpho aumentam o valor do Amapá e indicam a abertura de uma nova fronteira',
      contexto: null,
      fotoUrl: null,
    },
  };

  const casos = [
    { nome: 'preview-plano-a.jpg', job: jobA, desc: 'Plano A — foto Offshore Energy 1600×1200' },
    { nome: 'preview-plano-a-morpho.jpg', job: jobAMorpho, desc: 'Plano A — foto Morpho full-res 1175×947 (screenshot WP upgrade)' },
    { nome: 'preview-plano-b.jpg', job: jobB, desc: 'Plano B (Template C) — sem foto, headline normalizada' },
  ];

  for (const { nome, job, desc } of casos) {
    process.stdout.write(`Renderizando ${desc}... `);
    try {
      const buf = await renderizarJob(job.arte);
      const outPath = path.join(__dirname, nome);
      fs.writeFileSync(outPath, buf);
      console.log(`✓ ${buf.length} bytes → ${nome}`);
    } catch (e) {
      if (e.message.startsWith('VISUAL_GUARD_REJECTED')) {
        console.log(`✗ VISUAL_GUARD_REJECTED: ${e.message}`);
      } else {
        console.log(`✗ ERRO: ${e.message}`);
      }
    }
  }

  console.log('\nPreviews gerados. Inspecione os arquivos JPEG antes de aprovar o deploy.');
}

main().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1); });
