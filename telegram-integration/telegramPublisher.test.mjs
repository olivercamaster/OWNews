/* =========================================================================
   Testes do módulo telegramPublisher — SEM TOKEN, SEM CHAMADA REAL.
   Roda com: node telegram-integration/telegramPublisher.test.mjs

   Reescrito em 2026-09-16 junto com o módulo (score editorial, categorias,
   frequência/anti-spam, tolerância a falhas). Cobre exatamente os casos
   pedidos: notícia excelente/mediana/burocrática, duplicata, sem imagem,
   imagem quebrada, resumo genérico/real, caracteres especiais no HTML,
   falha de API, rate limit, reinício do Worker, execuções simultâneas,
   limite diário, intervalo mínimo, prioridade alta furando intervalo, URL
   inválida. Nenhuma chamada de rede real ao Telegram — `global.fetch` é
   substituído por um mock em todo teste que envolve I/O.
========================================================================= */
import assert from 'node:assert/strict';
import {
  detectarCategoria,
  avaliarElegibilidade,
  verificarDuplicidade,
  formatarPost,
  escaparHtmlTelegram,
  prepararEnvio,
  publicar,
  verificarUrlOwnews,
  computarEstadoEnvios,
  avaliarJanelaDeEnvio,
  selecionarParaPublicarAgora,
  processarArtigosParaTelegram,
  ehResumoGenerico,
  extrairResumoFactual,
  obterResumoSeguro,
  imagemEditorialValida
} from './telegramPublisher.js';

let passou = 0, falhou = 0;
function teste(nome, fn) {
  try {
    fn();
    console.log('  OK  ' + nome);
    passou++;
  } catch (e) {
    console.log('FALHA ' + nome + ' -> ' + e.message);
    falhou++;
  }
}
async function testeAsync(nome, fn) {
  try {
    await fn();
    console.log('  OK  ' + nome);
    passou++;
  } catch (e) {
    console.log('FALHA ' + nome + ' -> ' + e.message);
    falhou++;
  }
}

console.log('=== detectarCategoria ===');

teste('Petrobras é categorizado como PETROBRAS', () => {
  assert.equal(detectarCategoria({ title: 'Petrobras assina novo contrato', summary: '' }), 'PETROBRAS');
});

teste('FPSO sem menção a Petrobras vira OFFSHORE', () => {
  assert.equal(detectarCategoria({ title: 'FPSO entra em operação no pré-sal', summary: '' }), 'OFFSHORE');
});

teste('conteúdo sem palavra de nenhuma categoria não recebe rótulo (null)', () => {
  assert.equal(detectarCategoria({ title: 'Comunicado administrativo qualquer', summary: '' }), null);
});

console.log('\n=== avaliarElegibilidade (score editorial) ===');

teste('notícia EXCELENTE (descoberta + Petrobras) tem pontuação alta e é elegível', () => {
  const r = avaliarElegibilidade({ title: 'Petrobras anuncia descoberta recorde de petróleo na margem equatorial', summary: '' });
  assert.equal(r.elegivel, true);
  assert.ok(r.pontuacao >= 20, 'esperava pontuação alta, veio ' + r.pontuacao);
  assert.equal(r.prioridadeMuitoAlta, true);
});

teste('notícia MEDIANA (leilão simples) é elegível mas sem prioridade muito alta', () => {
  const r = avaliarElegibilidade({ title: 'TotalEnergies e Petrobras vencem lotes de leilão de blocos exploratórios', summary: '' });
  assert.equal(r.elegivel, true);
  assert.equal(r.prioridadeMuitoAlta, false);
});

teste('notícia BUROCRÁTICA (audiência pública procedural) é rejeitada mesmo mencionando porto', () => {
  const r = avaliarElegibilidade({ title: 'ANTAQ define audiência pública sobre concessão do canal de acesso ao Porto de Santos', summary: '' });
  assert.equal(r.elegivel, false);
  assert.match(r.motivo, /baixo valor editorial/);
});

teste('ANTAQ pode pontuar bem quando o conteúdo é relevante (não é rejeição por fonte)', () => {
  const r = avaliarElegibilidade({ title: 'Porto de Santos recebe investimento bilionário para novo terminal', summary: '' });
  assert.equal(r.elegivel, true);
});

