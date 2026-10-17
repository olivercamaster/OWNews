/**
 * OWNews — Qualidade Editorial 2.1 (Missão AdSense 2.1, 2026-10-17)
 *
 * Regressão do gate único usado na GERAÇÃO (collector shrill-pond) e na
 * EXIBIÇÃO (frontend ownews-git):
 *   - paridade: o bloco QUALIDADE EDITORIAL 2.1 é idêntico nos dois workers;
 *   - erros de texto ("..", entidades, truncamento, vazamento de UI, mojibake);
 *   - similaridade lead↔Buddy, Buddy↔impacto, lead↔impacto e Buddy↔fonte;
 *   - impacto genérico/template rejeitado (inclui a frase real da auditoria);
 *   - classificação INDEXABLE / NOINDEX / EDITORIAL_INCOMPLETE / DESCARTAR;
 *   - critérios de indexação de páginas (salário, função, empresa, radar, agenda);
 *   - meta description sem corte no meio de palavra;
 *   - collector: checagem de números, parser JSON da IA, rotas admin fechadas.
 *
 * Usage: node tests/qualidade_editorial_test.js   (exit 0 = ok)
 */
const fs = require("fs");
const path = require("path");

const FRONT = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");
const COLLECTOR_PATH = path.join(__dirname, "..", "..", "shrill-pond-a915-fix", "worker.js");
const COLLECTOR = fs.existsSync(COLLECTOR_PATH) ? fs.readFileSync(COLLECTOR_PATH, "utf8") : null;

function bloco(src, ini, fim) {
  const a = src.indexOf(ini);
  if (a < 0) throw new Error("marcador ausente: " + ini);
  const b = src.indexOf(fim, a);
  if (b < 0) throw new Error("marcador ausente: " + fim);
  return src.slice(a, b + fim.length);
}
function corpoBloco(src, ini, fim) {
  const a = src.indexOf("*/", src.indexOf(ini)) + 2;
  return src.slice(a, src.indexOf(fim, a));
}
function funcao(src, assinatura) {
  const a = src.indexOf(assinatura);
  if (a < 0) throw new Error("função ausente: " + assinatura);
  let d = 0, i = src.indexOf("{", a);
  for (; i < src.length; i++) { if (src[i] === "{") d++; else if (src[i] === "}") { d--; if (d === 0) break; } }
  return src.slice(a, i + 1);
}

const Q_INI = "/* ==== QUALIDADE EDITORIAL 2.1: INICIO ====";
const Q_FIM = "/* ==== QUALIDADE EDITORIAL 2.1: FIM ==== */";
const qSrc = corpoBloco(FRONT, Q_INI, Q_FIM);
const camadaSrc = corpoBloco(FRONT, "/* ==== CAMADA EDITORIAL: INICIO ====", "/* ==== CAMADA EDITORIAL: FIM ==== */");
const explicaIni = FRONT.indexOf("const EXPLICA_ARTIGOS = [");
const explicaSrc = FRONT.slice(explicaIni, FRONT.indexOf("\n];", explicaIni) + 3);
const metaSrc = funcao(FRONT, "function descricaoMetaSegura(texto, max)");

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const M = new Function("escaparHTML", "decodificarEntidadesHTMLServidor",
  explicaSrc + "\nfunction explicaPorSlug(s){return EXPLICA_ARTIGOS.find((e)=>e.slug===s)||null;}\n" + camadaSrc + "\n" + qSrc + "\n" + metaSrc +
  "\nreturn { detectarErrosTexto, sanearTextoPublicacao, similaridadeTextos, trechoCopiadoDaFonte, validarBuddyPublicavel, validarImpactoPublicavel, classificarIndexacaoNoticia, resolverCamadaEditorial, descricaoMetaSegura, pareceIngles, blocoBuddyExplica, blocoImpactoOffshore, blocoCorpoOWNews, blocoProvenienciaNoticia, ehMateriaThin, deckNoticiaOWNews, validarCorpoOWNews, validarMateriaOWNews, numerosSustentadosPelaFonte, MATERIA_OWNEWS };"
)(esc, (s) => String(s || ""));

let pass = 0, fail = 0;
function test(nome, fn) {
  try { fn(); pass++; console.log("  ✓ " + nome); }
  catch (e) { fail++; console.log("  ✗ " + nome + "\n      " + e.message); }
}
function expect(c, msg) { if (!c) throw new Error(msg || "falhou"); }

