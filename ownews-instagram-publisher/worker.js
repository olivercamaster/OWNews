/* =========================================================================
   OWNews — ownews-instagram-publisher
   =========================================================================
   Worker isolado (MISSÃO FINAL INSTAGRAM, 2026-09-17): publica no Instagram
   @ownewsbr usando conteúdo já validado editorialmente pelo OWNews (mesma
   tabela "articles" que o site usa) — não cria um segundo pipeline de
   notícias, só um consumidor a mais.

   ARQUITETURA DE RENDERIZAÇÃO (revisão 2026-09-17, "sem upgrade de plano"):
   Cloudflare (Free) faz cron, seleção editorial, validações, dedupe,
   chamadas à Graph API do Instagram, histórico e observabilidade. A
   renderização pesada da arte (Satori+resvg+HarfBuzz+JPEG) NÃO roda aqui —
   excede em ~100-200x o teto de CPU de 10ms do plano Free (confirmado em
   produção, erro 1102). Em vez de pagar upgrade ou usar serviço externo,
   a arte é renderizada no VPS Hostinger já existente (mesma máquina deste
   repositório), via uma FILA DE JOBS pull-based:

     1. Este Worker escreve um job pendente em KV (dados de texto/URL de
        foto, nunca HTML/código) — ver /render-jobs/pending.
     2. Um script no VPS (ownews-instagram-render-vps/, cron a cada minuto,
        SEM nenhuma porta pública aberta) periodicamente FAZ UMA CHAMADA DE
        SAÍDA pra este mesmo Worker perguntando se há job pendente.
     3. Ele renderiza localmente (Node real, sem o limite de CPU do Worker)
        e ENVIA o JPEG de volta pra este Worker via outra chamada de saída.
     4. Só a partir daí este Worker segue o resto do pipeline: valida a
        arte, publica no Instagram, grava histórico.

   Ou seja: o VPS nunca aceita conexão de ninguém (zero superfície pública
   nova) — ele sempre inicia a conversa, usando o domínio público que este
   Worker já tem (workers.dev). As duas rotas novas (/render-jobs/pending e
   /render-jobs/:id/complete) exigem RENDER_SHARED_SECRET (secret do
   Worker, também guardado localmente no VPS fora do repo) e nunca aceitam
   HTML/JS arbitrário — só os campos de texto/URL definidos abaixo, sempre
   escapados pelos templates (que continuam vivendo só no VPS).

   Princípio herdado do Telegram (telegram-integration/): falha aqui NUNCA
   pode afetar o site, o collector ou o Supabase de produção.

   INSTAGRAM_DRY_RUN=true por padrão: o pipeline inteiro roda (seleção,
   score, job de arte, legenda) e para exatamente antes das chamadas à
   Graph API — a renderização em si continua acontecendo mesmo em dry run,
   pra permitir validar a arte visualmente antes de publicar de verdade.
   ========================================================================= */

const SUPABASE_ANON_KEY = 'sb_publishable_9cRatirjls8SQIoHdTUkLQ_8jt6psGt';

/* =========================================================================
   SELEÇÃO EDITORIAL (ETAPAS 5, 6, 7, 12)
   ========================================================================= */
const JANELA_FRESCOR_MS = 24 * 3600000;

const PALAVRAS_RISCO = [
  'morte', 'óbito', 'obito', 'faleceu', 'vítima fatal', 'vitima fatal',
  'acidente fatal', 'explosão com vítimas', 'explosao com vitimas', 'ferido grave',
];
const PALAVRAS_ACUSACAO = [
  'acusa', 'acusada', 'condenada', 'culpada', 'processo contra', 'investigação sobre', 'investigacao sobre',
];

const PALAVRAS_PRIORIDADE_ALTA = [
  'petrobras', 'petróleo', 'petroleo', 'gás', 'gas natural', 'offshore', 'sonda', 'fpso',
  'produção', 'producao', 'descoberta', 'contrato', 'anp', 'operaç', 'operac',
  'segurança operacional', 'seguranca operacional', 'mercado offshore', 'emprego', 'carreira',
  'vaga', 'regulament', 'licitação', 'licitacao', 'leilão', 'leilao',
];
const PALAVRAS_PRIORIDADE_MEDIA = [
  'combustív', 'combustiv', 'logística', 'logistica', 'transição energética', 'transicao energetica',
  'offshore wind', 'eólic', 'eolic', 'ccs', 'captura de carbono', 'hidrogênio', 'hidrogenio', 'geopolít', 'geopolit',
];

function calcularScoreCandidato(artigo, agora) {
  const texto = `${artigo.title} ${artigo.summary || ''}`.toLowerCase();
  let score = 0;
  const horas = (agora - new Date(artigo.published_at).getTime()) / 3600000;
  if (horas <= 3) score += 40;
  else if (horas <= 6) score += 30;
  else if (horas <= 12) score += 18;
  else score += 8;
  if (PALAVRAS_PRIORIDADE_ALTA.some((p) => texto.includes(p))) score += 35;
  if (PALAVRAS_PRIORIDADE_MEDIA.some((p) => texto.includes(p))) score += 15;
  const fonte = (artigo.image_credit || '').toLowerCase();
  if (['petrobras', 'anp', 'ppsa'].includes(fonte)) score += 10;
  // Ajustado em 2026-09-19 (Missão Contínua — overhaul Instagram, "não
  // quero posts pobres só com texto"): bônus antigo de +5 era pequeno
  // demais pra pesar contra recência/prioridade de assunto — um artigo
  // da ANP (bate em PALAVRAS_PRIORIDADE_ALTA) sem foto quase sempre
  // vencia um artigo com foto real só um pouco mais velho ou de tópico
  // secundário, empurrando o pipeline pro fallback gráfico (N2 sem foto)
  // com mais frequência do que o necessário. Instagram é uma plataforma
  // visual — foto real vale bem mais aqui do que no ranking do site.
  if (artigo.image_url) score += 25;
  return score;
}
const LIMIAR_MINIMO_SCORE = 30;

function falhaFiltroDuro(artigo) {
  const texto = `${artigo.title} ${artigo.summary || ''}`.toLowerCase();
  if (PALAVRAS_RISCO.some((p) => texto.includes(p))) return `vocabulário de risco/vítima detectado: "${PALAVRAS_RISCO.find((p) => texto.includes(p))}"`;
  if (PALAVRAS_ACUSACAO.some((p) => texto.includes(p))) return `vocabulário de acusação não confirmada detectado: "${PALAVRAS_ACUSACAO.find((p) => texto.includes(p))}"`;
  return null;
}

