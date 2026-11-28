/* =========================================================================
   ownews-www-redirect — Worker dedicado, NÃO o ownews-git.
   Único propósito: 301 de qualquer host/esquema que ele receber para
   https://ownews.com.br, preservando caminho e query string.

   Por que um Worker separado, e não editar o ownews-git:
   instrução explícita desta etapa foi não alterar o Worker ownews-git.
   Este Worker será vinculado (via Custom Domain) só em www.ownews.com.br,
   nunca no domínio apex — não há como formar loop, porque o apex
   (ownews.com.br) continua servido exclusivamente pelo ownews-git.
========================================================================= */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const destino = "https://ownews.com.br" + url.pathname + url.search;
    return Response.redirect(destino, 301);
  }
};
