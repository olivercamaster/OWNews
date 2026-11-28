# OWNews — AdSense Readiness

Status em 2026-09-16, reauditado em 2026-09-19. AdSense **não está ativo**:
`ADS_ENABLED = false` em `producao-ownews-git/worker.js`, nenhum script do
Google é carregado, nenhum slot renderiza qualquer elemento visível,
`ADSENSE_CLIENT_ID = null` (nunca um `pub-` fictício).

## Reauditoria 2026-09-19 — duas lacunas reais encontradas e uma corrigida

- **Home sem canonical/description/Open Graph** (CORRIGIDO nesta data): a
  auditoria de 2026-09-16 verificou robots.txt/sitemap/manifest, mas não
  reparou que `const HTML` (a Home) nunca teve `<meta name="description">`,
  `<link rel="canonical">` nem tags Open Graph/Twitter — todas as outras
  páginas (via `paginaChrome()`) já tinham. Adicionado: description,
  canonical (`https://ownews.com.br/`), og:site_name/type/title/description/
  url, twitter:card/title/description. Estático (Home institucional, não
  matéria específica).
- **HTTP não redireciona para HTTPS** (AINDA PENDENTE — depende do
  proprietário): `curl http://ownews.com.br` responde `200 OK` diretamente,
  em vez de 301 para `https://`. Não é algo que `worker.js` resolve — é
  configuração de zona no painel Cloudflare (SSL/TLS → Edge Certificates →
  "Always Use HTTPS", ou uma Redirect Rule). Não é bloqueador formal do
  AdSense (o Google indexa a versão HTTPS, que já funciona), mas é
  recomendação de canonicalização/SEO que vale corrigir. Não alterado nesta
  sessão — é configuração de produção fora do escopo de código, o
  proprietário decide/ativa no painel.
- **Sem banner de consentimento de cookies** (documentado, não bloqueador
  hoje): confirmado que o site não carrega NENHUM script de analytics/
  tracking hoje (nenhum gtag/GA/Meta Pixel encontrado) — ou seja, não há
  cookie de terceiro sendo definido agora, então não há exigência legal
  pendente neste exato momento. Vira pendência real apenas quando (a)
  analytics de produto for implementado (ver "Telemetria de Produto" na
  missão maior) ou (b) AdSense for ativado — a Política de Privacidade já
  promete se atualizar "antes da ativação" (ver seção já existente).

## Documentação oficial consultada (acesso em 2026-09-16)

- Elegibilidade: https://support.google.com/adsense/answer/9724
- Programa/políticas gerais: https://support.google.com/adsense/answer/48182
- Spam policies (conteúdo escalado/raspado/IA): https://developers.google.com/search/docs/essentials/spam-policies
- Publisher policies (visão geral): https://support.google.com/publisherpolicies/answer/10502938 , https://support.google.com/publisherpolicies/answer/10400453
- Posicionamento de anúncios: https://support.google.com/adsense/answer/1346295
- ads.txt: https://support.google.com/adsense/answer/12171612 , https://support.google.com/adsense/answer/12171244
- Consentimento EEA/UK/Suíça (CMP-TCF): https://support.google.com/adsense/answer/13554116 , https://support.google.com/adsense/answer/9928203
- Conteúdo obrigatório / política de privacidade: https://support.google.com/adsense/answer/1348695 , https://support.google.com/adsense/answer/10961370
- Core Web Vitals / page experience: https://developers.google.com/search/docs/appearance/page-experience , https://developers.google.com/search/docs/appearance/core-web-vitals
- Interstitials intrusivos (mobile): https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials

## O que a documentação diz, resumido

- Elegibilidade é sobre qualidade/originalidade de conteúdo e controle do
  domínio — não há exigência formal de idade mínima do site.
- Conteúdo gerado por automação não é proibido em si; o que é proibido é
  "scaled content abuse" (gerar muitas páginas sem valor, com ou sem IA) e
  conteúdo raspado sem valor agregado.
- Anúncio não pode ser confundido com navegação/menu/botão, nem ficar perto
  o bastante de controles a ponto de gerar clique acidental.
- ads.txt não é obrigatório, mas é fortemente recomendado.
- **Brasil/LGPD tem página própria do Google** (distinta da exigência de
  CMP certificada da UE/Reino Unido/Suíça, que não se aplica ao Brasil hoje).
- Único conteúdo formalmente exigido: política de privacidade divulgando
  uso de cookies de anúncio por terceiros/Google, com link de opt-out.
- Core Web Vitals afeta ranking de busca, não elegibilidade/receita do
  AdSense diretamente — mas boa experiência de página é parte do critério
  geral de qualidade.

## Arquitetura de anúncios

- **Componente central**: `adSlot(nome, formato)` em `worker.js`. Enquanto
  `ADS_ENABLED=false`, retorna string vazia sempre — zero HTML, zero
  reserva de espaço, zero CLS.
- **Feature flag**: `ADS_ENABLED` (const, não env var — nada sensível
  aqui). `ADSENSE_CLIENT_ID` fica `null` até haver conta aprovada.
- **Classificação por página**: `classificarPaginaParaAds(caminho)` decide
  o slot genérico (`content_after_main`, injetado automaticamente dentro
  de `paginaChrome()` antes do bloco "Continue no OWNews") para páginas
  editoriais/evergreen; Radar, Notícia e Home têm posições próprias e mais
  específicas, resolvidas nos próprios pontos de renderização; Minha
  Escala fica de fora deliberadamente (zero anúncio).

