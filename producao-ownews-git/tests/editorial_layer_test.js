/**
 * OWNews Editorial Layer Tests — "Buddy te explica" (Missão AdSense Recovery 1.0)
 *
 * Extrai o módulo CAMADA EDITORIAL de worker.js (entre os marcadores
 * "CAMADA EDITORIAL: INICIO/FIM") e o executa em Node com stubs mínimos.
 *
 * Garante que:
 *   - toda entrada curada passa no validador (tamanho, 1–4 frases, sem HTML,
 *     sem frase proibida);
 *   - o validador rejeita o que deve rejeitar;
 *   - detecção de matéria "thin" funciona (conteúdo = resumo, conteúdo curto);
 *   - resolverCamadaEditorial prioriza curadoria, aceita banco válido, rejeita inválido;
 *   - blocos HTML não vazam texto sem escape;
 *   - slugs do Explica referenciados pela curadoria existem em EXPLICA_ARTIGOS.
 *
 * Usage: node tests/editorial_layer_test.js
 * Exit code: 0=all pass, 1=failures found
 */

const fs = require("fs");
const path = require("path");

const WORKER = path.join(__dirname, "..", "worker.js");
const src = fs.readFileSync(WORKER, "utf8");

function entre(ini, fim) {
  let a = src.indexOf(ini);
  if (a < 0) throw new Error("marcador não encontrado: " + ini);
  // O marcador de início abre um comentário de bloco que termina em "*/".
  a = src.indexOf("*/", a) + 2;
  const b = src.indexOf(fim, a);
  if (b < 0) throw new Error("marcador não encontrado: " + fim);
  return src.slice(a, b);
}

// ── Extrai EXPLICA_ARTIGOS real (para validar slugs) ─────────────────────
const explicaIni = src.indexOf("const EXPLICA_ARTIGOS = [");
const explicaFim = src.indexOf("\n];", explicaIni) + 3;
if (explicaIni < 0) throw new Error("EXPLICA_ARTIGOS não encontrado");
const explicaSrc = src.slice(explicaIni, explicaFim);

// ── Extrai o módulo da camada editorial ──────────────────────────────────
const camadaSrc = entre("/* ==== CAMADA EDITORIAL: INICIO ====", "/* ==== CAMADA EDITORIAL: FIM ==== */");
// Missão AdSense 2.1: o resolver usa o gate QUALIDADE EDITORIAL 2.1.
const qualidadeSrc = entre("/* ==== QUALIDADE EDITORIAL 2.1: INICIO ====", "/* ==== QUALIDADE EDITORIAL 2.1: FIM ==== */");

// Stubs do que o módulo usa de fora
const escaparHTML = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const decodificarEntidadesHTMLServidor = (s) => String(s || "");

const mod = new Function(
  "escaparHTML", "decodificarEntidadesHTMLServidor",
  explicaSrc + "\n" +
  "function explicaPorSlug(slug) { return EXPLICA_ARTIGOS.find((e) => e.slug === slug) || null; }\n" +
  camadaSrc + "\n" + qualidadeSrc + "\n" +
  "return { EXPLICA_ARTIGOS, BUDDY_FRASES_PROIBIDAS, validarTextoCamadaEditorial, explicaRelacionadosParaNoticia, resolverCamadaEditorial, blocoBuddyExplica, blocoImpactoOffshore, blocoCorpoOWNews, blocoEntendaMelhor, blocoProvenienciaNoticia, ehMateriaThin, formatarDataCurtaServidor, EXPLICA_GATILHOS_NOTICIA, classificarOrigemFonte, validarImpactoOffshore, validarBuddyPublicavel, validarImpactoPublicavel, classificarIndexacaoNoticia };"
)(escaparHTML, decodificarEntidadesHTMLServidor);

// ── Mini runner ──────────────────────────────────────────────────────────
let pass = 0, fail = 0;
function test(nome, fn) {
  try { fn(); pass++; console.log("  ✓ " + nome); }
  catch (e) { fail++; console.log("  ✗ " + nome + "\n      " + (e && e.message || e)); }
}
function expect(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }

console.log("\n== CAMADA EDITORIAL — validador ==");