// ── Fixtures reais (acervo publicado em 2026-10-17) ─────────────────────────
const ARTIGO_PETROLEO = {
  id: "fx-1",
  title: "Petróleo fecha em alta com tensão no Oriente Médio",
  summary: "Negociado na Intercontinental Exchange de Londres (ICE), o petróleo Brent para dezembro fechou em alta de 3,72%.",
  content: "Negociado na Intercontinental Exchange de Londres (ICE), o petróleo Brent para dezembro fechou em alta de 3,72% (US$ 3,94), a US$ 109,86 o barril. Já o petróleo WTI para o mesmo mês subiu 2,61%. Analistas atribuem a alta ao risco de interrupção no Estreito de Ormuz, por onde passa parte relevante da oferta mundial. ".repeat(3)
};
// Buddy extrativo antigo (frases literais da fonte, com ".." do scraping)
const BUDDY_EXTRATIVO = "Negociado na Intercontinental Exchange de Londres (ICE), o petróleo Brent para dezembro fechou em alta de 3,72% (US$ 3,94), a US$ 109,86 o barril .. Já o petróleo WTI para o mesmo mês subiu 2,61%.";
// Impacto de template antigo (frase real citada na auditoria AdSense 2.0)
const IMPACTO_TEMPLATE = "O assunto está diretamente relacionado a preço do petróleo, segmento central para as operações offshore. O nível de preço do barril afeta diretamente a equação econômica de projetos offshore: rentabilidade dos contratos, decisões de afretamento e cronograma de mobilizações.";
const ARTIGO_ANP = {
  id: "fx-2",
  title: "ANP divulga dados consolidados da produção de petróleo e gás em julho de 2026",
  summary: "No mês, foram produzidos 5,851 milhões de barris de óleo equivalente por dia (boe/d) de petróleo e gás natural.",
  content: "No mês, foram produzidos 5,851 milhões de barris de óleo equivalente por dia (boe/d) de petróleo e gás natural. A produção do pré-sal totalizou 4,821 milhões de boe/d, o que corresponde a 82,4% da produção brasileira. Os campos marítimos foram responsáveis por 98,1% do petróleo e 88,7% do gás natural produzidos. O campo de Búzios, na Bacia de Santos, foi o maior produtor. ".repeat(2)
};
// Reescrita real gerada pela IA na calibração (aprovada)
const BUDDY_IA_OK = "A produção de petróleo e gás natural no Brasil chegou a 5,851 milhões de barris de óleo equivalente por dia em julho. O pré-sal concentrou a maior parte desse volume, e Búzios foi o campo que mais produziu.";


// ── Matéria OWNews 4.0 (texto próprio escrito a partir de ARTIGO_ANP) ───────
const CORPO_OWNEWS = "Os números de julho da ANP mostram o Brasil produzindo 5,851 milhões de barris de óleo equivalente por dia, somando petróleo e gás natural.\n\nO pré-sal respondeu por 4,821 milhões de boe/d, ou 82,4% do total. A produção no mar domina: 98,1% do petróleo e 88,7% do gás saíram de campos marítimos, e Búzios, na Bacia de Santos, liderou o ranking de campos.";
const IMPACTO_OWNEWS = "Com 98,1% do petróleo vindo de campos marítimos, a escala de produção de julho depende quase inteira de plataformas e FPSOs em operação, com Búzios à frente.";
const MAT_OWNEWS = Object.assign({}, ARTIGO_ANP, { content: CORPO_OWNEWS, buddy_summary: BUDDY_IA_OK, why_it_matters: IMPACTO_OWNEWS, buddy_source: "ownews", buddy_reviewed_at: "2026-10-17T12:00:00Z" });

console.log("\n== PARIDADE ENTRE WORKERS ==");
test("bloco QUALIDADE EDITORIAL 2.1 é idêntico no frontend e no collector", () => {
  if (!COLLECTOR) { console.log("    (skip: collector não encontrado)"); return; }
  expect(bloco(FRONT, Q_INI, Q_FIM) === bloco(COLLECTOR, Q_INI, Q_FIM), "blocos divergiram — copie o bloco de um worker para o outro");
});

console.log("\n== ERROS DE TEXTO ==");
test("detecta '..' de scraping", () => expect(M.detectarErrosTexto("o barril .. Já o WTI subiu.").includes("ponto_duplo")));
test("não confunde reticências '...' com ponto duplo", () => expect(!M.detectarErrosTexto("Ele disse... e saiu.").includes("ponto_duplo")));
test("detecta reticências quebradas no fim", () => expect(M.detectarErrosTexto("A empresa anunciou novos contratos e...").includes("reticencias_quebradas")));
test("detecta entidade HTML", () => expect(M.detectarErrosTexto("Estamos crescendo n&atilde;o apenas.").includes("entidade_html")));
test("detecta espaço antes de pontuação", () => expect(M.detectarErrosTexto("serviço exclusivo da agência eixos , a associação.").includes("espaco_antes_pontuacao")));
test("detecta vazamento de formulário/newsletter", () => expect(M.detectarErrosTexto("Conforme antecipado pelo eixos pro (teste grátis), a ANP decidiu.").includes("vazamento_ui")));
test("detecta frase incompleta (palavra cortada no fim)", () => expect(M.detectarErrosTexto("O evento teve por objetivo aproximar micro e pequenas empresas da indús").includes("frase_incompleta")));
test("detecta mojibake", () => expect(M.detectarErrosTexto("ProduÃ§Ã£o recorde no pré-sal.").includes("caractere_estranho")));
test("texto limpo não tem erro", () => expect(M.detectarErrosTexto(BUDDY_IA_OK).length === 0, JSON.stringify(M.detectarErrosTexto(BUDDY_IA_OK))));
test("saneamento corrige '..', espaço antes de pontuação e entidades — sem reescrever", () => {
  const s = M.sanearTextoPublicacao("o barril .. Já o WTI subiu 2,61% , segundo a ICE. Petr&oacute;leo &amp; g&aacute;s.");
  expect(s === "o barril. Já o WTI subiu 2,61%, segundo a ICE. Petróleo & gás.", s);
});
test("detecta inglês", () => expect(M.pareceIngles("Transocean today announced that the Deepwater Conqueror was awarded a two-well contract with the operator.")));
test("não marca português como inglês", () => expect(!M.pareceIngles(BUDDY_IA_OK)));

