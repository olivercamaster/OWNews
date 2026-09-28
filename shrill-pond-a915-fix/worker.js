/* =========================================================================
   ANTI-REPETIÇÃO DE IMAGEM (Missão Contínua — Central Offshore, 2026-09-19)
   Causa raiz confirmada ao vivo: TODAS as matérias do PetroNotícias tinham
   image_url idêntica — https://www.petronoticias.com.br/wp-content/uploads/
   2017/04/pn-topo-060417.jpg — o banner/topo do SITE (não uma foto da
   matéria), porque extrairImagemPrincipal() aceita qualquer <img>/og:image
   que não bata no regex de logo/ícone, e "pn-topo" não batia. 7 matérias
   diferentes publicadas com a mesma foto amarela — reproduzido consultando
   a Supabase (articles.image_url) direto. Efeito visível: Home mostrava
   manchete + as 3 laterais, todas do PetroNotícias, com a MESMA imagem.

   Duas camadas de correção, sem inventar imagem nenhuma:
   1) Bloqueio estático — a URL específica já confirmada como banner.
   2) Bloqueio dinâmico — antes de aceitar uma image_url como "foto própria"
      de uma matéria NOVA, conta quantas matérias PUBLICADAS da MESMA fonte
      já usam essa mesma URL exata; se ≥2 (ou seja, essa seria a 3ª),
      trata como banner genérico do site e descarta (vira null). Cobre
      qualquer outro banner de template ainda não identificado por nome,
      de qualquer fonte — não é uma lista fixa por site.
   Quando a imagem é descartada aqui, o front-end já tem fallback contextual
   por categoria (BIBLIOTECA_FOTOGRAFICA_SERVIDOR) — nunca fica sem foto,
   só troca "foto errada" por "foto ilustrativa correta", que é a regra
   pedida (precisão editorial > estética, nunca foto errada só pra evitar
   repetição). */
const IMAGENS_BANNER_CONHECIDAS = new Set([
  "https://www.petronoticias.com.br/wp-content/uploads/2017/04/pn-topo-060417.jpg"
]);

async function imagemPareceBannerRepetidoDaFonte(env, imageUrl, fonte) {
  if (!imageUrl || !fonte) return false;
  if (IMAGENS_BANNER_CONHECIDAS.has(imageUrl)) return true;
  try {
    const resp = await fetch(
      `${env.SUPABASE_URL}/rest/v1/articles?select=id&image_url=eq.${encodeURIComponent(imageUrl)}&image_credit=eq.${encodeURIComponent(fonte)}&status=eq.published&limit=2`,
      { headers: supabaseHeaders(env) }
    );
    if (!resp.ok) return false; // falha de rede nunca bloqueia a coleta
    const linhas = await resp.json();
    return linhas.length >= 2;
  } catch {
    return false; // mesma regra: nunca derruba a coleta por causa disso
  }
}

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

/* =========================================================================
   SOURCE REGISTRY (P1 — Missão Growth Engine, 2026-09-19)
   =========================================================================
   Formaliza as 9 fontes JÁ integradas e testadas — não adiciona nenhuma
   fonte nova nesta rodada (ver docs/SOURCE-REGISTRY.md pro porquê: cada
   fonte nova precisa de verificação manual de estrutura/RSS/API antes de
   virar scraper, "não criar scraper frágil sem necessidade" é regra
   explícita da missão). Isto é METADADO — não substitui as funções
   coletarX() reais, que continuam sendo a lógica de verdade; o registro
   existe pra dar visibilidade (quem é cada fonte, como é coletada, com
   que prioridade) e alimentar avaliarSaudeFontes() sem precisar de
   nenhuma escrita nova em KV (reaproveita a última execução já gravada).
   grupo: em qual invocação agendada a fonte roda de verdade hoje (ver
   executarAtualizacaoPrincipal/NovasFontes/TerceiraFonte acima). */
const FONTES_REGISTRY = [
  {
    id: "anp", nome: "ANP — Agência Nacional do Petróleo, Gás Natural e Biocombustíveis",
    dominio: "gov.br", tipo: "governo", categoria: "regulador", pais: "BR", idioma: "pt",
    prioridade: "alta", confiabilidade: "oficial", metodo_coleta: "HTML scraping",
    endpoint: ANP_URL, grupo: "A", imagem_permitida: true, fonte_primaria: true
  },
  {
    id: "petrobras", nome: "Agência Petrobras",
    dominio: "agencia.petrobras.com.br", tipo: "empresa", categoria: "operadora", pais: "BR", idioma: "pt",
    prioridade: "alta", confiabilidade: "oficial", metodo_coleta: "HTML scraping",
    endpoint: PETROBRAS_URL, grupo: "A", imagem_permitida: true, fonte_primaria: true
  },
  {
    id: "ppsa", nome: "PPSA — Pré-Sal Petróleo S.A.",
    dominio: "presalpetroleo.gov.br", tipo: "governo", categoria: "operadora estatal", pais: "BR", idioma: "pt",
    prioridade: "alta", confiabilidade: "oficial", metodo_coleta: "API JSON (WordPress REST)",
    endpoint: PPSA_API_URL, grupo: "B", imagem_permitida: true, fonte_primaria: true
  },
  {
    id: "epe", nome: "EPE — Empresa de Pesquisa Energética",
    dominio: "epe.gov.br", tipo: "governo", categoria: "pesquisa/planejamento", pais: "BR", idioma: "pt",
    prioridade: "media", confiabilidade: "oficial", metodo_coleta: "HTML scraping",
    endpoint: EPE_URL, grupo: "B", imagem_permitida: true, fonte_primaria: true
  },
  {
    id: "mme", nome: "MME — Ministério de Minas e Energia",
    dominio: "gov.br", tipo: "governo", categoria: "regulador/política pública", pais: "BR", idioma: "pt",
    prioridade: "media", confiabilidade: "oficial", metodo_coleta: "HTML scraping",
    endpoint: MME_URL, grupo: "B", imagem_permitida: true, fonte_primaria: true
  },
  {
    id: "marinha", nome: "Marinha do Brasil",
    dominio: "gov.br", tipo: "governo", categoria: "autoridade marítima", pais: "BR", idioma: "pt",
    prioridade: "media", confiabilidade: "oficial", metodo_coleta: "HTML scraping",
    endpoint: "https://www.gov.br/marinha/pt-br", grupo: "B", imagem_permitida: false, fonte_primaria: true
  },
  {
    id: "antaq", nome: "ANTAQ — Agência Nacional de Transportes Aquaviários",
    dominio: "gov.br", tipo: "governo", categoria: "regulador/logística portuária", pais: "BR", idioma: "pt",
    prioridade: "media", confiabilidade: "oficial", metodo_coleta: "HTML scraping",
    endpoint: ANTAQ_URL, grupo: "B", imagem_permitida: false, fonte_primaria: true
  },
  {
    id: "ibama", nome: "IBAMA — Instituto Brasileiro do Meio Ambiente e dos Recursos Naturais Renováveis",
    dominio: "gov.br", tipo: "governo", categoria: "regulador ambiental/licenciamento", pais: "BR", idioma: "pt",
    prioridade: "media", confiabilidade: "oficial", metodo_coleta: "HTML scraping",
    endpoint: IBAMA_URL_BASE, grupo: "C", imagem_permitida: false, fonte_primaria: true
  },
  {
    id: "petronoticias", nome: "PetroNotícias",
    dominio: "petronoticias.com.br", tipo: "imprensa", categoria: "imprensa especializada", pais: "BR", idioma: "pt",
    prioridade: "media", confiabilidade: "imprensa especializada — não é fonte primária",
    metodo_coleta: "RSS", endpoint: PETRONOTICIAS_FEED_URL, grupo: "C",
    imagem_permitida: true, fonte_primaria: false
  },
  {
    // Verificadas em 2026-09-19 (Source Registry, WebSearch+WebFetch+curl):
    // RSS oficial real, sem bloqueio de bot, conteúdo relevante confirmado
    // manualmente (contratos, resultados, fleet status / FPSO em Guyana-
    // Suriname). Testadas via /run-transocean e /run-sbm-offshore antes de
    // entrar em qualquer grupo agendado — ver docs/SOURCE-REGISTRY.md.
    // imagem_permitida:false por enquanto (domínio ainda não está em
    // DOMINIOS_FOTO_PERMITIDOS do Instagram publisher — não verificado se
    // o RSS traz <enclosure>/imagem própria; decisão separada, futura).
    id: "transocean", nome: "Transocean Ltd.",
    dominio: "investor.deepwater.com", tipo: "empresa", categoria: "drilling contractor", pais: "internacional", idioma: "en",
    prioridade: "alta", confiabilidade: "oficial (IR)", metodo_coleta: "RSS",
    endpoint: TRANSOCEAN_FEED_URL, grupo: "D", imagem_permitida: false, fonte_primaria: true
  },
  {
    id: "sbm_offshore", nome: "SBM Offshore",
    dominio: "sbmoffshore.com", tipo: "empresa", categoria: "FPSO/operadora", pais: "internacional", idioma: "en",
    prioridade: "alta", confiabilidade: "oficial (newsroom)", metodo_coleta: "RSS",
    endpoint: SBM_OFFSHORE_FEED_URL, grupo: "D", imagem_permitida: false, fonte_primaria: true
  },
  {
    // Descoberta em 2026-09-19 investigando o caso Starnav Elektra (ver
    // docs/MISSION-STATE.md) — cobertura cruzada/backup de Petrobras e
    // energia, empresa pública (EBC), reduz dependência única do parser
    // do site da Petrobras. Feed mistura economia geral — não é fonte
    // primária pra assuntos offshore específicos, mas é oficial/confiável.
    id: "agencia_brasil", nome: "Agência Brasil (EBC) — Economia",
    dominio: "agenciabrasil.ebc.com.br", tipo: "governo", categoria: "imprensa pública (backup Petrobras/energia)", pais: "BR", idioma: "pt",
    prioridade: "media", confiabilidade: "oficial (empresa pública), não é fonte primária de assuntos offshore",
    metodo_coleta: "RSS", endpoint: AGENCIA_BRASIL_ECONOMIA_FEED_URL, grupo: "C",
    imagem_permitida: false, fonte_primaria: false
  },
  {
    // Sindicato dos petroleiros do Norte Fluminense — sede em Macaé, cobre
    // a Bacia de Campos. Fonte PRIMÁRIA pra suas próprias pautas/greves/
    // assembleias (é o próprio sujeito da notícia falando). Preenche o gap
    // regional explícito da missão (Macaé/Bacia de Campos nunca teve fonte
    // dedicada). Verificado em 2026-09-19: RSS real, ativo no mesmo dia.
    id: "sindipetro_nf", nome: "Sindipetro NF — Sindicato dos Petroleiros do Norte Fluminense",
    dominio: "sindipetronf.org.br", tipo: "sindicato", categoria: "sindicato regional (Bacia de Campos/Macaé)", pais: "BR", idioma: "pt",
    prioridade: "alta", confiabilidade: "fonte primária (sindicato falando de si mesmo)", metodo_coleta: "RSS",
    endpoint: SINDIPETRO_NF_FEED_URL, grupo: "C", imagem_permitida: false, fonte_primaria: true
  },
  {
    // Federação Única dos Petroleiros — federação nacional (Sindipetro NF é
    // uma de suas filiadas). Cobertura mais ampla que só Bacia de Campos,
    // mas mesma natureza sindical/trabalhista do setor.
    id: "fup", nome: "FUP — Federação Única dos Petroleiros",
    dominio: "fup.org.br", tipo: "sindicato", categoria: "federação nacional sindical (petroleiros)", pais: "BR", idioma: "pt",
    prioridade: "media", confiabilidade: "fonte primária (federação falando de si mesma)", metodo_coleta: "RSS",
    endpoint: FUP_FEED_URL, grupo: "C", imagem_permitida: false, fonte_primaria: true
  },
  {
    // Imprensa especializada em energia, cobertura de mercado (Brent/WTI),
    // regulação e Petrobras. Verificada em 2026-09-19: RSS real, conteúdo
    // publicado no mesmo dia da verificação.
    id: "eixos", nome: "Eixos",
    dominio: "eixos.com.br", tipo: "imprensa", categoria: "imprensa especializada em energia", pais: "BR", idioma: "pt",
    prioridade: "alta", confiabilidade: "imprensa especializada — não é fonte primária", metodo_coleta: "RSS",
    endpoint: EIXOS_FEED_URL, grupo: "C", imagem_permitida: false, fonte_primaria: false
  },
  {
    // Jornal local de Macaé — cobertura geral da cidade, mas a única
    // fonte que pega greve/mobilização hiperlocal da Bacia de Campos que
    // fontes nacionais não cobrem. Baixa precisão bruta (~5% relevante),
    // por isso usa noticiaRelevante() padrão (allow-list), não exclusão.
    id: "noticias_macae", nome: "Notícias Macaé",
    dominio: "noticiasmacae.com", tipo: "imprensa", categoria: "imprensa local (Macaé/Bacia de Campos)", pais: "BR", idioma: "pt",
    prioridade: "media", confiabilidade: "imprensa local — não é fonte primária", metodo_coleta: "RSS",
    endpoint: NOTICIAS_MACAE_FEED_URL, grupo: "C", imagem_permitida: false, fonte_primaria: false
  },
  {
    // Expansão 2026-09-27: a fonte de maior valor editorial das 4 novas.
    // Imprensa especializada BR (Joomla, feed com 200 itens) cobrindo
    // pré-sal, operadoras, apoio marítimo, estaleiro e portos. Teste
    // isolado real: 200 brutos → 10 relevantes → 10 inseridas, todas do
    // setor (pré-sal/Prio/OceanPact/leilão), 190 descartes legítimos de
    // pauta portuária/logística pura.
    id: "portos_navios", nome: "Portos e Navios",
    dominio: "portosenavios.com.br", tipo: "imprensa", categoria: "imprensa especializada (offshore/naval/portuário)", pais: "BR", idioma: "pt",
    prioridade: "alta", confiabilidade: "imprensa especializada — não é fonte primária", metodo_coleta: "RSS",
    endpoint: PORTOS_NAVIOS_FEED_URL, grupo: "E", imagem_permitida: false, fonte_primaria: false
  },
  {
    // Expansão 2026-09-27: pauta majoritariamente ELÉTRICA — entra só
    // como backup de Petrobras/gás (mesmo papel da Agência Brasil).
    // Rendimento baixo por desenho: no teste isolado, 10 brutos → 0
    // relevantes (feed do dia era 100% setor elétrico) — o filtro
    // descartou tudo sem custo de subrequest, exatamente o esperado.
    id: "megawhat", nome: "MegaWhat",
    dominio: "megawhat.uol.com.br", tipo: "imprensa", categoria: "imprensa de energia (backup Petrobras/gás)", pais: "BR", idioma: "pt",
    prioridade: "baixa", confiabilidade: "imprensa especializada — não é fonte primária", metodo_coleta: "RSS",
    endpoint: MEGAWHAT_FEED_URL, grupo: "E", imagem_permitida: false, fonte_primaria: false
  },
  {
    // Expansão 2026-09-27: melhor fonte internacional testada — 100%
    // dedicada a offshore (O&G + eólica offshore + subsea), feed diário.
    // Teste isolado: 10 brutos → 7 relevantes → 7 inseridas, incluindo
    // pauta com gancho BR ("Petrobras and ENH forge oil & gas
    // partnership"). Usa noticiaRelevanteImprensaEn() (allow-list).
    id: "offshore_energy", nome: "Offshore Energy",
    dominio: "offshore-energy.biz", tipo: "imprensa", categoria: "imprensa internacional especializada em offshore", pais: "NL", idioma: "en",
    prioridade: "alta", confiabilidade: "imprensa especializada — não é fonte primária", metodo_coleta: "RSS",
    endpoint: OFFSHORE_ENERGY_FEED_URL, grupo: "D", imagem_permitida: false, fonte_primaria: false
  },
  {
    // Expansão 2026-09-27: cobertura técnica de subsea/ROV/AUV/survey —
    // vocabulário que nenhuma fonte BR do registro cobre com esse foco.
    // Teste isolado: 20 brutos → 10 relevantes → 10 inseridas. Publica
    // também pesquisa oceanográfica pura (larvas em lago africano), por
    // isso allow-list e nunca exclusão.
    id: "marine_tech_news", nome: "Marine Technology News",
    dominio: "marinetechnologynews.com", tipo: "imprensa", categoria: "imprensa internacional (subsea/tecnologia marinha)", pais: "US", idioma: "en",
    prioridade: "media", confiabilidade: "imprensa especializada — não é fonte primária", metodo_coleta: "RSS",
    endpoint: MARINE_TECH_NEWS_FEED_URL, grupo: "E", imagem_permitida: false, fonte_primaria: false
  }
];

/* Combina o registro (metadado estático) com a ÚLTIMA execução real
   (já gravada em KV por registrarExecucaoEmKV, sem nenhuma escrita nova
   — "ultima_execucao" guarda só 1 registro, sobrescrito a cada grupo que
   roda). Limitação honesta: como só existe esse único registro (não um
   por grupo A/B/C), só as fontes do MESMO grupo da execução mais recente
   têm status HEALTHY/BROKEN de verdade; as demais aparecem como
   SEM_DADO_RECENTE (não é "quebrada", é "não sabemos agora, o último
   snapshot é de outro grupo") — documentado como limitação conhecida em
   docs/SOURCE-REGISTRY.md, não fingida como monitoramento completo. */
function classificarSaudeFontes(ultimaExecucao) {
  return FONTES_REGISTRY.map((fonte) => {
    const mesmoGrupo = ultimaExecucao && ultimaExecucao.grupo === fonte.grupo;
    if (!mesmoGrupo || !ultimaExecucao.resultados || !(fonte.id in ultimaExecucao.resultados)) {
      return { id: fonte.id, nome: fonte.nome, categoria: fonte.categoria, status: "SEM_DADO_RECENTE" };
    }
    const r = ultimaExecucao.resultados[fonte.id];
    const status = r && r.ok !== false ? "HEALTHY" : "BROKEN";
    return {
      id: fonte.id, nome: fonte.nome, categoria: fonte.categoria,
      status,
      erro: status === "BROKEN" ? (r && r.erro) || "erro desconhecido" : null,
      ultima_execucao: ultimaExecucao.fim
    };
  });
}

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

    if (url.pathname === "/debug-relevancia") {
      const fonteParam = url.searchParams.get("fonte") || "antaq";
      return executarTeste(async () => {
        let brutos;
        if (fonteParam === "antaq") { const html = await baixarPagina(ANTAQ_URL); brutos = extrairLinksANTAQ(html); }
        else if (fonteParam === "mme") { const html = await baixarPagina(MME_URL); brutos = extrairLinksMME(html); }
        else if (fonteParam === "anp") { const html = await baixarPagina(ANP_URL); brutos = extrairLinksANP(html); }
        else return { ok: false, erro: "fonte não suportada neste debug" };
        return { ok: true, itens: brutos.map((b) => ({ titulo: b.title, passou: noticiaRelevante(b.title) })) };
      });
    }

    if (url.pathname === "/run-petronoticias") {
      return executarTeste(() => coletarPetroNoticias(env));
    }

    // Novas fontes internacionais (2026-09-19, Source Registry) — testadas
    // isoladas antes de entrar em qualquer grupo agendado, mesma disciplina
    // já usada pro IBAMA/Marinha/ANTAQ.
    if (url.pathname === "/run-transocean") {
      return executarTeste(() => coletarTransocean(env));
    }

    if (url.pathname === "/run-sbm-offshore") {
      return executarTeste(() => coletarSBMOffshore(env));
    }


    if (url.pathname === "/run-agencia-brasil") {
      return executarTeste(() => coletarAgenciaBrasilEconomia(env));
    }

    // Fontes sindicais (2026-09-19 — gap regional/Bacia de Campos/Macaé),
    // testadas isoladas antes de entrar em qualquer grupo agendado.
    if (url.pathname === "/run-sindipetro-nf") {
      return executarTeste(() => coletarSindipetroNF(env));
    }

    if (url.pathname === "/run-fup") {
      return executarTeste(() => coletarFUP(env));
    }

    if (url.pathname === "/run-eixos") {
      return executarTeste(() => coletarEixos(env));
    }

    // Expansão do Source Registry (2026-09-27): endpoints isolados de
    // teste, mesma disciplina de sempre (testar sozinho antes de entrar
    // em qualquer grupo agendado).
    if (url.pathname === "/run-portos-navios") {
      return executarTeste(() => coletarPortosENavios(env));
    }

    if (url.pathname === "/run-megawhat") {
      return executarTeste(() => coletarMegaWhat(env));
    }

    if (url.pathname === "/run-offshore-energy") {
      return executarTeste(() => coletarOffshoreEnergy(env));
    }

    if (url.pathname === "/run-marine-tech-news") {
      return executarTeste(() => coletarMarineTechnologyNews(env));
    }

    if (url.pathname === "/run-noticias-macae") {
      return executarTeste(() => coletarNoticiasMacae(env));
    }


    if (url.pathname === "/run-offvoos") {
      await garantirOffVoosPollerAtivo(env);
      return executarTeste(() => coletarTodosOffVoos(env));
    }

    if (url.pathname === "/offvoos") {
      await garantirOffVoosPollerAtivo(env);
      const snapshot = await obterSnapshotOffVoosDoKV(env);
      return Response.json(
        { ok: true, snapshot },
        { headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (url.pathname === "/run-mercado") {
      await garantirMercadoPollerAtivo(env);
      return executarTeste(() => coletarTodoMercado(env));
    }

    if (url.pathname === "/mercado") {
      await garantirMercadoPollerAtivo(env);
      const snapshot = await obterSnapshotMercadoDoKV(env);
      return Response.json(
        { ok: true, snapshot },
        { headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Correção pontual, única, de 2026-09-17 (auditoria do pipeline P0):
    // 10 artigos da ANTAQ foram inseridos por uma versão anterior do
    // coletor com published_at = hora de processamento (bug já corrigido
    // — ver dataEditorial em processarNoticias), em vez da data real da
    // matéria. Como esses títulos são ruído institucional (audiência/
    // consulta pública) e agora são corretamente rejeitados por
    // noticiaRelevante, nunca mais seriam reprocessados pelo fluxo normal
    // pra se autocorrigir. Datas reais confirmadas manualmente via
    // datePublished (JSON-LD) de cada página em 2026-09-17. Idempotente
    // (dá pra rodar de novo sem efeito colateral) e não apaga nada — só
    // corrige published_at/original_published_at pras datas reais.
    if (url.pathname === "/corrigir-datas-legado-antaq-20260917") {
      return executarTeste(async () => {
        const CORRECOES = [
          { id: "aee1e2aa-f42d-4416-8cd4-3c11c1b43e78", data: "2026-07-23T19:56:24+00:00" },
          { id: "adb2ef23-20e9-410e-9bd5-30bcb09ccccb", data: "2026-07-24T19:04:00+00:00" },
          { id: "acbacf65-dd42-49a1-9790-0e490d7246e2", data: "2026-07-29T11:23:00+00:00" },
          { id: "92b121fd-1f73-4149-b7d2-dc6d0c5c7c6d", data: "2026-08-11T22:04:09+00:00" },
          { id: "8e1a9a51-a416-46c0-927b-ea07569f758f", data: "2026-08-12T16:00:00+00:00" },
          { id: "211c200b-1875-410c-a0d3-fe15027abc9f", data: "2026-08-18T16:36:00+00:00" },
          { id: "ebbbbdf6-6dac-4cf5-82d1-776ea24c6720", data: "2026-08-19T19:08:00+00:00" },
          { id: "9ea368ec-c680-4c67-bd8d-f24b0c279aff", data: "2026-08-20T21:10:00+00:00" },
          { id: "5e77d2f5-5121-4244-b683-c848374c2f87", data: "2026-08-31T19:26:11+00:00" },
          { id: "9f6dd710-675f-40e1-8632-ee1e946aecd8", data: "2026-09-03T17:34:00+00:00" }
        ];
        validarAmbiente(env);
        const resultados = [];
        for (const c of CORRECOES) {
          const resp = await fetch(
            `${env.SUPABASE_URL}/rest/v1/articles?id=eq.${encodeURIComponent(c.id)}`,
            {
              method: "PATCH",
              headers: { ...supabaseHeaders(env), "Content-Type": "application/json" },
              body: JSON.stringify({ published_at: c.data, original_published_at: c.data })
            }
          );
          resultados.push({ id: c.id, ok: resp.ok, status: resp.status });
        }
        return { ok: true, corrigidos: resultados };
      });
    }

    // Diagnóstico manual do radar do Telegram — chama o orquestrador de
    // verdade (pode enviar de verdade se houver candidato elegível e
    // TELEGRAM_DRY_RUN="false"). Existe pra operação futura, não foi
    // chamada nesta ativação ("não force uma postagem só pra testar").
    if (url.pathname === "/run-telegram") {
      return executarTeste(() => executarRadarTelegram(env));
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
  await garantirEditorialPollerAtivo(env);
  return Response.json(await avaliarSaudeEditorial(env));
}

 if (url.pathname === "/aeroportos") {
  await garantirOffVoosPollerAtivo(env);
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

    if (url.pathname === "/run-editorial-hora") {
      await garantirEditorialPollerAtivo(env);
      return Response.json({ ok: true, mensagem: "Poller horário ativado/verificado — a varredura roda no próprio Alarm, não nesta chamada." });
    }

    if (url.pathname === "/reprocessar-artigos-corrompidos") {
      return executarTeste(() => reprocessarArtigosCorrompidos(env));
    }

    if (url.pathname === "/corrigir-imagens-banner") {
      return executarTeste(() => corrigirImagensBannerRepetidas(env));
    }

    if (url.pathname === "/corrigir-fontes-internacionais-teste") {
      return executarTeste(() => corrigirFontesInternacionaisTeste(env));
    }

    if (url.pathname === "/admin/deletar-artigo") {
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ ok: false, erro: "faltou ?id=" }, { status: 400 });
      return executarTeste(() => deletarArtigoPorId(env, id));
    }

    if (url.pathname === "/admin/limpar-imagem") {
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ ok: false, erro: "faltou ?id=" }, { status: 400 });
      return executarTeste(() => limparImagemPorId(env, id));
    }

    if (url.pathname === "/admin/backfill-imagens") {
      const limiteParam = url.searchParams.get("limite");
      const limite = limiteParam ? Math.min(Math.max(parseInt(limiteParam, 10) || 10, 1), 20) : 10;
      return executarTeste(() => backfillImagensFaltantes(env, limite));
    }

    return Response.json({
      sistema: "OWNews Automation",
      status: "ONLINE",
      supabase_url: !!env.SUPABASE_URL,
      supabase_secret: !!env.SUPABASE_SERVICE_ROLE_KEY,
      fontes_automaticas: ["ANP", "Petrobras", "MME", "PPSA", "EPE", "Marinha do Brasil", "ANTAQ"],
      fontes_grupo_c_varredura_horaria: ["IBAMA", "PetroNotícias"]
    });
  },

  // Duas invocações separadas (mesmo horário/hora, minuto diferente) —
  // cada uma com seu próprio orçamento de subrequests do Cloudflare
  // Workers. Rodar ANP+Petrobras+MME+PPSA+EPE juntos numa invocação só
  // estourava o limite ("Too many subrequests by single Worker
  // invocation") antes mesmo de PPSA/EPE conseguirem inserir algo.
  async scheduled(event, env, ctx) {
    const grupo = event.cron === "20 8,11,14,17,20,22 * * *" ? "B" : "A";

    // Observabilidade adicionada em 2026-09-17 (P0.3 — /saude precisa provar
    // execução real, não só inferir por data de artigo). Grava em KV
    // (SAUDE_KV) o resultado bruto de cada execução — nunca pode quebrar o
    // coletor nem o Telegram, por isso tudo dentro do próprio try/catch e
    // isolado da lógica principal.
    ctx.waitUntil((async () => {
      const inicio = Date.now();
      let resultado = null;
      let erro = null;
      try {
        resultado = grupo === "B"
          ? await executarAtualizacaoNovasFontes(env)
          : await executarAtualizacaoPrincipal(env); // "50 ..." — horário original, Grupo A.
      } catch (e) {
        erro = e.message;
        console.error("[collector] erro na coleta principal:", e.message);
      }

      const fim = Date.now();
      await registrarExecucaoEmKV(env, {
        grupo,
        trigger_cron: event.cron,
        origem: "cron",
        inicio: new Date(inicio).toISOString(),
        fim: new Date(fim).toISOString(),
        duracao_ms: fim - inicio,
        resultados: resultado ? resultado.resultados : null,
        funil: resultado ? resultado.funil : null,
        erro
      });

      // Telegram roda DEPOIS da coleta (pra ver os artigos recém-inseridos
      // nesta mesma execução), sempre, mesmo que a coleta principal tenha
      // dado erro — e nunca deixa um erro do Telegram virar erro do
      // scheduled() (ver blindagem própria dentro de executarRadarTelegram).
      try {
        await executarRadarTelegram(env);
      } catch (e) {
        console.error("[Telegram] erro não tratado, ignorado com segurança:", e.message);
      }
      // Mantém o agendador diário do Telegram ativo (boletim 06:15 + dica 12:00).
      // NÃO usa cron trigger — usa Alarm de Durable Object (conta já está
      // no limite 5/5 do plano Free). Idempotente: o DO só agenda o alarme
      // na primeira chamada; chamadas subsequentes retornam ok imediato.
      await garantirTelegramAgendadorAtivo(env);
    })());
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
    resultados,
    funil: resumirFunilResultados(resultados)
  };
}

// Grupo C: IBAMA sozinho — invocação isolada, própria (só ela, sem A/B
// junto), pra não arriscar o orçamento de subrequests já testado dos
// grupos A/B (histórico real de "Too many subrequests by single Worker
// invocation" ao combinar fontes — ver comentário no Grupo A). IBAMA já
// tinha parser testado e correto (endpoint /run-ibama), só nunca tinha
// sido ligado a nenhum agendamento automático. Roda só na varredura
// horária do EditorialPoller (2026-09-18, Missão Mestre — aumento de
// captura), nunca nos crons fixos "50 ...49 20,22 * * *"/"20 ...
// * * *", que continuam intocados.
async function executarAtualizacaoTerceiraFonte(env) {
  const resultados = {};

  try {
    resultados.ibama = await coletarIBAMA(env);
  } catch (erro) {
    resultados.ibama = { ok: false, erro: erro.message };
  }

  try {
    resultados.petronoticias = await coletarPetroNoticias(env);
  } catch (erro) {
    resultados.petronoticias = { ok: false, erro: erro.message };
  }

  try {
    resultados.agencia_brasil = await coletarAgenciaBrasilEconomia(env);
  } catch (erro) {
    resultados.agencia_brasil = { ok: false, erro: erro.message };
  }

  // Sindipetro NF + FUP entraram no Grupo C em 2026-09-19 (gap regional/
  // sindical de Macaé/Bacia de Campos) — testadas isoladas via
  // /run-sindipetro-nf e /run-fup antes de entrar aqui, mesmo padrão do
  // IBAMA/Agência Brasil. RSS leve (1 fetch de feed + N subrequests de
  // detalhe por item novo, mesmo custo de qualquer outra fonte RSS do
  // grupo), sem risco adicional de orçamento de subrequests.
  try {
    resultados.sindipetro_nf = await coletarSindipetroNF(env);
  } catch (erro) {
    resultados.sindipetro_nf = { ok: false, erro: erro.message };
  }

  try {
    resultados.fup = await coletarFUP(env);
  } catch (erro) {
    resultados.fup = { ok: false, erro: erro.message };
  }

  try {
    resultados.eixos = await coletarEixos(env);
  } catch (erro) {
    resultados.eixos = { ok: false, erro: erro.message };
  }

  try {
    resultados.noticias_macae = await coletarNoticiasMacae(env);
  } catch (erro) {
    resultados.noticias_macae = { ok: false, erro: erro.message };
  }

  return {
    ok: true,
    sistema: "OWNews Automation (terceira fonte)",
    resultados,
    funil: resumirFunilResultados(resultados)
  };
}

// Grupo D: fontes internacionais (Transocean, SBM Offshore) — invocação
// própria, isolada das fontes BR (2026-09-19, Source Registry). Testadas
// isoladamente via /run-transocean e /run-sbm-offshore antes de entrar
// aqui. Mesmo padrão de orçamento de subrequests dos outros grupos: só 2
// fontes, bem abaixo de qualquer limite já visto nos grupos A/B.
async function executarAtualizacaoInternacional(env) {
  const resultados = {};

  try {
    resultados.transocean = await coletarTransocean(env);
  } catch (erro) {
    resultados.transocean = { ok: false, erro: erro.message };
  }

  try {
    resultados.sbm_offshore = await coletarSBMOffshore(env);
  } catch (erro) {
    resultados.sbm_offshore = { ok: false, erro: erro.message };
  }

  // Offshore Energy (2026-09-27, expansão do Source Registry): testada
  // isolada via /run-offshore-energy antes de entrar aqui. Fica no Grupo
  // D porque Transocean/SBM são de volume quase nulo (0 itens em 48h na
  // auditoria) — sobra orçamento de subrequests. Marine Technology News,
  // a outra fonte nova de volume alto, foi deliberadamente pro Grupo E
  // pra não juntar 2 fontes de 10 itens na mesma invocação.
  try {
    resultados.offshore_energy = await coletarOffshoreEnergy(env);
  } catch (erro) {
    resultados.offshore_energy = { ok: false, erro: erro.message };
  }

  return {
    ok: true,
    sistema: "OWNews Automation (internacional)",
    resultados,
    funil: resumirFunilResultados(resultados)
  };
}

/* Grupo E: imprensa especializada (2026-09-27, expansão do Source
   Registry) — Portos e Navios + MegaWhat + Marine Technology News.
   Grupo NOVO em vez de entrar no Grupo C porque C já roda 7 fontes numa
   única invocação, e a lição documentada do incidente de subrequests
   (Grupo B, 2026-09-17) é justamente não empilhar fonte em grupo cheio:
   quando o orçamento estoura, as ÚLTIMAS fontes da lista são descartadas
   em silêncio. Distribuição pensada pelo VOLUME real medido no teste
   isolado, não pelo idioma/país: cada grupo novo fica com no máximo 2
   fontes de 10 itens (Portos e Navios + Marine Tech aqui; Offshore
   Energy sozinha no D, onde Transocean/SBM rendem ~0). MegaWhat rende
   ~0 e não pesa. Custo da decisão: a rotação horária passa de 4 pra 5
   turnos (cada grupo a cada ~5h em vez de ~4h) — compensado pelos 2
   crons fixos (A/B a cada ~3h) e pelo stale guard do Grupo A. */
async function executarAtualizacaoImprensaEspecializada(env) {
  const resultados = {};

  try {
    resultados.portos_navios = await coletarPortosENavios(env);
  } catch (erro) {
    resultados.portos_navios = { ok: false, erro: erro.message };
  }

  try {
    resultados.megawhat = await coletarMegaWhat(env);
  } catch (erro) {
    resultados.megawhat = { ok: false, erro: erro.message };
  }

  try {
    resultados.marine_tech_news = await coletarMarineTechnologyNews(env);
  } catch (erro) {
    resultados.marine_tech_news = { ok: false, erro: erro.message };
  }

  return {
    ok: true,
    sistema: "OWNews Automation (imprensa especializada)",
    resultados,
    funil: resumirFunilResultados(resultados)
  };
}

// Grupo B: PPSA + EPE + MME + Marinha + ANTAQ — invocação própria, com
// orçamento de subrequests independente do Grupo A. ~34 subrequests antes
// de Marinha/ANTAQ entrarem.
//
// Marinha e ANTAQ ativadas em produção em 2026-09-17 (auditoria do
// pipeline P0): coletores já testados, mas ficavam de fora de qualquer
// grupo automático — o motivo real era um bug de parser não descoberto
// (Marinha: href com prefixo "/index.php/" não previsto no regex,
// zerando "segurança da navegação" silenciosamente) e um filtro de
// relevância frouxo demais na ANTAQ (aceitava qualquer nota com "porto"/
// "concessão", inclusive puro rito de audiência/consulta pública — ver
// PALAVRAS_EXCLUSAO_RUIDO_INSTITUCIONAL e PALAVRAS_REGULATORIAS_GENERICAS).
// Ambos corrigidos nesta mesma rodada antes de ativar. IBAMA continua
// FORA por enquanto — sem bug conhecido, só ainda sem decisão/teste de
// orçamento de subrequests combinado (ver /run-ibama para teste manual).
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

  try {
    resultados.marinha = await coletarMarinha(env);
  } catch (erro) {
    resultados.marinha = { ok: false, erro: erro.message };
  }

  try {
    resultados.antaq = await coletarANTAQ(env);
  } catch (erro) {
    resultados.antaq = { ok: false, erro: erro.message };
  }

  return {
    ok: true,
    sistema: "OWNews Automation (novas fontes)",
    resultados,
    funil: resumirFunilResultados(resultados)
  };
}