function normalizarTitulo(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
}
function similaridadeTitulos(a, b) {
  const wa = new Set(normalizarTitulo(a));
  const wb = new Set(normalizarTitulo(b));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / new Set([...wa, ...wb]).size;
}
const LIMIAR_SIMILARIDADE = 0.55;

/* Editoria visível na arte do Instagram (2026-09-19, mesma regra editorial
   aplicada ao site: nunca o nome da fonte como rótulo/categoria — ver
   MISSION-STATE.md). Antes, categoriaLabel usava artigo.image_credit
   direto ("PETROBRAS"/"ANP"/"EPE" aparecia como o badge de categoria na
   própria arte publicada) — mesmo problema de propaganda gratuita de
   veículo, só que na peça gráfica em vez do card do site. Mesma ordem/
   vocabulário do classificador do site (ownews-git), reimplementado aqui
   porque são Workers separados sem módulo compartilhado. */
const FONTES_INTERNACIONAIS_IG = new Set(['Transocean', 'SBM Offshore']);
const PALAVRAS_CARREIRAS_IG = [
  'vaga', 'vagas', 'emprego', 'empregos', 'contratação', 'contratacao',
  'greve', 'assembleia', 'assembléia', 'sindicato', 'sindical', 'contraproposta', 'termo aditivo',
  'acordo coletivo', 'convenção coletiva', 'convencao coletiva',
];
const PALAVRAS_CONTRATOS_IG = [
  'contrato', 'contratos', 'adjudicação', 'adjudicacao', 'firma contrato', 'assina contrato',
  'afretamento', 'afretado', 'afretada',
];
const PALAVRAS_OPERACOES_IG = [
  'plataforma', 'navio-plataforma', 'fpso', 'sonda', 'poço', 'poco', 'perfuração', 'perfuracao',
  'descomissionamento', 'pré-sal', 'pre-sal', 'margem equatorial', 'búzios', 'buzios', 'campo',
  'águas profundas', 'aguas profundas', 'uep', 'mero', 'tupi',
];
const PALAVRAS_MERCADO_IG = [
  'royalties', 'participação especial', 'participacao especial', 'licitação', 'licitacao',
  'leilão', 'leilao', 'concessão', 'concessao', 'oferta permanente', 'bloco', 'bacia',
  'gás natural', 'gas natural', 'eólica offshore', 'eolica offshore', 'exportação', 'exportacao',
  'hidrocarbonetos', 'gasoduto', 'mercado',
];
const PALAVRAS_ENERGIA_IG = [
  'combustível', 'combustivel', 'combustíveis', 'combustiveis', 'gasolina', 'diesel', 'etanol', 'glp',
  'biocombustível', 'biocombustivel', 'biodiesel', 'hidrogênio', 'hidrogenio', 'transição energética',
  'transicao energetica', 'matriz energética', 'matriz energetica', 'biometano',
];
function editoriaDeInstagram(artigo) {
  if (artigo && FONTES_INTERNACIONAIS_IG.has(artigo.image_credit)) return 'INTERNACIONAL';
  const t = `${artigo.title || ''} ${artigo.summary || ''}`.toLowerCase();
  if (PALAVRAS_CARREIRAS_IG.some((p) => t.includes(p))) return 'CARREIRAS';
  if (PALAVRAS_CONTRATOS_IG.some((p) => t.includes(p))) return 'CONTRATOS';
  if (PALAVRAS_OPERACOES_IG.some((p) => t.includes(p))) return 'OPERAÇÕES';
  if (PALAVRAS_MERCADO_IG.some((p) => t.includes(p))) return 'MERCADO';
  if (PALAVRAS_ENERGIA_IG.some((p) => t.includes(p))) return 'ENERGIA';
  return 'BRASIL';
}

async function buscarCandidatosNoticia(env) {
  const desde = new Date(Date.now() - JANELA_FRESCOR_MS).toISOString();
  const url = `${env.SUPABASE_URL}/rest/v1/articles?select=id,title,summary,image_url,image_credit,original_url,published_at&status=eq.published&published_at=gte.${encodeURIComponent(desde)}&order=published_at.desc&limit=30`;
  const resp = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
  if (!resp.ok) throw new Error(`Supabase (articles) HTTP ${resp.status}`);
  return resp.json();
}

async function buscarHistoricoInstagram(env, limite = 30) {
  const url = `${env.SUPABASE_URL}/rest/v1/instagram_posts?select=article_id,headline,status,post_type,tema_institucional,created_at&order=created_at.desc&limit=${limite}`;
  const resp = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
  if (!resp.ok) return { ok: false, motivo: `Supabase (instagram_posts) HTTP ${resp.status}`, historico: [] };
  return { ok: true, historico: await resp.json() };
}

async function jaPublicouHoje(env) {
  const inicioDoDia = new Date(); inicioDoDia.setUTCHours(0, 0, 0, 0);
  const url = `${env.SUPABASE_URL}/rest/v1/instagram_posts?select=id&status=eq.published&post_type=eq.noticia&published_at=gte.${encodeURIComponent(inicioDoDia.toISOString())}&limit=1`;
  const resp = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
  if (!resp.ok) return false;
  const linhas = await resp.json();
  return linhas.length > 0;
}

