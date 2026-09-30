#!/usr/bin/env python3
"""
OWNews Collector Production Guard
Testa shrill-pond-a915-fix/worker.js — sem infraestrutura adicional, sem rede obrigatória.

Uso:
  python3 tests/collector_guard.py              # tudo
  python3 tests/collector_guard.py --static     # syntax + funções críticas
  python3 tests/collector_guard.py --logic      # unit tests (node)
  python3 tests/collector_guard.py --smoke      # HTTP para o worker em produção
  python3 tests/collector_guard.py --pre-deploy # static + logic (offline)
"""

import subprocess, sys, re, json, time
from pathlib import Path

ROOT = Path(__file__).parent.parent
COLLECTOR_JS = ROOT / "worker.js"
TESTS_DIR = Path(__file__).parent

COLLECTOR_URL = "https://shrill-pond-a915.olivercamaster.workers.dev"

# ── Runner ────────────────────────────────────────────────────────────────────

passed = failed = 0
current_suite = ""

def suite(name):
    global current_suite
    current_suite = name
    print(f"\n[{name}]")

def test(label, fn):
    global passed, failed
    try:
        fn()
        print(f"  ✓ {label}")
        passed += 1
    except AssertionError as e:
        print(f"  ✗ {label}")
        print(f"    {e}")
        failed += 1

def expect(cond, msg=""):
    if not cond:
        raise AssertionError(msg)

def expect_in(needle, haystack, ctx=""):
    if needle not in haystack:
        raise AssertionError(f"'{needle[:60]}' not found in {ctx or 'response'}")

