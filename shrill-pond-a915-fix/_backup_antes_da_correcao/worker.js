const ANP_URL =
  "https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados";

const PETROBRAS_URL =
  "https://agencia.petrobras.com.br/pt";

  const MME_URL =
  "https://www.gov.br/mme/pt-br/assuntos/noticias";

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

 if (url.pathname === "/aeroportos") {
  const resultado = await consultarAeroportos(env);

  return Response.json(resultado, {
    headers: {
      "Access-Control-Allow-Origin": "*"
    }
  });
}

    if (url.pathname === "/run") {
      return executarTeste(() => executarAtualizacao(env));
    }

    return Response.json({
      sistema: "OWNews Automation",
      status: "ONLINE",
      supabase_url: !!env.SUPABASE_URL,
      supabase_secret: !!env.SUPABASE_SERVICE_ROLE_KEY,
      fontes: ["ANP", "Petrobras"]
    });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(executarAtualizacao(env));
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

async function executarAtualizacao(env) {
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

  try {
  resultados.mme = await coletarMME(env);
} catch (erro) {
  resultados.mme = { ok: false, erro: erro.message };
}

  return {
    ok: true,
    sistema: "OWNews Automation",
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
/* =========================
   PETROBRAS
========================= */

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
    A Agência Petrobras pode alterar classes e estrutura visual.
    Por isso buscamos links internos e validamos pelo texto/título.
  */
  const regex =
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    let href = decodeHtml(match[1]);
    const title = limparTexto(match[2]);

    if (!title || title.length < 20) continue;

    if (
      !noticiaRelevante(title) &&
      !/petrobras|búzios|buzios|mero|plataforma|pré-sal|pre-sal/i.test(title)
    ) {
      continue;
    }

    if (href.startsWith("/")) {
      href = "https://agencia.petrobras.com.br" + href;
    }

    if (!href.startsWith("https://agencia.petrobras.com.br/")) {
      continue;
    }

    // Ignora páginas gerais de navegação.
    if (
      href === PETROBRAS_URL ||
      href.includes("/listar-editoria") ||
      href.includes("/tags/")
    ) {
      continue;
    }

    adicionarUnico(encontrados, {
      title,
      url: href,
      source: "Petrobras"
    });
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
const imagemPrincipal = extrairImagemPrincipal(html, url);

return {
  title,
  summary,
  content: conteudoExtraido || summary,
  imageUrl: imagemPrincipal,
  imageCaption: null,
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

function noticiaRelevante(titulo) {
  const t = titulo.toLowerCase();

  const palavras = [
    "petróleo",
    "petroleo",
    "óleo e gás",
    "oleo e gas",
    "gás natural",
    "gas natural",
    "exploração",
    "exploracao",
    "produção",
    "producao",
    "bloco",
    "bacia",
    "offshore",
    "pré-sal",
    "pre-sal",
    "campo",
    "poço",
    "poco",
    "plataforma",
    "navio-plataforma",
    "fpso",
    "sonda",
    "perfuração",
    "perfuracao",
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
    "aguas ultra profundas"
  ];

  return palavras.some(p => t.includes(p));
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
    .replace(/&gt;/g, ">");
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
