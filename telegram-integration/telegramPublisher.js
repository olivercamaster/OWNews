/* =========================================================================
   OWNews | Radar Offshore — módulo de publicação (PREPARAÇÃO, INATIVO)
   =========================================================================

   Nada aqui está ativo. Este arquivo NÃO está importado por nenhum Worker
   em produção (nem o collector shrill-pond-a915, nem o frontend
   producao-ownews-git). Existe só como módulo pronto, testado com mocks,
   pra quando a ativação for autorizada (ver TELEGRAM_SETUP.md).

   Reescrito em 2026-09-16 para virar um radar de produção com qualidade
   editorial (score determinístico, categorias, limite de frequência,
   tolerância a falhas) — sem nenhuma automação ativada por isso. O
   primeiro post de teste manual (2026-09-16, artigo Petrobras/Sempra) já
   confirmou bot + canal + formatação + link + imagem funcionando de
   verdade; esta reescrita refina o que já funcionou, não troca a base.

   Este módulo NUNCA chama a API real do Telegram enquanto:
   - env.TELEGRAM_BOT_TOKEN ou env.TELEGRAM_CHANNEL_ID não existirem; OU
   - env.TELEGRAM_DRY_RUN não for explicitamente "false".

   Arquitetura do fluxo:

     artigo publicado no Supabase
       -> avaliarElegibilidade()      [score editorial, nunca "tudo"]
       -> verificarDuplicidade()      [nunca repete o mesmo artigo]
       -> avaliarJanelaDeEnvio()      [limite diário + intervalo mínimo]
       -> verificarUrlOwnews()        [nunca aponta pra link quebrado/local]
       -> formatarPost()              [HTML seguro, sem clickbait]
       -> prepararEnvio()             [decide imagem+legenda ou só texto]
       -> publicar()                  [só executa I/O real fora de dry-run]

   Nenhuma função aqui lê nem grava em nenhuma tabela do Supabase de
   verdade — quem chamar este módulo é responsável por passar o histórico
   já carregado (ver schema_dedupe.sql — proposta, NÃO executada) e por
   persistir o resultado. Requisito de segurança pra quem for integrar de
   verdade: gravar o resultado no Supabase IMEDIATAMENTE após cada
   publicar() bem-sucedido, artigo por artigo (nunca em lote no final) —
   é o que evita duplicata se o processo cair no meio do lote.
========================================================================= */

/* ---------- 0) Categorias ----------
   Só exibida na frente do título quando o conteúdo bate com uma categoria
   específica — nunca um rótulo genérico "Brasil"/"Mundo" só pra preencher
   espaço. Ordem importa: a primeira categoria que bater é usada. */
const CATEGORIAS_TELEGRAM = [
  { nome: "PETROBRAS", palavras: ["petrobras"] },
  {
    nome: "OFFSHORE",
    palavras: [
      "offshore", "fpso", "navio-plataforma", "plataforma", "sonda",
      "pré-sal", "pre-sal", "subsea", "perfuração", "perfuracao",
      "águas profundas", "aguas profundas", "margem equatorial"
    ]
  },
  {
    nome: "PETRÓLEO & GÁS",
    palavras: [
      "petróleo", "petroleo", "gás natural", "gas natural", "exploração",
      "exploracao", "bacia", "poço", "poco", "hidrocarbonetos"
    ]
  },
  {
    nome: "COMBUSTÍVEIS",
    palavras: [
      "combustível", "combustivel", "combustíveis", "combustiveis",
      "gasolina", "diesel", "etanol", "glp", "qav", "refino", "refinaria",
      "posto de combustível", "posto de combustivel"
    ]
  },
  {
    nome: "ENERGIA",
    palavras: [
      "energia", "eólica", "eolica", "transição energética",
      "transicao energetica", "hidrogênio", "hidrogenio", "biocombustível",
      "biocombustivel", "matriz energética", "matriz energetica"
    ]
  },
  {
    nome: "MERCADO",
    palavras: [
      "royalties", "participação especial", "participacao especial",
      "leilão", "leilao", "concessão", "concessao", "licitação",
      "licitacao", "brent", "wti", "opep"
    ]
  },
  {
    nome: "CARREIRAS",
    palavras: ["vaga", "vagas", "currículo", "curriculo", "emprego offshore", "carreira offshore"]
  },
  {
    nome: "EMPRESAS",
    palavras: ["fusão", "fusao", "aquisição", "aquisicao", "joint venture"]
  }
];

