#!/usr/bin/env node
/* Eleições 2026 — integridade e resiliência do bloco temporário do worker.js.
 * Extrai o bloco pelos marcadores e roda com fetch/caches simulados (sem rede). */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const RAIZ = path.join(__dirname, "..");
const FRONT = fs.readFileSync(path.join(RAIZ, "worker.js"), "utf8");
const TSE = path.join(__dirname, "fixtures", "tse-2026");
let pass = 0, fail = 0;
const fila = [];
function test(nome, fn) { fila.push([nome, fn]); }
function expect(c, msg) { if (!c) throw new Error(msg || "falhou"); }

const ini = FRONT.indexOf("/* ==== ELEIÇÕES 2026 (2º turno");
const fim = FRONT.indexOf("/* ==== ELEIÇÕES 2026: FIM ==== */");
const BLOCO = FRONT.slice(ini, fim);

function carregar(fetchFake, agoraFake) {
  const store = new Map();
  const caches = { default: {
    match: async (req) => { const v = store.get(req.url); return v ? new Response(v) : undefined; },
    put: async (req, resp) => { store.set(req.url, await resp.text()); },
  } };
  const DateFake = class extends Date {};
  DateFake.now = () => agoraFake.t;
  DateFake.parse = Date.parse;
  const f = new Function("fetch", "caches", "Date", "paginaChrome",
    BLOCO + "; return { eleicoesBuscar, eleicoesConfig, eleicoesResultado, eleicoesResponder, eleicoesFaixaHome, eleicoesAtivas, ELEICOES_UFS, ELEICOES_ASSET_V };");
  return { m: f(fetchFake, caches, DateFake, (t, d, c) => "<html>" + c + "</html>"), store };
}
const json = (nome) => JSON.parse(fs.readFileSync(path.join(TSE, nome), "utf8"));
const resp = (obj, status, cab) => new Response(obj == null ? null : JSON.stringify(obj), { status: status || 200, headers: cab || {} });

test("bloco presente entre marcadores e rotas ligadas no fetch e na Home", () => {
  expect(ini > 0 && fim > ini, "marcadores");
  expect(FRONT.includes('url.pathname === "/eleicoes-2026" || url.pathname.startsWith("/api/eleicoes-2026/")'), "rota");
  expect(FRONT.includes("const base = eleicoesFaixaHome("), "faixa da Home");
});

