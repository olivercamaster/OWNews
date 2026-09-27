# Source Registry — arquitetura de fontes do collector

Criado em 2026-09-19 (Missão Growth Engine, P1). Formaliza as 9 fontes já
integradas e testadas em produção — **nenhuma fonte nova foi adicionada
nesta rodada**. Motivo: a missão pede explicitamente para não criar
"scraper frágil sem necessidade" — cada fonte nova (Transpetro, BNDES,
operadoras, drilling, FPSO/subsea, OSV, imprensa internacional) precisa
de verificação manual de estrutura (RSS? API? HTML estável?) antes de
virar código em produção. Isso é trabalho real de descoberta, não
arquitetura — feito fonte a fonte, quando houver tempo de verificar cada
uma com cuidado.

## Onde vive

`FONTES_REGISTRY` em `shrill-pond-a915-fix/worker.js` — um array de
objetos, um por fonte, logo depois das constantes `*_URL`. Campos:

| Campo | Significado |
|---|---|
| `id` | chave curta, mesma usada em `resultados.<id>` dos grupos A/B/C |
| `nome` | nome completo/oficial da fonte |
| `dominio` | domínio real de onde vem o conteúdo |
| `tipo` | `governo` / `empresa` / `imprensa` |
| `categoria` | papel da fonte (regulador, operadora, imprensa especializada, etc.) |
| `pais` / `idioma` | hoje só `BR`/`pt` — campo já existe pra quando entrarem fontes internacionais |
| `prioridade` | `alta`/`media` — usado só como referência editorial, não filtra nada sozinho hoje |
| `confiabilidade` | `oficial` (fonte primária, gov/empresa) vs `imprensa especializada` (secundária) |
| `metodo_coleta` | HTML scraping / RSS / API JSON — importante pra saber o que quebra com redesign de site |
| `endpoint` | URL real usada pelo coletor |
| `grupo` | `A`/`B`/`C` — em qual invocação agendada a fonte roda hoje |
| `imagem_permitida` | reflete `DOMINIOS_FOTO_PERMITIDOS` do Instagram publisher — domínios sem imagem permitida nunca viram foto de post automático |
| `fonte_primaria` | `true` = comunicado oficial da própria entidade; `false` = imprensa cobrindo terceiros |

## Fontes atuais (14)

| id | Nome | Grupo | Tipo | Método |
|---|---|---|---|---|
| `anp` | ANP | A | governo | HTML |
| `petrobras` | Agência Petrobras | A | empresa | HTML |
| `ppsa` | PPSA | B | governo (estatal) | API JSON |
| `epe` | EPE | B | governo | HTML |
| `mme` | MME | B | governo | HTML |
| `marinha` | Marinha do Brasil | B | governo | HTML |
| `antaq` | ANTAQ | B | governo | HTML |
| `ibama` | IBAMA | C | governo | HTML |
| `petronoticias` | PetroNotícias | C | imprensa | RSS |
| `agencia_brasil` | Agência Brasil (EBC) — Economia | C | governo (imprensa pública) | RSS |
| `sindipetro_nf` | Sindipetro NF (sindicato, Macaé/Bacia de Campos) | C | sindicato | RSS |
| `fup` | FUP — Federação Única dos Petroleiros | C | sindicato (nacional) | RSS |
| `transocean` | Transocean Ltd. | D | empresa (drilling, internacional) | RSS |
| `sbm_offshore` | SBM Offshore | D | empresa (FPSO, internacional) | RSS |

### Grupo C — sindical/regional (novo em 2026-09-19, gap explícito da missão)

Sindipetro NF (sede em Macaé, sindicato dos petroleiros do Norte
Fluminense — a maior categoria de petroleiros da América Latina, cobre a
Bacia de Campos) e FUP (federação nacional que o representa) preenchem o
gap "greve/sindicato/Bacia de Campos/Macaé" que a missão apontou
repetidamente sem nunca ter sido resolvido com uma fonte de verdade — só
o vocabulário do relevance filter cobria isso antes. Confirmado ao vivo:
o feed do Sindipetro NF continha, no mesmo dia da integração, a notícia
"Sindipetro-NF manifesta solidariedade aos trabalhadores em greve na
Bacia de Campos" — o equivalente real do próprio caso de regressão da
missão.

Filtro dedicado (`noticiaRelevanteSindicalPetroleiro`, allow-list de
vocabulário de ação sindical real — greve/assembleia/ACT/negociação
coletiva/etc. — OU núcleo offshore, exceto "campo"/"campos" sozinho, que
é homógrafo real aqui: Sindipetro NF é sediado na cidade de Campos dos
Goytacazes e menciona "Campos" com frequência em conteúdo institucional/
social do sindicato, não como campo petrolífero). Testado contra 17
títulos reais dos dois feeds antes de entrar em produção — 3 bugs
encontrados e corrigidos durante o próprio teste isolado:

1. Filtro por exclusão inicial era permissivo demais (deixava passar
   eleição interna de diretoria, obituário, comentário político nacional,
   até uma oficina de artesanato) — trocado por allow-list de vocabulário
   de ação sindical real.
2. `og:title`/`<h1>` da página do próprio artigo carregava o sufixo de
   SEO do site (" - SindipetroNF", " | FUP - Federação Única dos
   Petroleiros") e sempre vencia o título já limpo do RSS — a limpeza
   (`limparSufixoFonte`) só cobria o caminho RSS antes; agora é aplicada
   no ponto único de montagem do artigo, não importa de qual extração o
   título veio (correção que também beneficia Transocean/SBM Offshore,
   caso o og:title deles um dia tenha o mesmo padrão).
3. Homógrafo "campo"/"campos" (cidade de Campos dos Goytacazes vs campo
   petrolífero), agravado pela tolerância de plural adicionada nesta
   mesma sessão — corrigido excluindo "campo" do núcleo offshore
   especificamente pra esta fonte.

### Grupo D — internacional (novo em 2026-09-19)

Transocean e SBM Offshore verificadas e integradas nesta sessão — feeds
RSS oficiais reais, sem bloqueio de bot, conteúdo confirmado manualmente
(20 artigos de teste inseridos via `/run-transocean`/`/run-sbm-offshore`,
todos relevantes: contratos, fleet status, FPSOs em Guyana/Suriname).
Rodam na varredura horária do `EditorialPoller`, agora com rotação de 4
turnos (A/B/C/D) em vez de 3.

Dois problemas reais encontrados e corrigidos durante a integração:
1. **Título com sufixo redundante** — o RSS devolvia `"Título | Transocean
   Ltd."` / `"Título - SBM Offshore"`, repetindo o nome da fonte que o
   OWNews já mostra separadamente. `extrairItensRSSGenerico()` agora
   remove esse sufixo quando ele repete o nome da fonte.
2. **Imagem de tracking, não foto real** — o RSS da Transocean expõe uma
   URL de imagem em `globenewswire.com/newsroom/ti?nf=...`, que passava
   no aceite de `extrairImagemPrincipal()` só por conter a substring
   "news" (dentro de "newsroom"). Ao vivo, essa URL derruba a conexão
   (HTTP/2 INTERNAL_ERROR) em vez de servir uma imagem — bloqueada
   explicitamente agora; artigos da Transocean caem no fallback
   contextual (categoria "sonda_perfuração") em vez de foto quebrada.

Os 20 artigos de teste já publicados foram corrigidos retroativamente via
endpoint de uso único `/corrigir-fontes-internacionais-teste` (mesma
lógica da coleta corrigida, aplicada aos dados já salvos — nunca
deletou/inventou nada, só reaplicou a limpeza).

## Source Health — o que existe e a limitação conhecida

`classificarSaudeFontes(ultimaExecucao)` combina o registro com o único
registro de execução guardado em KV (`ultima_execucao`, sobrescrito a
cada grupo que roda — ver `docs/KV-BUDGET.md`, decidimos NÃO criar uma
chave por grupo pra não aumentar o orçamento de escrita). Isso significa:

- As fontes do MESMO grupo da execução mais recente aparecem como
  `HEALTHY` (rodou sem erro) ou `BROKEN` (rodou com erro, motivo incluído).
- As fontes dos OUTROS dois grupos aparecem como `SEM_DADO_RECENTE` — não
  significa que estão quebradas, só que o snapshot mais recente é de
  outro grupo. Isso é **honesto por design**: preferimos um status
  "não sei agora" a fingir uma saúde per-fonte que não temos como provar
  sem gastar mais writes de KV.

Exposto em `/saude` como campo `fontes` (array de 9 objetos — pequeno de
propósito, "não poluir /saude público com centenas de linhas").

### Evolução futura (não implementada, documentada)

Se algum dia for necessário saber a saúde de TODAS as fontes ao mesmo
tempo (não só o último grupo que rodou), duas opções, nenhuma barata:

1. Uma chave de KV por grupo (`ultima_execucao_a`, `_b`, `_c`) — 3 writes
   em vez de 1 por execução, ainda dentro do orçamento hoje, mas seria
   reavaliado se o número de grupos crescer.
2. Consultar a Supabase por `image_credit`/fonte nos últimos artigos
   (já temos isso pra outras métricas) em vez de depender só do KV —
   mais fiel, zero write novo, mas não distingue "fonte sem notícia
   nova" de "fonte quebrada" tão bem quanto um registro de execução.

## Como adicionar uma fonte nova (processo, não código pronto)

1. **Verificar estrutura real primeiro**: a fonte tem RSS? (`/feed`,
   `/feed.xml`, `<link rel="alternate" type="application/rss+xml">` no
   HTML). Tem API pública? (JSON-LD, `wp-json`, endpoint documentado).
   Só cair pra "HTML scraping" se nenhuma das duas existir — é o método
   mais frágil (quebra com qualquer redesign do site).
2. **Testar manualmente** via um endpoint `/run-<fonte>` isolado antes de
   entrar em qualquer grupo agendado — mesma disciplina já usada pro
   IBAMA/Marinha/ANTAQ (todas tiveram bug real encontrado só ao testar
   isoladamente antes de ativar).
3. **Adicionar ao `FONTES_REGISTRY`** com os campos reais (nunca inventar
   `confiabilidade`/`fonte_primaria` — isso é avaliação editorial, não
   suposição).
4. **Escolher o grupo** com base no orçamento de subrequests já
   documentado (grupos A/B têm histórico de estourar limite quando
   sobrecarregados — ver comentários em `executarAtualizacaoPrincipal`).
5. **Checar `DOMINIOS_FOTO_PERMITIDOS`** (`ownews-instagram-publisher/
   worker.js`) — domínio novo só entra ali depois de confirmado que a
   fonte é confiável o bastante pra imagem virar post automático.
6. Reavaliar `docs/KV-BUDGET.md` se a fonte precisar de qualquer
   armazenamento próprio (a maioria não precisa — só passa pelo pipeline
   normal de `processarNoticias`).

## Fontes já verificadas e REJEITADAS (bloqueio técnico real, não decisão editorial)

Verificação individual feita nesta sessão (WebSearch + WebFetch + curl,
sem tentar contornar nenhum bloqueio):

| Empresa | O que foi tentado | Resultado |
|---|---|---|
| TotalEnergies | `WebFetch` no newsroom oficial | HTTP 403 — bot detection ativo |
| Valaris | `www.valaris.com/investors/default.aspx` | HTTP 403 |
| Noble Corporation | `investors.noblecorp.com` | Timeout/sem resposta |
| Seadrill | `ir.seadrill.com/news/` | HTTP 403 |
| Transpetro | página de notícias institucional | Conteúdo parece renderizado via JS no cliente — HTML bruto não traz a lista de notícias |
| BNDES | `/rss/noticias.xml` | 301 → 404 (link morto) |
| Wilson Sons | `ri.wilsonsons.com.br/feed/` | Erro de certificado SSL na subdomínio de IR; `www.wilsonsons.com.br/feed/` retorna 202 vazio |

Nenhuma foi "burlada" — são bloqueios técnicos reais (bot detection,
JS-rendering, certificado inválido, endpoint morto). Reavaliar
periodicamente: essas proteções mudam com o tempo.

## Expansão de 2026-09-27 — 4 fontes novas ATIVAS

Varredura completa da lista pendente abaixo (curl real com UA de
navegador, inspeção de itens/datas/conteúdo). 4 aprovadas e ativadas,
cada uma testada isolada via `/run-<fonte>` antes de entrar em grupo:

| Fonte | Feed | Grupo | Filtro | Teste isolado (brutos→relev→inser) |
|---|---|---|---|---|
| Portos e Navios | `portosenavios.com.br/noticias?format=feed&type=rss` | E | `noticiaRelevante()` | 200 → 10 → 10 |
| Offshore Energy | `offshore-energy.biz/feed/` | D | `noticiaRelevanteImprensaEn()` | 10 → 7 → 7 |
| Marine Technology News | `marinetechnologynews.com/rss/news` | E | `noticiaRelevanteImprensaEn()` | 20 → 10 → 10 |
| MegaWhat | `megawhat.uol.com.br/feed/` | E | `noticiaRelevante()` | 10 → 0 → 0 |

**Portos e Navios** é a de maior valor: imprensa especializada BR
cobrindo pré-sal, operadoras, apoio marítimo e estaleiro
("Busca por novos poços é vital para conter declínio do pré-sal",
"OceanPact assina acordo para expansão de base no Açu", "Prio antecipa
planos de perfuração em Frade e Peregrino"). O feed traz 200 itens e
muita pauta portuária pura — 190 dos 200 foram corretamente descartados
pelo filtro de relevância no teste real.

**MegaWhat** entra com rendimento baixo POR DESENHO (backup de
Petrobras/gás, igual Agência Brasil): no teste, 10 brutos → 0 relevantes,
porque o feed do dia era 100% setor elétrico. Isso é o filtro
funcionando, não fonte quebrada.

### `noticiaRelevanteImprensaEn()` — novo filtro (não confundir com o das companhias)

`noticiaRelevanteInternacionalEn()` (Transocean/SBM) é EXCLUSÃO curta —
funciona porque companhia 100% offshore só publica do próprio setor.
Publicação especializada é diferente: cobre offshore O&G, eólica
offshore, subsea, mas também pesquisa oceanográfica, cruzeiro e pesca.
Caso real do feed do Marine Technology News: *"ASL Acoustic Profiler
Reveals Vertical Migration of Midge Larvae in Lake Malawi"*. Por isso
imprensa em inglês usa ALLOW-LIST (`PALAVRAS_NUCLEO_OFFSHORE_EN`, ~70
termos: fpso/rov/psv/subsea/deepwater/jack-up/north sea/campos basin +
players do setor), mesmo princípio do `noticiaRelevante()` português.

### Grupo E (novo) e rotação de 5 turnos

Grupo C já rodava 7 fontes numa invocação; a lição do incidente de
subrequests (Grupo B, 2026-09-17) é não empilhar fonte em grupo cheio —
quando estoura, as últimas fontes somem em silêncio. Criado o Grupo E e
a rotação horária subiu de 4 para 5 turnos (A/B/C/D/E), com a
distribuição feita pelo VOLUME real medido, não pelo país/idioma:
nenhum grupo novo fica com mais de 2 fontes de ~10 itens.
- **Grupo D**: Transocean, SBM Offshore (≈0 itens/48h), Offshore Energy.
- **Grupo E**: Portos e Navios, MegaWhat (≈0), Marine Technology News.

Custo: cada grupo é visitado a cada ~5h em vez de ~4h — compensado pelos
2 crons fixos (A/B a cada ~3h) e pelo stale guard do Grupo A.

## Fontes candidatas verificadas em 2026-09-27 e REJEITADAS

Bloqueio técnico real ou conteúdo fora de escopo — nenhuma foi burlada:

| Candidata | O que foi tentado | Resultado |
|---|---|---|
| Shell | 4 caminhos (`_jcr_content.rss`, `/rss/media-releases.rss`, `newsroom.rss`, `.feed`) | HTTP 404 em todos |
| Equinor | `/news/rss`, `/rss/news`, `/feed.xml`, `/news.rss` | HTTP 200 mas devolve HTML, 0 itens RSS |
| bp | `press-releases/_jcr_content.feed` | 301 → página HTML, 0 itens |
| Rigzone | `rigzone_latest.aspx` | HTTP 202 corpo vazio (bot challenge) |
| Upstream | `/rss` | 200 com redirect SSO/paywall, 0 itens |
| Energy Voice | `/feed/` | HTTP 403 |
| Offshore Magazine | `/rss/all.xml` | HTTP 403 |
| OE Digital | `/news/rss` | HTTP 404 |
| Offshore Technology | `/feed/` | HTTP 403 |
| Subsea World News | `/feed/` | HTTP 403 |
| OceanPact | `/feed/` | HTTP 403 |
| PRIO | `ri.prio3.com.br/feed/` | RSS vivo mas placeholder WordPress ("Hello world!", 2018) |
| Brava Energia | `ri.bravaenergia.com/feed/` | Placeholder WordPress ("Olá, mundo!", jan/2026) |
| Saipem | `/en/rss.xml` | 200 com 10 itens, mas só cursos da academy (IWCF Well Control), não notícia |
| Solstad | `/feed/` | 200 com 10 itens, só avisos de assembleia (EGM), baixíssima frequência |
| PetroReconcavo, Ocyan, MODEC, TechnipFMC, DOF, Oceaneering | `/feed/`, `/rss/news-releases.xml` | HTTP 404 |
| Baker Hughes, Halliburton, SLB, Subsea7 | `rss.xml` / IR feeds | HTTP 403 |
| Yinson | `/feed/` | 200, 0 itens |
| Enauta, TN Petróleo, Brasil Energia, ClickPetróleo, epbr, Agência EPBR | `/feed/` | DNS/conexão falha, 403 ou 404 |
| Petróleo & Energia | `/feed/` | 200 com 5 itens, mas último de abr/2026 (sem conteúdo recente) |
| Splash247, gCaptain, Maritime Executive | feeds válidos | Fora de escopo: shipping/naval geral (grão, pesca, cruzeiro), não offshore O&G |
| Guia Marítimo, Portos e Navios (`/index.php`), Naval Porto Energia, Riviera, World Oil, OGJ, Hart Energy, IBP, Agência Gov, Fatos e Dados | vários | 404/500/403/DNS |

Reavaliar periodicamente: bot detection e endpoints mudam com o tempo.
As candidatas restantes (Foresea, Constellation, Petronas, etc.) seguem
sem feed público conhecido.
Não fazer isso em lote sem verificação individual — é exatamente o tipo
de "scraper frágil em massa" que a missão pediu para evitar.