function detectarCategoria(artigo) {
  const texto = ((artigo.title || "") + " " + (artigo.summary || "")).toLowerCase();
  for (const cat of CATEGORIAS_TELEGRAM) {
    if (cat.palavras.some((p) => texto.includes(p))) return cat.nome;
  }
  return null;
}

/* ---------- 1) Filtro editorial + score (conteúdo, não só fonte) ----------
   Exclusão binária primeiro (nunca entra, seja qual for a fonte) e depois
   soma de pontos por prioridade. Uma notícia da ANTAQ pode pontuar alto
   (leilão, concessão de porto relevante); uma da Petrobras pode ser
   excluída (agenda, cerimônia) — o filtro lê o texto, não confia cegamente
   na fonte. */

const PALAVRAS_EXCLUSAO_RADAR = [
  "pauta da reunião", "pauta da reuniao", "ata da reunião", "ata da reuniao",
  "aviso de pauta", "inscrições para participação virtual",
  "inscricoes para participacao virtual", "vem aí o", "vem ai o",
  "convite para",
  // achado testando com título real da ANTAQ ("ANTAQ define audiência
  // pública sobre concessão...") que passava no filtro antigo (só pegava
  // frases exatas demais) — audiência pública é sempre procedural (aviso
  // de que vai HAVER uma consulta/audiência), nunca a decisão em si, então
  // é excluída de forma genérica, não só em frases específicas.
  "audiência pública", "audiencia publica", "consulta pública",
  "consulta publica",
  "cerimônia", "cerimonia",
  "visita técnica", "visita tecnica", "protocolo de intenções",
  "protocolo de intencoes",
  // achado na calibração de 2026-09-16: "XXXIII Cooperaportos aborda..."
  // pontuava 8 (só por "porto"/"portos") e passava — é o nome de um evento
  // institucional recorrente da ANTAQ, não notícia. Generalizado de
  // "encontro cooperaportos" pra qualquer menção a "cooperaportos".
  "cooperaportos",
  "reunião ordinária", "reuniao ordinaria", "reunião participativa",
  "reuniao participativa"
];

const PONTUACAO_ALTA = [
  "descoberta", "recorde", "maior da história", "maior da historia",
  "contrato de longo prazo", "novo campo", "entra em operação",
  "entra em operacao", "início de produção", "inicio de producao",
  "investimento", "bilhão", "bilhões", "bilhao", "bilhoes",
  "acidente", "explosão", "explosao", "vazamento", "incidente confirmado",
  "greve", "sanção", "sancao", "sanções", "sancoes", "opep",
  "corte de produção", "corte de producao", "aprovação", "aprovacao",
  "aprovada", "aprovado", "mudança regulatória", "mudanca regulatoria",
  "nova resolução", "nova resolucao", "fusão", "fusao", "aquisição",
  "aquisicao",
  // calibração de 2026-09-16: mudança real de preço/abastecimento/política
  // de combustíveis deve pontuar alto — só o boletim rotineiro de preços
  // (sem nenhuma dessas palavras) continua baixo, de propósito.
  "reajuste", "reajusta", "alta do preço", "alta do preco",
  "queda do preço", "queda do preco", "aumento do preço",
  "aumento do preco", "redução do preço", "reducao do preco",
  "novo preço dos combustíveis", "novo preco dos combustiveis",
  "desabastecimento", "risco de desabastecimento", "racionamento",
  "mudança na política de preços", "mudanca na politica de precos"
];

const PONTUACAO_NORMAL = [
  "leilão", "leilao", "arremata", "petrobras", "fpso", "plataforma",
  "sonda", "pré-sal", "pre-sal", "produção", "producao", "exploração",
  "exploracao", "combustível", "combustivel", "combustíveis",
  "combustiveis", "gasolina", "diesel", "brent", "wti", "porto", "portos",
  "subsea", "perfuração", "perfuracao", "energia", "tecnologia offshore",
  "transição energética", "transicao energetica", "currículo",
  "curriculo", "carreira offshore", "royalties", "concessão", "concessao"
];

