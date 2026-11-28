# Telegram — arquitetura da automação futura (preparação, não ativa)

Este documento descreve a implementação **futura** do canal público
`OWNews | Radar Offshore` no Telegram. Nada aqui está ativo. Nenhuma
credencial foi criada, solicitada ou exposta nesta rodada. Ver também
`telegram.js` (formatadores de mensagem e funções de envio, também
inativas) e `WHATSAPP.md` (compartilhamento, sem automação).

## Pipeline

```
ARTIGO PUBLICADO
   ↓
VERIFICAÇÃO DE ELEGIBILIDADE
   ↓
DEDUPLICAÇÃO
   ↓
GERAÇÃO DA MENSAGEM
   ↓
TELEGRAM BOT API
   ↓
CANAL "OWNEWS | RADAR OFFSHORE"
```

A automação usa **exclusivamente** a API oficial do Telegram Bot
(`https://api.telegram.org/bot<TOKEN>/sendMessage`), como já implementado
(mas não ativado) em `enviarMensagemTelegram()` e `enviarAlertaAdmin()` em
`telegram.js`.

### 1. Artigo publicado
Gatilho: um artigo passa a existir com `status = published` na tabela
`articles` do Supabase (já existente, não alterada por esta preparação).

### 2. Verificação de elegibilidade
Critérios futuros para um item (notícia, conteúdo de carreiras ou vaga
verificada) ser candidato a publicação no canal:
- estar publicado (não rascunho, não removido);
- possuir URL pública válida no OWNews (`https://ownews.com.br/...`);
- se for notícia: passar pelos critérios de seleção editorial (ver seção
  "Frequência e seleção" abaixo) — nem toda notícia publicada vira post;
- se for vaga: ser uma vaga já classificada como "verificada" pelos
  critérios já em uso em `/vagas` (não uma vaga qualquer).

### 3. Deduplicação
Antes de enviar, o sistema futuro precisa checar se aquele item **já foi
enviado**. Modelo de dados proposto (não criado — nenhuma tabela existe
hoje, nenhuma migration foi executada):

| campo               | tipo      | descrição                                          |
|----------------------|-----------|-----------------------------------------------------|
| `article_id`          | text/uuid | id do artigo/vaga na fonte original                 |
| `canonical_url`        | text      | URL pública do OWNews que a mensagem aponta          |
| `telegram_message_id`   | text      | id retornado pela API do Telegram após o envio        |
| `sent_at`              | timestamp | quando foi enviado                                    |
| `status`               | text      | `sent` / `failed` / `skipped`                         |

Regra: nunca reenviar o mesmo `article_id` nem a mesma `canonical_url`.
Um envio que falhar (`status = failed`) pode ser reprocessado; um que já
teve `status = sent` nunca é reenviado.

### 4. Geração da mensagem
Usa os formatadores puros de `telegram.js` (`formatarMensagemNoticia`,
`formatarMensagemCarreiras`, `formatarMensagemVagaVerificada`,
`formatarMensagemOffshoreWorks`) — ver templates completos na seção
abaixo. Nenhum desses formatadores faz I/O; só recebem dados já prontos e
devolvem o texto da mensagem.

### 5. Telegram Bot API
`enviarMensagemTelegram(texto, env)` — já implementado em `telegram.js`,
falha explicitamente (nunca envia) se `env.TELEGRAM_BOT_TOKEN` ou
`env.TELEGRAM_CHAT_ID` não existirem.

**Regra crítica:** falha no envio ao Telegram **nunca** pode afetar a
publicação do artigo no site — o envio ao Telegram é sempre um passo
posterior e independente da publicação em si (o site já publica hoje sem
nenhuma dependência do Telegram; isso deve continuar assim quando a
automação existir).

### 6. Canal público
`OWNews | Radar Offshore` — ainda não existe. Alguém do
OWNews/OffshoreWorks precisa criá-lo de verdade no Telegram e adicionar o
bot como administrador antes de qualquer `CHAT_ID` poder ser obtido.

## Templates de mensagem