async function selecionarCandidatoNoticia(env) {
  const [candidatos, historicoResp] = await Promise.all([buscarCandidatosNoticia(env), buscarHistoricoInstagram(env, 40)]);
  const historico = historicoResp.historico;
  const idsJaUsados = new Set(historico.filter((h) => h.article_id && h.status !== 'failed').map((h) => h.article_id));
  const headlinesRecentes = historico.filter((h) => h.status === 'published').map((h) => h.headline).filter(Boolean);

  const agora = Date.now();
  const elegiveis = [];
  const descartados = [];

  for (const artigo of candidatos) {
    if (idsJaUsados.has(artigo.id)) { descartados.push({ id: artigo.id, motivo: 'já publicado/testado antes (dedupe por article_id)' }); continue; }
    const horas = (agora - new Date(artigo.published_at).getTime()) / 3600000;
    if (!(horas >= 0 && horas <= 24)) { descartados.push({ id: artigo.id, motivo: `fora da janela de frescor (${horas.toFixed(1)}h)` }); continue; }
    const motivoDuro = falhaFiltroDuro(artigo);
    if (motivoDuro) { descartados.push({ id: artigo.id, motivo: `filtro duro: ${motivoDuro}` }); continue; }
    const parecido = headlinesRecentes.find((h) => similaridadeTitulos(h, artigo.title) >= LIMIAR_SIMILARIDADE);
    if (parecido) { descartados.push({ id: artigo.id, motivo: `assunto muito parecido com post recente: "${parecido}"` }); continue; }
    elegiveis.push({ artigo, score: calcularScoreCandidato(artigo, agora) });
  }

  elegiveis.sort((a, b) => b.score - a.score);
  const melhor = elegiveis[0];
  if (!melhor || melhor.score < LIMIAR_MINIMO_SCORE) {
    return { escolhido: null, motivo: !melhor ? 'nenhum candidato elegível na janela de 24h' : `melhor score (${melhor.score}) abaixo do limiar mínimo (${LIMIAR_MINIMO_SCORE})`, descartados, avaliados: candidatos.length };
  }

  // Pré-validação de imagem entre os melhores candidatos (2026-09-19, P3 —
  // "não escolher primeiro pra depois descobrir que a foto falha"): só
  // troca o escolhido se (a) a foto do 1º colocado realmente falhar E (b)
  // existir, entre os próximos melhores, um com foto válida cujo score não
  // esteja muito abaixo — uma notícia bem mais forte sem foto ainda vence
  // (Instagram nunca deve preterir a notícia mais importante só por causa
  // de foto; fallback gráfico premium continua existindo pra esse caso).
  // Custo limitado a no máximo 3 validações reais (1 subrequest cada).
  const TOPO_PRE_VALIDACAO = 3;
  const MARGEM_SCORE_TROCA_POR_FOTO = 15;
  let escolhidoFinal = melhor;
  let imagemEscolhida = await validarImagemArtigo(melhor.artigo.image_url);
  if (!imagemEscolhida.ok) {
    for (const candidato of elegiveis.slice(1, TOPO_PRE_VALIDACAO)) {
      if (melhor.score - candidato.score > MARGEM_SCORE_TROCA_POR_FOTO) continue;
      const imagemCandidato = await validarImagemArtigo(candidato.artigo.image_url);
      if (imagemCandidato.ok) { escolhidoFinal = candidato; imagemEscolhida = imagemCandidato; break; }
    }
  }
  return { escolhido: escolhidoFinal.artigo, score: escolhidoFinal.score, imagemResp: imagemEscolhida, descartados, avaliados: candidatos.length };
}

/* =========================================================================
   INSTITUCIONAL SEMANAL (ETAPA 11)
   ========================================================================= */
const TEMAS_INSTITUCIONAIS = [
  { tema: 'minha_escala', eyebrow: 'Ferramenta OWNews', headline: 'Organize sua escala offshore em um só lugar.', subtitulo: 'O Minha Escala ajuda quem trabalha embarcado a acompanhar seus próprios dias de embarque e folga.', cta: 'Conheça em ownews.com.br' },
  { tema: 'aeroportos', eyebrow: 'Condições dos aeroportos offshore', headline: 'Acompanhe as condições meteorológicas antes de embarcar.', subtitulo: 'O OWNews traz a leitura das condições meteorológicas reportadas nos principais aeroportos de apoio offshore.', cta: 'Consulte em ownews.com.br' },
  { tema: 'radar_offshore', eyebrow: 'Radar Offshore', headline: 'Veja as unidades operando no litoral brasileiro.', subtitulo: 'O Radar Offshore reúne informações públicas da ANP sobre unidades e campos de produção em operação.', cta: 'Explore em ownews.com.br' },
  { tema: 'carreiras', eyebrow: 'Carreiras offshore', headline: 'Entenda as funções a bordo do setor offshore.', subtitulo: 'Um guia editorial sobre funções, formação e caminhos de carreira no offshore brasileiro.', cta: 'Leia em ownews.com.br' },
  { tema: 'cadastre_curriculo', eyebrow: 'Carreiras offshore', headline: 'Cadastre seu currículo e fique visível ao setor.', subtitulo: 'O OWNews permite cadastrar seu currículo na área de Carreiras.', cta: 'Cadastre-se em ownews.com.br' },
  { tema: 'funcoes_a_bordo', eyebrow: 'Funções a Bordo', headline: 'Conheça as funções que mantêm uma unidade offshore operando.', subtitulo: 'Do convés à praça de máquinas: um panorama editorial das funções a bordo.', cta: 'Veja em ownews.com.br' },
  { tema: 'giro_24h', eyebrow: 'Giro 24h', headline: 'O resumo do setor offshore nas últimas 24 horas.', subtitulo: 'Sempre que há novidade real, o Giro 24h da Home reúne o que aconteceu no setor no último dia.', cta: 'Acompanhe em ownews.com.br' },
];

async function escolherTemaInstitucional(env) {
  const resp = await buscarHistoricoInstagram(env, 10);
  const historico = resp.ok ? resp.historico.filter((h) => h.post_type === 'institucional' && h.status === 'published') : [];
  const ultimoTema = historico[0] ? historico[0].tema_institucional : null;
  let idx = 0;
  if (ultimoTema) {
    const i = TEMAS_INSTITUCIONAIS.findIndex((t) => t.tema === ultimoTema);
    idx = i >= 0 ? (i + 1) % TEMAS_INSTITUCIONAIS.length : 0;
  }
  return TEMAS_INSTITUCIONAIS[idx];
}

/* =========================================================================
   LEGENDA (ETAPA 10): FATO -> CONTEXTO -> POR QUE IMPORTA -> CTA
   ========================================================================= */
function truncar(s, max) {
  if (!s) return '';
  return s.length <= max ? s : s.slice(0, max - 1).trim() + '…';
}
function gerarLegendaNoticia(artigo) {
  const fato = truncar(artigo.title, 200);
  const contexto = artigo.summary ? truncar(artigo.summary, 260) : '';
  const linhas = [fato];
  if (contexto) linhas.push(contexto);
  linhas.push('Mais detalhes e contexto no OWNews.');
  linhas.push('');
  // Atribuição na legenda (2026-09-19, mesmo princípio do site: fonte
  // nunca escondida, só sem decorar a peça gráfica em si) — a arte usa
  // editoriaDeInstagram() no lugar do nome da fonte, então a atribuição
  // de verdade mora aqui, em texto.
  if (artigo.image_credit) linhas.push(`Fonte: ${artigo.image_credit}`);
  linhas.push(`Acesse: ownews.com.br/noticia?id=${artigo.id}`);
  return linhas.join('\n\n');
}
function gerarLegendaInstitucional(tema) {
  return [tema.headline, tema.subtitulo, '', `Acesse: ownews.com.br`].join('\n\n');
}
function gerarLegendaLancamento() {
  return [
    'Notícia é só o começo.',
    'O OWNews reúne, em um só lugar, informação e ferramentas para quem vive e acompanha o offshore: notícias do setor, o Giro 24h, o Minha Escala, condições meteorológicas dos aeroportos offshore, o Radar Offshore e a área de Carreiras.',
    'Esse é o padrão visual que você vai ver por aqui a partir de agora.',
    '',
    'Acesse: ownews.com.br',
  ].join('\n\n');
}

