/**
 * OWNews Logic Tests — Schedule Engine + Cruzar Escalas + Datas Pessoais
 * Extracted from browser JS, run in Node.js (no dependencies).
 *
 * Usage: node tests/logic_test.js
 * Exit code: 0=all pass, 1=failures found
 */

// ── Minimal stubs for browser globals not needed in pure logic tests ──
const localStorage = { _d: {}, getItem(k){ return this._d[k]||null; }, setItem(k,v){ this._d[k]=v; } };
const MESES_ABREV = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const DIAS_SEMANA_ABREV = ["D","S","T","Q","Q","S","S"];
const DIAS_SEMANA_COMPLETO = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const FUNCOES_OFFSHORE = [];
const LS_KEY = "ownews_escala";
const LS_CRUZAR_KEY = "ownews_cruzar_escala";

// ── Inline minimal engine (mirrors worker.js browser JS exactly) ──
function diasEntre(a, b) { return Math.round((b - a) / 86400000); }
function pad2(n) { return n < 10 ? "0" + n : "" + n; }

function calcularEscala(diasEmbarcado, diasFolga, refUTC, tipoRef) {
  var ciclo = diasEmbarcado + diasFolga;
  var anchor = tipoRef === "embarquei" ? refUTC : refUTC - diasEmbarcado * 86400000;
  function faseEm(dataUTC) { var dias = diasEntre(anchor, dataUTC); return ((dias % ciclo) + ciclo) % ciclo; }
  function statusEm(dataUTC) {
    var fase = faseEm(dataUTC);
    return fase < diasEmbarcado
      ? { status: "embarcado", diaDoBloco: fase + 1, diasRestantes: diasEmbarcado - fase }
      : { status: "folga", diaDoBloco: fase - diasEmbarcado + 1, diasRestantes: ciclo - fase };
  }
  function proximaTransicao(dataUTC, faseAlvo) {
    var faseAtual = faseEm(dataUTC);
    var passo = (faseAlvo - faseAtual + ciclo) % ciclo;
    return dataUTC + passo * 86400000;
  }
  return { ciclo: ciclo, statusEm: statusEm, proximaTransicao: proximaTransicao };
}

function encontrarJanelasJuntos(calcA, calcB, desdeUTC, maxDias, maxJanelas) {
  var janelas = []; var emJanela = false; var inicioJanela = null;
  for (var _d = 0; _d < maxDias; _d++) {
    var _dUTC = desdeUTC + _d * 86400000;
    var _stA = calcA.statusEm(_dUTC); var _stB = calcB.statusEm(_dUTC);
    var _juntos = _stA.status === "folga" && _stB.status === "folga";
    if (_juntos && !emJanela) { emJanela = true; inicioJanela = _dUTC; }
    else if (!_juntos && emJanela) {
      emJanela = false;
      janelas.push({ inicio: inicioJanela, fim: _dUTC - 86400000 });
      if (janelas.length >= maxJanelas) break;
    }
  }
  if (emJanela) janelas.push({ inicio: inicioJanela, fim: desdeUTC + (maxDias - 1) * 86400000 });
  return janelas;
}

// ── Datas Pessoais helpers (mirrors worker.js) ──
function _dpAnaliseDia(dp, dataUTC, escala) {
  // Check if a personal date (dp) overlaps with dataUTC
  if (dp.start_date) {
    var s = new Date(dp.start_date + "T00:00:00Z").getTime();
    var e = dp.end_date ? new Date(dp.end_date + "T00:00:00Z").getTime() : s;
    return dataUTC >= s && dataUTC <= e;
  }
  // Legacy format: {mes, dia}
  var d = new Date(dataUTC);
  return d.getUTCMonth() + 1 === dp.mes && d.getUTCDate() === dp.dia;
}