Formato deliberadamente curto — nunca texto longo, nunca parágrafos.

**Notícia:**
```
OWNEWS | [CATEGORIA]

[TÍTULO]

[RESUMO MUITO CURTO]

Leia no OWNews →
[URL]
```

**Carreiras (conteúdo editorial sobre carreira, não uma vaga específica):**
```
CARREIRAS OWNEWS

[TÍTULO]

[CONTEXTO CURTO]

Acessar →
[URL]
```

**Vaga verificada (futura, depende de `/vagas` estar madura):**
```
VAGA VERIFICADA OWNEWS

[EMPRESA]
[FUNÇÃO]
[LOCAL quando confirmado]

Ver detalhes →
[URL INTERNA OWNEWS]
```
Importante: a URL sempre aponta para uma página interna do OWNews — o
usuário só chega ao portal oficial de recrutamento da empresa a partir de
lá, nunca direto pelo link do Telegram. Mesma regra já aplicada em
`/carreiras/cadastre-seu-curriculo`.

## Frequência e seleção

Não queremos publicar automaticamente cada conteúdo publicado no site —
isso tornaria o canal ruidoso. Critérios futuros de seleção (a implementar
quando o canal existir; nada disso está ativo):
- notícia realmente relevante (critério editorial, não "toda notícia");
- breaking/alerta confirmado;
- conteúdo de carreiras;
- vaga verificada;
- conteúdo OWNews de alto valor (guias, Comece Aqui, etc.).

Mix editorial: aproximadamente 80–90% informação, 10–20% comercial
(OffshoreWorks) — no máximo 1 mensagem comercial a cada 5–10 mensagens de
conteúdo. Um limite de posts por janela de tempo (ex.: no máximo N por
hora) é recomendado para evitar spam, mas o valor de N não foi definido
nesta rodada — fica como decisão para quando a automação for ativada, não
um número arbitrário inventado agora.

## Segredos

`TELEGRAM_BOT_TOKEN` e o identificador do canal (`TELEGRAM_CHAT_ID`) devem
existir **somente** como secrets protegidos no Worker autorizado a enviar
(via `wrangler secret put`). Nunca em:
- frontend;
- HTML;
- JavaScript público;
- GitHub / arquivo versionado;
- logs;
- screenshots;
- este relatório.

Nenhum valor fictício parecido com uma credencial real foi criado nesta
preparação.

## Alertas privados de administração (separado do canal público)

Preparado em `telegram.js` (`formatarAlertaDeploySucesso`,
`formatarAlertaDeployFalha`, `enviarAlertaAdmin`) — usa secrets
**próprios** (`TELEGRAM_ADMIN_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`),
isolados dos secrets do canal público, para que o vazamento de um não
exponha o outro. Mensagens:

```
OWNEWS — ATUALIZAÇÃO CONCLUÍDA

Versão publicada
Testes concluídos
Produção validada
```

```
OWNEWS — PUBLICAÇÃO INTERROMPIDA

Teste crítico falhou
Produção anterior preservada
```

## O que falta para ativar (lista completa)

1. Criar o canal `OWNews | Radar Offshore` de verdade no Telegram.
2. Criar o bot via @BotFather e adicioná-lo como administrador do canal.
3. Obter `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` reais e configurá-los
   como secrets do Worker escolhido para publicar (`wrangler secret put`).
4. Decidir e implementar onde o pipeline roda (candidato natural: Worker
   coletor `shrill-pond-a915`, reaproveitando o cron já existente).
5. Criar a tabela/migration de deduplicação descrita acima (não existe
   hoje).
6. Implementar a lógica de elegibilidade/seleção editorial (hoje só
   documentada, não codificada).
7. Definir o limite numérico de posts por janela de tempo.
8. Repetir o mesmo processo para os secrets de alerta privado
   (`TELEGRAM_ADMIN_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`) quando desejado.

Nenhum destes 8 itens foi executado nesta rodada — todos permanecem como
pendência explícita para uma ativação futura, autorizada separadamente.
