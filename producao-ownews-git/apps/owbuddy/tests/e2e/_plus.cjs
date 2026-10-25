// OWBuddy+ nos E2E: o preview roda com a loja SIMULADA (modo de teste). As suítes de recursos
// (mala, viagem, documentos, histórico…) testam o app COM OWBuddy+; a suíte plus-preview testa
// cada cenário. E2E_PLUS=<cenário> troca o padrão. Grava só se a página ainda não escolheu outro,
// e sobrevive ao localStorage.clear() do seed das suítes (a assinatura fica na "loja", não no aparelho).
module.exports = async function PLUS(ctx, cenario = process.env.E2E_PLUS || 'plus') {
  await ctx.addInitScript(c => {
    const K = 'owbuddy_plus_teste_cenario';
    try {
      if (!localStorage.getItem(K)) localStorage.setItem(K, JSON.stringify(c));
      const limpar = Storage.prototype.clear;
      Storage.prototype.clear = function () {
        const atual = this.getItem(K);
        limpar.call(this);
        try { this.setItem(K, atual || JSON.stringify(c)); } catch (e) {}
      };
    } catch (e) {}
  }, cenario);
};
