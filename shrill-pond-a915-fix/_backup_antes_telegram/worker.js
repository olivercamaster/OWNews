const ANP_URL =
  "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados";

const PETROBRAS_URL =
  "https://agencia.petrobras.com.br/pt";

  const MME_URL =
  "https://www.gov.br/mme/pt-br/assuntos/noticias";

/* =========================================================================
   FONTES NOVAS — preparadas localmente, NÃO deployadas ainda.
   ANP, Petrobras e MME acima não foram alteradas.
========================================================================= */
const PPSA_API_URL =
  "https://www.presalpetroleo.gov.br/wp-json/wp/v2/posts?per_page=15&_fields=id,date,link,title,excerpt";

const EPE_URL = "https://www.epe.gov.br/pt/imprensa/noticias";

// BUG encontrado e corrigido em 2026-09-15: "/assuntos/noticias" (sem ano)
// hoje é só uma pasta-índice do Plone com links de facetas por ano — não
// tem nenhum artigo individual, então extrairLinksIBAMA() sempre retornava
// 0 itens (confirmado buscando a página real: 0 links de matéria, só
// links de navegação/RSS/atom). Os artigos de verdade ficam na pasta do
// ano corrente (ex.: ".../noticias/2026/slug-da-materia"), daí o ano
// calculado dinamicamente — fixar "2026" quebraria de novo em janeiro.
const IBAMA_URL_BASE = "https://www.gov.br/ibama/pt-br/assuntos/noticias/";
// O ano precisa ser calculado DENTRO da função (ver coletarIBAMA), nunca
// aqui no escopo de módulo: Cloudflare Workers "congela" o relógio durante
// a inicialização do script (fora de um handler de requisição) por
// segurança/determinismo — new Date() nesse ponto retorna a época Unix
// (1970), não a data real. Confirmado em produção: isso quebrou o /run-ibama
// com erro HTTP 404 em ".../noticias/1970" logo após o primeiro deploy
// desta correção.

// ANTAQ (Agência Nacional de Transportes Aquaviários) — nova fonte
// pesquisada e verificada em 2026-09-15 (página real, ativa, estruturada).
// Cobre portos, cabotagem, apoio marítimo — conecta diretamente com
// logística offshore. Mesmo template de link do ANP/MME/IBAMA (título
// dentro do próprio <a>), só muda o caminho da URL.
const ANTAQ_URL = "https://www.gov.br/antaq/pt-br/noticias";

// Marinha do Brasil: só estas 3 categorias (não a home geral, que mistura
// recrutamento/história/Antártica) — e com filtro MUITO mais restrito que
// o padrão, aplicado abaixo em relevanteMarinha().
const MARINHA_CATEGORIAS = [
  "apoio-acoes-do-estado",
  "seguranca-da-navegacao",
  "transporte-aquaviario"
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/run-anp") {
      return executarTeste(() => coletarANP(env));
    }

    if (url.pathname === "/run-petrobras") {
      return executarTeste(() => coletarPetrobras(env));
    }

    if (url.pathname === "/run-mme") {
  return executarTeste(() => coletarMME(env));
}

    if (url.pathname === "/run-ppsa") {
      return executarTeste(() => coletarPPSA(env));
    }

    if (url.pathname === "/run-epe") {
      return executarTeste(() => coletarEPE(env));
    }

    if (url.pathname === "/run-marinha") {
      return executarTeste(() => coletarMarinha(env));
    }

    if (url.pathname === "/run-ibama") {
      return executarTeste(() => coletarIBAMA(env));
    }

    if (url.pathname === "/run-antaq") {
      return executarTeste(() => coletarANTAQ(env));
    }

if (url.pathname === "/teste-materia") {
  const urlMateria = url.searchParams.get("url");

  if (!urlMateria) {
    return Response.json({
      ok: false,
      erro: "Informe ?url=URL_DA_MATERIA"
    });
  }

  try {
    const detalhes = await lerNoticia(urlMateria, "Teste");

    return Response.json({
      ok: true,
      detalhes
    });
  } catch (erro) {
    return Response.json({
      ok: false,
      erro: erro.message
    });
  }
}

 if (url.pathname === "/saude") {
  return Response.json(await avaliarSaudeEditorial(env));
}

 if (url.pathname === "/aeroportos") {
  const resultado = await consultarAeroportos(env);

  return Response.json(resultado, {
    headers: {
      "Access-Control-Allow-Origin": "*"
    }
  });
}

    if (url.pathname === "/run") {
      return executarTeste(() => executarAtualizacaoPrincipal(env));
    }

    if (url.pathname === "/run-novas-fontes") {
      return executarTeste(() => executarAtualizacaoNovasFontes(env));
    }

    return Response.json({
      sistema: "OWNews Automation",
      status: "ONLINE",
      supabase_url: !!env.SUPABASE_URL,
      supabase_secret: !!env.SUPABASE_SERVICE_ROLE_KEY,
      fontes_automaticas: ["ANP", "Petrobras", "MME", "PPSA", "EPE"],
      fontes_preparadas_nao_automaticas: ["Marinha do Brasil", "IBAMA", "ANTAQ"]
    });
  },

  // Duas invocações separadas (mesmo horário/hora, minuto diferente) —
  // cada uma com seu próprio orçamento de subrequests do Cloudflare
  // Workers. Rodar ANP+Petrobras+MME+PPSA+EPE juntos numa invocação só
  // estourava o limite ("Too many subrequests by single Worker
  // invocation") antes mesmo de PPSA/EPE conseguirem inserir algo.
  async scheduled(event, env, ctx) {
    if (event.cron === "20 8,11,14,17,20,22 * * *") {
      ctx.waitUntil(executarAtualizacaoNovasFontes(env));
    } else {
      // "50 8,11,14,17,20,22 * * *" — horário original, sem mudança.
      ctx.waitUntil(executarAtualizacaoPrincipal(env));
    }
  }
};

async function executarTeste(funcao) {
  try {
    const resultado = await funcao();
    return Response.json(resultado);
  } catch (erro) {
    console.error(erro);
    return Response.json(
      { ok: false, erro: erro.message },
      { status: 500 }
    );
  }
}