test("validador aceita texto bom (2 frases, sem HTML, sem frase proibida)", () => {
  const r = mod.validarTextoCamadaEditorial("A Petrobras confirmou óleo em um segundo intervalo do poço Morpho. Isso ainda é exploração, não produção.");
  expect(r.ok, r.motivo);
});
test("validador rejeita texto curto demais", () => {
  expect(!mod.validarTextoCamadaEditorial("Curto.").ok, "deveria rejeitar");
});
test("validador rejeita HTML", () => {
  expect(!mod.validarTextoCamadaEditorial("Texto com <b>tag</b> no meio que teria tamanho suficiente para passar no resto.").ok, "deveria rejeitar HTML");
});
test("validador rejeita frase proibida (IA-sounding)", () => {
  const frases = ["em um movimento estratégico", "reforça seu compromisso", "marca um novo capítulo", "promete revolucionar", "isso vai gerar novas vagas"];
  frases.forEach((f) => {
    const t = "A empresa anunciou a unidade e " + f + " para o setor offshore brasileiro nos próximos anos.";
    expect(!mod.validarTextoCamadaEditorial(t).ok, "deveria rejeitar: " + f);
  });
});
test("validador rejeita mais de 4 frases", () => {
  const t = "Um. Dois frases aqui. Três frases aqui. Quatro frases aqui. Cinco frases aqui para passar do limite estabelecido.";
  expect(!mod.validarTextoCamadaEditorial(t).ok, "deveria rejeitar 5 frases");
});
test("validador rejeita não-string / vazio", () => {
  expect(!mod.validarTextoCamadaEditorial(null).ok);
  expect(!mod.validarTextoCamadaEditorial("").ok);
  expect(!mod.validarTextoCamadaEditorial(42).ok);
});

console.log("\n== CAMADA EDITORIAL — origem ==");

// Missão Editorial Original 4.0: a curadoria em código (21 matérias) foi
// reescrita como matéria OWNews completa e gravada no banco; a camada vem
// só do banco (buddy_source='ownews').
test("curadoria em código removida (camada vem só do banco)", () => {
  expect(!src.includes("const CAMADA_EDITORIAL_CURADA"), "CAMADA_EDITORIAL_CURADA voltou ao código");
});
test("slugs dos gatilhos existem em EXPLICA_ARTIGOS", () => {
  const existentes = new Set(mod.EXPLICA_ARTIGOS.map((e) => e.slug));
  mod.EXPLICA_GATILHOS_NOTICIA.forEach((g) => {
    (g.slugs || [g.slug]).filter(Boolean).forEach((s) => expect(existentes.has(s), "gatilho → /explica/" + s + " não existe"));
  });
});
test("verbetes novos do Explica existem (home e curadoria dependem deles)", () => {
  const existentes = new Set(mod.EXPLICA_ARTIGOS.map((e) => e.slug));
  ["margem-equatorial", "oferta-permanente", "leilao-spot-ppsa", "areas-da-sonda", "logistica-embarque-desembarque", "diferenca-plataforma-sonda-fpso", "transporte-aereo-offshore"]
    .forEach((s) => expect(existentes.has(s), "falta /explica/" + s));
});
test("EXPLICA_ARTIGOS sem slug duplicado", () => {
  const vistos = new Set();
  mod.EXPLICA_ARTIGOS.forEach((e) => { expect(!vistos.has(e.slug), "slug duplicado: " + e.slug); vistos.add(e.slug); });
});
test("verbetes novos têm fontes e atualizadoEm", () => {
  ["margem-equatorial", "oferta-permanente", "leilao-spot-ppsa", "areas-da-sonda", "logistica-embarque-desembarque"].forEach((s) => {
    const e = mod.EXPLICA_ARTIGOS.find((x) => x.slug === s);
    expect(Array.isArray(e.fontes) && e.fontes.length > 0, s + " sem fontes");
    expect(/^\d{4}-\d{2}-\d{2}$/.test(e.atualizadoEm || ""), s + " sem atualizadoEm");
  });
});
console.log("\n== CAMADA EDITORIAL — resolução e thin ==");