/* =========================================================================
   IMAGEM DA MATÉRIA: validação (ETAPA 8) — roda aqui (Cloudflare), não no
   VPS, porque decide algo editorial (qual foto usar), não é renderização.
   ========================================================================= */
function dimensoesJpeg(bytes) {
  let i = 2;
  while (i < bytes.length - 9) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      const altura = (bytes[i + 5] << 8) | bytes[i + 6];
      const largura = (bytes[i + 7] << 8) | bytes[i + 8];
      return { largura, altura };
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const tam = (bytes[i + 2] << 8) | bytes[i + 3];
    i += 2 + tam;
  }
  return null;
}
function dimensoesPng(bytes) {
  if (bytes.length < 24) return null;
  const largura = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const altura = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  return { largura, altura };
}
const PADROES_IMAGEM_INADEQUADA = ['favicon', 'logo', 'spcommon', 'sprite', 'icon', '.svg', 'placeholder'];
const LARGURA_MINIMA_FOTO = 800;
const ALTURA_MINIMA_FOTO = 500;

// Domínios já confiáveis (mesmas fontes oficiais que o collector já usa) —
// única lista permitida para a foto de fundo, pra nunca abrir SSRF via
// image_url de artigo (defesa em profundidade, mesmo a URL vindo do nosso
// próprio banco). Path traversal não se aplica (não construímos caminho de
// arquivo a partir disso, só passamos a URL adiante).
// petronoticias.com.br adicionado em 2026-09-19 (Missão Contínua — Central
// Offshore): era a causa principal do publisher cair pra text-only ("card
// tipográfico") nos últimos dias — o /saude do collector mostrava
// sources_active_24h só com PetroNotícias, e o domínio dela nunca esteve
// nesta lista, então NENHUMA foto de matéria PetroNotícias passava em
// validarImagemArtigo, mesmo depois da correção da extração no collector
// (ver extrairImagemPrincipal em shrill-pond-a915). Fonte já é confiável o
// bastante pra ser usada como conteúdo editorial (ver falhaFiltroDuro) —
// confiar no mesmo domínio pra imagem de fundo não é um novo risco.
// Expansão de 2026-09-27 (autorizada pelo operador): as 4 fontes novas
// ativadas na expansão do Source Registry. Hostnames REAIS das imagens
// verificados no banco/feed antes de entrar aqui, não supostos —
// Marine Technology News serve de CDN própria
// (images.marinetechnologynews.com) e MegaWhat de /wp-content do próprio
// domínio. Só o domínio-base é listado: a checagem já aceita subdomínio
// (host === d || host.endsWith('.' + d)), então 'www.' e 'images.' ficam
// cobertos sem duplicar entrada. Mesmo critério de sempre: fonte que já
// é confiável o bastante pra virar conteúdo editorial é confiável pra
// imagem de fundo — não é risco novo de SSRF.
const DOMINIOS_FOTO_PERMITIDOS = [
  'agencia.petrobras.com.br', 'www.gov.br', 'gov.br', 'presalpetroleo.gov.br',
  'www.presalpetroleo.gov.br', 'epe.gov.br', 'www.epe.gov.br', 'agencia.marinha.mil.br',
  'petronoticias.com.br', 'www.petronoticias.com.br',
  'portosenavios.com.br', 'offshore-energy.biz', 'marinetechnologynews.com',
  'megawhat.uol.com.br',
  // 2ª leva (2026-09-27, também autorizada): fontes que JÁ estavam ativas
  // no collector mas nunca entraram aqui — mesma falha silenciosa do caso
  // PetroNotícias, descoberta ao mapear hostname real por fonte. Eixos é
  // a mais grave: fonte de MAIOR volume do site (59 matérias com foto),
  // 100% caindo pro card tipográfico sem erro aparente. Domínio-base
  // cobre o subdomínio de CDN (uploads.eixos.com.br, imagens.ebc.com.br).
  'eixos.com.br', 'ebc.com.br', 'sindipetronf.org.br', 'fup.org.br',
  'sbmoffshore.com', 'noticiasmacae.com',
];

async function validarImagemArtigo(imageUrl) {
  if (!imageUrl) return { ok: false, motivo: 'artigo sem image_url' };
  let host;
  try { host = new URL(imageUrl).hostname; } catch { return { ok: false, motivo: 'URL de imagem malformada' }; }
  if (!DOMINIOS_FOTO_PERMITIDOS.some((d) => host === d || host.endsWith('.' + d))) {
    return { ok: false, motivo: `domínio de imagem fora da lista de fontes confiáveis: ${host}` };
  }
  const urlBaixa = imageUrl.toLowerCase();
  if (PADROES_IMAGEM_INADEQUADA.some((p) => urlBaixa.includes(p))) {
    return { ok: false, motivo: `URL de imagem corresponde a padrão inadequado (ícone/logo/placeholder): ${imageUrl}` };
  }
  let resposta;
  try {
    resposta = await fetch(imageUrl, { headers: { 'User-Agent': 'OWNews/1.0 - Instagram publisher' } });
  } catch (erro) {
    return { ok: false, motivo: `falha ao buscar imagem: ${erro.message}` };
  }
  if (!resposta.ok) return { ok: false, motivo: `imagem respondeu HTTP ${resposta.status}` };
  const buf = new Uint8Array(await resposta.arrayBuffer());
  if (buf.length < 8000) return { ok: false, motivo: `imagem muito pequena em bytes (${buf.length}) — provável ícone/placeholder` };
  let dims = null;
  const ct = (resposta.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('png') || (buf[0] === 0x89 && buf[1] === 0x50)) dims = dimensoesPng(buf);
  else dims = dimensoesJpeg(buf);
  if (!dims) return { ok: false, motivo: 'não foi possível determinar as dimensões da imagem (formato não reconhecido)' };
  if (dims.largura < LARGURA_MINIMA_FOTO || dims.altura < ALTURA_MINIMA_FOTO) {
    return { ok: false, motivo: `resolução insuficiente (${dims.largura}x${dims.altura}, mínimo ${LARGURA_MINIMA_FOTO}x${ALTURA_MINIMA_FOTO})` };
  }
  const aspectRatio = dims.largura / dims.altura;
  // Proporção absurda (panorama finíssimo ou tira vertical) não cabe bem em
  // nenhum dos 3 templates sem cortar informação importante — mais seguro
  // rejeitar e cair pro fallback gráfico do que forçar um crop ruim.
  if (aspectRatio > 3.2 || aspectRatio < 0.28) {
    return { ok: false, motivo: `proporção incomum (${aspectRatio.toFixed(2)}:1) — inadequada pros templates disponíveis` };
  }
  return { ok: true, dims, aspectRatio };
}

