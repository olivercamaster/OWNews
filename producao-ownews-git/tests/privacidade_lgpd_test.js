// Privacidade/LGPD (05/11/2026): a política descreve o que o site faz de fato — inclusive o e-mail da
// newsletter — e não inventa DPO, CNPJ, endereço ou e-mail. Uso: node tests/privacidade_lgpd_test.js
const fs = require("fs"), path = require("path");
const W = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");
const pag = W.slice(W.indexOf("function renderPrivacidade("), W.indexOf("function renderPrivacidade(") + 12000).replace(/^\s*\/\/.*$/gm, ""); // só o texto, sem comentários
let ok = 0, f = 0;
const t = (n, c) => { if (c) { ok++; console.log("  ✓ " + n); } else { f++; console.log("  ✗ " + n); } };
t("seção LGPD presente", pag.includes('id="lgpd"') && pag.includes("Lei 13.709/2018"));
t("newsletter declarada (o formulário guarda e-mail)", /newsletter[\s\S]{0,200}consentimento/.test(pag) && pag.includes("/newsletter/cancelar"));
t("direitos do art. 18 e ANPD", pag.includes("art. 18") && pag.includes("ANPD"));
t("exclusão self-service da Conta OW", pag.includes("/excluir-conta"));
t("nada inventado: sem DPO/encarregado, CNPJ ou e-mail de contato", !/\bDPO\b|[Ee]ncarregad|CNPJ|@ownews\.com\.br|@offshoreworks\.com\.br/.test(pag));
t("anúncios: política diz que nenhum está ativo e será atualizada antes", /Nenhum anúncio está ativo hoje/.test(pag));
t("formulário da newsletter continua existindo (senão a política está desatualizada)", W.includes('"/api/newsletter/subscribe"'));
console.log(`\n${ok} passaram, ${f} falharam`); process.exit(f ? 1 : 0);