console.log("\n== SIMILARIDADE lead ↔ Buddy ↔ impacto ↔ fonte ==");
test("Buddy extrativo (cópia literal da fonte) é rejeitado", () => {
  const r = M.validarBuddyPublicavel(BUDDY_EXTRATIVO, ARTIGO_PETROLEO);
  expect(!r.ok && r.motivos.includes("copia_fonte"), JSON.stringify(r));
});
test("Buddy igual ao lead é rejeitado (copia_lead)", () => {
  const r = M.validarBuddyPublicavel(ARTIGO_ANP.summary + " Os dados foram publicados pela ANP.", ARTIGO_ANP);
  expect(!r.ok && (r.motivos.includes("copia_lead") || r.motivos.includes("copia_fonte")), JSON.stringify(r));
});
test("Buddy reescrito (IA, calibração real) é aprovado", () => {
  const r = M.validarBuddyPublicavel(BUDDY_IA_OK, ARTIGO_ANP);
  expect(r.ok, JSON.stringify(r));
});
test("Buddy de 1 frase é rejeitado (regra 2–4 frases)", () => {
  const r = M.validarBuddyPublicavel("A Finder Energy está perto de decidir investir no desenvolvimento de um campo de petróleo offshore.", { title: "x", summary: "y" });
  expect(!r.ok && r.motivos.some((m) => m.startsWith("frases_")), JSON.stringify(r));
});
test("Buddy com frase redundante é rejeitado", () => {
  const r = M.validarBuddyPublicavel("A Finder Energy está perto de investir em um campo offshore em Timor-Leste. O campo offshore da Finder Energy fica em Timor-Leste.", { title: "x", summary: "y" });
  expect(!r.ok && r.motivos.includes("frase_redundante"), JSON.stringify(r));
});
test("Buddy em inglês é rejeitado", () => {
  const r = M.validarBuddyPublicavel("The Company will host a conference call on Thursday. The results show growth for the company and its fleet.", { title: "x", summary: "y" });
  expect(!r.ok && r.motivos.includes("ingles"), JSON.stringify(r));
});
test("impacto que repete o Buddy é rejeitado (Buddy↔impacto)", () => {
  const imp = "A produção de petróleo e gás natural no Brasil chegou a 5,851 milhões de barris de óleo equivalente por dia em julho, com Búzios no topo.";
  const r = M.validarImpactoPublicavel(imp, ARTIGO_ANP, BUDDY_IA_OK);
  expect(!r.ok && r.motivos.includes("repete_buddy"), JSON.stringify(r));
});
test("impacto que repete o lead é rejeitado (lead↔impacto)", () => {
  const r = M.validarImpactoPublicavel(ARTIGO_ANP.summary, ARTIGO_ANP, null);
  expect(!r.ok && (r.motivos.includes("copia_lead") || r.motivos.includes("copia_fonte")), JSON.stringify(r));
});

console.log("\n== IMPACTO GENÉRICO ==");
test("frase real da auditoria ('segmento central') é rejeitada", () => {
  const r = M.validarImpactoPublicavel(IMPACTO_TEMPLATE, ARTIGO_PETROLEO, null);
  expect(!r.ok && r.motivos.includes("generico"), JSON.stringify(r));
});
[
  "A informação envolve perfuração de poços e pré-sal, com participação de Shell e Transocean. Os dados refletem o estado atual das operações e não implicam, por si só, novas contratações.",
  "Isso pode afetar a operação da Halliburton em campos e blocos no mar da Bacia de Campos.",
  "A expansão da Galp pode levar a novas oportunidades de exploração e produção na Margem Equatorial.",
  "O contrato reforça a importância do setor offshore para a economia do Rio de Janeiro e do país.",
  "Acompanhe os desdobramentos para avaliar impactos operacionais no setor offshore da Bacia de Santos."
].forEach((t, i) => test("impacto genérico/especulativo #" + (i + 1) + " rejeitado", () => {
  const r = M.validarImpactoPublicavel(t, { title: "Shell Transocean Halliburton Galp Bacia de Campos Santos Margem Equatorial Rio de Janeiro", summary: "", content: "" }, null);
  expect(!r.ok, JSON.stringify(r));
}));
test("impacto específico e ancorado na matéria é aceito", () => {
  const art = { title: "Transocean garante contrato para o Deepwater Conqueror", summary: "A Transocean anunciou contrato de dois poços.", content: "A Transocean anunciou que o navio-sonda Deepwater Conqueror recebeu contrato de dois poços na Guiné Equatorial. A campanha deve durar cerca de 170 dias e começar no primeiro trimestre de 2027. O valor estimado é de US$ 80 milhões. ".repeat(2) };
  const r = M.validarImpactoPublicavel("O Deepwater Conqueror fica comprometido por cerca de 170 dias com a campanha, com início previsto para o primeiro trimestre de 2027.", art, "A Transocean fechou um contrato de US$ 80 milhões para o navio-sonda Deepwater Conqueror. Serão perfurados dois poços na Guiné Equatorial.");
  expect(r.ok, JSON.stringify(r));
});