## Slots preparados (todos inertes hoje)

| Página | Slot | Posição |
|---|---|---|
| Home | `home_after_editorial` | Depois de "Central Offshore", antes do banner OffshoreWorks |
| Notícia | `article_after_intro` | Depois do título/imagem, só em artigo médio/longo (>900 caracteres) |
| Notícia | `article_after_content` | Depois do corpo do artigo, antes do link "fonte original" |
| Guias/Funções/Empresas/Salários/Pesquisa Salarial/Cursos/Comece Aqui/Dados | `content_after_main` | Antes do bloco "Continue no OWNews" (hook genérico central) |
| Radar (índice) | `radar_after_map` | Depois do mapa+painel, antes de "Continue no OWNews" |
| Radar (ficha) | `unit_after_specs` | Depois de "Características", antes de "Notícias sobre esta unidade" — só se a unidade tiver alguma característica confirmada |
| Minha Escala | — | Nenhum slot — ferramenta densa em controles, risco de clique acidental |
| Aeroportos | — | É uma seção da Home (`#aeroportos`), não uma rota própria — sem slot dedicado, e o `home_after_editorial` fica bem depois dela |

Script carregado atualmente: **NÃO**. Slots visíveis atualmente: **NÃO**
(confirmado via teste automatizado em 7 rotas × 4 viewports — 0 ocorrências
de `.adsbygoogle` ou script AdSense em qualquer página).

## ads.txt

Rota `/ads.txt` criada, respondendo hoje com um arquivo só de comentários
(sintaxe válida do IAB), sem nenhuma linha de vendedor. Mecanismo pronto —
só falta colar a linha real (`google.com, pub-XXXXXXXXXXXXXXXX, DIRECT,
f08c47fec0942fa0`) depois da conta aprovada.

## Páginas institucionais

Criadas do zero (não existiam antes): `/sobre`, `/contato`, `/privacidade`,
`/politica-editorial` — linkadas no rodapé de todo o site. Conteúdo escrito
a partir do que o código realmente faz (retenção de 8 dias em pageviews,
TTL de 120s em presença, ambos sem PII conforme os próprios comentários
das classes `PageViews`/`PresencaOnline`; localStorage só para
Radar/Minha Escala, nunca enviado a servidor). Contato usa o Instagram já
existente no rodapé — nenhum e-mail/endereço/CNPJ foi inventado.

## Consentimento (LGPD / EEA-UK)

- Brasil (LGPD): nenhuma ação de bloqueio necessária hoje — Google trata
  isso via restrição de servir anúncio a tráfego de IP brasileiro por
  Ad Tech Providers certificados, do lado do Google, não do publisher.
- EEA/UK/Suíça: exigem CMP certificada TCF **antes** de servir anúncio
  personalizado a esses usuários. **Não implementado agora** (não há
  anúncio ativo) — documentado como bloqueador de ativação caso o tráfego
  do site inclua volume relevante da Europa/Reino Unido.

## SEO / conteúdo de baixo valor

Não foi necessário aplicar `noindex` a nenhuma rota — nenhuma ficha do
Radar (47 unidades, todas com pelo menos nome+tipo+operador confirmado) ou
guia é "quase vazia". Nenhuma página nova foi criada só para exibir
anúncio.

## Testes

7 rotas × 4 viewports (320/390/768/1440) via Playwright: **0 overflow
horizontal, 0 erro de console, 0 script/elemento AdSense presente**.
Regressão: `/`, `/radar`, `/minha-escala`, `/funcoes`, `/empresas`,
`/guias`, `/pesquisa-salarial`, `/dados`, `/robots.txt`, `/sitemap.xml`,
`/manifest.webmanifest` — todas HTTP 200, sem mudança de comportamento.

## Pronto vs. pendente

**PRONTO**
- Arquitetura de slots (componente + flag + classificador), zero custo/zero impacto enquanto desativada.
- 4 páginas institucionais reais e linkadas.
- Mecanismo de `/ads.txt`.
- Pesquisa de política oficial documentada com fontes.

**PENDENTE (antes de solicitar aprovação)**
- Nenhum item técnico bloqueia a solicitação — o site já tem navegação,
  conteúdo original, política de privacidade e mecanismo de ads.txt.
- Recomendação (não bloqueador): ativar "Always Use HTTPS" no painel
  Cloudflare (zona `ownews.com.br`) — hoje `http://` responde 200 direto em
  vez de redirecionar para `https://`. Ação de painel, não de código.

**SÓ DEPOIS DA APROVAÇÃO**
- Obter Publisher ID real.
- Preencher `ADSENSE_CLIENT_ID` e a linha real de `/ads.txt`.
- Implementar CMP certificada TCF **somente se** houver tráfego relevante da EEA/UK/Suíça.
- Trocar `ADS_ENABLED` para `true`.
- Validar visualmente os slots com anúncios reais, mobile incluído.
- Monitorar Core Web Vitals reais pós-ativação.

**PRECISA DECISÃO DO DONO**
- Se/quando solicitar a conta AdSense.
- Se vale a pena medir tráfego EEA/UK antes de decidir sobre CMP.
- Se `article_after_intro`/`article_after_content` juntos (2 slots num
  mesmo artigo longo) são aceitáveis ou se prefere só 1 até ver o volume
  de tráfego real por notícia.