const LIMIAR_MINIMO_ELEGIVEL = 8;
const LIMIAR_PRIORIDADE_MUITO_ALTA = 20; // pode furar intervalo mínimo (raro)
const LIMIAR_QUINTO_POST_EXCECIONAL = 16; // só isso justifica o 5º post do dia

/**
 * Avalia se um artigo é elegível para o Radar Offshore. Retorna
 * { elegivel, motivo, pontuacao, categoria, prioridadeMuitoAlta }.
 * Nunca lança exceção; o padrão é excluir o que não tiver sinal claro de
 * relevância — "publicar tudo" nunca é o comportamento padrão.
 */
function avaliarElegibilidade(artigo) {
  const titulo = (artigo.title || "").toLowerCase();
  const resumo = (artigo.summary || "").toLowerCase();
  const texto = titulo + " " + resumo;
  const categoria = detectarCategoria(artigo);

  const excluido = PALAVRAS_EXCLUSAO_RADAR.find((p) => texto.includes(p));
  if (excluido) {
    return { elegivel: false, motivo: `excluído por conteúdo de baixo valor editorial ("${excluido}")`, pontuacao: 0, categoria };
  }

  let pontuacao = 0;
  for (const p of PONTUACAO_ALTA) if (texto.includes(p)) pontuacao += 10;
  for (const p of PONTUACAO_NORMAL) if (texto.includes(p)) pontuacao += 4;

  if (pontuacao < LIMIAR_MINIMO_ELEGIVEL) {
    return { elegivel: false, motivo: `pontuação ${pontuacao} abaixo do limiar mínimo (${LIMIAR_MINIMO_ELEGIVEL})`, pontuacao, categoria };
  }

  return {
    elegivel: true,
    motivo: "pontuação suficiente",
    pontuacao,
    categoria,
    prioridadeMuitoAlta: pontuacao >= LIMIAR_PRIORIDADE_MUITO_ALTA
  };
}

/* ---------- 2) Deduplicação ----------
   Comparação em memória — quem chama busca o histórico (ver
   schema_dedupe.sql, proposta NÃO executada) antes de chamar isto. */
function verificarDuplicidade(artigo, idsJaPublicados) {
  const jaPublicado = (idsJaPublicados || []).includes(artigo.id);
  return { duplicado: jaPublicado };
}

/* ---------- 3) Resumo seguro (preservado da correção de 2026-09-16) ----------
   Hierarquia: (1) summary real, se não for o fallback genérico conhecido do
   collector; (2) trecho factual extraído do content, só se for prosa real
   (nunca menu/JS, nunca legenda de foto sem pontuação); (3) nenhum resumo —
   título + link apenas. Nunca inventa, nunca interpreta além do texto. */

const RESUMOS_GENERICOS_CONHECIDOS = [
  "Informação publicada pela Agência Petrobras sobre atividades e projetos do setor de energia, petróleo e gás.",
  "Informação publicada pela Agência Nacional do Petróleo, Gás Natural e Biocombustíveis sobre o setor de petróleo e gás."
];

function ehResumoGenerico(resumo) {
  const t = limparEspacos(resumo);
  if (!t) return true;
  if (RESUMOS_GENERICOS_CONHECIDOS.includes(t)) return true;
  return /^Informação publicada pela Agência/i.test(t);
}

const MARCADORES_RUIDO_CONTEUDO = [
  "queryselector", "addeventlistener", "classlist", "aria-expanded",
  "aria-label", "fragmentelement", "getattribute", "settimeout",
  "cursor:pointer", "display-none", "faça uma busca", "página inicial",
  "share facebook", "share twitter", "copiar texto", "menu-dropdown",
  "submenuitens", "portlet-body", "const ", "=>", "send e-mail",
  "uso deste material é autorizado apenas para fins editoriais"
];

