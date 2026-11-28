# OWNews — continuidade sem VPS

Escrito em 28/11/2026, quando o VPS da Hostinger (srv1975390) foi desativado. Nenhum valor secreto aparece aqui.

## Arquitetura (sem servidor próprio)

| Peça | Onde roda | Pasta no repositório |
|---|---|---|
| Portal ownews.com.br (Home, notícias, páginas, sitemaps, API do OWBuddy) | Cloudflare Worker `ownews-git` | `producao-ownews-git/` |
| Collector (notícias, IA, barreira de fidelidade, Telegram, Dicas, Mercado, Aeroportos/OffVoos, /saude) | Cloudflare Worker `shrill-pond-a915` (crons próprios + Durable Objects) | `shrill-pond-a915-fix/` |
| Radar Offshore (páginas /radar-offshore) | Cloudflare Worker `ownews-radar` | `ownews-radar/` |
| Radar — ingestão dos dados da ANP | GitHub Actions `radar-ingestao.yml` | `ownews-radar/ingestao/` |
| Instagram — fila, legenda, publicação na Meta | Cloudflare Worker `ownews-instagram-publisher` | `ownews-instagram-publisher/` |
| Instagram — geração da arte (JPEG) | GitHub Actions `instagram-arte.yml` | `ownews-instagram-render-vps/` |
| www → domínio raiz | Cloudflare Worker `ownews-www-redirect` | `ownews-www-redirect/` |
| Banco (artigos, posts do Instagram/Telegram, contas) | Supabase, projeto `awyowuhwkqfyhwgdpepp` | `docs/*.sql` |
| DNS | Cloudflare (zona ownews.com.br) | — |
| App OWBuddy | Expo/EAS (build e assinatura na nuvem da Expo) | `producao-ownews-git/apps/owbuddy/` |

Cloudflare no plano Free (Durable Objects SQLite), Supabase no plano gratuito, GitHub Actions gratuito (repositório público). Workers AI dentro da cota grátis (10k neurons/dia).

## Repositório e branches

- Repositório: `github.com/olivercamaster/OWNews` (**público**: nunca commitar segredo).
- `owbuddy/dev`: **código de produção**. É a partir dela que se faz deploy e que os workflows rodam.
- `main`: os agendamentos (`.github/workflows/`). O restante dela está antigo; os workflows fazem checkout de `owbuddy/dev`.
- `radar-estado`: estado da ingestão do Radar (slugs estáveis das fichas, chaves enviadas, saída). Gravado pelo workflow; não editar à mão.
- `backup/vps-2026-11-28`: o que só existia no VPS: polimento pausado do Radar (`ownews-radar/worker/index|paginas|ui.mjs`, nunca publicado), projetos paralelos, cópia do estado do Radar e backups de matérias.

## Crontab do VPS → substituto

| Linha no VPS | Substituto | Onde | Frequência |
|---|---|---|---|
| `* * * * *` poll-and-render.js (arte do Instagram) | `instagram-arte.yml` | GitHub Actions | a cada 15 min (o job do Worker vale 1 h) |
| `10 10 * * *` radar-cron.sh (ANP completa) | `radar-ingestao.yml` | GitHub Actions | 10:10 UTC (07:10 BRT) |
| `40 1,4,13,16,19,22 * * *` radar-cron.sh --so-noticias | `radar-ingestao.yml` | GitHub Actions | 6x/dia, mesmos horários |

**Quem aciona os workflows:** o agendador do próprio GitHub não disparou nas primeiras horas (28/11; manual funcionava). Por isso o worker `ownews-instagram-publisher` aciona os dois pela API: `instagram-arte.yml` quando cria um job de arte e `radar-ingestao.yml` pelo cron `30 * * * *` nas horas 10 UTC (completo) e 1, 4, 13, 16, 19, 22 UTC (notícias). Precisa do segredo `GITHUB_DISPATCH_TOKEN` no worker (ver tabela). O agendamento do GitHub fica como reserva.

O gov.br recusa conexões de fora do Brasil. No GitHub Actions, o download da ANP passa pelo worker `ownews-radar` (`/interno/baixar`, autenticado com `RADAR_INGEST_SECRET`, só hosts da ANP) via `RADAR_PROXY_URL`.

Crons dos Workers (Cloudflare, já independentes do VPS):
- `shrill-pond-a915`: `20 8,11,14,17,20,22 * * *` e `50 8,11,14,17,20,22 * * *` (mais os alarmes dos Durable Objects, que rodam a cada 30 min).
- `ownews-instagram-publisher`: `0 17,18 * * MON,WED,FRI` (slot das 15h BRT) e `30 * * * *` (breaking e renovação semanal do token).

## Segredos — inventário (só nomes)