const CORPO_OK = "A P-80 deixou o estaleiro em Singapura e segue para o campo de Búzios, no pré-sal da Bacia de Santos.\n\nA unidade tem capacidade para 225 mil barris de óleo por dia. A Petrobras prevê o primeiro óleo para 2027, depois da ancoragem e da interligação dos poços. Os módulos de processo foram fabricados no Brasil, segundo a companhia.";
const BUDDY_OK = "A P-80 saiu de Singapura rumo a Búzios. É a primeira de uma série de seis plataformas da Petrobras e deve começar a produzir em 2027.";
const IMPACTO_OK = "Até o primeiro óleo em Búzios ainda há ancoragem, interligação de risers e comissionamento da P-80 no campo.";
const MAT = { id: "00000000-0000-0000-0000-0000000000aa", title: "P-80 deixa estaleiro em Singapura rumo a Búzios", summary: "Plataforma segue para o pré-sal.", content: CORPO_OK, buddy_summary: BUDDY_OK, why_it_matters: IMPACTO_OK, buddy_source: "ownews", buddy_reviewed_at: "2026-10-17T10:00:00Z" };
test("matéria OWNews resolve os três blocos", () => {
  const c = mod.resolverCamadaEditorial(MAT);
  expect(c && c.fonte === "ownews" && c.buddy_summary === BUDDY_OK && c.why_it_matters === IMPACTO_OK && c.corpo === CORPO_OK, JSON.stringify(c));
});
test("resolverCamadaEditorial: legado extrativo (fallback) nunca exibido; acervo 'ia' sem corpo", () => {
  const c = mod.resolverCamadaEditorial({ id: "00000000-0000-0000-0000-000000000000", buddy_summary: "A unidade saiu do estaleiro na China rumo ao Brasil. A chegada ao campo está prevista para o ano que vem.", why_it_matters: null, buddy_reviewed_at: "2026-10-01T00:00:00Z" });
  expect(c === null, "legado exibido: " + (c && c.fonte));
  const cIa = mod.resolverCamadaEditorial({ id: "00000000-0000-0000-0000-00000000000a", buddy_source: "ia", buddy_summary: "A unidade saiu do estaleiro na China rumo ao Brasil. A chegada ao campo está prevista para o ano que vem.", content: "Texto da fonte. ".repeat(60) });
  expect(cIa && cIa.fonte === "ia" && cIa.corpo === null, "acervo ia: " + JSON.stringify(cIa));
});
test("resolverCamadaEditorial rejeita banco inválido (frase proibida)", () => {
  const c = mod.resolverCamadaEditorial(Object.assign({}, MAT, { buddy_summary: "A empresa reforça seu compromisso com o setor e marca um novo capítulo na história offshore do país." }));
  expect(c === null, "deveria retornar null");
});
test("resolverCamadaEditorial retorna null sem nada", () => {
  expect(mod.resolverCamadaEditorial({ id: "00000000-0000-0000-0000-000000000002" }) === null);
});
test("ehMateriaThin: tudo que não é matéria OWNews é thin (inclusive corpo longo da fonte)", () => {
  expect(mod.ehMateriaThin({ content: "x ".repeat(900), summary: "resumo" }, null) === true);
  expect(mod.ehMateriaThin({ content: "Curto.", summary: "Outro.", buddy_source: "ownews" }, null) === true);
  expect(mod.ehMateriaThin(MAT, null) === false);
});

console.log("\n== CAMADA EDITORIAL — HTML ==");