function pareceRuidoDeCodigoOuMenu(bloco) {
  const t = bloco.toLowerCase();
  if (MARCADORES_RUIDO_CONTEUDO.some((m) => t.includes(m))) return true;
  const simbolos = (bloco.match(/[{}();=]/g) || []).length;
  return simbolos / bloco.length > 0.03;
}

function extrairResumoFactual(content) {
  if (!content) return null;
  const blocos = String(content).split(/\n{2,}/).map((b) => limparEspacos(b)).filter(Boolean);

  let blocoAnterior = "";
  for (const bloco of blocos) {
    let candidato = bloco;
    if (blocoAnterior && candidato.startsWith(blocoAnterior)) {
      candidato = candidato.slice(blocoAnterior.length).trim();
    }
    blocoAnterior = bloco;

    if (candidato.length < 60) continue;
    if (pareceRuidoDeCodigoOuMenu(candidato)) continue;

    const frases = candidato.match(/[^.!?]+[.!?]+/g);
    if (!frases) continue;

    let resumo = frases.slice(0, 2).join(" ").trim();
    if (resumo.length > 280) resumo = frases.slice(0, 1).join(" ").trim();
    if (resumo.length >= 40) return resumo;
  }
  return null;
}

function obterResumoSeguro(artigo) {
  const summary = limparEspacos(artigo.summary || "");
  if (summary && !ehResumoGenerico(summary)) {
    return { resumo: summary.slice(0, 220), fonte: "summary" };
  }

  const extraido = extrairResumoFactual(artigo.content);
  if (extraido) {
    return { resumo: extraido.slice(0, 280), fonte: "conteudo_extraido" };
  }

  return { resumo: null, fonte: "indisponivel" };
}

function limparEspacos(t) {
  return String(t || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/* ---------- 4) Formatação — HTML seguro do Telegram (parse_mode: "HTML") ----------
   Só o título vai em <b>...</b>; todo texto interpolado é escapado antes,
   pra nunca quebrar o post nem injetar HTML indevido vindo da fonte. */

function escaparHtmlTelegram(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const TAMANHO_MAX_LEGENDA_FOTO = 1024; // limite real da API do Telegram
const TAMANHO_MAX_MENSAGEM_TEXTO = 4096;

function formatarPost(artigo, urlCanonica, opts) {
  const categoria = (opts && opts.categoria) || detectarCategoria(artigo);
  const titulo = escaparHtmlTelegram(limparEspacos(artigo.title || ""));
  const { resumo } = (opts && opts.semResumo) ? { resumo: null } : obterResumoSeguro(artigo);
  const linhaCategoria = categoria ? `${escaparHtmlTelegram(categoria)}\n\n` : "";
  const linhaLink = `Leia no OWNews →\n${urlCanonica}`;

  let texto = resumo
    ? `${linhaCategoria}<b>${titulo}</b>\n\n${escaparHtmlTelegram(resumo)}\n\n${linhaLink}`
    : `${linhaCategoria}<b>${titulo}</b>\n\n${linhaLink}`;

  // Segurança de tamanho: nunca corta no meio de uma tag HTML — se precisar
  // encurtar, corta o resumo antes de remontar, nunca o texto já montado.
  if (texto.length > TAMANHO_MAX_MENSAGEM_TEXTO) {
    const semResumo = `${linhaCategoria}<b>${titulo}</b>\n\n${linhaLink}`;
    texto = semResumo.length <= TAMANHO_MAX_MENSAGEM_TEXTO ? semResumo : semResumo.slice(0, TAMANHO_MAX_MENSAGEM_TEXTO);
  }

  return texto;
}

/* ---------- 5) Imagem válida (preservado da correção de 2026-09-16) ---------- */
const PADROES_IMAGEM_INVALIDA = [
  /placeholder/i,
  /default/i,
  /favicon/i,
  /\bsprite\b/i,
  /\bicon\b/i,
  /\blogo\b/i,
  /_layouts\/\d+\/images\//i,
  /spcommon\.png/i
];

function imagemEditorialValida(url) {
  if (!url) return false;
  return !PADROES_IMAGEM_INVALIDA.some((re) => re.test(url));
}

/* ---------- 6) URL de destino válida ----------
   O Telegram só pode apontar pra um link do OWNews em produção — nunca
   localhost, preview, IP interno ou URL malformada. */
function verificarUrlOwnews(urlCanonica) {
  try {
    const u = new URL(urlCanonica);
    if (u.protocol !== "https:") return { valida: false, motivo: "URL não é https" };
    if (u.hostname !== "ownews.com.br") return { valida: false, motivo: `host inesperado: ${u.hostname}` };
    if (u.pathname !== "/noticia") return { valida: false, motivo: `caminho inesperado: ${u.pathname}` };
    if (!u.searchParams.get("id")) return { valida: false, motivo: "sem parâmetro id" };
    return { valida: true };
  } catch {
    return { valida: false, motivo: "URL malformada" };
  }
}

function prepararEnvio(artigo, urlCanonica) {
  const categoria = detectarCategoria(artigo);
  const texto = formatarPost(artigo, urlCanonica, { categoria });
  const imagemUtilizavel = imagemEditorialValida(artigo.image_url);

  if (imagemUtilizavel) {
    let legenda = texto;
    if (legenda.length > TAMANHO_MAX_LEGENDA_FOTO) {
      // sem imagem cabe mais texto; com imagem, a legenda é limitada —
      // cai pra versão só com título+link em vez de truncar no meio da tag
      legenda = formatarPost(artigo, urlCanonica, { categoria, semResumo: true }).slice(0, TAMANHO_MAX_LEGENDA_FOTO);
    }
    return { tipo: "foto", imagemUrl: artigo.image_url, legenda, categoria };
  }
  return { tipo: "texto", texto, categoria };
}

/* ---------- 7) Publicação real (só executa I/O fora de dry-run) ----------
   Timeout, 429 (rate limit), 4xx/5xx tratados como erros distintos e
   sempre propagados como erro (nunca marcado como "enviado" sem confirmar
   sucesso real da API). Nunca imprime o token — só "presente: sim/não". */

const TIMEOUT_MS = 10000;

async function fetchComTimeout(url, opcoes) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opcoes, signal: controller.signal });
  } catch (erro) {
    if (erro.name === "AbortError") {
      throw new Error(`Timeout (${TIMEOUT_MS}ms) chamando a API do Telegram`);
    }
    throw erro;
  } finally {
    clearTimeout(timer);
  }
}