// Grupo A: ANP + Petrobras + MME — exatamente como sempre foi, sem
// nenhuma alteração de comportamento. ~48 subrequests, dentro do limite.
async function executarAtualizacaoPrincipal(env) {
  const resultados = {};

  try {
    resultados.anp = await coletarANP(env);
  } catch (erro) {
    resultados.anp = { ok: false, erro: erro.message };
  }

  try {
    resultados.petrobras = await coletarPetrobras(env);
  } catch (erro) {
    resultados.petrobras = { ok: false, erro: erro.message };
  }

  // MME saiu deste grupo em 2026-09-15: o filtro de relevância foi ampliado
  // nesta mesma rodada (ANP passou a aceitar ~2x mais itens), e ANP+
  // Petrobras+MME juntos passaram a estourar "Too many subrequests by
  // single Worker invocation" (confirmado em produção: as 5 notícias do
  // MME falharam com esse erro exato na primeira execução pós-deploy).
  // MME foi realocado pro Grupo B (executarAtualizacaoNovasFontes), que
  // tinha folga de sobra. Nenhum horário de cron mudou — só qual grupo
  // processa qual fonte.

  return {
    ok: true,
    sistema: "OWNews Automation",
    resultados
  };
}

// Grupo B: PPSA + EPE — invocação própria, com orçamento de subrequests
// independente do Grupo A. ~34 subrequests, dentro do limite.
//
// Marinha do Brasil e IBAMA: coletores prontos e testados (ver
// coletarMarinha/coletarIBAMA e as rotas manuais /run-marinha, /run-ibama),
// mas DELIBERADAMENTE fora de qualquer grupo automático por enquanto —
// ainda não autorizados para produção.
async function executarAtualizacaoNovasFontes(env) {
  const resultados = {};

  try {
    resultados.ppsa = await coletarPPSA(env);
  } catch (erro) {
    resultados.ppsa = { ok: false, erro: erro.message };
  }

  try {
    resultados.epe = await coletarEPE(env);
  } catch (erro) {
    resultados.epe = { ok: false, erro: erro.message };
  }

  // MME entrou neste grupo em 2026-09-15, realocado do Grupo A (ver
  // comentário em executarAtualizacaoPrincipal) por causa do limite de
  // subrequests por invocação — este grupo tinha folga de sobra.
  try {
    resultados.mme = await coletarMME(env);
  } catch (erro) {
    resultados.mme = { ok: false, erro: erro.message };
  }

  return {
    ok: true,
    sistema: "OWNews Automation (novas fontes)",
    resultados
  };
}

/* =========================
   ANP
========================= */

async function coletarANP(env) {
  validarAmbiente(env);

  const html = await baixarPagina(ANP_URL);

  const noticias = extrairLinksANP(html)
    .filter(item => noticiaRelevante(item.title))
    .slice(0, 10);

  return processarNoticias(env, "ANP", noticias);
}

function extrairLinksANP(html) {
  const encontrados = [];

  const regex =
    /<a[^>]+href=["']([^"']*\/noticias-comunicados\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    let href = match[1];
    const title = limparTexto(match[2]);

    if (!title || title.length < 15) continue;

    if (href.startsWith("/")) {
      href = "https://www.gov.br" + href;
    }

    if (!href.startsWith("https://www.gov.br/anp/")) continue;

    adicionarUnico(encontrados, {
      title,
      url: href,
      source: "ANP"
    });
  }

  return encontrados;
}
/* =========================
   MME
========================= */

async function coletarMME(env) {
  validarAmbiente(env);

  const html = await baixarPagina(MME_URL);

  const noticias = extrairLinksMME(html)
    .filter(item => noticiaRelevante(item.title))
    .slice(0, 10);

  return processarNoticias(env, "MME", noticias);
}

function extrairLinksMME(html) {
  const encontrados = [];

  const regex =
    /<a[^>]+href=["']([^"']*\/mme\/pt-br\/assuntos\/noticias\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    let href = match[1];
    const title = limparTexto(match[2]);

    if (!title || title.length < 15) continue;

    if (href.startsWith("/")) {
      href = "https://www.gov.br" + href;
    }

    if (!href.startsWith("https://www.gov.br/mme/")) continue;

    adicionarUnico(encontrados, {
      title,
      url: href,
      source: "MME"
    });
  }

  return encontrados;
}

/* =========================================================================
   FONTES NOVAS (preparadas localmente — não deployadas)
========================================================================= */

/* ---------- PPSA (API REST do WordPress — mais confiável que regex) ---------- */

async function coletarPPSA(env) {
  validarAmbiente(env);

  const resposta = await fetch(PPSA_API_URL, {
    headers: { "User-Agent": "OWNews/1.0 - OffshoreWorks news collector" }
  });

  if (!resposta.ok) {
    throw new Error(`PPSA API respondeu HTTP ${resposta.status}`);
  }

  const posts = await resposta.json();

  const noticias = posts
    .map((p) => ({
      title: limparTexto(p.title && p.title.rendered ? p.title.rendered : ""),
      url: p.link,
      source: "PPSA"
    }))
    .filter((item) => item.title && item.url && noticiaRelevante(item.title))
    .slice(0, 5);

  return processarNoticiasComDedupe(env, "PPSA", noticias);
}

/* ---------- EPE ---------- */

async function coletarEPE(env) {
  validarAmbiente(env);

  const html = await baixarPagina(EPE_URL);

  const noticias = extrairLinksEPE(html)
    .filter((item) => noticiaRelevante(item.title))
    .slice(0, 5);

  return processarNoticiasComDedupe(env, "EPE", noticias);
}

function extrairLinksEPE(html) {
  const encontrados = [];

  // Estrutura observada: <a href="/pt/imprensa/noticias/slug"><h2 ...>Título</h2></a>
  const regex =
    /<a[^>]+href="(\/pt\/imprensa\/noticias\/[^"]+)"[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const caminho = match[1];
    const slug = caminho.split("/").pop();

    // "area-9", "area-4" etc. são filtros de categoria da barra lateral, não matérias.
    if (/^area-\d+$/i.test(slug)) continue;

    const title = limparTexto(match[2]);
    if (!title || title.length < 15) continue;

    adicionarUnico(encontrados, {
      title,
      url: "https://www.epe.gov.br" + caminho,
      source: "EPE"
    });
  }

  return encontrados;
}

