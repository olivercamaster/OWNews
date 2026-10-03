#!/usr/bin/env node
/* OWNews — Regression tests for condensarHeadlineSocial + avaliarQualidadeEditorialImagem
   Functions re-declared here (pure JS, no CF Worker APIs) — must stay in sync with worker.js */

// ── condensarHeadlineSocial ───────────────────────────────────────────────────
const ATRIBUICAO_DECLARACAO_RE = /^(?:Presidente[a]?|Diretora?|CEO|Ministra?|Secretári[ao]|Chefe)\s+(?:da|do|de|dos|das)\s+([A-ZÁÉÍÓÚÂÊÎÔÛÀÈÌÒÙÃÕÇ]\S+(?:\s+[A-ZÁÉÍÓÚÂÊÎÔÛÀÈÌÒÙÃÕÇ]\S+){0,2})\s+(?:diz|afirma|confirma|declara|revela|destaca|ressalta)\s+que\s+(.+)$/;
function condensarHeadlineSocial(titulo) {
  if (!titulo || typeof titulo !== 'string') return titulo;
  const m = ATRIBUICAO_DECLARACAO_RE.exec(titulo);
  if (m) {
    const entidade = m[1];
    const corpo = m[2].charAt(0).toUpperCase() + m[2].slice(1);
    const candidata = `${entidade}: ${corpo}`;
    if (candidata.length < titulo.length - 8) return candidata;
  }
  return titulo;
}

// ── avaliarQualidadeEditorialImagem ───────────────────────────────────────────
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
      return { ok: false, detalhe: `EDITORIAL_IMAGE_REJECTED_SCREENSHOT — filename indica screenshot/captura: ${filename}` };
    }
  }
  return { ok: true };
}

// ── test harness ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function check(label, fn) {
  try {
    const r = fn();
    if (r.ok) { console.log(`  ✓ ${label}: ${r.msg}`); passed++; }
    else { console.log(`  ✗ FAIL ${label}: ${r.msg}`); failed++; }
  } catch (e) { console.log(`  ✗ ERRO ${label}: ${e.message}`); failed++; }
}

// ── CONDENSAÇÃO ───────────────────────────────────────────────────────────────
console.log('\n=== CONDENSAÇÃO DE HEADLINE ===');

check('Morpho — declaração presidencial (deve condensar)',
  () => {
    const input = 'Presidente da Petrobrás diz que resultados do poço Morpho aumentam o valor do Amapá e indicam a abertura de uma nova fronteira';
    const out = condensarHeadlineSocial(input);
    const ok = out.startsWith('Petrobrás:') && out.length < input.length - 8;
    return { ok, msg: `"${out}"` };
  });

check('Diretora da ANP afirma que (deve condensar)',
  () => {
    const input = 'Diretora da ANP afirma que licitação de blocos offshore será aberta no segundo semestre de 2026';
    const out = condensarHeadlineSocial(input);
    const ok = out.startsWith('ANP:') && out.length < input.length - 8;
    return { ok, msg: `"${out}"` };
  });

check('CEO da Shell confirma que (deve condensar)',
  () => {
    const input = 'CEO da Shell confirma que empresa ampliará investimentos no pré-sal brasileiro nos próximos cinco anos';
    const out = condensarHeadlineSocial(input);
    const ok = out.startsWith('Shell:') && out.length < input.length - 8;
    return { ok, msg: `"${out}"` };
  });

check('Petrobras factual — NÃO deve condensar',
  () => {
    const input = 'Petrobras anuncia nova descoberta no pré-sal de Búzios';
    const out = condensarHeadlineSocial(input);
    return { ok: out === input, msg: out === input ? 'inalterado ✓' : `alterado indevidamente: "${out}"` };
  });

check('FPSO factual — NÃO deve condensar',
  () => {
    const input = 'FPSO Almirante Barroso inicia operações no Campo de Búzios com produção de 150 mil barris por dia';
    const out = condensarHeadlineSocial(input);
    return { ok: out === input, msg: out === input ? 'inalterado ✓' : `alterado indevidamente: "${out}"` };
  });

check('Contrato factual — NÃO deve condensar',
  () => {
    const input = 'Petrobras contrata Saipem para serviços de SURF no Campo de Mero pelo prazo de cinco anos';
    const out = condensarHeadlineSocial(input);
    return { ok: out === input, msg: out === input ? 'inalterado ✓' : `alterado: "${out}"` };
  });

check('Descoberta factual — NÃO deve condensar',
  () => {
    const input = 'ANP confirma descoberta de hidrocarbonetos no Bloco FZA-M-59 na Margem Equatorial do Amapá';
    const out = condensarHeadlineSocial(input);
    return { ok: out === input, msg: out === input ? 'inalterado ✓' : `alterado: "${out}"` };
  });

check('Acidente — NÃO deve condensar (preservar fato)',
  () => {
    const input = 'Vazamento de óleo detectado próximo ao FPSO Cidade de Paraty na Bacia de Santos';
    const out = condensarHeadlineSocial(input);
    return { ok: out === input, msg: out === input ? 'inalterado ✓' : `alterado: "${out}"` };
  });

check('Título curto — NÃO deve condensar',
  () => {
    const input = 'ANP lança licitação de blocos offshore';
    const out = condensarHeadlineSocial(input);
    return { ok: out === input, msg: out === input ? 'inalterado ✓' : `alterado: "${out}"` };
  });