test("blocoBuddyExplica escapa HTML do texto", () => {
  const html = mod.blocoBuddyExplica({ buddy_summary: "Texto <script>alert(1)</script> aqui.", why_it_matters: null });
  expect(!html.includes("<script>"), "script não escapado");
  expect(html.includes("&lt;script&gt;"));
  expect(html.includes('class="buddy-explica"'));
  expect(html.includes("Buddy resume"));
});
test("blocoBuddyExplica vazio sem camada ou sem Buddy", () => {
  expect(mod.blocoBuddyExplica(null) === "");
  expect(mod.blocoBuddyExplica({ buddy_summary: null, why_it_matters: "x" }) === "");
});
test("blocoBuddyExplica (Buddy resume): mascote oficial decorativo, pergunta, só H2, compacto", () => {
  const html = mod.blocoBuddyExplica({ buddy_summary: BUDDY_OK });
  expect(html.includes('src="/icons/buddy-head.png"'), "sem o mascote oficial");
  expect(html.includes('class="buddy-explica-buddy"') && html.includes('aria-hidden="true"'), "imagem decorativa deve ser aria-hidden");
  expect(html.includes("Em poucas palavras, o que aconteceu?"), "pergunta do Buddy ausente");
  expect(html.includes('<h2 id="buddyExplicaTitulo"') && !html.includes("<h1"), "hierarquia");
  expect(!html.includes("buddy-explica-porque-card"), "impacto não fica dentro do Buddy");
});
test("blocoImpactoOffshore: título, sem mascote, vazio sem impacto", () => {
  const html = mod.blocoImpactoOffshore({ why_it_matters: IMPACTO_OK });
  expect(html.includes("O que isso impacta para o offshore") && !html.includes("<img"), html);
  expect(mod.blocoImpactoOffshore({ why_it_matters: null }) === "");
});
test("blocoCorpoOWNews: parágrafos escapados", () => {
  const html = mod.blocoCorpoOWNews({ corpo: "Um <b>a</b>.\n\nDois." });
  expect(html === '<div class="noticia-corpo"><p>Um &lt;b&gt;a&lt;/b&gt;.</p><p>Dois.</p></div>', html);
});
test("classificarOrigemFonte: oficial/empresa citada = primária; imprensa = consultada; inválida = desconhecida", () => {
  expect(mod.classificarOrigemFonte("https://www.gov.br/anp/pt-br/x") === "primaria");
  expect(mod.classificarOrigemFonte("https://agencia.petrobras.com.br/x") === "primaria");
  expect(mod.classificarOrigemFonte("https://www.equinor.com/news/x") === "primaria");
  expect(mod.classificarOrigemFonte("https://g1.globo.com/economia/x") === "consultada");
  expect(mod.classificarOrigemFonte("https://www.offshore-energy.biz/x") === "consultada");
  expect(mod.classificarOrigemFonte("") === "desconhecida");
  expect(mod.classificarOrigemFonte("nao-e-url") === "desconhecida");
});
test("bloco Fonte: secundária sem link externo; primária com link só para documento (nunca homepage)", () => {
  const cam = { fonte: "ownews", corpo: "x" };
  const oficial = mod.blocoProvenienciaNoticia({ id: "a", image_credit: "Petrobras", original_url: "https://agencia.petrobras.com.br/w/negocio/p-82-viagem", published_at: "2026-10-05T12:00:00Z" }, cam);
  const imprensa = mod.blocoProvenienciaNoticia({ id: "b", image_credit: "PetroNotícias", original_url: "https://petronoticias.com.br/a-materia/", published_at: "2026-10-20T12:00:00Z" }, cam);
  const home = mod.blocoProvenienciaNoticia({ id: "c", image_credit: "ANP", original_url: "https://www.gov.br/anp", published_at: "2026-10-20T12:00:00Z" }, cam);
  const pdf = mod.blocoProvenienciaNoticia({ id: "d", image_credit: "ANP", original_url: "https://www.gov.br/anp/relatorio-2025.pdf" }, cam);
  expect(oficial.includes('href="https://agencia.petrobras.com.br/w/negocio/p-82-viagem"') && oficial.includes("Ver comunicado original"), oficial);
  expect(imprensa.includes("Fonte: <strong>PetroNotícias</strong>") && !imprensa.includes("petronoticias.com.br"), "secundária com link: " + imprensa);
  expect(imprensa.includes("Conteúdo elaborado pelo OWNews a partir das informações da fonte citada.") && imprensa.includes("Publicado em 20/10/2026"), imprensa);
  expect(!home.includes("gov.br/anp\""), "homepage tratada como documento");
  expect(pdf.includes("Ver documento original"), pdf);
  expect(!/↗|inteligência artificial|apuração/.test(imprensa), "rodapé voltou a ser aviso longo");
  const datas = mod.blocoProvenienciaNoticia({ id: "i", image_credit: "PetroNotícias", original_url: "https://petronoticias.com.br/x/", published_at: "2026-10-19T18:00:00Z", created_at: "2026-10-20T16:36:00Z", buddy_reviewed_at: "2026-10-20T16:36:00Z" }, cam);
  expect(datas.includes("Publicado em 20/10/2026") && !datas.includes("Atualizado"), "data OWNews (created_at), não a da fonte: " + datas);
});
test("bloco Fonte: fonte ausente/URL inválida, HTML escapado, Reportar erro com o link da matéria", () => {
  const cam = { fonte: "ownews", corpo: "x" };
  const semNome = mod.blocoProvenienciaNoticia({ id: "e", image_credit: "", original_url: "https://www.offshore-energy.biz/x" }, cam);
  const nada = mod.blocoProvenienciaNoticia({ id: "f", image_credit: null, original_url: "nao-e-url" }, cam);
  const xss = mod.blocoProvenienciaNoticia({ id: "g", image_credit: "<script>x</script>", original_url: "javascript:alert(1)" }, null);
  expect(semNome.includes("Fonte: <strong>offshore-energy.biz</strong>"), semNome);
  expect(nada.includes("Fonte: <strong>não informada</strong>") && !nada.includes("nao-e-url"), nada);
  expect(!xss.includes("<script>") && !xss.includes("javascript:"), xss);
  expect(semNome.includes('href="/correcoes?pagina=%2Fnoticia%3Fid%3De#como-reportar"') && semNome.includes('href="/politica-editorial#como-produzimos"'), semNome);
  const legado = mod.blocoProvenienciaNoticia({ id: "h", image_credit: "Eixos", original_url: "https://eixos.com.br/a" }, null);
  expect(legado.includes("não tem texto editorial do OWNews") && legado.includes("Ler na fonte"), legado);
});
test("blocoEntendaMelhor gera links /explica/ válidos e vazio sem slugs", () => {
  expect(mod.blocoEntendaMelhor([]) === "");
  const html = mod.blocoEntendaMelhor(["fpso"]);
  expect(html.includes('href="/explica/fpso"'));
});
test("blocoProvenienciaNoticia cita fonte com nofollow e link para /correcoes", () => {
  const html = mod.blocoProvenienciaNoticia({ image_credit: "Agência Petrobras", original_url: "https://agencia.petrobras.com.br/x", published_at: "2026-10-05T12:00:00Z" }, null);
  expect(html.includes("nofollow"));
  expect(html.includes("/correcoes"));
  expect(html.includes("Agência Petrobras"));
});
test("explicaRelacionadosParaNoticia: máximo 3 verbetes", () => {
  const artigo = { id: "x", title: "FPSO sonda completação transporte aéreo helicóptero", summary: "", content: "" };
  expect(mod.explicaRelacionadosParaNoticia(artigo, null).length <= 3, "mais de 3");
});
test("formatarDataCurtaServidor → dd/mm/aaaa", () => {
  expect(mod.formatarDataCurtaServidor("2026-10-06") === "06/10/2026", mod.formatarDataCurtaServidor("2026-10-06"));
});

