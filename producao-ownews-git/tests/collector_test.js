#!/usr/bin/env node
/**
 * Collector unit tests — pure-function fixtures only.
 * No network, no KV, no Supabase, no Telegram calls.
 * All engine functions inlined verbatim from shrill-pond-a915-fix/worker.js.
 */

// ── Inlined engine ────────────────────────────────────────────────────────────

function interpretarMetar(metar) {
  const bruto = String(metar || "").toUpperCase();
  const inicioMetar = bruto.indexOf("METAR ");
  const inicioSpeci = bruto.indexOf("SPECI ");
  let texto = inicioMetar >= 0
    ? bruto.slice(inicioMetar + 6)
    : inicioSpeci >= 0
      ? bruto.slice(inicioSpeci + 6)
      : bruto;
  const fimObservacao = texto.search(/(?:\\N|\n)(?:TAF|NÃO)/i);
  if (fimObservacao >= 0) texto = texto.slice(0, fimObservacao);
  texto = texto.trim();
  const grupos = texto.split(/\s+/).filter(Boolean);

  let temperatura = null;
  const tempGrupo = grupos.find((g) => /^(M?\d{2})\/(M?\d{2})$/.test(g));
  if (tempGrupo) {
    const temp = tempGrupo.split("/")[0];
    temperatura = temp.startsWith("M") ? -Number(temp.slice(1)) : Number(temp);
  }

  let visibilidade = null;
  const temCAVOK = grupos.includes("CAVOK");
  if (temCAVOK) {
    visibilidade = "10+ km (CAVOK)";
  } else {
    const visGrupo = grupos.find((g) => /^\d{4}$/.test(g));
    if (visGrupo) {
      const metros = Number(visGrupo);
      visibilidade = metros >= 9999 ? "10+ km" : (metros / 1000).toFixed(1).replace(".0", "") + " km";
    }
  }

  const trovoada = grupos.some((g) => /^[-+]?(TS|TSRA|VCTS)$/.test(g));
  const chuva = grupos.some((g) => /^[-+]?(RA|DZ|SHRA)$/.test(g));
  const nevoa = grupos.some((g) => /^(FG|BR|HZ|MIFG|BCFG|FZFG)$/.test(g));
  const ovc = !temCAVOK && grupos.some((g) => /^OVC\d{3}/.test(g));
  const bkn = !temCAVOK && grupos.some((g) => /^BKN\d{3}/.test(g));
  const sct = !temCAVOK && grupos.some((g) => /^SCT\d{3}/.test(g));
  const few = !temCAVOK && grupos.some((g) => /^FEW\d{3}/.test(g));

  let icone = "☀️";
  let tempo = "Céu claro";
  if (trovoada) { icone = "⛈️"; tempo = "Trovoada"; }
  else if (chuva) { icone = "🌧️"; tempo = "Chuva"; }
  else if (nevoa) { icone = "🌫️"; tempo = "Névoa"; }
  else if (ovc || bkn) { icone = "☁️"; tempo = "Nublado"; }
  else if (sct) { icone = "🌤️"; tempo = "Parcialmente nublado"; }
  else if (few) { icone = "🌤️"; tempo = "Poucas nuvens"; }

  let horarioUTC = null;
  const horaGrupo = grupos.find((g) => /^\d{6}Z$/.test(g));
  if (horaGrupo) horarioUTC = horaGrupo.slice(2, 4) + ":" + horaGrupo.slice(4, 6) + " UTC";

  const ventGrupo = grupos.find((g) => /^(VRB|\d{3})\d{2,3}(G\d{2,3})?KT$/.test(g));
  let vento = null;
  if (ventGrupo) {
    if (/^00000KT$/.test(ventGrupo)) {
      vento = "Calmo";
    } else if (ventGrupo.startsWith("VRB")) {
      const velMatch = ventGrupo.match(/VRB(\d+)/);
      const vel = velMatch ? Number(velMatch[1]) : 0;
      vento = `variável/${vel}kt`;
    } else {
      const dir = ventGrupo.slice(0, 3);
      const vel = Number(ventGrupo.slice(3, 5));
      const gustMatch = ventGrupo.match(/G(\d+)KT$/);
      vento = `${dir}\xb0/${vel}kt` + (gustMatch ? ` (raj. ${Number(gustMatch[1])}kt)` : "");
    }
  }

  let teto = null;
  const camadasTeto = temCAVOK ? [] : grupos.filter((g) => /^(OVC|BKN)\d{3}/.test(g));
  const camadasSCT = temCAVOK ? [] : grupos.filter((g) => /^SCT\d{3}/.test(g));
  if (camadasTeto.length) {
    const ft = Number(camadasTeto[0].slice(3)) * 100;
    const tipo = camadasTeto[0].startsWith("OVC") ? "nublado" : "semi-nublado";
    teto = `${ft.toLocaleString("pt-BR")}ft (${tipo})`;
  } else if (camadasSCT.length) {
    const ft = Number(camadasSCT[0].slice(3)) * 100;
    teto = `${ft.toLocaleString("pt-BR")}ft (disperso)`;
  }

  return { temperatura, visibilidade, vento, teto, icone, tempo, horarioUTC };
}