// Escolha DETERMINÍSTICA de template (ETAPA 5): mesma foto/manchete sempre
// produz o mesmo template. Mapeamento para os 3 templates oficiais (MISSÃO 2.0):
// Template A = N1 (foto superior ~52% / texto embaixo) — template PRINCIPAL
// Template B = N2 com foto (full-bleed, só quando foto tem proporção portrait/quadrada)
// Template C = N2 sem foto (tipográfico com decoração de anéis)
// Template N3 = variante de A com split lateral (foto muito vertical)
// Ajuste 2026-10-02: limiar baixado de 1.4 para 1.1 → landscape e quadrado
// vão para N1 (Template A), tornando-o predominante conforme a missão.
// N2 com foto fica reservado para retratos/fotos ≤1.1 (mais raras).
function escolherTemplateNoticia({ temFoto, aspectRatio, headline }) {
  if (!temFoto) return 'n2'; // Template C: fallback tipográfico
  if (aspectRatio >= 1.1) return 'n1'; // Template A: landscape/quadrado (caso mais comum)
  if (aspectRatio <= 0.72) return 'n3'; // Template A split: retrato muito vertical
  return 'n2'; // Template B: retrato/quadrado estreito → full-bleed (moderado)
}

/* =========================================================================
   FAIL-SAFE (ETAPA 14)
   ========================================================================= */
async function validarCandidato(ctx) { return ctx.artigo || ctx.tema ? { ok: true } : { ok: false, motivo: 'nenhum candidato/tema' }; }
async function validarFreshness(ctx) {
  if (ctx.tipo !== 'noticia') return { ok: true };
  const horas = (Date.now() - new Date(ctx.artigo.published_at).getTime()) / 3600000;
  return horas >= 0 && horas <= 24 ? { ok: true } : { ok: false, motivo: `fora da janela de frescor (${horas.toFixed(1)}h)` };
}
async function validarDedup(ctx, env) {
  if (ctx.tipo !== 'noticia') return { ok: true };
  const resp = await buscarHistoricoInstagram(env, 60);
  if (!resp.ok) return { ok: false, motivo: `não foi possível checar dedupe: ${resp.motivo}` };
  const jaExiste = resp.historico.some((h) => h.article_id === ctx.artigo.id && h.status !== 'failed');
  return jaExiste ? { ok: false, motivo: 'artigo já tem post registrado (dedupe)' } : { ok: true };
}
async function validarSource(ctx) {
  if (ctx.tipo !== 'noticia') return { ok: true };
  const motivo = falhaFiltroDuro(ctx.artigo);
  return motivo ? { ok: false, motivo } : { ok: true };
}
async function validarArtwork(ctx) {
  if (!ctx.jpegBytes || ctx.jpegBytes.length < 8000) return { ok: false, motivo: 'arte recebida do VPS vazia ou suspeita de tamanho' };
  if (!(ctx.jpegBytes[0] === 0xff && ctx.jpegBytes[1] === 0xd8)) return { ok: false, motivo: 'arte recebida não é um JPEG válido (assinatura de bytes incorreta)' };
  return { ok: true };
}
async function validarCaption(ctx) {
  if (!ctx.caption || ctx.caption.length < 20) return { ok: false, motivo: 'legenda vazia ou curta demais' };
  if (ctx.caption.length > 2200) return { ok: false, motivo: 'legenda excede limite do Instagram (2200 caracteres)' };
  return { ok: true };
}
async function validarConta(env) {
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_ACCOUNT_ID) return { ok: false, motivo: 'credenciais do Instagram ausentes' };
  return { ok: true };
}
async function validarRateLimit(env) {
  const hoje = await jaPublicouHoje(env);
  return hoje ? { ok: false, motivo: 'já existe 1 publicação real hoje (trava por dia, independente do horário)' } : { ok: true };
}
async function rodarValidacoesFinais(ctx, env) {
  const passos = [
    ['validateCandidate', validarCandidato(ctx)],
    ['validateFreshness', validarFreshness(ctx)],
    ['validateDedup', validarDedup(ctx, env)],
    ['validateSource', validarSource(ctx)],
    ['validateArtwork', validarArtwork(ctx)],
    ['validateCaption', validarCaption(ctx)],
    ['validateAccount', validarConta(env)],
    ['validateRateLimit', validarRateLimit(env)],
  ];
  for (const [nome, promessa] of passos) {
    const r = await promessa;
    if (!r.ok) return { ok: false, etapa: nome, motivo: r.motivo };
  }
  return { ok: true };
}

/* =========================================================================
   GRAPH API (Instagram API with Instagram Login — graph.instagram.com)
   ========================================================================= */
const GRAPH_BASE = 'https://graph.instagram.com/v23.0';

async function criarContainer(env, imageUrl, caption) {
  const url = `${GRAPH_BASE}/${env.INSTAGRAM_ACCOUNT_ID}/media`;
  const params = new URLSearchParams({ image_url: imageUrl, caption });
  const resp = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${env.INSTAGRAM_ACCESS_TOKEN}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  const data = await resp.json();
  if (!resp.ok || !data.id) throw new Error(`criarContainer falhou: HTTP ${resp.status} — ${JSON.stringify(data)}`);
  return data.id;
}
async function aguardarContainerPronto(env, creationId, tentativas = 8, intervaloMs = 3000) {
  for (let i = 0; i < tentativas; i++) {
    const resp = await fetch(`${GRAPH_BASE}/${creationId}?fields=status_code`, { headers: { Authorization: `Bearer ${env.INSTAGRAM_ACCESS_TOKEN}` } });
    const data = await resp.json();
    if (data.status_code === 'FINISHED') return { ok: true };
    if (data.status_code === 'ERROR') return { ok: false, motivo: `container em ERROR: ${JSON.stringify(data)}` };
    await new Promise((r) => setTimeout(r, intervaloMs));
  }
  return { ok: false, motivo: 'timeout aguardando container ficar FINISHED' };
}
async function publicarContainer(env, creationId) {
  const url = `${GRAPH_BASE}/${env.INSTAGRAM_ACCOUNT_ID}/media_publish`;
  const params = new URLSearchParams({ creation_id: creationId });
  const resp = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${env.INSTAGRAM_ACCESS_TOKEN}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  const data = await resp.json();
  if (!resp.ok || !data.id) throw new Error(`publicarContainer falhou: HTTP ${resp.status} — ${JSON.stringify(data)}`);
  return data.id;
}
async function obterPermalink(env, mediaId) {
  try {
    const resp = await fetch(`${GRAPH_BASE}/${mediaId}?fields=permalink`, { headers: { Authorization: `Bearer ${env.INSTAGRAM_ACCESS_TOKEN}` } });
    const data = await resp.json();
    return data.permalink || null;
  } catch { return null; }
}