teste('Petrobras institucional/rotineira (cerimônia) é rejeitada mesmo sendo a fonte mais forte', () => {
  const r = avaliarElegibilidade({ title: 'Petrobras participa de cerimônia de lançamento de livro', summary: '' });
  assert.equal(r.elegivel, false);
});

teste('conteúdo genérico sem palavra de prioridade é rejeitado', () => {
  const r = avaliarElegibilidade({ title: 'Comunicado administrativo interno sobre agenda', summary: 'nada relevante aqui' });
  assert.equal(r.elegivel, false);
});

console.log('\n=== verificarDuplicidade ===');

teste('artigo já publicado é marcado como duplicado', () => {
  const r = verificarDuplicidade({ id: 'abc-123' }, ['abc-123', 'outro-id']);
  assert.equal(r.duplicado, true);
});

teste('artigo novo não é marcado como duplicado', () => {
  const r = verificarDuplicidade({ id: 'novo-id' }, ['abc-123']);
  assert.equal(r.duplicado, false);
});

console.log('\n=== resumo seguro (preservado da correção de 2026-09-16) ===');

teste('resumo genérico conhecido é detectado', () => {
  assert.equal(ehResumoGenerico('Informação publicada pela Agência Petrobras sobre atividades e projetos do setor de energia, petróleo e gás.'), true);
});

teste('resumo real (não genérico) não é confundido com fallback', () => {
  assert.equal(ehResumoGenerico('Petrobras assina contrato de fornecimento de GNL por 20 anos com a Sempra.'), false);
});

teste('extrairResumoFactual pula menu/JS e legenda duplicada, acha o parágrafo real', () => {
  const contentComRuido =
    'Faça uma busca: const searchElement = fragmentElement.querySelector(".search-dropzone");\n\n' +
    'X O uso deste material é autorizado apenas para fins editoriais.\n\n' +
    'A Petrobras assinou um contrato de compra e venda de Gás Natural Liquefeito (GNL) de longo prazo com a Sempra Infrastructure, companhia norte-americana subsidiária da Sempra (NYSE: SRE).';
  const resumo = extrairResumoFactual(contentComRuido);
  assert.match(resumo, /Petrobras assinou um contrato/);
});

teste('obterResumoSeguro cai para título + link (resumo null) quando não há nada confiável', () => {
  const r = obterResumoSeguro({
    summary: 'Informação publicada pela Agência Petrobras sobre atividades e projetos do setor de energia, petróleo e gás.',
    content: 'const x = fragmentElement.querySelector(".a");'
  });
  assert.equal(r.resumo, null);
});

console.log('\n=== formatarPost — HTML seguro, categoria, caracteres especiais ===');

teste('formata post com título em negrito (HTML) e link', () => {
  const texto = formatarPost({ title: 'Título', summary: 'Resumo curto real de verdade sobre o fato.' }, 'https://ownews.com.br/noticia?id=1');
  assert.match(texto, /<b>Título<\/b>/);
  assert.match(texto, /https:\/\/ownews\.com\.br\/noticia\?id=1/);
  assert.match(texto, /Leia no OWNews/);
});

teste('categoria aparece antes do título quando detectada', () => {
  const texto = formatarPost({ title: 'Petrobras assina contrato', summary: 'Resumo real de verdade sobre o contrato assinado.' }, 'https://ownews.com.br/noticia?id=1');
  assert.match(texto, /^PETROBRAS\n\n<b>/);
});

teste('sem categoria detectável, não aparece rótulo nenhum', () => {
  const texto = formatarPost({ title: 'Assunto qualquer sem palavra-chave', summary: 'Resumo real de verdade sobre o fato relatado aqui.' }, 'https://ownews.com.br/noticia?id=1');
  assert.doesNotMatch(texto, /^[A-ZÇÃÕÁÉÍÓÚ &]+\n\n/);
});