check('Com percentual — NÃO deve condensar',
  () => {
    const input = 'Produção offshore cresce 12,4% no terceiro trimestre e bate recorde histórico';
    const out = condensarHeadlineSocial(input);
    return { ok: out === input, msg: out === input ? 'inalterado ✓' : `alterado: "${out}"` };
  });

check('Título com siglas — NÃO deve condensar',
  () => {
    const input = 'PPSA e ANP publicam resultado do 17º Rodada de Licitações da Cessão Onerosa';
    const out = condensarHeadlineSocial(input);
    return { ok: out === input, msg: out === input ? 'inalterado ✓' : `alterado: "${out}"` };
  });

check('Condensação preserva atribuição via ":"',
  () => {
    const input = 'Presidente da Equinor diz que empresa avalia expansão de portfólio no Brasil para além do campo de Bacalhau';
    const out = condensarHeadlineSocial(input);
    const ok = out.includes('Equinor:') && !out.startsWith('empresa avalia');
    return { ok, msg: `"${out.slice(0, 80)}..."` };
  });

// ── IMAGE EDITORIAL GUARD ─────────────────────────────────────────────────────
console.log('\n=== IMAGE EDITORIAL GUARD ===');

check('Screenshot MIUI full-res — deve rejeitar',
  () => {
    const url = 'https://petronoticias.com.br/wp-content/uploads/2026/10/Screenshot_2026-10-02-15-53-12-342_com.miui_.notes_-e1790968120609.jpg';
    const r = avaliarQualidadeEditorialImagem(url);
    return { ok: !r.ok && r.detalhe.includes('EDITORIAL_IMAGE_REJECTED_SCREENSHOT'), msg: r.detalhe || 'ok' };
  });

check('Screenshot MIUI thumbnail WP — deve rejeitar',
  () => {
    const url = 'https://petronoticias.com.br/wp-content/uploads/2026/10/Screenshot_2026-10-02-15-53-12-342_com.miui_.notes_-e1790968120609-300x242.jpg';
    const r = avaliarQualidadeEditorialImagem(url);
    return { ok: !r.ok && r.detalhe.includes('EDITORIAL_IMAGE_REJECTED_SCREENSHOT'), msg: r.detalhe || 'ok' };
  });

check('Screenshot genérico — deve rejeitar',
  () => {
    const url = 'https://example.com/wp-content/uploads/Screenshot_20260101_120000.jpg';
    const r = avaliarQualidadeEditorialImagem(url);
    return { ok: !r.ok, msg: r.detalhe || 'ok (passou incorretamente)' };
  });

check('WhatsApp IMG-WA — deve rejeitar',
  () => {
    const url = 'https://example.com/IMG-20231010-WA0001.jpg';
    const r = avaliarQualidadeEditorialImagem(url);
    return { ok: !r.ok, msg: r.detalhe || 'ok (passou incorretamente)' };
  });

check('Captura de tela — deve rejeitar',
  () => {
    const url = 'https://petronoticias.com.br/wp-content/uploads/captura_de_tela_reuniao.jpg';
    const r = avaliarQualidadeEditorialImagem(url);
    return { ok: !r.ok, msg: r.detalhe || 'ok (passou incorretamente)' };
  });

check('Offshore Energy — deve aceitar',
  () => {
    const url = 'https://offshore-energy.biz/api/media/file/wp-import-1784750039008-1600x1200.jpg';
    const r = avaliarQualidadeEditorialImagem(url);
    return { ok: r.ok, msg: r.ok ? 'aceito ✓' : `rejeitado indevidamente: ${r.detalhe}` };
  });

check('Petrobras FPSO foto editorial — deve aceitar',
  () => {
    const url = 'https://agencia.petrobras.com.br/imagens/fpso-almirante-barroso-1920.jpg';
    const r = avaliarQualidadeEditorialImagem(url);
    return { ok: r.ok, msg: r.ok ? 'aceito ✓' : `rejeitado indevidamente: ${r.detalhe}` };
  });

check('IMG_1234 genérico sem outro sinal — deve aceitar (conservador)',
  () => {
    const url = 'https://agencia.petrobras.com.br/upload/IMG_1234.jpg';
    const r = avaliarQualidadeEditorialImagem(url);
    return { ok: r.ok, msg: r.ok ? 'aceito ✓' : `rejeitado indevidamente: ${r.detalhe}` };
  });

check('PetroNotícias WP thumbnail saudável — deve aceitar',
  () => {
    const url = 'https://petronoticias.com.br/wp-content/uploads/2026/10/fpso-campo-buzios-300x200.jpg';
    const r = avaliarQualidadeEditorialImagem(url);
    return { ok: r.ok, msg: r.ok ? 'aceito ✓' : `rejeitado indevidamente: ${r.detalhe}` };
  });

check('EBC foto editorial — deve aceitar',
  () => {
    const url = 'https://ebc.com.br/imagens/2026/09/refinaria-petrobras-abreu-lima.jpg';
    const r = avaliarQualidadeEditorialImagem(url);
    return { ok: r.ok, msg: r.ok ? 'aceito ✓' : `rejeitado indevidamente: ${r.detalhe}` };
  });

// ── SUMMARY ───────────────────────────────────────────────────────────────────
console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