/* =========================================================================
   HISTÓRICO (Supabase instagram_posts)
   ========================================================================= */
async function gravarHistorico(env, linha) {
  const url = `${env.SUPABASE_URL}/rest/v1/instagram_posts`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(linha),
  });
  const texto = await resp.text();
  if (!resp.ok) return { ok: false, motivo: `Supabase insert HTTP ${resp.status}: ${texto}` };
  return { ok: true, linha: JSON.parse(texto)[0] };
}

/* =========================================================================
   OBSERVABILIDADE (ETAPA 19)
   ========================================================================= */
async function registrarExecucao(env, dados) {
  try { if (env.SAUDE_KV) await env.SAUDE_KV.put('instagram_ultima_execucao', JSON.stringify(dados)); } catch { /* nunca derruba a publicação */ }
}
function calcularProximosTriggers(agora) {
  function proximo(hUtc, mUtc, diaSemana) {
    const d = new Date(agora);
    d.setUTCHours(hUtc, mUtc, 0, 0);
    if (diaSemana !== undefined) { while (d.getUTCDay() !== diaSemana || d.getTime() <= agora.getTime()) d.setUTCDate(d.getUTCDate() + 1); }
    else if (d.getTime() <= agora.getTime()) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
  }
  return { proxima_meio_dia: proximo(15, 0), proximo_institucional: proximo(16, 0, 0) };
}

/* =========================================================================
   FILA DE JOBS DE RENDERIZAÇÃO (KV) — pull-based, VPS nunca recebe conexão
   ========================================================================= */
const JOB_KV_KEY = 'render_job_current';

async function enfileirarJob(env, { tipo, arte, publicar, forcarReal }) {
  const job = { id: crypto.randomUUID(), tipo, status: 'pending', criadoEm: new Date().toISOString(), arte, publicar, forcarReal: !!forcarReal };
  await env.SAUDE_KV.put(JOB_KV_KEY, JSON.stringify(job), { expirationTtl: 3600 });
  return job;
}
async function lerJobAtual(env) {
  try { const bruto = await env.SAUDE_KV.get(JOB_KV_KEY); return bruto ? JSON.parse(bruto) : null; } catch { return null; }
}

function autenticado(request, env) {
  const auth = request.headers.get('authorization') || '';
  const esperado = `Bearer ${env.RENDER_SHARED_SECRET || ''}`;
  return !!env.RENDER_SHARED_SECRET && auth === esperado;
}

/* =========================================================================
   FASE 1 (no horário do cron): seleciona/valida o que dá pra validar sem
   imagem, e enfileira o job de arte. Rápido — não usa CPU de renderização.
   ========================================================================= */
async function enfileirarJanelaNoticia(env, janela) {
  const selecao = await selecionarCandidatoNoticia(env);
  if (!selecao.escolhido) {
    await registrarExecucao(env, { tipo: 'noticia', janela, em: new Date().toISOString(), resultado: 'skip', motivo: selecao.motivo, avaliados: selecao.avaliados, dry_run: env.INSTAGRAM_DRY_RUN !== 'false' });
    return { ok: true, resultado: 'skip', motivo: selecao.motivo };
  }
  const artigo = selecao.escolhido;

  // Reaproveita a validação já feita em selecionarCandidatoNoticia (pré-
  // validação entre os melhores candidatos) — evita buscar a MESMA imagem
  // de novo (subrequest duplicado).
  const imagemResp = selecao.imagemResp || await validarImagemArtigo(artigo.image_url);
  const categoriaLabel = editoriaDeInstagram(artigo);
  const caption = gerarLegendaNoticia(artigo);
  const template = escolherTemplateNoticia({ temFoto: imagemResp.ok, aspectRatio: imagemResp.aspectRatio, headline: artigo.title });

  const job = await enfileirarJob(env, {
    tipo: 'noticia',
    arte: { template, categoria: categoriaLabel, headline: artigo.title, contexto: artigo.summary ? truncar(artigo.summary, 140) : null, fotoUrl: imagemResp.ok ? artigo.image_url : null },
    publicar: { tipo: 'noticia', janela, articleId: artigo.id, canonicalUrl: artigo.original_url, headline: artigo.title, caption, score: selecao.score },
  });
  await registrarExecucao(env, { tipo: 'noticia', janela, em: new Date().toISOString(), resultado: 'job_enfileirado', jobId: job.id, candidato: artigo.title, template, score: selecao.score, dry_run: env.INSTAGRAM_DRY_RUN !== 'false' });
  return { ok: true, resultado: 'job_enfileirado', jobId: job.id, candidato: artigo.title, score: selecao.score };
}

async function enfileirarInstitucional(env) {
  const tema = await escolherTemaInstitucional(env);
  const caption = gerarLegendaInstitucional(tema);
  const job = await enfileirarJob(env, {
    tipo: 'institucional',
    arte: { template: 'institucional', eyebrow: tema.eyebrow, headline: tema.headline, subtitulo: tema.subtitulo, cta: tema.cta, tema: tema.tema },
    publicar: { tipo: 'institucional', janela: 'institucional_domingo', tema: tema.tema, headline: tema.headline, caption },
  });
  await registrarExecucao(env, { tipo: 'institucional', em: new Date().toISOString(), resultado: 'job_enfileirado', jobId: job.id, tema: tema.tema, dry_run: env.INSTAGRAM_DRY_RUN !== 'false' });
  return { ok: true, resultado: 'job_enfileirado', jobId: job.id, tema: tema.tema };
}

