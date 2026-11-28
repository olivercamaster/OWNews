# Instagram — arquitetura da automação futura (preparação, não ativa)

Este documento é uma **auditoria + plano técnico**. Nada aqui está ativo.
Nenhuma credencial foi criada, solicitada ou exposta. Nenhum deploy, DNS,
alteração de Supabase, do collector, do frontend em produção ou de outro
Worker foi feito nesta rodada. Nenhum post foi publicado no Instagram.

Onde uma exigência da Meta não pôde ser confirmada com segurança, está
marcada como **CONFIRMAR NA META** em vez de inventada.

---

## 0. Auditoria do ambiente atual

Levantamento feito lendo o repositório (nenhuma alteração):

| Peça | O que existe hoje | Arquivo/local |
|---|---|---|
| Frontend produção | Worker `ownews-git`, serve o site, lê `articles` no Supabase com a chave `anon` pública | `producao-ownews-git/worker.js`, `producao-ownews-git/wrangler.jsonc` |
| Collector | Worker `shrill-pond-a915`, cron 6x/dia, coleta de ANP/MME/PPSA/EPE/Marinha/IBAMA/Petrobras, grava em `articles` via `SUPABASE_SERVICE_ROLE_KEY` (secret), tem dedupe por `original_url`/hash (`noticiaJaExiste`, `sha256`) | `shrill-pond-a915-fix/worker.js` |
| Banco | Supabase `awyowuhwkqfyhwgdpepp.supabase.co`, tabela `articles` (`id, title, summary, content, image_url, image_caption, image_credit, original_url, published_at, slug, status`) | schema não versionado neste repo; inferido do worker.js e do frontend |
| Biblioteca de imagens | `biblioteca-fotografica.json` — fotos com licença CC verificada individualmente, crédito e categoria, curadoria manual, explicitamente "nenhuma foto retrata o acontecimento específico de nenhuma matéria" (uso ilustrativo) | `home-redesign/biblioteca-fotografica.json` |
| Precedente de automação de publicação | `telegram-integration/ARQUITETURA.md` + `telegram.js` — mesmo tipo de pipeline (elegibilidade → dedupe → geração de mensagem → API oficial), preparado mas inativo; já estabelece o princípio "falha no canal de distribuição nunca pode afetar a publicação do artigo" | `telegram-integration/` |
| R2 / KV / D1 | **Nada existe hoje** — nenhum `wrangler.jsonc` do projeto declara `r2_buckets`, `kv_namespaces` ou `d1_databases` | grep no repositório inteiro |
| Alertas de admin | Canal privado de administração já desenhado (`enviarAlertaAdmin`, secrets `TELEGRAM_ADMIN_BOT_TOKEN`/`TELEGRAM_ADMIN_CHAT_ID`), também inativo | `telegram-integration/telegram.js` |
| Menções a Instagram/Meta no repo | Nenhuma — busca no repositório não retorna nenhuma automação, credencial ou token existente | grep no repositório inteiro |

Respostas às perguntas A–J levantadas antes de implementar:

**A) Melhor serviço para executar a automação**
Um **Worker novo e isolado** (não o `shrill-pond-a915` nem o `ownews-git`).
Motivo: o próprio padrão já adotado no projeto para o Telegram é isolar o
canal de distribuição do que gera o conteúdo, justamente para que uma falha
ali nunca afete o site nem a coleta. Publicar no Instagram envolve: gerar
imagem (custo de CPU maior que o collector faz hoje), chamar a Graph API da
Meta (rede externa, pode falhar/ratelimitar) e manter segredos próprios da
Meta. Misturar isso no `shrill-pond-a915` aumentaria o raio de impacto de
qualquer bug ou instabilidade da Meta sobre a coleta de notícias, que hoje
roda 6x/dia de forma estável. Nome proposto: `ownews-instagram-publisher`
(a confirmar com o usuário).

**B) Ler notícias recentes sem duplicar infraestrutura**
Ler diretamente a tabela `articles` já existente no Supabase (mesma fonte
que o frontend usa), filtrando `status=eq.published` e uma janela de
`published_at` (ex.: últimas 72h, com fallback maior — ver seção de
seleção). Nenhuma cópia de dados, nenhum novo pipeline de ingestão. Leitura
pode usar a mesma chave publicável (`anon`) já pública no JS do site — não é
segredo novo.