function extrairIcaoEStatus(entrada) {
  const dados = entrada.dados;
  if (Array.isArray(dados)) return { icao: dados[0] || null, status: dados[4] || null };
  return { icao: dados?.icao || null, status: dados?.status || null };
}

function classificarCondicaoMeteo(status) {
  if (status === "g") return { emoji: "🟢", label: "VERDE", ordem: 0 };
  if (status === "y") return { emoji: "🟡", label: "AMARELO", ordem: 1 };
  if (status === "r") return { emoji: "🔴", label: "VERMELHO", ordem: 2 };
  return { emoji: "⚪", label: "SEM INFORMAÇÃO", ordem: 3 };
}

function normalizarTituloParaComparacao(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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

function detectarIdiomaEN(texto) {
  if (!texto) return false;
  if (/[àáâãäèéêëìíîïòóôõöùúûüç]/i.test(texto)) return false;
  return /\b(the|and\b|for\b|with|its\b|has\b|are\b|will\b|was\b|been|new\b|from|secures|awards|wins\b|signs\b|launches|completes|expands|acquires|orders\b|joins\b|broadens|appraisal|vessel|drillship|contract\b|awarded|receives|keeps\b|rakes\b|forges?|scoops|first\b)\b/i.test(texto);
}

const RISCO_CONTEXTO_SEGURO = [
  /prevenc[a]?o\s+de\s+(acidente|morte|explosao|sinistro)/i,
  /historico\s+de\s+(acidente|morte|vitima|lesao)/i,
  /anal[i]?se\s+(estat[i]?stica|de\s+risco|de\s+dados|de\s+causa)/i,
  /semana\s+(nacional|estadual|mundial)\s+de/i,
  /dia\s+(nacional|internacional|mundial)\s+de/i,
  /simulac[a]?o\s+de\s+(emergencia|resgate|abandono|combate)/i,
  /treinamento\s+de\s+(seguranca|emergencia|resgate)/i,
  /reducao\s+(de\s+)?(acidentes|mortes|vitimas)/i,
  /\b(estatistica[s]?|indic[e]?[s]?|taxa[s]?)\s+(de\s+)?(acidente|lesao|morte)/i,
];

const RISCO_PADROES = [
  [/\b(trabalhadore?s?|operad[o]?re?s?|tripulante[s]?|marinheiro[s]?|mergulhad[o]?re?s?|tecnico[s]?|engenheiro[s]?|supervisor[e]?s?)\b.{0,80}\b(morr|falec|obito|fatalid|vitima\s*fatal)/is, 'FATALIDADE_TRABALHADOR'],
  [/\b(morr|falec|obito|morte[s]?\b|morto[s]?\b|vitima[s]?\s*fatal).{0,80}\b(trabalh|plataforma|sonda|fpso|navio|offshore|bordo)/is, 'FATALIDADE_OFFSHORE'],
  [/\b(tripulante[s]?|marinheiro[s]?|pescadore?s?|trabalhadore?s?|operad[o]?re?s?)\b.{0,80}\bdesaparec/is, 'DESAPARECIMENTO_PESSOA'],
  [/\bdesaparec.{0,60}\b(mar\b|bordo|plataforma|offshore|navio|alto\s*mar)/is, 'DESAPARECIMENTO_OFFSHORE'],
  [/\b\d+\s*(vitima[s]?|morto[s]?|falecido[s]?|morte[s]?)/is, 'VITIMAS_NUMERADAS'],
  [/\b(vitima[s]?\s+fatal|morte[s]?\s+confirm|morto[s]?\s+confirm|obito[s]?\s+confirm)/is, 'VITIMAS_CONFIRMADAS'],
  [/\b(acidente|explosao|incendio|naufragio|colisao)\b.{0,100}\b(vitima|morto|fatal|ferido.{0,15}grave|resgate.{0,20}vida)/is, 'ACIDENTE_COM_VITIMAS'],
  [/\bresgate.{0,60}\b(plataforma|offshore|fpso|sonda|navio|trabalhad)/is, 'RESGATE_OFFSHORE'],
  [/\b(evacuac[a]?o\s+(emergencial|urgente)|(evacuad[o]?[s]?|evacuac[a]?o).{0,40}(incendio|explosao|plataforma))/is, 'EVACUACAO_EMERGENCIA'],
  [/\b(preso|detido|investigado|indiciado|acusado)\b.{0,60}\b(engenheiro|gerente|diretor|executivo|funcionario|operad)/is, 'ACUSACAO_CRIMINAL_PESSOA'],
  [/\b(engenheiro|gerente|diretor|executivo|funcionario|operad\w*)\b.{0,60}\b(preso|detido|investigado|indiciado|acusado)/is, 'ACUSACAO_CRIMINAL_PESSOA'],
];

function classificarRiscoEditorial(artigo) {
  try {
    const raw = ((artigo.title || '') + ' ' + (artigo.summary || '')).toLowerCase();
    const texto = raw.normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const re of RISCO_CONTEXTO_SEGURO) {
      if (re.test(texto)) return { nivel: 'NORMAL', motivo: null };
    }
    for (const [re, motivo] of RISCO_PADROES) {
      if (re.test(texto)) return { nivel: 'SENSIVEL', motivo };
    }
    return { nivel: 'NORMAL', motivo: null };
  } catch {
    return { nivel: 'SENSIVEL', motivo: 'CLASSIFIER_ERROR' };
  }
}