// forcarReal: só usado pelo botão único e explícito de publicação real do
// post de lançamento (ETAPA 16/17) — ignora INSTAGRAM_DRY_RUN só para ESTE
// job específico, sem precisar desarmar a flag global (que continua
// protegendo notícias e o institucional semanal automáticos).
async function enfileirarLancamentoReal(env, forcarReal = false) {
  const historicoResp = await buscarHistoricoInstagram(env, 60);
  if (historicoResp.ok && historicoResp.historico.some((h) => h.tema_institucional === 'lancamento_ownews' && h.status === 'published')) {
    return { ok: false, resultado: 'skip', motivo: 'post de lançamento já foi publicado antes (idempotência) — não tento de novo' };
  }
  const caption = gerarLegendaLancamento();
  const job = await enfileirarJob(env, {
    tipo: 'lancamento',
    arte: { template: 'lancamento' },
    publicar: { tipo: 'institucional', janela: 'teste_manual', tema: 'lancamento_ownews', headline: 'OWNews — O portal de quem vive o offshore', caption },
    forcarReal: !!forcarReal,
  });
  return { ok: true, resultado: 'job_enfileirado', jobId: job.id, forcarReal: !!forcarReal };
}

/* =========================================================================
   FASE 2 (chamada pelo VPS com o JPEG pronto): valida e publica de fato.
   ========================================================================= */