**C) Registrar o que já foi publicado no Instagram**
Nova tabela `instagram_posts` no Supabase (schema proposto, **não
executado** — ver seção "Proteção contra duplicidade"), no mesmo padrão já
documentado (mas não aplicado) para o Telegram em
`telegram-integration/ARQUITETURA.md`.

**D) Gerar a imagem 1080×1350 no padrão OWNews**
Renderização server-side dentro do próprio Worker, sem navegador headless
(Playwright não roda no runtime de Workers — é usado hoje só como
ferramenta de teste local em `frontend-tools/validate.mjs`, fora do
runtime de produção). Ver seção "Método de geração da arte".

**E) Hospedar a imagem em URL HTTPS para a API oficial**
Cloudflare R2 (bucket novo, não criado nesta etapa) servido por um endpoint
`GET` no próprio Worker publicador (ou Custom Domain do bucket). A Graph API
da Meta precisa buscar essa URL durante a criação do container de mídia —
por isso a URL precisa estar publicamente acessível (sem autenticação) por
tempo suficiente. Ver seção E detalhada abaixo.

**F/G/H/I/J** — ver seções dedicadas mais abaixo.

---

## ARQUITETURA PROPOSTA

```
                    ┌─────────────────────────────┐
                    │   Supabase (existente)       │
                    │   tabela: articles            │
                    │   tabela nova: instagram_posts│
                    └───────────┬───────────────────┘
                                │ leitura (anon key, já pública)
                                │ escrita (service key nova, secret)
                                ▼
     ┌──────────────────────────────────────────────────────┐
     │  Worker novo e isolado: ownews-instagram-publisher     │
     │  cron: "0 10 * * *"  (07:00 America/Sao_Paulo)         │
     │                                                        │
     │  1. Buscar candidatos (articles recentes, published)   │
     │  2. Filtrar duplicados (JOIN contra instagram_posts)   │
     │  3. Aplicar filtros duros (sensível/rumor/acusação)     │
     │  4. Pontuar e escolher a melhor notícia                 │
     │  5. Gerar headline + legenda (texto)                    │
     │  6. Gerar arte 1080x1350 (Satori + resvg-wasm)          │
     │  7. Subir PNG para R2 (novo bucket)                     │
     │  8. [modo real] Graph API: criar container + publicar   │
     │     [DRY RUN] gravar preview, não chama a Graph API      │
     │  9. Gravar resultado em instagram_posts (sucesso/erro)   │
     │ 10. Alerta de admin via Telegram (reaproveita mecanismo  │
     │     já preparado, não cria canal novo)                   │
     └───────────┬────────────────────────────────┬───────────┘
                 │                                │
                 ▼                                ▼
     ┌───────────────────────┐        ┌─────────────────────────┐
     │ Cloudflare R2 (novo)   │        │ Meta Graph API (oficial)  │
     │ bucket: ownews-ig-assets│       │ /{ig-user-id}/media       │
     │ imagem pública temporária│      │ /{ig-user-id}/media_publish│
     └───────────────────────┘        └─────────────────────────┘
```

Princípios herdados do padrão já usado no projeto (Telegram):
- Falha na publicação do Instagram **nunca** pode afetar o site, o
  collector ou o Supabase de produção — é sempre um passo posterior e
  independente.
- Segredos da Meta só existem como `wrangler secret` do Worker publicador,
  nunca em código versionado, frontend, logs ou este relatório.
- Nenhum valor fictício parecido com credencial real é criado nesta etapa.

---

## FLUXO COMPLETO