console.log("\n== RESOLVER (exibição) ==");
test("acervo antigo: Buddy extrativo do banco NÃO é exibido", () => {
  const c = M.resolverCamadaEditorial(Object.assign({}, ARTIGO_PETROLEO, { buddy_summary: BUDDY_EXTRATIVO, why_it_matters: IMPACTO_TEMPLATE, buddy_source: "fallback_partial" }));
  expect(c === null, JSON.stringify(c));
});
test("Buddy IA válido é exibido com impacto inválido oculto", () => {
  const c = M.resolverCamadaEditorial(Object.assign({}, ARTIGO_ANP, { buddy_summary: BUDDY_IA_OK, why_it_matters: IMPACTO_TEMPLATE, buddy_source: "ia" }));
  expect(c && c.fonte === "ia" && c.why_it_matters === null, JSON.stringify(c));
});
test("matéria marcada fora de escopo pela IA não exibe camada", () => {
  expect(M.resolverCamadaEditorial(Object.assign({}, ARTIGO_ANP, { buddy_summary: BUDDY_IA_OK, buddy_source: "ia_fora_escopo" })) === null);
});
test("acervo 'ia' (2.1) mostra Buddy mas NUNCA corpo (content é texto da fonte)", () => {
  const c = M.resolverCamadaEditorial(Object.assign({}, ARTIGO_ANP, { buddy_summary: BUDDY_IA_OK, buddy_source: "ia" }));
  expect(c && c.fonte === "ia" && c.corpo === null, JSON.stringify(c));
  expect(M.blocoCorpoOWNews(c) === "", "corpo da fonte renderizado");
});
test("curadoria em código foi migrada para o banco (resolver só lê o banco)", () => {
  expect(!FRONT.includes("const CAMADA_EDITORIAL_CURADA"), "curadoria em código voltou");
});

console.log("\n== CLASSIFICAÇÃO DE INDEXAÇÃO ==");
test("INDEXABLE: matéria OWNews com Buddy + corpo + impacto válidos", () => {
  const a = Object.assign({}, MAT_OWNEWS);
  const c = M.resolverCamadaEditorial(a);
  expect(c && c.corpo && c.why_it_matters, JSON.stringify(c));
  expect(M.classificarIndexacaoNoticia(a, c).estado === "INDEXABLE", JSON.stringify(M.classificarIndexacaoNoticia(a, c)));
});
test("EDITORIAL_INCOMPLETE: acervo da fonte (não é matéria OWNews), mesmo com Buddy IA", () => {
  const a = Object.assign({}, ARTIGO_ANP, { buddy_summary: BUDDY_IA_OK, buddy_source: "ia" });
  expect(M.classificarIndexacaoNoticia(a, M.resolverCamadaEditorial(a)).estado === "EDITORIAL_INCOMPLETE");
  expect(M.classificarIndexacaoNoticia(ARTIGO_ANP, null).estado === "EDITORIAL_INCOMPLETE");
});
test("publicado sem Buddy = não indexável", () => {
  const a = Object.assign({}, MAT_OWNEWS, { buddy_summary: "   " });
  const r = M.classificarIndexacaoNoticia(a, M.resolverCamadaEditorial(a));
  expect(r.estado === "EDITORIAL_INCOMPLETE", JSON.stringify(r));
});
test("publicado sem Impacto = não indexável", () => {
  const a = Object.assign({}, MAT_OWNEWS, { why_it_matters: null });
  const r = M.classificarIndexacaoNoticia(a, M.resolverCamadaEditorial(a));
  expect(r.estado === "EDITORIAL_INCOMPLETE" && r.motivos.includes("sem_impacto_valido"), JSON.stringify(r));
});
test("publicado sem corpo OWNews = não indexável", () => {
  const a = Object.assign({}, MAT_OWNEWS, { content: "Uma frase só." });
  const r = M.classificarIndexacaoNoticia(a, M.resolverCamadaEditorial(a));
  expect(r.estado === "EDITORIAL_INCOMPLETE" && r.motivos.includes("sem_corpo_ownews"), JSON.stringify(r));
});
test("NOINDEX: nota duplicada (mesmo fato de outra fonte) mantém texto mas sai do índice", () => {
  const a = Object.assign({}, MAT_OWNEWS, { buddy_source: "duplicada" });
  const c = M.resolverCamadaEditorial(a);
  expect(c && c.corpo, "texto OWNews da duplicada deve continuar visível");
  expect(M.classificarIndexacaoNoticia(a, c).estado === "NOINDEX" && M.ehMateriaThin(a), "duplicada indexável ou na Home");
});
test("impacto 'não afeta o offshore' é reprovado na geração (sem relevância offshore)", () => {
  const r = M.validarMateriaOWNews(Object.assign({ buddy_summary: BUDDY_IA_OK, corpo: CORPO_OWNEWS }, { why_it_matters: "Não altera operações offshore; a ANP só divulgou os 5,851 milhões de boe/d de julho." }), ARTIGO_ANP, ARTIGO_ANP.content);
  expect(!r.ok && r.motivos.includes("impacto:sem_relevancia_offshore"), JSON.stringify(r.motivos));
  const r2 = M.validarMateriaOWNews({ buddy_summary: BUDDY_IA_OK, corpo: CORPO_OWNEWS, why_it_matters: "A regra não alcança a operação offshore; vale para os 5,851 milhões de boe/d informados pela ANP." }, ARTIGO_ANP, ARTIGO_ANP.content);
  expect(r2.motivos.includes("impacto:sem_relevancia_offshore"), "negação no meio da oração: " + JSON.stringify(r2.motivos));
});
test("título em inglês (release sem tradução) não é indexável", () => {
  const a = Object.assign({}, MAT_OWNEWS, { title: "Transocean Ltd. Announces Contract Awards Totaling $185 Million" });
  const r = M.classificarIndexacaoNoticia(a, M.resolverCamadaEditorial(a));
  expect(r.estado === "EDITORIAL_INCOMPLETE" && r.motivos.includes("titulo_ingles"), JSON.stringify(r));
  const pt = Object.assign({}, MAT_OWNEWS, { title: "Transocean ganha contratos de US$ 185 milhões para duas semissubmersíveis" });
  expect(M.classificarIndexacaoNoticia(pt, M.resolverCamadaEditorial(pt)).estado === "INDEXABLE");
});
test("NOINDEX: material da fonte insuficiente", () => {
  const a = Object.assign({}, ARTIGO_ANP, { buddy_source: "insuficiente" });
  expect(M.classificarIndexacaoNoticia(a, null).estado === "NOINDEX");
});
test("DESCARTAR: sem material", () => {
  expect(M.classificarIndexacaoNoticia({ id: "d", title: "Título suficientemente longo", summary: "curto", content: "" }, null).estado === "DESCARTAR");
});
test("DESCARTAR: fora de escopo", () => {
  expect(M.classificarIndexacaoNoticia(Object.assign({}, ARTIGO_ANP, { buddy_source: "ia_fora_escopo" }), null).estado === "DESCARTAR");
});