async function finalizarComImagem(env, request, job, jpegBytes) {
  const pub = job.publicar;
  const ctx = { tipo: pub.tipo, artigo: pub.tipo === 'noticia' ? { id: pub.articleId, published_at: job._articlePublishedAt || new Date().toISOString() } : null, tema: pub.tema, jpegBytes, caption: pub.caption };
  // Recarrega published_at real do artigo pra validateFreshness não confiar em dado antigo do job.
  if (pub.tipo === 'noticia') {
    try {
      const r = await fetch(`${env.SUPABASE_URL}/rest/v1/articles?select=published_at&id=eq.${pub.articleId}`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
      const linhas = await r.json();
      if (linhas[0]) ctx.artigo.published_at = linhas[0].published_at;
    } catch { /* validateFreshness vai falhar com segurança se isso não vier */ }
  }

  const validacao = await rodarValidacoesFinais(ctx, env);
  const dryRun = env.INSTAGRAM_DRY_RUN !== 'false' && !job.forcarReal;
  const baseHistorico = pub.tipo === 'noticia'
    ? { post_type: 'noticia', article_id: pub.articleId, canonical_url: pub.canonicalUrl, janela: pub.janela, headline: pub.headline, caption: pub.caption, score: pub.score }
    : { post_type: 'institucional', tema_institucional: pub.tema, janela: pub.janela, headline: pub.headline, caption: pub.caption };

  if (!validacao.ok) {
    await gravarHistorico(env, { ...baseHistorico, status: 'failed', error_message: `${validacao.etapa}: ${validacao.motivo}` });
    await registrarExecucao(env, { tipo: pub.tipo, janela: pub.janela, em: new Date().toISOString(), resultado: 'failed', motivo: `${validacao.etapa}: ${validacao.motivo}`, dry_run: dryRun });
    return { ok: false, resultado: 'failed', motivo: `${validacao.etapa}: ${validacao.motivo}` };
  }

  if (dryRun) {
    await gravarHistorico(env, { ...baseHistorico, status: 'dry_run' });
    await registrarExecucao(env, { tipo: pub.tipo, janela: pub.janela, em: new Date().toISOString(), resultado: 'dry_run', dry_run: true });
    return { ok: true, resultado: 'dry_run' };
  }

  const idMidia = pub.tipo === 'noticia' ? pub.articleId : `institucional-${pub.tema}`;
  await env.SAUDE_KV.put(`media_${idMidia}`, jpegBytes, { expirationTtl: 600 });
  const imageUrl = new URL(request.url); imageUrl.pathname = `/media/${idMidia}.jpg`; imageUrl.search = '';

  let mediaId, permalink = null, erro = null;
  try {
    const creationId = await criarContainer(env, imageUrl.toString(), pub.caption);
    const pronto = await aguardarContainerPronto(env, creationId);
    if (!pronto.ok) throw new Error(pronto.motivo);
    mediaId = await publicarContainer(env, creationId);
    permalink = await obterPermalink(env, mediaId);
  } catch (e) { erro = e.message; }

  if (erro) {
    await gravarHistorico(env, { ...baseHistorico, status: 'failed', error_message: erro });
    await registrarExecucao(env, { tipo: pub.tipo, janela: pub.janela, em: new Date().toISOString(), resultado: 'failed', motivo: erro, dry_run: false });
    return { ok: false, resultado: 'failed', motivo: erro };
  }

  await gravarHistorico(env, { ...baseHistorico, status: 'published', ig_media_id: mediaId, ig_permalink: permalink, published_at: new Date().toISOString() });
  await registrarExecucao(env, { tipo: pub.tipo, janela: pub.janela, em: new Date().toISOString(), resultado: 'published', ig_media_id: mediaId, dry_run: false });
  return { ok: true, resultado: 'published', mediaId, permalink };
}

/* =========================================================================
   ENTRYPOINTS
   ========================================================================= */
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        // "0 15 * * *" = 12:00 BRT — 1 post jornalístico por dia (MISSÃO 2.0, 2026-10-02).
        // "50 7 * * *" (04:50) e "15 23 * * *" (20:15) removidos na mesma data.
        if (event.cron === '0 15 * * *') await enfileirarJanelaNoticia(env, 'meio_dia_12h00');
        else if (event.cron === '0 16 * * SUN') await enfileirarInstitucional(env);
      } catch (e) {
        await registrarExecucao(env, { em: new Date().toISOString(), resultado: 'erro_nao_tratado', motivo: e.message, dry_run: env.INSTAGRAM_DRY_RUN !== 'false' });
      }
    })());
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/media/')) {
      const id = url.pathname.slice('/media/'.length).replace(/\.jpg$/, '');
      const bytes = await env.SAUDE_KV.get(`media_${id}`, 'arrayBuffer');
      if (!bytes) return new Response('not found', { status: 404 });
      return new Response(bytes, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=600' } });
    }

    if (url.pathname === '/saude-fragment') {
      const execucao = await (async () => { try { return JSON.parse(await env.SAUDE_KV.get('instagram_ultima_execucao')); } catch { return null; } })();
      const heartbeatVps = await (async () => { try { return await env.SAUDE_KV.get('instagram_ultimo_heartbeat_vps'); } catch { return null; } })();
      const proximos = calcularProximosTriggers(new Date());
      return Response.json({
        habilitado: !!(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_ACCOUNT_ID),
        dry_run: env.INSTAGRAM_DRY_RUN !== 'false',
        ultima_execucao: execucao,
        // Timestamp da última vez que o poller do VPS efetivamente chamou
        // este Worker (a cada minuto, via cron) — se isso parar de avançar
        // mas o Worker continuar "online", é sinal de falha silenciosa no
        // lado do VPS (cron parado, node quebrado, etc.), distinta de
        // "rodou e não achou candidato" (auditoria 2026-09-17).
        ultimo_heartbeat_vps: heartbeatVps,
        proxima_janela: proximos.proxima_meio_dia,
        proximo_institucional: proximos.proximo_institucional,
      });
    }

    // Rotas usadas pelo poller do VPS — sempre exigem RENDER_SHARED_SECRET.
    // "pending": marca o job current como in_progress e devolve só os dados
    // de arte (nunca os dados de publicação/histórico). "complete": recebe
    // o JPEG pronto e só então roda validação final + Graph API + histórico.
    if (url.pathname === '/render-jobs/pending') {
      if (!autenticado(request, env)) return new Response('unauthorized', { status: 401 });
      // Heartbeat de observabilidade (auditoria Instagram/Telegram, 2026-09-17;
      // corrigido em 2026-09-19 — causa raiz real encontrada em produção:
      // "KV put() limit exceeded for the day". SAUDE_KV é um namespace
      // COMPARTILHADO com o collector (OffVoosPoller/MercadoPoller/
      // EditorialPoller/execução) no plano Free (1000 writes/dia por
      // namespace). Gravar a cada chamada — o poller do VPS bate aqui a
      // cada minuto — sozinho já são até 1440 writes/dia, MAIS que o limite
      // inteiro do namespace, silenciosamente estourando a cota e travando
      // TODA gravação no namespace pro resto do dia (inclusive dados do
      // collector, que não tem nada a ver com Instagram). Corrigido: só
      // grava se o heartbeat atual já tem 5+ min (ou não existe) — reduz
      // pra ~288 writes/dia no pior caso, dentro da cota, e ainda detecta
      // "VPS parou de responder" em até 5-10min (granularidade suficiente
      // pra essa observabilidade). GET não conta na mesma cota de write. */
      try {
        const heartbeatAtual = await env.SAUDE_KV.get('instagram_ultimo_heartbeat_vps');
        const idadeMs = heartbeatAtual ? Date.now() - new Date(heartbeatAtual).getTime() : Infinity;
        if (idadeMs > 5 * 60000) {
          await env.SAUDE_KV.put('instagram_ultimo_heartbeat_vps', new Date().toISOString(), { expirationTtl: 3600 });
        }
      } catch { /* observabilidade nunca quebra o poller */ }
      const job = await lerJobAtual(env);
      if (!job || job.status !== 'pending') return new Response(null, { status: 204 });
      job.status = 'in_progress';
      await env.SAUDE_KV.put(JOB_KV_KEY, JSON.stringify(job), { expirationTtl: 3600 });
      return Response.json({ id: job.id, tipo: job.tipo, arte: job.arte });
    }

    if (url.pathname.startsWith('/render-jobs/') && url.pathname.endsWith('/complete') && request.method === 'POST') {
      if (!autenticado(request, env)) return new Response('unauthorized', { status: 401 });
      const id = url.pathname.split('/')[2];
      const job = await lerJobAtual(env);
      if (!job || job.id !== id || job.status !== 'in_progress') return new Response('job não encontrado ou já processado', { status: 404 });
      try {
        const jpegBytes = new Uint8Array(await request.arrayBuffer());
        const resultado = await finalizarComImagem(env, request, job, jpegBytes);
        job.status = resultado.ok ? 'done' : 'failed';
        await env.SAUDE_KV.put(JOB_KV_KEY, JSON.stringify(job), { expirationTtl: 3600 });
        return Response.json(resultado);
      } catch (erro) {
        // Auditoria 2026-09-17: antes, uma exceção inesperada aqui (fora do
        // try/catch interno do finalizarComImagem) voltava um 500 pro VPS
        // mas NUNCA atualizava instagram_ultima_execucao — /saude-fragment
        // continuava mostrando a última execução BOA anterior, escondendo a
        // falha de quem só olha o health. Também nunca marcava o job como
        // failed no KV. Corrigido: registra e marca, igual a todo outro
        // caminho de erro do pipeline.
        try { job.status = 'failed'; await env.SAUDE_KV.put(JOB_KV_KEY, JSON.stringify(job), { expirationTtl: 3600 }); } catch { /* melhor esforço */ }
        await registrarExecucao(env, { em: new Date().toISOString(), resultado: 'erro_nao_tratado', motivo: `finalizarComImagem: ${erro.message}`, jobId: job.id, dry_run: env.INSTAGRAM_DRY_RUN !== 'false' });
        return Response.json({ ok: false, erro: erro.message }, { status: 500 });
      }
    }

    // Rota única, autenticada e explícita pra publicação REAL do post de
    // lançamento (ETAPA 16/17) — a única coisa que ignora INSTAGRAM_DRY_RUN
    // nesta rodada. Continua idempotente (enfileirarLancamentoReal recusa
    // se já houver um "published" com esse tema).
    if (url.pathname === '/publicar-lancamento-real-unica-vez') {
      if (!autenticado(request, env)) return new Response('unauthorized', { status: 401 });
      try { return Response.json(await enfileirarLancamentoReal(env, true)); }
      catch (erro) { return Response.json({ ok: false, erro: erro.message }, { status: 500 }); }
    }

    // Rotas manuais de teste (fase 1 apenas — enfileiram, sempre em dry run).
    try {
      if (url.pathname === '/run-meio-dia') return Response.json(await enfileirarJanelaNoticia(env, 'meio_dia_12h00'));
      // aliases legados — redirecionam para a mesma lógica da janela única
      if (url.pathname === '/run-manha' || url.pathname === '/run-noite') return Response.json(await enfileirarJanelaNoticia(env, 'meio_dia_12h00'));
      if (url.pathname === '/run-institucional') return Response.json(await enfileirarInstitucional(env));
      if (url.pathname === '/run-lancamento-real') return Response.json(await enfileirarLancamentoReal(env, false));
    } catch (erro) {
      return Response.json({ ok: false, erro: erro.message }, { status: 500 });
    }

    return Response.json({ sistema: 'OWNews Instagram Publisher', status: 'ONLINE', dry_run: env.INSTAGRAM_DRY_RUN !== 'false' });
  },
};