```
07:00 America/Sao_Paulo (cron "0 10 * * *" UTC)
   │
   ▼
1. Ler articles publicados no Supabase (status=published, published_at
   dentro da janela recente, ordenado por published_at desc)
   │
   ▼
2. Excluir os que já existem em instagram_posts (qualquer status ≠ failed)
   → nunca reconsiderar notícia já publicada no Instagram
   │
   ▼
3. Aplicar filtros duros (exclusão automática, não pontuação):
   - fonte fora da lista de fontes oficiais já usada pelo collector
     (ANP/MME/PPSA/EPE/Marinha/IBAMA/Petrobras)
   - palavras de risco: morte/óbito/faleceu/acidente fatal/vítima fatal
   - vocabulário de acusação/condenação não transitada em julgado
   - conteúdo sinalizado como rumor/não confirmado
   │
   ▼
4. Pontuar o que sobrou (ver "Método de seleção da notícia") e escolher
   o maior score. Se nada pontuar o suficiente, cair para categoria
   "carreira offshore" (evergreen); se também não houver nada elegível,
   NÃO publicar — só alertar o admin.
   │
   ▼
5. Gerar headline curta (regra de tamanho/tom, não genérica de IA) e
   legenda em PT-BR natural, a partir de title/summary/content já
   existentes no artigo (sem inventar fatos novos)
   │
   ▼
6. Selecionar imagem: foto real do artigo (image_url) se marcada como
   editorial/licenciada; senão, foto da biblioteca curada
   (biblioteca-fotografica.json) compatível com a categoria; nunca uma
   arte 100% genérica/gerada por IA como imagem principal
   │
   ▼
7. Renderizar arte 1080x1350 (categoria pequena, manchete grande, uma
   linha curta de contexto, logo OWNews, "ownews.com.br")
   │
   ▼
8. Subir PNG ao R2, obter URL HTTPS pública temporária
   │
   ▼
9. DRY_RUN=true  → parar aqui, gravar preview (status=dry_run), alertar
   admin com link da imagem gerada
   DRY_RUN=false → Graph API: POST /{ig-user-id}/media (image_url +
   caption) → POST /{ig-user-id}/media_publish (creation_id)
   │
   ▼
10. Gravar em instagram_posts: article_id, status (published/failed/
    dry_run), ig_media_id, erro (se houver), timestamps
    │
    ▼
11. Alerta de admin (Telegram, mecanismo já preparado) com o resultado
```

---

## ARQUIVOS/SERVIÇOS QUE SERIAM CRIADOS

Nada disto foi criado ainda — é a lista do que a implementação exigiria:

**Novo Worker** `ownews-instagram-publisher/`
- `worker.js` — handler `scheduled()` + lógica do pipeline
- `wrangler.jsonc` — nome fixo, cron `"0 10 * * *"`, sem `routes` (não
  precisa de domínio público além do endpoint de imagem, se optar por
  servir a imagem pelo próprio Worker em vez de Custom Domain do R2)
- `selecao.js` — filtros duros + função de pontuação (pura, testável)
- `arte.js` — geração do SVG/layout (Satori) e rasterização (resvg-wasm)
- `meta.js` — chamadas à Graph API (`criarContainer`, `publicarContainer`),
  no mesmo espírito de `telegram.js`: falha explícita se faltar secret,
  nunca usa token de exemplo
- `fonts/` — arquivo(s) de fonte com licença permissiva embutidos no
  Worker (Satori não usa fontes do sistema, precisa do buffer da fonte)
- `.env.example` — só nomes de variáveis, sem valores (criado nesta etapa,
  ver arquivo ao lado deste)

**Migration SQL proposta (não executada)** — `schema.sql` nesta mesma pasta,
no padrão já usado por `supabase-pesquisa-salarial/schema.sql`: cria
`instagram_posts`, sem RLS de leitura pública, só INSERT/UPDATE pela
service key.

**Infra Cloudflare (não criada)**
- Bucket R2 `ownews-ig-assets` (nome a confirmar), com regra de expiração
  de objetos (ex.: 7 dias) para não acumular custo.

---

## CREDENCIAIS META NECESSÁRIAS

Todas como `wrangler secret` do Worker publicador — nunca em código, Git,
frontend ou logs (nem token truncado é logado; se precisar logar algo, só
"token presente: sim/não").

| Nome do secret | O que é | Como obter |
|---|---|---|
| `META_APP_ID` / `META_APP_SECRET` | App em Meta for Developers com o produto "Instagram Graph API" adicionado | Meta for Developers → criar app tipo Business |
| `IG_BUSINESS_ACCOUNT_ID` | ID da conta Instagram Business/Creator conectada à Página do Facebook do OWNews | Graph API `GET /{page-id}?fields=instagram_business_account` |
| `META_PAGE_ID` | ID da Página do Facebook vinculada à conta Instagram | Business Manager / Graph API `/me/accounts` |
| `META_ACCESS_TOKEN` | Token de longa duração para publicar (Page Access Token de longa duração, ou token de System User de um Business App) | Gerado no Business Manager; **CONFIRMAR NA META** o método atual recomendado (a Meta já mudou isso mais de uma vez) e a política de expiração/rotação vigente |