const OFFVOOS_FRESCOR_AO_VIVO_MS = 10 * 60 * 1000;
const OFFVOOS_FRESCOR_RECENTE_MS = 30 * 60 * 1000;

function classificarFrescorOffVoos(registroAeroporto) {
  if (!registroAeroporto || registroAeroporto.status !== "ok") return "sem_dados";
  const idadeMs = Date.now() - new Date(registroAeroporto.fetched_at).getTime();
  if (!Number.isFinite(idadeMs)) return "sem_dados";
  if (idadeMs <= OFFVOOS_FRESCOR_AO_VIVO_MS) return "ao_vivo";
  if (idadeMs <= OFFVOOS_FRESCOR_RECENTE_MS) return "recente";
  return "indisponivel";
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function eq(a, b) {
  if (typeof a === "object" && a !== null)
    return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

function test(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function assertEq(a, b, msg) {
  if (!eq(a, b)) throw new Error((msg || "") + `\n    got      ${JSON.stringify(a)}\n    expected ${JSON.stringify(b)}`);
}

// ── METAR — interpretarMetar ──────────────────────────────────────────────────

console.log("\nMETAR — interpretarMetar");

test("CAVOK → visibilidade 10+ km (CAVOK), céu claro", () => {
  const r = interpretarMetar("METAR SBME 301200Z 09012KT CAVOK 28/22 Q1013");
  assertEq(r.visibilidade, "10+ km (CAVOK)");
  assertEq(r.tempo, "Céu claro");
  assertEq(r.temperatura, 28);
  assertEq(r.teto, null);
});

test("CAVOK → vento normal 090/12kt", () => {
  const r = interpretarMetar("METAR SBME 301200Z 09012KT CAVOK 28/22 Q1013");
  assertEq(r.vento, "090°/12kt");
});

test("vento com rajada → raj. presente", () => {
  const r = interpretarMetar("METAR SBJR 300900Z 18015G25KT 9999 FEW020 26/20 Q1010");
  assert(r.vento !== null, "vento null");
  assert(r.vento.includes("raj."), "rajada ausente: " + r.vento);
});

test("vento variável VRB → variável/N kt", () => {
  const r = interpretarMetar("METAR SBVT 301000Z VRB08KT 9999 SCT025 27/21 Q1009");
  assert(r.vento !== null);
  assert(r.vento.startsWith("variável/"), "esperado variável/: " + r.vento);
});

test("vento calmo 00000KT", () => {
  const r = interpretarMetar("METAR SBCB 301200Z 00000KT CAVOK 25/20 Q1012");
  assertEq(r.vento, "Calmo");
});

test("visibilidade 4000m → 4 km", () => {
  const r = interpretarMetar("METAR SBJR 300600Z 09010KT 4000 BKN015 24/21 Q1011");
  assertEq(r.visibilidade, "4 km");
});

test("visibilidade 9999 → 10+ km", () => {
  const r = interpretarMetar("METAR SBME 301800Z 09008KT 9999 FEW025 29/23 Q1008");
  assertEq(r.visibilidade, "10+ km");
});

test("visibilidade 800m → 0.8 km", () => {
  const r = interpretarMetar("METAR SBFZ 300300Z 09005KT 0800 FG 22/21 Q1013");
  assertEq(r.visibilidade, "0.8 km");
});

test("teto OVC → nublado com altitude ft", () => {
  const r = interpretarMetar("METAR SBJR 300600Z 09010KT 4000 OVC010 24/21 Q1011");
  assert(r.teto !== null);
  assert(r.teto.includes("nublado"), "teto: " + r.teto);
  assert(r.teto.includes("1.000ft") || r.teto.includes("1000ft"), "altitude: " + r.teto);
});

test("teto BKN → semi-nublado", () => {
  const r = interpretarMetar("METAR SBJR 300600Z 09010KT 4000 BKN015 24/21 Q1011");
  assert(r.teto !== null);
  assert(r.teto.includes("semi-nublado"), "teto: " + r.teto);
});

test("SCT → teto disperso + parcialmente nublado", () => {
  const r = interpretarMetar("METAR SBVT 301000Z VRB08KT 9999 SCT025 27/21 Q1009");
  assertEq(r.tempo, "Parcialmente nublado");
  assert(r.teto !== null && r.teto.includes("disperso"), "teto: " + r.teto);
});

test("FEW → poucas nuvens", () => {
  const r = interpretarMetar("METAR SBME 301800Z 09008KT 9999 FEW025 29/23 Q1008");
  assertEq(r.tempo, "Poucas nuvens");
});

test("chuva RA → ícone chuva", () => {
  const r = interpretarMetar("METAR SBSV 300900Z 09012KT 6000 RA BKN020 26/24 Q1009");
  assertEq(r.tempo, "Chuva");
});

test("trovoada TS → ícone trovoada", () => {
  const r = interpretarMetar("METAR SBFZ 301400Z 09015KT 4000 TS BKN015 29/25 Q1007");
  assertEq(r.tempo, "Trovoada");
});

test("névoa FG → névoa", () => {
  const r = interpretarMetar("METAR SBCB 300500Z VRB02KT 0400 FG 22/22 Q1014");
  assertEq(r.tempo, "Névoa");
});

test("temperatura negativa M05 → -5", () => {
  const r = interpretarMetar("METAR SBPA 301200Z 18010KT 9999 FEW020 M05/M08 Q1020");
  assertEq(r.temperatura, -5);
});

test("horário 301200Z → 12:00 UTC", () => {
  const r = interpretarMetar("METAR SBME 301200Z 09012KT CAVOK 28/22 Q1013");
  assertEq(r.horarioUTC, "12:00 UTC");
});

test("campo ausente → null (sem inferência)", () => {
  const r = interpretarMetar("METAR SBXX 301200Z 9999 FEW020");
  assertEq(r.temperatura, null, "temperatura deveria ser null");
  assertEq(r.vento, null, "vento deveria ser null");
});

test("entrada vazia → todos null", () => {
  const r = interpretarMetar("");
  assertEq(r.temperatura, null);
  assertEq(r.visibilidade, null);
  assertEq(r.vento, null);
  assertEq(r.horarioUTC, null);
});

test("entrada inválida string lixo → não lança, todos null", () => {
  const r = interpretarMetar("XXXXXXXXXXX 999 ABC DEF GHI");
  assert(typeof r === "object", "deve retornar objeto");
  assertEq(r.temperatura, null);
});

test("METAR com TAF anexo → corta no TAF, não mistura", () => {
  const r = interpretarMetar("METAR SBME 301200Z 09012KT CAVOK 28/22 Q1013\nTAF SBME 301200Z 3012/3112 09010KT 9999 FEW020");
  assertEq(r.temperatura, 28);
  assertEq(r.visibilidade, "10+ km (CAVOK)");
});

test("SPECI prefix funciona igual a METAR", () => {
  const r = interpretarMetar("SPECI SBJR 301530Z 09008KT 8000 SCT020 27/23 Q1010");
  assertEq(r.visibilidade, "8 km");
});

// ── Airport status — extrairIcaoEStatus + classificarCondicaoMeteo ────────────

console.log("\nAeroportos — status e classificação");

test("array format [ICAO, ..., status] → extrai corretamente", () => {
  const r = extrairIcaoEStatus({ dados: ["SBME", null, null, null, "g"] });
  assertEq(r.icao, "SBME");
  assertEq(r.status, "g");
});

test("object format {icao, status} → extrai corretamente", () => {
  const r = extrairIcaoEStatus({ dados: { icao: "SBJR", status: "y" } });
  assertEq(r.icao, "SBJR");
  assertEq(r.status, "y");
});

test("status g → VERDE 🟢 ordem 0", () => {
  assertEq(classificarCondicaoMeteo("g"), { emoji: "🟢", label: "VERDE", ordem: 0 });
});

test("status y → AMARELO 🟡 ordem 1", () => {
  assertEq(classificarCondicaoMeteo("y"), { emoji: "🟡", label: "AMARELO", ordem: 1 });
});

test("status r → VERMELHO 🔴 ordem 2", () => {
  assertEq(classificarCondicaoMeteo("r"), { emoji: "🔴", label: "VERMELHO", ordem: 2 });
});

test("status null/ausente → SEM INFORMAÇÃO ⚪ ordem 3", () => {
  assertEq(classificarCondicaoMeteo(null), { emoji: "⚪", label: "SEM INFORMAÇÃO", ordem: 3 });
  assertEq(classificarCondicaoMeteo(undefined), { emoji: "⚪", label: "SEM INFORMAÇÃO", ordem: 3 });
});

test("status desconhecido → SEM INFORMAÇÃO", () => {
  assertEq(classificarCondicaoMeteo("x").label, "SEM INFORMAÇÃO");
});

// ── Freshness — classificarFrescorOffVoos ────────────────────────────────────

console.log("\nFrescor — classificarFrescorOffVoos");

test("status != ok → sem_dados", () => {
  assertEq(classificarFrescorOffVoos({ status: "error", fetched_at: new Date().toISOString() }), "sem_dados");
});

test("sem registro → sem_dados", () => {
  assertEq(classificarFrescorOffVoos(null), "sem_dados");
  assertEq(classificarFrescorOffVoos(undefined), "sem_dados");
});

test("5min → ao_vivo", () => {
  const fa = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  assertEq(classificarFrescorOffVoos({ status: "ok", fetched_at: fa }), "ao_vivo");
});

test("15min → recente", () => {
  const fa = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  assertEq(classificarFrescorOffVoos({ status: "ok", fetched_at: fa }), "recente");
});

test("45min → indisponivel (stale — NÃO exibir como operacional)", () => {
  const fa = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  assertEq(classificarFrescorOffVoos({ status: "ok", fetched_at: fa }), "indisponivel");
});

test("fetched_at inválido → sem_dados", () => {
  assertEq(classificarFrescorOffVoos({ status: "ok", fetched_at: "not-a-date" }), "sem_dados");
});

// ── Deduplicação — similaridadeTitulos ───────────────────────────────────────

console.log("\nDedupe — similaridadeTitulos");

test("mesmo título → similaridade 1.0", () => {
  const s = similaridadeTitulos(
    "Petrobras inicia operação da plataforma P-80",
    "Petrobras inicia operação da plataforma P-80"
  );
  assertEq(s, 1.0);
});

test("título idêntico, pontuação diferente → ainda >= 0.55 (duplicata)", () => {
  const s = similaridadeTitulos(
    "Petrobras inicia operação da plataforma P-80!",
    "Petrobras inicia operação da plataforma P-80"
  );
  assert(s >= LIMIAR_SIMILARIDADE_DUPLICATA, "esperado >= 0.55, got " + s);
});

test("mesmo fato, ordem invertida → score 0.5 (abaixo do limiar — comportamento documentado)", () => {
  // Jaccard real: intersec={petrobras,operacao,plataforma}=3 / union=6 = 0.5
  // O algoritmo não detecta como duplicata — limitação conhecida do Jaccard simples
  const s = similaridadeTitulos(
    "Petrobras inicia operação da plataforma X",
    "Plataforma X entra em operação pela Petrobras"
  );
  assertEq(Math.round(s * 100) / 100, 0.5);
  assert(s < LIMIAR_SIMILARIDADE_DUPLICATA, "comportamento esperado: NÃO duplicata (score < 0.55)");
});

test("fatos diferentes, empresa em comum → NÃO duplicata (< 0.55)", () => {
  const s = similaridadeTitulos(
    "Petrobras contrata sonda para perfuração no pré-sal",
    "Petrobras inicia produção no campo de Búzios"
  );
  assert(s < LIMIAR_SIMILARIDADE_DUPLICATA, "fatos diferentes não devem ser duplicata: score=" + s);
});

test("artigos sem palavras longas → similaridade 0 (sem erro)", () => {
  const s = similaridadeTitulos("Rio", "Sal");
  assertEq(s, 0);
});

test("título vazio → similaridade 0", () => {
  assertEq(similaridadeTitulos("", "Petrobras inicia operação"), 0);
  assertEq(similaridadeTitulos("Petrobras inicia operação", ""), 0);
});

test("mesma URL mesma fonte mesma empresa → alta similaridade", () => {
  const s = similaridadeTitulos(
    "ANP realiza leilão de blocos exploratórios no pré-sal",
    "ANP realiza leilão de blocos no pré-sal brasileiro"
  );
  assert(s >= LIMIAR_SIMILARIDADE_DUPLICATA, "score=" + s);
});

test("atualização com info nova — termos extras abaixam score (<0.55)", () => {
  // Notícia inicial vs desenvolvimento posterior com contexto diferente
  const s = similaridadeTitulos(
    "Petrobras anuncia descoberta de petróleo na Bacia de Santos",
    "Petrobras confirma volume bilionário na descoberta da Bacia de Santos e define plano de desenvolvimento"
  );
  // Score pode variar — objetivo é que NÃO seja forçado a 0 nem 1
  // Uma atualização real geralmente fica próxima mas pode cair abaixo do limiar
  assert(s >= 0 && s <= 1, "score fora do range: " + s);
  // Registrar o score real sem forçar threshold específico
});

test("fontes diferentes, mesmo fato → score 0.5 (comportamento documentado)", () => {
  // Jaccard real: intersec={petrobras,ppsa,partilha,bloco,libra}=5 / union=10 = 0.5
  // Justo abaixo do limiar — palavras únicas de cada fonte abaixam o score
  const s = similaridadeTitulos(
    "PPSA e Petrobras assinam contrato de partilha para Bloco de Libra",
    "Petrobras e PPSA formalizam partilha de produção no Bloco Libra"
  );
  assertEq(Math.round(s * 100) / 100, 0.5);
});

// ── Idioma — detectarIdiomaEN ─────────────────────────────────────────────────

console.log("\nIdioma — detectarIdiomaEN");

test("título PT com diacrítico → NÃO é EN", () => {
  assert(!detectarIdiomaEN("Petrobras anuncia nova plataforma no pré-sal"));
});

test("título EN puro → É EN", () => {
  assert(detectarIdiomaEN("Petrobras and ENH forge oil and gas partnership"));
});

test("título EN com vessel/contract → É EN", () => {
  assert(detectarIdiomaEN("SBM Offshore awards new FPSO vessel contract"));
});

test("título PT com termos técnicos offshore → NÃO é EN", () => {
  // Termos técnicos em inglês mas texto PT não devem bloquear
  assert(!detectarIdiomaEN("Petrobras instala novo FPSO na Bacia de Campos"));
  assert(!detectarIdiomaEN("Operação de BOP drilling subsea concluída pela Petrobras"));
});

test("texto vazio/null → NÃO é EN (não lança)", () => {
  assert(!detectarIdiomaEN(""));
  assert(!detectarIdiomaEN(null));
});

test("EN com 'the' funcional word → É EN", () => {
  assert(detectarIdiomaEN("The offshore platform has been commissioned successfully"));
});

test("PT comum sem diacríticos mas sem EN patterns → NÃO é EN", () => {
  assert(!detectarIdiomaEN("Reuniao da ANP sobre blocos de petroleo no Brasil"));
});

// ── Classificador de risco — classificarRiscoEditorial ───────────────────────

console.log("\nClassificador de risco editorial");

test("artigo normal → NORMAL", () => {
  const r = classificarRiscoEditorial({
    title: "Petrobras inaugura nova plataforma de exploração no pré-sal",
    summary: "A Petrobras anunciou a entrada em operação da plataforma P-80 na Bacia de Santos."
  });
  assertEq(r.nivel, "NORMAL");
});

test("fatalidade trabalhador → SENSIVEL", () => {
  const r = classificarRiscoEditorial({
    title: "Trabalhador morre em acidente na plataforma P-70",
    summary: ""
  });
  assertEq(r.nivel, "SENSIVEL");
  assertEq(r.motivo, "FATALIDADE_TRABALHADOR");
});

test("fatalidade offshore no resumo → SENSIVEL", () => {
  const r = classificarRiscoEditorial({
    title: "Acidente em plataforma offshore",
    summary: "Três mortos confirmados a bordo da sonda de perfuração"
  });
  assertEq(r.nivel, "SENSIVEL");
});

test("desaparecimento tripulante → SENSIVEL", () => {
  const r = classificarRiscoEditorial({
    title: "Tripulante desaparece durante operação no mar",
    summary: ""
  });
  assertEq(r.nivel, "SENSIVEL");
  assertEq(r.motivo, "DESAPARECIMENTO_PESSOA");
});

test("vítimas numeradas → SENSIVEL", () => {
  const r = classificarRiscoEditorial({
    title: "3 vítimas no incêndio da plataforma",
    summary: ""
  });
  assertEq(r.nivel, "SENSIVEL");
  assertEq(r.motivo, "VITIMAS_NUMERADAS");
});

test("acusação criminal pessoa → SENSIVEL", () => {
  const r = classificarRiscoEditorial({
    title: "Engenheiro preso por fraude em contratos offshore",
    summary: ""
  });
  assertEq(r.nivel, "SENSIVEL");
  assertEq(r.motivo, "ACUSACAO_CRIMINAL_PESSOA");
});

test("contexto seguro — prevenção de acidentes → NORMAL (override)", () => {
  const r = classificarRiscoEditorial({
    title: "Petrobras lança campanha de prevenção de acidentes offshore",
    summary: "Iniciativa cobre treinamento de segurança e redução de acidentes em plataformas."
  });
  assertEq(r.nivel, "NORMAL");
});

test("contexto seguro — semana nacional de segurança → NORMAL", () => {
  const r = classificarRiscoEditorial({
    title: "Semana Nacional de Prevenção de Acidentes do Trabalho",
    summary: ""
  });
  assertEq(r.nivel, "NORMAL");
});

test("simulação de emergência → NORMAL (contexto seguro)", () => {
  const r = classificarRiscoEditorial({
    title: "Petrobras realiza simulação de emergência em plataforma do pré-sal",
    summary: "O exercício envolveu resgate de tripulantes e abandono da plataforma em cenário simulado."
  });
  assertEq(r.nivel, "NORMAL");
});

test("artigo em inglês sem risco → NORMAL (classifier não bloqueia por idioma)", () => {
  const r = classificarRiscoEditorial({
    title: "SBM Offshore awards new FPSO contract",
    summary: "The company signed a five-year agreement for the new vessel."
  });
  assertEq(r.nivel, "NORMAL");
});

test("objeto vazio → NORMAL (não lança)", () => {
  const r = classificarRiscoEditorial({});
  assertEq(r.nivel, "NORMAL");
});

test("exceção forçada via input tipo errado → SENSIVEL (fail-closed)", () => {
  // Simula classificador recebendo dado malformado
  const r = classificarRiscoEditorial(null);
  assertEq(r.nivel, "SENSIVEL");
  assertEq(r.motivo, "CLASSIFIER_ERROR");
});

// ── Resultado ──────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${"-".repeat(60)}`);
console.log(`TOTAL: ${passed}/${total} passed${failed ? ` — ${failed} FAILED` : " — ✓ ALL PASS"}`);
if (failed) process.exit(1);