async function interpretarRespostaTelegram(resposta, contexto) {
  if (resposta.ok) return resposta.json();

  if (resposta.status === 429) {
    let retryAfter;
    try {
      const corpo = await resposta.json();
      retryAfter = corpo?.parameters?.retry_after;
    } catch {
      /* corpo não veio em JSON — segue sem retry_after */
    }
    const erro = new Error(`Telegram (${contexto}): rate limit (429)${retryAfter ? `, retry_after=${retryAfter}s` : ""}`);
    erro.tipo = "rate_limit";
    erro.retryAfter = retryAfter;
    throw erro;
  }

  if (resposta.status >= 500) {
    const erro = new Error(`Telegram (${contexto}): erro do lado do Telegram (HTTP ${resposta.status})`);
    erro.tipo = "erro_servidor_telegram";
    throw erro;
  }

  const erro = new Error(`Telegram (${contexto}) respondeu HTTP ${resposta.status}`);
  erro.tipo = "erro_cliente";
  throw erro;
}

function extrairCamposSeguros(dados) {
  return {
    messageId: dados?.result?.message_id,
    chat: dados?.result?.chat
      ? { id: dados.result.chat.id, title: dados.result.chat.title, username: dados.result.chat.username }
      : undefined
  };
}

async function publicar(payload, env, logger) {
  const log = logger || console;
  const dryRun = env.TELEGRAM_DRY_RUN !== "false"; // padrão seguro: dry-run

  if (dryRun) {
    log.info?.("[TELEGRAM DRY_RUN] Nenhum envio real feito.", {
      tipo: payload.tipo,
      tamanhoTexto: (payload.texto || payload.legenda || "").length,
      temImagem: payload.tipo === "foto"
    });
    return { ok: true, dryRun: true, enviado: false };
  }

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHANNEL_ID) {
    throw new Error(
      "Telegram não configurado: faltam TELEGRAM_BOT_TOKEN e/ou TELEGRAM_CHANNEL_ID. Nenhuma mensagem foi enviada."
    );
  }

  const base = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

  if (payload.tipo === "foto") {
    return fetchComFallback(base, payload, env);
  }

  const resposta = await fetchComTimeout(`${base}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHANNEL_ID, text: payload.texto, parse_mode: "HTML" })
  });
  const dados = await interpretarRespostaTelegram(resposta, "sendMessage");
  return { ok: true, dryRun: false, enviado: true, tipo: "texto", ...extrairCamposSeguros(dados) };
}

/* Tenta enviar com foto; se falhar (imagem inválida, erro da API, timeout,
   etc.), cai para texto puro em vez de falhar a publicação inteira. Erros
   de rate limit (429) e 5xx NÃO caem em fallback — são passados adiante
   como erro, pra não mascarar um problema temporário como se fosse imagem
   ruim (evita reenvio duplicado por interpretação errada da causa). */
async function fetchComFallback(base, payload, env) {
  try {
    const resposta = await fetchComTimeout(`${base}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHANNEL_ID,
        photo: payload.imagemUrl,
        caption: payload.legenda,
        parse_mode: "HTML"
      })
    });
    const dados = await interpretarRespostaTelegram(resposta, "sendPhoto");
    return { ok: true, dryRun: false, enviado: true, tipo: "foto", ...extrairCamposSeguros(dados) };
  } catch (erroFoto) {
    if (erroFoto.tipo === "rate_limit" || erroFoto.tipo === "erro_servidor_telegram") {
      throw erroFoto; // não é problema de imagem — propaga, sem fallback
    }

    const resposta = await fetchComTimeout(`${base}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHANNEL_ID, text: payload.legenda, parse_mode: "HTML" })
    });
    const dados = await interpretarRespostaTelegram(resposta, "sendMessage (fallback de foto)");
    return {
      ok: true, dryRun: false, enviado: true, tipo: "texto",
      fallbackDeFoto: true, motivoFallback: erroFoto.message,
      ...extrairCamposSeguros(dados)
    };
  }
}

/* ---------- 8) Controle de frequência (anti-spam) ----------
   Conservador por padrão: 4 posts/dia normal, 5º só se muito relevante;
   intervalo mínimo de 2h; prioridade muito alta pode furar o intervalo,
   mas só 1x por dia (regra explícita de raridade). Funções puras — quem
   chama monta o "estado" a partir do histórico persistido (ver
   schema_dedupe.sql). Nada aqui lê o Supabase diretamente. */

const LIMITE_NORMAL_POR_DIA = 4;
const LIMITE_EXCEPCIONAL_POR_DIA = 5;
const INTERVALO_MINIMO_MS = 2 * 60 * 60 * 1000; // 2 horas

/**
 * Deriva o estado do dia a partir do histórico bruto (rows de
 * telegram_posts com status = 'published'). Puro, sem I/O.
 */
function computarEstadoEnvios(historicoPublicados, agora) {
  const inicioDoDia = new Date(agora);
  inicioDoDia.setUTCHours(0, 0, 0, 0);
  const inicioDoDiaMs = inicioDoDia.getTime();

  const doDia = (historicoPublicados || []).filter((h) => new Date(h.published_at).getTime() >= inicioDoDiaMs);
  const ultimo = (historicoPublicados || [])
    .slice()
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0];

  return {
    enviadosHoje: doDia.length,
    ultimoEnvioEm: ultimo ? new Date(ultimo.published_at).getTime() : null,
    jaFurouIntervaloHoje: doDia.some((h) => h.furou_intervalo === true)
  };
}

/**
 * Decide se o candidato pode ser enviado AGORA, dado o estado do dia.
 * Retorna { permitido, motivo, furouIntervalo }.
 */
function avaliarJanelaDeEnvio(estado, agora, candidato) {
  if (estado.enviadosHoje >= LIMITE_EXCEPCIONAL_POR_DIA) {
    return { permitido: false, motivo: `limite diário excepcional (${LIMITE_EXCEPCIONAL_POR_DIA}) já atingido` };
  }

  if (estado.enviadosHoje >= LIMITE_NORMAL_POR_DIA) {
    if (candidato.pontuacao < LIMIAR_QUINTO_POST_EXCECIONAL) {
      return { permitido: false, motivo: `limite normal diário (${LIMITE_NORMAL_POR_DIA}) atingido e notícia não é excepcional o bastante para o 5º post` };
    }
  }

  if (estado.ultimoEnvioEm !== null) {
    const desdeUltimo = agora - estado.ultimoEnvioEm;
    if (desdeUltimo < INTERVALO_MINIMO_MS) {
      if (candidato.prioridadeMuitoAlta && !estado.jaFurouIntervaloHoje) {
        return { permitido: true, motivo: "furou o intervalo mínimo por prioridade muito alta (raro, 1x/dia)", furouIntervalo: true };
      }
      const minutosFaltando = Math.ceil((INTERVALO_MINIMO_MS - desdeUltimo) / 60000);
      return { permitido: false, motivo: `intervalo mínimo de 2h ainda não passou (faltam ~${minutosFaltando}min)` };
    }
  }

  return { permitido: true, motivo: "dentro dos limites de frequência", furouIntervalo: false };
}

/* Utilitário independente (não usado no fluxo principal desde a calibração
   de 2026-09-16 — ver processarArtigosParaTelegram): útil pra quem quiser
   só "os N melhores candidatos" pra revisão manual, por exemplo. O corte
   real de quantos são enviados de verdade é feito por avaliarJanelaDeEnvio
   (relevância + intervalo + limite diário), nunca por uma posição fixa no
   lote. */
function selecionarParaPublicarAgora(candidatosElegiveis, maxPorExecucao) {
  const limite = maxPorExecucao || 1;
  return candidatosElegiveis
    .slice()
    .sort((a, b) => (b.pontuacao || 0) - (a.pontuacao || 0))
    .slice(0, limite);
}

// Um candidato elegível que nunca conseguiu furar o intervalo/limite fica
// "aguardando_intervalo" indefinidamente enquanto continuar aparecendo na
// lista de artigos de quem chama. Isso é limitado por essa expiração: passado
// esse tempo sem ter sido enviado, o candidato é descartado por idade, não
// fica pra sempre na fila. Calibrado em 2026-09-16 a pedido explícito
// ("candidato não pode ficar velho indefinidamente na fila").
const LIMITE_IDADE_CANDIDATO_HORAS = 48;

/* ---------- 9) Orquestrador ----------
   `historicoPublicados`: array de { article_id, published_at, furou_intervalo }
   já publicados de verdade (status='published'), vindo do Supabase — quem
   chama busca isso antes. `agora`: timestamp injetável (testabilidade).

   Calibrado em 2026-09-16: antes, só o candidato de maior pontuação de cada
   lote era considerado ("1 por execução") e todo o resto virava "adiado"
   permanentemente dentro daquela chamada — mesmo notícias boas do mesmo
   lote eram descartadas de fato. Agora TODOS os candidatos elegíveis (não
   só o melhor) passam pela mesma avaliação de janela, em ordem de
   pontuação; o próprio intervalo mínimo de 2h já garante que no máximo 1
   envio de verdade aconteça por execução (não dá pra mandar dois "no mesmo
   instante" respeitando o espaçamento) — os demais ficam
   "aguardando_intervalo": continuam elegíveis, não são descartados, e
   podem ser enviados numa execução futura assim que o intervalo abrir
   (desde que ainda não tenham expirado — ver LIMITE_IDADE_CANDIDATO_HORAS).

   Estados finais possíveis por artigo:
   - "ja_publicado"         — já enviado antes (dedupe)
   - "descartado_editorial" — não passou no filtro de relevância (score/exclusão)
   - "expirado"             — era elegível, mas envelheceu demais na fila
   - "aguardando_intervalo" — elegível, mas intervalo/limite diário ainda não abrem
   - "dry_run" / "publicado"— efetivamente enviado (simulado ou real)
   - "erro"                 — falha de URL/API; nunca marcado como enviado */
async function processarArtigosParaTelegram(artigos, historicoPublicados, urlBase, env, logger, agora) {
  const momento = agora || Date.now();
  const idsJaPublicados = (historicoPublicados || []).map((h) => h.article_id);
  const estado = computarEstadoEnvios(historicoPublicados, momento);

  const resultados = [];
  const candidatos = [];

  for (const artigo of artigos) {
    const dup = verificarDuplicidade(artigo, idsJaPublicados);
    if (dup.duplicado) {
      resultados.push({ articleId: artigo.id, status: "ja_publicado", motivo: "já publicado" });
      continue;
    }

    const elegibilidade = avaliarElegibilidade(artigo);
    if (!elegibilidade.elegivel) {
      resultados.push({ articleId: artigo.id, status: "descartado_editorial", motivo: elegibilidade.motivo, pontuacao: elegibilidade.pontuacao, categoria: elegibilidade.categoria });
      continue;
    }

    const idadeHoras = (momento - new Date(artigo.published_at).getTime()) / 3600000;
    if (Number.isFinite(idadeHoras) && idadeHoras > LIMITE_IDADE_CANDIDATO_HORAS) {
      resultados.push({
        articleId: artigo.id,
        status: "expirado",
        motivo: `elegível (score ${elegibilidade.pontuacao}) mas expirado — mais de ${LIMITE_IDADE_CANDIDATO_HORAS}h na fila sem ser enviado`,
        pontuacao: elegibilidade.pontuacao,
        categoria: elegibilidade.categoria
      });
      continue;
    }

    candidatos.push({ artigo, ...elegibilidade });
  }

  candidatos.sort((a, b) => (b.pontuacao || 0) - (a.pontuacao || 0));

  let enviadosNestaExecucao = 0;
  let jaFurouNestaExecucao = estado.jaFurouIntervaloHoje;
  let ultimoEnvioNestaExecucao = estado.ultimoEnvioEm;

  for (const candidato of candidatos) {
    const { artigo, pontuacao, categoria, prioridadeMuitoAlta } = candidato;
    const estadoAtual = {
      enviadosHoje: estado.enviadosHoje + enviadosNestaExecucao,
      ultimoEnvioEm: ultimoEnvioNestaExecucao,
      jaFurouIntervaloHoje: jaFurouNestaExecucao
    };
    const janela = avaliarJanelaDeEnvio(estadoAtual, momento, { pontuacao, prioridadeMuitoAlta });

    if (!janela.permitido) {
      resultados.push({ articleId: artigo.id, status: "aguardando_intervalo", motivo: janela.motivo, pontuacao, categoria });
      continue;
    }

    const urlCanonica = `${urlBase}/noticia?id=${encodeURIComponent(artigo.id)}`;
    const urlCheck = verificarUrlOwnews(urlCanonica);
    if (!urlCheck.valida) {
      resultados.push({ articleId: artigo.id, status: "erro", motivo: `URL de destino inválida: ${urlCheck.motivo}`, pontuacao, categoria });
      continue;
    }

    const payload = prepararEnvio(artigo, urlCanonica);
    try {
      const envio = await publicar(payload, env, logger);
      resultados.push({
        articleId: artigo.id,
        status: envio.dryRun ? "dry_run" : "publicado",
        pontuacao,
        categoria,
        furouIntervalo: !!janela.furouIntervalo,
        telegramMessageId: envio.messageId,
        payload: envio.dryRun ? payload : undefined
      });
      // Conta pra evolução do estado independente de dry-run ou envio real
      // — é isso que faz o 2º candidato do MESMO lote corretamente cair em
      // "aguardando_intervalo" em vez de ser descartado por um corte fixo
      // de posição no lote.
      enviadosNestaExecucao++;
      ultimoEnvioNestaExecucao = momento;
      if (janela.furouIntervalo) jaFurouNestaExecucao = true;
    } catch (erro) {
      // Nunca marca como enviado quando a API falhou — permite retry seguro
      // numa próxima execução, sem duplicar (article_id ainda não consta
      // como 'published' no histórico de quem chama).
      resultados.push({ articleId: artigo.id, status: "erro", motivo: erro.message, tipoErro: erro.tipo || "desconhecido", pontuacao, categoria });
    }
  }

  return resultados;
}

export {
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
};