test("config oficial (EA11): 2º turno descoberto do arquivo, sem UF fixa", () => {
  const { m } = carregar(null, { t: 0 });
  const c = m.eleicoesConfig(json("ele-c.json"));
  expect(c.presidente === "6258" && c.governador === "6260", JSON.stringify(c));
  expect(JSON.stringify(c.governadorUfs) === JSON.stringify(["ac", "am", "df", "es", "rn", "to"]), c.governadorUfs.join());
  expect(!/governadorUfs\s*[:=]\s*\[\s*'/.test(BLOCO), "lista de UFs de governador não pode ser fixa");
});

test("resultado (EA20): números e percentuais idênticos aos do TSE, ordem objetiva por votos oficiais", () => {
  const { m } = carregar(null, { t: 0 });
  const bruto = json("br-c0001-e006258-u.json");
  const d = m.eleicoesResultado(bruto);
  const todos = [];
  for (const ag of bruto.carg[0].agr) for (const p of ag.par) for (const c of p.cand) todos.push(c);
  expect(d.candidatos.length === todos.length, "qtde");
  for (const c of todos) {
    const x = d.candidatos.find(k => k.n === c.n);
    expect(x && x.votos === c.vap && x.pct === c.pvap && x.nome === c.nmu && x.eleito === c.e && x.situacao === c.st, "candidato " + c.n);
  }
  const esperada = todos.slice().sort((a, b) => Number(b.vap) - Number(a.vap) || a.seq - b.seq).map(c => c.n).join();
  expect(d.candidatos.map(c => c.n).join() === esperada, "ordem por votos oficiais");
  const zerado = m.eleicoesResultado({ carg: [{ agr: [{ tp: "i", par: [{ sg: "B", cand: [{ n: "2", seq: "2", vap: "0" }, { n: "1", seq: "1", vap: "0" }] }] }] }] });
  expect(zerado.candidatos.map(c => c.n).join() === "1,2", "antes da totalização: seq do TSE");
  expect(d.secoes.pct === bruto.s.pst && d.secoes.totalizadas === bruto.s.st && d.secoes.total === bruto.s.ts, "seções");
  expect(d.votos.brancos === bruto.v.vb && d.votos.nulos === bruto.v.tvn && d.comparecimento === bruto.e.c && d.abstencao === bruto.e.a, "detalhes");
  expect(d.totalizadoEm === bruto.dt + " " + bruto.ht, "hora do TSE");
});

test("arquivo antes da totalização (dt/ht vazios) não quebra", () => {
  const { m } = carregar(null, { t: 0 });
  const d = m.eleicoesResultado({ ele: "6258", t: "2", f: "o", and: "n", dt: "", ht: "", carg: [{ nmn: "Presidente", agr: [] }], s: {}, e: {}, v: {} });
  expect(d.totalizadoEm === null && d.candidatos.length === 0);
});

test("cache: 1 consulta ao TSE por intervalo; depois If-None-Match e 304 reaproveita snapshot", async () => {
  const chamadas = [];
  const relogio = { t: 1000000 };
  const bruto = json("br-c0001-e006258-u.json");
  const fake = async (url, init) => {
    chamadas.push(init.headers);
    if (init.headers["If-None-Match"] === '"abc"') return resp(null, 304);
    return resp(bruto, 200, { etag: '"abc"', "last-modified": "Sun, 25 Oct 2026 22:04:46 GMT" });
  };
  const { m } = carregar(fake, relogio);
  const t = (x) => x;
  let r = await m.eleicoesBuscar("k", "https://x/a.json", t, null);
  expect(r.fonte === "tse" && chamadas.length === 1);
  relogio.t += 10000; r = await m.eleicoesBuscar("k", "https://x/a.json", t, null);
  expect(r.fonte === "cache" && chamadas.length === 1, "não pode consultar antes do intervalo");
  relogio.t += 31000; r = await m.eleicoesBuscar("k", "https://x/a.json", t, null);
  expect(chamadas.length === 2 && chamadas[1]["If-None-Match"] === '"abc"', "condicional");
  expect(r.fonte === "tse" && r.snap.dados.s.pst === bruto.s.pst && r.snap.consultadoEm === relogio.t, "304 mantém dados");
});

test("TSE fora do ar: mantém último snapshot (sem zerar) e sinaliza falha", async () => {
  const relogio = { t: 5000000 };
  let fora = false;
  const bruto = json("br-c0001-e006258-u.json");
  const fake = async () => { if (fora) throw new Error("timeout"); return resp(bruto, 200, { etag: '"e1"' }); };
  const { m } = carregar(fake, relogio);
  await m.eleicoesBuscar("k", "u", (x) => x, null);
  fora = true; relogio.t += 60000;
  const r = await m.eleicoesBuscar("k", "u", (x) => x, null);
  expect(r.snap && r.snap.dados.s.pst === bruto.s.pst && r.snap.falhaEm === relogio.t && r.fonte === "snapshot");
  const vazio = carregar(fake, relogio).m;
  const r2 = await vazio.eleicoesBuscar("k2", "u", (x) => x, null);
  expect(r2.snap === null, "sem snapshot nunca inventa dado");
});

test("API: abrangência fora da config oficial é recusada sem consultar o TSE", async () => {
  const urls = [];
  const fake = async (url) => { urls.push(url); return resp(json("ele-c.json"), 200, { etag: '"c"' }); };
  const { m } = carregar(fake, { t: 1 });
  const r = await m.eleicoesResponder(new Request("https://ownews.com.br/api/eleicoes-2026/resultado?cargo=governador&abr=sp"), new URL("https://ownews.com.br/api/eleicoes-2026/resultado?cargo=governador&abr=sp"), null);
  expect(r.status === 404, String(r.status));
  expect(urls.length === 1 && urls[0].endsWith("/comum/config/ele-c.json"), urls.join());
  const r2 = await m.eleicoesResponder(new Request("https://ownews.com.br/api/eleicoes-2026/resultado?abr=../x"), new URL("https://ownews.com.br/api/eleicoes-2026/resultado?abr=../x"), null);
  expect(r2.status === 404 && urls.length === 1, "path traversal / UF inexistente");
});

test("API: URL oficial do arquivo unificado montada a partir da config", async () => {
  const urls = [];
  const fake = async (url) => { urls.push(url); return url.endsWith("ele-c.json") ? resp(json("ele-c.json")) : resp(json("es-c0003-e006260-u.json")); };
  const { m } = carregar(fake, { t: 1 });
  const u = new URL("https://ownews.com.br/api/eleicoes-2026/resultado?cargo=governador&abr=es");
  const r = await m.eleicoesResponder(new Request(u), u, null);
  const j = await r.json();
  expect(r.status === 200 && j.ok && j.dados.cargo === "Governador", JSON.stringify(j).slice(0, 200));
  expect(urls[1] === "https://resultados.tse.jus.br/oficial/ele2026/6260/dados/es/es-c0003-e006260-u.json", urls[1]);
});

test("Home: faixa só enquanto ativa; depois some sozinha", () => {
  const html = '<main class="container" id="conteudo"><p>x</p>';
  const ativo = carregar(null, { t: Date.parse("2026-10-25T22:00:00Z") }).m;
  expect(ativo.eleicoesFaixaHome(html).includes('href="/eleicoes-2026"'), "faixa ausente");
  const depois = carregar(null, { t: Date.parse("2026-10-28T03:00:01Z") }).m;
  expect(depois.eleicoesFaixaHome(html) === html, "faixa deveria sumir");
});

test("neutralidade: sem cor partidária, sem projeção/tendência, 'Eleito' só com dado do TSE", () => {
  const js = fs.readFileSync(path.join(RAIZ, "public/eleicoes/eleicoes-2026.js"), "utf8");
  const css = fs.readFileSync(path.join(RAIZ, "public/eleicoes/eleicoes-2026.css"), "utf8");
  // Avisos de integridade ("sem cálculo, projeção…", "não projeta") não contam.
  const semComent = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const tudo = semComent(BLOCO + js).toLowerCase().replace(/sem cálculo, projeção ou interpretação própria/g, "");
  for (const p of ["projeç", "tendênc", "virtualmente", "favorito", "lidera", "vencedor", "vitória"]) expect(!tudo.includes(p), "termo proibido: " + p);
  expect(!/#(e53935|d32f2f|c62828|ff0000|f44336|1565c0)\b/i.test(css), "cor partidária fixa");
  expect(!/var\(--(red|orange|green|yellow)\)/.test(css), "só navy/ciano/branco/cinza");
  expect(/c\.eleito === 's' \|\| \(c\.situacao && c\.situacao\.trim\(\)\)/.test(js), "rótulo de situação só do TSE");
  expect(!/resultados\.tse\.jus\.br/.test(js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/'[^']*TSE em resultados\.tse\.jus\.br[^']*'/g, "")), "navegador nunca chama o TSE");
});

test("assets versionados pelo conteúdo e sem KV no bloco", () => {
  const v = crypto.createHash("sha256").update(fs.readFileSync(path.join(RAIZ, "public/eleicoes/eleicoes-2026.js")))
    .update(fs.readFileSync(path.join(RAIZ, "public/eleicoes/eleicoes-2026.css"))).digest("hex").slice(0, 10);
  expect(BLOCO.includes("const ELEICOES_ASSET_V = '" + v + "'"), "ELEICOES_ASSET_V desatualizada (esperado " + v + ")");
  expect(!/_KV|\.put\(/.test(BLOCO.replace(/\/\*[\s\S]*?\*\//g, "").replace(/cache\.put/g, "")), "nada de KV");
});

(async () => {
  for (const [nome, fn] of fila) {
    try { await fn(); pass++; console.log("  ✓ " + nome); }
    catch (e) { fail++; console.log("  ✗ " + nome + "\n      " + e.message); }
  }
  console.log("\n" + pass + " passaram, " + fail + " falharam");
  process.exit(fail ? 1 : 0);
})();