def expect_not_in(needle, haystack, ctx=""):
    if needle in haystack:
        raise AssertionError(f"'{needle[:60]}' found (should be absent) in {ctx or 'response'}")


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def get(path, timeout=20):
    import urllib.request, urllib.error
    url = COLLECTOR_URL + path
    req = urllib.request.Request(url, headers={"User-Agent": "OWNews-ProductionGuard/2.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except Exception as e:
        raise AssertionError(f"Request failed: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# LAYER 1: STATIC
# ══════════════════════════════════════════════════════════════════════════════

def run_static():
    suite("STATIC — worker.js syntax")

    test("worker.js exists", lambda: expect(COLLECTOR_JS.exists(), "worker.js not found"))
    test("worker.js not empty", lambda: expect(COLLECTOR_JS.stat().st_size > 10000))
    test("node --check passes", _check_syntax)
    test("worker.js within Cloudflare limit (< 2MB)",
         lambda: expect(COLLECTOR_JS.stat().st_size < 2_000_000,
                        f"collector worker.js too large: {COLLECTOR_JS.stat().st_size:,} bytes"))

    suite("STATIC — critical functions present")

    test("interpretarMetar present", lambda: _check_fn("interpretarMetar"))
    test("similaridadeTitulos present", lambda: _check_fn("similaridadeTitulos"))
    test("detectarIdiomaEN present", lambda: _check_fn("detectarIdiomaEN"))
    test("classificarRiscoEditorial present", lambda: _check_fn("classificarRiscoEditorial"))
    test("classificarFrescorOffVoos present", lambda: _check_fn("classificarFrescorOffVoos"))
    test("extrairIcaoEStatus present", lambda: _check_fn("extrairIcaoEStatus"))
    test("classificarCondicaoMeteo present", lambda: _check_fn("classificarCondicaoMeteo"))
    test("formatarBoletimAeroportos present", lambda: _check_fn("formatarBoletimAeroportos"))
    test("avaliarAeroportosMeteo present", lambda: _check_fn("avaliarAeroportosMeteo"))
    test("coletarANP present", lambda: _check_fn("coletarANP"))
    test("coletarPetrobras present", lambda: _check_fn("coletarPetrobras"))
    test("executarAtualizacaoPrincipal present", lambda: _check_fn("executarAtualizacaoPrincipal"))
    test("traduzirTituloParaPT present", lambda: _check_fn("traduzirTituloParaPT"))
    test("classificarSaudeFontes present", lambda: _check_fn("classificarSaudeFontes"))

    suite("STATIC — security: no secrets in source")

    test("no Telegram bot token in source", _check_no_telegram_token)
    test("no Supabase service_role in source", _check_no_service_role)
    test("FONTES_REGISTRY has expected sources", _check_fontes_registry)
    test("LIMIAR_SIMILARIDADE_DUPLICATA = 0.55", _check_dedupe_limiar)

    suite("STATIC — isolation: each source failure is independent")

    test("executarAtualizacaoPrincipal isolates each source (try/catch per source)", _check_isolation_principal)
    test("executarTeste catches errors and returns JSON (not 500 crash)", _check_executar_teste)


def _check_syntax():
    r = subprocess.run(["node", "--check", str(COLLECTOR_JS)],
                       capture_output=True, text=True, timeout=30)
    expect(r.returncode == 0, f"node --check failed:\n{r.stderr[:300]}")


def _check_fn(name):
    c = COLLECTOR_JS.read_text(encoding="utf-8")
    expect(f"function {name}" in c or f"async function {name}" in c,
           f"Function {name} not found in collector worker.js")


def _check_no_telegram_token():
    c = COLLECTOR_JS.read_text(encoding="utf-8")
    found = re.search(r'\d{8,10}:[A-Za-z0-9_-]{35,}', c)
    expect(not found, "Telegram bot token found in source — CRITICAL")


def _check_no_service_role():
    c = COLLECTOR_JS.read_text(encoding="utf-8")
    expect("service_role" not in c or "service_role" in c.lower().split("supabaseheaders")[0][:100] is False,
           "Possible service_role key in collector source")
    # More precise: check it's not a JWT value
    expect(not re.search(r'service_role["\s]*:["\s]*ey[A-Za-z0-9_-]{30,}', c),
           "service_role JWT found in collector source")


def _check_fontes_registry():
    c = COLLECTOR_JS.read_text(encoding="utf-8")
    for source in ["anp", "petrobras", "ppsa", "offshore_energy", "transocean", "sbm_offshore"]:
        expect(f'id: "{source}"' in c, f"Source '{source}' not in FONTES_REGISTRY")


def _check_dedupe_limiar():
    c = COLLECTOR_JS.read_text(encoding="utf-8")
    expect("LIMIAR_SIMILARIDADE_DUPLICATA = 0.55" in c,
           "Dedupe threshold changed from 0.55 — verify editorial impact")


def _check_isolation_principal():
    c = COLLECTOR_JS.read_text(encoding="utf-8")
    # executarAtualizacaoPrincipal must have individual try/catch per source
    idx = c.find("async function executarAtualizacaoPrincipal")
    expect(idx >= 0, "executarAtualizacaoPrincipal not found")
    snippet = c[idx:idx+2000]
    # Count individual try/catch blocks (each source gets its own)
    try_count = snippet.count("try {")
    expect(try_count >= 3,
           f"executarAtualizacaoPrincipal has only {try_count} try/catch blocks — expect ≥3 (one per source)")


def _check_executar_teste():
    c = COLLECTOR_JS.read_text(encoding="utf-8")
    idx = c.find("async function executarTeste")
    expect(idx >= 0, "executarTeste not found")
    snippet = c[idx:idx+500]
    expect("try {" in snippet or "try{" in snippet, "executarTeste has no try/catch")
    expect("Response.json" in snippet, "executarTeste does not return Response.json")


# ══════════════════════════════════════════════════════════════════════════════
# LAYER 2: LOGIC (node)
# ══════════════════════════════════════════════════════════════════════════════

def run_logic():
    suite("LOGIC — collector unit tests (node)")

    test("collector_test.js passes (63 deterministic tests)", _run_unit_tests)


def _run_unit_tests():
    js = TESTS_DIR / "collector_test.js"
    expect(js.exists(), "collector_test.js not found")
    r = subprocess.run(["node", str(js)],
                       capture_output=True, text=True, timeout=30,
                       cwd=str(ROOT))
    if r.returncode != 0:
        failed_lines = [l for l in r.stdout.split("\n") if "✗" in l or "FAIL" in l]
        raise AssertionError("Collector tests failed:\n" + "\n".join(failed_lines[:10]))


# ══════════════════════════════════════════════════════════════════════════════
# LAYER 3: SMOKE (HTTP — precisa de internet)
# ══════════════════════════════════════════════════════════════════════════════

def run_smoke():
    suite("SMOKE — collector /saude")

    test("GET /saude → 200", lambda: _check_saude_status())
    test("/saude has ok:true", lambda: _check_saude_ok())
    test("/saude has fontes array", lambda: _check_saude_fontes())
    test("/saude has telegram field", lambda: _check_saude_telegram())
    test("/saude has aeroportos_meteo", lambda: _check_saude_aeroportos())

    suite("SMOKE — collector routes (not destructive)")

    test("GET /aeroportos → 200 or structured error", lambda: _check_route_not_500("/aeroportos"))
    test("GET /mercado → 200 or structured error", lambda: _check_route_not_500("/mercado"))
    test("GET /offvoos → 200 or structured error", lambda: _check_route_not_500("/offvoos"))
    test("no 500 on /saude", lambda: _check_no_500("/saude"))
    test("no 500 on /aeroportos", lambda: _check_no_500("/aeroportos"))
    test("no 500 on /mercado", lambda: _check_no_500("/mercado"))

    suite("SMOKE — security: no secrets in rendered responses")

    test("/saude does not expose Telegram token", _check_saude_no_token)
    test("/saude does not expose service_role", _check_saude_no_service_role)


def _check_saude_status():
    status, _ = get("/saude")
    expect(status == 200, f"/saude returned {status}")


def _check_saude_ok():
    status, body = get("/saude")
    expect(status == 200, f"/saude returned {status}")
    try:
        data = json.loads(body)
        expect(data.get("ok") is True, f"/saude ok!=true: {body[:200]}")
    except json.JSONDecodeError:
        raise AssertionError(f"/saude returned non-JSON: {body[:200]}")


def _check_saude_fontes():
    _, body = get("/saude")
    data = json.loads(body)
    fontes = data.get("fontes")
    expect(isinstance(fontes, list), f"/saude missing fontes array: {list(data.keys())}")
    expect(len(fontes) > 0, "/saude fontes array is empty")


def _check_saude_telegram():
    _, body = get("/saude")
    data = json.loads(body)
    expect("telegram" in data, f"/saude missing telegram field: {list(data.keys())}")


def _check_saude_aeroportos():
    _, body = get("/saude")
    data = json.loads(body)
    expect("aeroportos_meteo" in data, f"/saude missing aeroportos_meteo: {list(data.keys())}")


def _check_route_not_500(path):
    status, body = get(path)
    expect(status != 500, f"{path} returned 500: {body[:200]}")


def _check_no_500(path):
    status, _ = get(path)
    expect(status != 500, f"{path} returned HTTP 500")


def _check_saude_no_token():
    _, body = get("/saude")
    found = re.search(r'\d{8,10}:[A-Za-z0-9_-]{35,}', body)
    expect(not found, "/saude exposes Telegram bot token — CRITICAL")


def _check_saude_no_service_role():
    _, body = get("/saude")
    expect(not re.search(r'service_role["\s]*:["\s]*ey[A-Za-z0-9_-]{30,}', body),
           "/saude exposes service_role JWT — CRITICAL")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("OWNews Collector Production Guard")
    print("=" * 60)

    args = sys.argv[1:]
    run_all = not args
    run_st = run_all or "--static" in args or "--pre-deploy" in args
    run_lo = run_all or "--logic" in args or "--pre-deploy" in args
    run_sm = run_all or "--smoke" in args

    if run_st:
        run_static()
    if run_lo:
        run_logic()
    if run_sm:
        run_smoke()

    total = passed + failed

    print("\n" + "=" * 60)
    print("COLLECTOR GUARD REPORT")
    print("=" * 60)

    # Group results by suite (reprint summary)
    status_char = "✓ ALL PASS" if failed == 0 else f"✗ {failed} FAILED"
    print(f"\n{'─'*60}")
    print(f"TOTAL: {passed}/{total} passed — {status_char}")
    print("=" * 60)

    if failed:
        sys.exit(1)