/* ---------- Marinha do Brasil (só 3 categorias, filtro MUITO restrito) ---------- */

const PALAVRAS_MARINHA_RESTRITO = [
  "offshore", "plataforma", "fpso", "petróleo", "petroleo", "gás natural", "gas natural",
  "sonda", "perfuração", "perfuracao", "subsea", "apoio marítimo", "apoio maritimo",
  "pré-sal", "pre-sal", "margem equatorial", "navio-plataforma",
  "bacia de campos", "bacia de santos", "embarcação de apoio", "embarcacao de apoio"
];

function relevanteMarinha(titulo) {
  const t = titulo.toLowerCase();
  return PALAVRAS_MARINHA_RESTRITO.some((p) => t.includes(p));
}

async function coletarMarinha(env) {
  validarAmbiente(env);

  let todasNoticias = [];

  for (const categoria of MARINHA_CATEGORIAS) {
    try {
      const html = await baixarPagina(`https://www.agencia.marinha.mil.br/${categoria}`);
      todasNoticias = todasNoticias.concat(extrairLinksMarinha(html, categoria));
    } catch (erro) {
      // categoria indisponível nesta rodada — segue para as outras, não interrompe o coletor inteiro.
    }
  }

  const noticias = todasNoticias
    .filter((item) => relevanteMarinha(item.title))
    .slice(0, 5);

  return processarNoticiasComDedupe(env, "Marinha do Brasil", noticias);
}

function extrairLinksMarinha(html, categoria) {
  const encontrados = [];

  // BUG encontrado e corrigido em 2026-09-15: cada card tem DOIS <a> com o
  // mesmo href — um envolvendo só a <img> (sem texto), outro com o título
  // de verdade dentro de <h4 class="card-title">. O regex antigo pegava o
  // primeiro <a> (o da imagem) e capturava HTML solto (divs/spans
  // seguintes) como se fosse o título, nunca o título real. Confirmado
  // contra a página ao vivo: o padrão estável é h4.card-title > a.
  const regex = new RegExp(
    `<h4 class="card-title"><a href="(/${categoria}/[^"]+)"[^>]*>([\\s\\S]{0,250}?)<\\/a><\\/h4>`,
    "gi"
  );

  let match;

  while ((match = regex.exec(html)) !== null) {
    const title = limparTexto(match[2]);
    if (!title || title.length < 20) continue;

    adicionarUnico(encontrados, {
      title,
      url: "https://www.agencia.marinha.mil.br" + match[1],
      source: "Marinha do Brasil"
    });
  }

  return encontrados;
}

/* ---------- IBAMA (mesmo template gov.br do ANP/MME) ---------- */

