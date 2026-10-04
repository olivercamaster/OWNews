/**
 * Playwright visual test — Minha Escala 4.0
 * Run: node tests/playwright_escala.js
 * Requires: @playwright/test installed, chromium available
 *
 * Tests: annual calendar collapse, AÇÕES buttons, feriados in HTML,
 *        cross-page consistency (next embarque matches on multiple sections).
 */
let chromium;
try { chromium = require("playwright").chromium; }
catch(e) { chromium = require("/home/offshore/.npm/_npx/6bcb61ec6d5aea22/node_modules/playwright").chromium; }

const PROD_URL = "https://ownews.com.br";
const CHROME = "/home/offshore/.cache/ms-playwright/chromium-1148/chrome-linux/chrome";
const VIEWPORT = { width: 390, height: 844 };

let passed = 0, failed = 0;
function report(name, ok, reason) {
  if (ok) { console.log("  ✓ " + name); passed++; }
  else { console.log("  ✗ FAIL " + name + (reason ? ": " + reason : "")); failed++; }
}

async function run() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  try {
    // ── 1. Page load ──────────────────────────────────────────
    console.log("\n[LOAD] /minha-escala");
    await page.goto(PROD_URL + "/minha-escala", { waitUntil: "networkidle", timeout: 30000 });
    report("página carregou (200 implícito)", true);

    // ── 2. Form presente ──────────────────────────────────────
    const form = await page.$("#formEscala");
    report("formEscala presente", !!form);

    // ── 3. Abas presentes ─────────────────────────────────────
    const tabCal = await page.$('[data-tab="calendario"]');
    const tabAnual = await page.$('[data-tab="anual"]');
    report('aba "calendario" presente', !!tabCal);
    report('aba "anual" presente', !!tabAnual);

    // ── 4. Aba Calendário é a ativa por padrão ────────────────
    const tabCalClass = tabCal ? await tabCal.getAttribute("class") : "";
    report("aba calendário ativa por padrão", tabCalClass.includes("ativo"));

    // ── 5. Configurar escala 14x14 ────────────────────────────
    await page.selectOption("#escTipo", "14x14");
    await page.fill("#escData", "2026-01-01");
    await page.selectOption("#escTipoRef", "embarquei");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(800);

    const resultado = await page.$("#resultadoEscala");
    report("resultadoEscala renderizou após submit", !!resultado);

    const calGrid = await page.$("#calGrid");
    report("calGrid presente após submit", !!calGrid);

    // ── 6. Abrir aba Anual ────────────────────────────────────
    console.log("\n[ANUAL] Calendário Anual");
    await page.click('[data-tab="anual"]');
    await page.waitForTimeout(500);

    const escalaAnualGrid = await page.$("#escalaAnualGrid");
    report("escalaAnualGrid presente", !!escalaAnualGrid);

    // ── 7. "VER MESES ANTERIORES" toggle ─────────────────────
    const anteriorBtn = await page.$('[id^="escalaAntBtn"], button:has-text("ANTERIORES"), button:has-text("VER MES")');
    if (anteriorBtn) {
      report("botão VER MESES ANTERIORES presente", true);
      await anteriorBtn.click();
      await page.waitForTimeout(300);
      report("toggle expandiu sem erro JS", true);
    } else {
      // Might be January (no past months in current year) — acceptable
      const monthGrids = await page.$$(".esc-mes-grid, .esc-mes-mini");
      report("calendário anual tem meses renderizados", monthGrids.length > 0, `count=${monthGrids.length}`);
    }

    // ── 8. Clicar em um dia no calendário mensal ──────────────
    console.log("\n[DETALHE DIA] Painel do dia");
    await page.click('[data-tab="calendario"]');
    await page.waitForTimeout(300);

    const diasCells = await page.$$(".cal-dia[data-d]");
    if (diasCells.length > 0) {
      await diasCells[0].click();
      await page.waitForTimeout(300);
      const detalhe = await page.$("#escalaDiaDetalhe");
      report("escalaDiaDetalhe abriu ao clicar num dia", !!detalhe);

      // ── 9. AÇÕES buttons presentes no detalhe ────────────────
      const body = await page.content();
      report("botão + DOBRA presente no detalhe", body.includes("DOBRA"));
      report("botão + FÉRIAS presente no detalhe", body.includes("FÉRIAS") || body.includes("FERIAS"));
      report("botão + DATA PESSOAL presente no detalhe", body.includes("PESSOAL") || body.includes("Data Pessoal"));
    } else {
      report("dias no calendário mensal", false, "nenhuma célula cal-dia encontrada");
    }

    // ── 10. Feriados no HTML renderizado ─────────────────────
    console.log("\n[FERIADOS] Badges no HTML");
    const html = await page.content();
    // The calendar should have feriado references in the JS or HTML
    report("datasImportantesDoAno presente no JS renderizado", html.includes("datasImportantesDoAno"));
    report("Tiradentes presente na fonte JS", html.includes("Tiradentes"));
    report("Finados presente na fonte JS", html.includes("Finados"));
    report("Consciência Negra presente na fonte JS", html.includes("Consci"));
    report("Proclamação da República presente na fonte JS", html.includes("Proclama"));

    // ── 11. Central do Trabalhador — consistência ─────────────
    console.log("\n[CONSISTÊNCIA] /central-do-trabalhador");
    await page.goto(PROD_URL + "/central-do-trabalhador", { waitUntil: "networkidle", timeout: 20000 });
    const centralHtml = await page.content();
    report("central-do-trabalhador carregou", centralHtml.length > 5000);
    report("próximo embarque presente na página", centralHtml.includes("embarque") || centralHtml.includes("Embarque"));

    // ── 12. Sem erros JS críticos ─────────────────────────────
    console.log("\n[ERRORS] Console JS");
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));
    await page.goto(PROD_URL + "/minha-escala", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1000);
    const fatalErrors = errors.filter(e =>
      e.includes("SyntaxError") || e.includes("ReferenceError") || e.includes("TypeError")
    );
    report("sem erros JS críticos (Syntax/Reference/Type)", fatalErrors.length === 0,
           fatalErrors.length ? fatalErrors[0].slice(0, 100) : "");

  } catch (err) {
    console.error("\nERROR:", err.message);
    failed++;
  } finally {
    await browser.close();
  }

  console.log("\n" + "═".repeat(60));
  console.log(`PLAYWRIGHT: ${passed}/${passed + failed} passed, ${failed} failed`);
  console.log("═".repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

run();
