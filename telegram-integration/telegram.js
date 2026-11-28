/* =========================================================================
   OWNews | Radar Offshore — integração Telegram (PREPARAÇÃO, NÃO ATIVA)
   =========================================================================

   Este arquivo NÃO está importado por nenhum Worker em produção. Ele existe
   só como referência de arquitetura para quando o canal for criado de
   verdade. Nada aqui roda automaticamente. Ver ARQUITETURA.md nesta mesma
   pasta para o desenho completo do pipeline, o modelo de deduplicação e a
   especificação de frequência — este arquivo só cobre formatação e envio.

   O QUE FALTA PARA ATIVAR (fornecer depois, nunca inventar):
   1. BOT_TOKEN do Telegram — criado via @BotFather no Telegram, formato
      "123456789:ABC-..." Vira o secret TELEGRAM_BOT_TOKEN no Worker que for
      publicar (via `wrangler secret put TELEGRAM_BOT_TOKEN`).
   2. CHAT_ID do canal "OWNews | Radar Offshore" — só existe depois que o
      canal for criado de verdade no Telegram e o bot for adicionado como
      administrador dele. Vira o secret TELEGRAM_CHAT_ID.
   3. Decisão de onde isso roda: hoje o candidato natural é o mesmo Worker
      coletor (shrill-pond-a915), reaproveitando o cron já existente — mas
      isso é uma decisão a tomar quando for ativar, não agora.
   4. Tabela de deduplicação (ver ARQUITETURA.md) — hoje não existe, não foi
      criada nenhuma migration.

   Enquanto os secrets não existirem, enviarMensagemTelegram() e
   enviarAlertaAdmin() abaixo lançam erro imediatamente (fail-safe: nunca
   tentam enviar sem credencial real, nunca usam um token/chat_id de
   exemplo).
========================================================================= */

/* ---------- formatadores de mensagem (puros, sem I/O) ----------
   Formato deliberadamente curto — nada de texto longo. Cada formatador
   corresponde a 1 dos 3 templates especificados em ARQUITETURA.md. */

function formatarMensagemNoticia(item) {
  // item: { categoria, titulo, resumo, url }
  return (
    "OWNEWS | " + item.categoria.toUpperCase() + "\n\n" +
    item.titulo + "\n\n" +
    item.resumo + "\n\n" +
    "Leia no OWNews →\n" + item.url
  );
}

function formatarMensagemCarreiras(item) {
  // item: { titulo, contexto, url }
  return (
    "CARREIRAS OWNEWS\n\n" +
    item.titulo + "\n\n" +
    item.contexto + "\n\n" +
    "Acessar →\n" + item.url
  );
}

function formatarMensagemVagaVerificada(vaga) {
  // vaga: { empresa, funcao, local? (só quando confirmado), url }
  // url deve ser sempre uma página interna do OWNews (ex.: /vagas) — o
  // usuário só chega ao portal oficial da empresa a partir de lá, nunca
  // direto pelo Telegram.
  return (
    "VAGA VERIFICADA OWNEWS\n\n" +
    vaga.empresa + "\n" +
    vaga.funcao +
    (vaga.local ? "\n" + vaga.local : "") + "\n\n" +
    "Ver detalhes →\n" + vaga.url
  );
}

function formatarMensagemOffshoreWorks(item) {
  // Uso deliberadamente raro — o canal é editorial, não catálogo. Sujeito
  // ao limite de 1 mensagem comercial a cada 5–10 mensagens de conteúdo
  // (ver ARQUITETURA.md, seção de frequência).
  // item: { titulo, url }
  return (
    "OFFSHOREWORKS\n\n" +
    item.titulo + "\n\n" +
    "Ver →\n" + item.url
  );
}

/* ---------- envio (I/O real — só roda se os secrets existirem) ---------- */

async function enviarMensagemTelegram(texto, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    throw new Error(
      "Telegram não configurado: faltam TELEGRAM_BOT_TOKEN e/ou TELEGRAM_CHAT_ID. " +
      "Nenhuma mensagem foi enviada."
    );
  }

  const url = "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage";

  const resposta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: texto,
      disable_web_page_preview: false
    })
  });

  if (!resposta.ok) {
    throw new Error("Telegram respondeu HTTP " + resposta.status);
  }

  return resposta.json();
}

/* ---------- regra de mix editorial (documentada, não aplicada ainda) ----------
   Conceito editorial combinado com o usuário: aproximadamente 80–90% do
   conteúdo do canal público deve ser informação (notícias, carreiras, vagas
   verificadas) e só 10–20% conteúdo comercial da OffshoreWorks — ou seja,
   no máximo 1 mensagem comercial a cada 5–10 mensagens de conteúdo. Isso
   deve ser aplicado no ponto que decide O QUE enviar (fora deste arquivo,
   ver ARQUITETURA.md), não aqui — este arquivo só formata e envia.
========================================================================= */

/* =========================================================================
   ALERTAS PRIVADOS DE ADMINISTRAÇÃO (preparação separada, não ativa)
   =========================================================================
   Bot/chat DIFERENTE do canal público "OWNews | Radar Offshore" — este é
   um chat privado só para quem administra o OWNews receber avisos de
   deploy (sucesso/falha). Usa secrets PRÓPRIOS, nunca os mesmos do canal
   público, pra um vazamento de um não expor o outro:
     - TELEGRAM_ADMIN_BOT_TOKEN
     - TELEGRAM_ADMIN_CHAT_ID
   Igual ao canal público: sem token/chat_id inventado, sem bot criado em
   nome de ninguém aqui, sem ativação nesta etapa. enviarAlertaAdmin()
   também falha explicitamente (nunca envia) enquanto os secrets não
   existirem. Nenhum desses valores pode aparecer em Git, frontend, HTML/JS
   público, logs ou relatório — só como secret do Worker que vier a usar
   isso (via `wrangler secret put`). */

function formatarAlertaDeploySucesso(versao) {
  return (
    "OWNEWS — ATUALIZAÇÃO CONCLUÍDA\n\n" +
    "Versão publicada\n" +
    "Testes concluídos\n" +
    "Produção validada\n\n" +
    "Versão: " + versao
  );
}

function formatarAlertaDeployFalha(motivo) {
  return (
    "OWNEWS — PUBLICAÇÃO INTERROMPIDA\n\n" +
    "Teste crítico falhou" + (motivo ? (": " + motivo) : ".") + "\n" +
    "Produção anterior preservada."
  );
}

async function enviarAlertaAdmin(texto, env) {
  if (!env.TELEGRAM_ADMIN_BOT_TOKEN || !env.TELEGRAM_ADMIN_CHAT_ID) {
    throw new Error(
      "Alerta admin não configurado: faltam TELEGRAM_ADMIN_BOT_TOKEN e/ou " +
      "TELEGRAM_ADMIN_CHAT_ID. Nenhum alerta foi enviado."
    );
  }

  const url = "https://api.telegram.org/bot" + env.TELEGRAM_ADMIN_BOT_TOKEN + "/sendMessage";

  const resposta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_ADMIN_CHAT_ID,
      text: texto
    })
  });

  if (!resposta.ok) {
    throw new Error("Telegram (admin) respondeu HTTP " + resposta.status);
  }

  return resposta.json();
}

export {
  formatarMensagemNoticia,
  formatarMensagemCarreiras,
  formatarMensagemVagaVerificada,
  formatarMensagemOffshoreWorks,
  enviarMensagemTelegram,
  formatarAlertaDeploySucesso,
  formatarAlertaDeployFalha,
  enviarAlertaAdmin
};