console.log("\n== IMPACTO OFFSHORE 1.0 ==");

test("validarImpactoOffshore: rejeita 'pode gerar vagas'", () => {
  expect(!mod.validarImpactoOffshore("A informação pode gerar vagas para profissionais offshore.").ok);
});
test("validarImpactoOffshore: rejeita boilerplate 'mercado offshore continua aquecido'", () => {
  expect(!mod.validarImpactoOffshore("O mercado offshore continua aquecido com mais contratos.").ok);
});
test("validarImpactoOffshore: aceita declaração honesta com limitação", () => {
  const r = mod.validarImpactoOffshore("A informação envolve unidades FPSO, com participação de Petrobras. O anúncio não informa, neste momento, início de operações, mobilização de equipes ou geração de vagas.");
  expect(r.ok, "declaração honesta rejeitada: " + (r.motivo || ''));
});
console.log("\n== QUALIDADE EDITORIAL 1.0 ==");
test("validarTextoCamadaEditorial: rejeita texto truncado com '...'", () => {
  const r = mod.validarTextoCamadaEditorial("A Petrobras assinou contrato de afretamento para FPSO no campo de Búzios, informou a empresa...");
  expect(!r.ok && r.motivo === 'truncado', "esperado motivo 'truncado', obteve: " + JSON.stringify(r));
});
test("validarTextoCamadaEditorial: aceita texto completo sem truncamento", () => {
  const r = mod.validarTextoCamadaEditorial("A Petrobras assinou contrato de afretamento para FPSO no campo de Búzios. O contrato tem duração de 20 anos.");
  expect(r.ok, "texto completo deve passar: " + r.motivo);
});
test("validarImpactoOffshore: rejeita 'com base no conteúdo disponível...não é possível afirmar'", () => {
  const r = mod.validarImpactoOffshore("O assunto envolve o setor de energia. Com base no conteúdo disponível, não é possível afirmar impactos diretos em operações offshore, vagas ou contratos específicos neste momento.");
  expect(!r.ok && r.motivo === 'boilerplate_limitacao_generica', "esperado rejeição boilerplate: " + JSON.stringify(r));
});
test("resolverCamadaEditorial: rejeita DB summary truncado (banco tier)", () => {
  const artigo = { id: "id-trunc-9999", title: "Título qualquer", summary: "Resumo original completo do artigo aqui.", buddy_summary: "A empresa anunciou novos contratos de afretamento para o campo de Búzios e...", content: "Texto longo. Petrobras firmou contrato com FPSO para pré-sal da Bacia de Santos. A duração é de 20 anos." };
  const c = mod.resolverCamadaEditorial(artigo);
  expect(c === null, "DB summary truncado deve ser ocultado (sem fallback em runtime): " + JSON.stringify(c));
});
test("resolverCamadaEditorial: rejeita DB summary que é cópia do lead (banco tier)", () => {
  const artigo = { id: "id-copialead-9999", title: "Petrobras assina FPSO", summary: "A Petrobras assinou contrato de FPSO para campo de Búzios no pré-sal.", buddy_summary: "A Petrobras assinou contrato de FPSO para campo de Búzios no pré-sal da Bacia de Santos.", content: "A Petrobras assinou contrato de FPSO. O FPSO terá capacidade para 180 mil barris. A operação será no pré-sal da Bacia de Santos com duração de 20 anos." };
  const c = mod.resolverCamadaEditorial(artigo);
  expect(c === null, "cópia do lead deve ser ocultada: " + JSON.stringify(c));
});
test("resolverCamadaEditorial: matéria OWNews com Buddy idêntico ao lead é ocultada", () => {
  const c = mod.resolverCamadaEditorial(Object.assign({}, MAT, { summary: BUDDY_OK }));
  expect(c === null, "Buddy igual ao lead deveria ser ocultado: " + (c && c.fonte));
});