Pré-requisitos organizacionais (não técnicos, dependem do usuário):
- A conta do Instagram precisa ser **Business ou Creator**, não pessoal.
- Ela precisa estar vinculada a uma **Página do Facebook**.
- O usuário que administra a conta precisa ter papel de admin no Business
  Manager para gerar o token/app.

---

## PERMISSÕES META NECESSÁRIAS

Conjunto padrão da Instagram Content Publishing API:
- `instagram_basic`
- `instagram_content_publish`
- `pages_show_list`
- `pages_read_engagement`

**CONFIRMAR NA META**: se o app precisará passar por *App Review* para
usar essas permissões em modo "live" (fora do papel de admin/tester do
próprio app), quais os limites atuais de publicação (documentado
historicamente como 25 publicações/24h por conta, mas isso precisa ser
reconfirmado na documentação vigente antes de depender do número), e se há
exigência adicional de verificação de negócio (Business Verification) para
o app em uso.

---

## MÉTODO DE GERAÇÃO DA ARTE

Sem navegador headless (Playwright não roda no runtime de Cloudflare
Workers — é dependência de teste local, não de produção). Abordagem
compatível com Workers:

1. **Satori** (biblioteca pura JS, sem dependência nativa) monta o layout
   a partir de um objeto tipo JSX/HTML simples → gera SVG. Já é o padrão
   usado por soluções de geração de imagem em edge (ex.: OG images em
   Cloudflare/Vercel).
2. **resvg-wasm** (`@resvg/resvg-wasm`) rasteriza esse SVG para PNG
   1080×1350 dentro do próprio Worker (WASM, compatível com o runtime).
3. Fonte: precisa de um arquivo de fonte com licença permissiva
   embutido no Worker (Satori exige o buffer da fonte, não lê fontes do
   sistema).
4. Imagem de fundo: foto real do artigo (`image_url`) quando marcada como
   editorial/licenciada, ou uma foto da `biblioteca-fotografica.json`
   compatível com a categoria — nunca uma arte totalmente sintética como
   fundo principal.
5. Camadas de texto conforme padrão editorial: categoria pequena no topo,
   manchete grande, no máximo uma linha curta de contexto, logo "OWNews",
   "ownews.com.br" pequeno em um canto.

Ressalva honesta: esta combinação (Satori + resvg-wasm) é a abordagem
tecnicamente correta para o runtime de Workers, mas não foi testada dentro
deste repositório ainda — a implementação real precisa de uma prova de
conceito isolada antes de confiar nela em produção. Também é preciso
confirmar, no painel Cloudflare, se o plano atual da conta cobre CPU time
suficiente para renderização de imagem (o plano gratuito de Workers tem um
limite de CPU por invocação bem menor que o plano pago) — **CONFIRMAR NO
PAINEL CLOUDFLARE**, não é uma exigência da Meta.

---

## MÉTODO DE SELEÇÃO DA NOTÍCIA

Não é "pegar a mais recente". Pipeline em duas fases:

**Fase 1 — filtros duros (exclusão, não pontuação)**
Removem o artigo da lista de candidatos completamente:
- já existe em `instagram_posts` (qualquer status diferente de `failed`)
- `original_url` fora do domínio das fontes já vetadas pelo próprio
  collector (anp.gov.br, petrobras.com.br, gov.br/mme, ppsa.pre.gov.br,
  epe.gov.br, marinha.mil.br, ibama.gov.br, etc.) — o projeto já só
  ingere de fontes oficiais, o que reduz bastante o risco de rumor
- título/resumo contém vocabulário de risco: morte, óbito, faleceu,
  vítima fatal, explosão com vítimas, ferido grave
- título/resumo contém vocabulário de acusação/condenação não confirmada
  (acusa, acusada, condenada, culpada, processo, investigação sobre)
  associado a nome de empresa