// ── Test helpers ──
var passed = 0, failed = 0, total = 0;
function test(name, fn) {
  total++;
  try {
    fn();
    console.log("  ✓ " + name);
    passed++;
  } catch (e) {
    console.log("  ✗ FAIL " + name + ": " + e.message);
    failed++;
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function eq(a, b) { assert(a === b, "expected " + JSON.stringify(b) + " got " + JSON.stringify(a)); }

// UTC helpers
const D = (y, m, d) => Date.UTC(y, m - 1, d); // 1-based month

// ═══════════════════════════════════════════════════════════════
// SUITE 1: calcularEscala — deterministic cases
// ═══════════════════════════════════════════════════════════════
console.log("\n[LOGIC] calcularEscala 14x14");
{
  const ref = D(2026, 1, 1); // 2026-01-01, embarquei
  const calc = calcularEscala(14, 14, ref, "embarquei");
  eq(calc.ciclo, 28);

  test("14x14: dia 1 = embarcado, bloco 1", () => {
    const s = calc.statusEm(D(2026, 1, 1));
    eq(s.status, "embarcado"); eq(s.diaDoBloco, 1);
  });
  test("14x14: dia 14 = embarcado, bloco 14", () => {
    const s = calc.statusEm(D(2026, 1, 14));
    eq(s.status, "embarcado"); eq(s.diaDoBloco, 14);
  });
  test("14x14: dia 15 = folga, bloco 1", () => {
    const s = calc.statusEm(D(2026, 1, 15));
    eq(s.status, "folga"); eq(s.diaDoBloco, 1);
  });
  test("14x14: dia 28 = folga, bloco 14", () => {
    const s = calc.statusEm(D(2026, 1, 28));
    eq(s.status, "folga"); eq(s.diaDoBloco, 14);
  });
  test("14x14: dia 29 = embarcado, bloco 1 (ciclo reinicia)", () => {
    const s = calc.statusEm(D(2026, 1, 29));
    eq(s.status, "embarcado"); eq(s.diaDoBloco, 1);
  });
  test("14x14: virada de mês (fev 1 = embarcado dia 3)", () => {
    const s = calc.statusEm(D(2026, 2, 1)); // dia 32 do ciclo = fase 3 (32 % 28 = 4 → emb dia 5)
    // Dia 32 desde 2026-01-01 = 2026-02-01: dias = 31, fase = 31%28 = 3
    eq(s.status, "embarcado"); eq(s.diaDoBloco, 4);
  });
  test("14x14: tipoRef=desembarquei usa anchor diferente", () => {
    const calc2 = calcularEscala(14, 14, D(2026, 1, 15), "desembarquei");
    // desembarquei em 15/01 → embarcou em 01/01 → mesma anchor
    const s = calc2.statusEm(D(2026, 1, 1));
    eq(s.status, "embarcado"); eq(s.diaDoBloco, 1);
  });
  test("14x14: diasRestantes embarcado dia 1 = 14", () => {
    const s = calc.statusEm(D(2026, 1, 1));
    eq(s.diasRestantes, 14);
  });
  test("14x14: diasRestantes folga dia 1 = 14", () => {
    const s = calc.statusEm(D(2026, 1, 15));
    eq(s.diasRestantes, 14);
  });
}

console.log("\n[LOGIC] calcularEscala 21x21");
{
  const ref = D(2026, 1, 1);
  const calc = calcularEscala(21, 21, ref, "embarquei");
  eq(calc.ciclo, 42);

  test("21x21: dia 21 = embarcado, bloco 21", () => {
    const s = calc.statusEm(D(2026, 1, 21));
    eq(s.status, "embarcado"); eq(s.diaDoBloco, 21);
  });
  test("21x21: dia 22 = folga, bloco 1", () => {
    const s = calc.statusEm(D(2026, 1, 22));
    eq(s.status, "folga"); eq(s.diaDoBloco, 1);
  });
  test("21x21: dia 42 = folga, bloco 21", () => {
    // dia 42 from Jan 1 = Feb 11
    const s = calc.statusEm(D(2026, 2, 11));
    eq(s.status, "folga"); eq(s.diaDoBloco, 21);
  });
  test("21x21: dia 43 = embarcado, bloco 1", () => {
    const s = calc.statusEm(D(2026, 2, 12));
    eq(s.status, "embarcado"); eq(s.diaDoBloco, 1);
  });
}

console.log("\n[LOGIC] calcularEscala 28x28");
{
  const ref = D(2026, 1, 1);
  const calc = calcularEscala(28, 28, ref, "embarquei");
  eq(calc.ciclo, 56);

  test("28x28: dia 28 = embarcado, bloco 28", () => {
    const s = calc.statusEm(D(2026, 1, 28));
    eq(s.status, "embarcado"); eq(s.diaDoBloco, 28);
  });
  test("28x28: dia 29 = folga, bloco 1", () => {
    const s = calc.statusEm(D(2026, 1, 29));
    eq(s.status, "folga"); eq(s.diaDoBloco, 1);
  });
  test("28x28: dia 56 = folga, bloco 28", () => {
    const d56 = D(2026, 1, 1) + 55 * 86400000;
    const s = calc.statusEm(d56);
    eq(s.status, "folga"); eq(s.diaDoBloco, 28);
  });
}

console.log("\n[LOGIC] calcularEscala — negative phase (dates before ref)");
{
  const ref = D(2026, 6, 1);
  const calc = calcularEscala(14, 14, ref, "embarquei");
  test("14x14: date before ref wraps correctly (fase negativa)", () => {
    // 2026-05-18 = 14 days before ref = fase (-14 % 28 + 28) % 28 = 14 = folga, bloco 1
    const s = calc.statusEm(D(2026, 5, 18));
    eq(s.status, "folga"); eq(s.diaDoBloco, 1);
  });
  test("14x14: 1 day before ref = folga day 14 (last day of prev cycle)", () => {
    // fase = ((-1 % 28) + 28) % 28 = 27 → folga, diaDoBloco = 27-14+1 = 14
    const s = calc.statusEm(D(2026, 5, 31));
    eq(s.status, "folga"); eq(s.diaDoBloco, 14);
  });
}

// ═══════════════════════════════════════════════════════════════
// SUITE 2: encontrarJanelasJuntos
// ═══════════════════════════════════════════════════════════════
console.log("\n[LOGIC] encontrarJanelasJuntos");
{
  const ref = D(2026, 1, 1);
  const calcA = calcularEscala(14, 14, ref, "embarquei");

  test("mesmas escalas → primeira janela começa em dia 15", () => {
    const calcB = calcularEscala(14, 14, ref, "embarquei");
    const janelas = encontrarJanelasJuntos(calcA, calcB, ref, 56, 3);
    assert(janelas.length >= 1, "deve ter pelo menos 1 janela");
    const d = new Date(janelas[0].inicio);
    eq(d.getUTCFullYear(), 2026); eq(d.getUTCMonth(), 0); eq(d.getUTCDate(), 15);
  });

  test("mesmas escalas → janela tem 14 dias", () => {
    const calcB = calcularEscala(14, 14, ref, "embarquei");
    const janelas = encontrarJanelasJuntos(calcA, calcB, ref, 56, 3);
    const dur = diasEntre(janelas[0].inicio, janelas[0].fim) + 1;
    eq(dur, 14);
  });

  test("escalas opostas (offset 14 dias) → nenhuma janela em 56 dias", () => {
    const calcB = calcularEscala(14, 14, D(2026, 1, 15), "embarquei");
    const janelas = encontrarJanelasJuntos(calcA, calcB, ref, 56, 3);
    eq(janelas.length, 0);
  });

  test("escalas offset 7 dias → overlap parcial", () => {
    const calcB = calcularEscala(14, 14, D(2026, 1, 8), "embarquei");
    const janelas = encontrarJanelasJuntos(calcA, calcB, ref, 56, 3);
    assert(janelas.length >= 1, "deve ter overlap parcial");
    const dur = diasEntre(janelas[0].inicio, janelas[0].fim) + 1;
    eq(dur, 7); // 7-day overlap
  });

  test("14x14 vs 21x21 — tem janela (escalas diferentes)", () => {
    const calcB = calcularEscala(21, 21, ref, "embarquei");
    const janelas = encontrarJanelasJuntos(calcA, calcB, ref, 180, 5);
    assert(janelas.length >= 1, "deve existir janela com escalas diferentes");
  });

  test("virada de ano incluída no scan", () => {
    const refDez = D(2026, 12, 1);
    const calcA2 = calcularEscala(14, 14, D(2026, 12, 15), "embarquei");
    const calcB2 = calcularEscala(14, 14, D(2026, 12, 15), "embarquei");
    const janelas = encontrarJanelasJuntos(calcA2, calcB2, refDez, 90, 3);
    // Both on folga together from Dec 29
    const hasJan = janelas.some(j => new Date(j.inicio).getUTCFullYear() === 2027);
    assert(hasJan, "deve ter janela em 2027");
  });

  test("maxJanelas limita resultado", () => {
    const calcB = calcularEscala(14, 14, ref, "embarquei");
    const janelas = encontrarJanelasJuntos(calcA, calcB, ref, 364, 2);
    assert(janelas.length <= 2, "máximo de janelas deve ser respeitado");
  });
}

// ═══════════════════════════════════════════════════════════════
// SUITE 3: Datas Pessoais — format compatibility
// ═══════════════════════════════════════════════════════════════
console.log("\n[LOGIC] Datas Pessoais");
{
  test("formato legado {mes, dia} — match exato", () => {
    const dp = { nome: "Aniversário", mes: 6, dia: 15 };
    assert(_dpAnaliseDia(dp, D(2026, 6, 15), null), "deve fazer match");
  });
  test("formato legado {mes, dia} — não faz match em outro dia", () => {
    const dp = { nome: "Aniversário", mes: 6, dia: 15 };
    assert(!_dpAnaliseDia(dp, D(2026, 6, 16), null), "não deve fazer match");
  });
  test("formato novo {start_date} — dia único", () => {
    const dp = { nome: "Viagem", start_date: "2026-07-10" };
    assert(_dpAnaliseDia(dp, D(2026, 7, 10), null));
  });
  test("formato novo {start_date, end_date} — período", () => {
    const dp = { nome: "Férias pessoais", start_date: "2026-07-10", end_date: "2026-07-20" };
    assert(_dpAnaliseDia(dp, D(2026, 7, 10), null), "início do período");
    assert(_dpAnaliseDia(dp, D(2026, 7, 15), null), "meio do período");
    assert(_dpAnaliseDia(dp, D(2026, 7, 20), null), "fim do período");
    assert(!_dpAnaliseDia(dp, D(2026, 7, 21), null), "dia após fim");
    assert(!_dpAnaliseDia(dp, D(2026, 7, 9), null), "dia antes do início");
  });
  test("período virada de mês", () => {
    const dp = { nome: "Viagem longa", start_date: "2026-07-28", end_date: "2026-08-05" };
    assert(_dpAnaliseDia(dp, D(2026, 7, 31), null), "último dia de julho");
    assert(_dpAnaliseDia(dp, D(2026, 8, 1), null), "primeiro dia de agosto");
    assert(_dpAnaliseDia(dp, D(2026, 8, 5), null), "fim do período");
  });
  test("período virada de ano", () => {
    const dp = { nome: "Reveillon", start_date: "2026-12-30", end_date: "2027-01-03" };
    assert(_dpAnaliseDia(dp, D(2026, 12, 31), null), "31/dez");
    assert(_dpAnaliseDia(dp, D(2027, 1, 1), null), "01/jan");
  });
}

// ═══════════════════════════════════════════════════════════════
// SUITE 4: Input sanitization helpers
// ═══════════════════════════════════════════════════════════════
console.log("\n[LOGIC] Input sanitization (escaping)");
{
  // These replicate the replace logic used in _marcasDiaHtml and renderCruzarSecao
  function sanitizeNome(nome) {
    return (nome || "").toUpperCase().replace(/[<>&"]/g, "").substring(0, 8);
  }
  function sanitizeNomeCompleto(nome) {
    return (nome || "").replace(/[<>&"']/g, "").substring(0, 40);
  }

  test("nome com < > & \" é sanitizado", () => {
    eq(sanitizeNome('<script>'), "SCRIPT");
    eq(sanitizeNome('"alert"'), "ALERT");
    eq(sanitizeNome('A&B'), "AB");
  });
  test("nome vazio retorna string vazia", () => {
    eq(sanitizeNome(""), "");
    eq(sanitizeNome(null), "");
  });
  test("nome longo é truncado em 8 chars", () => {
    assert(sanitizeNome("LONGNAME123").length <= 8);
  });
  test("nome completo truncado em 40 chars", () => {
    assert(sanitizeNomeCompleto("A".repeat(100)).length <= 40);
  });
  test("XSS payload não contém < > & \" após sanitize", () => {
    const payload = '<img src=x onerror=alert(1)>';
    const result = sanitizeNome(payload);
    assert(!result.includes('<'), "não deve conter <");
    assert(!result.includes('>'), "não deve conter >");
    assert(!result.includes('"'), "não deve conter \"");
    assert(!result.includes('&'), "não deve conter &");
    assert(result.length <= 8, "truncado a 8 chars");
  });
}

// ═══════════════════════════════════════════════════════════════
// SUITE 5: proximaTransicao correctness
// ═══════════════════════════════════════════════════════════════
console.log("\n[LOGIC] proximaTransicao");
{
  const ref = D(2026, 1, 1);
  const calc = calcularEscala(14, 14, ref, "embarquei");

  test("próxima transição para folga a partir do dia 1", () => {
    // dia 1: fase=0, queremos fase=14 (início da folga)
    const prox = calc.proximaTransicao(D(2026, 1, 1), 14);
    eq(new Date(prox).getUTCDate(), 15);
    eq(new Date(prox).getUTCMonth(), 0); // janeiro
  });
  test("próxima transição para embarque a partir da folga", () => {
    // dia 15: fase=14, queremos fase=0 (início do embarque)
    const prox = calc.proximaTransicao(D(2026, 1, 15), 0);
    eq(new Date(prox).getUTCDate(), 29); // 15 + 14 = 29
  });
  test("proximaTransicao quando já na fase alvo = 0 dias", () => {
    // fase=0 queremos fase=0 → passo=0 → mesmo dia
    const prox = calc.proximaTransicao(D(2026, 1, 1), 0);
    eq(prox, D(2026, 1, 1));
  });
}

// ═══════════════════════════════════════════════════════════════
// Aeroporto sync — meHeroCard IIFE session fallback (Fix 1)
// ═══════════════════════════════════════════════════════════════
console.log("\n[SYNC] meHeroCard session fallback");
{
  // Simulates the Fix 1 logic extracted from meHeroCard IIFE
  function resolveHeroSalvo(localME, sessionData) {
    let salvo = null;
    try { salvo = localME ? JSON.parse(localME) : null; } catch(e) {}
    if (!salvo || !salvo.data) {
      try {
        const _rawS = sessionData ? JSON.parse(sessionData) : null;
        const _sc = _rawS && _rawS.user && _rawS.user.user_metadata && _rawS.user.user_metadata.escala_config;
        if (_sc && _sc.data) salvo = _sc;
      } catch(_e2) {}
      if (!salvo || !salvo.data) return null;
    } else if (!salvo.aeroporto) {
      try {
        const _rawS2 = sessionData ? JSON.parse(sessionData) : null;
        const _sc2 = _rawS2 && _rawS2.user && _rawS2.user.user_metadata && _rawS2.user.user_metadata.escala_config;
        if (_sc2 && _sc2.aeroporto) salvo = Object.assign({}, salvo, {aeroporto: _sc2.aeroporto});
      } catch(_e3) {}
    }
    return salvo;
  }

  const escGIG = {tipo:'14x14',diasEmbarcado:14,diasFolga:14,data:'2026-10-01',tipoRef:'embarquei',aeroporto:'GIG'};
  const escNoAir = {tipo:'14x14',diasEmbarcado:14,diasFolga:14,data:'2026-10-01',tipoRef:'embarquei'};
  const sessGIG = JSON.stringify({user:{user_metadata:{escala_config:escGIG}}});

  test("sem local + sessão com aeroporto → usa sessão", () => {
    const r = resolveHeroSalvo(null, sessGIG);
    eq(r !== null, true);
    eq(r.aeroporto, 'GIG');
  });
  test("sem local + sem sessão → null (sem widget)", () => {
    eq(resolveHeroSalvo(null, null), null);
  });
  test("local sem aeroporto + sessão com aeroporto → suplementa", () => {
    const r = resolveHeroSalvo(JSON.stringify(escNoAir), sessGIG);
    eq(r.aeroporto, 'GIG');
    eq(r.tipo, '14x14'); // local config preserved
  });
  test("local COM aeroporto → sessão NÃO sobrescreve", () => {
    const escSDU = Object.assign({}, escGIG, {aeroporto: 'SDU'});
    const r = resolveHeroSalvo(JSON.stringify(escSDU), sessGIG); // session has GIG
    eq(r.aeroporto, 'SDU'); // local SDU wins
  });
  test("sessão sem data → não usa sessão como fallback", () => {
    const sessNoData = JSON.stringify({user:{user_metadata:{escala_config:{tipo:'14x14'}}}});
    eq(resolveHeroSalvo(null, sessNoData), null);
  });
}

// ═══════════════════════════════════════════════════════════════
// Aeroporto sync — carregarEscalaDaConta migration (Fix 2)
// ═══════════════════════════════════════════════════════════════
console.log("\n[SYNC] carregarEscalaDaConta aeroporto migration");
{
  function escalasSaoDiferentes(a, b) { return a.tipo !== b.tipo; }

  function carregarComMigration(c, local, backfillFn) {
    if (!local || !escalasSaoDiferentes(local, c)) {
      const _cw = (!c.aeroporto && local && local.aeroporto)
        ? Object.assign({}, c, {aeroporto: local.aeroporto})
        : c;
      if (_cw !== c) backfillFn(_cw);
      return {written: _cw, conflict: false};
    }
    return {written: null, conflict: true};
  }

  const cloud = {tipo:'14x14',diasEmbarcado:14,diasFolga:14,data:'2026-10-01',tipoRef:'embarquei'};
  const localGIG = Object.assign({}, cloud, {aeroporto: 'GIG'});
  let backfilled = null;

  test("cloud sem aeroporto + local com GIG → merge preserva GIG", () => {
    backfilled = null;
    const r = carregarComMigration(cloud, localGIG, (v) => { backfilled = v; });
    eq(r.written.aeroporto, 'GIG');
    eq(r.conflict, false);
  });
  test("cloud sem aeroporto + local com GIG → backfill cloud chamado", () => {
    eq(backfilled !== null, true);
    eq(backfilled.aeroporto, 'GIG');
  });
  test("cloud COM aeroporto → não dispara backfill", () => {
    backfilled = null;
    const cloudGIG = Object.assign({}, cloud, {aeroporto: 'GIG'});
    carregarComMigration(cloudGIG, localGIG, (v) => { backfilled = v; });
    eq(backfilled, null);
  });
  test("sem local → backfill não dispara (nada para migrar)", () => {
    backfilled = null;
    carregarComMigration(cloud, null, (v) => { backfilled = v; });
    eq(backfilled, null);
  });
}

// ═══════════════════════════════════════════════════════════════
// RESULT
// ═══════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(60));
console.log(`LOGIC TESTS: ${passed}/${total} passed, ${failed} failed`);
console.log("═".repeat(60));
process.exit(failed > 0 ? 1 : 0);