console.log("\n== P0.1 GATE E NOVOS PADRÕES ==");
// ── P0.2 Dedup editorial + fallback progressivo (2026-10-16) ─────────────────

console.log("\n== P0.2 DEDUP EDITORIAL + FALLBACK PROGRESSIVO ==");

// Inlined logic from worker.js (renderTudo inline script section)
const PALAVRAS_OPERACOES_T = ["plataforma","navio-plataforma","fpso","sonda","poço","poco","perfuração","perfuracao","descomissionamento","pré-sal","pre-sal","margem equatorial","búzios","buzios","campo","águas profundas","aguas profundas","uep","mero","tupi"];
const PALAVRAS_MERCADO_T = ["royalties","participação especial","participacao especial","licitação","licitacao","leilão","leilao","concessão","concessao","oferta permanente","bloco","bacia","gás natural","gas natural","eólica offshore","eolica offshore","exportação","exportacao","hidrocarbonetos","gasoduto","mercado","petróleo","petroleo","brent","wti","diesel","gasolina","combustível","combustivel","opep"];
function classificarT(n) {
  const t = ((n.title||'') + ' ' + (n.summary||'')).toLowerCase();
  for (const p of PALAVRAS_OPERACOES_T) if (t.includes(p)) return 'operacoes';
  for (const p of PALAVRAS_MERCADO_T) if (t.includes(p)) return 'mercado';
  return 'geral';
}
function chavesHomeT(n) {
  const ks = [];
  if (n.id) ks.push('id:' + n.id);
  if (n.slug) ks.push('slug:' + n.slug);
  if (n.original_url) ks.push('url:' + n.original_url);
  return ks;
}
function makeArtigo(overrides) {
  return { id: overrides.id||'x', slug: overrides.id||'x', original_url: 'https://t.st/'+overrides.id, image_url: overrides.img||null, title: overrides.title||'Sem título', summary: '', published_at: overrides.ts||new Date().toISOString(), editorial_score: overrides.score||50, ...overrides };
}
function simularDistribuicao(artigos, nHoje) {
  const now = Date.now();
  const pool24h = artigos.filter(a => (now - new Date(a.published_at).getTime())/3600000 <= 24);
  const pool48h = artigos.filter(a => (now - new Date(a.published_at).getTime())/3600000 <= 48);
  const sorted = [...artigos].sort((a,b) => b.editorial_score - a.editorial_score);
  const hero = sorted[0];
  const destaques = sorted.slice(1, 4);
  const usados = new Set([hero, ...destaques].flatMap(chavesHomeT));
  const imagensUsadas = new Set([hero.image_url, ...destaques.map(n=>n.image_url)].filter(Boolean));
  const imagensUltimas = new Set([hero.image_url].filter(Boolean));
  function proximosUltimas(pool, n) {
    const r = [];
    for (const c of pool) {
      if (r.length >= n) break;
      if (chavesHomeT(c).some(k=>usados.has(k))) continue;
      if (c.image_url && imagensUltimas.has(c.image_url)) continue;
      r.push(c); chavesHomeT(c).forEach(k=>usados.add(k)); if (c.image_url) imagensUltimas.add(c.image_url);
    }
    return r;
  }
  const pool24hOrdered = [...pool24h].sort((a,b) => new Date(b.published_at) - new Date(a.published_at));
  const ultimasHoje = proximosUltimas(pool24hOrdered, 6);
  const ultimas = ultimasHoje.length >= 2 ? ultimasHoje : ultimasHoje.concat(proximosUltimas(pool48h, 6 - ultimasHoje.length));
  function selecionarEditorial(pool, cat, qty) {
    const escolhidos = [];
    for (const n of pool) {
      if (escolhidos.length >= qty || classificarT(n) !== cat) continue;
      if (chavesHomeT(n).some(k=>usados.has(k))) continue;
      if (n.image_url && imagensUsadas.has(n.image_url)) continue;
      escolhidos.push(n); chavesHomeT(n).forEach(k=>usados.add(k)); if (n.image_url) imagensUsadas.add(n.image_url);
    }
    return escolhidos;
  }
  const mercadoHoje = selecionarEditorial(pool24h, 'mercado', 4);
  const mercado = mercadoHoje.length >= 4 ? mercadoHoje : mercadoHoje.concat(selecionarEditorial(pool48h, 'mercado', 4 - mercadoHoje.length));
  const operacoesHoje = selecionarEditorial(pool24h, 'operacoes', 5);
  const operacoes = operacoesHoje.length >= 5 ? operacoesHoje : operacoesHoje.concat(selecionarEditorial(pool48h, 'operacoes', 5 - operacoesHoje.length));
  return { hero, destaques, ultimas, mercado, operacoes, usados };
}