- artigo já sinalizado internamente como rumor/não confirmado (se esse
  campo existir/for criado no futuro)

**Fase 2 — pontuação do que sobrou**
Soma de pesos (valores iniciais propostos, ajustáveis, nenhum "mágico"):
- Recência: pontuação maior quanto mais perto de `published_at` = agora
  (decaimento ao longo da janela, ex.: 72h)
- Tema prioritário (peso alto): offshore brasileiro, Petrobras, mercado
  offshore, operações, descobertas, empresas do setor
- Tema secundário (peso baixo, só usado como desempate ou fallback):
  carreira offshore
- Presença de imagem editorial real utilizável (bônus)
- Fonte com maior peso editorial (ex.: Petrobras/ANP > fonte genérica)

Escolhe o maior score. Se **nenhum** candidato sobreviver à Fase 1, cai
para uma notícia de carreira offshore (fallback explícito, conforme
pedido). Se nem isso existir, a automação **não publica** e só emite o
alerta de admin — nunca força uma publicação de conteúdo inadequado só
para não ficar em branco.

---

## PROTEÇÃO CONTRA DUPLICIDADE

Nova tabela proposta `instagram_posts` (schema completo em `schema.sql`
nesta pasta, não executado):

| campo | tipo | descrição |
|---|---|---|
| `id` | uuid | chave primária |
| `article_id` | uuid | referência ao artigo no Supabase, **UNIQUE** |
| `canonical_url` | text | URL pública do OWNews |
| `status` | text | `dry_run` / `published` / `failed` |
| `ig_media_id` | text | id retornado pela Graph API após publicar |
| `ig_permalink` | text | link do post no Instagram, quando disponível |
| `headline` | text | manchete usada na arte |
| `caption` | text | legenda usada no post |
| `error_message` | text | erro, quando `status=failed` |
| `created_at` / `published_at` | timestamptz | controle de tempo |

Regras:
- `UNIQUE(article_id)` impede duas linhas para o mesmo artigo.
- Um artigo com `status=published` nunca é reconsiderado.
- Um artigo com `status=failed` pode ser reprocessado no próximo dia.
- Antes de qualquer chamada à Graph API, o Worker também confere se já
  existe alguma linha com `status=published` **na data de hoje**
  (trava por dia, independente do artigo) — garante no máximo 1 post/dia
  mesmo em caso de reexecução manual ou erro de agendamento.

---

## DRY RUN

Controlado por uma variável de ambiente (`INSTAGRAM_DRY_RUN`, ainda a
confirmar o nome final), **com valor padrão `true`** — ou seja, o modo
seguro é o padrão, e passar para publicação real exige uma troca explícita
e deliberada, não um esquecimento.

Em DRY RUN, o pipeline executa **tudo** (seleção, pontuação, headline,
legenda, geração e upload da imagem) e para exatamente antes das duas
chamadas à Graph API (`/media` e `/media_publish`). Grava o resultado em
`instagram_posts` com `status=dry_run` e envia o preview (texto + link da
imagem gerada no R2) para o canal privado de admin já preparado
(mecanismo do Telegram, reaproveitado — sem criar canal novo). Isso
permite validar headline, legenda e arte por vários dias antes de ligar a
publicação de verdade.

---

## AGENDAMENTO

Cron trigger do Cloudflare Workers `"0 10 * * *"` (UTC) = 07:00
America/Sao_Paulo. O Brasil não tem mais horário de verão desde 2019, então
UTC-3 é fixo o ano todo — não há ajuste sazonal a fazer. Se essa regra
mudar novamente no futuro, o cron precisaria ser revisado (risco baixo,
mas registrado).

---

## CUSTO ESTIMADO

- **Cloudflare Workers**: 1 invocação agendada/dia + reexecuções pontuais
  em caso de falha — custo marginal desprezível dentro de um plano que já
  roda múltiplos Workers com cron. Se a renderização de imagem exigir mais
  CPU do que o plano atual permite por invocação, pode ser necessário
  Workers Paid (baixo custo mensal) — **CONFIRMAR NO PAINEL CLOUDFLARE**
  qual plano está ativo hoje.
- **R2**: armazenamento de poucas imagens por dia (algumas centenas de KB
  cada), com expiração automática em poucos dias — custo estimado em
  centavos de dólar por mês.