async function coletarIBAMA(env) {
  validarAmbiente(env);

  const html = await baixarPagina(IBAMA_URL_BASE + new Date().getFullYear());

  const noticias = extrairLinksIBAMA(html)
    .filter((item) => noticiaRelevante(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "IBAMA", noticias);
}

function extrairLinksIBAMA(html) {
  const encontrados = [];

  const regex =
    /<a[^>]+href=["']([^"']*\/ibama\/pt-br\/assuntos\/noticias\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    let href = match[1];
    const title = limparTexto(match[2]);

    if (!title || title.length < 15) continue;

    if (href.startsWith("/")) {
      href = "https://www.gov.br" + href;
    }

    if (!href.startsWith("https://www.gov.br/ibama/")) continue;

    adicionarUnico(encontrados, {
      title,
      url: href,
      source: "IBAMA"
    });
  }

  return encontrados;
}

/* ---------- ANTAQ (mesmo template gov.br do ANP/MME/IBAMA) ----------
   Preparada e testada localmente em 2026-09-15 (ver simulação com HTML
   real da própria página). DELIBERADAMENTE fora de qualquer grupo
   automático do cron por enquanto — mesma situação de Marinha/IBAMA:
   pendência de decisão editorial + de deploy (não de engenharia). Ativar
   exige (a) decidir em qual grupo/horário entra, considerando o limite de
   subrequests por invocação já documentado acima, e (b) autorização de
   deploy do collector (não feito nesta rodada). */
async function coletarANTAQ(env) {
  validarAmbiente(env);

  const html = await baixarPagina(ANTAQ_URL);

  const noticias = extrairLinksANTAQ(html)
    .filter((item) => noticiaRelevante(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "ANTAQ", noticias);
}

function extrairLinksANTAQ(html) {
  const encontrados = [];

  const regex =
    /<a[^>]+href=["'](https:\/\/www\.gov\.br\/antaq\/pt-br\/noticias\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    const title = limparTexto(match[2]);

    if (!title || title.length < 15) continue;

    adicionarUnico(encontrados, {
      title,
      url: href,
      source: "ANTAQ"
    });
  }

  return encontrados;
}

/* ---------- Deduplicação entre fontes ----------
   Evita que o mesmo acontecimento real, coberto por fontes diferentes
   (ex.: PPSA e Petrobras noticiando o mesmo leilão), vire duas matérias no
   OWNews. Compara por sobreposição de palavras do título (Jaccard simples,
   ignorando palavras curtas) contra o que já foi publicado nos últimos dias.
   É um critério heurístico, não perfeito — pensado pra ser conservador:
   só pula a inserção quando a semelhança é bem alta. */

function normalizarTituloParaComparacao(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function similaridadeTitulos(a, b) {
  const wa = new Set(normalizarTituloParaComparacao(a));
  const wb = new Set(normalizarTituloParaComparacao(b));
  if (!wa.size || !wb.size) return 0;
  let intersecao = 0;
  for (const w of wa) if (wb.has(w)) intersecao++;
  const uniao = new Set([...wa, ...wb]).size;
  return intersecao / uniao;
}

const LIMIAR_SIMILARIDADE_DUPLICATA = 0.55;

/* ---------- Monitor de saúde editorial ----------
   Endpoint de operação (GET /saude), só leitura, sem escrever nada e sem
   ativar nenhum alerta externo (Telegram fica pra uma etapa futura,
   explicitamente não ativada agora). Serve pra responder objetivamente:
   "o OWNews está ficando sem notícia nova?" — sem depender de alguém
   perceber isso olhando a Home visualmente, como aconteceu desta vez. */
async function avaliarSaudeEditorial(env) {
  const desde = new Date(Date.now() - 7 * 86400000).toISOString();
  const endpoint =
    `${env.SUPABASE_URL}/rest/v1/articles` +
    `?select=published_at,image_credit&status=eq.published&published_at=gte.${encodeURIComponent(desde)}` +
    `&order=published_at.desc`;

  const resposta = await fetch(endpoint, { headers: supabaseHeaders(env) });
  if (!resposta.ok) {
    return { ok: false, erro: `Supabase respondeu HTTP ${resposta.status}` };
  }

  const artigos = await resposta.json();
  const agora = Date.now();

  if (!artigos.length) {
    return {
      ok: true,
      estado: "SEM_ATUALIZACAO",
      last_collected_article_at: null,
      horas_desde_ultima_coleta: null,
      articles_last_24h: 0,
      articles_last_48h: 0,
      sources_active_24h: []
    };
  }

  const lastCollectedAt = artigos[0].published_at;
  const horasDesdeUltima = (agora - new Date(lastCollectedAt).getTime()) / 3600000;

  const ultimas24h = artigos.filter(a => (agora - new Date(a.published_at).getTime()) / 3600000 <= 24);
  const ultimas48h = artigos.filter(a => (agora - new Date(a.published_at).getTime()) / 3600000 <= 48);
  const fontesAtivas24h = [...new Set(ultimas24h.map(a => a.image_credit).filter(Boolean))];

  // Limiares simples e documentados, não "mágicos": ~2,5-3h é o intervalo
  // normal do cron, então 12h sem nada já é ao menos 4-5 janelas perdidas;
  // 48h é o ponto em que já dá pra afirmar com segurança que parou (foi
  // exatamente o que aconteceu nesta rodada, ~63h).
  let estado;
  if (horasDesdeUltima <= 12) estado = "SAUDAVEL";
  else if (horasDesdeUltima <= 48) estado = "ATENCAO";
  else estado = "SEM_ATUALIZACAO";

  return {
    ok: true,
    estado,
    last_collected_article_at: lastCollectedAt,
    horas_desde_ultima_coleta: Math.round(horasDesdeUltima * 10) / 10,
    articles_last_24h: ultimas24h.length,
    articles_last_48h: ultimas48h.length,
    sources_active_24h: fontesAtivas24h
  };
}

async function buscarTitulosRecentes(env, dias) {
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const endpoint =
    `${env.SUPABASE_URL}/rest/v1/articles` +
    `?select=id,title,image_credit,original_url&status=eq.published&published_at=gte.${encodeURIComponent(desde)}`;

  const resposta = await fetch(endpoint, { headers: supabaseHeaders(env) });
  if (!resposta.ok) return [];
  return await resposta.json();
}

// Usada só pelas fontes NOVAS — ANP/Petrobras/MME continuam chamando
// processarNoticias() direto, sem essa checagem extra.
async function processarNoticiasComDedupe(env, fonte, noticias) {
  const recentes = await buscarTitulosRecentes(env, 5);
  const filtradas = [];
  const puladasPorDuplicidade = [];

  for (const item of noticias) {
    const parecida = recentes.find(
      (r) => r.original_url !== item.url && similaridadeTitulos(r.title, item.title) >= LIMIAR_SIMILARIDADE_DUPLICATA
    );

    if (parecida) {
      puladasPorDuplicidade.push({
        titulo: item.title,
        parecido_com: parecida.title,
        fonte_existente: parecida.image_credit
      });
      continue;
    }

    filtradas.push(item);
  }

  const resultado = await processarNoticias(env, fonte, filtradas);
  resultado.puladas_por_duplicidade = puladasPorDuplicidade;
  return resultado;
}

/* =========================
   PETROBRAS
========================= */

// Petrobras publica artigos "arquivo" (às vezes com anos de idade) nos mesmos
// blocos de dados estruturados da home. Sem isso, matéria antiga entraria no
// Supabase com published_at de hoje, parecendo notícia nova sem ser.
const PETROBRAS_MAX_DIAS_RECENCIA = 45;

async function coletarPetrobras(env) {
  validarAmbiente(env);

  const html = await baixarPagina(PETROBRAS_URL);

  const noticias = extrairLinksPetrobras(html)
    .filter(item => noticiaRelevante(item.title))
    .filter(item => !item.title.toLowerCase().startsWith("aviso de pauta"))
    .slice(0, 5);

  return processarNoticias(env, "Petrobras", noticias);
}

function extrairLinksPetrobras(html) {
  const encontrados = [];

  /*
    A Agência Petrobras (agencia.petrobras.com.br) parou de manter o texto
    visível da matéria dentro da própria tag <a> — o layout atual separa link
    e título em elementos diferentes, então regex em cima de <a>...</a> não
    encontra praticamente nada (testado: 2 de ~130 links da home).
    A página, porém, expõe os mesmos dados via JSON-LD (schema.org ItemList /
    Article) nos blocos <script type="application/ld+json">, com headline,
    URL (mainEntityOfPage) e datePublished — muito mais estável que depender
    da estrutura visual do HTML.
  */
  const regexScript =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;
  const agora = Date.now();

  while ((match = regexScript.exec(html)) !== null) {
    let dados;
    try {
      dados = JSON.parse(match[1]);
    } catch {
      continue;
    }

    if (!dados || dados["@type"] !== "ItemList" || !Array.isArray(dados.itemListElement)) {
      continue;
    }

    for (const item of dados.itemListElement) {
      const artigo = item && item.item;
      if (!artigo || artigo["@type"] !== "Article") continue;

      const title = limparTexto(artigo.headline || "");
      let href = artigo.mainEntityOfPage || artigo.url || "";

      if (!title || title.length < 15 || !href) continue;

      if (href.startsWith("/")) {
        href = "https://agencia.petrobras.com.br" + href;
      }

      if (!href.startsWith("https://agencia.petrobras.com.br/")) continue;

      if (
        href === PETROBRAS_URL ||
        href.includes("/listar-editoria") ||
        href.includes("/tags/")
      ) {
        continue;
      }

      if (artigo.datePublished) {
        const publicadoEm = new Date(artigo.datePublished).getTime();
        const diasAtras = (agora - publicadoEm) / (1000 * 60 * 60 * 24);
        if (!Number.isNaN(diasAtras) && diasAtras > PETROBRAS_MAX_DIAS_RECENCIA) {
          continue;
        }
      }

      adicionarUnico(encontrados, {
        title,
        url: href,
        source: "Petrobras"
      });
    }
  }

  return encontrados;
}

/* =========================
   PROCESSAMENTO
========================= */

async function processarNoticias(env, fonte, noticias) {
  const resultado = {
    ok: true,
    fonte,
    encontradas: noticias.length,
    inseridas: 0,
    duplicadas: 0,
    noticias: []
  };

  for (const item of noticias) {
    try {
      const existe = await noticiaJaExiste(env, item.url);

      if (existe) {
  const detalhes = await lerNoticia(item.url, fonte);

  await atualizarArtigo(env, item.url, {
    title: detalhes.title || item.title,
    summary: detalhes.summary,
    content: detalhes.content || detalhes.summary,
    image_url: detalhes.imageUrl || null,
    image_caption: detalhes.imageCaption || null,
    image_credit: detalhes.imageCredit || fonte,
    original_published_at: detalhes.publishedAt,
    slug: criarSlug(detalhes.title || item.title)
  });

  resultado.duplicadas++;

  resultado.noticias.push({
    titulo: detalhes.title || item.title,
    status: "atualizada"
  });

  continue;
}


      const detalhes = await lerNoticia(item.url, fonte);

      const artigo = {
        title: detalhes.title || item.title,
        original_url: item.url,
        original_published_at: detalhes.publishedAt,
        summary: detalhes.summary,
        content: detalhes.content || detalhes.summary,
image_url: detalhes.imageUrl || null,
image_caption: detalhes.imageCaption || null,
image_credit: detalhes.imageCredit || null,
slug: criarSlug(detalhes.title || item.title),
        hash: await sha256(item.url),
        status: "published",
        is_sensitive: false,
        published_at: new Date().toISOString()
      };

      await inserirArtigo(env, artigo);

      resultado.inseridas++;

      resultado.noticias.push({
        titulo: artigo.title,
        status: "inserida"
      });

    } catch (erro) {
      resultado.noticias.push({
        titulo: item.title,
        status: "erro",
        erro: erro.message
      });
    }
  }

  return resultado;
}

/* =========================
   LEITURA DA MATÉRIA
========================= */

async function lerNoticia(url, fonte) {
  const html = await baixarPagina(url);

  const title =
    meta(html, "og:title") ||
    limparTexto(
      (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || ""
    );

  let summary =
    meta(html, "description") ||
    meta(html, "og:description");

  summary = limparTexto(summary);

  if (!summary || summary.length < 40) {
    summary =
      fonte === "Petrobras"
        ? "Informação publicada pela Agência Petrobras sobre atividades e projetos do setor de energia, petróleo e gás."
        : "Informação publicada pela Agência Nacional do Petróleo, Gás Natural e Biocombustíveis sobre o setor de petróleo e gás.";
  }

  // OWNews guarda apenas resumo curto, não o conteúdo integral.
  if (summary.length > 500) {
    summary = summary.slice(0, 497).trim() + "...";
  }

  const conteudoExtraido = extrairConteudoMateria(html);

  // Nível 1: og:image / twitter:image / <picture> / <img> dentro do <article>
  // (já filtra logo/ícone institucional — extrairImagemPrincipal).
  let imagemPrincipal = extrairImagemPrincipal(html, url);
  let imageCaption = null;

  // Nível 2: metadata estruturada (JSON-LD) da própria página. Só vira a
  // imagem escolhida quando o Nível 1 não achou nada (ex.: páginas de vídeo
  // da Petrobras, sem <img> normal, só um bloco ImageObject/NewsArticle).
  // Quando o Nível 1 já achou imagem, ainda aproveitamos a legenda real do
  // JSON-LD (caption/description), que hoje nunca era capturada.
  const viaJsonLd = extrairImagemJsonLd(html, url);
  if (!imagemPrincipal && viaJsonLd) {
    imagemPrincipal = viaJsonLd.url;
    imageCaption = viaJsonLd.caption;
  } else if (imagemPrincipal && viaJsonLd && viaJsonLd.caption) {
    imageCaption = viaJsonLd.caption;
  }

return {
  title,
  summary,
  content: conteudoExtraido || summary,
  imageUrl: imagemPrincipal,
  imageCaption,
  imageCredit: fonte,
  publishedAt: extrairData(html)
};
} function extrairConteudoMateria(html) {
  let area = html;

  const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (article && article[1]) {
    area = article[1];
  }

  const paragrafos = [];
  const regex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;

  while ((match = regex.exec(area)) !== null) {
    const texto = limparTexto(match[1]);

    if (
      texto &&
      texto.length >= 60 &&
      !/cookie|privacidade|compartilhe|assine|newsletter/i.test(texto)
    ) {
      paragrafos.push(texto);
    }

    if (paragrafos.length >= 8) break;
  }

  return paragrafos.join('\n\n');
}

function extrairImagemPrincipal(html, urlPagina) {
  const candidatas = [];

  // Imagens declaradas nos metadados da matéria
  const ogImage = meta(html, "og:image");
  const twitterImage = meta(html, "twitter:image");

  if (ogImage) candidatas.push(ogImage);
  if (twitterImage) candidatas.push(twitterImage);

  // Procura imagens dentro do conteúdo principal
  const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const area = article && article[1] ? article[1] : html;

  // src normal
  const regexSrc = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = regexSrc.exec(area)) !== null) {
    candidatas.push(match[1]);
  }

  // lazy loading: data-src
  const regexDataSrc = /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi;

  while ((match = regexDataSrc.exec(area)) !== null) {
    candidatas.push(match[1]);
  }

  // Gov.br / Plone frequentemente usa srcset
  const regexSrcset = /<img[^>]+srcset=["']([^"']+)["'][^>]*>/gi;

  while ((match = regexSrcset.exec(area)) !== null) {
    const primeira = match[1].split(",")[0].trim().split(/\s+/)[0];
    if (primeira) candidatas.push(primeira);
  }

  // Remove duplicadas
  const unicas = [...new Set(candidatas)];

  for (const candidata of unicas) {
    try {
      const absoluta = new URL(candidata, urlPagina).href;

      // Rejeita imagens que claramente não são foto da notícia
      if (
        /logo|brasao|brasão|favicon|icone|icon|avatar|banner-gov|assinatura|sprite|placeholder/i.test(
          absoluta
        )
      ) {
        continue;
      }

      // Aceita formatos e caminhos comuns de imagens editoriais
      if (
        /\.(jpg|jpeg|png|webp)(\?|$)/i.test(absoluta) ||
        /@@images|image|imagem|foto|noticia|news|uploads/i.test(absoluta)
      ) {
        return absoluta;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/* Nível 2 da hierarquia de imagem: lê os blocos JSON-LD (schema.org) que a
   própria página expõe. Resolve casos como as páginas "VÍDEO -" da Petrobras,
   que não têm <img> normal (Nível 1), só um bloco ImageObject solto (com
   caption/description reais) e/ou o campo "image" do NewsArticle/Article. */
function extrairImagemJsonLd(html, urlPagina) {
  const blocos = [];
  const regexScript =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;
  while ((match = regexScript.exec(html)) !== null) {
    let dados;
    try {
      dados = JSON.parse(match[1]);
    } catch {
      continue;
    }
    if (Array.isArray(dados)) {
      for (const item of dados) {
        if (item && typeof item === "object") blocos.push(item);
      }
    } else if (dados && typeof dados === "object") {
      blocos.push(dados);
    }
  }

  const paraAbsoluta = (u) => {
    if (!u || typeof u !== "string") return null;
    try {
      return new URL(u, urlPagina).href;
    } catch {
      return null;
    }
  };

  const imagemValida = (absoluta) => {
    if (!absoluta) return false;
    if (
      /logo|brasao|brasão|favicon|icone|icon|avatar|banner-gov|assinatura|sprite|placeholder/i.test(
        absoluta
      )
    ) {
      return false;
    }
    return true;
  };

  // 1) Bloco ImageObject solto — costuma trazer a foto em melhor resolução
  //    e uma legenda (caption/description) real, escrita pela própria fonte.
  const imageObject = blocos.find(
    (b) => b["@type"] === "ImageObject" && (b.url || b.contentUrl)
  );

  if (imageObject) {
    const absoluta = paraAbsoluta(imageObject.url || imageObject.contentUrl);
    if (imagemValida(absoluta)) {
      const legenda = limparTexto(imageObject.caption || imageObject.description || "");
      return { url: absoluta, caption: legenda || null };
    }
  }

  // 2) Campo "image" do próprio Article/NewsArticle/BlogPosting.
  const artigo = blocos.find((b) =>
    ["Article", "NewsArticle", "BlogPosting"].includes(b["@type"])
  );

  if (artigo && artigo.image) {
    let img = artigo.image;
    if (Array.isArray(img)) img = img[0];
    const bruta = typeof img === "string" ? img : img && img.url;
    const absoluta = paraAbsoluta(bruta);
    if (imagemValida(absoluta)) {
      return { url: absoluta, caption: null };
    }
  }

  return null;
}

function criarSlug(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function extrairData(html) {
  /*
    ANP: Publicado em DD/MM/AAAA HHhMM
    Petrobras: Publicado em DD/MM/AAAA às HH:MM:SS
  */

  let match = html.match(
    /Publicado em\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})\s*(?:às\s*)?([0-9]{2})(?:h|:)([0-9]{2})/i
  );

  if (!match) {
    match = html.match(
      /([0-9]{2}\/[0-9]{2}\/[0-9]{4})/
    );
  }

  if (!match) return null;

  const data = match[1];
  const hora = match[2] || "12";
  const minuto = match[3] || "00";

  const [dia, mes, ano] = data.split("/");

  return `${ano}-${mes}-${dia}T${hora}:${minuto}:00-03:00`;
}

/* =========================
   FILTRO EDITORIAL OWNEWS
========================= */

/* Ampliado em 2026-09-15: a auditoria de frescor da Home encontrou conteúdo
   oficial legítimo (ex.: boletim da ANP "Levantamento de Preços de
   Combustíveis") sendo descartado por esta função, porque o vocabulário
   original só cobria upstream/offshore — nenhuma palavra de combustível,
   preço, porto ou transição energética. Isso reduzia artificialmente o
   volume de matérias que o OWNews conseguia publicar por dia, mesmo com
   fontes saudáveis. Backup do estado anterior em
   _backup_antes_expansao_editorial/worker.js. */
const PALAVRAS_NUCLEO_OFFSHORE = [
  // upstream / exploração e produção
  "petróleo",
  "petroleo",
  "petrolífera",
  "petrolifera",
  "óleo e gás",
  "oleo e gas",
  "gás natural",
  "gas natural",
  "hidrocarbonetos",
  "exploração",
  "exploracao",
  "bloco",
  "bacia",
  "offshore",
  "pré-sal",
  "pre-sal",
  "campo",
  "poço",
  "poco",
  "sísmica",
  "sismica",
  "reservas provadas",
  // formas ancoradas de "produção" (evita falso-positivo com refino/
  // downstream, ex.: "produção de derivados", "produção de diesel")
  "produção de petróleo",
  "producao de petroleo",
  "produção de gás",
  "producao de gas",
  "produção offshore",
  "producao offshore",
  "fase de produção",
  "fase de producao",
  // ativos e operação offshore
  "plataforma",
  "navio-plataforma",
  "fpso",
  "uep",
  "unidade estacionária de produção",
  "unidade estacionaria de producao",
  "sonda",
  "perfuração",
  "perfuracao",
  "descomissionamento",
  "margem equatorial",
  "búzios",
  "buzios",
  "mero",
  "tupi",
  "metano",
  "segurança operacional",
  "aguas profundas",
  "águas profundas",
  "águas ultra profundas",
  "aguas ultra profundas",
  // regulação / negócio do setor
  "royalties",
  "participação especial",
  "participacao especial",
  "licitação",
  "licitacao",
  "leilão",
  "leilao",
  "oferta permanente",
  "concessão",
  "concessao",
  "gasoduto"
];

// Combustíveis, mercado internacional, logística e transição energética —
// toda a cadeia do setor, não só exploração/produção. Cada termo foi
// escolhido por aparecer de fato em manchetes oficiais (ANP, MME, EPE),
// não por suposição.
const PALAVRAS_CADEIA_ENERGIA = [
  // combustíveis / downstream
  "combustível",
  "combustivel",
  "combustíveis",
  "combustiveis",
  "gasolina",
  "diesel",
  "etanol",
  "glp",
  "qav",
  "querosene de aviação",
  "querosene de aviacao",
  "biocombustível",
  "biocombustivel",
  "biocombustíveis",
  "biocombustiveis",
  "biodiesel",
  "saf",
  "refino",
  "refinaria",
  "refinarias",
  "distribuição de combustíveis",
  "distribuicao de combustiveis",
  "posto de combustível",
  "postos de combustível",
  "posto de combustivel",
  "postos de combustiveis",
  "abastecimento",
  // preço / mercado internacional
  "brent",
  "wti",
  "preço do petróleo",
  "preco do petroleo",
  "preço dos combustíveis",
  "preco dos combustiveis",
  "preço de combustíveis",
  "preco de combustiveis",
  "opep",
  "opep+",
  // logística / portos
  "porto",
  "portos",
  "cabotagem",
  "terminal portuário",
  "terminal portuario",
  "transporte marítimo",
  "transporte maritimo",
  "navegação de apoio",
  "navegacao de apoio",
  // transição energética
  "eólica offshore",
  "eolica offshore",
  "parque eólico marítimo",
  "parque eolico maritimo",
  "captura de carbono",
  "armazenamento de carbono",
  "ccs",
  "hidrogênio",
  "hidrogenio",
  "transição energética",
  "transicao energetica",
  "matriz energética",
  "matriz energetica"
];

// Termos amplos demais para valerem sozinhos (senão o OWNews vira portal
// geral de greves/carros/geopolítica) — só contam quando aparecem junto de
// um termo de contexto de petróleo/energia/offshore no MESMO título.
const GATILHOS_AMPLOS_COM_CONTEXTO = [
  "greve",
  "carro elétrico",
  "carro eletrico",
  "veículo elétrico",
  "veiculo eletrico",
  "eletrificação da frota",
  "eletrificacao da frota",
  "sanção",
  "sancao",
  "sanções",
  "sancoes",
  "estreito de ormuz"
];
const CONTEXTO_ENERGIA_OBRIGATORIO = [
  "petróleo", "petroleo", "petrobras", "refinaria", "refinarias",
  "gás natural", "gas natural", "combustível", "combustivel",
  "combustíveis", "combustiveis", "abastecimento", "porto", "portos",
  "opep", "brent", "wti", "caminhoneiro", "caminhoneiros",
  "petroleiro", "petroleiros", "offshore", "óleo e gás", "oleo e gas"
];

function noticiaRelevante(titulo) {
  const t = titulo.toLowerCase();

  if (PALAVRAS_NUCLEO_OFFSHORE.some(p => t.includes(p))) return true;
  if (PALAVRAS_CADEIA_ENERGIA.some(p => t.includes(p))) return true;

  const temGatilhoAmplo = GATILHOS_AMPLOS_COM_CONTEXTO.some(p => t.includes(p));
  const temContextoEnergia = CONTEXTO_ENERGIA_OBRIGATORIO.some(p => t.includes(p));
  return temGatilhoAmplo && temContextoEnergia;
}

/* =========================
   SUPABASE
========================= */

async function noticiaJaExiste(env, originalUrl) {
  const endpoint =
    `${env.SUPABASE_URL}/rest/v1/articles` +
    `?select=id&original_url=eq.${encodeURIComponent(originalUrl)}&limit=1`;

  const resposta = await fetch(endpoint, {
    headers: supabaseHeaders(env)
  });

  if (!resposta.ok) {
    throw new Error(
      `Erro Supabase ao verificar duplicidade: ${resposta.status}`
    );
  }

  const dados = await resposta.json();


  return dados.length > 0;
}

async function inserirArtigo(env, artigo) {
  const resposta = await fetch(
    `${env.SUPABASE_URL}/rest/v1/articles`,
    {
      method: "POST",

      headers: {
        ...supabaseHeaders(env),
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },

      body: JSON.stringify(artigo)
    }
  );

  if (!resposta.ok) {
    const detalhe = await resposta.text();

    throw new Error(
      `Erro Supabase ao inserir: ${resposta.status} ${detalhe}`
    );
  }
}

async function atualizarArtigo(env, originalUrl, dados) {
  const resposta = await fetch(
    `${env.SUPABASE_URL}/rest/v1/articles?original_url=eq.${encodeURIComponent(originalUrl)}`,
    {
      method: "PATCH",
      headers: {
        ...supabaseHeaders(env),
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(dados)
    }
  );

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(
      `Erro Supabase ao atualizar: ${resposta.status} ${detalhe}`
    );
  }
}

function supabaseHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
  };
}

function validarAmbiente(env) {
  if (!env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL não configurada");
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  }
}

/* =========================
   UTILITÁRIOS
========================= */

async function baixarPagina(url) {
  const resposta = await fetch(url, {
    headers: {
      "User-Agent": "OWNews/1.0 - OffshoreWorks news collector",
      Accept: "text/html,application/xhtml+xml"
    }
  });

  if (!resposta.ok) {
    throw new Error(`${url} respondeu HTTP ${resposta.status}`);
  }

  return resposta.text();
}

async function sha256(texto) {
  const dados = new TextEncoder().encode(texto);

  const hash =
    await crypto.subtle.digest("SHA-256", dados);

  return [...new Uint8Array(hash)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function adicionarUnico(lista, item) {
  if (!lista.some(x => x.url === item.url)) {
    lista.push(item);
  }
}

function meta(html, propriedade) {
  const p = escapeRegex(propriedade);

  const regex1 = new RegExp(
    `<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']*)["'][^>]*>`,
    "i"
  );

  const regex2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${p}["'][^>]*>`,
    "i"
  );

  const match =
    html.match(regex1) ||
    html.match(regex2);

  return match
    ? decodeHtml(match[1])
    : "";
}

function limparTexto(texto) {
  return decodeHtml(
    String(texto || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decodeHtml(texto) {
  return String(texto || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Entidades numéricas (ex.: EPE usa &#225; pra "á", &#227; pra "ã" etc.)
    // — ANP/Petrobras/MME não usam esse formato, então isso é puramente
    // aditivo e não muda o comportamento deles.
    .replace(/&#(\d+);/g, (_, cod) => String.fromCharCode(parseInt(cod, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, cod) => String.fromCharCode(parseInt(cod, 16)));
}

function escapeRegex(texto) {
  return texto.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

async function consultarAeroportos(env) {
  if (!env.REDEMET_API_KEY) {
    throw new Error("REDEMET_API_KEY não configurada");
  }

  const url =
    "https://api-redemet.decea.mil.br/aerodromos/status/localidades/SBJR,SBMI,SBCB,SBME,SBFS,SBVT?api_key=" +
    encodeURIComponent(env.REDEMET_API_KEY);

  const resposta = await fetch(url);

  if (!resposta.ok) {
    throw new Error("REDEMET respondeu HTTP " + resposta.status);
  }

  const dados = await resposta.json();

const lista = dados?.data || dados?.aeroportos?.data || dados;
const aeroportosComClima = Array.isArray(lista)
  ? lista.map((aeroporto) => {
      const metar = Array.isArray(aeroporto)
        ? (aeroporto.find((item) =>
            typeof item === "string" && item.includes("METAR")
          ) || "")
        : (
            aeroporto.metar ||
            aeroporto.mens ||
            aeroporto.message ||
            aeroporto.raw_text ||
            ""
          );

      return {
        dados: aeroporto,
        clima: interpretarMetar(metar)
      };
    })
  : lista;

  return {
    ok: true,
    fonte: "REDEMET / DECEA",
   aeroportos: aeroportosComClima
  };
}

function interpretarMetar(metar) {
  const bruto = String(metar || "").toUpperCase();

  // Isola somente o METAR, sem TAF e mensagens adicionais
 const inicioMetar = bruto.indexOf("METAR ");
const inicioSpeci = bruto.indexOf("SPECI ");

let texto = inicioMetar >= 0
  ? bruto.slice(inicioMetar + 6)
  : inicioSpeci >= 0
    ? bruto.slice(inicioSpeci + 6)
    : bruto;

  // Remove tudo depois do fim da observação atual
const fimObservacao = texto.search(/(?:\\N|\n)(?:TAF|NÃO)/i);

if (fimObservacao >= 0) {
  texto = texto.slice(0, fimObservacao);
}

  texto = texto.trim();

  const grupos = texto.split(/\s+/).filter(Boolean);

  // Temperatura / ponto de orvalho: 25/21, M02/M05 etc.
  let temperatura = null;

  const tempGrupo = grupos.find((g) =>
    /^(M?\d{2})\/(M?\d{2})$/.test(g)
  );

  if (tempGrupo) {
    const temp = tempGrupo.split("/")[0];

    temperatura = temp.startsWith("M")
      ? -Number(temp.slice(1))
      : Number(temp);
  }

  // Visibilidade
  let visibilidade = null;

  const visGrupo = grupos.find((g) =>
    /^\d{4}$/.test(g)
  );

  if (visGrupo) {
    const metros = Number(visGrupo);

    visibilidade =
      metros >= 9999
        ? "10+ km"
        : (metros / 1000).toFixed(1).replace(".0", "") + " km";
  }

  // Fenômenos meteorológicos usando grupos completos
  const trovoada = grupos.some((g) =>
    /^[-+]?(TS|TSRA|VCTS)$/.test(g)
  );

  const chuva = grupos.some((g) =>
    /^[-+]?(RA|DZ|SHRA)$/.test(g)
  );

  const nevoa = grupos.some((g) =>
    /^(FG|BR|HZ|MIFG|BCFG|FZFG)$/.test(g)
  );

  const ovc = grupos.some((g) => /^OVC\d{3}/.test(g));
  const bkn = grupos.some((g) => /^BKN\d{3}/.test(g));
  const sct = grupos.some((g) => /^SCT\d{3}/.test(g));
  const few = grupos.some((g) => /^FEW\d{3}/.test(g));

  let icone = "☀️";
  let tempo = "Céu claro";

  if (trovoada) {
    icone = "⛈️";
    tempo = "Trovoada";
  } else if (chuva) {
    icone = "🌧️";
    tempo = "Chuva";
  } else if (nevoa) {
    icone = "🌫️";
    tempo = "Névoa";
  } else if (ovc || bkn) {
    icone = "☁️";
    tempo = "Nublado";
  } else if (sct) {
    icone = "🌤️";
    tempo = "Parcialmente nublado";
  } else if (few) {
    icone = "🌤️";
    tempo = "Poucas nuvens";
  }

  // Horário da observação METAR
  let horarioUTC = null;

  const horaGrupo = grupos.find((g) =>
    /^\d{6}Z$/.test(g)
  );

  if (horaGrupo) {
    horarioUTC =
      horaGrupo.slice(2, 4) +
      ":" +
      horaGrupo.slice(4, 6) +
      " UTC";
  }

  return {
    temperatura,
    visibilidade,
    icone,
    tempo,
    horarioUTC
  };
}