const agora = Date.now();
const ts24h = t => new Date(agora - t * 3600000).toISOString();

test("artigo usado em Últimas não reaparece em Mercado (strict dedup)", () => {
  const artigos = [
    makeArtigo({ id:'h', title:'Plataforma FPSO Búzios inicia produção', summary:'Campo de Búzios.', img:'http://img/h.jpg', score:100, published_at: ts24h(2) }),
    makeArtigo({ id:'d1', title:'Petrobras aumenta produção pre-sal', summary:'Pre-sal crescimento.', img:'http://img/d1.jpg', score:85, published_at: ts24h(4) }),
    makeArtigo({ id:'d2', title:'Sonda poço exploratório Brava', summary:'Perfuração poço.', img:'http://img/d2.jpg', score:80, published_at: ts24h(5) }),
    makeArtigo({ id:'d3', title:'Petróleo Brent sobe US$100', summary:'Mercado petróleo.', img:'http://img/d3.jpg', score:75, published_at: ts24h(6) }),
    makeArtigo({ id:'u1', title:'Mercado petróleo conflitos oriente médio', summary:'Petróleo oriente médio.', img:'http://img/u1.jpg', score:70, published_at: ts24h(8) }),
    makeArtigo({ id:'u2', title:'ANTAQ gasoduto transporte maritimo', summary:'Gasoduto.', img:'http://img/u2.jpg', score:65, published_at: ts24h(10) }),
  ];
  const { ultimas, mercado, usados } = simularDistribuicao(artigos);
  const ultimasIds = ultimas.map(a=>a.id);
  const mercadoIds = mercado.map(a=>a.id);
  const intersect = ultimasIds.filter(id => mercadoIds.includes(id));
  expect(intersect.length === 0, `Artigo repetido: ${intersect} aparece em Últimas E Mercado`);
});

test("imagem usada em Destaques não reaparece em Mercado quando há alternativa", () => {
  const IMG_REPETIDA = 'http://img/shared.jpg';
  const artigos = [
    makeArtigo({ id:'h', title:'Plataforma FPSO Búzios', summary:'Campo Búzios.', img:'http://img/h.jpg', score:100, published_at: ts24h(2) }),
    makeArtigo({ id:'d1', title:'Petrobras destaque mercado petroleo', summary:'Petróleo destaque.', img:IMG_REPETIDA, score:85, published_at: ts24h(4) }),
    makeArtigo({ id:'d2', title:'Sonda poço exploratório', summary:'Perfuração poço.', img:'http://img/d2.jpg', score:80, published_at: ts24h(5) }),
    makeArtigo({ id:'d3', title:'ANP leilão bloco offshore', summary:'Leilão bloco.', img:'http://img/d3.jpg', score:75, published_at: ts24h(6) }),
    makeArtigo({ id:'m1_rep', title:'Brent petróleo royalties leilão', summary:'Petróleo brent royalties.', img:IMG_REPETIDA, score:70, published_at: ts24h(8) }),
    makeArtigo({ id:'m2_ok', title:'Combustível gasolina diesel preços', summary:'Combustível preço diesel.', img:'http://img/m2.jpg', score:65, published_at: ts24h(9) }),
  ];
  const { mercado } = simularDistribuicao(artigos);
  const imgsMercado = mercado.map(a=>a.image_url);
  expect(!imgsMercado.includes(IMG_REPETIDA), `Imagem repetida apareceu em Mercado mesmo havendo alternativa. mercado ids: ${mercado.map(a=>a.id)}`);
});