- **Meta Graph API**: sem custo direto de uso da API de publicação de
  conteúdo; sujeita a limites de taxa, não a cobrança.
- **Fontes/bibliotecas** (Satori, resvg-wasm): open source, sem custo de
  licença.

Custo total esperado: baixo (ordem de poucos dólares/mês ou menos), mas o
número exato depende do plano Cloudflare atual e não deve ser tratado como
garantido sem confirmar isso.

---

## RISCOS

- **Renderização de imagem em Workers**: abordagem (Satori + resvg-wasm)
  ainda não validada neste projeto; precisa de prova de conceito antes de
  confiar em produção.
- **Mudança de política/permissão da Meta**: a Instagram Graph API já
  mudou requisitos de App Review e verificação de negócio no passado;
  qualquer suposição sobre o processo atual está marcada como CONFIRMAR
  NA META.
- **Falso negativo do filtro de conteúdo sensível**: listas de palavras
  nunca são perfeitas; o próprio desenho já assume isso ao restringir a
  fontes oficiais e ao permitir fallback para "não publicar" em vez de
  forçar.
- **Dependência do Instagram estar Business/Creator e vinculado a uma
  Página**: se isso não estiver configurado, nenhuma credencial pode ser
  emitida — é um pré-requisito organizacional, não técnico.
- **Token de longa duração expirando silenciosamente**: precisa de alerta
  de admin quando a Graph API responder erro de autenticação, para não
  descobrir isso só quando o post falhar dias depois.
- **Custo de CPU** em Workers para renderizar imagem pode exigir mudança
  de plano — ver "Custo estimado".

---

## O QUE PRECISA DE MIM

Isto é o que só o usuário/dono da conta pode decidir ou fornecer — nada
disso deve ser inventado:

1. Confirmar (ou criar) que a conta Instagram do OWNews é Business/Creator
   e está vinculada a uma Página do Facebook.
2. Criar o App em Meta for Developers e decidir o método de geração do
   token de longa duração (Page token vs. System User) — inclusive
   confirmar com a Meta os requisitos atuais de App Review/verificação.
3. Fornecer os IDs reais (`IG_BUSINESS_ACCOUNT_ID`, `META_PAGE_ID`) depois
   de criados — nunca gerados ou adivinhados aqui.
4. Aprovar o nome do novo Worker (`ownews-instagram-publisher` é só
   proposta) e do bucket R2.
5. Validar/ajustar os pesos da pontuação editorial e a lista de
   palavras-filtro de conteúdo sensível/acusação.
6. Decidir o texto exato do rodapé/identidade visual da arte (logo em
   qual formato de arquivo, cor exata, se há uma versão já pronta em
   PNG/SVG do logo OWNews para usar em vez de recriar).
7. Confirmar o plano Cloudflare atual (Free vs. Paid) para saber se cobre
   o CPU time da renderização de imagem.
8. Autorizar explicitamente, em uma etapa separada, a criação do bucket
   R2, da tabela `instagram_posts` e o primeiro deploy do Worker — nada
   disso acontece nesta etapa.

---

## PRÓXIMO PASSO

Sugestão de ordem, cada uma como uma autorização separada e explícita:

1. Usuário confirma/organiza a conta Instagram Business + Página do
   Facebook + App na Meta, e traz os IDs (sem trazer token nenhum em
   texto puro na conversa — configurar direto como secret quando chegar
   a hora).
2. Prova de conceito isolada de geração de imagem (Satori + resvg-wasm)
   rodando localmente, sem cron, sem Meta, sem Supabase — só para validar
   a técnica antes de comprometer com ela.
3. Criar a migration `instagram_posts` no Supabase (revisão explícita
   antes de rodar, como já é o padrão de `supabase-pesquisa-salarial`).
4. Criar o Worker `ownews-instagram-publisher` em modo **DRY RUN por
   padrão**, sem cron ativo ainda — só testável manualmente.
5. Rodar em DRY RUN por alguns dias, revisando headline/legenda/arte.
6. Só depois disso, com autorização explícita, ativar o cron e o modo de
   publicação real.

Nenhuma dessas etapas foi executada nesta rodada.