console.log("\n== MATÉRIA OWNEWS 4.0 (gate de geração/backfill) ==");
const MAT_OK = { buddy_summary: BUDDY_IA_OK, corpo: CORPO_OWNEWS, why_it_matters: IMPACTO_OWNEWS };
test("matéria própria válida passa no gate completo", () => {
  const r = M.validarMateriaOWNews(MAT_OK, ARTIGO_ANP, ARTIGO_ANP.content);
  expect(r.ok, JSON.stringify(r.motivos));
});
test("corpo = texto integral da fonte é proibido (republicação)", () => {
  const r = M.validarMateriaOWNews(Object.assign({}, MAT_OK, { corpo: ARTIGO_ANP.content.trim().replace(/\. (?=Os campos)/, ".\n\n") }), ARTIGO_ANP, ARTIGO_ANP.content);
  expect(!r.ok && r.motivos.some((m) => m === "corpo:copia_fonte" || m === "corpo:parafrase_rasa"), JSON.stringify(r.motivos));
});
test("Buddy vazio / whitespace é inválido", () => {
  ["", "   ", null].forEach((b) => { const r = M.validarMateriaOWNews(Object.assign({}, MAT_OK, { buddy_summary: b }), ARTIGO_ANP, ARTIGO_ANP.content); expect(!r.ok && r.motivos.includes("buddy:vazio"), JSON.stringify(r.motivos)); });
});
test("Impacto vazio é inválido (obrigatório)", () => {
  const r = M.validarMateriaOWNews(Object.assign({}, MAT_OK, { why_it_matters: "" }), ARTIGO_ANP, ARTIGO_ANP.content);
  expect(!r.ok && r.motivos.includes("impacto:vazio"), JSON.stringify(r.motivos));
});
test("corpo vazio ou de 1 parágrafo é inválido", () => {
  expect(M.validarMateriaOWNews(Object.assign({}, MAT_OK, { corpo: "" }), ARTIGO_ANP, ARTIGO_ANP.content).motivos.includes("corpo:vazio"));
  const r = M.validarCorpoOWNews(CORPO_OWNEWS.replace("\n\n", " "), ARTIGO_ANP, null, null);
  expect(!r.ok && r.motivos.includes("paragrafos_1"), JSON.stringify(r));
});
test("corpo que repete o Buddy é inválido (duplicação entre blocos)", () => {
  const r = M.validarCorpoOWNews(BUDDY_IA_OK + "\n\n" + CORPO_OWNEWS, ARTIGO_ANP, BUDDY_IA_OK, IMPACTO_OWNEWS);
  expect(!r.ok && r.motivos.includes("repete_buddy"), JSON.stringify(r));
});
test("corpo que repete o Impacto é inválido", () => {
  const r = M.validarCorpoOWNews(CORPO_OWNEWS + "\n\n" + IMPACTO_OWNEWS, ARTIGO_ANP, BUDDY_IA_OK, IMPACTO_OWNEWS);
  expect(!r.ok && r.motivos.includes("repete_impacto"), JSON.stringify(r));
});
test("placeholder é inválido", () => {
  const r = M.validarCorpoOWNews(CORPO_OWNEWS + "\n\nLorem ipsum dolor sit amet, texto provisório [inserir fonte].", ARTIGO_ANP, null, null);
  expect(!r.ok && r.motivos.includes("placeholder"), JSON.stringify(r));
});
test("clichê de texto de IA é inválido", () => {
  const r = M.validarCorpoOWNews("Em um movimento que chamou atenção, a ANP divulgou os dados de julho com 5,851 milhões de boe/d.\n\nVale destacar que o pré-sal respondeu por 82,4% da produção nacional naquele mês.", ARTIGO_ANP, null, null);
  expect(!r.ok && r.motivos.some((m) => m.startsWith("cliche_ia:")), JSON.stringify(r));
});
test("número que não está na fonte é inválido (corpo)", () => {
  const r = M.validarMateriaOWNews(Object.assign({}, MAT_OK, { corpo: CORPO_OWNEWS + " A ANP projeta 6,2 milhões de boe/d para 2027." }), ARTIGO_ANP, ARTIGO_ANP.content);
  expect(!r.ok && r.motivos.includes("corpo:numero_sem_fonte"), JSON.stringify(r.motivos));
});
test("impacto com 'vagas' só passa quando a fonte trata de contratação", () => {
  const art = { title: "Petrobras abre concurso com 1.200 vagas para nível técnico", summary: "", content: "A Petrobras abriu concurso com 1.200 vagas para técnicos de operação em plataformas da Bacia de Campos. ".repeat(4) };
  const ok = M.validarImpactoPublicavel("As 1.200 vagas são para técnicos de operação, função que trabalha embarcada nas plataformas da Bacia de Campos.", art, null);
  expect(ok.ok, JSON.stringify(ok));
  const r = M.validarImpactoPublicavel("O contrato da Bacia de Campos abre vagas para técnicos embarcados.", { title: "Contrato na Bacia de Campos", summary: "", content: "A Petrobras assinou contrato de afretamento na Bacia de Campos. ".repeat(6) }, null);
  expect(!r.ok, JSON.stringify(r));
});