teste('título com caracteres HTML especiais (& < >) é escapado, não quebra o post', () => {
  const texto = formatarPost({ title: 'ANP & Petrobras: produção < 2024 > recorde', summary: 'Resumo real de verdade sobre a produção registrada no período.' }, 'https://ownews.com.br/noticia?id=1');
  assert.match(texto, /<b>ANP &amp; Petrobras: produção &lt;2024&gt; recorde<\/b>|<b>ANP &amp; Petrobras: produção &lt; 2024 &gt; recorde<\/b>/);
  // não deve conter tags HTML não escapadas vindas do título
  const soDentroDoNegrito = texto.match(/<b>(.*)<\/b>/)[1];
  assert.doesNotMatch(soDentroDoNegrito, /<(?!\/?b>)/);
});

console.log('\n=== prepararEnvio / imagem válida ===');

teste('notícia COM imagem utilizável gera payload tipo foto', () => {
  const p = prepararEnvio({ image_url: 'https://exemplo.com/foto.jpg', title: 'T', summary: 'Resumo real de verdade sobre o assunto tratado.' }, 'https://ownews.com.br/x');
  assert.equal(p.tipo, 'foto');
});

teste('notícia SEM imagem gera payload tipo texto', () => {
  const p = prepararEnvio({ image_url: null, title: 'T', summary: 'Resumo real de verdade sobre o assunto tratado.' }, 'https://ownews.com.br/x');
  assert.equal(p.tipo, 'texto');
});

teste('imagem quebrada/inválida (placeholder) cai para texto', () => {
  const p = prepararEnvio({ image_url: 'https://exemplo.com/placeholder.png', title: 'T', summary: 'Resumo real de verdade sobre o assunto tratado.' }, 'https://ownews.com.br/x');
  assert.equal(p.tipo, 'texto');
});

teste('ícone de sistema (caso real: spcommon.png) é rejeitado', () => {
  assert.equal(imagemEditorialValida('https://www.epe.gov.br/_layouts/15/images/spcommon.png?rev=40'), false);
});

teste('favicon/logo/sprite são rejeitados', () => {
  assert.equal(imagemEditorialValida('https://exemplo.com/favicon.ico'), false);
  assert.equal(imagemEditorialValida('https://exemplo.com/logo.png'), false);
  assert.equal(imagemEditorialValida('https://exemplo.com/sprite.svg'), false);
});

console.log('\n=== verificarUrlOwnews (nunca link quebrado/local) ===');

teste('URL válida de produção é aceita', () => {
  assert.equal(verificarUrlOwnews('https://ownews.com.br/noticia?id=abc').valida, true);
});

teste('localhost é rejeitado', () => {
  assert.equal(verificarUrlOwnews('http://localhost:8787/noticia?id=abc').valida, false);
});

teste('preview.workers.dev é rejeitado (não é o domínio de produção)', () => {
  assert.equal(verificarUrlOwnews('https://ownews-home-teste.workers.dev/noticia?id=abc').valida, false);
});

teste('URL sem id é rejeitada', () => {
  assert.equal(verificarUrlOwnews('https://ownews.com.br/noticia').valida, false);
});

teste('URL malformada é rejeitada sem lançar exceção', () => {
  assert.equal(verificarUrlOwnews('não é uma url').valida, false);
});

console.log('\n=== publicar() — falhas de API, timeout, rate limit ===');

await testeAsync('dry-run (padrão): nunca chama fetch', async () => {
  let fetchChamado = false;
  global.fetch = async () => { fetchChamado = true; return { ok: true }; };
  const r = await publicar({ tipo: 'texto', texto: 'oi' }, { TELEGRAM_DRY_RUN: 'true' }, { info: () => {} });
  assert.equal(r.dryRun, true);
  assert.equal(fetchChamado, false);
});

await testeAsync('DRY_RUN=false sem token -> lança erro, nunca envia', async () => {
  await assert.rejects(
    () => publicar({ tipo: 'texto', texto: 'oi' }, { TELEGRAM_DRY_RUN: 'false' }),
    /não configurado/
  );
});

await testeAsync('erro 5xx da API é propagado como erro (nunca marcado como enviado)', async () => {
  global.fetch = async () => ({ ok: false, status: 500 });
  await assert.rejects(
    () => publicar({ tipo: 'texto', texto: 'oi' }, { TELEGRAM_DRY_RUN: 'false', TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHANNEL_ID: 'y' }),
    /erro do lado do Telegram/
  );
});

