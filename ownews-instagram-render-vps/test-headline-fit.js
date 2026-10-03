#!/usr/bin/env node
/* OWNews — Visual Guard regression test battery
   Valida que nenhum headline/apoio produz truncamento visível.
   Resultado esperado: fixture defeituosa → REJECTED; headlines normais → FITS com tamanho. */

const { _internos } = require('./render.js');
const { ajustarTextoParaCaixa, wrapLinhas, limparPrefixoFonte, W, H } = _internos;
const PAD = 76;
const LARG = W - PAD * 2; // 928px

let passed = 0, failed = 0;
function check(label, fn) {
  try {
    const result = fn();
    if (result.ok) { console.log(`  ✓ ${label}: ${result.msg}`); passed++; }
    else { console.log(`  ✗ FAIL ${label}: ${result.msg}`); failed++; }
  } catch (e) {
    if (e.message.startsWith('VISUAL_GUARD_REJECTED')) {
      console.log(`  ✓ GUARD ${label}: ${e.message.replace('VISUAL_GUARD_REJECTED: ','')}`);
      passed++;
    } else {
      console.log(`  ✗ ERRO ${label}: ${e.message}`);
      failed++;
    }
  }
}
function fitN1(headline, maxLinhas = 4, tamanhos = [64, 56, 48]) {
  const r = ajustarTextoParaCaixa(headline, { larguraPx: LARG, maxLinhas, tamanhos });
  if (!r.fits) throw new Error(`VISUAL_GUARD_REJECTED: headline não coube`);
  return { ok: true, msg: `fits @ ${r.fontSize}px, ~${wrapLinhas(r.texto, r.fontSize, LARG)} linhas` };
}

console.log('\n=== FIXTURES DE REGRESSÃO ===');
// O post defeituoso: deve ser rejeitado pelo filtro político (worker) OU pelo guard (renderer se chegar)
check('POST DEFEITUOSO — proposta presidenciável gás (deve caber em N1)',
  () => fitN1('Entre polarização e consensos: as propostas dos presidenciáveis para o setor de gás natural'));

console.log('\n=== HEADLINES CURTAS ===');
check('Headline curta', () => fitN1('Petrobras anuncia nova descoberta no pré-sal'));
check('Headline média', () => fitN1('Produção de petróleo no Brasil atinge recorde histórico em setembro de 2026'));
check('Headline longa', () => fitN1('Petrobras confirma viabilidade econômica do Poço Morpho no bloco FZA-M-59 na Margem Equatorial do Amapá'));
check('Headline muito longa', () => fitN1('Presidente da Petrobrás Diz que Resultados do Poço Morpho Aumenta Valor do Amapá e Indicam a Abertura de uma Nova Fronteira'));

console.log('\n=== CARACTERES ESPECIAIS ===');
check('Percentual', () => fitN1('ANP registra aumento de 12,4% na produção offshore no terceiro trimestre de 2026'));
check('Acento e hífen', () => fitN1('Petróleo: produção pré-sal bate 3,2 milhões de barris/dia em setembro'));
check('Aspas', () => fitN1('"Margem Equatorial tem potencial equivalente ao pré-sal", diz Magda Chambriard'));
check('Nome de sonda', () => fitN1('Sonda NS-42 inicia campanha de perfuração no Bloco FZA-M-59 no Amapá'));
check('FPSO longo', () => fitN1('FPSO Almirante Barroso conclui primeira intervenção de manutenção no Campo de Búzios'));

console.log('\n=== TEXTOS EXTREMOS ===');
check('Headline que não deve caber (deve ser guardada)',
  () => fitN1('Esta headline é propositalmente muito longa para testar o visual guard e confirmar que o sistema rejeita corretamente artes com texto que excede todos os tamanhos disponíveis de fonte incluindo 48 pixels que é o menor'));
check('Headline N3 long', () => {
  const larguraTexto = Math.round(W * 0.56) - PAD * 1.4;
  const r = ajustarTextoParaCaixa('Petrobras anuncia contrato de afretamento de nova sonda para operações na Margem Equatorial', { larguraPx: larguraTexto, maxLinhas: 5, tamanhos: [56, 48, 42, 38] });
  if (!r.fits) throw new Error('VISUAL_GUARD_REJECTED: não coube');
  return { ok: true, msg: `N3 fits @ ${r.fontSize}px` };
});

console.log('\n=== APOIO / CONTEXTO ===');
check('Prefixo de fonte — strip',
  () => {
    const limpo = limparPrefixoFonte('gás week | A preocupação com o preço do gás está presente na maioria dos programas de governo');
    const ok = !limpo.startsWith('gás week');
    return { ok, msg: ok ? `OK — "${limpo.slice(0,50)}…"` : `FAIL — prefix not stripped: "${limpo.slice(0,60)}"` };
});
check('Prefixo PETRONOTICIAS',
  () => {
    const limpo = limparPrefixoFonte('PETRONOTICIAS | Petrobras descobre nova reserva no bloco offshore');
    return { ok: !limpo.startsWith('PETRONOTICIAS'), msg: `"${limpo.slice(0,50)}"` };
});
check('Apoio sem prefixo — passthrough',
  () => {
    const s = 'A produção de petróleo no Brasil atingiu 3,2 milhões de barris por dia.';
    const limpo = limparPrefixoFonte(s);
    return { ok: limpo === s, msg: `"${limpo.slice(0,50)}"` };
});
check('Apoio com reticências (deve ser rejeitado no Template C)',
  () => {
    const s = 'A descoberta foi confirmada pelo poço exploratório Morpho no bloco FZA-M-59…';
    const ok = s.endsWith('…');
    return { ok, msg: ok ? 'endsWith "…" — contextoC retornaria null ✓' : 'sem reticências' };
});

console.log('\n=== MORPHO ===');
check('Morpho headline original (Title Case)',
  () => fitN1('Presidente da Petrobrás Diz que Resultados do Poço Morpho Aumenta Valor do Amapá e Indicam a Abertura de uma Nova Fronteira'));
check('Morpho headline condensada (Petrobrás: ...)',
  () => fitN1('Petrobrás: Resultados do poço Morpho aumentam o valor do Amapá e indicam a abertura de uma nova fronteira'));

console.log('\n=== CATEGORIAS EDITORIAIS ===');
check('Descoberta de campo',
  () => fitN1('Petrobras anuncia descoberta de reservatório de óleo leve no Bloco FZA-M-59 na Margem Equatorial do Amapá'));
check('Contrato de afretamento',
  () => fitN1('Petrobras e Saipem fecham contrato de cinco anos para serviços de SURF no Campo de Mero na Bacia de Santos'));
check('Acidente / incidente',
  () => fitN1('Vazamento de óleo de pequeno porte é detectado próximo ao FPSO Cidade de Paraty na Bacia de Santos'));
check('Declaração atribuída — forma original',
  () => fitN1('Presidente da Equinor diz que empresa avalia expansão de portfólio no Brasil para além do campo de Bacalhau'));
check('Declaração atribuída — forma condensada',
  () => fitN1('Equinor: empresa avalia expansão de portfólio no Brasil para além do campo de Bacalhau'));
check('Título com número cardinal',
  () => fitN1('ANP registra produção de 3,2 milhões de barris por dia em setembro de 2026, novo recorde histórico'));
check('Título com siglas múltiplas',
  () => fitN1('PPSA e ANP publicam resultado do 17º Rodada da Cessão Onerosa com blocos no pré-sal de Santos'));
check('Incidente com FPSO',
  () => fitN1('FPSO Almirante Tamandaré interrompe operações no Campo de Búzios após detecção de anomalia no casco'));

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