console.log("\n== SSR / TEMPLATE DA NOTÍCIA ==");
test("SSR renderiza Buddy resume, corpo OWNews e Impacto (nesta ordem no template)", () => {
  const c = M.resolverCamadaEditorial(MAT_OWNEWS);
  expect(M.blocoBuddyExplica(c).includes("Buddy resume") && M.blocoBuddyExplica(c).includes("Em poucas palavras, o que aconteceu?"));
  expect(M.blocoCorpoOWNews(c).split("<p>").length === 3, M.blocoCorpoOWNews(c));
  expect(M.blocoImpactoOffshore(c).includes("O que isso impacta para o offshore"));
  const ini = FRONT.indexOf('if (url.pathname === "/noticia") {');
  const rota = FRONT.slice(ini, FRONT.indexOf('if (url.pathname === "/api/buddy/feed"', ini));
  const ib = rota.indexOf("blocoBuddyExplica(camadaEditorial)"), ic = rota.indexOf("blocoCorpoOWNews(camadaEditorial)"), ii = rota.indexOf("blocoImpactoOffshore(camadaEditorial)"), ip = rota.indexOf("blocoProvenienciaNoticia(artigo, camadaEditorial)");
  expect(ib > 0 && ib < ic && ic < ii && ii < ip, "ordem Buddy → corpo → impacto → fonte");
});
test("template NÃO exibe o texto da fonte (content/summary) como corpo nem como deck", () => {
  const ini = FRONT.indexOf('if (url.pathname === "/noticia") {');
  const rota = FRONT.slice(ini, FRONT.indexOf('if (url.pathname === "/api/buddy/feed"', ini));
  expect(!rota.includes("escaparHTML(artigo.content || artigo.summary)"), "corpo da fonte no template rico");
  expect(!rota.includes('class="hub-lead"'), "lead da fonte como deck");
  expect(!/escaparHTML\(artigo\.content \|\| artigo\.summary \|\| artigo\.title/.test(rota), "corpo da fonte no fallback");
  expect(rota.includes("artigo.buddy_source === MATERIA_OWNEWS ? '<div><p>'"), "fallback sem guarda de matéria OWNews");
});
test("meta description e JSON-LD usam o Buddy, nunca o lead da fonte", () => {
  const ini = FRONT.indexOf('if (url.pathname === "/noticia") {');
  const rota = FRONT.slice(ini, FRONT.indexOf('if (url.pathname === "/api/buddy/feed"', ini));
  expect(rota.includes("descricaoMetaSegura((camadaEditorial && camadaEditorial.buddy_summary) || artigo.title || '', 160)"));
  expect(!/descricaoMetaSegura\([^)]*artigo\.summary/.test(rota), "lead da fonte na descrição");
});
test("canonical da notícia é /noticia?id=<uuid>", () => {
  const ini = FRONT.indexOf('if (url.pathname === "/noticia") {');
  const rota = FRONT.slice(ini, FRONT.indexOf('if (url.pathname === "/api/buddy/feed"', ini));
  expect(rota.includes("const urlArtigo = '/noticia?id=' + encodeURIComponent(artigo.id);") && rota.includes("urlArtigo,\n"), "canonical");
});
test("fonte preservada: nome, link original e declaração honesta de autoria", () => {
  const html = M.blocoProvenienciaNoticia({ image_credit: "ANP", original_url: "https://www.gov.br/anp/x", published_at: "2026-10-17T10:00:00Z" }, M.resolverCamadaEditorial(MAT_OWNEWS));
  expect(html.includes('href="https://www.gov.br/anp/x"') && html.includes("ANP ↗") && html.includes("Fonte primária (oficial)"), html);
  expect(html.includes("Não houve apuração própria") && html.includes("inteligência artificial"), "autoria honesta");
  const sem = M.blocoProvenienciaNoticia({ image_credit: "Eixos", original_url: "https://eixos.com.br/a" }, null);
  expect(sem.includes("não tem texto editorial do OWNews"), sem);
});
test("cliente não remove nem esconde os blocos editoriais", () => {
  expect(!/querySelector(All)?\(["']\.(buddy-explica|noticia-corpo|buddy-explica-porque-card)/.test(FRONT), "script mexe nos blocos");
});
test("Home: deck vem do Buddy OWNews, nunca do lead da fonte; thin = não-OWNews", () => {
  expect(M.deckNoticiaOWNews(MAT_OWNEWS, 130).startsWith("A produção de petróleo"));
  expect(M.deckNoticiaOWNews(Object.assign({}, ARTIGO_ANP, { buddy_summary: BUDDY_IA_OK, buddy_source: "ia" }), 130) === "");
  expect(M.ehMateriaThin(ARTIGO_ANP) && !M.ehMateriaThin(MAT_OWNEWS));
  expect(!FRONT.includes("deckEditorial(h.summary") && !FRONT.includes("deckEditorial(d.summary"), "Home usa lead da fonte");
});

console.log("\n== META DESCRIPTION ==");
test("não corta no meio de palavra", () => {
  const t = "A Petrobras anunciou uma nova descoberta de petróleo em águas profundas do Amapá, na margem equatorial brasileira, durante coletiva com a presidente da empresa e diretoras executivas.";
  const d = M.descricaoMetaSegura(t, 160);
  expect(d.length <= 161 && (d.endsWith("…") || d.endsWith(".")), d);
  const semRet = d.replace(/…$/, "");
  expect(t.startsWith(semRet) && (t[semRet.length] === " " || t[semRet.length] === "," || semRet.length === t.length), "cortou palavra: " + d);
});
test("mantém texto curto intacto", () => expect(M.descricaoMetaSegura("Texto curto.", 160) === "Texto curto."));

console.log("\n== INDEXAÇÃO DE PÁGINAS (estático) ==");
const idxSrc = bloco(FRONT, "/* ==== INDEXACAO PAGINAS 2.1: INICIO ====", "/* ==== INDEXACAO PAGINAS 2.1: FIM ==== */");
const montarP = (src) => new Function("DADOS_SALARIO", "PESQUISA_SALARIAL_AGREGADOS", "PESQUISA_SALARIAL_MINIMO", "funcaoComExtra",
  src + "\nreturn { salarioIndexavel, funcaoIndexavel, empresaIndexavel, radarIndexavel, eventoAgendaIndexavel, paginaForaDoIndice };")(
  { "com-dado": { clt: { media: 5000 } }, "sem-dado": {} }, { "pesq": { n: 12 }, "pesq-pouca": { n: 3 } }, 10, (f) => f);
const P = montarP(idxSrc);
// AdSense 3.0: Salários fora do ar (SALARIOS_PUBLICO=false). A regra de
// dado real continua testada com a chave religada.
const PSal = montarP(idxSrc.replace("const SALARIOS_PUBLICO = false;", "const SALARIOS_PUBLICO = true;"));
test("Salários fora do ar: nenhum salário indexável e /salarios/* com noindex", () => {
  expect(!P.salarioIndexavel("com-dado") && !P.salarioIndexavel("pesq"), "salário indexável com SALARIOS_PUBLICO=false");
  expect(P.paginaForaDoIndice("/salarios") && P.paginaForaDoIndice("/salarios/driller") && P.paginaForaDoIndice("/pesquisa-salarial"), "salários sem noindex");
});
test("salário com CAGED é indexável; placeholder não", () => {
  expect(PSal.salarioIndexavel("com-dado") && !PSal.salarioIndexavel("sem-dado") && !PSal.salarioIndexavel("inexistente"));
});
test("salário volta ao índice sozinho com amostra suficiente da pesquisa", () => {
  expect(PSal.salarioIndexavel("pesq") && !PSal.salarioIndexavel("pesq-pouca"));
});
test("função quase vazia não é indexável; função completa é", () => {
  expect(!P.funcaoIndexavel({ resumo: "Opera o ROV." }));
  const rica = { resumo: "x".repeat(150), atividades: ["a".repeat(80), "b".repeat(80)], ondeAtua: "c".repeat(60), requisitosEntrada: "d".repeat(60), caminhoCarreira: ["a", "b"], funcoesRelacionadas: ["z"], fontes: [{ url: "u" }], rotina: "e".repeat(500) };
  expect(P.funcaoIndexavel(rica));
});
test("empresa stub (só nome/link) não é indexável", () => expect(!P.empresaIndexavel({ nome: "X", careersUrl: "u" })));
test("radar com descrição curta e poucos dados não é indexável", () => {
  expect(!P.radarIndexavel({ sobre: "FPSO afretado." }) && P.radarIndexavel({ sobre: "s".repeat(400) }));
  // AdSense 3.0: 260+ caracteres só com 4+ campos técnicos; a nota "Não foi localizado código" não conta.
  expect(!P.radarIndexavel({ sobre: "s".repeat(260) }) && P.radarIndexavel({ sobre: "s".repeat(260), imo: 1, owner: "a", operador: "b", ano_construcao: 2010 }));
  expect(!P.radarIndexavel({ sobre: "s".repeat(200) + " Não foi localizado código NS-## associado a esta unidade.", imo: 1, owner: "a", operador: "b", ano_construcao: 2010 }));
});
test("evento passado ou ficha curta da agenda não é indexável", () => {
  expect(!P.eventoAgendaIndexavel({ dataFim: "2020-01-01", descricao: "d".repeat(400) }) && !P.eventoAgendaIndexavel({ dataFim: "2099-01-01", descricao: "curta" }));
});
test("/agenda/submeter tem noindex e saiu do sitemap", () => {
  const r = funcao(FRONT, "function renderAgendaSubmeter(sucesso)");
  expect(r.includes("robots: ROBOTS_NOINDEX_PAGINA"), "sem noindex");
  const sm = funcao(FRONT, "async function gerarSitemap()");
  expect(!sm.includes('"/agenda/submeter"'), "ainda no sitemap");
});
test("sitemap usa os mesmos critérios das páginas", () => {
  const sm = funcao(FRONT, "async function gerarSitemap()");
  ["funcaoIndexavel(f)", "salarioIndexavel(f.slug)", "radarIndexavel(u)", "empresaIndexavel(e)", "eventoAgendaIndexavel(ev)", "classificarIndexacaoNoticia("].forEach((k) => expect(sm.includes(k), "falta " + k));
});
test("sem rótulos globais de produto inacabado no menu", () => {
  expect(!FRONT.includes('<span class="nav-mais-label">Em desenvolvimento</span>') && !FRONT.includes("'<span class=\"nav-mais-label\">Em desenvolvimento</span>'") && !FRONT.includes("Dados em preparação"));
});
test("/unidades redireciona 301 para /radar", () => expect(FRONT.includes('return Response.redirect("https://ownews.com.br/radar", 301);')));
test("título nunca duplica ' | OWNews'", () => {
  const pc = funcao(FRONT, "function paginaChrome(tituloAba, descricaoMeta, conteudoHtml, caminhoCanonico, opcoesOg)");
  expect(pc.includes("replace(/(\\s*[|—–-]\\s*OWNews)+\\s*$/i, '')"), "sem normalização de título");
});
test("Minha Escala não afirma mais que 'nenhum dado é enviado'", () => {
  expect(!FRONT.includes("Nenhum dado é enviado a servidor — a configuração fica salva só no seu navegador.") && !FRONT.includes("Tudo no navegador — nada enviado a servidor."));
});

console.log("\n== COLLECTOR ==");
if (COLLECTOR) {
  const iaSrc = corpoBloco(COLLECTOR, "/* ==== CAMADA IA 2.1: INICIO ====", "/* ==== CAMADA IA 2.1: FIM ==== */")
    .replace(/export class BuddyIAPoller[\s\S]*?\n}\n/, "");
  const C = Object.assign(new Function(iaSrc.replace(/^export /gm, "") + "\nreturn { extrairJsonIA, BUDDY_IA_SISTEMA };").call(null), { numerosSustentadosPelaFonte: M.numerosSustentadosPelaFonte });
  test("número inventado é detectado", () => expect(!C.numerosSustentadosPelaFonte("A campanha começa em 2026 e dura 200 dias.", "campanha de 170 dias a partir de 2027")));
  test("números presentes (com separadores diferentes) são aceitos", () => expect(C.numerosSustentadosPelaFonte("Foram 5,851 milhões de boe/d, 82,4% do total.", "produção de 5.851 milhões boe/d; pré-sal 82,4%")));
  test("parser aceita JSON cercado por ```json", () => {
    const j = C.extrairJsonIA({ response: "```json\n{\"relacao_offshore\":\"direta\",\"buddy\":\"a\",\"impacto\":null}\n```" });
    expect(j && j.relacao_offshore === "direta");
  });
  test("parser aceita objeto já decodificado", () => expect(C.extrairJsonIA({ response: { buddy: "x" } }).buddy === "x"));
  test("prompt proíbe especulação de vagas e boilerplate", () => expect(/vagas/.test(C.BUDDY_IA_SISTEMA) && /segmento central/.test(C.BUDDY_IA_SISTEMA)));
  test("rotas admin exigem token (fail closed) — só leituras públicas abertas", () => {
    const rotas = COLLECTOR.match(/const ROTAS_PUBLICAS_COLLECTOR = new Set\(\[([^\]]*)\]\)/);
    expect(rotas, "allowlist ausente");
    expect(!/deletar|run|admin|retroprocessar|revisao/.test(rotas[1]), "rota sensível na allowlist: " + rotas[1]);
    const tok = funcao(COLLECTOR, "function tokenAdminValido(request, env)");
    expect(tok.includes("esperado.length < 24") && tok.includes("return false"), "token sem fail-closed");
  });
  test("rota antiga de retroprocessamento extrativo está desativada (410)", () => {
    const i = COLLECTOR.indexOf('if (url.pathname === "/retroprocessar-buddy-impact")');
    expect(i > 0 && COLLECTOR.slice(i, i + 600).includes("status: 410"), "rota antiga ainda ativa");
  });
  test("collector não grava mais impacto de template no pipeline", () => {
    const ini = COLLECTOR.indexOf("async function processarNoticiasComDedupe(");
    const p = COLLECTOR.slice(ini, COLLECTOR.indexOf("\n/* =========================\n   LEITURA DA MATÉRIA", ini));
    expect(p.includes("gerarCamadaEditorialIA(") && !p.includes("gerarCamadaEditorialParaArtigo("), "pipeline ainda usa gerador antigo");
  });
  test("collector publica a matéria OWNews: content = corpo próprio, fonte arquivada antes", () => {
    const ini = COLLECTOR.indexOf("async function processarNoticiasComDedupe(");
    const p = COLLECTOR.slice(ini, COLLECTOR.indexOf("\n/* =========================\n   LEITURA DA MATÉRIA", ini));
    const ia = p.indexOf("arquivarMaterialFonte("), ic = p.indexOf("artigo.content = camadaIA.corpo;");
    expect(ia > 0 && ic > ia && p.includes("artigo.buddy_source = MATERIA_OWNEWS;"), "pipeline não grava matéria OWNews");
    expect(!p.includes("artigo.buddy_source = 'ia';"), "pipeline ainda grava acervo 'ia'");
  });
  test("pipeline marca mesmo acontecimento de outra fonte como 'duplicada' (fora do índice)", () => {
    const ini = COLLECTOR.indexOf("async function processarNoticiasComDedupe(");
    const p = COLLECTOR.slice(ini, COLLECTOR.indexOf("\n/* =========================\n   LEITURA DA MATÉRIA", ini));
    expect(p.includes("artigo.buddy_source = 'duplicada'") && p.includes("Object.assign({}, contexto, { recentes })"), "dedupe por evento ausente");
  });
  test("gate da IA exige Buddy + corpo + impacto (validarMateriaOWNews)", () => {
    expect(funcao(COLLECTOR, "async function gerarCamadaEditorialIA(env, artigo, materialFonte, tentativa)").includes("validarMateriaOWNews("));
    expect(funcao(COLLECTOR, "async function aplicarMateriaOWNews(env, a, mat, fonteMaterial)").includes("validarMateriaOWNews(mat, a, fonte)"), "rota admin sem gate");
  });
}

console.log("\n" + "─".repeat(50));
console.log("TOTAL: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