| Nome | Onde vive (fora do VPS) | Para quê | Se perder |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Worker `shrill-pond-a915` | gravar artigos | regenerar no painel do Supabase (Settings → API) e regravar no Worker |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID` | Worker `shrill-pond-a915` | canal @ownewsradar | BotFather (`/token`) |
| `REDEMET_API_KEY` | Worker `shrill-pond-a915` | meteorologia dos aeroportos | portal da REDEMET |
| `OWNEWS_ADMIN_TOKEN` | Workers `shrill-pond-a915` e `ownews-git` | rotas /admin e /run-* (cabeçalho `X-OWNews-Token`) | gerar um valor novo e gravar nos dois Workers |
| `CC_PASSWORD`, `CC_SESSION_SECRET` | Worker `ownews-git` | Command Center | gerar novo valor |
| `RESEND_API_KEY` | Worker `ownews-git` | e-mail da newsletter | painel da Resend |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Worker `ownews-git` | notificações push | **não regenerar** sem necessidade (invalida as inscrições); continuam no Worker |
| `RADAR_INGEST_SECRET` | Worker `ownews-radar` **e** GitHub Actions | ingestão do Radar | gerar novo e gravar nos dois lugares |
| `INSTAGRAM_ACCESS_TOKEN` | Worker `ownews-instagram-publisher` | publicar na Meta | **expirado desde 15/11/2026**: gerar novo (ver Instagram) |
| `GITHUB_DISPATCH_TOKEN` | Worker `ownews-instagram-publisher` | acionar os workflows do GitHub (Radar e arte) | token fine-grained do GitHub só do repositório OWNews, permissão **Actions: Read and write**, validade longa; gravar no Worker (painel Cloudflare → Workers → ownews-instagram-publisher → Settings → Variables and Secrets) |
| `RENDER_SHARED_SECRET` | Worker `ownews-instagram-publisher` **e** GitHub Actions | arte do Instagram | gerar novo e gravar nos dois lugares |
| Token da API Cloudflare (`CLOUDFLARE_API_TOKEN`) | só no VPS (`~/.config/ownews/cloudflare.env`) | deploy dos Workers | criar outro em dash.cloudflare.com → My Profile → API Tokens (modelo "Edit Cloudflare Workers") |
| Token do GitHub (`GITHUB_TOKEN`, fine-grained "OWNews-Claude") | só no VPS (`~/.config/ownews/github.env`) | push e API | criar outro em github.com/settings/personal-access-tokens (Contents, Workflows, Actions, Secrets: Read and write). O atual vence em 28/12/2026 |
| `EXPO_TOKEN` | só no VPS (`~/.config/ownews/expo.env`) | build do OWBuddy | criar outro em expo.dev → Access tokens. A assinatura do app é credencial do EAS (nuvem), não está no VPS |

Valores de Worker: `npx wrangler secret list` mostra os nomes. Para regravar: `npx wrangler secret put NOME` na pasta do Worker.
Valores do GitHub Actions: Settings → Secrets and variables → Actions.

## Comandos essenciais

Pré-requisito: Node 22. Na pasta de cada Worker, com `CLOUDFLARE_API_TOKEN` no ambiente:

```bash
npx wrangler deploy                  # publicar
npx wrangler deployments list        # versões (anotar a anterior = rollback)
npx wrangler rollback <version-id>   # voltar
```

Testes (rodar sempre os dois primeiros quando mexer no collector: o portal lê o arquivo do collector):

```bash
cd producao-ownews-git && for t in tests/*.js tests/*.mjs; do node $t || echo FALHA $t; done; python3 tests/production_guard.py
cd shrill-pond-a915-fix && for t in tests/*.js tests/*.mjs; do node $t || echo FALHA $t; done; python3 tests/collector_guard.py
cd ownews-radar && node tests/radar_test.mjs
cd ownews-instagram-publisher && for t in tests/*.mjs; do node $t; done
bash shrill-pond-a915-fix/tests/verificar_estabilidade.sh 24   # saúde de produção (só leitura)
```

Saúde em produção: `https://shrill-pond-a915.olivercamaster.workers.dev/saude` e `https://ownews-instagram-publisher.olivercamaster.workers.dev/saude-fragment`.

Workflows manuais: GitHub → Actions → "Radar — ingestão ANP" (modo completo / so-noticias / seco) ou "Instagram — arte" (opção "teste_arte" desenha sem publicar).

## Regras do projeto (resumo)

- Nunca `git reset --hard`, `git clean`, `git add .`; adicionar arquivos um a um. Commits isolados, rollback anotado.
- Portal: guard de tamanho `worker.js` ≤ 1.760.000 B (não aumentar o limite; remover código morto).
- PT-BR obrigatório; barreira de fidelidade à fonte nunca desligada; nada inventado.
- Zero link/CTA público para o OffVoos (só crédito em texto).
- AdSense (ads.txt, publisher, meta) não se mexe.
- Dicas Offshore: a cada 2 dias, 12h BRT, só do catálogo validado.

## Instagram — como voltar a publicar

1. developers.facebook.com → app do OWNews → Instagram → "Configuração da API com login do Instagram" → Gerar token da conta @ownewsbr (começa com IGAA).
2. Na pasta `ownews-instagram-publisher`: `npx wrangler secret put INSTAGRAM_ACCESS_TOKEN` e colar o token.
3. Pronto: a renovação passa a ser automática a cada 7 dias (KV `instagram_token_renovado`). O alerta some do `/saude-fragment`.

## Como outro Claude Code retoma o projeto

1. Clonar o repositório e trocar para `owbuddy/dev`.
2. Criar os tokens de acesso (Cloudflare, GitHub, admin se necessário) e deixar como variáveis de ambiente, nunca em arquivo do repositório.
3. Ler este arquivo, `producao-ownews-git/PRODUCTION_GUARD.md` e `ownews-radar/RADAR_OFFSHORE.md`.
4. A memória de trabalho do Claude no VPS (65 notas) foi exportada à parte, em local privado. Dá para colar as notas relevantes na memória do novo ambiente.