await testeAsync('erro 4xx da API é propagado como erro distinto', async () => {
  global.fetch = async () => ({ ok: false, status: 400, json: async () => ({}) });
  await assert.rejects(
    () => publicar({ tipo: 'texto', texto: 'oi' }, { TELEGRAM_DRY_RUN: 'false', TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHANNEL_ID: 'y' }),
    /HTTP 400/
  );
});

await testeAsync('rate limit (429) é tratado como erro específico, com retry_after quando presente', async () => {
  global.fetch = async () => ({ ok: false, status: 429, json: async () => ({ parameters: { retry_after: 30 } }) });
  try {
    await publicar({ tipo: 'texto', texto: 'oi' }, { TELEGRAM_DRY_RUN: 'false', TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHANNEL_ID: 'y' });
    assert.fail('deveria ter lançado erro de rate limit');
  } catch (e) {
    assert.equal(e.tipo, 'rate_limit');
    assert.equal(e.retryAfter, 30);
  }
});

await testeAsync('timeout na chamada é tratado como erro explícito', async () => {
  global.fetch = async (url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  await assert.rejects(
    () => publicar({ tipo: 'texto', texto: 'oi' }, { TELEGRAM_DRY_RUN: 'false', TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHANNEL_ID: 'y' }),
    /Timeout/
  );
}, 15000);

await testeAsync('erro ao enviar foto (imagem quebrada) cai em fallback de texto', async () => {
  let chamadas = 0;
  global.fetch = async (url) => {
    chamadas++;
    if (String(url).includes('sendPhoto')) return { ok: false, status: 400, json: async () => ({}) };
    return { ok: true, json: async () => ({ result: { message_id: 42, chat: { id: -100123, title: 'Radar Offshore' } } }) };
  };
  const r = await publicar(
    { tipo: 'foto', imagemUrl: 'https://exemplo.com/quebrada.jpg', legenda: 'legenda' },
    { TELEGRAM_DRY_RUN: 'false', TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHANNEL_ID: 'y' }
  );
  assert.equal(r.enviado, true);
  assert.equal(r.tipo, 'texto');
  assert.equal(r.fallbackDeFoto, true);
  assert.equal(r.messageId, 42);
  assert.equal(chamadas, 2);
});

await testeAsync('rate limit no sendPhoto NÃO cai em fallback (propaga, não mascara a causa)', async () => {
  let chamadas = 0;
  global.fetch = async (url) => {
    chamadas++;
    return { ok: false, status: 429, json: async () => ({ parameters: { retry_after: 5 } }) };
  };
  await assert.rejects(
    () => publicar({ tipo: 'foto', imagemUrl: 'https://exemplo.com/foto.jpg', legenda: 'legenda' }, { TELEGRAM_DRY_RUN: 'false', TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHANNEL_ID: 'y' }),
    /rate limit/
  );
  assert.equal(chamadas, 1); // não tentou o fallback de texto
});

console.log('\n=== frequência / anti-spam (limite diário, intervalo mínimo, prioridade alta) ===');

const AGORA = new Date('2026-09-16T15:00:00.000Z').getTime();

teste('computarEstadoEnvios conta só o que foi publicado hoje', () => {
  const historico = [
    { article_id: 'a', published_at: '2026-09-16T10:00:00.000Z' },
    { article_id: 'b', published_at: '2026-09-15T10:00:00.000Z' } // ontem, não conta
  ];
  const estado = computarEstadoEnvios(historico, AGORA);
  assert.equal(estado.enviadosHoje, 1);
});

teste('limite diário normal (4) bloqueia o 5º post se não for excepcional', () => {
  const estado = { enviadosHoje: 4, ultimoEnvioEm: AGORA - 3 * 3600000, jaFurouIntervaloHoje: false };
  const r = avaliarJanelaDeEnvio(estado, AGORA, { pontuacao: 12, prioridadeMuitoAlta: false });
  assert.equal(r.permitido, false);
});

teste('5º post é permitido quando a notícia é excepcionalmente relevante', () => {
  const estado = { enviadosHoje: 4, ultimoEnvioEm: AGORA - 3 * 3600000, jaFurouIntervaloHoje: false };
  const r = avaliarJanelaDeEnvio(estado, AGORA, { pontuacao: 24, prioridadeMuitoAlta: true });
  assert.equal(r.permitido, true);
});

teste('limite excepcional (5) bloqueia qualquer 6º post no mesmo dia', () => {
  const estado = { enviadosHoje: 5, ultimoEnvioEm: AGORA - 3 * 3600000, jaFurouIntervaloHoje: false };
  const r = avaliarJanelaDeEnvio(estado, AGORA, { pontuacao: 40, prioridadeMuitoAlta: true });
  assert.equal(r.permitido, false);
});

teste('intervalo mínimo de 2h bloqueia post normal enviado 30min depois do último', () => {
  const estado = { enviadosHoje: 1, ultimoEnvioEm: AGORA - 30 * 60000, jaFurouIntervaloHoje: false };
  const r = avaliarJanelaDeEnvio(estado, AGORA, { pontuacao: 12, prioridadeMuitoAlta: false });
  assert.equal(r.permitido, false);
});

teste('prioridade MUITO alta pode furar o intervalo mínimo', () => {
  const estado = { enviadosHoje: 1, ultimoEnvioEm: AGORA - 30 * 60000, jaFurouIntervaloHoje: false };
  const r = avaliarJanelaDeEnvio(estado, AGORA, { pontuacao: 30, prioridadeMuitoAlta: true });
  assert.equal(r.permitido, true);
  assert.equal(r.furouIntervalo, true);
});

teste('furar o intervalo só é permitido 1x por dia (raridade)', () => {
  const estado = { enviadosHoje: 2, ultimoEnvioEm: AGORA - 30 * 60000, jaFurouIntervaloHoje: true };
  const r = avaliarJanelaDeEnvio(estado, AGORA, { pontuacao: 30, prioridadeMuitoAlta: true });
  assert.equal(r.permitido, false);
});

teste('depois de passado o intervalo, post normal é permitido de novo', () => {
  const estado = { enviadosHoje: 1, ultimoEnvioEm: AGORA - 3 * 3600000, jaFurouIntervaloHoje: false };
  const r = avaliarJanelaDeEnvio(estado, AGORA, { pontuacao: 12, prioridadeMuitoAlta: false });
  assert.equal(r.permitido, true);
});

console.log('\n=== processarArtigosParaTelegram — pipeline completo, reinício, concorrência ===');

await testeAsync('pipeline completo: duplicata, rejeitado, adiado e publicado (dry-run)', async () => {
  const artigos = [
    { id: 'dup-1', title: 'Descoberta de petróleo recorde', summary: 'Resumo real de verdade sobre a descoberta.' },
    { id: 'rejeitado-1', title: 'ANTAQ define audiência pública sobre concessão do canal de acesso ao Porto de Santos', summary: '' },
    { id: 'candidato-1', title: 'Petrobras assina contrato de longo prazo bilionário', summary: 'Resumo real de verdade sobre o contrato assinado ontem.' }
  ];
  const historico = [{ article_id: 'dup-1', published_at: '2026-09-10T10:00:00.000Z' }];
  const resultados = await processarArtigosParaTelegram(artigos, historico, 'https://ownews.com.br', { TELEGRAM_DRY_RUN: 'true' }, { info: () => {} }, AGORA);

  const porId = Object.fromEntries(resultados.map((r) => [r.articleId, r]));
  assert.equal(porId['dup-1'].status, 'ja_publicado');
  assert.equal(porId['rejeitado-1'].status, 'descartado_editorial');
  assert.equal(porId['candidato-1'].status, 'dry_run');
});

await testeAsync('calibração 2026-09-16: DUAS notícias boas no mesmo lote — a melhor é enviada, a segunda fica aguardando_intervalo (não é descartada)', async () => {
  const artigos = [
    { id: 'boa-1', title: 'Petrobras confirma nova descoberta de petróleo recorde na Bacia de Santos', summary: 'Resumo real de verdade sobre a descoberta confirmada pela empresa.' },
    { id: 'boa-2', title: 'ANP confirma leilão de blocos exploratórios com aumento de produção offshore', summary: 'Resumo real de verdade sobre o leilão confirmado pela agência.' }
  ];
  const resultados = await processarArtigosParaTelegram(artigos, [], 'https://ownews.com.br', { TELEGRAM_DRY_RUN: 'true' }, { info: () => {} }, AGORA);
  const porId = Object.fromEntries(resultados.map((r) => [r.articleId, r]));
  // as duas são elegíveis; a de maior pontuação sai agora, a outra não é
  // perdida — fica marcada como aguardando_intervalo, elegível pra próxima
  // execução (nunca "descartado_editorial").
  const enviada = resultados.find((r) => r.status === 'dry_run');
  const aguardando = resultados.find((r) => r.status === 'aguardando_intervalo');
  assert.ok(enviada, 'esperava exatamente 1 envio neste lote');
  assert.ok(aguardando, 'esperava a segunda boa notícia aguardando intervalo, não descartada');
  assert.notEqual(enviada.articleId, aguardando.articleId);
});

await testeAsync('candidato elegível mas muito antigo (>48h) expira em vez de ficar na fila pra sempre', async () => {
  const artigoAntigo = {
    id: 'velho-1',
    title: 'Petrobras confirma nova descoberta de petróleo recorde na Bacia de Santos',
    summary: 'Resumo real de verdade sobre a descoberta confirmada pela empresa.',
    published_at: new Date(AGORA - 72 * 3600000).toISOString() // 72h atrás
  };
  const resultados = await processarArtigosParaTelegram([artigoAntigo], [], 'https://ownews.com.br', { TELEGRAM_DRY_RUN: 'true' }, { info: () => {} }, AGORA);
  assert.equal(resultados[0].status, 'expirado');
});

await testeAsync('candidato elegível dentro da janela de 48h NÃO expira', async () => {
  const artigoRecente = {
    id: 'recente-1',
    title: 'Petrobras confirma nova descoberta de petróleo recorde na Bacia de Santos',
    summary: 'Resumo real de verdade sobre a descoberta confirmada pela empresa.',
    published_at: new Date(AGORA - 20 * 3600000).toISOString() // 20h atrás
  };
  const resultados = await processarArtigosParaTelegram([artigoRecente], [], 'https://ownews.com.br', { TELEGRAM_DRY_RUN: 'true' }, { info: () => {} }, AGORA);
  assert.equal(resultados[0].status, 'dry_run');
});

await testeAsync('reinício do Worker: novo processo, mesmo histórico -> ainda não reenvia o já publicado', async () => {
  // Simula "reinício" chamando de novo com um histórico carregado do zero
  // (nenhum estado em memória sobrevive) — a garantia vem do histórico
  // persistido, não de variável de processo.
  const artigos = [{ id: 'ja-publicado', title: 'Descoberta de petróleo recorde', summary: 'Resumo real de verdade.' }];
  const historicoCarregadoDoZero = [{ article_id: 'ja-publicado', published_at: '2026-09-10T10:00:00.000Z' }];
  const resultados = await processarArtigosParaTelegram(artigos, historicoCarregadoDoZero, 'https://ownews.com.br', { TELEGRAM_DRY_RUN: 'true' }, { info: () => {} }, AGORA);
  assert.equal(resultados[0].status, 'ja_publicado');
});

await testeAsync('duas execuções simultâneas com o MESMO histórico: risco documentado, mitigado pela constraint UNIQUE(article_id) no schema', async () => {
  // Este módulo não tem lock/transação própria (é decoupled, sem I/O de
  // banco). Se duas execuções rodarem ao mesmo tempo com o histórico ainda
  // não atualizado, as DUAS decidiriam enviar o mesmo candidato — a
  // proteção real contra duplicata de verdade é a constraint
  // UNIQUE(article_id) em telegram_posts (ver schema_dedupe.sql): a segunda
  // gravação falha, e é isso que deve impedir um reenvio subsequente.
  // Este teste documenta e confirma esse comportamento esperado do módulo
  // isoladamente (sem fingir ter lock que ele não tem).
  const artigos = [{ id: 'concorrente-1', title: 'Petrobras anuncia descoberta recorde de petróleo', summary: 'Resumo real de verdade sobre a descoberta.' }];
  const historicoDesatualizado = [];
  const [r1, r2] = await Promise.all([
    processarArtigosParaTelegram(artigos, historicoDesatualizado, 'https://ownews.com.br', { TELEGRAM_DRY_RUN: 'true' }, { info: () => {} }, AGORA),
    processarArtigosParaTelegram(artigos, historicoDesatualizado, 'https://ownews.com.br', { TELEGRAM_DRY_RUN: 'true' }, { info: () => {} }, AGORA)
  ]);
  assert.equal(r1[0].status, 'dry_run');
  assert.equal(r2[0].status, 'dry_run');
  // ambas decidiriam enviar — por isso a integração real PRECISA da
  // constraint UNIQUE(article_id) no Supabase para não duplicar de fato.
});

await testeAsync('limite diário dentro do orquestrador: 5º artigo do dia é adiado se não for excepcional', async () => {
  const artigos = [{ id: 'sexto-candidato', title: 'TotalEnergies e Petrobras vencem lotes de leilão de blocos exploratórios', summary: 'Resumo real de verdade sobre o leilão confirmado.' }];
  const historicoComQuatroHoje = [
    { article_id: 'h1', published_at: new Date(AGORA - 6 * 3600000).toISOString() },
    { article_id: 'h2', published_at: new Date(AGORA - 5 * 3600000).toISOString() },
    { article_id: 'h3', published_at: new Date(AGORA - 4 * 3600000).toISOString() },
    { article_id: 'h4', published_at: new Date(AGORA - 3 * 3600000).toISOString() }
  ];
  const resultados = await processarArtigosParaTelegram(artigos, historicoComQuatroHoje, 'https://ownews.com.br', { TELEGRAM_DRY_RUN: 'true' }, { info: () => {} }, AGORA);
  assert.equal(resultados[0].status, 'aguardando_intervalo');
  assert.match(resultados[0].motivo, /limite normal diário/);
});

await testeAsync('intervalo mínimo dentro do orquestrador: candidato normal 20min após o último é adiado', async () => {
  const artigos = [{ id: 'muito-cedo', title: 'TotalEnergies e Petrobras vencem lotes de leilão de blocos exploratórios', summary: 'Resumo real de verdade sobre o leilão confirmado.' }];
  const historicoRecente = [{ article_id: 'h1', published_at: new Date(AGORA - 20 * 60000).toISOString() }];
  const resultados = await processarArtigosParaTelegram(artigos, historicoRecente, 'https://ownews.com.br', { TELEGRAM_DRY_RUN: 'true' }, { info: () => {} }, AGORA);
  assert.equal(resultados[0].status, 'aguardando_intervalo');
  assert.match(resultados[0].motivo, /intervalo mínimo/);
});

await testeAsync('URL OWNews inválida gera status erro, nunca chega a chamar publicar()', async () => {
  let publicarChamado = false;
  global.fetch = async () => { publicarChamado = true; return { ok: true, json: async () => ({}) }; };
  const artigos = [{ id: 'x', title: 'Petrobras anuncia descoberta recorde de petróleo', summary: 'Resumo real de verdade.' }];
  const resultados = await processarArtigosParaTelegram(artigos, [], 'http://localhost:8787', { TELEGRAM_DRY_RUN: 'false', TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHANNEL_ID: 'y' }, { info: () => {} }, AGORA);
  assert.equal(resultados[0].status, 'erro');
  assert.match(resultados[0].motivo, /URL de destino inválida/);
  assert.equal(publicarChamado, false);
});

await testeAsync('falha de API real não marca como publicado (permite retry seguro)', async () => {
  global.fetch = async () => ({ ok: false, status: 500 });
  const artigos = [{ id: 'falhou', title: 'Petrobras anuncia descoberta recorde de petróleo', summary: 'Resumo real de verdade.' }];
  const resultados = await processarArtigosParaTelegram(artigos, [], 'https://ownews.com.br', { TELEGRAM_DRY_RUN: 'false', TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHANNEL_ID: 'y' }, { info: () => {} }, AGORA);
  assert.equal(resultados[0].status, 'erro');
  assert.equal(resultados[0].tipoErro, 'erro_servidor_telegram');
});

console.log(`\n${passou} passaram, ${falhou} falharam.`);
if (falhou > 0) process.exit(1);