test("editorial aceita 48h quando 24h pool está esgotado pelo heroi+destaques+últimas", () => {
  const _48h = ts24h(30); // 30h atrás = dentro de 48h
  const artigos = [
    makeArtigo({ id:'h', title:'Plataforma FPSO sonda perfuração poço', summary:'FPSO campos.', img:'http://img/h.jpg', score:100, published_at: ts24h(2) }),
    makeArtigo({ id:'d1', title:'Petrobras investimentos pre-sal', summary:'Pre-sal.', img:'http://img/d1.jpg', score:85, published_at: ts24h(4) }),
    makeArtigo({ id:'d2', title:'ANP licitação bloco bacia', summary:'Licitação.', img:'http://img/d2.jpg', score:80, published_at: ts24h(5) }),
    makeArtigo({ id:'d3', title:'Combustível diesel royalties', summary:'Diesel combustível.', img:'http://img/d3.jpg', score:75, published_at: ts24h(6) }),
    makeArtigo({ id:'u1', title:'Petróleo Brent mercado brent', summary:'Brent petróleo.', img:'http://img/u1.jpg', score:65, published_at: ts24h(8) }),
    makeArtigo({ id:'u2', title:'Gasoduto gás natural exportação', summary:'Gás exportação.', img:'http://img/u2.jpg', score:60, published_at: ts24h(10) }),
    // 48h pool: artigos de ontem para preencher editorias
    makeArtigo({ id:'m48', title:'Petróleo royalties brent ontem', summary:'Petróleo mercado.', img:'http://img/m48.jpg', score:70, published_at: _48h }),
    makeArtigo({ id:'o48', title:'FPSO plataforma poço sonda ontem', summary:'FPSO operacoes.', img:'http://img/o48.jpg', score:70, published_at: _48h }),
  ];
  const { mercado, operacoes, ultimas } = simularDistribuicao(artigos);
  expect(mercado.length >= 1, `Mercado deve ter pelo menos 1 artigo (fallback 48h): got ${mercado.length}`);
  expect(operacoes.length >= 1, `Operações deve ter pelo menos 1 artigo (fallback 48h): got ${operacoes.length}`);
  // Artigos 48h em editorias NÃO devem estar em Últimas (strict dedup)
  const ultimasIds = new Set(ultimas.map(a=>a.id));
  const mercadoIds = mercado.map(a=>a.id);
  const operacoesIds = operacoes.map(a=>a.id);
  const dupesMercado = mercadoIds.filter(id=>ultimasIds.has(id));
  const dupesOps = operacoesIds.filter(id=>ultimasIds.has(id));
  expect(dupesMercado.length === 0, `Mercado repete artigos de Últimas: ${dupesMercado}`);
  expect(dupesOps.length === 0, `Operações repete artigos de Últimas: ${dupesOps}`);
});

test("Últimas usa ordem temporal (mais recente primeiro)", () => {
  const artigos = [
    makeArtigo({ id:'h', title:'Plataforma FPSO sonda poço perfuração', summary:'FPSO.', img:'http://img/h.jpg', score:100, published_at: ts24h(2) }),
    makeArtigo({ id:'d1', title:'Petrobras resultados', summary:'Resultado Petrobras.', img:'http://img/d1.jpg', score:85, published_at: ts24h(4) }),
    makeArtigo({ id:'d2', title:'ANP licitação bloco', summary:'Licitação.', img:'http://img/d2.jpg', score:80, published_at: ts24h(6) }),
    makeArtigo({ id:'d3', title:'Combustível gasolina preço', summary:'Combustível.', img:'http://img/d3.jpg', score:75, published_at: ts24h(8) }),
    makeArtigo({ id:'u_new', title:'Operações navios apoio porto offshore', summary:'Navios porto.', img:'http://img/un.jpg', score:30, published_at: ts24h(3) }),
    makeArtigo({ id:'u_old', title:'Mercado petróleo cotações preço', summary:'Cotações.', img:'http://img/uo.jpg', score:90, published_at: ts24h(22) }),
  ];
  const { ultimas } = simularDistribuicao(artigos);
  if (ultimas.length >= 2) {
    const times = ultimas.map(a=>new Date(a.published_at).getTime());
    let ordemOk = true;
    for (let i=1; i<times.length; i++) if (times[i] > times[i-1]) { ordemOk = false; break; }
    expect(ordemOk, `Últimas fora de ordem temporal: ${ultimas.map(a=>a.id+'/'+a.published_at)}`);
  }
});

console.log("\n" + "─".repeat(50));
console.log("TOTAL: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