/* =========================
   ANP
========================= */

async function coletarANP(env) {
  validarAmbiente(env);

  const html = await baixarPagina(ANP_URL);

  const brutos = extrairLinksANP(html);
  const noticias = brutos
    .filter(item => noticiaRelevante(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "ANP", noticias, { brutos: brutos.length });
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

  const brutos = extrairLinksMME(html);
  const noticias = brutos
    .filter(item => noticiaRelevante(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "MME", noticias, { brutos: brutos.length });
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

  const brutos = posts.map((p) => ({
    title: limparTexto(p.title && p.title.rendered ? p.title.rendered : ""),
    url: p.link,
    source: "PPSA",
    publishedAt: p.date ? `${p.date}-03:00` : null
  }));
  const noticias = brutos
    .filter((item) => item.title && item.url && noticiaRelevante(item.title))
    .slice(0, 5);

  return processarNoticiasComDedupe(env, "PPSA", noticias, { brutos: brutos.length });
}

/* ---------- EPE ---------- */

async function coletarEPE(env) {
  validarAmbiente(env);

  const html = await baixarPagina(EPE_URL);

  const brutos = extrairLinksEPE(html);
  const noticias = brutos
    .filter((item) => noticiaRelevante(item.title))
    .slice(0, 5);

  return processarNoticiasComDedupe(env, "EPE", noticias, { brutos: brutos.length });
}

/* Data da EPE (corrigido em 2026-09-27, auditoria do funil): a PÁGINA DA
   MATÉRIA da EPE não tem nenhum metadado de data — nem
   article:published_time, nem JSON-LD, nem <time datetime>, nem o padrão
   "Publicado em" do Plone/gov.br (verificado ao vivo no HTML real). Por
   isso extrairData() devolvia null e TODA matéria da EPE morria em
   "ERRO_DATA: fonte sem data editorial verificável" — 2 matérias
   relevantes perdidas por ciclo, incluindo "EPE e Norwegian Offshore
   Directorate realizam intercâmbio técnico" e a cobertura da ROG.e.
   A data real existe só na LISTAGEM, num <span class="date"> logo depois
   do </a> de cada item. Extraída aqui e passada como item.publishedAt —
   o pipeline já prefere detalhes.publishedAt e só cai neste valor quando
   a página não tem nada (exatamente o caso da EPE).

   ATENÇÃO (motivo de NÃO ler a data da página da matéria): o HTML do
   artigo contém <span class="date"> de OUTRAS matérias, numa lista
   lateral — ler dali daria a data errada, silenciosamente. */
function dataListagemEPEParaISO(ddmmaaaa) {
  const [dia, mes, ano] = String(ddmmaaaa || "").split("/");
  if (!dia || !mes || !ano) return null;
  // A EPE publica só DD/MM/AAAA, sem hora e sem fuso. Convenção do
  // projeto pra fonte BR sem fuso explícito: -03:00 (mesma já usada em
  // PPSA e no parser do Plone). 00:00 de propósito: qualquer hora
  // fabricada seria invenção, e um horário comercial arbitrário poderia
  // cair no FUTURO quando a coleta roda de manhã — data futura é
  // descartada pelas janelas de recência (h >= 0), o que reintroduziria
  // a perda que esta correção existe pra resolver.
  const instante = new Date(`${ano}-${mes}-${dia}T00:00:00-03:00`).getTime();
  if (!Number.isFinite(instante)) return null;
  if (instante > Date.now() + 3600000) return null; // nunca aceita data futura
  if (instante < Date.UTC(2000, 0, 1)) return null;
  return new Date(instante).toISOString();
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

    // Data do PRÓPRIO item: só no trecho logo após o </a> deste link
    // (janela curta de propósito — evita capturar a data do item
    // seguinte se este vier sem data).
    const depois = html.slice(match.index + match[0].length, match.index + match[0].length + 300);
    const dataMatch = depois.match(/class=["']date["'][^>]*>\s*(\d{2}\/\d{2}\/\d{4})/i);
    const publishedAt = dataMatch ? dataListagemEPEParaISO(dataMatch[1]) : null;

    adicionarUnico(encontrados, {
      title,
      url: "https://www.epe.gov.br" + caminho,
      source: "EPE",
      publishedAt
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

  return processarNoticiasComDedupe(env, "Marinha do Brasil", noticias, { brutos: todasNoticias.length });
}

function extrairLinksMarinha(html, categoria) {
  const encontrados = [];

  // BUG encontrado e corrigido em 2026-09-15: cada card tem DOIS <a> com o
  // mesmo href — um envolvendo só a <img> (sem texto), outro com o título
  // de verdade dentro de <h4 class="card-title">. O regex antigo pegava o
  // primeiro <a> (o da imagem) e capturava HTML solto (divs/spans
  // seguintes) como se fosse o título, nunca o título real. Confirmado
  // contra a página ao vivo: o padrão estável é h4.card-title > a.
  //
  // SEGUNDO BUG encontrado em 2026-09-17 (auditoria do pipeline P0): a
  // categoria "seguranca-da-navegacao" serve o link com prefixo
  // "/index.php/<categoria>/..." (confirmado contra HTML ao vivo), mas
  // "apoio-acoes-do-estado" NÃO tem esse prefixo — o regex exigia o
  // prefixo ausente e zerava essa categoria silenciosamente (parecia
  // "sem novidade", na real era parser quebrado). Prefixo agora opcional.
  const regex = new RegExp(
    `<h4 class="card-title"><a href="((?:/index\\.php)?/${categoria}/[^"]+)"[^>]*>([\\s\\S]{0,250}?)<\\/a><\\/h4>`,
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
   Ativada no Grupo B em 2026-09-17, depois de corrigir o filtro de
   relevância (ver PALAVRAS_EXCLUSAO_RUIDO_INSTITUCIONAL) — antes disso,
   qualquer nota citando "porto" ou "concessão" passava, incluindo puro
   rito de audiência/consulta pública. */
async function coletarANTAQ(env) {
  validarAmbiente(env);

  const html = await baixarPagina(ANTAQ_URL);

  const brutos = extrairLinksANTAQ(html);
  const noticias = brutos
    .filter((item) => noticiaRelevante(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "ANTAQ", noticias, { brutos: brutos.length });
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

/* ---------- PetroNotícias (RSS público, imprensa setorial PT-BR) ----------
   Adicionada em 2026-09-18 (Missão Mestre, seção "aumentar radicalmente a
   captura de notícias" — fontes regionais/setoriais). Feed público
   (petronoticias.com.br/feed/), conteúdo já em português (sem lacuna de
   tradução), publicação frequente (~1 matéria/hora) e cobertura direta de
   movimentação de embarcações/FPSO/contratos que os canais oficiais não
   noticiam com a mesma velocidade. A página do artigo não tem meta de data
   nem <article> limpo (site cheio de banners publicitários), então a DATA
   EDITORIAL vem do <pubDate> do próprio RSS (item.publishedAt), não da
   página — e o filtro de imagem (extrairImagemPrincipal, mais acima) foi
   endurecido nesta mesma rodada pra nunca aceitar banner/publicidade como
   foto de capa (o site tem vários). */
const PETRONOTICIAS_FEED_URL = "https://petronoticias.com.br/feed/";

async function coletarPetroNoticias(env) {
  validarAmbiente(env);

  const xml = await baixarPagina(PETRONOTICIAS_FEED_URL);
  const brutos = extrairItensRSSPetroNoticias(xml);
  const noticias = brutos
    .filter((item) => noticiaRelevante(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "PetroNotícias", noticias, { brutos: brutos.length });
}

/* ---------- Transocean (RSS oficial, IR — drilling, fonte primária) ----------
   Verificada em 2026-09-19 (Missão Growth Engine, P1 — Source Registry):
   feed real confirmado (10 itens, contratos/resultados/fleet status
   reports), plataforma de IR (investor.deepwater.com), sem bloqueio de
   bot. Idioma inglês — ver noticiaRelevanteInternacionalEn() e o
   comentário lá sobre por que o filtro é diferente das fontes BR. */
const TRANSOCEAN_FEED_URL = "https://investor.deepwater.com/rss/news-releases.xml";

async function coletarTransocean(env) {
  validarAmbiente(env);

  const xml = await baixarPagina(TRANSOCEAN_FEED_URL);
  const brutos = extrairItensRSSGenerico(xml, "Transocean");
  const noticias = brutos
    .filter((item) => noticiaRelevanteInternacionalEn(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "Transocean", noticias, { brutos: brutos.length });
}

/* ---------- SBM Offshore (RSS oficial, newsroom — FPSO, fonte primária) ----------
   Verificada em 2026-09-19: feed WordPress padrão do site principal
   (não o feed de comentários da página /investors/press-releases/, que
   retorna 0 itens — usar sempre o feed raiz do domínio). Conteúdo real
   confirmado: contratos de FPSO, resultados, operações em Guyana/
   Suriname — exatamente os países-prioridade da missão. */
const SBM_OFFSHORE_FEED_URL = "https://www.sbmoffshore.com/feed/";

async function coletarSBMOffshore(env) {
  validarAmbiente(env);

  const xml = await baixarPagina(SBM_OFFSHORE_FEED_URL);
  const brutos = extrairItensRSSGenerico(xml, "SBM Offshore");
  const noticias = brutos
    .filter((item) => noticiaRelevanteInternacionalEn(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "SBM Offshore", noticias, { brutos: brutos.length });
}

/* ---------- Agência Brasil / Economia (RSS oficial, EBC — cobertura
   cruzada de Petrobras/energia) ----------
   Descoberta e verificada em 2026-09-19 investigando o caso Starnav
   Elektra: a Agência Brasil (EBC, empresa pública de comunicação,
   mesmo grupo da Agência Gov que originalmente noticiou o caso)
   também cobriu a mesma notícia de forma independente
   ("Petrobras batiza primeiro navio a navegar com tripulação 100%
   feminina"). RSS real confirmado (rss.ebc.com.br → feed de Economia),
   mistura notícia de energia com economia geral (Pix, PIB, indicadores)
   — o noticiaRelevante() já filtra isso, mesmo padrão de qualquer outra
   fonte ampla. Valor real: fonte de BACKUP pra cobertura Petrobras/
   energia — reduz dependência única do parser de agencia.petrobras.com.br. */
const AGENCIA_BRASIL_ECONOMIA_FEED_URL = "https://agenciabrasil.ebc.com.br/rss/economia/feed.xml";

async function coletarAgenciaBrasilEconomia(env) {
  validarAmbiente(env);

  const xml = await baixarPagina(AGENCIA_BRASIL_ECONOMIA_FEED_URL);
  const brutos = extrairItensRSSGenerico(xml, "Agência Brasil");
  const noticias = brutos
    .filter((item) => noticiaRelevante(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "Agência Brasil", noticias, { brutos: brutos.length });
}

/* ---------- Sindipetro NF / FUP (RSS oficial — sindical, fonte primária) ----------
   Adicionadas em 2026-09-19 (Missão Contínua — gap explícito da missão:
   "greve/sindicato/Bacia de Campos/Macaé" nunca tinha fonte dedicada, só
   vocabulário no relevance filter). Sindipetro NF é o sindicato dos
   petroleiros do Norte Fluminense (sede em Macaé, cobre a Bacia de
   Campos — a maior categoria de petroleiros da América Latina); FUP é a
   federação nacional que o representa. Verificado ao vivo: RSS real,
   WordPress padrão, atualizado no mesmo dia (2026-09-19), contendo o
   próprio caso de regressão da missão ("Sindipetro-NF manifesta
   solidariedade aos trabalhadores em greve na Bacia de Campos",
   18/09/2026) — confirma que esta é exatamente a fonte que faltava.

   Testado por EXCLUSÃO na primeira versão (aceitar tudo, bloquear só
   ruído óbvio) e corrigido ao vivo ainda na fase de teste isolado: um
   site sindical publica muito conteúdo real mas NADA a ver com o público
   do OWNews — eleição interna de diretoria, nota de falecimento, post
   político nacional ("CUT se soma a Lula e defende transparência"), e
   até uma oficina de artesanato ("Oficina de decoupage em vidro começa em
   Campos"). Trocado para ALLOW-LIST de vocabulário de ação sindical-
   -trabalhista real (greve/assembleia/ACT/negociação coletiva/etc.) OU
   núcleo offshore — cobre "Trabalhadores da Champion Technologies tem
   assembleia dia 23" (prestadora real de serviço de poço, zero termo de
   petróleo, mas "assembleia" garante que é ação trabalhista de verdade)
   sem deixar passar conteúdo de vida institucional do sindicato que não
   é notícia de setor pra ninguém fora da própria categoria. */
const PALAVRAS_ACAO_SINDICAL_PETROLEIRA = [
  "greve", "assembleia", "assembléia", "mobilização", "mobilizacao",
  "paralisação", "paralisacao", "negociação coletiva", "negociacao coletiva",
  "acordo coletivo", "act", "convenção coletiva", "convencao coletiva",
  "dissídio", "dissidio", "pdv", "pdi", "demissão em massa", "demissao em massa",
  "categoria petroleira", "reintegração", "reintegracao", "campanha salarial",
  "data-base", "data base", "rescisão", "rescisao", "contraproposta",
  "termo aditivo"
];

// Achado ao vivo em 2026-09-19, ainda testando esta mesma integração:
// "campo"/"campos" é homógrafo real pra ESTA fonte especificamente —
// Sindipetro NF é sediado em Campos dos Goytacazes (RJ) e frequentemente
// menciona "Campos" como a CIDADE (vida institucional/social do
// sindicato), não como campo petrolífero ("Oficina de decoupage em vidro
// começa em Campos e ainda tem vagas" passou só por isso, plural incluído
// pela tolerância de plural do bateComBordaDePalavraColeta). "bacia",
// "poço", "plataforma", "fpso" etc. continuam sem ambiguidade nenhuma —
// só "campo"/"campos" precisa ficar de fora do núcleo aqui. Filtro
// calculado dentro da função (não como const de topo) porque
// PALAVRAS_NUCLEO_OFFSHORE só é declarada mais abaixo no arquivo.
function noticiaRelevanteSindicalPetroleiro(titulo) {
  const t = titulo.toLowerCase();
  const nucleoSemCampoAmbiguo = PALAVRAS_NUCLEO_OFFSHORE.filter((p) => p !== "campo");
  if (nucleoSemCampoAmbiguo.some((p) => bateComBordaDePalavraColeta(t, p))) return true;
  return PALAVRAS_ACAO_SINDICAL_PETROLEIRA.some((p) => bateComBordaDePalavraColeta(t, p));
}

const SINDIPETRO_NF_FEED_URL = "https://sindipetronf.org.br/feed/";

async function coletarSindipetroNF(env) {
  validarAmbiente(env);

  const xml = await baixarPagina(SINDIPETRO_NF_FEED_URL);
  const brutos = extrairItensRSSGenerico(xml, "Sindipetro NF");
  const noticias = brutos
    .filter((item) => noticiaRelevanteSindicalPetroleiro(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "Sindipetro NF", noticias, { brutos: brutos.length });
}

const FUP_FEED_URL = "https://fup.org.br/feed/";

async function coletarFUP(env) {
  validarAmbiente(env);

  const xml = await baixarPagina(FUP_FEED_URL);
  const brutos = extrairItensRSSGenerico(xml, "FUP");
  const noticias = brutos
    .filter((item) => noticiaRelevanteSindicalPetroleiro(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "FUP", noticias, { brutos: brutos.length });
}

/* ---------- Eixos (RSS oficial — imprensa especializada em energia, fonte
   secundária) ----------
   Verificada em 2026-09-19 (Missão Contínua — correção de regressão de
   Discovery insuficiente): RSS real, WordPress padrão, 20 itens recentes
   confirmados manualmente, incluindo 2 publicados no próprio dia
   (09h/12h UTC) — cobertura de mercado (Brent/WTI), regulação (MPF/Foz
   do Amazonas, PPSA, Redata) e Petrobras. Testado contra noticiaRelevante
   já existente: 12/20 títulos passam corretamente, os 8 excluídos são
   genuinamente fora de escopo (mineração/eleições/carvão Índia/mobilidade
   elétrica) — nenhum ajuste de filtro necessário, mesmo filtro geral já
   usado por PetroNotícias/Agência Brasil. */
const EIXOS_FEED_URL = "https://eixos.com.br/feed/";

async function coletarEixos(env) {
  validarAmbiente(env);

  const xml = await baixarPagina(EIXOS_FEED_URL);
  const brutos = extrairItensRSSGenerico(xml, "Eixos");
  const noticias = brutos
    .filter((item) => noticiaRelevante(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "Eixos", noticias, { brutos: brutos.length });
}

/* ---------- Notícias Macaé (RSS oficial — imprensa local, fonte
   secundária) ----------
   Verificada em 2026-09-20 (Missão Contínua — gap regional/Bacia de
   Campos que a missão pediu repetidamente): jornal local de Macaé,
   cobertura geral da cidade (política, segurança, esporte, saúde — a
   maioria NADA a ver com offshore). RSS real confirmado, 20 itens
   testados manualmente contra noticiaRelevante(): 1/20 passa, e é
   exatamente o tipo de furo hiperlocal que fontes nacionais nunca
   pegariam — "Greve começa em Macaé e sindicato cita paralisação em 20
   plataformas da Bacia de Campos" (18/09/2026), o equivalente real do
   caso de regressão "greve-like" da missão. Baixa precisão bruta (95%
   de ruído) é esperada e aceitável aqui — o filtro geral já faz o
   trabalho de separar o que interessa, sem precisar de lista de
   exclusão dedicada (diferente de Sindipetro NF, que é 100%
   especializado e por isso usa allow-list de ação sindical). */
const NOTICIAS_MACAE_FEED_URL = "https://www.noticiasmacae.com/feed";

/* ---------- Expansão do Source Registry (2026-09-27) ----------
   4 fontes novas, cada uma verificada individualmente ao vivo antes de
   entrar aqui (curl real + inspeção de itens/datas/conteúdo), mesmo
   processo documentado em docs/SOURCE-REGISTRY.md. As demais candidatas
   da lista pendente foram testadas e REJEITADAS por bloqueio técnico
   real (403/404/feed placeholder/conteúdo fora de escopo) — registro
   completo em SOURCE-REGISTRY.md, nenhuma "burlada".

   Portos e Navios: imprensa especializada BR (Joomla, feed com 200
   itens), a de maior valor editorial das 4 — cobre pré-sal, operadoras,
   apoio marítimo, estaleiro e portos em português. Amostra real da
   verificação: "Busca por novos poços é vital para conter declínio do
   pré-sal, diz Magda", "OceanPact assina acordo para expansão de base
   no Açu". Usa noticiaRelevante() padrão (feed também traz muita pauta
   portuária/logística pura, que o filtro já separa). */
const PORTOS_NAVIOS_FEED_URL = "https://www.portosenavios.com.br/noticias?format=feed&type=rss";

async function coletarPortosENavios(env) {
  validarAmbiente(env);

  const xml = await baixarPagina(PORTOS_NAVIOS_FEED_URL);
  const brutos = extrairItensRSSGenerico(xml, "Portos e Navios");
  const noticias = brutos
    .filter((item) => noticiaRelevante(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "Portos e Navios", noticias, { brutos: brutos.length });
}

/* MegaWhat: imprensa de energia BR (UOL). Pauta majoritariamente
   ELÉTRICA (Aneel, tarifa, MMGD) — entra como fonte de BACKUP pra
   Petrobras/gás natural, mesmo papel já cumprido pela Agência Brasil.
   Verificado ao vivo: ~1 em 6 manchetes é O&G ("Petrobras não é
   'bicho-papão' do mercado ao comprar gás de terceiros, diz Magda"); o
   noticiaRelevante() descarta o resto sem custo de subrequest (filtro é
   só título). Rendimento baixo por desenho — nunca vira portal de
   energia elétrica. */
const MEGAWHAT_FEED_URL = "https://megawhat.uol.com.br/feed/";

async function coletarMegaWhat(env) {
  validarAmbiente(env);

  const xml = await baixarPagina(MEGAWHAT_FEED_URL);
  const brutos = extrairItensRSSGenerico(xml, "MegaWhat");
  const noticias = brutos
    .filter((item) => noticiaRelevante(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "MegaWhat", noticias, { brutos: brutos.length });
}

/* Offshore Energy (offshore-energy.biz): imprensa internacional 100%
   dedicada a offshore (O&G + eólica offshore + subsea). Melhor fonte
   internacional das testadas — feed diário, amostra real: "North Sea
   appraisal ops up the oil & gas discoveries' projected size", "Omega
   Subsea to mobilize ROV systems", "Eni broadens its exploration
   horizons... offshore block". Usa noticiaRelevanteImprensaEn()
   (allow-list), não a exclusão curta das companhias. */
const OFFSHORE_ENERGY_FEED_URL = "https://www.offshore-energy.biz/feed/";

async function coletarOffshoreEnergy(env) {
  validarAmbiente(env);

  const xml = await baixarPagina(OFFSHORE_ENERGY_FEED_URL);
  const brutos = extrairItensRSSGenerico(xml, "Offshore Energy");
  const noticias = brutos
    .filter((item) => noticiaRelevanteImprensaEn(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "Offshore Energy", noticias, { brutos: brutos.length });
}

/* Marine Technology News: imprensa internacional de tecnologia marinha
   — subsea, ROV/AUV, survey. Cobre exatamente o vocabulário técnico que
   o público OWNews acompanha ("Omega Subsea to Deploy ROVs on NKT's
   Cable Laying Vessels", "New Subsea Equipment Provider AQO"), mas
   TAMBÉM publica pesquisa oceanográfica pura (larvas em lago africano)
   — por isso allow-list, nunca exclusão. */
const MARINE_TECH_NEWS_FEED_URL = "https://www.marinetechnologynews.com/rss/news";

async function coletarMarineTechnologyNews(env) {
  validarAmbiente(env);

  const xml = await baixarPagina(MARINE_TECH_NEWS_FEED_URL);
  const brutos = extrairItensRSSGenerico(xml, "Marine Technology News");
  const noticias = brutos
    .filter((item) => noticiaRelevanteImprensaEn(item.title))
    .slice(0, 10);

  return processarNoticiasComDedupe(env, "Marine Technology News", noticias, { brutos: brutos.length });
}

async function coletarNoticiasMacae(_env) {
  // Desativado em 2026-09-28: noticiasmacae.com retorna HTTP 403 para
  // tráfego de datacenter (Cloudflare Workers). Reavaliação periódica
  // recomendada — se o bloqueio for removido, restaurar a implementação
  // original abaixo (git log).
  return { ok: false, erro: "DESATIVADO_403: noticiasmacae.com bloqueou Workers", brutos: 0, inseridos: 0, novos: 0, duplicados: 0, descartados: 0 };
}

/* OceanPact (oceanpact.com/feed/) tentada e REJEITADA em 2026-09-19: RSS
   real com 10 itens relevantes confirmados via curl externo, mas o
   fetch() do PRÓPRIO Worker recebe um desafio de bot (challenge
   "sgcaptcha", confirmado via debug — resposta de 181 bytes, uma página
   de redirect JS, não o feed real) — bloqueio real específico ao
   tráfego de datacenter/Workers, não contornado. Ver
   docs/SOURCE-REGISTRY.md pra detalhes; candidata a reavaliar
   periodicamente caso a proteção mude. */

/* Generalizado em 2026-09-19 (Missão Growth Engine — Source Registry):
   mesmo parser de RSS que já funcionava só pro PetroNotícias, agora
   reutilizável por qualquer fonte RSS nova (title/link/pubDate — formato
   padrão RSS 2.0, cobre WordPress e a maioria das plataformas de IR). */
function extrairItensRSSGenerico(xml, nomeFonte) {
  const encontrados = [];
  const regexItem = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = regexItem.exec(xml)) !== null) {
    const bloco = match[1];
    const linkMatch = bloco.match(/<link>([\s\S]*?)<\/link>/i);
    const tituloMatch = bloco.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const pubMatch = bloco.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    if (!linkMatch || !tituloMatch) continue;

    const url = limparTexto(linkMatch[1]);
    let title = limparTexto(tituloMatch[1]);
    if (!title || !url) continue;

    // Corrigido em 2026-09-19 (Transocean/SBM Offshore, Source Registry):
    // várias plataformas de IR devolvem o título do RSS já com o nome da
    // empresa colado no fim (" | Transocean Ltd.", " - SBM Offshore") —
    // redundante no OWNews, que já mostra a fonte separadamente (image_
    // credit). Remove só quando o sufixo claramente repete o nome da
    // fonte (nunca corta um " - "/"|" que seja conteúdo real do título).
    title = limparSufixoFonte(title, nomeFonte);

    let publishedAt = null;
    if (pubMatch) {
      const instante = new Date(pubMatch[1].trim()).getTime();
      if (Number.isFinite(instante)) publishedAt = new Date(instante).toISOString();
    }

    adicionarUnico(encontrados, { title, url, source: nomeFonte, publishedAt });
  }
  return encontrados;
}

/* Fontes internacionais em inglês (Transocean, SBM Offshore): o filtro
   noticiaRelevante() é todo em vocabulário português, sempre rejeitaria
   título em inglês. Mas essas fontes são companhias 100% especializadas
   em offshore — todo press release delas já É sobre o setor por
   construção, diferente de um órgão de governo genérico (MME/ANP também
   publicam sobre etanol, bioenergia, assuntos não-offshore). Por isso o
   filtro aqui é uma EXCLUSÃO curta (avisos corporativos genéricos, não
   notícia de operação/contrato/ativo) em vez de uma lista de permissão —
   sem isso, quase tudo seria descartado por não ter palavra em português. */
const PALAVRAS_EXCLUSAO_CORPORATIVO_GENERICO_EN = [
  "annual general meeting", "notice of annual", "dividend declaration",
  "record date", "conference call and webcast", "schedules ", "webcast information"
];
function noticiaRelevanteInternacionalEn(titulo) {
  const t = titulo.toLowerCase();
  return !PALAVRAS_EXCLUSAO_CORPORATIVO_GENERICO_EN.some((p) => t.includes(p));
}

/* IMPRENSA especializada em inglês (Offshore Energy, Marine Technology
   News — 2026-09-27, expansão do Source Registry): diferente das
   COMPANHIAS acima (Transocean/SBM), onde exclusão curta basta porque
   100% do que elas publicam é do próprio setor. Publicação cobre um
   espectro bem maior — offshore O&G, eólica offshore, subsea, mas
   também pesquisa oceanográfica, cruzeiro, pesca, defesa naval.
   Verificado ao vivo nos feeds reais: "ASL Acoustic Profiler Reveals
   Vertical Migration of Midge Larvae in Lake Malawi" (Marine Technology
   News) não tem nada a ver com o público do OWNews. Por isso aqui é
   ALLOW-LIST de vocabulário offshore/O&G em inglês, mesmo princípio do
   noticiaRelevante() português — não exclusão. Borda de palavra
   reaproveitada do matcher já existente (bateComBordaDePalavraColeta),
   que também protege siglas curtas (rov/psv/lng) de casar por substring. */
const PALAVRAS_NUCLEO_OFFSHORE_EN = [
  // upstream / E&P
  "offshore", "subsea", "oil", "gas", "lng", "flng", "crude", "upstream",
  "exploration", "appraisal", "drilling", "drillship", "rig", "rigs",
  "well", "wells", "wellhead", "reservoir", "seismic", "deepwater",
  "ultra-deepwater", "pre-salt", "presalt", "field development",
  "oilfield", "hydrocarbon", "hydrocarbons", "petroleum",
  // ativos e operação
  "fpso", "fso", "fsru", "platform", "jack-up", "jackup",
  "semi-submersible", "semisubmersible", "topside", "riser", "umbilical",
  "pipelay", "pipeline", "mooring", "tieback", "decommissioning",
  "rov", "auv", "psv", "ahts", "osv", "csv", "survey vessel",
  "supply vessel", "drilling contractor", "shipyard",
  // energia offshore / transição
  "offshore wind", "floating wind", "wind farm", "carbon capture", "ccs",
  // bacias/regiões-chave do setor
  "north sea", "gulf of mexico", "campos basin", "santos basin",
  "guyana", "suriname", "namibia", "west africa", "barents",
  // players e reguladores do setor (nome próprio já é marcador)
  "petrobras", "equinor", "shell", "totalenergies", "exxonmobil",
  "chevron", "eni", "cnooc", "petronas", "aker", "sbm offshore",
  "modec", "yinson", "saipem", "subsea7", "technipfmc", "transocean",
  "seadrill", "valaris", "noble corporation", "fugro", "opec"
];
function noticiaRelevanteImprensaEn(titulo) {
  const t = titulo.toLowerCase();
  if (PALAVRAS_EXCLUSAO_CORPORATIVO_GENERICO_EN.some((p) => t.includes(p))) return false;
  return PALAVRAS_NUCLEO_OFFSHORE_EN.some((p) => bateComBordaDePalavraColeta(t, p));
}

function extrairItensRSSPetroNoticias(xml) {
  const encontrados = extrairItensRSSGenerico(xml, "PetroNotícias");

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

/* ---------- Status do Telegram (só leitura, nunca envia nada) ----------
   "próximo candidato" é calculado com TELEGRAM_DRY_RUN forçado "true" no
   env passado pro orquestrador — nunca chama a API real do Telegram,
   mesmo com a automação ligada de verdade. */
// Auditoria operacional 2026-09-17: getChat é leitura pura (não envia
// nada ao canal) e é a única forma barata de confirmar que o bot AINDA
// tem acesso real ao canal configurado — pega exatamente a classe de
// falha que motivou esta auditoria (bot perde acesso, mas o código antigo
// só checava o status HTTP do sendMessage/sendPhoto, nunca o campo "ok" do
// corpo, então um envio rejeitado pelo Telegram era registrado como
// sucesso). Nunca lança — falha aqui vira campo informativo, não exceção.
async function verificarAcessoCanalTelegram(env) {
  try {
    const base = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
    const resp = await fetch(`${base}/getChat?chat_id=${encodeURIComponent(env.TELEGRAM_CHANNEL_ID)}`);
    const dados = await resp.json();
    if (dados && dados.ok === true) {
      return { ok: true, titulo: dados.result.title || null, username: dados.result.username ? `@${dados.result.username}` : null, tipo: dados.result.type || null };
    }
    return { ok: false, motivo: dados && dados.description ? dados.description : `HTTP ${resp.status} sem "description"`, error_code: dados && dados.error_code };
  } catch (erro) {
    return { ok: false, motivo: `falha ao consultar getChat: ${erro.message}` };
  }
}

async function obterStatusTelegram(env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHANNEL_ID) {
    return { habilitado: false, motivo: "secrets não configurados" };
  }

  const habilitado = env.TELEGRAM_DRY_RUN === "false";
  const acessoCanal = await verificarAcessoCanalTelegram(env);

  const historicoResp = await buscarHistoricoTelegramPublicados(env);
  if (!historicoResp.ok) {
    return { habilitado, migracao_aplicada: false, motivo: historicoResp.motivo, acesso_ao_canal: acessoCanal };
  }

  const agora = Date.now();
  const estado = computarEstadoEnviosTelegram(historicoResp.historico, agora);
  const ultimo = historicoResp.historico
    .slice()
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0];

  let ultimoErro = null;
  try {
    const respErro = await fetch(
      `${env.SUPABASE_URL}/rest/v1/telegram_posts?select=error_message,created_at&status=eq.failed&order=created_at.desc&limit=1`,
      { headers: supabaseHeaders(env) }
    );
    if (respErro.ok) {
      const linhas = await respErro.json();
      if (linhas.length) ultimoErro = { mensagem: linhas[0].error_message, em: linhas[0].created_at };
    }
  } catch {
    /* não crítico pro /saude */
  }

  let proximoCandidato = null;
  let motivoUltimoBloqueio = null;
  let ultimoResultado = null;
  let garantiaMeioDia = null;
  try {
    const candidatos = await buscarCandidatosTelegram(env);
    const resultados = await processarArtigosParaTelegram(
      candidatos, historicoResp.historico, "https://ownews.com.br",
      { ...env, TELEGRAM_DRY_RUN: "true" }, { info: () => {} }, agora
    );
    const porId = Object.fromEntries(candidatos.map((a) => [a.id, a]));
    const melhor = resultados.find((r) => r.status === "dry_run");
    if (melhor) {
      proximoCandidato = { titulo: porId[melhor.articleId].title, score: melhor.pontuacao, categoria: melhor.categoria };
      ultimoResultado = "publicaria_no_proximo_envio_real";
    } else {
      // Nada publicaria agora — reporta o motivo do candidato bloqueado
      // com maior pontuação, pra explicar objetivamente "por que não
      // saiu nada" (aguardando intervalo, descartado editorial, expirado
      // etc.) em vez de só dizer "nenhum candidato".
      const bloqueados = resultados
        .filter((r) => r.status !== "ja_publicado" && r.motivo)
        .sort((a, b) => (b.pontuacao || 0) - (a.pontuacao || 0));
      if (bloqueados.length) {
        motivoUltimoBloqueio = { status: bloqueados[0].status, motivo: bloqueados[0].motivo, titulo: porId[bloqueados[0].articleId] ? porId[bloqueados[0].articleId].title : null };
        ultimoResultado = bloqueados[0].status;
      } else {
        ultimoResultado = "nenhum_candidato_elegivel";
      }
    }

    // Garantia mínima diária das 12:00 BRT (Missão Mestre, 2026-09-18):
    // qualquer resultado que não seja "já publicado" nem "descartado por
    // relevância editorial" já passou do limiar de pontuação (>= 8) — ou
    // seja, é um candidato genuinamente elegível, mesmo que algo mais
    // (intervalo, idade, erro) tenha bloqueado o envio nesta passada.
    const candidatosElegiveisHoje = resultados.filter(
      (r) => r.status !== "ja_publicado" && r.status !== "descartado_editorial"
    ).length;
    garantiaMeioDia = avaliarGarantiaMeioDiaTelegram(estado, agora, candidatosElegiveisHoje);
  } catch {
    /* não crítico pro /saude */
  }

  const proximaJanela = estado.ultimoEnvioEm
    ? new Date(estado.ultimoEnvioEm + INTERVALO_MINIMO_MS_TELEGRAM).toISOString()
    : null;

  let agendadorStatus = null;
  try {
    if (env.SAUDE_KV) {
      const hojeStr = dataBRTString(agora);
      const [boletimRaw, dicaRaw] = await Promise.all([
        env.SAUDE_KV.get("telegram_boletim_ultimo"),
        env.SAUDE_KV.get("telegram_dica_ultima")
      ]);
      const boletimDados = boletimRaw ? JSON.parse(boletimRaw) : null;
      const dicaDados = dicaRaw ? JSON.parse(dicaRaw) : null;
      agendadorStatus = {
        boletim_hoje: boletimDados ? boletimDados.dia === hojeStr : false,
        dica_hoje: dicaDados ? dicaDados.dia === hojeStr : false,
        boletim_ultimo_em: boletimDados ? boletimDados.em : null,
        dica_ultima_em: dicaDados ? dicaDados.em : null
      };
    }
  } catch { /* não crítico pro /saude */ }

  return {
    habilitado,
    acesso_ao_canal: acessoCanal,
    ativado_em: TELEGRAM_ATIVADO_EM,
    migracao_aplicada: true,
    ultimo_envio: ultimo ? ultimo.published_at : null,
    ultimo_resultado: ultimoResultado,
    motivo_ultimo_bloqueio: motivoUltimoBloqueio,
    proxima_janela: proximaJanela,
    enviados_hoje: estado.enviadosHoje,
    limite_diario_normal: LIMITE_NORMAL_POR_DIA_TELEGRAM,
    limite_diario_excepcional: LIMITE_EXCEPCIONAL_POR_DIA_TELEGRAM,
    intervalo_minimo_horas: INTERVALO_MINIMO_MS_TELEGRAM / 3600000,
    ultimo_erro: ultimoErro,
    proximo_candidato: proximoCandidato,
    garantia_minima_diaria: garantiaMeioDia,
    agendador: agendadorStatus
  };
}

/* ---------- Monitor de saúde editorial ----------
   Endpoint de operação (GET /saude), só leitura, sem escrever nada.
   Serve pra responder objetivamente: "o OWNews está ficando sem notícia
   nova?" e "o Telegram está saudável?" — sem depender de alguém perceber
   isso olhando a Home visualmente, como aconteceu numa rodada anterior. */
/* Observabilidade da automação (P0.3) — grava/lê em Workers KV (binding
   SAUDE_KV). Nunca lança erro: falha de KV nunca pode derrubar o coletor
   nem deixar /saude fora do ar (nesse caso, automacao vem null e /saude
   segue respondendo com o resto). Não expõe nenhum secret — só contagens,
   timestamps e mensagens de erro já públicas nos logs. */
async function registrarExecucaoEmKV(env, dados) {
  try {
    if (!env.SAUDE_KV) return;
    await env.SAUDE_KV.put("ultima_execucao", JSON.stringify(dados));
  } catch {
    // observabilidade nunca pode quebrar o coletor
  }
}

async function obterUltimaExecucaoDoKV(env) {
  try {
    if (!env.SAUDE_KV) return null;
    const bruto = await env.SAUDE_KV.get("ultima_execucao");
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

// Seção F (P0 IMEDIATO, 2026-09-17): agrega os resultados brutos por fonte
// em contagens editoriais explícitas para /saude. "descartados" soma três
// motivos distintos e reais (nunca inventados): não passou no filtro de
// relevância, foi pulado por duplicidade com algo já publicado (só fontes
// com dedupe entre fontes), ou deu erro ao processar (ex.: ERRO_DATA).
function resumirFontesDaExecucao(execucao) {
  if (!execucao || !execucao.resultados) {
    return {
      fontes_executadas: [], fontes_ok: [], fontes_com_erro: [],
      encontrados: 0, relevantes: 0, novos: 0, duplicados: 0, descartados: 0,
      motivo_dos_descartes: {}
    };
  }
  const fontesOk = [];
  const fontesComErro = [];
  const fontesExecutadas = Object.keys(execucao.resultados);
  let encontrados = 0, relevantes = 0, novos = 0, duplicados = 0, descartados = 0;
  const motivos = {};
  const somarMotivo = (motivo, n = 1) => { motivos[motivo] = (motivos[motivo] || 0) + n; };

  for (const [fonte, r] of Object.entries(execucao.resultados)) {
    if (!r || r.ok === false) { fontesComErro.push({ fonte, erro: r ? r.erro : "resultado ausente" }); continue; }
    fontesOk.push(fonte);
    encontrados += r.brutos ?? r.encontradas ?? 0;
    relevantes += r.encontradas || 0;
    novos += r.inseridas || 0;
    duplicados += r.duplicadas || 0;

    if (r.descartadas_relevancia) {
      descartados += r.descartadas_relevancia;
      somarMotivo("não passou no filtro de relevância editorial", r.descartadas_relevancia);
    }
    if (Array.isArray(r.puladas_por_duplicidade) && r.puladas_por_duplicidade.length) {
      descartados += r.puladas_por_duplicidade.length;
      somarMotivo("duplicidade com matéria já publicada (outra fonte)", r.puladas_por_duplicidade.length);
    }
    for (const item of r.noticias || []) {
      if (item.status === "erro") {
        descartados++;
        somarMotivo(item.erro || "erro desconhecido ao processar");
      }
    }
  }

  return {
    fontes_executadas: fontesExecutadas,
    fontes_ok: fontesOk,
    fontes_com_erro: fontesComErro,
    encontrados, relevantes, novos, duplicados, descartados,
    motivo_dos_descartes: motivos
  };
}

function resumirFunilResultados(resultados) {
  const f = { FOUND: 0, FETCHED: 0, PARSED: 0, RECENT_24H: 0, RELEVANT: 0, DUPLICATE: 0, REJECTED_DATE: 0, REJECTED_RELEVANCE: 0, REJECTED_OTHER: 0, INSERTED: 0, ERROR: 0, recentes_rejeitadas: [], SOURCE_COVERAGE: {} };
  for (const [fonte, r] of Object.entries(resultados || {})) {
    f.SOURCE_COVERAGE[fonte] = { consulted: true, responded: !!r && r.ok !== false, recent_6h: 0, recent_12h: 0, recent_24h: r && r.recentes_24h || 0, error: r && r.ok === false ? r.erro : null };
    if (!r || r.ok === false) { f.ERROR++; continue; }
    f.FOUND += r.brutos ?? r.encontradas ?? 0;
    f.FETCHED += r.brutos ?? r.encontradas ?? 0;
    f.PARSED += r.brutos ?? r.encontradas ?? 0;
    f.SOURCE_COVERAGE[fonte].recent_6h = r.recentes_6h || 0;
    f.SOURCE_COVERAGE[fonte].recent_12h = r.recentes_12h || 0;
    f.RECENT_24H += r.recentes_24h || 0;
    f.RELEVANT += r.encontradas || 0;
    f.DUPLICATE += r.duplicadas || 0;
    for (const n of r.puladas_por_duplicidade || []) {
      const h = n.published_at ? (Date.now() - new Date(n.published_at).getTime()) / 3600000 : Infinity;
      if (h >= 0 && h <= 24 && f.recentes_rejeitadas.length < 5) f.recentes_rejeitadas.push({ titulo: n.titulo, fonte: n.fonte_existente || null, published_at: n.published_at, motivo_exato_da_rejeicao: n.motivo_exato_da_rejeicao, parecido_com: n.parecido_com });
    }
    f.REJECTED_DATE += r.rejeitadas_data || 0;
    f.REJECTED_RELEVANCE += r.descartadas_relevancia || 0;
    f.INSERTED += r.inseridas || 0;
    for (const n of r.noticias || []) if (n.status === 'erro') f.ERROR++;
    for (const n of r.recentes_rejeitadas || []) if (f.recentes_rejeitadas.length < 5) f.recentes_rejeitadas.push(n);
  }
  f.REJECTED_OTHER = Math.max(0, f.FOUND - f.RELEVANT - f.DUPLICATE - f.REJECTED_RELEVANCE - f.REJECTED_DATE - f.INSERTED - f.ERROR);
  return f;
}

// Horas UTC fixas dos dois cron triggers (ver wrangler.jsonc) — usado só
// para calcular "próxima execução" em /saude, nunca para decidir o que
// executar de verdade (isso é sempre o Cloudflare, via event.cron).
const HORAS_CRON_UTC = [8, 11, 14, 17, 20, 22];
function calcularProximaExecucao(agora) {
  const candidatos = [];
  for (const h of HORAS_CRON_UTC) {
    for (const m of [20, 50]) {
      const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), h, m, 0));
      if (d.getTime() > agora.getTime()) candidatos.push(d);
    }
  }
  if (!candidatos.length) {
    // nada mais hoje (UTC) — primeiro horário de amanhã
    const amanha = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() + 1, HORAS_CRON_UTC[0], 20, 0));
    return amanha.toISOString();
  }
  candidatos.sort((a, b) => a.getTime() - b.getTime());
  return candidatos[0].toISOString();
}

// Item 29/77 da missão: falha do OffVoos nunca vira "site fora" — estado
// próprio (healthy/degraded/stale/unavailable), nunca herda a lógica do
// health editorial. Não expõe nenhum segredo (só timestamps/contagens).
async function avaliarSaudeOffVoos(env) {
  const snapshot = await obterSnapshotOffVoosDoKV(env);
  const backoff = await obterBackoffOffVoosDoKV(env);
  const agora = Date.now();

  const proximoFetch = new Date(Math.ceil(agora / 180000) * 180000).toISOString();

  if (!snapshot) {
    return {
      habilitado: true,
      estado: "unavailable",
      ultimo_fetch: null, ultimo_sucesso: null, ultimo_erro: null, idade_dados_min: null,
      aeroportos_monitorados: OFFVOOS_HUBS.length, aeroportos_com_dados: 0,
      proximo_fetch: proximoFetch,
      em_backoff: !!(backoff && backoff.ate > agora),
      observacao: "Coletor de OffVoos ainda não rodou nesta implantação (aguarde o próximo disparo do cron isolado, a cada 5min)."
    };
  }

  const idadeMin = Math.round((agora - new Date(snapshot.atualizado_em).getTime()) / 60000);
  const comDados = snapshot.aeroportos.filter((a) => a.status === "ok").length;
  const comErro = snapshot.aeroportos.filter((a) => a.status === "error");

  let estado;
  if (backoff && backoff.ate > agora) estado = "degraded";
  else if (comDados === 0) estado = "unavailable";
  else if (idadeMin > 30) estado = "stale";
  else if (comErro.length > 0) estado = "degraded";
  else estado = "healthy";

  return {
    habilitado: true,
    estado,
    ultimo_fetch: snapshot.atualizado_em,
    ultimo_sucesso: comDados > 0 ? snapshot.atualizado_em : null,
    ultimo_erro: comErro.length ? comErro[0].erro : null,
    idade_dados_min: idadeMin,
    aeroportos_monitorados: OFFVOOS_HUBS.length,
    aeroportos_com_dados: comDados,
    proximo_fetch: proximoFetch,
    em_backoff: !!(backoff && backoff.ate > agora)
  };
}

async function avaliarSaudeEditorial(env) {
  const execucaoKV = await obterUltimaExecucaoDoKV(env);
  const sourceCoverage = execucaoKV && execucaoKV.funil ? execucaoKV.funil.SOURCE_COVERAGE || {} : {};
  const resumoFontes = resumirFontesDaExecucao(execucaoKV);
  const telegramStatus = await obterStatusTelegram(env);
  const offvoosStatus = await avaliarSaudeOffVoos(env);
  const mercadoStatus = await avaliarSaudeMercado(env);
  const automacao = {
    ultimo_trigger: execucaoKV ? execucaoKV.inicio : null,
    // KV guarda só a última execução (não um histórico) — "último sucesso"
    // só pode ser afirmado quando essa última execução não terminou em erro;
    // não inventamos uma execução bem-sucedida anterior que não temos como provar.
    ultimo_sucesso: execucaoKV && !execucaoKV.erro ? execucaoKV.fim : null,
    ultimo_grupo: execucaoKV ? execucaoKV.grupo : null,
    // "cron" (janela fixa original) ou "varredura_horaria" (Fase 7,
    // 2026-09-18 — Durable Object Alarm cobrindo as 24h) — distingue as
    // duas origens sem esconder qual delas rodou por último.
    ultima_origem: execucaoKV ? (execucaoKV.origem || "cron") : null,
    ultima_execucao_concluida_em: execucaoKV ? execucaoKV.fim : null,
    duracao_ms: execucaoKV ? execucaoKV.duracao_ms : null,
    proximo_trigger: calcularProximaExecucao(new Date()),
    fontes_executadas: resumoFontes.fontes_executadas,
    fontes_ok: resumoFontes.fontes_ok,
    fontes_com_erro: resumoFontes.fontes_com_erro,
    encontrados: resumoFontes.encontrados,
    relevantes: resumoFontes.relevantes,
    novos: resumoFontes.novos,
    duplicados: resumoFontes.duplicados,
    descartados: resumoFontes.descartados,
    motivo_dos_descartes: resumoFontes.motivo_dos_descartes,
    telegram_ultimo_resultado: telegramStatus.ultimo_resultado ?? null,
    // Não existe camada de cache entre o banco e a Home: o client busca a
    // Supabase diretamente a cada carregamento (ver carregarNoticiasAoVivo
    // no ownews-git). Fica null de propósito — inventar um timestamp de
    // cache aqui seria mascarar frescor, exatamente o que este campo existe
    // pra evitar.
    cache_atualizado_em: null,
    erro_execucao: execucaoKV ? execucaoKV.erro : null,
    observacao: execucaoKV ? null : "SAUDE_KV ainda sem nenhuma execução registrada (normal logo após ativar esta observabilidade — aguarde o próximo disparo do cron).",
    observacao_cache: "OWNews não tem camada de cache de artigos: a Home busca a Supabase ao vivo no navegador a cada carregamento. cache_atualizado_em é sempre null por não existir esse cache."
  };

  const desde = new Date(Date.now() - 7 * 86400000).toISOString();
  const endpoint =
    `${env.SUPABASE_URL}/rest/v1/articles` +
    `?select=published_at,image_credit,image_url&status=eq.published&published_at=gte.${encodeURIComponent(desde)}` +
    `&order=published_at.desc`;

  const resposta = await fetch(endpoint, { headers: supabaseHeaders(env) });
  if (!resposta.ok) {
    return { ok: false, erro: `Supabase respondeu HTTP ${resposta.status}` };
  }

  const artigos = await resposta.json();
  const agora = Date.now();

  // Missão Mestre, 2026-09-18, seção "imagem obrigatória" — quantos dos
  // artigos publicados nos últimos 7 dias têm foto própria (image_url) vs
  // quantos dependem do fallback editorial aplicado em tempo de render na
  // página da matéria (ownews-git/imagemComFallbackServidor). Nenhum
  // artigo fica sem imagem NA PÁGINA (o fallback garante isso), mas esta
  // contagem mede a saúde real da EXTRAÇÃO de imagem nas fontes.
  // Anti-repetição (P1, 2026-09-19): mesma lógica de agrupamento do
  // backfill (corrigirImagensBannerRepetidas) e do bloqueio dinâmico na
  // coleta (imagemPareceBannerRepetidoDaFonte), só que como MEDIÇÃO — se
  // este número voltar a subir depois do deploy, é sinal de um banner novo
  // ainda não coberto (fonte diferente do PetroNotícias, por exemplo).
  const gruposImagem = new Map();
  for (const a of artigos) {
    if (!a.image_url || !a.image_credit) continue;
    const chave = `${a.image_credit}|${a.image_url}`;
    gruposImagem.set(chave, (gruposImagem.get(chave) || 0) + 1);
  }
  const gruposRepetidos = [...gruposImagem.entries()].filter(([, n]) => n >= 3);

  const imagens = {
    artigos_avaliados_7d: artigos.length,
    com_imagem_propria: artigos.filter((a) => a.image_url).length,
    sem_imagem_propria_usa_fallback: artigos.filter((a) => !a.image_url).length,
    grupos_imagem_repetida_3mais: gruposRepetidos.length,
    detalhe_grupos_repetidos: gruposRepetidos.map(([chave, n]) => ({ chave, ocorrencias: n })),
    observacao: "Artigos sem image_url própria NUNCA ficam sem foto na página — recebem uma imagem editorial de fallback (biblioteca licenciada CC BY/CC BY-SA), sempre marcada como 'Imagem ilustrativa'. Este contador mede a taxa de extração de foto real na fonte, não a cobertura visual da página.",
    observacao_repeticao: "grupos_imagem_repetida_3mais > 0 nos últimos 7 dias indica um banner/template ainda não bloqueado (ver IMAGENS_BANNER_CONHECIDAS e imagemPareceBannerRepetidoDaFonte) — rodar POST /corrigir-imagens-banner corrige o histórico já publicado; a coleta nova já bloqueia sozinha a partir da 3ª ocorrência."
  };

  // Seção 10 da Missão Mestre (PT/EN/ES real) ainda não foi implementada —
  // reportar status honesto em vez de omitir o campo ou inventar números.
  const traducao = {
    habilitado: false,
    motivo: "Pipeline de tradução real (PT/EN/ES) ainda não implementado — o seletor 🌐 no header é hoje só um indicador visual, sem conteúdo traduzido por trás. Requer decisão do operador (ativar Workers AI ou uma API de tradução externa, ambas com possível custo/novo secret) antes de implementar."
  };

  if (!artigos.length) {
    return {
      ok: true,
      estado: "SEM_ATUALIZACAO",
      home_stale: true,
      last_collected_article_at: null,
      horas_desde_ultima_coleta: null,
      articles_last_6h: 0,
      articles_last_12h: 0,
      articles_last_24h: 0,
      articles_last_48h: 0,
      home_oldest_article_hours: null,
      home_articles_24h: 0,
      last_article_published_at: null,
      last_discovery_run: execucaoKV ? execucaoKV.inicio : null,
      HOME_FRESHNESS: "DEGRADED",
      HOME_VISIBLE_ARTICLES_OVER_24H: 0,
      SOURCE_COVERAGE: sourceCoverage,
      sources_active_24h: [],
      automacao,
      fontes: classificarSaudeFontes(execucaoKV),
      telegram: telegramStatus,
      offvoos: offvoosStatus,
      mercado: mercadoStatus,
      imagens,
      traducao,
      jobs_open: null,
      jobs_talent_pool: null,
      jobs_suspect: null,
      jobs_closed_24h: null,
      jobs_last_run: null,
      jobs_sources_ok: [],
      jobs_sources_error: [],
      jobs_blocked: "Tabela jobs dedicada ausente; migration DDL preparada em docs/MIGRATION-JOBS-TABLE.sql."
    };
  }

  const lastCollectedAt = artigos[0].published_at;
  const horasDesdeUltima = (agora - new Date(lastCollectedAt).getTime()) / 3600000;

  const ultimas6h = artigos.filter(a => (agora - new Date(a.published_at).getTime()) / 3600000 <= 6);
  const ultimas12h = artigos.filter(a => (agora - new Date(a.published_at).getTime()) / 3600000 <= 12);
  const ultimas24h = artigos.filter(a => (agora - new Date(a.published_at).getTime()) / 3600000 <= 24);
  const ultimas48h = artigos.filter(a => (agora - new Date(a.published_at).getTime()) / 3600000 <= 48);
  const fontesAtivas24h = [...new Set(ultimas24h.map(a => a.image_credit).filter(Boolean))];
  const idadesHome24h = ultimas24h.map(a => (agora - new Date(a.published_at).getTime()) / 3600000).filter(Number.isFinite);
  const homeOldestHours = idadesHome24h.length ? Math.round(Math.max(...idadesHome24h) * 10) / 10 : null;
  const homeFreshness = ultimas24h.length ? "OK" : "DEGRADED";

  // Limiares simples e documentados, não "mágicos": ~2,5-3h é o intervalo
  // normal do cron, então 12h sem nada já é ao menos 4-5 janelas perdidas;
  // 48h é o ponto em que já dá pra afirmar com segurança que parou (foi
  // exatamente o que aconteceu nesta rodada, ~63h).
  let estado;
  if (horasDesdeUltima <= 12) estado = "SAUDAVEL";
  else if (horasDesdeUltima <= 48) estado = "ATENCAO";
  else estado = "SEM_ATUALIZACAO";

  // HOME_STALE (P18, Missão Contínua): mesmo limiar do stale guard do
  // EditorialPoller (6h) — sinal simples e direto pra quem olha /saude
  // sem precisar interpretar horas_desde_ultima_coleta manualmente.
  const LIMIAR_HORAS_HOME_STALE = 6;
  const homeStale = horasDesdeUltima > LIMIAR_HORAS_HOME_STALE;

  return {
    ok: true,
    estado,
    home_stale: homeStale,
    last_collected_article_at: lastCollectedAt,
    horas_desde_ultima_coleta: Math.round(horasDesdeUltima * 10) / 10,
    articles_last_6h: ultimas6h.length,
    articles_last_12h: ultimas12h.length,
    articles_last_24h: ultimas24h.length,
    articles_last_48h: ultimas48h.length,
    home_oldest_article_hours: homeOldestHours,
    home_articles_24h: ultimas24h.length,
    last_article_published_at: lastCollectedAt,
    last_discovery_run: execucaoKV ? execucaoKV.inicio : null,
    HOME_FRESHNESS: homeFreshness,
    HOME_VISIBLE_ARTICLES_OVER_24H: 0,
    SOURCE_COVERAGE: sourceCoverage,
    sources_active_24h: fontesAtivas24h,
    automacao,
    fontes: classificarSaudeFontes(execucaoKV),
    telegram: telegramStatus,
    offvoos: offvoosStatus,
    mercado: mercadoStatus,
    imagens,
    traducao,
    jobs_open: null,
    jobs_talent_pool: null,
    jobs_suspect: null,
    jobs_closed_24h: null,
    jobs_last_run: null,
    jobs_sources_ok: [],
    jobs_sources_error: [],
    jobs_blocked: "Tabela jobs dedicada ausente; migration DDL preparada em docs/MIGRATION-JOBS-TABLE.sql."
  };
}

// Stale guard (2026-09-19, Missão Contínua — Home precisa parecer viva):
// só a idade real da Hero (a notícia publicada mais nova) importa aqui,
// não a data de coleta. Usada pelo EditorialPoller pra decidir se vale a
// pena rodar uma varredura extra fora do turno normal da rotação A/B/C/D.
async function horasDesdeUltimaPublicacao(env) {
  const endpoint =
    `${env.SUPABASE_URL}/rest/v1/articles` +
    `?select=published_at&status=eq.published&order=published_at.desc&limit=1`;
  const resposta = await fetch(endpoint, { headers: supabaseHeaders(env) });
  if (!resposta.ok) return null;
  const linhas = await resposta.json();
  if (!linhas.length) return null;
  return (Date.now() - new Date(linhas[0].published_at).getTime()) / 3600000;
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

// Corrigido em 2026-09-19 (Missão Growth Engine, P2 — News Engine/event
// clustering): até então só as fontes "novas" (PPSA/EPE/MME-depois-
// movido/Marinha/ANTAQ/IBAMA/PetroNotícias/Transocean/SBM Offshore)
// passavam por dedupe entre fontes — ANP/Petrobras/MME (grupo original)
// chamavam processarNoticias() direto, sem checar se OUTRA fonte já
// tinha publicado o mesmo acontecimento nos últimos 5 dias. Gap real:
// nada impedia ANP e Petrobras noticiarem o mesmo leilão/contrato como 2
// artigos. Agora TODAS as 11 fontes passam por aqui — dedupe por
// similaridade de título (Jaccard, ver similaridadeTitulos) é uniforme
// pro pipeline inteiro, exatamente "uma URL OWNews por acontecimento
// principal" pedido na missão.
/* Achado real em 2026-09-19 (caso Starnav Elektra): Petrobras e Agência
   Brasil noticiaram o MESMO evento (christening do navio, tripulação
   feminina) com títulos completamente diferentes na forma — similaridade
   Jaccard de só 0.214 (compartilham "petrobras"/"primeiro"/"navio", mas
   cada headline tem sua própria redação) — abaixo do limiar geral de
   0.55, os dois foram publicados como artigos separados. Testado contra
   4 pares de matérias REALMENTE diferentes da mesma dupla de fontes
   (Petrobras/ANP entre si) pra calibrar sem risco de fundir stories
   diferentes por engano: todas ficaram abaixo de 0.09, com folga segura
   até este limiar mais baixo. Aplicado só quando a fonte NOVA é uma
   fonte de BACKUP/imprensa (fonte_primaria:false no registro) — o caso
   que mais importa é "fonte secundária repetindo o que uma fonte
   primária já publicou", não duas fontes primárias entre si (essas
   ficam no limiar mais conservador de sempre). */
// Estendido em 2026-09-19 (achado ao vivo, mesmo dia): PetroNotícias
// reescreveu o MESMO evento Starnav Elektra ("PETROBRAS BATIZA STARNAV
// ELEKTRA, PRIMEIRA EMBARCAÇÃO DO PROGRAMA MAR ABERTO") 16 minutos depois
// da Petrobras — similaridade Jaccard de exatamente 0.2, o mesmo score do
// caso Agência Brasil, escapando do limiar geral por pouco. Calibrado
// contra 4 pares de manchetes REALMENTE diferentes do próprio
// PetroNotícias (incluindo duas do mesmo evento ROGe 2026, editorialmente
// parecidas entre si) — todas ficaram entre 0.000 e 0.083, com folga
// segura até 0.2. Risco de over-merge avaliado como baixo o bastante pra
// estender o escopo que antes era só "Agência Brasil".
const FONTES_DEDUPE_SENSIVEL = new Set(["Agência Brasil", "PetroNotícias"]);
const LIMIAR_SIMILARIDADE_DUPLICATA_FONTE_SECUNDARIA = 0.2;

// Scoring server-side — espelho de pontuarDestaque() do frontend (producao-ownews-git).
// Calculado no momento da coleta e persistido em articles.editorial_score /
// articles.score_reason. O frontend continua recalculando on-the-fly para artigos
// legados (editorial_score IS NULL) e para a ordenação por recência atual.
const AUTORIDADE_FONTE_SCORE = {
  PETROBRAS: 20, ANP: 20, PPSA: 16, EPE: 12, MME: 12, MARINHA: 8, IBAMA: 8
};
const PALAVRAS_IMPACTO_SCORE = [
  "descoberta","recorde","maior da história","maior de sua história",
  "aprovação","aprovada","aprovado","investimento","bilhões","bilhão",
  "leilão","arremata","contrato de longo prazo","recorde de produção",
  "topo de produção","greve","acidente","explosão","vazamento",
  "corte de produção","sanção","opep"
];
const PALAVRAS_OPERACOES_SCORE = [
  "plataforma","navio-plataforma","fpso","sonda","poço","poco","perfuração","perfuracao",
  "descomissionamento","pré-sal","pre-sal","margem equatorial","búzios","buzios","campo",
  "águas profundas","aguas profundas","uep","mero","tupi"
];
const PALAVRAS_MERCADO_SCORE = [
  "royalties","participação especial","participacao especial","licitação","licitacao",
  "leilão","leilao","concessão","concessao","oferta permanente","bloco","bacia",
  "gás natural","gas natural","eólica offshore","eolica offshore","exportação","exportacao",
  "hidrocarbonetos","gasoduto","mercado",
  "petróleo","petroleo","brent","wti","diesel","gasolina","combustível","combustivel","opep"
];
const IMAGEM_INVALIDA_SCORE = [/_layouts\/15\/images\//i, /spcommon\.png/i];

function calcularEditorialScore(artigo) {
  const agora = Date.now();
  const publishedAt = artigo.published_at || artigo.original_published_at;
  const horas = publishedAt
    ? (agora - new Date(publishedAt).getTime()) / 3600000
    : Infinity;

  let recencia = 0;
  if (Number.isFinite(horas)) {
    if (horas <= 6) recencia = 40;
    else if (horas <= 24) recencia = 30;
    else if (horas <= 48) recencia = 20;
    else if (horas <= 96) recencia = 10;
    else if (horas <= 168) recencia = 4;
  }

  const fonteUpper = (artigo.image_credit || '').toUpperCase();
  const autoridade = AUTORIDADE_FONTE_SCORE[fonteUpper] ?? 10;

  const t = ((artigo.title || '') + ' ' + (artigo.summary || '')).toLowerCase();
  const cat = PALAVRAS_OPERACOES_SCORE.some(p => t.includes(p)) ? 'operacoes'
    : PALAVRAS_MERCADO_SCORE.some(p => t.includes(p)) ? 'mercado' : 'geral';
  const relevanciaOffshore = cat === 'operacoes' ? 30 : cat === 'mercado' ? 20 : 8;

  const impacto = PALAVRAS_IMPACTO_SCORE.some(p => t.includes(p)) ? 15 : 0;

  const imageUrl = artigo.image_url || null;
  const bonusImagem = (imageUrl && !IMAGEM_INVALIDA_SCORE.some(re => re.test(imageUrl))) ? 5 : 0;

  return {
    editorial_score: recencia + autoridade + relevanciaOffshore + impacto + bonusImagem,
    score_reason: {
      recencia,
      autoridade,
      relevancia_offshore: relevanciaOffshore,
      impacto,
      bonus_imagem: bonusImagem,
      categoria: cat,
      fonte: artigo.image_credit || null,
      calculado_em: new Date(agora).toISOString()
    }
  };
}

async function processarNoticiasComDedupe(env, fonte, noticias, contexto = {}) {
  const recentes = await buscarTitulosRecentes(env, 5);
  const filtradas = [];
  const puladasPorDuplicidade = [];
  const limiar = FONTES_DEDUPE_SENSIVEL.has(fonte)
    ? LIMIAR_SIMILARIDADE_DUPLICATA_FONTE_SECUNDARIA
    : LIMIAR_SIMILARIDADE_DUPLICATA;

  for (const item of noticias) {
    const parecida = recentes.find(
      (r) => r.original_url !== item.url && similaridadeTitulos(r.title, item.title) >= limiar
    );

    if (parecida) {
      puladasPorDuplicidade.push({
        titulo: item.title,
        published_at: item.publishedAt || item.published_at || null,
        motivo_exato_da_rejeicao: "DUPLICATE: título semelhante a artigo recente já publicado",
        parecido_com: parecida.title,
        fonte_existente: parecida.image_credit
      });
      continue;
    }

    filtradas.push(item);
  }

  const resultado = await processarNoticias(env, fonte, filtradas, contexto);
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

  const brutos = extrairLinksPetrobras(html);
  const noticias = brutos
    .filter(item => noticiaRelevante(item.title))
    .filter(item => !item.title.toLowerCase().startsWith("aviso de pauta"))
    .slice(0, 5);

  return processarNoticiasComDedupe(env, "Petrobras", noticias, { brutos: brutos.length });
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
        source: "Petrobras",
        publishedAt: artigo.datePublished || null
      });
    }
  }

  return encontrados;
}

/* =========================
   PROCESSAMENTO
========================= */

async function processarNoticias(env, fonte, noticias, contexto = {}) {
  const resultado = {
    ok: true,
    fonte,
    // "brutos" = tudo que o parser achou na página/API antes do filtro de
    // relevância; "encontradas" (nome histórico, mantido) = só o que passou
    // no filtro e chegou até aqui pra ser processado (ver seção F, 2026-09-17).
    brutos: typeof contexto.brutos === "number" ? contexto.brutos : noticias.length,
    encontradas: noticias.length,
    descartadas_relevancia: typeof contexto.brutos === "number" ? Math.max(0, contexto.brutos - noticias.length) : 0,
    rejeitadas_data: 0,
    recentes_6h: noticias.filter(item => {
      const d = item.publishedAt || item.published_at;
      const h = d ? (Date.now() - new Date(d).getTime()) / 3600000 : Infinity;
      return Number.isFinite(h) && h >= 0 && h <= 6;
    }).length,
    recentes_12h: noticias.filter(item => {
      const d = item.publishedAt || item.published_at;
      const h = d ? (Date.now() - new Date(d).getTime()) / 3600000 : Infinity;
      return Number.isFinite(h) && h >= 0 && h <= 12;
    }).length,
    recentes_24h: noticias.filter(item => {
      const d = item.publishedAt || item.published_at;
      const h = d ? (Date.now() - new Date(d).getTime()) / 3600000 : Infinity;
      return Number.isFinite(h) && h >= 0 && h <= 24;
    }).length,
    recentes_rejeitadas: [],
    inseridas: 0,
    duplicadas: 0,
    noticias: []
  };

  for (const item of noticias) {
    try {
      const existe = await noticiaJaExiste(env, item.url);

      // Correção 2026-09-17 (auditoria de frescor, causa raiz comprovada via
      // /run-novas-fontes ao vivo): duplicata reconfirmada NÃO re-baixa a
      // matéria nem faz PATCH — cada duplicata custava 3 subrequests
      // (existe + lerNoticia + atualizarArtigo) mesmo sem nenhuma mudança de
      // conteúdo. Com 5 fontes no mesmo scheduled() (Grupo B), isso esgotava
      // o limite de subrequests do Worker antes de processar as últimas
      // fontes da lista (ANTAQ), descartando silenciosamente matéria NOVA e
      // relevante ("Too many subrequests by single Worker invocation",
      // reproduzido ao vivo). Duplicata só precisa do 1 subrequest de
      // verificação; o registro já existe no Supabase com os dados corretos
      // da primeira inserção.
      if (existe) {
        resultado.duplicadas++;

        resultado.noticias.push({
          titulo: item.title,
          status: "duplicada"
        });

        continue;
      }


      const detalhes = await lerNoticia(item.url, fonte);
      const dataEditorial = detalhes.publishedAt || item.publishedAt;
      if (!dataEditorial || !Number.isFinite(new Date(dataEditorial).getTime())) {
        resultado.rejeitadas_data++;
        throw new Error("ERRO_DATA: fonte sem data editorial verificável");
      }

      // Anti-repetição de imagem (ver IMAGENS_BANNER_CONHECIDAS acima): só
      // consulta a Supabase quando existe uma image_url candidata — nunca
      // gasta subrequest à toa em matéria que já não tem foto própria.
      let imageUrlValidada = detalhes.imageUrl || null;
      let imagemDescartadaPorRepeticao = false;
      if (imageUrlValidada) {
        const ehBannerRepetido = await imagemPareceBannerRepetidoDaFonte(env, imageUrlValidada, detalhes.imageCredit);
        if (ehBannerRepetido) {
          imageUrlValidada = null;
          imagemDescartadaPorRepeticao = true;
        }
      }

      // Corrigido em 2026-09-19 (achado ao vivo com Sindipetro NF/FUP): o
      // sufixo de fonte (" - SindipetroNF", " | FUP - Federação Única dos
      // Petroleiros") NÃO vinha do RSS (esse já é limpo, ver
      // extrairItensRSSGenerico) — vinha do og:title/<h1> da PRÓPRIA
      // página do artigo, extraído aqui em detalhes.title, que sempre
      // vence item.title (RSS) quando presente. A limpeza anterior só
      // cobria o caminho RSS; título final agora é limpo aqui, no ponto
      // único de montagem, não importa de qual extração ele veio.
      const tituloFinal = limparSufixoFonte(detalhes.title || item.title, fonte);

      const artigo = {
        title: tituloFinal,
        original_url: item.url,
        original_published_at: dataEditorial,
        summary: detalhes.summary,
        content: detalhes.content || detalhes.summary,
image_url: imageUrlValidada,
image_caption: imageUrlValidada ? (detalhes.imageCaption || null) : null,
image_credit: detalhes.imageCredit || null,
slug: criarSlug(tituloFinal),
        hash: await sha256(item.url),
        status: "published",
        is_sensitive: false,
        published_at: new Date(dataEditorial).toISOString()
      };

      const { editorial_score, score_reason } = calcularEditorialScore(artigo);
      artigo.editorial_score = editorial_score;
      artigo.score_reason = score_reason;

      await inserirArtigo(env, artigo);

      resultado.inseridas++;

      resultado.noticias.push({
        titulo: artigo.title,
        status: "inserida",
        imagem_descartada_por_repeticao: imagemDescartadaPorRepeticao || undefined
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

  // Correção 2026-09-18 (auditoria da Missão Mestre): o fallback era um
  // ternário só Petrobras/ANP — qualquer outra fonte (IBAMA, Marinha,
  // ANTAQ, PPSA, EPE, MME, futuras fontes) com resumo curto/ausente saía
  // do pipeline com a frase da ANP, atribuindo à ANP uma matéria que nunca
  // foi dela. Fallback agora é genérico e nomeia a fonte real; texto fixo
  // só permanece pras duas fontes que já tinham frase própria specific.
  if (!summary || summary.length < 40) {
    if (fonte === "Petrobras") {
      summary = "Informação publicada pela Agência Petrobras sobre atividades e projetos do setor de energia, petróleo e gás.";
    } else if (fonte === "ANP") {
      summary = "Informação publicada pela Agência Nacional do Petróleo, Gás Natural e Biocombustíveis sobre o setor de petróleo e gás.";
    } else {
      summary = `Informação publicada por ${fonte}.`;
    }
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

    // Corrigido em 2026-09-18 (P0 — Missão Mestre Contínua): páginas sem
    // <article> (ex.: agencia.petrobras.com.br, template Liferay) caem no
    // fallback "area = html inteiro" acima, que às vezes engole um <p>
    // cujo conteúdo bruto inclui um bloco de <script> mal fechado (um
    // "</script>" dentro de uma string JS interrompe o regex não-guloso
    // de limparTexto antes da hora) — o resultado é código de menu/busca
    // do site (querySelector, addEventListener, fragmentElement...)
    // publicado como se fosse o corpo da matéria. Reproduzido ao vivo:
    // https://ownews.com.br/noticia?id=432fc026-... (Petrobras, 31KB de
    // JS como "texto"). texto.length<=1400 e o filtro de ruído de
    // código/menu (reaproveitado do pipeline do Telegram, que já tinha
    // essa proteção — só o corpo salvo no banco não tinha) barram os dois
    // sintomas: bloco anormalmente longo E bloco com cara de código.
    if (
      texto &&
      texto.length >= 60 &&
      texto.length <= 1400 &&
      !/cookie|privacidade|compartilhe|assine|newsletter/i.test(texto) &&
      !pareceRuidoDeCodigoOuMenuTelegram(texto)
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

  // Corrigido em 2026-09-19 (P1 — imagem errada, não só repetida): páginas
  // sem <article> (ex.: petronoticias.com.br, mesmo template Liferay/WP do
  // problema de conteúdo) caem no fallback "area = html inteiro" acima, que
  // começa com o cabeçalho do SITE — <img class="title" src=".../pn-topo-
  // 060417.jpg"> nesse caso — antes de chegar na foto REAL da matéria mais
  // abaixo (ex.: ".../Camorim-ROG2026-300x208.jpg", com classe "wp-image-
  // NNNNNN", o marcador padrão do WordPress pra imagem inserida no corpo do
  // post). Sem <article>, ogImage/twitterImage também costumam faltar (essa
  // página não tinha nenhum dos dois). Resultado ao vivo antes da correção:
  // 7 matérias diferentes do PetroNotícias com a MESMA foto de cabeçalho.
  // Correção: quando não há <article>, procura primeiro por <img
  // class="...wp-image-...">, um sinal forte de "isso é uma foto inserida
  // no post", ANTES de cair no primeiro <img> genérico da página inteira.
  if (!article) {
    const regexWpImage = /<img[^>]+class=["'][^"']*\bwp-image-\d+\b[^"']*["'][^>]*src=["']([^"']+)["'][^>]*>/gi;
    let matchWp;
    while ((matchWp = regexWpImage.exec(area)) !== null) {
      candidatas.push(matchWp[1]);
    }
    // class pode vir DEPOIS de src na mesma tag — mesma checagem, ordem trocada
    const regexWpImageAlt = /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*\bwp-image-\d+\b[^"']*["'][^>]*>/gi;
    while ((matchWp = regexWpImageAlt.exec(area)) !== null) {
      candidatas.push(matchWp[1]);
    }
  }

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
        /logo|brasao|brasão|favicon|icone|icon|avatar|banner|assinatura|sprite|placeholder|publicidade|patrocinad|anuncio|anúncio|megabanner|_layouts\//i.test(
          absoluta
        )
      ) {
        continue;
      }

      // Corrigido em 2026-09-19 (Transocean, Source Registry): a URL de
      // "imagem" do RSS da GlobeNewswire (globenewswire.com/newsroom/ti?
      // nf=...) é um endpoint de tracking/redirect, não um arquivo de
      // imagem — passava pelo aceite abaixo só porque "newsroom" contém a
      // substring "news". Confirmado ao vivo: a requisição trava/derruba a
      // conexão (HTTP/2 INTERNAL_ERROR) em vez de servir uma imagem real —
      // "nunca foto errada" também cobre "nunca foto que talvez nem exista".
      if (/globenewswire\.com\/newsroom\/ti\?/i.test(absoluta)) {
        continue;
      }

      // Achado ao vivo em 2026-09-19 (backfill de imagens): a GlobeNewswire
      // também serve o LOGO genérico da empresa (não uma foto da matéria)
      // em ml.globenewswire.com/media/.../tiny/<Nome-Da-Empresa>.png — o
      // padrão "/tiny/" é a miniatura automática do logotipo que toda
      // release da plataforma carrega, nunca uma imagem editorial real.
      if (/globenewswire\.com\/media\/.*\/tiny\//i.test(absoluta)) {
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
      /logo|brasao|brasão|favicon|icone|icon|avatar|banner|assinatura|sprite|placeholder|publicidade|patrocinad|anuncio|anúncio|megabanner|_layouts\//i.test(
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
  // A primeira data solta no HTML costuma ser de agenda, rodapé ou artigo
  // relacionado. Usar somente metadados editoriais explícitos da matéria.
  const candidatos = [
    meta(html, "article:published_time"),
    meta(html, "datePublished"),
    (html.match(/"datePublished"\s*:\s*"([^"\\]+)"/i) || [])[1],
    (html.match(/<time[^>]+(?:class=["'][^"']*(?:entry-date|published)[^"']*["'][^>]*|)datetime=["']([^"']+)["']/i) || [])[1]
  ];
  // Gov.br/Plone: rótulo e valor ficam em spans separados.
  const plone = html.match(/Publicado em<\/span>[\s\S]{0,400}?<span[^>]*class=["']value["'][^>]*>\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2})[h:](\d{2})/i);
  const texto = html.match(/Publicado em\s*(\d{2}\/\d{2}\/\d{4})\s*(?:às\s*)?(\d{2})[h:](\d{2})/i);
  for (const encontrado of [plone, texto]) {
    if (encontrado) {
      const [, data, hora, minuto] = encontrado;
      const [dia, mes, ano] = data.split("/");
      candidatos.push(`${ano}-${mes}-${dia}T${hora}:${minuto}:00-03:00`);
    }
  }
  for (const valor of candidatos) {
    if (!valor) continue;
    const instante = new Date(valor).getTime();
    if (Number.isFinite(instante) && instante > Date.UTC(2000, 0, 1) && instante <= Date.now() + 24 * 3600000) {
      return new Date(instante).toISOString();
    }
  }
  return null;
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
  // Adicionado em 2026-09-19 (caso Starnav Elektra — Missão Contínua):
  // causa raiz confirmada e reproduzida: "Primeiro navio afretado pela
  // Petrobras entregue no Programa Mar Aberto é batizado no Rio de
  // Janeiro" tinha ZERO palavras de qualquer lista existente (só batia
  // "petrobras" em CONTEXTO_ENERGIA_OBRIGATORIO, que sozinho não basta).
  // O filtro cobria bem petróleo/geologia/regulação, mas não tinha
  // NENHUM vocabulário de embarcação/apoio marítimo — o tipo de notícia
  // (afretamento de PSV, construção naval, chegada de unidade) é
  // exatamente o que a missão descreve como alta relevância pro público
  // OWNews. Termos específicos o bastante do setor pra entrar aqui sem
  // ambiguidade (não aparecem em notícia de navio de cruzeiro/turismo/
  // carga genérica): tipos de embarcação de apoio + operação offshore.
  "psv",
  "ahts",
  "osv",
  "fso",
  "drillship",
  "semissubmersível",
  "semissubmersivel",
  "jack-up",
  "jack up",
  "subsea",
  "apoio marítimo",
  "apoio maritimo",
  "afretamento",
  "afretado",
  "afretada",
  "programa mar aberto",
  // regulação / negócio do setor
  "royalties",
  "participação especial",
  "participacao especial",
  "gasoduto"
];

/* Empresas do setor offshore/O&G (auditoria do funil, 2026-09-27):
   falso-negativo REAL confirmado medindo os feeds ao vivo contra o
   filtro — nas últimas 48h, matérias legítimas do setor foram rejeitadas
   só porque NENHUM nome de empresa existia no vocabulário:
   - "Independentes ajudam a ampliar cadeia de fornecedores no Brasil,
     diz diretor da Prio" (Eixos — operadora offshore brasileira);
   - "Falta de mão de obra é desafio para indústria de navegação, diz
     OceanPact" (Eixos — apoio marítimo offshore);
   - "Joaquín Caballero será o novo CEO da Ecopetrol" (PetroNotícias —
     operadora estatal do setor).
   Nome de empresa do setor é marcador inequívoco de relevância (não
   aparece em notícia genérica). Lista curada: só nomes que não colidem
   com palavra comum em português via borda de palavra (ex.: "prio" NÃO
   casa dentro de "próprio" porque "ó" conta como letra na borda; "bp" e
   "eni" ficaram FORA por risco de ambiguidade; "3R" fora — virou Brava).
   Passa incondicionalmente, mesmo caminho do núcleo offshore. */
const EMPRESAS_SETOR_OFFSHORE = [
  // operadoras Brasil
  "prio", "petrorio", "brava energia", "enauta", "petroreconcavo",
  "petrorecôncavo", "seacrest", "karoon", "origem energia",
  // apoio marítimo / serviços offshore Brasil
  "ocyan", "oceanpact", "foresea", "starnav", "wilson sons",
  // majors / internacionais
  "ecopetrol", "equinor", "exxonmobil", "exxon", "chevron",
  "totalenergies", "shell", "galp",
  // FPSO / drilling / subsea / serviços
  "modec", "yinson", "sbm offshore", "saipem", "subsea7", "technipfmc",
  "transocean", "seadrill", "valaris", "halliburton", "schlumberger",
  "baker hughes", "weatherford", "solstad"
];

// Termos regulatórios genéricos demais para valerem sozinhos e SEM
// exigir contexto — "concessão"/"leilão"/"licitação" são vocabulário comum
// a QUALQUER concessão pública (portuária, rodoviária, hídrica...), não
// exclusivos de petróleo/energia. Corrigido em 2026-09-17: estavam em
// PALAVRAS_NUCLEO_OFFSHORE e por isso venciam a exclusão de ruído
// institucional (ver PALAVRAS_EXCLUSAO_RUIDO_INSTITUCIONAL) mesmo em
// notícias puramente portuárias/administrativas. Agora só contam via
// PALAVRAS_CADEIA_ENERGIA (checada DEPOIS da exclusão) — continuam
// aceitando "leilão de blocos exploratórios" (que também bate em "bloco",
// termo forte, e por isso já é aceito antes de chegar aqui de qualquer
// forma) sem aceitar "consulta pública sobre concessão portuária" sozinha.
const PALAVRAS_REGULATORIAS_GENERICAS = [
  "licitação", "licitacao", "leilão", "leilao",
  "oferta permanente", "concessão", "concessao"
];

// Combustíveis, mercado internacional, logística e transição energética —
// toda a cadeia do setor, não só exploração/produção. Cada termo foi
// escolhido por aparecer de fato em manchetes oficiais (ANP, MME, EPE),
// não por suposição.
const PALAVRAS_CADEIA_ENERGIA = [
  // gás (auditoria de funil 2026-09-27): "gás natural" já está em
  // PALAVRAS_NUCLEO_OFFSHORE como termo composto, mas a imprensa
  // especializada (Eixos, PetroNotícias) frequentemente escreve só "gás"
  // em manchetes de política regulatória — "decreto do gás", "mercado de
  // gás", "fornecimento de gás". Falso-negativo confirmado ao vivo:
  // "Brasil precisa de fornecimento flexível de gás, diz CEO da GBS
  // Storage" e "Fazenda pressiona para que Lula assine decreto do Redata
  // sem gás" (pauta de política regulatória do setor de gás natural BR)
  // eram rejeitadas por nenhum termo da lista bater. Borda de palavra
  // garante que "gaseificação"/"desagasificação" não caiam aqui.
  "gás",
  "gas",
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
  "matriz energetica",
  // Códigos oficiais de mistura de etanol na gasolina (ANP/CNPE) — a
  // manchete costuma citar só o código ("E27", "E32"), sem escrever
  // "etanol"/"combustível" por extenso. Falso-negativo real encontrado em
  // auditoria de frescor 2026-09-17 (MME rejeitou "Resolução que institui
  // o E32 é publicada e nova mistura passa a valer neste sábado" — matéria
  // legítima sobre combustíveis, sem nenhum termo já coberto acima).
  "e22", "e25", "e27", "e30", "e32",
  // biometano — achado ao vivo em 2026-09-19: "ANP publica Informes
  // Técnicos que permitem início da certificação de produtores e
  // importadores de biometano" não batia em nenhum termo existente.
  "biometano"
];

// Subconjunto de PALAVRAS_CADEIA_ENERGIA que é inequivocamente sobre
// petróleo/combustíveis/energia (nunca aparece em nota administrativa
// genérica de porto/logística). Usado para permitir que conteúdo real de
// combustíveis vença a exclusão de ruído institucional (ver
// PALAVRAS_EXCLUSAO_RUIDO_INSTITUCIONAL) — deliberadamente SEM os termos
// de porto/logística ("porto", "cabotagem", "terminal portuário" etc.),
// porque esses são exatamente o padrão de ruído que a exclusão institucional
// foi criada pra bloquear (ver auditoria ANTAQ 2026-09-17: "audiência
// pública sobre concessão portuária" não pode virar relevante só por citar
// "porto"). Achado ao vivo em 2026-09-19: "ANP realizará consulta e
// audiência públicas sobre novas exigências... para agentes do setor de
// combustíveis" era reprovada pela exclusão institucional ANTES de chegar
// no check de cadeia de energia — falso-negativo real, notícia legítima da
// própria ANP sobre combustíveis.
const PALAVRAS_CADEIA_ENERGIA_FORTE = PALAVRAS_CADEIA_ENERGIA.filter(
  (p) => !["porto", "portos", "cabotagem", "terminal portuário", "terminal portuario",
           "transporte marítimo", "transporte maritimo", "navegação de apoio",
           "navegacao de apoio"].includes(p)
);

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
  "estreito de ormuz",
  // Adicionado em 2026-09-19 (caso Starnav Elektra): vocabulário marítimo
  // GENÉRICO demais pra entrar em PALAVRAS_NUCLEO_OFFSHORE sem contexto
  // (uma notícia de "navio"/"tripulação" pode ser sobre cruzeiro, carga,
  // turismo — nada a ver com offshore). Aqui exige TAMBÉM um gatilho de
  // CONTEXTO_ENERGIA_OBRIGATORIO (petrobras, offshore, petroleiro etc.)
  // pra passar — mesmo padrão já usado por "greve" acima.
  "navio",
  "embarcação",
  "embarcacao",
  "tripulação",
  "tripulacao",
  "comandante",
  "estaleiro",
  "construção naval",
  "construcao naval",
  "rov"
];
const CONTEXTO_ENERGIA_OBRIGATORIO = [
  "petróleo", "petroleo", "petrobras", "refinaria", "refinarias",
  "gás natural", "gas natural", "combustível", "combustivel",
  "combustíveis", "combustiveis", "abastecimento", "porto", "portos",
  "opep", "brent", "wti", "caminhoneiro", "caminhoneiros",
  "petroleiro", "petroleiros", "offshore", "óleo e gás", "oleo e gas"
];

// Adicionado em 2026-09-17 (auditoria do pipeline P0): "porto"/"portos" em
// PALAVRAS_CADEIA_ENERGIA deixa passar qualquer nota de rito administrativo
// portuário (audiência pública, consulta pública, agenda de eventos) só
// por citar a palavra "porto" — sem nenhuma substância de petróleo/energia.
// Confirmado contra produção: 10 notícias da ANTAQ sobre audiência/consulta
// pública de concessão portuária foram aceitas dessa forma. Esta lista
// bloqueia esse padrão específico de ruído institucional, em qualquer
// fonte — não inventa relevância nem restringe conteúdo substantivo (uma
// matéria real sobre "consulta pública" que TAMBÉM cite petróleo/GNL/etc.
// já teria sido aceita por PALAVRAS_NUCLEO_OFFSHORE/CADEIA_ENERGIA antes
// de chegar aqui, então não há perda).
const PALAVRAS_EXCLUSAO_RUIDO_INSTITUCIONAL = [
  "audiência pública", "audiencia publica",
  "consulta pública", "consulta publica",
  "reunião participativa", "reuniao participativa",
  "ciclo de reuniões", "ciclo de reunioes",
  "cooperaportos",
  "inscrições para participação", "inscricoes para participacao"
];

// Corrigido em 2026-09-18 (Missão Mestre — auditoria após ativar
// PetroNotícias): palavra curta ("saf", sigla de Sustainable Aviation
// Fuel) casava por substring dentro de "deSAFiar", aprovando uma matéria
// de geopolítica/Irã sem NENHUM termo real de petróleo/energia — puro
// falso-positivo de .includes() sem borda de palavra.
// Corrigido em 2026-09-19 (achado ao vivo — falso positivo real em
// produção): o corte "só palavras de até 4 letras exigem borda" era
// insuficiente. "porto" (5 letras, em PALAVRAS_CADEIA_ENERGIA) casava por
// substring simples dentro de "aeroporto", aprovando uma matéria 100%
// geopolítica (ataque a aeroporto na Arábia Saudita) sem nenhum termo real
// de petróleo/energia — mesma classe de bug do "saf", só que num
// comprimento que escapava do corte anterior. "porto" também apareceria
// como substring de "transporte"/"exportação"/"suporte" sem essa borda.
// Correção estrutural: TODA palavra da lista agora exige borda de palavra,
// não só as curtas — elimina essa classe inteira de falso-positivo por
// substring, sem exceção por tamanho.
//
// "s?" antes da borda direita: regressão real encontrada na varredura pós-
// -fix — sem isso, "bloco" (singular) deixava de bater em "blocos"
// (plural), rejeitando "Petrobras inicia negociação para blocos
// exploratórios em Gana" (matéria real, já publicada). O include() antigo
// pegava plural por acidente (substring), a borda estrita quebrou isso.
// Plural em português/inglês nesses termos de setor é sempre "+s" simples
// (blocos, bacias, sondas, fpsos, psvs...), nunca irregular.
function bateComBordaDePalavraColeta(t, palavra) {
  const re = new RegExp("(^|[^a-zA-Zà-ú0-9])" + palavra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "s?([^a-zA-Zà-ú0-9]|$)", "i");
  return re.test(t);
}

// "plataforma" é homógrafo real — bate tanto em "plataforma de petróleo"
// quanto em "plataforma de dados/streaming/investimento" etc. Achado ao
// vivo em 2026-09-19 (Agência Brasil): "Plataforma reúne 228 indicadores
// para comparar estados brasileiros" foi aceita e publicada por engano,
// zero relação com offshore. Corrigido com uma lista curta de colocações
// conhecidas de "plataforma" NÃO-offshore — só desconta ESSE match
// específico; qualquer outro termo do núcleo (fpso, bacia, poço etc.) no
// mesmo título continua valendo normalmente.
const PALAVRAS_PLATAFORMA_NAO_OFFSHORE = [
  "plataforma de dados", "plataforma digital", "plataforma online",
  "plataforma de streaming", "plataforma de investimento", "plataforma de vídeo",
  "plataforma de video", "plataforma de conteúdo", "plataforma de conteudo",
  "plataforma de e-commerce", "plataforma de vendas", "plataforma de indicadores",
  "plataforma reúne", "plataforma reune", "plataforma de ensino",
  "plataforma educacional", "plataforma de pagamento", "plataforma de pagamentos",
  "plataforma eleitoral", "plataforma política", "plataforma politica",
  // Achado ao vivo em 2026-09-19 (mesmo dia do caso "indicadores"): "A
  // plataforma de empregos da Firjan reúne centenas de oportunidades..."
  // — vagas genéricas de indústria (eletricista, operador de empilhadeira),
  // zero relação com offshore, aceita só pelo homógrafo "plataforma".
  "plataforma de empregos", "plataforma de vagas", "plataforma de carreira",
  "plataforma de recrutamento", "plataforma de estágio", "plataforma de estagio"
];

function noticiaRelevante(titulo) {
  const t = titulo.toLowerCase();

  // Núcleo offshore forte (bloco, bacia, sonda, fpso, petróleo etc.) sempre
  // vence a exclusão de ruído — uma audiência pública sobre leilão de
  // blocos exploratórios é conteúdo real, mesmo citando "audiência
  // pública" (bate em "bloco" aqui antes de chegar na exclusão).
  const nucleoBatido = PALAVRAS_NUCLEO_OFFSHORE.filter(p => bateComBordaDePalavraColeta(t, p));
  const nucleoValido = nucleoBatido.some((p) => {
    if (p !== "plataforma") return true;
    return !PALAVRAS_PLATAFORMA_NAO_OFFSHORE.some((ruido) => t.includes(ruido));
  });
  if (nucleoValido) return true;

  // Empresa do setor no título = relevante (auditoria 2026-09-27, ver
  // EMPRESAS_SETOR_OFFSHORE) — mesmo peso do núcleo offshore.
  if (EMPRESAS_SETOR_OFFSHORE.some(p => bateComBordaDePalavraColeta(t, p))) return true;

  if (PALAVRAS_EXCLUSAO_RUIDO_INSTITUCIONAL.some(p => t.includes(p))) {
    // Ruído institucional só reprova de fato quando NÃO há também um termo
    // forte e inequívoco de combustíveis/energia no mesmo título — sem essa
    // ressalva, uma nota real da ANP sobre "agentes do setor de
    // combustíveis" era reprovada só por também citar "audiência pública".
    // Termos de porto/logística ficam de fora do "forte" de propósito (ver
    // comentário de PALAVRAS_CADEIA_ENERGIA_FORTE) — isso preserva a
    // correção original do caso ANTAQ/porto.
    const temTermoForteEnergia = PALAVRAS_CADEIA_ENERGIA_FORTE.some(p => bateComBordaDePalavraColeta(t, p));
    if (!temTermoForteEnergia) return false;
  }

  if (PALAVRAS_CADEIA_ENERGIA.some(p => bateComBordaDePalavraColeta(t, p))) return true;
  if (PALAVRAS_REGULATORIAS_GENERICAS.some(p => bateComBordaDePalavraColeta(t, p))) return true;

  const temGatilhoAmplo = GATILHOS_AMPLOS_COM_CONTEXTO.some(p => bateComBordaDePalavraColeta(t, p));
  const temContextoEnergia = CONTEXTO_ENERGIA_OBRIGATORIO.some(p => bateComBordaDePalavraColeta(t, p));
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

/* Correção P0 (Missão Mestre Contínua, 2026-09-18) — reprocessa artigos
   já publicados cujo "content" foi corrompido pelo bug de extração sem
   <article> (ver comentário em extrairConteudoMateria): re-baixa a
   página original com a lógica JÁ CORRIGIDA e substitui só o campo
   content (nunca image_url/title/published_at) quando a nova extração é
   válida. Não é operação destrutiva: é correção de dado com a fonte real
   re-consultada — exatamente o "não invente dados" ao contrário (dado
   ruim substituído por dado real re-extraído, nunca por texto inventado).
   Idempotente: rodar de novo em artigos já corrigidos não piora nada
   (mesma extração determinística tende a repetir o mesmo resultado). */
async function reprocessarArtigosCorrompidos(env) {
  validarAmbiente(env);

  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/articles?select=id,original_url,image_credit,content&status=eq.published&order=published_at.desc&limit=300`,
    { headers: supabaseHeaders(env) }
  );
  if (!resp.ok) throw new Error(`Supabase respondeu HTTP ${resp.status}`);
  const artigos = await resp.json();

  const suspeitos = artigos.filter((a) => {
    const c = a.content || "";
    return c.length > 6000 || pareceRuidoDeCodigoOuMenuTelegram(c.slice(0, 2000));
  });

  const resultados = [];
  for (const artigo of suspeitos) {
    try {
      const detalhes = await lerNoticia(artigo.original_url, artigo.image_credit);
      const novoConteudo = detalhes.content;
      if (!novoConteudo || novoConteudo.length < 60 || pareceRuidoDeCodigoOuMenuTelegram(novoConteudo.slice(0, 2000))) {
        resultados.push({
          id: artigo.id,
          status: "sem_conteudo_valido_apos_reextracao",
          tamanho_anterior: (artigo.content || "").length,
          tamanho_novo: novoConteudo ? novoConteudo.length : 0
        });
        continue;
      }

      await atualizarArtigo(env, artigo.original_url, { content: novoConteudo });

      resultados.push({
        id: artigo.id,
        status: "corrigido",
        tamanho_anterior: (artigo.content || "").length,
        tamanho_novo: novoConteudo.length
      });
    } catch (erro) {
      resultados.push({ id: artigo.id, status: "erro", erro: erro.message });
    }
  }

  return { ok: true, avaliados: artigos.length, suspeitos: suspeitos.length, resultados };
}

/* Correção P1 (Missão Contínua — Central Offshore, 2026-09-19) — backfill
   pra matérias JÁ PUBLICADAS antes da correção em
   imagemPareceBannerRepetidoDaFonte(): agrupa artigos publicados por
   (fonte + image_url) e, quando a MESMA imagem aparece em 3+ matérias
   diferentes da mesma fonte, conclui que é banner/template do site (não
   foto real de nenhuma matéria específica) e zera image_url/image_caption
   nas três — nunca deleta o artigo, nunca inventa foto nova, só admite
   "essa não é a foto real" e deixa o fallback contextual (já existente no
   front-end) assumir. Idempotente: uma vez zerado, o grupo não reaparece
   numa segunda execução (não há mais 3+ com a mesma URL não-nula). */
async function corrigirImagensBannerRepetidas(env) {
  validarAmbiente(env);

  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/articles?select=id,image_url,image_credit&status=eq.published&order=published_at.desc&limit=500`,
    { headers: supabaseHeaders(env) }
  );
  if (!resp.ok) throw new Error(`Supabase respondeu HTTP ${resp.status}`);
  const artigos = await resp.json();

  const grupos = new Map();
  for (const a of artigos) {
    if (!a.image_url || !a.image_credit) continue;
    const chave = `${a.image_credit}|${a.image_url}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(a);
  }

  const resultados = [];
  for (const [chave, itens] of grupos) {
    if (itens.length < 3) continue;
    for (const artigo of itens) {
      try {
        const resposta = await fetch(
          `${env.SUPABASE_URL}/rest/v1/articles?id=eq.${encodeURIComponent(artigo.id)}`,
          {
            method: "PATCH",
            headers: { ...supabaseHeaders(env), "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ image_url: null, image_caption: null })
          }
        );
        if (!resposta.ok) {
          resultados.push({ id: artigo.id, chave, status: "erro_http", http_status: resposta.status });
          continue;
        }
        resultados.push({ id: artigo.id, chave, status: "corrigido" });
      } catch (erro) {
        resultados.push({ id: artigo.id, chave, status: "erro", erro: erro.message });
      }
    }
  }

  return {
    ok: true,
    artigos_avaliados: artigos.length,
    grupos_com_imagem_repetida: [...grupos.entries()].filter(([, v]) => v.length >= 3).map(([k, v]) => ({ chave: k, ocorrencias: v.length })),
    resultados
  };
}

/* Correção pontual (2026-09-19, Source Registry — Transocean/SBM Offshore):
   os 20 artigos de teste inseridos via /run-transocean e /run-sbm-offshore
   ANTES da correção do título (sufixo " | Transocean Ltd."/" - SBM
   Offshore") e da imagem (globenewswire.com/newsroom/ti? não é foto real)
   já estavam publicados quando os dois bugs foram corrigidos no código.
   Reaplica a mesma limpeza nos registros já salvos — nunca deleta artigo,
   só corrige título/imagem com a MESMA lógica que passou a valer pra
   coleta nova. Idempotente: rodar de novo em artigo já corrigido não
   muda nada (a regex não encontra mais o sufixo). Endpoint de uso único,
   documentado — não faz parte de nenhum cron. */
async function corrigirFontesInternacionaisTeste(env) {
  validarAmbiente(env);

  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/articles?select=id,title,image_url,image_credit&image_credit=in.(Transocean,%22SBM%20Offshore%22)&status=eq.published`,
    { headers: supabaseHeaders(env) }
  );
  if (!resp.ok) throw new Error(`Supabase respondeu HTTP ${resp.status}`);
  const artigos = await resp.json();

  const resultados = [];
  for (const artigo of artigos) {
    const primeiraPalavraFonte = artigo.image_credit.split(/\s+/)[0];
    const regexSufixo = new RegExp(`\\s*[|\\-–]\\s*[^|\\-–]{0,60}${escapeRegex(primeiraPalavraFonte)}[^|\\-–]{0,20}$`, "i");
    const tituloCorrigido = artigo.title.replace(regexSufixo, "").trim();
    const imagemRuim = artigo.image_url && /globenewswire\.com\/newsroom\/ti\?/i.test(artigo.image_url);

    const mudancas = {};
    if (tituloCorrigido && tituloCorrigido !== artigo.title) mudancas.title = tituloCorrigido;
    if (imagemRuim) { mudancas.image_url = null; mudancas.image_caption = null; }

    if (Object.keys(mudancas).length === 0) {
      resultados.push({ id: artigo.id, status: "ja_correto" });
      continue;
    }

    try {
      const resposta = await fetch(
        `${env.SUPABASE_URL}/rest/v1/articles?id=eq.${encodeURIComponent(artigo.id)}`,
        {
          method: "PATCH",
          headers: { ...supabaseHeaders(env), "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(mudancas)
        }
      );
      if (!resposta.ok) {
        resultados.push({ id: artigo.id, status: "erro_http", http_status: resposta.status });
        continue;
      }
      resultados.push({ id: artigo.id, status: "corrigido", mudancas: Object.keys(mudancas) });
    } catch (erro) {
      resultados.push({ id: artigo.id, status: "erro", erro: erro.message });
    }
  }

  return { ok: true, avaliados: artigos.length, resultados };
}

/* Ferramenta admin genérica (2026-09-19) — generalizada a partir de uma
   correção pontual real (falso positivo "Plataforma reúne 228
   indicadores...", ver PALAVRAS_PLATAFORMA_NAO_OFFSHORE) e reaproveitada
   pra remover duplicata de evento (ver corrigirDuplicataEvento). Tentativa
   de só mudar `status` falhou: a coluna tem check constraint com valores
   não documentados no código (23514 pra "draft"/"rejeitado_relevancia").
   Deleta só o ID exato passado — nunca em lote, nunca por filtro. Uso:
   engano de publicação (irrelevante) ou duplicata confirmada do mesmo
   evento (nunca pra apagar artigo válido só porque é antigo). */
async function deletarArtigoPorId(env, id) {
  validarAmbiente(env);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, erro: "id não tem formato de UUID válido" };
  }
  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/articles?id=eq.${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { ...supabaseHeaders(env), Prefer: "return=representation" }
    }
  );
  const texto = await resp.text();
  return { ok: resp.ok, http_status: resp.status, corpo: texto };
}

/* Backfill de imagem (2026-09-19, Missão Contínua — "imagem em 100% dos
   artigos"). Auditoria real: 51 dos 89 artigos publicados não têm
   image_url. Investigação caso a caso (não em lote/suposição) mostrou dois
   grupos bem diferentes:
   1) Fontes sem foto de verdade na origem (ex.: releases institucionais
      da ANP, só com og:image = logo genérico do gov.br) — não há o que
      buscar, o frontend já cobre com fallback ilustrativo por categoria
      (imagemDe() em producao-ownews-git), nunca deve "inventar" imagem.
   2) Extração que falhava numa versão anterior do código e já foi
      corrigida (ex.: PetroNotícias sem <article>, resolvido com o parser
      wp-image-NNNNNN) — matérias coletadas ANTES dessa correção continuam
      com image_url nulo pra sempre, mesmo a foto real existindo na página
      até hoje (confirmado manualmente: "Camorim-ROG2026-300x208.jpg"
      existe e seria encontrada se o artigo fosse coletado agora).
   Este endpoint SÓ ataca o grupo 2: rebusca a página original de cada
   artigo publicado sem imagem, roda a MESMA extrairImagemPrincipal() de
   hoje, e só faz PATCH quando uma imagem real é encontrada — nunca marca
   nem inventa nada pro grupo 1 (fica no fallback ilustrativo, que é o
   comportamento correto e já existente). Rate-limited (só roda um lote
   pequeno por chamada, ver parâmetro `limite`) pra não estourar
   subrequests numa invocação só. */
async function backfillImagensFaltantes(env, limite = 10) {
  validarAmbiente(env);

  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/articles?select=id,original_url,image_credit&status=eq.published&image_url=is.null&order=published_at.desc&limit=${limite}`,
    { headers: supabaseHeaders(env) }
  );
  if (!resp.ok) throw new Error(`Erro Supabase ao listar: ${resp.status}`);
  const artigos = await resp.json();

  const resultados = [];
  for (const artigo of artigos) {
    try {
      const html = await baixarPagina(artigo.original_url);
      const imagemEncontrada = extrairImagemPrincipal(html, artigo.original_url);

      if (!imagemEncontrada) {
        resultados.push({ id: artigo.id, status: "sem_imagem_na_origem" });
        continue;
      }

      const ehBannerRepetido = await imagemPareceBannerRepetidoDaFonte(env, imagemEncontrada, artigo.image_credit);
      if (ehBannerRepetido) {
        resultados.push({ id: artigo.id, status: "descartada_banner_repetido" });
        continue;
      }

      const patchResp = await fetch(
        `${env.SUPABASE_URL}/rest/v1/articles?id=eq.${encodeURIComponent(artigo.id)}`,
        {
          method: "PATCH",
          headers: { ...supabaseHeaders(env), "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ image_url: imagemEncontrada })
        }
      );
      if (!patchResp.ok) {
        resultados.push({ id: artigo.id, status: "erro_http", http_status: patchResp.status });
        continue;
      }
      resultados.push({ id: artigo.id, status: "imagem_encontrada", image_url: imagemEncontrada });
    } catch (erro) {
      resultados.push({ id: artigo.id, status: "erro", erro: erro.message });
    }
  }

  return { ok: true, avaliados: artigos.length, resultados };
}

/* Reverso do backfill (2026-09-19): corrige uma image_url ruim já salva
   sem apagar o artigo (que continua válido) — necessário depois de
   encontrar, durante o próprio backfill, padrões de LOGO/ícone genérico
   que o extrator ainda aceitava (ícones de sistema do SharePoint da EPE
   em /_layouts/N/images/ — spcommon.png e depois searchresultui.png, dois
   nomes diferentes do mesmo padrão de path; logo da empresa em
   ml.globenewswire.com/.../tiny/) e já foram corrigidos em
   extrairImagemPrincipal/extrairImagemJsonLd. Nunca em lote — só o ID
   exato passado. */
async function limparImagemPorId(env, id) {
  validarAmbiente(env);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, erro: "id não tem formato de UUID válido" };
  }
  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/articles?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { ...supabaseHeaders(env), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ image_url: null, image_caption: null })
    }
  );
  return { ok: resp.ok, http_status: resp.status };
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

// Causa raiz real de um bug relatado em produção (2026-09-24, "Evolução do
// Portal", Etapa 4): 165 artigos publicados com "&ccedil;"/"&atilde;"/
// "&eacute;" etc. literais no corpo em vez de "ç"/"ã"/"é" — afetando
// praticamente todas as fontes (Eixos, ANP, PetroNotícias, Petrobras,
// Transocean, ANTAQ, SBM Offshore, PPSA, Sindipetro NF, MME, Agência
// Brasil, EPE, FUP), não uma fonte isolada. decodeHtml() já tratava
// entidades básicas e numéricas, mas nunca teve mapa pras nomeadas
// acentuadas — exatamente o que essas fontes usam no HTML de origem.
// Artigos já publicados corrigidos no lado do ownews-git (renderização,
// nunca reescreve o banco); aqui é a prevenção pra conteúdo novo não
// nascer com o mesmo defeito.
const MAPA_ENTIDADES_NOMEADAS = {
  ccedil: "ç", Ccedil: "Ç", atilde: "ã", Atilde: "Ã", otilde: "õ", Otilde: "Õ",
  ecirc: "ê", Ecirc: "Ê", ocirc: "ô", Ocirc: "Ô", acirc: "â", Acirc: "Â",
  aacute: "á", Aacute: "Á", eacute: "é", Eacute: "É", iacute: "í", Iacute: "Í",
  oacute: "ó", Oacute: "Ó", uacute: "ú", Uacute: "Ú",
  agrave: "à", Agrave: "À", egrave: "è", ograve: "ò", ugrave: "ù",
  uuml: "ü", Uuml: "Ü", auml: "ä", Auml: "Ä", ouml: "ö", Ouml: "Ö", ntilde: "ñ", Ntilde: "Ñ",
  aring: "å", Aring: "Å", oslash: "ø", Oslash: "Ø", aelig: "æ", AElig: "Æ",
  ordm: "º", ordf: "ª", deg: "°", sup1: "¹", sup2: "²", sup3: "³",
  hellip: "…", mdash: "—", ndash: "–",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  euro: "€", middot: "·", bull: "•"
};

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
    .replace(/&#x([0-9a-fA-F]+);/g, (_, cod) => String.fromCharCode(parseInt(cod, 16)))
    // Entidades nomeadas acentuadas (Eixos, PetroNotícias e outras fontes
    // usam este formato) — só decodifica nomes conhecidos, nunca marcação
    // estrutural arbitrária.
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (correspondencia, nome) =>
      Object.prototype.hasOwnProperty.call(MAPA_ENTIDADES_NOMEADAS, nome) ? MAPA_ENTIDADES_NOMEADAS[nome] : correspondencia
    );
}

function escapeRegex(texto) {
  return texto.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

// Extraído em 2026-09-19 (achado ao vivo com Sindipetro NF/FUP): a versão
// anterior exigia que TODO o trecho após o separador fosse livre de outro
// separador, o que funcionava pra sufixo simples ("Título | Transocean
// Ltd.") mas falhava pra sufixo composto ("Título | FUP - Federação Única
// dos Petroleiros" ou "Título - SindipetroNF", onde o nome da fonte não é
// necessariamente a última palavra antes do fim da string, ou o sufixo
// tem separador interno).
//
// Corrigido de novo em 2026-09-19 (achado ao vivo com Eixos): buscar o
// PRIMEIRO separador (da esquerda) cuja cauda contém o nome da fonte tem
// um bug real — num título como "O custo dos gasodutos do pré-sal na
// berlinda | eixos", o PRIMEIRO separador é o hífen de "pré-sal" (conteúdo
// genuíno do título), e a cauda dali em diante (até o fim da string)
// TAMBÉM contém "eixos", porque o sufixo de marca real vem mais adiante
// na mesma cauda — cortava "pré-sal na berlinda | eixos" inteiro,
// destruindo o título. Correção: escanear os separadores da DIREITA pra
// ESQUERDA e usar o PRIMEIRO encontrado nessa ordem (ou seja, o mais
// próximo do fim da string) cuja cauda contenha o nome da fonte — sempre
// acha o corte mínimo correto (só o sufixo real), nunca um separador de
// conteúdo genuíno que apareça antes dele.
function limparSufixoFonte(titulo, nomeFonte) {
  const primeiraPalavraFonte = nomeFonte.split(/\s+/)[0];
  if (!primeiraPalavraFonte || primeiraPalavraFonte.length < 3) return titulo;

  const regexPalavraFonte = new RegExp(escapeRegex(primeiraPalavraFonte), "i");
  const regexSeparador = /[|\-–]/g;
  const indices = [];
  let match;
  while ((match = regexSeparador.exec(titulo)) !== null) indices.push(match.index);

  for (let i = indices.length - 1; i >= 0; i--) {
    const idx = indices[i];
    const cauda = titulo.slice(idx + 1);
    if (cauda.length <= 80 && regexPalavraFonte.test(cauda)) {
      return titulo.slice(0, idx).trim();
    }
  }
  return titulo;
}

async function consultarAeroportos(env) {
  if (!env.REDEMET_API_KEY) {
    throw new Error("REDEMET_API_KEY não configurada");
  }

  const listaICAO = OFFVOOS_HUBS.map((h) => h.icao).join(",");
  const url =
    "https://api-redemet.decea.mil.br/aerodromos/status/localidades/" + listaICAO +
    "?api_key=" + encodeURIComponent(env.REDEMET_API_KEY);

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

  // OffVoos: sempre servido do CACHE (KV), nunca uma chamada nova por
  // requisição de visitante (item 19/28 da missão) — se o KV não tiver
  // snapshot ainda, ou o coletor de OffVoos nunca rodou, cada aeroporto
  // simplesmente não recebe o campo "offvoos" (nunca um 0 inventado).
  const snapshotOffVoos = await obterSnapshotOffVoosDoKV(env);
  const offVoosPorIcao = {};
  if (snapshotOffVoos && Array.isArray(snapshotOffVoos.aeroportos)) {
    for (const r of snapshotOffVoos.aeroportos) offVoosPorIcao[r.airport] = r;
  }

  const aeroportosComOffVoos = Array.isArray(aeroportosComClima)
    ? aeroportosComClima.map((entrada) => {
        const icao = Array.isArray(entrada.dados) ? entrada.dados[0] : entrada.dados?.icao;
        const registro = icao ? offVoosPorIcao[icao] : null;
        const frescor = classificarFrescorOffVoos(registro);
        if (!registro || frescor === "sem_dados" || frescor === "indisponivel") {
          return { ...entrada, offvoos: null };
        }
        return {
          ...entrada,
          offvoos: {
            total: registro.total,
            concluidos: registro.concluidos,
            em_voo: registro.em_voo,
            pendentes: registro.pendentes,
            transferidos_cancelados: registro.transferidos_cancelados,
            fetched_at: registro.fetched_at,
            frescor, // "ao_vivo" | "recente"
            fonte: "OffVoos"
          }
        };
      })
    : aeroportosComClima;

  return {
    ok: true,
    fonte: "REDEMET / DECEA",
    aeroportos: aeroportosComOffVoos
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

/* =========================================================================
   OFFVOOS — OPERAÇÃO OFFSHORE (integração autorizada)
   =========================================================================
   Uso autorizado pelo responsável/parceiro OffVoos em 2026-09-17 (registro
   interno desta decisão — ver relatório da missão "HOME 2.0 + AEROPORTOS
   OFFSHORE + OFFVOOS AO VIVO"). Mesmo autorizados, seguimos as regras da
   missão: 1 fetch por aeroporto a cada ~5min (subiu de 3min em
   2026-09-19 por orçamento de escrita KV, ver docs/KV-BUDGET.md — ainda
   bem mais espaçado que os 60s do próprio site), sequencial (nunca
   paralelo, nunca thundering herd),
   sempre servindo do CACHE (KV) pro frontend — nenhum visitante do OWNews
   jamais faz uma requisição direta ao OffVoos.

   Endpoint reauditado ao vivo em 2026-09-17: GET /<slug>/tbody?d=YYYY-MM-DD
   retorna um fragmento HTML (não JSON) contendo blocos
   <div class="mc-kpi-label">RÓTULO</div><div class="mc-kpi-val">VALOR</div>
   — parser abaixo lê por RÓTULO (semântica), nunca por posição.

   Nota sobre "SBFS" vs "SBST": a REDEMET reconhece "SBFS" como o Heliporto
   Farol de São Tomé (confirmado via resposta real da API). O painel do
   OffVoos para a mesma região usa internamente o identificador "SBST" (só
   no título da página deles). Não temos como confirmar com certeza se são
   o mesmo código formal — por isso NÃO forçamos equivalência: usamos
   "SBFS" como identificador OWNews (é o que a REDEMET reconhece pra
   meteorologia) e apontamos pra esse painel do OffVoos só pelo slug
   ("sao-tome"), que foi testado e retorna dados operacionais reais. */
const OFFVOOS_HUBS = [
  { icao: "SBJR", slugOffVoos: "jacarepagua" },
  { icao: "SBMI", slugOffVoos: "marica" },
  { icao: "SBCB", slugOffVoos: "cabo-frio" },
  { icao: "SBME", slugOffVoos: "macae" },
  { icao: "SBFS", slugOffVoos: "sao-tome" },
  { icao: "SBVT", slugOffVoos: "vitoria" },
  { icao: "SBAR", slugOffVoos: "aracaju" },
  { icao: "SBSV", slugOffVoos: "salvador" },
  { icao: "SBFZ", slugOffVoos: "fortaleza" },
  { icao: "SBOI", slugOffVoos: "oiapoque" },
  { icao: "SBMQ", slugOffVoos: "macapa" }
];

const OFFVOOS_TIMEOUT_MS = 8000;
// Política de "stale" (item 27 da missão) — nunca aplicada pelo coletor
// (que só grava fetched_at), sempre calculada em tempo de resposta em
// classificarFrescorOffVoos, pra refletir a idade real no momento em que
// alguém de fato consulta /aeroportos.
const OFFVOOS_FRESCOR_AO_VIVO_MS = 10 * 60 * 1000;   // até 10min: "ao vivo"
const OFFVOOS_FRESCOR_RECENTE_MS = 30 * 60 * 1000;   // 10–30min: mostra horário, sem "ao vivo"
                                                       // >30min: oculta métricas operacionais

function dataHojeBRT() {
  // BRT = UTC-3 (Brasil não usa horário de verão atualmente). Calculado a
  // cada chamada — nunca em escopo de módulo (Workers "congela" o relógio
  // fora de um handler; ver nota idêntica em IBAMA_URL_BASE acima).
  const agoraBRT = new Date(Date.now() - 3 * 3600000);
  const y = agoraBRT.getUTCFullYear();
  const m = String(agoraBRT.getUTCMonth() + 1).padStart(2, "0");
  const d = String(agoraBRT.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Parser por semântica (label -> valor), não por posição — item 72 da
// missão. Retorna null (nunca zeros inventados) se a estrutura não for
// reconhecida, pra classificarFrescorOffVoos tratar como indisponível.
function parseOffVoosTbody(html) {
  const blocos = [
    ...String(html || "").matchAll(
      /<div class="mc-kpi-label">([^<]*)<\/div>\s*<div class="mc-kpi-val">([^<]*)<\/div>/g
    )
  ];
  if (!blocos.length) return null;

  const mapa = {};
  for (const [, label, val] of blocos) mapa[label.trim()] = val.trim();

  const numOuNull = (s) => (typeof s === "string" && /^\d+$/.test(s)) ? parseInt(s, 10) : null;

  return {
    total: numOuNull(mapa["Voos"]),
    concluidos: numOuNull(mapa["Pousados"]),
    em_voo: numOuNull(mapa["Em voo"]),
    pendentes: numOuNull(mapa["Pendentes"]),
    transferidos_cancelados: numOuNull(mapa["Transf. + canc."])
  };
}

async function coletarOffVoosHub(hub) {
  const dia = dataHojeBRT();
  const agoraISO = new Date().toISOString();
  const base = { airport: hub.icao, date: dia, source: "OffVoos", fetched_at: agoraISO, source_updated_at: null };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OFFVOOS_TIMEOUT_MS);
  try {
    const resposta = await fetch(
      `https://offvoos.com.br/${hub.slugOffVoos}/tbody?d=${dia}`,
      {
        headers: {
          "User-Agent": "OWNews/1.0 (+https://ownews.com.br) - integracao autorizada pelo parceiro OffVoos (2026-09-17)",
          Accept: "text/html"
        },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

    if (!resposta.ok) {
      return { ...base, total: null, concluidos: null, em_voo: null, pendentes: null, transferidos_cancelados: null, status: "error", erro: `HTTP ${resposta.status}` };
    }

    const html = await resposta.text();
    const dados = parseOffVoosTbody(html);
    if (!dados) {
      return { ...base, total: null, concluidos: null, em_voo: null, pendentes: null, transferidos_cancelados: null, status: "error", erro: "estrutura HTML não reconhecida" };
    }

    return { ...base, ...dados, status: "ok" };
  } catch (erro) {
    clearTimeout(timeoutId);
    return { ...base, total: null, concluidos: null, em_voo: null, pendentes: null, transferidos_cancelados: null, status: "error", erro: erro.name === "AbortError" ? "timeout" : erro.message };
  }
}

async function obterBackoffOffVoosDoKV(env) {
  try {
    if (!env.SAUDE_KV) return null;
    const bruto = await env.SAUDE_KV.get("offvoos_backoff");
    return bruto ? JSON.parse(bruto) : null;
  } catch { return null; }
}

async function gravarBackoffOffVoosNoKV(env, dados) {
  try {
    if (!env.SAUDE_KV) return;
    await env.SAUDE_KV.put("offvoos_backoff", JSON.stringify(dados));
  } catch { /* observabilidade/proteção nunca pode quebrar o coletor */ }
}

// Sequencial (nunca Promise.all) por respeito à infraestrutura do parceiro
// (item 30/16) — mesmo autorizados, não geramos rajada simultânea de 11
// requisições. Backoff exponencial (até 15min) se TODOS os hubs falharem
// em sequência, pra nunca martelar o OffVoos durante uma indisponibilidade.
async function coletarTodosOffVoos(env) {
  const backoff = await obterBackoffOffVoosDoKV(env);
  if (backoff && backoff.ate && Date.now() < backoff.ate) {
    return { pulou_por_backoff: true, motivo: backoff.motivo, ate: backoff.ate };
  }

  const resultados = [];
  for (const hub of OFFVOOS_HUBS) {
    resultados.push(await coletarOffVoosHub(hub));
  }

  const todasFalharam = resultados.every((r) => r.status === "error");
  if (todasFalharam) {
    const falhasAnteriores = (backoff && backoff.falhas_consecutivas) || 0;
    const novasFalhas = falhasAnteriores + 1;
    const atrasoMs = Math.min(15 * 60000, 3 * 60000 * Math.pow(2, novasFalhas - 1));
    await gravarBackoffOffVoosNoKV(env, {
      falhas_consecutivas: novasFalhas,
      motivo: "todos os aeroportos falharam na última coleta",
      ate: Date.now() + atrasoMs
    });
  } else if (backoff) {
    await gravarBackoffOffVoosNoKV(env, { falhas_consecutivas: 0, motivo: null, ate: 0 });
  }

  const registro = {
    atualizado_em: new Date().toISOString(),
    aeroportos: resultados
  };
  try {
    if (env.SAUDE_KV) await env.SAUDE_KV.put("offvoos_snapshot", JSON.stringify(registro));
  } catch { /* nunca derruba o coletor */ }

  return registro;
}

async function obterSnapshotOffVoosDoKV(env) {
  try {
    if (!env.SAUDE_KV) return null;
    const bruto = await env.SAUDE_KV.get("offvoos_snapshot");
    return bruto ? JSON.parse(bruto) : null;
  } catch { return null; }
}

// Zero ≠ desconhecido (item 21): "sem_dados" quando fetch falhou/nunca
// rodou; nunca convertido pra 0. Frescor sempre calculado no momento da
// resposta (não gravado), pra refletir a idade real na hora do request.
function classificarFrescorOffVoos(registroAeroporto) {
  if (!registroAeroporto || registroAeroporto.status !== "ok") return "sem_dados";
  const idadeMs = Date.now() - new Date(registroAeroporto.fetched_at).getTime();
  if (!Number.isFinite(idadeMs)) return "sem_dados";
  if (idadeMs <= OFFVOOS_FRESCOR_AO_VIVO_MS) return "ao_vivo";
  if (idadeMs <= OFFVOOS_FRESCOR_RECENTE_MS) return "recente";
  return "indisponivel"; // dado velho demais — nunca exibido como operacional
}

/* =========================================================================
   VARREDURA EDITORIAL DE HORA EM HORA (Fase 7, 2026-09-18)
   =========================================================================
   "Abandonar a ideia de só 6 rodadas por dia" SEM adicionar cron trigger
   nenhum (a conta já está em 5/5, ver decisão documentada abaixo, no
   OffVoosPoller) — mesmo mecanismo de Durable Object Alarm, agora
   cobrindo as 24h do dia, não só a janela 05:50-19:50 dos 2 crons
   originais (que continuam intocados, disparando normalmente; esta
   varredura é ADICIONAL, nunca substitui).

   Por que ALTERNA Grupo A/B a cada hora (nunca os dois juntos na mesma
   invocação): a causa raiz já documentada em processarNoticias (duplicata
   cara em subrequests) foi corrigida, mas rodar ANP+Petrobras+PPSA+EPE+
   Marinha+ANTAQ juntos ainda soma ~40-50 subrequests — perto demais do
   teto do plano Free pra arriscar em produção. Alternando, cada grupo é
   verificado a cada 2h (contra as ~2,5-3h dos crons fixos, mas agora
   cobrindo TAMBÉM a madrugada) — ainda uma melhoria real, com folga segura
   de orçamento. */
export class EditorialPoller {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.pronto = this.inicializar();
  }

  async inicializar() {
    const alarmeExiste = await this.state.storage.getAlarm();
    if (!alarmeExiste) await this.state.storage.setAlarm(Date.now() + 5000);
  }

  async fetch() {
    await this.pronto;
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }

  async alarm() {
    // Rotação de 4 turnos (2026-09-19, Source Registry — subiu de 3 pra 4):
    // A/B/C/D — turno 3 = Grupo D (Transocean/SBM Offshore, internacional,
    // ver executarAtualizacaoInternacional). A/B/C mantêm a mesma lógica de
    // antes (2026-09-18: A/B a cada ~4h em vez de ~3h com a rotação maior,
    // mas os crons fixos "50 .../20 ..." continuam garantindo A/B a cada
    // ~3h de qualquer forma — perda real pequena frente ao ganho de mais
    // uma fonte verificada por hora).
    // Rotação de 5 turnos (2026-09-27, expansão do Source Registry —
    // subiu de 4 pra 5): A/B/C/D/E — turno 4 = Grupo E (imprensa
    // especializada BR: Portos e Navios + MegaWhat, ver
    // executarAtualizacaoImprensaBR). A/B seguem garantidos a cada ~3h
    // pelos 2 crons fixos, independentemente desta rotação.
    const turnoAnterior = (await this.state.storage.get("turno")) ?? 4;
    const proximoTurno = (turnoAnterior + 1) % 5;
    const grupo = turnoAnterior === 0 ? "A" : turnoAnterior === 1 ? "B" : turnoAnterior === 2 ? "C" : turnoAnterior === 3 ? "D" : "E";
    await this.state.storage.put("turno", proximoTurno);

    const inicio = Date.now();
    let resultado = null;
    let erro = null;
    try {
      resultado = grupo === "B"
        ? await executarAtualizacaoNovasFontes(this.env)
        : grupo === "C"
        ? await executarAtualizacaoTerceiraFonte(this.env)
        : grupo === "D"
        ? await executarAtualizacaoInternacional(this.env)
        : grupo === "E"
        ? await executarAtualizacaoImprensaEspecializada(this.env)
        : await executarAtualizacaoPrincipal(this.env);
    } catch (e) {
      erro = e.message;
      console.error("[EditorialPoller] erro na varredura horária:", e.message);
    }

    const fim = Date.now();
    await registrarExecucaoEmKV(this.env, {
      grupo,
      trigger_cron: "hourly-alarm",
      origem: "varredura_horaria",
      inicio: new Date(inicio).toISOString(),
      fim: new Date(fim).toISOString(),
      duracao_ms: fim - inicio,
      resultados: resultado ? resultado.resultados : null,
      erro
    });

    // Stale guard (P0.3/P0.4, Missão Contínua — "Home precisa estar viva"):
    // a rotação normal já cobre cada grupo pelo menos a cada ~4h, mas isso
    // ainda deixa uma janela real onde a Hero pode ficar velha se o grupo
    // do turno atual não achar nada novo. Em vez de aceitar isso
    // silenciosamente, quando a publicação mais recente já passa de 6h,
    // roda uma passada extra do Grupo A (ANP+Petrobras — as duas fontes
    // mais confiáveis/baratas) MESMO fora do turno normal, antes de
    // reagendar. Nunca inventa notícia — só garante que uma tentativa real
    // de descoberta aconteceu antes de aceitar "não há nada novo".
    try {
      const horasSemPublicar = await horasDesdeUltimaPublicacao(this.env);
      if (horasSemPublicar !== null && horasSemPublicar > 6 && grupo !== "A") {
        console.warn(`[EditorialPoller] Hero com ${horasSemPublicar.toFixed(1)}h — varredura extraordinária (Grupo A) além do turno normal (${grupo}).`);
        const extra = await executarAtualizacaoPrincipal(this.env);
        await registrarExecucaoEmKV(this.env, {
          grupo: "A",
          trigger_cron: "hourly-alarm-stale-guard",
          origem: "varredura_extraordinaria",
          inicio: new Date().toISOString(),
          fim: new Date().toISOString(),
          resultados: extra.resultados,
          erro: null
        });
      }
    } catch (e) {
      console.error("[EditorialPoller] erro no stale guard, ignorado com segurança:", e.message);
    }

    try {
      await executarRadarTelegram(this.env);
    } catch (e) {
      console.error("[Telegram via EditorialPoller] erro não tratado, ignorado com segurança:", e.message);
    }

    await this.state.storage.setAlarm(Date.now() + 60 * 60000);
  }
}

async function garantirEditorialPollerAtivo(env) {
  try {
    if (!env.EDITORIAL_DO) return;
    const id = env.EDITORIAL_DO.idFromName("global");
    const stub = env.EDITORIAL_DO.get(id);
    await stub.fetch("https://editorial-poller.interno/ping");
  } catch { /* nunca derruba a requisição principal por causa disso */ }
}

/* -------------------------------------------------------------------------
   Agendamento do OffVoos: NÃO usa Cloudflare Cron Trigger.
   -------------------------------------------------------------------------
   Motivo (decisão técnica documentada, 2026-09-17/18): a conta já usa 5/5
   cron triggers do limite do plano Free (2 deste Worker + 3 do
   ownews-instagram-publisher) — confirmado ao vivo, o deploy com um 3º
   cron aqui falhou com o erro [code: 10072] "Free limit of 5 cron
   triggers per account". Isso é decisão de custo/plano (fora do escopo
   desta missão resolver sozinho), então em vez de pedir upgrade,
   resolvemos com um mecanismo que NÃO conta nesse limite: um Alarm de
   Durable Object (mesma API já usada por PageViews, no Worker
   ownews-git, pra limpar linhas antigas de hora em hora). Um Alarm se
   reagenda indefinidamente sozinho (this.state.storage.setAlarm dentro
   do próprio alarm()) e sobrevive à hibernação do Worker — não precisa de
   nenhum cron externo disparando. Zero custo adicional, zero mudança de
   plano. */
export class OffVoosPoller {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.pronto = this.inicializar();
  }

  async inicializar() {
    const alarmeExiste = await this.state.storage.getAlarm();
    if (!alarmeExiste) {
      // Primeira ativação: dispara quase de imediato pra já existir um
      // snapshot sem precisar esperar 3min pela primeira leitura.
      await this.state.storage.setAlarm(Date.now() + 2000);
    }
  }

  async fetch() {
    await this.pronto;
    return new Response(JSON.stringify({ ok: true, alarme_ativo: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  async alarm() {
    try {
      await coletarTodosOffVoos(this.env);
    } catch (e) {
      console.error("[OffVoos DO] erro na coleta, será tentado de novo no próximo ciclo:", e.message);
    }
    // Sempre reagenda — mesmo se a coleta falhou (o próprio backoff interno
    // de coletarTodosOffVoos já cuida de não martelar o OffVoos durante uma
    // indisponibilidade; aqui só garantimos que o loop nunca morre).
    // Intervalo subiu de 3min pra 5min em 2026-09-19 (auditoria de
    // orçamento KV — docs/KV-BUDGET.md): sozinho, 3min gerava ~480
    // writes/dia no namespace compartilhado; dado de aeroporto não perde
    // utilidade real por atualizar a cada 5min em vez de 3min, e isso
    // libera ~192 writes/dia de margem contra a cota de 1000/dia do plano
    // Free (mesma cota que já estourou uma vez no Instagram publisher).
    await this.state.storage.setAlarm(Date.now() + 5 * 60000);
  }
}

// Chamado sempre que alguém consulta dado ligado a OffVoos — barato (a DO
// já ativa não faz nada além de responder "ok"; só a PRIMEIRA chamada de
// verdade agenda o alarme inicial). Autocurativo: se o loop de alarm()
// alguma vez morrer por algum motivo, a próxima visita ao /aeroportos ou
// /offvoos religa sozinho.
async function garantirOffVoosPollerAtivo(env) {
  try {
    if (!env.OFFVOOS_DO) return;
    const id = env.OFFVOOS_DO.idFromName("global");
    const stub = env.OFFVOOS_DO.get(id);
    await stub.fetch("https://offvoos-poller.interno/ping");
  } catch { /* nunca derruba a requisição principal por causa disso */ }
}

/* =========================================================================
   MERCADO OFFSHORE — cotações reais (Home 3.0, 2026-09-18)
   =========================================================================
   Fonte: endpoint público de gráfico da Yahoo Finance
   (query1.finance.yahoo.com/v8/finance/chart/<símbolo>) — sem chave, sem
   cadastro, sem custo. É o mesmo tipo de endpoint somente-leitura usado por
   um número muito grande de projetos de código aberto pra exibir cotação
   de referência; não faz scraping de HTML nem contorna autenticação. Uso
   responsável: 1 fetch por ticker a cada ciclo do poller (~5min, nunca por
   visitante), sempre servido do cache (KV) — arquitetura idêntica à do
   OffVoos. Se este endpoint algum dia parar de responder, o painel some
   (ver classificarFrescorMercado) — o resto do OWNews nunca quebra por
   causa disso.

   REGRA ABSOLUTA (item 20/82 da missão): só entra ticker CONFIRMADO ao
   vivo contra esta mesma fonte antes de ser adicionado aqui — nenhum
   symbol foi digitado "de memória" sem teste. Empresa sem ticker
   confirmado fica com ownership PRIVATE/SUBSIDIARY/UNKNOWN e NUNCA recebe
   preço/variação inventados. */
const MERCADO_MACRO = [
  { id: "brent", nome: "Brent", ticker: "BZ=F", unidade: "barril" },
  { id: "wti", nome: "WTI", ticker: "CL=F", unidade: "barril" },
  { id: "gas_natural", nome: "Gás Natural", ticker: "NG=F", unidade: "MMBtu" },
  { id: "usd_brl", nome: "USD/BRL", ticker: "USDBRL=X", unidade: "câmbio" },
  { id: "eur_brl", nome: "EUR/BRL", ticker: "EURBRL=X", unidade: "câmbio" },
  { id: "ouro", nome: "Ouro", ticker: "GC=F", unidade: "onça-troy" },
  { id: "prata", nome: "Prata", ticker: "SI=F", unidade: "onça-troy" },
  { id: "minerio_ferro", nome: "Minério de Ferro", ticker: "TIO=F", unidade: "tonelada" }
];

const MERCADO_EMPRESAS = [
  // ---- Perfuração/Drilling ----
  { id: "seadrill", nome: "Seadrill", ticker: "SDRL", bolsa: "NYSE", categoria: "perfuracao", ownership: "PUBLICLY_TRADED" },
  { id: "transocean", nome: "Transocean", ticker: "RIG", bolsa: "NYSE", categoria: "perfuracao", ownership: "PUBLICLY_TRADED" },
  { id: "valaris", nome: "Valaris", ticker: "VAL", bolsa: "NYSE", categoria: "perfuracao", ownership: "PUBLICLY_TRADED" },
  { id: "noble", nome: "Noble Corporation", ticker: "NE", bolsa: "NYSE", categoria: "perfuracao", ownership: "PUBLICLY_TRADED" },
  { id: "nabors", nome: "Nabors Industries", ticker: "NBR", bolsa: "NYSE", categoria: "perfuracao", ownership: "PUBLICLY_TRADED" },
  { id: "odfjell", nome: "Odfjell Drilling", ticker: "ODL.OL", bolsa: "Oslo", categoria: "perfuracao", ownership: "PUBLICLY_TRADED" },
  { id: "cosl", nome: "COSL", ticker: "2883.HK", bolsa: "Hong Kong", categoria: "perfuracao", ownership: "PUBLICLY_TRADED" },
  { id: "constellation", nome: "Constellation", ticker: null, bolsa: null, categoria: "perfuracao", ownership: "PRIVATE" },
  { id: "foresea", nome: "Foresea", ticker: null, bolsa: null, categoria: "perfuracao", ownership: "PRIVATE" },
  { id: "ventura-offshore", nome: "Ventura Offshore", ticker: null, bolsa: null, categoria: "perfuracao", ownership: "PRIVATE" },

  // ---- Produção/FPSO ----
  { id: "sbm-offshore", nome: "SBM Offshore", ticker: "SBMO.AS", bolsa: "Euronext Amsterdam", categoria: "producao_fpso", ownership: "PUBLICLY_TRADED" },
  { id: "bw-offshore", nome: "BW Offshore", ticker: "BWO.OL", bolsa: "Oslo", categoria: "producao_fpso", ownership: "PUBLICLY_TRADED" },
  { id: "yinson", nome: "Yinson Holdings", ticker: "7293.KL", bolsa: "Bursa Malaysia", categoria: "producao_fpso", ownership: "PUBLICLY_TRADED" },
  { id: "petrobras", nome: "Petrobras", ticker: "PETR4.SA", bolsa: "B3", categoria: "producao_fpso", ownership: "PUBLICLY_TRADED" },
  { id: "modec", nome: "MODEC", ticker: null, bolsa: null, categoria: "producao_fpso", ownership: "SUBSIDIARY" },
  { id: "ocyan", nome: "Ocyan", ticker: null, bolsa: null, categoria: "producao_fpso", ownership: "PRIVATE" },
  { id: "altera", nome: "Altera Infrastructure", ticker: null, bolsa: null, categoria: "producao_fpso", ownership: "PRIVATE" },

  // ---- Subsea/ROV ----
  { id: "subsea7", nome: "Subsea7", ticker: "SUBC.OL", bolsa: "Oslo", categoria: "subsea_rov", ownership: "PUBLICLY_TRADED" },
  { id: "technipfmc", nome: "TechnipFMC", ticker: "FTI", bolsa: "NYSE", categoria: "subsea_rov", ownership: "PUBLICLY_TRADED" },
  { id: "oceaneering", nome: "Oceaneering", ticker: "OII", bolsa: "NYSE", categoria: "subsea_rov", ownership: "PUBLICLY_TRADED" },
  { id: "dof-group", nome: "DOF Group", ticker: "DOFG.OL", bolsa: "Oslo", categoria: "subsea_rov", ownership: "PUBLICLY_TRADED" },
  { id: "fugro", nome: "Fugro", ticker: "FUR.AS", bolsa: "Euronext Amsterdam", categoria: "subsea_rov", ownership: "PUBLICLY_TRADED" },
  { id: "saipem", nome: "Saipem", ticker: "SPM.MI", bolsa: "Milão", categoria: "subsea_rov", ownership: "PUBLICLY_TRADED" },
  { id: "oceanpact", nome: "OceanPact", ticker: null, bolsa: null, categoria: "subsea_rov", ownership: "PRIVATE" },

  // ---- Serviços de Poço/Oilfield Services ----
  { id: "slb", nome: "SLB", ticker: "SLB", bolsa: "NYSE", categoria: "servicos_poco", ownership: "PUBLICLY_TRADED" },
  { id: "halliburton", nome: "Halliburton", ticker: "HAL", bolsa: "NYSE", categoria: "servicos_poco", ownership: "PUBLICLY_TRADED" },
  { id: "baker-hughes", nome: "Baker Hughes", ticker: "BKR", bolsa: "Nasdaq", categoria: "servicos_poco", ownership: "PUBLICLY_TRADED" },
  { id: "weatherford", nome: "Weatherford", ticker: "WFRD", bolsa: "Nasdaq", categoria: "servicos_poco", ownership: "PUBLICLY_TRADED" },
  { id: "nov", nome: "NOV Inc.", ticker: "NOV", bolsa: "NYSE", categoria: "servicos_poco", ownership: "PUBLICLY_TRADED" },

  // ---- Operadoras ----
  { id: "equinor", nome: "Equinor", ticker: "EQNR", bolsa: "NYSE", categoria: "operadoras", ownership: "PUBLICLY_TRADED" },
  { id: "shell", nome: "Shell", ticker: "SHEL", bolsa: "NYSE", categoria: "operadoras", ownership: "PUBLICLY_TRADED" },
  { id: "exxonmobil", nome: "ExxonMobil", ticker: "XOM", bolsa: "NYSE", categoria: "operadoras", ownership: "PUBLICLY_TRADED" },
  { id: "chevron", nome: "Chevron", ticker: "CVX", bolsa: "NYSE", categoria: "operadoras", ownership: "PUBLICLY_TRADED" },
  { id: "totalenergies", nome: "TotalEnergies", ticker: "TTE", bolsa: "NYSE", categoria: "operadoras", ownership: "PUBLICLY_TRADED" },
  { id: "bp", nome: "bp", ticker: "BP", bolsa: "NYSE", categoria: "operadoras", ownership: "PUBLICLY_TRADED" },
  { id: "eni", nome: "Eni", ticker: "E", bolsa: "NYSE", categoria: "operadoras", ownership: "PUBLICLY_TRADED" },
  { id: "galp", nome: "Galp Energia", ticker: "GALP.LS", bolsa: "Lisboa", categoria: "operadoras", ownership: "PUBLICLY_TRADED" },
  { id: "repsol", nome: "Repsol", ticker: "REP.MC", bolsa: "Madri", categoria: "operadoras", ownership: "PUBLICLY_TRADED" },
  { id: "murphy", nome: "Murphy Oil", ticker: "MUR", bolsa: "NYSE", categoria: "operadoras", ownership: "PUBLICLY_TRADED" },
  { id: "apa", nome: "APA Corporation", ticker: "APA", bolsa: "Nasdaq", categoria: "operadoras", ownership: "PUBLICLY_TRADED" },
  { id: "prio", nome: "PRIO", ticker: "PRIO3.SA", bolsa: "B3", categoria: "operadoras", ownership: "PUBLICLY_TRADED" },
  { id: "brava-energia", nome: "Brava Energia", ticker: "BRAV3.SA", bolsa: "B3", categoria: "operadoras", ownership: "PUBLICLY_TRADED" },
  { id: "petroreconcavo", nome: "PetroReconcavo", ticker: "RECV3.SA", bolsa: "B3", categoria: "operadoras", ownership: "PUBLICLY_TRADED" },
  { id: "petrochina", nome: "PetroChina", ticker: "0857.HK", bolsa: "Hong Kong", categoria: "operadoras", ownership: "PUBLICLY_TRADED" },
  { id: "petronas", nome: "Petronas", ticker: null, bolsa: null, categoria: "operadoras", ownership: "PRIVATE" },

  // ---- Apoio Marítimo/OSV ----
  { id: "tidewater", nome: "Tidewater", ticker: "TDW", bolsa: "NYSE", categoria: "apoio_maritimo", ownership: "PUBLICLY_TRADED" },
  { id: "solstad", nome: "Solstad Offshore", ticker: "SOFF.OL", bolsa: "Oslo", categoria: "apoio_maritimo", ownership: "PUBLICLY_TRADED" },
  { id: "wilson-sons", nome: "Wilson Sons", ticker: null, bolsa: null, categoria: "apoio_maritimo", ownership: "PRIVATE" },
  { id: "cbo", nome: "CBO", ticker: null, bolsa: null, categoria: "apoio_maritimo", ownership: "PRIVATE" },
  { id: "bram-offshore", nome: "Bram Offshore", ticker: null, bolsa: null, categoria: "apoio_maritimo", ownership: "PRIVATE" },
  { id: "starnav", nome: "Starnav", ticker: null, bolsa: null, categoria: "apoio_maritimo", ownership: "PRIVATE" },

  // ---- Engenharia/EPC/Industrial ----
  { id: "worley", nome: "Worley", ticker: "WOR.AX", bolsa: "ASX", categoria: "engenharia_epc", ownership: "PUBLICLY_TRADED" },
  { id: "aker-solutions", nome: "Aker Solutions", ticker: "AKSO.OL", bolsa: "Oslo", categoria: "engenharia_epc", ownership: "PUBLICLY_TRADED" },
  { id: "kongsberg", nome: "Kongsberg Gruppen", ticker: "KOG.OL", bolsa: "Oslo", categoria: "engenharia_epc", ownership: "PUBLICLY_TRADED" },
  { id: "siemens-energy", nome: "Siemens Energy", ticker: "ENR.DE", bolsa: "Frankfurt", categoria: "engenharia_epc", ownership: "PUBLICLY_TRADED" }
];

// Seleção curada pra Home (item 23: 8-12 indicadores, nunca o universo
// inteiro) — prioriza Brasil, perfuração, subsea, majors e o que já
// aparece nas notícias mais recentes do próprio OWNews.
const MERCADO_HOME_DESTAQUES = [
  "petrobras", "prio", "brava-energia", "seadrill", "transocean", "valaris",
  "subsea7", "technipfmc", "slb", "equinor", "shell"
];

const MERCADO_TIMEOUT_MS = 8000;
const MERCADO_FRESCOR_OK_MS = 15 * 60000; // até 15min: mostra cotação normalmente

async function buscarCotacaoYahoo(ticker) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MERCADO_TIMEOUT_MS);
  try {
    const resposta = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`,
      {
        headers: { "User-Agent": "OWNews/1.0 (+https://ownews.com.br) - painel de referencia, somente leitura", Accept: "application/json" },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);
    if (!resposta.ok) return { ok: false, erro: `HTTP ${resposta.status}` };

    const dados = await resposta.json();
    const meta = dados?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") {
      return { ok: false, erro: "sem meta/preço na resposta" };
    }

    return {
      ok: true,
      preco: meta.regularMarketPrice,
      moeda: meta.currency || null,
      variacao_percent: typeof meta.regularMarketChangePercent === "number" ? meta.regularMarketChangePercent : null,
      variacao_absoluta:
        typeof meta.regularMarketPrice === "number" && typeof meta.chartPreviousClose === "number"
          ? meta.regularMarketPrice - meta.chartPreviousClose
          : null,
      market_state: meta.marketState || null, // "REGULAR" | "CLOSED" | "PRE" | "POST" | etc — nunca traduzido como "ao vivo" sem checar
      source_timestamp: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null
    };
  } catch (erro) {
    clearTimeout(timeoutId);
    return { ok: false, erro: erro.name === "AbortError" ? "timeout" : erro.message };
  }
}

// Sequencial (nunca Promise.all) — mesmo princípio de respeito à fonte já
// aplicado ao OffVoos (item 30 da missão original, reaplicado aqui).
// Lista única (macro + só as PUBLICLY_TRADED com ticker) — é o que
// efetivamente gera 1 fetch cada. Achatada aqui pra poder ser dividida em
// lotes (ver "turno" abaixo).
const MERCADO_TICKERS_ATIVOS = [
  ...MERCADO_MACRO.map((m) => ({ tipo: "macro", ...m })),
  ...MERCADO_EMPRESAS.filter((e) => e.ownership === "PUBLICLY_TRADED" && e.ticker).map((e) => ({ tipo: "empresa", ...e }))
];

// Correção 2026-09-18 (mesma causa raiz já corrigida no pipeline editorial):
// ~50 fetches (8 macro + 42 empresas) numa invocação só estourava o limite
// de subrequests do Worker ("Too many subrequests by single Worker
// invocation"), derrubando o último ticker da lista (Siemens Energy),
// reproduzido ao vivo. Correção: cada alarme processa só METADE da lista,
// alternando (turno 0/1 guardado no storage da própria Durable Object) —
// cada ticker atualiza a cada ~10min em vez de ~5min, o que ainda é
// honesto pro rótulo "Mercado Agora, atualizado HH:MM" (nunca "tempo
// real"). O snapshot sempre contém TODOS os tickers: o lote não
// processado neste ciclo mantém o último valor válido conhecido (mesclado
// abaixo), nunca desaparece nem vira null por falta de vez.
async function coletarLoteMercado(env, turno) {
  const agora = new Date().toISOString();
  const anterior = await obterSnapshotMercadoDoKV(env);
  const porId = new Map();
  if (anterior) {
    for (const item of [...(anterior.macro || []), ...(anterior.empresas || [])]) porId.set(item.id, item);
  }

  const meio = Math.ceil(MERCADO_TICKERS_ATIVOS.length / 2);
  const lote = turno === 0 ? MERCADO_TICKERS_ATIVOS.slice(0, meio) : MERCADO_TICKERS_ATIVOS.slice(meio);

  for (const item of lote) {
    const cot = await buscarCotacaoYahoo(item.ticker);
    porId.set(item.id, { ...item, ...cot, fetched_at: agora });
  }

  // Empresas privadas/sem ticker: sempre reafirmadas (nunca dependem de
  // fetch, nunca somem do mapa por não estarem em nenhum lote).
  for (const emp of MERCADO_EMPRESAS) {
    if (emp.ownership !== "PUBLICLY_TRADED" || !emp.ticker) {
      porId.set(emp.id, { ...emp, ok: null, preco: null, sem_cotacao: true, fetched_at: agora });
    }
  }

  const macro = MERCADO_MACRO.map((m) => porId.get(m.id)).filter(Boolean);
  const empresas = MERCADO_EMPRESAS.map((e) => porId.get(e.id)).filter(Boolean);

  // Corrigido em 2026-09-19 (auditoria de orçamento KV — docs/KV-BUDGET.md):
  // esta função só monta o registro agora; quem grava é sempre a chamadora
  // (coletarTodoMercado), que ainda precisa adicionar "ultimo_turno" antes
  // de persistir. Antes as duas gravavam a MESMA chave em sequência — dobro
  // de writes/dia (Mercado sozinho ia de ~288 pra ~576/dia) sem nenhum
  // ganho, já que a versão sem ultimo_turno nunca era lida por ninguém.
  return { atualizado_em: agora, macro, empresas };
}

// Usado pelo /run-mercado (diagnóstico manual). Só 1 lote por chamada —
// mesmo limite de subrequests por invocação vale aqui também; pra ver o
// snapshot completo rapidamente em diagnóstico, chame duas vezes (lote
// alterna sozinho via turno salvo no KV) ou espere os dois ciclos do
// Alarm (~10min, caminho normal de produção).
async function coletarTodoMercado(env) {
  const anterior = await obterSnapshotMercadoDoKV(env);
  const turnoAnterior = anterior && typeof anterior.ultimo_turno === "number" ? anterior.ultimo_turno : 1;
  const turno = turnoAnterior === 0 ? 1 : 0;
  const registro = await coletarLoteMercado(env, turno);
  registro.ultimo_turno = turno;
  try {
    if (env.SAUDE_KV) await env.SAUDE_KV.put("mercado_snapshot", JSON.stringify(registro));
  } catch { /* nunca derruba o coletor */ }
  return registro;
}

async function obterSnapshotMercadoDoKV(env) {
  try {
    if (!env.SAUDE_KV) return null;
    const bruto = await env.SAUDE_KV.get("mercado_snapshot");
    return bruto ? JSON.parse(bruto) : null;
  } catch { return null; }
}

/* Mesmo mecanismo do OffVoosPoller: Durable Object Alarm, não Cron
   Trigger — a conta já está no limite de 5/5 cron triggers do plano Free
   (ver decisão documentada junto de OffVoosPoller). ~5min de intervalo:
   suficiente pra "Mercado Agora, atualizado HH:MM" sem fingir tempo real
   (item 12 da missão), e barato o bastante pra não sobrecarregar a Yahoo
   com ~42 tickers por ciclo. */
export class MercadoPoller {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.pronto = this.inicializar();
  }

  async inicializar() {
    const alarmeExiste = await this.state.storage.getAlarm();
    if (!alarmeExiste) await this.state.storage.setAlarm(Date.now() + 2000);
  }

  async fetch() {
    await this.pronto;
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }

  async alarm() {
    try {
      await coletarTodoMercado(this.env);
    } catch (e) {
      console.error("[Mercado DO] erro na coleta, será tentado de novo no próximo ciclo:", e.message);
    }
    await this.state.storage.setAlarm(Date.now() + 5 * 60000);
  }
}

async function garantirMercadoPollerAtivo(env) {
  try {
    if (!env.MERCADO_DO) return;
    const id = env.MERCADO_DO.idFromName("global");
    const stub = env.MERCADO_DO.get(id);
    await stub.fetch("https://mercado-poller.interno/ping");
  } catch { /* nunca derruba a requisição principal por causa disso */ }
}

// Item 60/41 da missão: health interno do mercado, nunca com segredo.
async function avaliarSaudeMercado(env) {
  const snapshot = await obterSnapshotMercadoDoKV(env);
  const agora = Date.now();
  const proximoFetch = new Date(Math.ceil(agora / 300000) * 300000).toISOString();

  if (!snapshot) {
    return {
      habilitado: true, provider: "Yahoo Finance (chart API pública)",
      tickers_monitorados: MERCADO_MACRO.length + MERCADO_EMPRESAS.filter(e => e.ticker).length,
      last_fetch: null, last_success: null, last_error: null,
      fresh_quotes: 0, stale_quotes: 0, market_status: "unavailable", next_fetch: proximoFetch,
      observacao: "Poller de mercado ainda não rodou nesta implantação."
    };
  }

  const todos = [...snapshot.macro, ...snapshot.empresas.filter(e => !e.sem_cotacao)];
  const idadeMs = agora - new Date(snapshot.atualizado_em).getTime();
  const fresh = todos.filter(t => t.ok).length;
  const comErro = todos.filter(t => t.ok === false);

  return {
    habilitado: true,
    provider: "Yahoo Finance (chart API pública)",
    tickers_monitorados: todos.length,
    last_fetch: snapshot.atualizado_em,
    last_success: fresh > 0 ? snapshot.atualizado_em : null,
    last_error: comErro.length ? comErro[0].erro : null,
    fresh_quotes: fresh,
    stale_quotes: comErro.length,
    market_status: idadeMs <= MERCADO_FRESCOR_OK_MS ? "healthy" : "stale",
    next_fetch: proximoFetch
  };
}

/* =========================================================================
   TELEGRAM | RADAR OFFSHORE — ativado em 2026-09-16
   =========================================================================
   Código-fonte canônico, testado (55 testes, node telegram-integration/
   telegramPublisher.test.mjs) e documentado em detalhe:
   telegram-integration/telegramPublisher.js — MANTENHA OS DOIS EM SINCRONIA.
   Este bloco é uma cópia inline (Workers deste projeto são sempre um
   arquivo só — mesmo padrão já usado pro resto do collector).

   Segurança:
   - TELEGRAM_BOT_TOKEN/TELEGRAM_CHANNEL_ID são secrets do Worker (`wrangler
     secret put`), nunca aparecem em código, log ou resposta HTTP.
   - Publica só se as duas condições forem verdadeiras: os dois secrets
     existirem E env.TELEGRAM_DRY_RUN === "false".
   - Falha do Telegram NUNCA derruba o collector: todo o fluxo abaixo (
     executarRadarTelegram) é chamado dentro de try/catch próprio e nunca
     lança pra fora — ver chamada em scheduled().
   - Sem conseguir ler o histórico de já-publicados (ex.: a tabela
     telegram_posts ainda não existe), o radar SE RECUSA a enviar nesta
     execução, em vez de assumir "histórico vazio" e arriscar reenviar o
     mesmo artigo a cada cron (fail-safe).
========================================================================= */

// Corte de ativação: só considera artigos publicados DEPOIS deste instante
// exato (quando este código foi ativado em produção). Evita publicar
// qualquer backlog histórico — inclusive a matéria Petrobras/Sempra já
// usada no teste manual (2026-09-15), que é anterior a este horário e por
// isso nunca pode ser reconsiderada por este mecanismo.
const TELEGRAM_ATIVADO_EM = "2026-09-16T01:07:16Z";

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

function detectarCategoriaTelegram(artigo) {
  const texto = ((artigo.title || "") + " " + (artigo.summary || "")).toLowerCase();
  for (const cat of CATEGORIAS_TELEGRAM) {
    if (cat.palavras.some((p) => texto.includes(p))) return cat.nome;
  }
  return null;
}

const PALAVRAS_EXCLUSAO_RADAR = [
  "pauta da reunião", "pauta da reuniao", "ata da reunião", "ata da reuniao",
  "aviso de pauta", "inscrições para participação virtual",
  "inscricoes para participacao virtual", "vem aí o", "vem ai o",
  "convite para",
  "audiência pública", "audiencia publica", "consulta pública",
  "consulta publica",
  "cerimônia", "cerimonia",
  "visita técnica", "visita tecnica", "protocolo de intenções",
  "protocolo de intencoes",
  "cooperaportos",
  "reunião ordinária", "reuniao ordinaria", "reunião participativa",
  "reuniao participativa"
];

const PONTUACAO_ALTA_TELEGRAM = [
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
  "reajuste", "reajusta", "alta do preço", "alta do preco",
  "queda do preço", "queda do preco", "aumento do preço",
  "aumento do preco", "redução do preço", "reducao do preco",
  "novo preço dos combustíveis", "novo preco dos combustiveis",
  "desabastecimento", "risco de desabastecimento", "racionamento",
  "mudança na política de preços", "mudanca na politica de precos"
];

const PONTUACAO_NORMAL_TELEGRAM = [
  "leilão", "leilao", "arremata", "petrobras", "fpso", "plataforma",
  "sonda", "pré-sal", "pre-sal", "produção", "producao", "exploração",
  "exploracao", "combustível", "combustivel", "combustíveis",
  "combustiveis", "gasolina", "diesel", "brent", "wti", "porto", "portos",
  "subsea", "perfuração", "perfuracao", "energia", "tecnologia offshore",
  "transição energética", "transicao energetica", "currículo",
  "curriculo", "carreira offshore", "royalties", "concessão", "concessao",
  // Auditoria 2026-09-27 (canal 30h+ mudo com notícia offshore boa no
  // site): o vocabulário de pontuação NÃO tinha "offshore", "bacia" nem
  // "gás natural" — "Karoon busca parceiros para exploração na Bacia de
  // Santos" pontuava só 4 (exploração) e nunca chegava ao limiar 8. São
  // completações de vocabulário baseadas em evidência, NÃO redução de
  // limiar (continua 8 = 2 termos normais ou 1 de alto valor). Este
  // matcher usa includes() (substring), então só entram termos que não
  // são substring de palavra comum em português — nomes curtos de
  // empresa (prio/eni) ficam FORA daqui de propósito.
  "offshore", "bacia", "gás natural", "gas natural"
];

const LIMIAR_MINIMO_ELEGIVEL_TELEGRAM = 8;
const LIMIAR_PRIORIDADE_MUITO_ALTA_TELEGRAM = 20;
const LIMIAR_QUINTO_POST_EXCECIONAL_TELEGRAM = 16;

function avaliarElegibilidadeTelegram(artigo) {
  const titulo = (artigo.title || "").toLowerCase();
  const resumo = (artigo.summary || "").toLowerCase();
  const texto = titulo + " " + resumo;
  const categoria = detectarCategoriaTelegram(artigo);

  const excluido = PALAVRAS_EXCLUSAO_RADAR.find((p) => texto.includes(p));
  if (excluido) {
    return { elegivel: false, motivo: `excluído por conteúdo de baixo valor editorial ("${excluido}")`, pontuacao: 0, categoria };
  }

  let pontuacao = 0;
  for (const p of PONTUACAO_ALTA_TELEGRAM) if (texto.includes(p)) pontuacao += 10;
  for (const p of PONTUACAO_NORMAL_TELEGRAM) if (texto.includes(p)) pontuacao += 4;

  if (pontuacao < LIMIAR_MINIMO_ELEGIVEL_TELEGRAM) {
    return { elegivel: false, motivo: `pontuação ${pontuacao} abaixo do limiar mínimo (${LIMIAR_MINIMO_ELEGIVEL_TELEGRAM})`, pontuacao, categoria };
  }

  return {
    elegivel: true,
    motivo: "pontuação suficiente",
    pontuacao,
    categoria,
    prioridadeMuitoAlta: pontuacao >= LIMIAR_PRIORIDADE_MUITO_ALTA_TELEGRAM
  };
}

function verificarDuplicidadeTelegram(artigo, idsJaPublicados) {
  return { duplicado: (idsJaPublicados || []).includes(artigo.id) };
}

const RESUMOS_GENERICOS_CONHECIDOS_TELEGRAM = [
  "Informação publicada pela Agência Petrobras sobre atividades e projetos do setor de energia, petróleo e gás.",
  "Informação publicada pela Agência Nacional do Petróleo, Gás Natural e Biocombustíveis sobre o setor de petróleo e gás."
];

function ehResumoGenericoTelegram(resumo) {
  const t = limparEspacosTelegram(resumo);
  if (!t) return true;
  if (RESUMOS_GENERICOS_CONHECIDOS_TELEGRAM.includes(t)) return true;
  // "publicada pela Agência ..." (ANP/Petrobras, frase fixa antiga) e
  // "publicada por <fonte>." (fallback genérico novo, 2026-09-18 — ver
  // lerNoticia) são os dois formatos de resumo-de-emergência que o
  // coletor usa quando a matéria não tinha meta description própria.
  return /^Informação publicada (pela Agência|por)\b/i.test(t);
}

const MARCADORES_RUIDO_CONTEUDO_TELEGRAM = [
  "queryselector", "addeventlistener", "classlist", "aria-expanded",
  "aria-label", "fragmentelement", "getattribute", "settimeout",
  "cursor:pointer", "display-none", "faça uma busca", "página inicial",
  "share facebook", "share twitter", "copiar texto", "menu-dropdown",
  "submenuitens", "portlet-body", "const ", "=>", "send e-mail",
  "uso deste material é autorizado apenas para fins editoriais"
];

function pareceRuidoDeCodigoOuMenuTelegram(bloco) {
  const t = bloco.toLowerCase();
  if (MARCADORES_RUIDO_CONTEUDO_TELEGRAM.some((m) => t.includes(m))) return true;
  const simbolos = (bloco.match(/[{}();=]/g) || []).length;
  return simbolos / bloco.length > 0.03;
}

function extrairResumoFactualTelegram(content) {
  if (!content) return null;
  const blocos = String(content).split(/\n{2,}/).map((b) => limparEspacosTelegram(b)).filter(Boolean);

  let blocoAnterior = "";
  for (const bloco of blocos) {
    let candidato = bloco;
    if (blocoAnterior && candidato.startsWith(blocoAnterior)) {
      candidato = candidato.slice(blocoAnterior.length).trim();
    }
    blocoAnterior = bloco;

    if (candidato.length < 60) continue;
    if (pareceRuidoDeCodigoOuMenuTelegram(candidato)) continue;

    const frases = candidato.match(/[^.!?]+[.!?]+/g);
    if (!frases) continue;

    let resumo = frases.slice(0, 2).join(" ").trim();
    if (resumo.length > 280) resumo = frases.slice(0, 1).join(" ").trim();
    if (resumo.length >= 40) return resumo;
  }
  return null;
}

function obterResumoSeguroTelegram(artigo) {
  const summary = limparEspacosTelegram(artigo.summary || "");
  if (summary && !ehResumoGenericoTelegram(summary)) {
    return { resumo: summary.slice(0, 220), fonte: "summary" };
  }
  const extraido = extrairResumoFactualTelegram(artigo.content);
  if (extraido) {
    return { resumo: extraido.slice(0, 280), fonte: "conteudo_extraido" };
  }
  return { resumo: null, fonte: "indisponivel" };
}

function limparEspacosTelegram(t) {
  return String(t || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function escaparHtmlTelegram(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const TAMANHO_MAX_LEGENDA_FOTO_TELEGRAM = 1024;
const TAMANHO_MAX_MENSAGEM_TEXTO_TELEGRAM = 4096;

function formatarPostTelegram(artigo, urlCanonica, opts) {
  const categoria = (opts && opts.categoria) || detectarCategoriaTelegram(artigo);
  const titulo = escaparHtmlTelegram(limparEspacosTelegram(artigo.title || ""));
  const { resumo } = (opts && opts.semResumo) ? { resumo: null } : obterResumoSeguroTelegram(artigo);
  const linhaCategoria = categoria ? `${escaparHtmlTelegram(categoria)}\n\n` : "";
  const linhaLink = `Leia no OWNews →\n${urlCanonica}`;

  let texto = resumo
    ? `${linhaCategoria}<b>${titulo}</b>\n\n${escaparHtmlTelegram(resumo)}\n\n${linhaLink}`
    : `${linhaCategoria}<b>${titulo}</b>\n\n${linhaLink}`;

  if (texto.length > TAMANHO_MAX_MENSAGEM_TEXTO_TELEGRAM) {
    const semResumo = `${linhaCategoria}<b>${titulo}</b>\n\n${linhaLink}`;
    texto = semResumo.length <= TAMANHO_MAX_MENSAGEM_TEXTO_TELEGRAM ? semResumo : semResumo.slice(0, TAMANHO_MAX_MENSAGEM_TEXTO_TELEGRAM);
  }
  return texto;
}

const PADROES_IMAGEM_INVALIDA_TELEGRAM = [
  /placeholder/i,
  /default/i,
  /favicon/i,
  /\bsprite\b/i,
  /\bicon\b/i,
  /\blogo\b/i,
  /_layouts\/\d+\/images\//i,
  /spcommon\.png/i
];

function imagemEditorialValidaTelegram(url) {
  if (!url) return false;
  return !PADROES_IMAGEM_INVALIDA_TELEGRAM.some((re) => re.test(url));
}

function verificarUrlOwnewsTelegram(urlCanonica) {
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

/* Corrigido em 2026-09-19 (Missão Contínua — Central Offshore): as últimas
   notícias publicadas no @ownewsradar usaram a MESMA imagem — causa raiz
   comum com o bug da Home (ver imagemPareceBannerRepetidoDaFonte): várias
   matérias seguidas do PetroNotícias reaproveitando o banner do site como
   image_url. Aqui a defesa é específica do Telegram: antes de mandar
   sendPhoto, olha as últimas publicações reais do canal (telegram_posts,
   join com articles) e, se a MESMA image_url já foi usada recentemente,
   publica como texto desta vez em vez de repetir a foto — nunca inventa
   imagem alternativa, só admite "essa foto já apareceu, manda sem foto".
   Falha de leitura (rede/RLS/schema) nunca bloqueia o envio: retorna false
   e o fluxo segue como se não houvesse repetição (mesma regra de sempre —
   este checkpoint só pode SER MAIS restritivo, nunca travar o canal). */
async function imagemFoiUsadaRecentementeNoTelegram(env, imageUrl) {
  if (!imageUrl) return false;
  try {
    const resp = await fetch(
      `${env.SUPABASE_URL}/rest/v1/telegram_posts?select=article_id,articles!inner(image_url)&status=eq.published&tipo_envio=eq.foto&order=published_at.desc&limit=5`,
      { headers: supabaseHeaders(env) }
    );
    if (!resp.ok) return false;
    const linhas = await resp.json();
    return linhas.some((l) => l.articles && l.articles.image_url === imageUrl);
  } catch {
    return false;
  }
}

async function prepararEnvioTelegram(env, artigo, urlCanonica) {
  const categoria = detectarCategoriaTelegram(artigo);
  const texto = formatarPostTelegram(artigo, urlCanonica, { categoria });
  const imagemUtilizavel =
    imagemEditorialValidaTelegram(artigo.image_url) &&
    !(await imagemFoiUsadaRecentementeNoTelegram(env, artigo.image_url));

  if (imagemUtilizavel) {
    let legenda = texto;
    if (legenda.length > TAMANHO_MAX_LEGENDA_FOTO_TELEGRAM) {
      legenda = formatarPostTelegram(artigo, urlCanonica, { categoria, semResumo: true }).slice(0, TAMANHO_MAX_LEGENDA_FOTO_TELEGRAM);
    }
    return { tipo: "foto", imagemUrl: artigo.image_url, legenda, categoria };
  }
  return { tipo: "texto", texto, categoria };
}

const TIMEOUT_MS_TELEGRAM = 10000;

async function fetchComTimeoutTelegram(url, opcoes) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS_TELEGRAM);
  try {
    return await fetch(url, { ...opcoes, signal: controller.signal });
  } catch (erro) {
    if (erro.name === "AbortError") {
      throw new Error(`Timeout (${TIMEOUT_MS_TELEGRAM}ms) chamando a API do Telegram`);
    }
    throw erro;
  } finally {
    clearTimeout(timer);
  }
}

async function interpretarRespostaTelegramApi(resposta, contexto) {
  // Corrigido em 2026-09-17 (auditoria operacional Telegram): esta função
  // só checava resposta.ok (status HTTP). A API do Telegram costuma
  // responder HTTP 200 MESMO QUANDO A OPERAÇÃO FALHOU (ex.: bot removido
  // do canal, sem permissão para postar, chat_id errado) — o corpo vem
  // como {"ok": false, "error_code": ..., "description": "..."}. Sem
  // checar o campo "ok" do JSON, um envio que nunca chegou ao canal real
  // era registrado como sucesso (mesmo bug suspeito de causar o canal
  // "parar de receber" silenciosamente sem nenhum erro visível). Agora o
  // corpo é sempre lido e o campo "ok" do Telegram é a fonte da verdade,
  // não o status HTTP.
  if (resposta.status === 429) {
    let retryAfter;
    try {
      const corpo = await resposta.json();
      retryAfter = corpo?.parameters?.retry_after;
    } catch {
      /* segue sem retry_after */
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

  let dados;
  try {
    dados = await resposta.json();
  } catch (erroParse) {
    const erro = new Error(`Telegram (${contexto}): resposta HTTP ${resposta.status} sem corpo JSON válido`);
    erro.tipo = "erro_cliente";
    throw erro;
  }

  if (dados && dados.ok === true) return dados;

  // resposta.ok (HTTP) pode ser true aqui mesmo com dados.ok === false —
  // é exatamente esse caso que este fix existe para pegar.
  const descricao = dados && dados.description ? dados.description : `HTTP ${resposta.status}, corpo sem "description"`;
  const codigo = dados && dados.error_code;
  const erro = new Error(`Telegram (${contexto}) recusou o envio: ${descricao}${codigo ? ` (error_code ${codigo})` : ""}`);
  erro.tipo = codigo === 403 ? "sem_permissao_no_canal" : "erro_cliente";
  erro.telegramErrorCode = codigo;
  throw erro;
}

function extrairCamposSegurosTelegram(dados) {
  const messageId = dados?.result?.message_id;
  // Defesa em profundidade (auditoria 2026-09-17): a essa altura
  // interpretarRespostaTelegramApi já garantiu dados.ok===true, então
  // message_id deveria sempre existir — mas nunca reportar "enviado" sem
  // essa prova concreta, pra não repetir a mesma classe de bug de novo se
  // o formato da resposta do Telegram mudar no futuro.
  if (!messageId) {
    throw new Error("Telegram respondeu ok=true mas sem result.message_id — tratando como falha, não como sucesso.");
  }
  return {
    messageId,
    chat: dados?.result?.chat
      ? { id: dados.result.chat.id, title: dados.result.chat.title, username: dados.result.chat.username }
      : undefined
  };
}

async function publicarTelegram(payload, env, logger) {
  const log = logger || console;
  const dryRun = env.TELEGRAM_DRY_RUN !== "false";

  if (dryRun) {
    log.info?.("[TELEGRAM DRY_RUN] Nenhum envio real feito.", {
      tipo: payload.tipo,
      tamanhoTexto: (payload.texto || payload.legenda || "").length,
      temImagem: payload.tipo === "foto"
    });
    return { ok: true, dryRun: true, enviado: false };
  }

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHANNEL_ID) {
    throw new Error("Telegram não configurado: faltam TELEGRAM_BOT_TOKEN e/ou TELEGRAM_CHANNEL_ID. Nenhuma mensagem foi enviada.");
  }

  const base = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

  if (payload.tipo === "foto") {
    return fetchComFallbackTelegram(base, payload, env);
  }

  const resposta = await fetchComTimeoutTelegram(`${base}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHANNEL_ID, text: payload.texto, parse_mode: "HTML" })
  });
  const dados = await interpretarRespostaTelegramApi(resposta, "sendMessage");
  return { ok: true, dryRun: false, enviado: true, tipo: "texto", ...extrairCamposSegurosTelegram(dados) };
}

async function fetchComFallbackTelegram(base, payload, env) {
  try {
    const resposta = await fetchComTimeoutTelegram(`${base}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHANNEL_ID,
        photo: payload.imagemUrl,
        caption: payload.legenda,
        parse_mode: "HTML"
      })
    });
    const dados = await interpretarRespostaTelegramApi(resposta, "sendPhoto");
    return { ok: true, dryRun: false, enviado: true, tipo: "foto", ...extrairCamposSegurosTelegram(dados) };
  } catch (erroFoto) {
    if (erroFoto.tipo === "rate_limit" || erroFoto.tipo === "erro_servidor_telegram") {
      throw erroFoto;
    }
    const resposta = await fetchComTimeoutTelegram(`${base}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHANNEL_ID, text: payload.legenda, parse_mode: "HTML" })
    });
    const dados = await interpretarRespostaTelegramApi(resposta, "sendMessage (fallback de foto)");
    return {
      ok: true, dryRun: false, enviado: true, tipo: "texto",
      fallbackDeFoto: true, motivoFallback: erroFoto.message,
      ...extrairCamposSegurosTelegram(dados)
    };
  }
}

const LIMITE_NORMAL_POR_DIA_TELEGRAM = 4;
const LIMITE_EXCEPCIONAL_POR_DIA_TELEGRAM = 5;
const INTERVALO_MINIMO_MS_TELEGRAM = 2 * 60 * 60 * 1000;

// Brasil não observa horário de verão desde 2019 — deslocamento fixo de
// -3h é seguro (sem depender de Intl/timezone database) pra calcular o
// "dia" em BRT dentro do Workers runtime.
const OFFSET_BRT_MS = 3 * 3600000;

function inicioDoDiaBrtMs(agora) {
  const brt = new Date(agora - OFFSET_BRT_MS);
  return Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()) + OFFSET_BRT_MS;
}

function computarEstadoEnviosTelegram(historicoPublicados, agora) {
  // Corrigido em 2026-09-18 (Missão Mestre, garantia mínima diária das
  // 12:00 BRT): "dia" agora é o dia calendário em BRT, não em UTC. Com
  // UTC, enviadosHoje zerava às 21:00 BRT (00:00 UTC) — 3h antes do fim do
  // dia real em Brasília —, o que bagunçava silenciosamente a contagem
  // usada tanto pelo limite diário quanto pela garantia das 12:00 BRT.
  const inicioDoDiaMs = inicioDoDiaBrtMs(agora);

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

// Garantia mínima diária (Missão Mestre, 2026-09-18, seção "Telegram — 1
// publicação garantida por dia"): 12:00 BRT é um MÍNIMO, não um teto — só
// registra se a garantia foi cumprida ou por que não (nunca força um
// candidato abaixo do limiar editorial (score >= 8) só pra bater a cota;
// "nenhum candidato elegível hoje" é um motivo honesto, não um erro).
function avaliarGarantiaMeioDiaTelegram(estado, agora, candidatosElegiveisHoje) {
  const brt = new Date(agora - OFFSET_BRT_MS);
  const passouDoMeioDia = brt.getUTCHours() >= 12;

  if (estado.enviadosHoje > 0) {
    return { horarioAlvoBrt: "12:00", cumprida: true, motivo: "pelo menos 1 publicação já saiu hoje (BRT)" };
  }
  if (!passouDoMeioDia) {
    return { horarioAlvoBrt: "12:00", cumprida: null, motivo: "ainda não são 12:00 BRT — garantia ainda não venceu hoje" };
  }
  if (candidatosElegiveisHoje > 0) {
    // Havia candidato elegível e o loop normal de envio (mesma passada)
    // já teria publicado — se chegou aqui sem enviadosHoje>0, o motivo
    // real (intervalo/erro/limite) já está registrado por candidato nos
    // resultados desta execução.
    return { horarioAlvoBrt: "12:00", cumprida: false, motivo: "havia candidato elegível, mas não foi publicado nesta execução — ver motivo por artigo" };
  }
  return { horarioAlvoBrt: "12:00", cumprida: false, motivo: "nenhum candidato com pontuação >= " + LIMIAR_MINIMO_ELEGIVEL_TELEGRAM + " disponível hoje — sem forçar conteúdo abaixo do limiar editorial" };
}

function avaliarJanelaDeEnvioTelegram(estado, agora, candidato) {
  if (estado.enviadosHoje >= LIMITE_EXCEPCIONAL_POR_DIA_TELEGRAM) {
    return { permitido: false, motivo: `limite diário excepcional (${LIMITE_EXCEPCIONAL_POR_DIA_TELEGRAM}) já atingido` };
  }
  if (estado.enviadosHoje >= LIMITE_NORMAL_POR_DIA_TELEGRAM) {
    if (candidato.pontuacao < LIMIAR_QUINTO_POST_EXCECIONAL_TELEGRAM) {
      return { permitido: false, motivo: `limite normal diário (${LIMITE_NORMAL_POR_DIA_TELEGRAM}) atingido e notícia não é excepcional o bastante para o 5º post` };
    }
  }
  if (estado.ultimoEnvioEm !== null) {
    const desdeUltimo = agora - estado.ultimoEnvioEm;
    if (desdeUltimo < INTERVALO_MINIMO_MS_TELEGRAM) {
      if (candidato.prioridadeMuitoAlta && !estado.jaFurouIntervaloHoje) {
        return { permitido: true, motivo: "furou o intervalo mínimo por prioridade muito alta (raro, 1x/dia)", furouIntervalo: true };
      }
      const minutosFaltando = Math.ceil((INTERVALO_MINIMO_MS_TELEGRAM - desdeUltimo) / 60000);
      return { permitido: false, motivo: `intervalo mínimo de 2h ainda não passou (faltam ~${minutosFaltando}min)` };
    }
  }
  return { permitido: true, motivo: "dentro dos limites de frequência", furouIntervalo: false };
}

const LIMITE_IDADE_CANDIDATO_HORAS_TELEGRAM = 48;

async function processarArtigosParaTelegram(artigos, historicoPublicados, urlBase, env, logger, agora) {
  const momento = agora || Date.now();
  const idsJaPublicados = (historicoPublicados || []).map((h) => h.article_id);
  const estado = computarEstadoEnviosTelegram(historicoPublicados, momento);

  const resultados = [];
  const candidatos = [];

  for (const artigo of artigos) {
    const dup = verificarDuplicidadeTelegram(artigo, idsJaPublicados);
    if (dup.duplicado) {
      resultados.push({ articleId: artigo.id, status: "ja_publicado", motivo: "já publicado" });
      continue;
    }

    const elegibilidade = avaliarElegibilidadeTelegram(artigo);
    if (!elegibilidade.elegivel) {
      resultados.push({ articleId: artigo.id, status: "descartado_editorial", motivo: elegibilidade.motivo, pontuacao: elegibilidade.pontuacao, categoria: elegibilidade.categoria });
      continue;
    }

    const idadeHoras = (momento - new Date(artigo.published_at).getTime()) / 3600000;
    if (Number.isFinite(idadeHoras) && idadeHoras > LIMITE_IDADE_CANDIDATO_HORAS_TELEGRAM) {
      resultados.push({
        articleId: artigo.id,
        status: "expirado",
        motivo: `elegível (score ${elegibilidade.pontuacao}) mas expirado — mais de ${LIMITE_IDADE_CANDIDATO_HORAS_TELEGRAM}h na fila sem ser enviado`,
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
    const janela = avaliarJanelaDeEnvioTelegram(estadoAtual, momento, { pontuacao, prioridadeMuitoAlta });

    if (!janela.permitido) {
      resultados.push({ articleId: artigo.id, status: "aguardando_intervalo", motivo: janela.motivo, pontuacao, categoria });
      continue;
    }

    const urlCanonica = `${urlBase}/noticia?id=${encodeURIComponent(artigo.id)}`;
    const urlCheck = verificarUrlOwnewsTelegram(urlCanonica);
    if (!urlCheck.valida) {
      resultados.push({ articleId: artigo.id, status: "erro", motivo: `URL de destino inválida: ${urlCheck.motivo}`, pontuacao, categoria });
      continue;
    }

    const payload = await prepararEnvioTelegram(env, artigo, urlCanonica);
    try {
      const envio = await publicarTelegram(payload, env, logger);
      resultados.push({
        articleId: artigo.id,
        status: envio.dryRun ? "dry_run" : "publicado",
        pontuacao,
        categoria,
        furouIntervalo: !!janela.furouIntervalo,
        telegramMessageId: envio.messageId,
        payload: envio.dryRun ? payload : undefined
      });
      enviadosNestaExecucao++;
      ultimoEnvioNestaExecucao = momento;
      if (janela.furouIntervalo) jaFurouNestaExecucao = true;
    } catch (erro) {
      resultados.push({ articleId: artigo.id, status: "erro", motivo: erro.message, tipoErro: erro.tipo || "desconhecido", pontuacao, categoria });
    }
  }

  return resultados;
}

/* ---------- Ligação com o Supabase (só esta parte não existe no módulo
   standalone testado — é a parte de I/O que o orquestrador acima nunca
   faz sozinho, por design). ---------- */

async function buscarHistoricoTelegramPublicados(env) {
  try {
    const resp = await fetch(
      `${env.SUPABASE_URL}/rest/v1/telegram_posts?select=article_id,published_at,furou_intervalo&status=eq.published`,
      { headers: supabaseHeaders(env) }
    );
    if (!resp.ok) {
      return { ok: false, motivo: `Supabase respondeu HTTP ${resp.status} (a tabela telegram_posts existe e a migration foi aplicada?)` };
    }
    return { ok: true, historico: await resp.json() };
  } catch (erro) {
    return { ok: false, motivo: erro.message };
  }
}

async function buscarCandidatosTelegram(env) {
  const corteJanela = new Date(Date.now() - LIMITE_IDADE_CANDIDATO_HORAS_TELEGRAM * 3600000).toISOString();
  const corte = corteJanela > TELEGRAM_ATIVADO_EM ? corteJanela : TELEGRAM_ATIVADO_EM;
  const endpoint =
    `${env.SUPABASE_URL}/rest/v1/articles?select=id,title,summary,content,image_url,image_credit,published_at,original_url` +
    `&status=eq.published&published_at=gte.${encodeURIComponent(corte)}&order=published_at.desc&limit=50`;
  const resp = await fetch(endpoint, { headers: supabaseHeaders(env) });
  if (!resp.ok) throw new Error(`Supabase (articles) respondeu HTTP ${resp.status}`);
  return resp.json();
}

async function registrarResultadoTelegram(env, artigo, resultado) {
  const linha = {
    article_id: artigo.id,
    canonical_url: `https://ownews.com.br/noticia?id=${encodeURIComponent(artigo.id)}`,
    status: resultado.status === "publicado" ? "published" : "failed",
    motivo: resultado.motivo || null,
    pontuacao: resultado.pontuacao ?? null,
    categoria: resultado.categoria || null,
    tipo_envio: resultado.payload?.tipo || null,
    fallback_de_foto: !!resultado.fallbackDeFoto,
    furou_intervalo: !!resultado.furouIntervalo,
    telegram_message_id: resultado.telegramMessageId != null ? String(resultado.telegramMessageId) : null,
    error_message: resultado.status === "erro" ? resultado.motivo : null,
    published_at: resultado.status === "publicado" ? new Date().toISOString() : null
  };
  try {
    const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/telegram_posts`, {
      method: "POST",
      headers: { ...supabaseHeaders(env), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(linha)
    });
    if (!resp.ok) {
      console.error("[Telegram] falha ao registrar resultado no Supabase, HTTP", resp.status);
    }
  } catch (erro) {
    console.error("[Telegram] erro ao registrar resultado:", erro.message);
  }
}

/* Ponto de entrada único, chamado a partir de scheduled(). Blindado: nunca
   lança — qualquer erro aqui fica só registrado no log, o collector segue
   normalmente. */
async function executarRadarTelegram(env) {
  try {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHANNEL_ID) {
      return { ok: true, ativo: false, motivo: "secrets do Telegram não configurados" };
    }

    const historicoResp = await buscarHistoricoTelegramPublicados(env);
    if (!historicoResp.ok) {
      console.warn("[Telegram] histórico indisponível, pulando esta execução com segurança:", historicoResp.motivo);
      return { ok: true, ativo: false, motivo: `histórico indisponível: ${historicoResp.motivo}` };
    }

    const candidatos = await buscarCandidatosTelegram(env);
    const resultados = await processarArtigosParaTelegram(
      candidatos, historicoResp.historico, "https://ownews.com.br", env, console, Date.now()
    );

    const porId = Object.fromEntries(candidatos.map((a) => [a.id, a]));
    for (const r of resultados) {
      if (r.status === "publicado" || r.status === "erro") {
        await registrarResultadoTelegram(env, porId[r.articleId], r);
      }
    }

    return { ok: true, ativo: true, resultados };
  } catch (erro) {
    console.error("[Telegram] erro inesperado no radar, ignorado com segurança (collector não é afetado):", erro.message);
    return { ok: false, motivo: erro.message };
  }
}

/* =========================================================================
   TELEGRAM — AGENDADOR DIÁRIO (2026-09-28)
   =========================================================================
   Boletim de aeroportos às 06:15 BRT (09:15 UTC) + Dica Offshore às 12:00
   BRT (15:00 UTC). Durable Object Alarm — NÃO usa cron trigger (conta já
   está no limite 5/5 do plano Free). Blindado: nunca lança nem interrompe
   o collector em nenhuma circunstância. Idempotente: cada envio diário é
   marcado por data BRT em DO storage — nunca reenvia no mesmo dia.
   ========================================================================= */

const NOMES_AEROPORTO_AGENDADOR = {
  SBJR: "Jacarepaguá",
  SBMI: "Maricá",
  SBCB: "Cabo Frio",
  SBME: "Macaé",
  SBFS: "São Tomé",
  SBVT: "Vitória",
  SBAR: "Aracaju",
  SBSV: "Salvador",
  SBFZ: "Fortaleza",
  SBOI: "Oiapoque",
  SBMQ: "Macapá"
};

const DICAS_OFFSHORE = [
  // ── SEGURANÇA ──────────────────────────────────────────────────────────────
  "NR-37 é a norma regulamentadora exclusiva para plataformas de petróleo. Ela define seus direitos de segurança, saúde e bem-estar a bordo — conhecê-la é obrigação de todo trabalhador offshore.",
  "APR (Análise Preliminar de Risco): preencher a APR antes de qualquer tarefa não é burocracia — é a principal ferramenta para identificar riscos e definir controles antes de começar o trabalho.",
  "H2S (Sulfeto de Hidrogênio): é incolor e inodoro em altas concentrações, pois paralisa o olfato. Use sempre o detector pessoal de H2S e nunca entre em área confinada sem leitura de gás feita e registrada.",
  "PTW (Permissão de Trabalho): nenhuma tarefa não rotineira começa sem PT aprovada. A PT define controles de segurança e responsáveis — ela protege você, sua equipe e a operação inteira.",
  "EPI offshore (NR-37): capacete, óculos, luvas, botas de segurança, protetor auricular e colete salva-vidas são básicos. Para trabalho em altura ou espaço confinado há EPIs específicos adicionais — nunca recuse tarefa sem EPI adequado.",
  "Near miss (quase acidente): reportar nunca gera punição — ao contrário, é reconhecido como atitude pró-segurança. Cada near miss reportado pode prevenir um acidente real com consequências graves.",
  "SIPAT: a Semana Interna de Prevenção de Acidentes do Trabalho é obrigatória anualmente, inclusive a bordo. Participe — é o principal canal para sugestões de melhoria em SST.",
  "Canal de denúncia anônima: toda empresa com NR-37 ativa deve ter canal anônimo para irregularidades de segurança. Se não souber qual é o da sua empresa, pergunte ao SESMT ou à CIPA.",
  "CIPA a bordo: toda plataforma com trabalhadores acima do dimensionamento mínimo da NR-5 deve ter CIPA própria. Conheça os cipeiros eleitos — eles têm mandato, não podem ser demitidos e representam você.",
  "Bloqueio e etiquetagem (LOTO — Lock Out, Tag Out): antes de trabalhar em qualquer equipamento elétrico, hidráulico ou mecânico, o sistema de energias perigosas deve ser isolado e bloqueado formalmente. Sem LOTO confirmado, a tarefa não começa.",
  "Trabalho em altura offshore: acima de 2 m do nível do convés é considerado trabalho em altura (NR-35). Cinto de segurança tipo paraquedista, talabarte e ponto de ancoragem certificado são obrigatórios.",
  "Espaço confinado: a entrada em tanques, cascos, dutos e compartimentos fechados exige PT específica, medição de atmosfera (O₂, combustíveis, H2S), vigia externo e comunicação contínua. Nunca entre sozinho.",
  "Segurança de içamento (lifting): nunca fique abaixo de carga suspensa. Inspeção de eslingas, grampas e equipamentos de içamento deve ser feita antes de cada operação — um equipamento reprovado é descarte imediato.",
  "PAN-PAN e MAYDAY: aprenda a diferença antes de precisar. PAN-PAN = situação urgente sem risco imediato. MAYDAY = perigo imediato à vida. Ambos exigem comunicação imediata no canal VHF 16.",
  "Reunião de segurança (safety meeting): participação obrigatória. Use o espaço para reportar observações de segurança — é exatamente para isso que a reunião existe, e seu relato pode prevenir um acidente.",
  // ── PRIMEIRO EMBARQUE ──────────────────────────────────────────────────────
  "POB (Persons On Board): ao embarcar, confirme que seu nome foi lançado no registro de bordo. Em emergência, o POB é a primeira ferramenta de busca e salvamento — um nome fora do registro pode custar tempo crítico.",
  "Muster Drill: o simulado de emergência no 1° dia de embarque não é opcional. Aprenda a localização das estações de mustering e do seu posto de abandono antes de começar o primeiro turno.",
  "HUET (Helicopter Underwater Escape Training): o certificado de fuga subaquática precisa ser renovado periodicamente (verifique o prazo da sua certificação). Programe a renovação com antecedência — sem ele, você não embarca.",
  "Embarque aéreo: a ANAC exige chegada ao heliporto com pelo menos 1 hora de antecedência. Leve documento de identidade, certificados atualizados e crachá da empresa — sem eles, você não embarca.",
  "Exame médico offshore (ASO): toda plataforma exige Atestado de Saúde Ocupacional específico para offshore, com avaliações físicas e funcionais definidas pelo SESMT. A validade varia por função — confirme antes de tentar embarcar.",
  "Curso de Sobrevivência no Mar: o certificado é exigido para trabalho offshore e inclui uso de colete salva-vidas, sobrevivência em água e embarque em balsas. Verifique se o seu está válido — a renovação periódica é obrigatória.",
  "Biometria e credenciais de acesso: ao primeiro embarque sua biometria e crachá são cadastrados no controle de acesso. Guarde o número de matrícula — ele identifica você em todo o sistema operacional da unidade.",
  "Comunicação com a família: combine um protocolo antes de embarcar. Informe os horários disponíveis para ligação, o procedimento para emergências familiares e o contato do departamento de pessoal da empresa.",
  // ── VIDA A BORDO ───────────────────────────────────────────────────────────
  "Sono e performance: a privação de sono aumenta o risco de acidentes em operações industriais. A NR-37 exige ambiente de repouso adequado — reporte quarto barulhento ou mal climatizado ao responsável de saúde.",
  "Saúde mental offshore: isolamento, ausência da família e turnos longos aumentam o risco de burnout. A NR-37 exige suporte psicológico na empresa — procure o serviço antes de chegar ao limite.",
  "Retorno antecipado por motivo de saúde: você pode solicitar repatriação com justificativa médica. Conheça o procedimento da sua empresa antes de precisar — o médico de bordo é o canal formal.",
  "Alimentação a bordo: a NR-37 exige alimentação adequada fornecida pela empresa durante o embarque. Se a qualidade ou quantidade não atender ao padrão, reporte ao SESMT ou RH — é um direito documentado.",
  "Adaptação a turnos: trabalhar 12h/dia por 14 ou 28 dias seguidos exige adaptação. Durma no horário da folga do turno, evite cafeína antes de deitar e use protetores auriculares se necessário.",
  "Fumo a bordo: smoking area é area designada e rigorosamente controlada em ambiente com hidrocarbonetos. Fumar fora da área designada é infração grave — pode resultar em desembarque imediato.",
  "Intervalo entre turnos: o mínimo legal são 11 horas de descanso entre jornadas. Turnos de 12h são comuns offshore — o intervalo precisa ser respeitado mesmo em operações urgentes.",
  // ── CARREIRA ───────────────────────────────────────────────────────────────
  "Sindipetro: o sindicato da sua regional negocia o ACT ou CCT que rege seus benefícios. Saiba qual cobre sua bacia — Sindipetro NF (Macaé/Campos), Sindipetro ES (Espírito Santo), FUP (federação nacional).",
  "Escala 14×14: nos 14 dias de trabalho a bordo você tem direito a adicional noturno, DSR proporcional e eventual adicional de periculosidade. Confira seu contracheque mês a mês e questione divergências.",
  "Escala 28×28: cada bloco tem 28 dias de trabalho e 28 dias de descanso. Não confunda com 'mês cheio' — os dias de viagem entram no cômputo conforme o ACT/CCT da categoria.",
  "Currículo offshore: inclua todos os certificados técnicos com data de emissão e vencimento. A lista de certificados válidos é o primeiro filtro eliminatório em vagas offshore — mantenha-os atualizados e visíveis no CV.",
  "Progressão de carreira a bordo: cargos técnicos seguem hierarquia clara (ex.: Operador → Técnico → Supervisor → Offshore Installation Manager). Conheça os requisitos de certificação de cada nível antes de almejar a promoção.",
  "Multiplicidade de função: trabalhadores offshore que dominam mais de uma disciplina (mecânico com certificação elétrica, operador com licença de içamento) têm maior empregabilidade e remuneração.",
  "Lei nº 5.811/1972: regula o trabalho de turnistas em refinarias e plataformas — define escala, intervalos e adicionais. Conhecê-la ajuda a identificar irregularidades no pagamento antes de reclamar.",
  // ── ORGANIZAÇÃO ────────────────────────────────────────────────────────────
  "Registro de embarque: guarde comprovantes (ordem de embarque, folha de controle de bordo, registros de hora). Em divergência na folha de pagamento, esses documentos são sua prova mais direta.",
  "Vencimento de cursos offshore: HUET, Sobrevivência no Mar, Primeiros Socorros e Segurança Básica têm prazos de renovação diferentes. Crie um calendário próprio — não dependa só do RH para ser avisado.",
  "Planejamento de embarque: prepare a mala com 48h de antecedência. Lista padrão: documentos originais, certificados impressos, medicamentos com receita, EPIs pessoais, roupas para o período. A última hora é para erros.",
  "Arquivo digital de documentos: mantenha no celular uma pasta com fotos dos certificados, CNH, passaporte e documentos trabalhistas. Em emergências ou para substituição rápida, o arquivo digital agiliza tudo.",
  "Transição de turno (handover): ao trocar de turno, faça um handover completo: status das atividades em andamento, anomalias observadas, tarefas pendentes. Um handover incompleto é causa de acidente documentada na indústria.",
  "Finanças durante o embarque: as despesas a bordo são mínimas. Use o período offshore para guardar parte do salário — automatize investimentos mensais para o dia do crédito em conta.",
  // ── DOCUMENTAÇÃO ───────────────────────────────────────────────────────────
  "eSocial e offshore: os eventos de SST (Saúde e Segurança no Trabalho) para plataformas passam pelo eSocial. Confirme que seus dados (ASO, cursos, EPIs) estão atualizados no sistema da empresa.",
  "Carteira de marítimo (Marinha do Brasil): necessária para funções a bordo de navios-plataforma. Precisa estar válida no embarque — sem ela, a função de bordo não pode ser exercida.",
  "Passaporte válido: mesmo trabalhando em plataformas brasileiras, algumas rotas de helicóptero cruzam zona econômica exclusiva de outros países. Mantenha passaporte válido por pelo menos 6 meses além do período de embarque previsto.",
  "Caderneta de Inscrição Marítima (CIM): exigida para trabalho a bordo de navio-plataforma (embarcação). É emitida pela Marinha do Brasil, distinta dos certificados offshore em terra. Verifique se sua função exige CIM.",
  "IANTD/PADI não equivale a HUET: cursos de mergulho recreativo não substituem os certificados de sobrevivência offshore exigidos pela NR-37/OPITO. São certificações distintas com fins distintos.",
  "ASO vs. laudo de aptidão: o ASO (Atestado de Saúde Ocupacional) é o documento final, assinado pelo médico do trabalho, que autoriza o exercício da função. O laudo de exame é intermediário — guarde os dois separadamente.",
  // ── OPERAÇÃO ───────────────────────────────────────────────────────────────
  "FPSO (Floating Production Storage and Offloading): produz, armazena e transfere óleo sem conexão fixa ao fundo do mar. Entender a função de cada módulo a bordo facilita a comunicação interdepartamental e a resposta a emergências.",
  "MODU, FPSO ou Sonda: MODU (Mobile Offshore Drilling Unit) é unidade de perfuração. FPSO é produção/estoque flutuante. Cada tipo tem regime, função e rotina operacional diferentes — vale conhecer onde você trabalha.",
  "MOC (Management of Change): qualquer alteração em processo, equipamento ou procedimento exige MOC formal documentado. Mudanças informais em ambiente offshore são origem conhecida de acidentes.",
  "Drill (exercício de emergência): toda plataforma realiza drills periódicos de incêndio, vazamento de gás e abandono. Participe ativamente — o erro no drill salva vidas no evento real. Não trate como burocracia.",
  "BOP (Blow-Out Preventer): equipamento de segurança crítico que previne o descontrole de poço (blowout). Em plataformas de perfuração, conhecer o nome e a função do BOP é referência de cultura de segurança.",
  "Monitoramento contínuo de gás: sistemas de Desligamento de Emergência (ESD/EDP) são ativados automaticamente por detecção de gás. Nunca tente contornar alarmes — eles existem para prevenir catástrofes como a de Piper Alpha (1988).",
  "Toolbox Meeting (reunião pré-turno): realizada antes de cada turno operacional, é onde se discutem as tarefas do dia, os riscos e os controles. Participação ativa é a melhor oportunidade para alinhar expectativas com o supervisor.",
  // ── CONVIVÊNCIA ────────────────────────────────────────────────────────────
  "Respeito à hierarquia operacional: a bordo, decisões de segurança seguem cadeia de comando clara. Mesmo discordando, use os canais formais para contestar — discussão no meio da operação cria risco adicional.",
  "Conflito interpessoal a bordo: 14 ou 28 dias em espaço confinado com as mesmas pessoas exige tolerância ativa. A maioria das plataformas tem procedimento de mediação de conflitos — use antes que o problema escale.",
  "Privacidade dos colegas: camarotes divididos são comuns em plataformas. Respeite os horários de sono do colega em folga — privação de sono do colega é risco operacional no turno seguinte dele.",
  "Mentoria informal: veteranos offshore têm conhecimento que não está em nenhum manual. No primeiro embarque, adote postura de aprendiz — a troca de experiência acelera a curva de aprendizado de forma que treinamentos não conseguem.",
  "Uso de celular durante operações: o uso de celular durante execução de tarefas é proibido na maioria das unidades. Foco dividido em operações industriais é fator de acidente documentado — guarde o celular enquanto trabalha.",
  // ── SIGLAS ─────────────────────────────────────────────────────────────────
  "OIM (Offshore Installation Manager): responsável máximo pela segurança e operação da unidade offshore. Equivale ao Encarregado Geral previsto na NR-37. As ordens do OIM em emergência têm precedência absoluta.",
  "CCR (Central Control Room): centro de controle e monitoramento da plataforma — de onde se monitoram pressão, temperatura, detecção de gás e se acionam alarmes de emergência.",
  "DPO (Dynamic Positioning Operator): responsável pelo sistema de posicionamento dinâmico que mantém FPSO ou navio-plataforma sobre o poço sem âncoras fixas. DP-1, DP-2 e DP-3 indicam o nível de redundância.",
  "SIMOPS (Simultaneous Operations): operações simultâneas — perfuração e produção ao mesmo tempo, por exemplo. Requerem planejamento adicional de segurança e coordenação entre equipes distintas.",
  "LSA (Life Saving Appliances): sigla genérica para todo equipamento de salvatagem: coletes, balsas, botes de resgate, EBE (Emergency Breathing Apparatus). A localização de cada LSA da sua área deve ser memorizada no primeiro dia.",
  "SPS (Safety and Protection System): sistema de proteção que aciona automaticamente ESD, isolamentos e shutdowns. SPS trip = evento sério que exige investigação formal antes de reiniciar a operação.",
  "PSV, AHTS e OSV: PSV (Platform Supply Vessel) faz suprimento. AHTS (Anchor Handling Tug Supply) maneja âncoras e também supre. OSV é o termo genérico para todos os navios de apoio offshore.",
  // ── CURIOSIDADES OFFSHORE ──────────────────────────────────────────────────
  "Pré-sal vs. pós-sal: o pré-sal fica abaixo de espessa camada de sal, em grandes lâminas d'água. Exige tecnologia específica e tem regime de concessão distinto — contexto essencial para entender a operação de Búzios e Tupi.",
  "Bacia de Santos vs. Campos: Santos concentra o pré-sal profundo (Tupi, Búzios). Campos tem a maior produção acumulada do Brasil e concentra plataformas mais antigas. Saber em qual bacia você está ajuda a contextualizar regulação e sindicato.",
  "Piper Alpha (1988): o pior acidente da história offshore — 167 mortos — ocorreu no Mar do Norte e transformou permanentemente os padrões de segurança globais. Falha na troca de turno (handover incompleto) foi fator contribuinte documentado.",
  "Deepwater Horizon (2010): plataforma da BP que explodiu no Golfo do México matando 11 pessoas e causando o maior derramamento de petróleo da história americana. O evento acelerou a regulação de controle de poço no mundo todo.",
  "Primeiro petróleo do pré-sal brasileiro: foi extraído em teste de longa duração no Campo de Jubarte (Bacia de Campos) em 2008. A produção comercial do pré-sal de Santos (Campo de Tupi) começou em 2010.",
  "Escala 14×14 no Brasil: é uma das escalas mais curtas em offshore no contexto internacional. Em países como Noruega, é comum escala 2×4 (2 semanas a bordo, 4 em terra). A escala brasileira é mais intensa — impacto maior na saúde a longo prazo.",
  // ── LOGÍSTICA ──────────────────────────────────────────────────────────────
  "REDEMET: antes de embarcar, consulte as condições meteorológicas em redemet.decea.mil.br. Ventos fortes podem suspender operações de helicóptero — saber isso com antecedência evita viagem desnecessária.",
  "Bagagem em helicóptero: o limite de peso varia por modelo de aeronave. Confirme com o heliporto de origem antes de sair de casa — bagagem excedente fica em terra, não vai no próximo voo com você.",
  "Transfer via barco (NOB): em algumas unidades, a chegada é por lancha ou Navio de Apoio de Base. O transfer por mar tem critérios de segurança próprios (altura de onda, visibilidade) — a decisão de embarcar é do mestre da embarcação.",
  "Conexões de helicóptero: o voo pode fazer escalas em outras plataformas antes de chegar ao seu destino. Leve lanche e esteja preparado para esperas no heliporto ou em bases intermediárias.",
  "Mudança de escala: comunicações de alteração de embarque frequentemente chegam com menos de 24h de antecedência. Mala pré-pronta com documentos e certificados evita correria e esquecimento de itens críticos.",
  "Check-in operacional: o heliporto confirma seu voo pelo departamento de logística da empresa. Ausência de confirmação formal com 24h de antecedência não é confirmação de voo — entre em contato com o dispatcher.",
  // ── BOAS PRÁTICAS ──────────────────────────────────────────────────────────
  "Stop Work Authority: qualquer trabalhador pode e deve parar uma operação insegura, sem medo de represália. É direito e responsabilidade documentados — a cultura de segurança offshore depende do exercício cotidiano dessa autoridade.",
  "Registro de anomalias: reporte toda anomalia (ruído anormal, vazamento, vibração) ao supervisor imediatamente, mesmo que pequena. Um componente trocado preventivamente evita parada não planejada e acidente.",
  "Seguro de vida: verifique se sua apólice cobre acidentes em ambiente offshore. Muitas apólices pessoais têm exclusão específica para alto mar — leia as cláusulas antes de embarcar.",
  "Hidratação a bordo: em conveses abertos em bacias tropicais como Campos e Santos, o risco de desidratação é real. Beba água regularmente ao longo do turno — não espere sentir sede para se hidratar.",
  "Procedimento de abandono: sequência básica — 1) alarme, 2) colete e traje de imersão, 3) estação de mustering, 4) contagem de bordo, 5) bote/balsa. Pratique o caminho até o bote até ele ser automático, não consciente.",
  "ANP — SAT (Serviço de Atendimento ao Trabalhador): para denúncias de irregularidades no setor de petróleo e gás, o canal da ANP é 0800 725 6451. Funciona em dias úteis, sem custo de ligação.",
  "Telemedicina offshore: muitas plataformas contam com telemedicina para consultas com especialistas além do médico de bordo. Conheça o canal disponível na sua unidade antes de precisar usá-lo.",
  "OPEP/PLANCON: o Plano de Emergência Individual e o Plano de Contingência são documentos de operação de cada unidade offshore. São referências formais em emergências — saiba onde consultá-los na sua plataforma.",
];

function proximoHorarioAgendadorUTC(agora, horaAlvo, minutoAlvo) {
  const d = new Date(agora);
  d.setUTCHours(horaAlvo, minutoAlvo, 0, 0);
  // Se já passou (ou está a menos de 30s), agenda para o dia seguinte
  if (d.getTime() <= agora + 30000) d.setUTCDate(d.getUTCDate() + 1);
  return d.getTime();
}

function proximoAlarmeAgendador(agora, ultimoTipoEnviado) {
  // Após enviar boletim → próximo é dica (15:00 UTC = 12:00 BRT)
  if (ultimoTipoEnviado === "boletim") return proximoHorarioAgendadorUTC(agora, 15, 0);
  // Após enviar dica (ou sem histórico) → próximo é boletim (09:15 UTC = 06:15 BRT)
  return proximoHorarioAgendadorUTC(agora, 9, 15);
}

function dataBRTString(agora) {
  const d = new Date(agora - 3 * 3600000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function formatarBoletimAeroportos(snapshot, agora) {
  if (!snapshot || !Array.isArray(snapshot.aeroportos)) return null;
  const ativos = snapshot.aeroportos.filter((a) => a.status === "ok" && a.total != null && a.total > 0);
  if (!ativos.length) return null;

  const brt = new Date(agora - 3 * 3600000);
  const dia = String(brt.getUTCDate()).padStart(2, "0");
  const mes = String(brt.getUTCMonth() + 1).padStart(2, "0");

  const atualizadoEm = snapshot.atualizado_em ? new Date(snapshot.atualizado_em).getTime() : null;
  const idadeMin = atualizadoEm ? Math.round((agora - atualizadoEm) / 60000) : null;

  let texto = `✈️ <b>AEROPORTOS OFFSHORE — ${dia}/${mes}</b>\n\n`;
  for (const a of ativos) {
    const nome = NOMES_AEROPORTO_AGENDADOR[a.airport] || a.airport;
    const partes = [];
    if (a.concluidos != null) partes.push(`${a.concluidos} pous.`);
    if (a.em_voo > 0) partes.push(`${a.em_voo} em voo`);
    if (a.pendentes > 0) partes.push(`${a.pendentes} pend.`);
    if (a.transferidos_cancelados > 0) partes.push(`${a.transferidos_cancelados} canc.`);
    texto += `<b>${escaparHtmlTelegram(nome)}</b>: ${a.total} voo${a.total !== 1 ? "s" : ""}`;
    if (partes.length) texto += ` (${partes.join(", ")})`;
    texto += "\n";
  }
  if (idadeMin !== null) texto += `\nDados de ~${idadeMin}min atrás`;
  texto += `\nownews.com.br/aeroportos`;
  return texto;
}

function selecionarDicaOffshore(agora) {
  const brt = new Date(agora - 3 * 3600000);
  const inicioAno = Date.UTC(brt.getUTCFullYear(), 0, 1);
  const diaDoAno = Math.floor(
    (Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()) - inicioAno) / 86400000
  );
  return DICAS_OFFSHORE[diaDoAno % DICAS_OFFSHORE.length];
}

async function publicarMensagemDiretaTelegram(env, texto) {
  const dryRun = env.TELEGRAM_DRY_RUN !== "false";
  if (dryRun) {
    console.log("[TelegramAgendador DRY_RUN] mensagem pronta:", texto.slice(0, 80) + "…");
    return { ok: true, dryRun: true };
  }
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHANNEL_ID) {
    return { ok: false, motivo: "secrets do Telegram não configurados" };
  }
  const base = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
  const resposta = await fetchComTimeoutTelegram(`${base}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHANNEL_ID, text: texto, parse_mode: "HTML" })
  });
  await interpretarRespostaTelegramApi(resposta, "TelegramAgendador/sendMessage");
  return { ok: true, enviado: true };
}

export class TelegramAgendadorPoller {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.pronto = this.inicializar();
  }

  async inicializar() {
    const alarmeExiste = await this.state.storage.getAlarm();
    if (!alarmeExiste) {
      await this.state.storage.setAlarm(proximoAlarmeAgendador(Date.now(), null));
    }
  }

  async fetch() {
    await this.pronto;
    return new Response(JSON.stringify({ ok: true, tipo: "TelegramAgendadorPoller" }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  async alarm() {
    const agora = Date.now();
    const horaUTC = new Date(agora).getUTCHours();
    const hojeStr = dataBRTString(agora);
    let ultimoTipoEnviado = null;

    try {
      const boletimDia = await this.state.storage.get("boletim_dia");
      const dicaDia = await this.state.storage.get("dica_dia");
      const jaEnviouBoletim = boletimDia === hojeStr;
      const jaEnviouDica = dicaDia === hojeStr;

      // 09:00–11:00 UTC = janela do boletim (06:00–08:00 BRT)
      const ehJanelaBoletim = horaUTC >= 9 && horaUTC < 11;
      // 14:30–16:30 UTC = janela da dica (11:30–13:30 BRT)
      const ehJanelaDica = horaUTC >= 14 && horaUTC < 17;

      if (ehJanelaBoletim && !jaEnviouBoletim) {
        await this.enviarBoletim(hojeStr, agora);
        ultimoTipoEnviado = "boletim";
      } else if (ehJanelaDica && !jaEnviouDica) {
        await this.enviarDica(hojeStr, agora);
        ultimoTipoEnviado = "dica";
      } else {
        // Fora de janela ou já enviou hoje — decide próximo agendamento:
        // < 9 UTC: antes do boletim → agenda 09:15 UTC hoje (null → next boletim)
        // 9-13 UTC: após boletim, antes dica → agenda 15:00 UTC hoje ("boletim")
        // >= 14 UTC: após dica → agenda 09:15 UTC amanhã ("dica")
        ultimoTipoEnviado = horaUTC < 9 ? null : horaUTC < 14 ? "boletim" : "dica";
      }
    } catch (e) {
      console.error("[TelegramAgendador] erro na execução do alarm, ignorado com segurança:", e.message);
    }

    await this.state.storage.setAlarm(proximoAlarmeAgendador(agora, ultimoTipoEnviado));
  }

  async enviarBoletim(hojeStr, agora) {
    try {
      const snapshot = await obterSnapshotOffVoosDoKV(this.env);
      const texto = formatarBoletimAeroportos(snapshot, agora);
      if (!texto) {
        console.warn("[TelegramAgendador] boletim aeroportos: sem dados disponíveis em", hojeStr);
        return;
      }
      const resultado = await publicarMensagemDiretaTelegram(this.env, texto);
      if (resultado.ok) {
        await this.state.storage.put("boletim_dia", hojeStr);
        try {
          if (this.env.SAUDE_KV) await this.env.SAUDE_KV.put("telegram_boletim_ultimo", JSON.stringify({ em: new Date().toISOString(), dia: hojeStr, dry_run: !!resultado.dryRun }));
        } catch {}
      }
      console.log("[TelegramAgendador] boletim enviado:", hojeStr, resultado.dryRun ? "(dry_run)" : "(real)");
    } catch (e) {
      console.error("[TelegramAgendador] erro ao enviar boletim:", e.message);
    }
  }

  async enviarDica(hojeStr, agora) {
    try {
      const dica = selecionarDicaOffshore(agora);
      const texto = `💡 <b>DICA OFFSHORE</b>\n\n${escaparHtmlTelegram(dica)}\n\nownews.com.br`;
      const resultado = await publicarMensagemDiretaTelegram(this.env, texto);
      if (resultado.ok) {
        await this.state.storage.put("dica_dia", hojeStr);
        try {
          if (this.env.SAUDE_KV) await this.env.SAUDE_KV.put("telegram_dica_ultima", JSON.stringify({ em: new Date().toISOString(), dia: hojeStr, dry_run: !!resultado.dryRun }));
        } catch {}
      }
      console.log("[TelegramAgendador] dica enviada:", hojeStr, resultado.dryRun ? "(dry_run)" : "(real)");
    } catch (e) {
      console.error("[TelegramAgendador] erro ao enviar dica:", e.message);
    }
  }
}

async function garantirTelegramAgendadorAtivo(env) {
  try {
    if (!env.TELEGRAM_AGENDADOR_DO) return;
    const id = env.TELEGRAM_AGENDADOR_DO.idFromName("global");
    const stub = env.TELEGRAM_AGENDADOR_DO.get(id);
    await stub.fetch("https://telegram-agendador.interno/ping");
  } catch { /* nunca derruba o collector */ }
}
