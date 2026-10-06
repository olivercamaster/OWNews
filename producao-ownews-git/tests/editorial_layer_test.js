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

// Stubs do que o módulo usa de fora
const escaparHTML = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const decodificarEntidadesHTMLServidor = (s) => String(s || "");

const mod = new Function(
  "escaparHTML", "decodificarEntidadesHTMLServidor",
  explicaSrc + "\n" +
  "function explicaPorSlug(slug) { return EXPLICA_ARTIGOS.find((e) => e.slug === slug) || null; }\n" +
  camadaSrc + "\n" +
  "return { EXPLICA_ARTIGOS, BUDDY_FRASES_PROIBIDAS, validarTextoCamadaEditorial, CAMADA_EDITORIAL_CURADA, explicaRelacionadosParaNoticia, resolverCamadaEditorial, blocoBuddyExplica, blocoEntendaMelhor, blocoProvenienciaNoticia, ehMateriaThin, formatarDataCurtaServidor, EXPLICA_GATILHOS_NOTICIA, classificarOrigemFonte, gerarBuddySummaryFallback, avaliarQualidadeMateria };"
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

console.log("\n== CAMADA EDITORIAL — curadoria ==");

const ids = Object.keys(mod.CAMADA_EDITORIAL_CURADA);
test("curadoria tem pelo menos 15 matérias", () => expect(ids.length >= 15, "só " + ids.length));
test("toda chave da curadoria é UUID", () => {
  ids.forEach((id) => expect(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id), "chave inválida: " + id));
});
test("todo buddy_summary curado passa no validador", () => {
  ids.forEach((id) => {
    const r = mod.validarTextoCamadaEditorial(mod.CAMADA_EDITORIAL_CURADA[id].buddy_summary);
    expect(r.ok, id + ": " + r.motivo);
  });
});
test("todo why_it_matters curado (quando existe) passa no validador", () => {
  ids.forEach((id) => {
    const w = mod.CAMADA_EDITORIAL_CURADA[id].why_it_matters;
    if (w == null) return;
    const r = mod.validarTextoCamadaEditorial(w);
    expect(r.ok, id + ": " + r.motivo);
  });
});
test("toda entrada curada tem revisado_em ISO (aaaa-mm-dd)", () => {
  ids.forEach((id) => expect(/^\d{4}-\d{2}-\d{2}$/.test(mod.CAMADA_EDITORIAL_CURADA[id].revisado_em || ""), id));
});
test("slugs do Explica referenciados pela curadoria existem", () => {
  const existentes = new Set(mod.EXPLICA_ARTIGOS.map((e) => e.slug));
  ids.forEach((id) => {
    (mod.CAMADA_EDITORIAL_CURADA[id].explica || []).forEach((s) => expect(existentes.has(s), id + " → /explica/" + s + " não existe"));
  });
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
test("nenhum texto curado contém frase proibida", () => {
  ids.forEach((id) => {
    const c = mod.CAMADA_EDITORIAL_CURADA[id];
    const t = ((c.buddy_summary || "") + " " + (c.why_it_matters || "")).toLowerCase();
    mod.BUDDY_FRASES_PROIBIDAS.forEach((f) => expect(!t.includes(f.toLowerCase()), id + " contém '" + f + "'"));
  });
});

console.log("\n== CAMADA EDITORIAL — resolução e thin ==");

const idCurado = ids[0];
test("resolverCamadaEditorial prioriza curadoria sobre banco", () => {
  const c = mod.resolverCamadaEditorial({ id: idCurado, buddy_summary: "Texto do banco que seria válido se não houvesse curadoria para esta matéria específica." });
  expect(c && c.fonte === "curadoria", "fonte=" + (c && c.fonte));
  expect(c.buddy_summary === mod.CAMADA_EDITORIAL_CURADA[idCurado].buddy_summary);
});
test("resolverCamadaEditorial aceita banco válido quando não há curadoria", () => {
  const c = mod.resolverCamadaEditorial({ id: "00000000-0000-0000-0000-000000000000", buddy_summary: "A unidade saiu do estaleiro na China rumo ao Brasil. A chegada ao campo está prevista para o ano que vem.", why_it_matters: null, buddy_reviewed_at: "2026-10-01T00:00:00Z" });
  expect(c && c.fonte === "banco", "fonte=" + (c && c.fonte));
});
test("resolverCamadaEditorial rejeita banco inválido (frase proibida)", () => {
  const c = mod.resolverCamadaEditorial({ id: "00000000-0000-0000-0000-000000000001", buddy_summary: "A empresa reforça seu compromisso com o setor e marca um novo capítulo na história offshore do país." });
  expect(c === null, "deveria retornar null");
});
test("resolverCamadaEditorial retorna null sem nada (sem content/summary para fallback)", () => {
  expect(mod.resolverCamadaEditorial({ id: "00000000-0000-0000-0000-000000000002" }) === null);
});
test("resolverCamadaEditorial fallback: usa conteúdo da matéria quando não há curadoria/banco", () => {
  const artigo = {
    id: "00000000-0000-0000-0000-000000000003",
    title: "Petrobras anuncia contrato",
    summary: "A Petrobras assinou contrato com a CHC para operações de helicóptero no campo de Búzios.",
    content: "A Petrobras assinou um contrato de cinco anos com a CHC Helicopters para troca de equipes no campo de Búzios, na Bacia de Santos. A aeronave utilizada é um S-92 operando a partir de Maricá. O início das operações está previsto para junho de 2027.",
  };
  const c = mod.resolverCamadaEditorial(artigo);
  expect(c !== null, "fallback deveria retornar camada");
  expect(c.fonte === 'fallback', "fonte deve ser 'fallback', é: " + c.fonte);
  expect(c.buddy_summary.length >= 40, "fallback muito curto");
  expect(c.why_it_matters === null, "fallback não deve ter 'por que importa'");
  expect(mod.validarTextoCamadaEditorial(c.buddy_summary).ok, "fallback não passa no validador: " + c.buddy_summary);
});
test("resolverCamadaEditorial fallback: NÃO inventa fatos — só usa o que está no artigo", () => {
  // O fallback não pode conter palavras que não estão no artigo
  const artigo = {
    id: "00000000-0000-0000-0000-000000000004",
    title: "Empresa firma parceria",
    content: "A Subsea7 firmou contrato de instalação de dutos com a Shell no Mar do Norte. O prazo é de 18 meses e o início está previsto para o segundo trimestre de 2027.",
    summary: "A Subsea7 fechou contrato com a Shell."
  };
  const c = mod.resolverCamadaEditorial(artigo);
  if (c && c.fonte === 'fallback') {
    const palavrasArtigo = (artigo.content + ' ' + artigo.summary + ' ' + artigo.title).toLowerCase();
    const palavrasFallback = c.buddy_summary.toLowerCase().replace(/[^\wà-ú\s]/g, ' ').split(/\s+/).filter(w => w.length > 5);
    palavrasFallback.forEach(p => {
      expect(palavrasArtigo.includes(p), "fallback contém palavra não presente no artigo: " + p);
    });
  }
});
test("ehMateriaThin: content === summary → thin", () => {
  const s = "A plataforma P-78 deixou o estaleiro em Singapura rumo ao campo de Búzios.";
  expect(mod.ehMateriaThin({ content: s, summary: s }, null) === true);
});
test("ehMateriaThin: conteúdo curto → thin", () => {
  expect(mod.ehMateriaThin({ content: "Curto.", summary: "Outro." }, null) === true);
});
test("ehMateriaThin: conteúdo longo → não thin", () => {
  expect(mod.ehMateriaThin({ content: "x".repeat(900), summary: "resumo" }, null) === false);
});
test("ehMateriaThin: camada NÃO afeta o resultado — thin = corpo insuficiente APENAS (Recovery 2.0)", () => {
  const curto = "Frase única.";
  const longo = "x".repeat(500);
  // Thin com camada → ainda thin (Buddy ≠ indexação)
  expect(mod.ehMateriaThin({ content: curto, summary: curto }, { buddy_summary: "ok" }) === true, "curto com camada ainda thin");
  // Não-thin independente de camada
  expect(mod.ehMateriaThin({ content: longo, summary: "resumo diferente" }, null) === false);
  expect(mod.ehMateriaThin({ content: longo, summary: "resumo diferente" }, { buddy_summary: "ok" }) === false);
});

console.log("\n== CAMADA EDITORIAL — HTML ==");

test("blocoBuddyExplica escapa HTML do texto", () => {
  const html = mod.blocoBuddyExplica({ buddy_summary: "Texto <script>alert(1)</script> aqui.", why_it_matters: null, revisado_em: "2026-10-06" });
  expect(!html.includes("<script>"), "script não escapado");
  expect(html.includes("&lt;script&gt;"));
  expect(html.includes('class="buddy-explica"'));
  expect(html.includes("Buddy te explica"));
});
test("blocoBuddyExplica mostra 'Por que isso importa?' só quando há texto", () => {
  const sem = mod.blocoBuddyExplica({ buddy_summary: "Texto suficiente para o bloco aparecer normalmente.", why_it_matters: null, revisado_em: "2026-10-06" });
  const com = mod.blocoBuddyExplica({ buddy_summary: "Texto suficiente para o bloco aparecer normalmente.", why_it_matters: "Porque muda a escala de quem embarca.", revisado_em: "2026-10-06" });
  expect(!sem.includes("Por que isso importa?"));
  expect(com.includes("Por que isso importa?"));
});
test("blocoBuddyExplica vazio sem camada", () => {
  expect(mod.blocoBuddyExplica(null) === "");
});
test("blocoBuddyExplica linka a política editorial (#buddy-te-explica)", () => {
  const html = mod.blocoBuddyExplica({ buddy_summary: "Texto suficiente para o bloco aparecer normalmente.", why_it_matters: null, revisado_em: "2026-10-06" });
  expect(html.includes("/politica-editorial#buddy-te-explica"));
});
test("blocoBuddyExplica (Identidade Premium): Buddy oficial, chamada em 2 linhas, H2/H3 e card 'Por que importa'", () => {
  const html = mod.blocoBuddyExplica({ buddy_summary: "Texto suficiente para o bloco aparecer normalmente.", why_it_matters: "Porque muda a escala de quem embarca.", revisado_em: "2026-10-06" });
  expect(html.includes('src="/icons/buddy-head.png"'), "sem o mascote oficial");
  expect(html.includes('class="buddy-explica-buddy"') && html.includes('aria-hidden="true"'), "imagem decorativa deve ser aria-hidden");
  expect(html.includes("Não quer ler a matéria toda?") && html.includes("O Buddy resume e te explica."), "chamada oficial ausente");
  expect(html.includes('<h2 id="buddyExplicaTitulo"') && html.includes('<h3 class="buddy-explica-sub">Por que isso importa?</h3>'), "hierarquia H2/H3");
  expect(!html.includes("<h1"), "bloco não pode competir com o H1 da matéria");
  expect(html.includes('class="buddy-explica-porque-card"'), "card 'Por que isso importa?' ausente");
  expect(html.indexOf('class="buddy-explica-card"') < html.indexOf('class="buddy-explica-porque-card"'), "ordem: resumo antes do porquê");
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
test("blocoProvenienciaNoticia só chama de 'Fonte primária' o que é verificável pelo domínio", () => {
  const oficial = mod.blocoProvenienciaNoticia({ image_credit: "Agência Petrobras", original_url: "https://agencia.petrobras.com.br/x", published_at: "2026-10-05T12:00:00Z" }, null);
  const imprensa = mod.blocoProvenienciaNoticia({ image_credit: "Offshore Energy", original_url: "https://www.offshore-energy.biz/x", published_at: "2026-10-05T12:00:00Z" }, null);
  expect(oficial.includes("Fonte primária (oficial): "), "oficial sem rótulo primária");
  expect(!imprensa.includes("Fonte primária"), "imprensa rotulada como primária");
  expect(imprensa.includes("<p>Fonte: "), "imprensa sem rótulo neutro");
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
test("explicaRelacionadosParaNoticia: máximo 3, curados primeiro", () => {
  const artigo = { id: idCurado, title: "FPSO sonda completação transporte aéreo", summary: "", content: "" };
  const r = mod.explicaRelacionadosParaNoticia(artigo, mod.CAMADA_EDITORIAL_CURADA[idCurado]);
  expect(r.length <= 3, "mais de 3");
  const curados = mod.CAMADA_EDITORIAL_CURADA[idCurado].explica || [];
  if (curados.length) expect(r[0] === curados[0], "curado não veio primeiro");
});
test("formatarDataCurtaServidor → dd/mm/aaaa", () => {
  expect(mod.formatarDataCurtaServidor("2026-10-06") === "06/10/2026", mod.formatarDataCurtaServidor("2026-10-06"));
});

console.log("\n" + "─".repeat(50));
console.log("TOTAL: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
