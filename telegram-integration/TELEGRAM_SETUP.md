# Telegram | Radar Offshore — status

**Ativado em produção em 2026-09-16.** O código deste módulo está
integrado (copiado inline, mesmo padrão de arquivo único do resto do
projeto) em `shrill-pond-a915-fix/worker.js`, rodando após cada execução
do cron do collector. `telegramPublisher.js` aqui continua sendo a cópia
canônica/testada (`telegramPublisher.test.mjs`, 55/55 passando) — **mantenha
as duas em sincronia** ao alterar uma.

**Pendência ativa**: a migração (`schema_dedupe.sql`) ainda não foi
aplicada — ninguém nesta sessão tem credencial de owner/admin do Supabase.
Sem a tabela `telegram_posts`, o radar se recusa a enviar qualquer coisa
(fail-safe verificado em produção via `GET /saude`) — não há risco de
duplicata, só não há envio real até a tabela existir. Confirme rodando
`schema_dedupe.sql` no SQL Editor do Supabase (idempotente, seguro rodar
mesmo se já tiver sido parcialmente aplicado).

Corte de ativação: só considera artigos com `published_at` a partir de
`2026-09-16T01:07:16Z` — nenhum backlog histórico (incluindo o artigo
Petrobras/Sempra do teste manual) pode ser enviado por este mecanismo.

## O que o proprietário faz (fora desta sessão, no Telegram)

1. Criar o canal público **"OWNews | Radar Offshore"** no Telegram.
2. Criar um bot via **@BotFather** (`/newbot`), definindo nome e username.
3. Adicionar o bot criado como **administrador** do canal, com permissão
   de publicar mensagens.
4. Obter o **identificador do canal** (`TELEGRAM_CHANNEL_ID`) — para canal
   público costuma ser o `@usernamedocanal`; para privado, o bot precisa
   ver o ID numérico (ex.: encaminhando uma mensagem do canal para
   `@userinfobot` ou equivalente).

## O que entra como secret (nunca em código, nunca em Git, nunca no frontend)

| Nome | O que é |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token gerado pelo BotFather ao criar o bot (formato `123456789:ABC-...`) |
| `TELEGRAM_CHANNEL_ID` | `@usernamedocanal` (público) ou ID numérico do canal (privado) |

Configurar como secret do Worker que for publicar (`wrangler secret put
TELEGRAM_BOT_TOKEN` e `wrangler secret put TELEGRAM_CHANNEL_ID`) —
**nunca colar o valor em uma mensagem de chat**, nunca em `wrangler.jsonc`,
nunca em nenhum arquivo versionado.

## O que já está pronto neste repositório (código, inativo)

- `telegramPublisher.js` — filtro editorial (`avaliarElegibilidade`),
  dedupe em memória (`verificarDuplicidade`), formatação do post
  (`formatarPost`), decisão foto/texto com fallback (`prepararEnvio` +
  `publicar`), limite editorial por execução (`selecionarParaPublicarAgora`)
  e o orquestrador (`processarArtigosParaTelegram`).
- `telegramPublisher.test.mjs` — 19 testes, todos com `fetch` mockado,
  **zero chamada real à API do Telegram**. Rodar com:
  ```
  node telegram-integration/telegramPublisher.test.mjs
  ```
- `schema_dedupe.sql` — proposta de tabela `telegram_posts` no Supabase
  para persistir o que já foi publicado. **Não executado.**
- `.env.example` (nesta pasta) — só os nomes das variáveis, sem valores.

## Modo seguro por padrão: `TELEGRAM_DRY_RUN`

O módulo só publica de verdade se **as duas** condições forem verdadeiras:
1. `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHANNEL_ID` configurados; **e**
2. `env.TELEGRAM_DRY_RUN === "false"` (qualquer outro valor, incluindo
   ausente, mantém o dry-run).

Ou seja: mesmo depois de configurar os secrets, a publicação real exige
uma troca deliberada da variável `TELEGRAM_DRY_RUN` — nunca é ligada por
acidente.

## Ordem recomendada para ativar (cada passo com validação antes do próximo)

1. Fazer os 4 passos do Telegram (canal, bot, admin, ID) — feito pelo
   proprietário, fora desta sessão.
2. Configurar `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHANNEL_ID` como secrets do
   Worker escolhido para publicar (decisão de qual Worker ainda em aberto
   — ver ARQUITETURA.md, seção sobre isso).
3. Decidir e (se necessário) aplicar a migration de `schema_dedupe.sql`
   (autorização separada, específica para isso).
4. Rodar um **teste controlado com `TELEGRAM_DRY_RUN=true`** contra dados
   reais do Supabase — confirma que o filtro/formatador/dedupe fazem
   sentido com notícias de verdade, sem publicar nada.
5. Revisar manualmente uma amostra dos posts que o dry-run geraria.
6. Só depois disso, trocar `TELEGRAM_DRY_RUN` para `"false"` e validar
   com 1 publicação real controlada.
7. Acompanhar as primeiras publicações antes de deixar rodando sem
   supervisão (cron, se/quando decidido).

Nenhuma dessas etapas foi executada nesta rodada.
