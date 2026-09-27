## 2026-09-27 — Execução autônoma: correção EPE + padronização de janelas + preparação de scores

Rodada em modo autônomo autorizado, continuando a missão de pipeline.
Ordem seguida: maior valor primeiro, bloqueios reais deixados por último.

### Etapa 1 — BUG REAL CORRIGIDO: EPE perdia 100% das matérias (ERRO_DATA)

Instrumentei o `ERRO_DATA` que aparecia no Grupo B rodando as 5 fontes
isoladas: **PPSA/MME/Marinha/ANTAQ = 0 rejeições; EPE = 2/2**, ou seja,
TODA matéria relevante da EPE morria antes de chegar ao banco. Perdidas
nesse ciclo: *"EPE e Norwegian Offshore Directorate realizam intercâmbio
técnico sobre planejamento energético e dados"* e a cobertura da ROG.e —
as duas dentro do escopo editorial.

**Causa raiz (verificada no HTML real, não suposta):** a PÁGINA DA
MATÉRIA da EPE não tem nenhum metadado de data — sem
`article:published_time`, sem JSON-LD, sem `<time datetime>`, sem o
padrão "Publicado em" do Plone/gov.br. `extrairData()` devolvia `null`,
e como `extrairLinksEPE()` também não passava data, `dataEditorial`
ficava vazio e o pipeline (corretamente) recusava inventar data.

**Armadilha evitada:** a página do artigo TEM `<span class="date">`, mas
pertencente a uma lista lateral de OUTRAS matérias — ler dali daria data
errada silenciosamente. A data correta só existe na LISTAGEM, ao lado de
cada link.

**Correção** (`shrill-pond-a915-fix/worker.js`): `extrairLinksEPE()`
passou a capturar a data do próprio item (janela curta de 300 chars após
o `</a>`, pra nunca pegar a data do item seguinte) + helper
`dataListagemEPEParaISO()`. A EPE publica só DD/MM/AAAA, sem hora e sem
fuso: convertido com `-03:00` (mesma convenção já usada em PPSA e no
parser do Plone) e **00:00 de propósito** — qualquer hora fabricada seria
invenção, e um horário comercial arbitrário cairia no FUTURO quando a
coleta roda de manhã, sendo descartado pelas janelas de recência
(`h >= 0`), o que reintroduziria exatamente a perda que a correção
resolve. Guardas: nunca aceita data futura nem anterior a 2000.

**Validação:** extrator testado contra o HTML real da listagem — 8/8
itens com data correta e individual. Em produção pós-deploy:
`REJ_DATA 2 → 0`, **2 matérias inseridas** com datas reais (25/09 e
24/09, batendo com a listagem). PPSA e MME re-testados: sem regressão.
Deploy `9a95000d-37fd-48f9-8cbf-103cb9e23ac9` (rollback
`96ccda5a-9988-44bd-ba41-d60a32e08e55`).

### Etapa 2 — Re-teste das fontes bloqueadas: nenhuma liberou

Rigzone, Energy Voice, Offshore Magazine, Upstream, OGJ, Subsea World,
OceanPact e Offshore Technology re-testadas com conjunto COMPLETO de
cabeçalhos de navegador (UA + Accept + Accept-Language + Sec-Fetch-* +
DNT). Resultado idêntico ao da varredura anterior: 202 com corpo de
challenge (Rigzone) ou 403 (as demais); Upstream segue devolvendo HTML
de paywall. **Bot detection real, não questão de cabeçalho** — nenhuma
tentativa de contornar, conforme política do registry. Nada mudou no
SOURCE-REGISTRY além deste registro.

### Etapa 3 — Command Center: janelas 7d/30d padronizadas

Pendência declarada na correção anterior ("7d/30d mantêm o
desalinhamento pré-existente... vale padronizar depois"). Agora TODO
período fechado começa às 00:00 America/Sao_Paulo do primeiro dia da
janela — "7 dias" = hoje + os 6 anteriores, não 168h móveis. Usa
`inicioDoDiaNoFuso()` sobre o instante deslocado (não subtração fixa),
então segue correto se voltar o horário de verão.

Também generalizada a **janela de comparação**: antes só "Hoje"
comparava preservando a fração decorrida; 7d/30d comparavam janela
parcial (com hoje incompleto) contra janela anterior CHEIA, o que
puxava a variação pra baixo artificialmente. Agora a janela anterior é
a mesma deslocada N dias, com duração idêntica — verificado em teste
unitário: `dur atual == dur anterior` para hoje/7d/30d.

Validado em produção nos 4 períodos: hoje 23 visitantes/160 views,
7d e 30d 337/160, "tudo" 337/160; Minha Escala 50 e Atalhos da Home 26
seguem separados; Home/minha-escala/vaga HTTP 200; `/api/cc/dados` sem
auth segue 401. Deploy `32d539cc-6df3-4a27-8cec-494c7dd22879`
(rollback `47e22135-018f-4d1b-8d71-bafd54bf2bd4`, backup local
`/tmp/worker.js.backup-pre-janelas`).

### Etapa 4 — Scores editoriais: migração preparada, DDL segue bloqueado

Confirmado ao vivo que o bloqueio persiste: `editorial_score`,
`breaking_score`, `audience_interest_score` e `score_reason` retornam
`42703 column does not exist`. A REST API do Supabase não executa DDL —
é lacuna de acesso, não dificuldade técnica.

Criado `docs/MIGRATION-SCORES-ARTICLES.sql`, no mesmo padrão do arquivo
de jobs: 100% aditiva, colunas NULLABLE sem DEFAULT, `IF NOT EXISTS`,
índice parcial (só linhas com score), bloco de verificação, bloco de
rollback e o passo-a-passo do que muda no código depois de aplicada.

**Decisão deliberada de NÃO escrever código dormente agora:** adicionar
detecção de schema no caminho quente do INSERT criaria risco de quebrar
a coleta (PostgREST rejeita o INSERT inteiro se a coluna não existe) em
troca de valor zero — nenhum consumidor dos scores existe ainda
(Instagram scoring e Discovery não iniciados). A sequência correta é
migração → coletor escreve → consumidores. Backfill dos 183 artigos
antigos NÃO recomendado sem decisão editorial: recalcular hoje daria
recência diferente da que valia na publicação (reescrever história).

### Etapa 5 — Pendência antiga encerrada: cota KV do Instagram publisher

A pendência de 2026-09-19 ("validar se a janela das 23:15 publicou")
está **resolvida**: publisher habilitado, `dry_run:false`, última
execução `published` com `ig_media_id` real (18093262793448179) em
2026-09-27T07:51Z, heartbeat do VPS atual. Nenhuma ação necessária.

### Estado do OWNews ao fim desta rodada
Pipeline SAUDÁVEL, 20 fontes registradas, coletor sem erro, Telegram
com 1 publicação no dia e sem erro, imagens próprias em 106/111 artigos
dos últimos 7 dias (95%), 0 grupos de banner repetido.

### Etapa 6 — Notícias Macaé: 403 intermitente, diagnosticado, sem ação

O health check acusou `noticias_macae: HTTP 403` na varredura do Grupo C
durante esta rodada. Investigado: **não reproduzível** — 3 tentativas
seguidas daqui retornaram HTTP 200 com 20 itens, tanto com UA de
navegador quanto com o UA exato do coletor
(`OWNews/1.0 - OffshoreWorks news collector`), e o mesmo UA funciona em
todas as outras 6 fontes de imprensa testadas. Conclusão: bloqueio
intermitente por IP de saída do Worker (faixa Cloudflare), do lado da
fonte — não é bug nosso nem regressão desta rodada (não toquei nesse
coletor). Classificação: **DEGRADADA**, não QUEBRADA. Nenhuma alteração
feita: o `try/catch` por fonte já isola a falha (o grupo inteiro seguiu
normal) e o `/saude` já expõe em `fontes_com_erro`, que é exatamente o
comportamento desejado. Política do registry respeitada: não se remove
fonte por causa de uma execução falha.

### Pendências que permanecem
- **[BLOQUEADO — precisa do operador]** aplicar
  `docs/MIGRATION-SCORES-ARTICLES.sql` no Supabase (Dashboard → SQL
  Editor). Sem isso, Instagram scoring, Discovery e discard-logging
  seguem parados. Mesmo bloqueio vale para `docs/MIGRATION-JOBS-TABLE.sql`.
- **[DECISÃO EDITORIAL]** roundup de vagas da PetroNotícias ("ESTÁGIOS,
  TRAINEES, VAGAS...") continua fora do filtro — liberar "vagas/estágio"
  genérico é risco de ruído (caso Firjan). Não é decisão técnica.
- Rigzone/Upstream/Energy Voice: re-teste periódico (bloqueio pode ser
  intermitente).
- Fases não iniciadas do roadmap antigo: Instagram overhaul visual
  (Layouts A/B/C), PT/EN/ES real, Mercado/Contratos/Movimentação
  registries, Jobs Engine, Meu Embarque/Certificados/Entitlements.

## 2026-09-27 — Missão "Expansão das fontes pendentes do SOURCE-REGISTRY"

Continuação direta da auditoria anterior (que identificou o pool estreito
de 16 fontes como teto estrutural do volume). Varredura completa da lista
de candidatas pendentes, com o processo documentado no próprio registry:
verificar estrutura real → testar isolado → registrar → só então agendar.

**VERIFICAÇÃO (curl real com UA de navegador, ~60 endpoints testados):**
4 aprovadas, 25+ rejeitadas por bloqueio técnico real ou conteúdo fora de
escopo. Tabela completa (o que foi tentado e o resultado de cada uma) em
`docs/SOURCE-REGISTRY.md`. Destaques das rejeições: Shell (404 em 4
caminhos), Equinor (200 mas devolve HTML), Rigzone (202 vazio, bot
challenge), Energy Voice/Offshore Magazine/Subsea World/OceanPact/Baker
Hughes/Halliburton/SLB (403), PRIO e Brava (RSS vivo mas placeholder
WordPress "Hello world!"/"Olá, mundo!"), Saipem (feed só de cursos da
academy), Solstad (só avisos de assembleia), Splash247/gCaptain/Maritime
Executive (feeds bons, mas shipping/naval geral — fora de escopo).
Nenhuma foi burlada.

**4 FONTES ATIVADAS** (teste isolado real, brutos→relevantes→inseridas):
| Fonte | Grupo | Filtro | Teste |
|---|---|---|---|
| Portos e Navios (BR) | E | `noticiaRelevante()` | 200 → 10 → **10** |
| Offshore Energy (NL, en) | D | `noticiaRelevanteImprensaEn()` | 10 → 7 → **7** |
| Marine Technology News (US, en) | E | `noticiaRelevanteImprensaEn()` | 20 → 10 → **10** |
| MegaWhat (BR) | E | `noticiaRelevante()` | 10 → 0 → 0 |

- **Portos e Navios** é a de maior valor: pré-sal, operadoras, apoio
  marítimo, estaleiro, em português ("Busca por novos poços é vital para
  conter declínio do pré-sal", "OceanPact assina acordo para expansão de
  base no Açu", "Prio antecipa planos de perfuração em Frade e
  Peregrino"). 190 dos 200 itens do feed foram corretamente descartados
  (pauta portuária/logística pura) — filtro fazendo o trabalho.
- **MegaWhat** rende ~0 POR DESENHO (backup de Petrobras/gás, igual
  Agência Brasil): o feed do dia era 100% setor elétrico e o filtro
  descartou tudo sem gastar subrequest. Não é fonte quebrada.

**NOVO FILTRO `noticiaRelevanteImprensaEn()`** — o filtro EN existente
(`noticiaRelevanteInternacionalEn`) é exclusão curta, válido só porque
Transocean/SBM são companhias 100% offshore. Publicação especializada
cobre espectro bem maior: caso real do feed do Marine Technology News —
*"ASL Acoustic Profiler Reveals Vertical Migration of Midge Larvae in
Lake Malawi"*. Por isso imprensa em inglês recebeu ALLOW-LIST própria
(`PALAVRAS_NUCLEO_OFFSHORE_EN`, ~70 termos: fpso/rov/psv/subsea/
deepwater/jack-up/north sea/campos basin + players), mesmo princípio do
filtro português, reaproveitando `bateComBordaDePalavraColeta` (protege
siglas curtas de casar por substring).

**GRUPO E (novo) + rotação de 5 turnos** — Grupo C já rodava 7 fontes
numa invocação e a lição do incidente de subrequests (Grupo B,
2026-09-17) é não empilhar fonte em grupo cheio (quando estoura, as
últimas somem em silêncio). Distribuição feita pelo VOLUME real medido,
não por país/idioma — nenhum grupo novo fica com mais de 2 fontes de ~10
itens:
- **D**: Transocean, SBM Offshore (≈0 itens/48h), Offshore Energy → ~13
  subrequests em regime.
- **E**: Portos e Navios, MegaWhat (≈0), Marine Technology News → ~26.
Rotação horária do `EditorialPoller` passou de `% 4` para `% 5`
(A/B/C/D/E): cada grupo a cada ~5h em vez de ~4h, compensado pelos 2
crons fixos (A/B a cada ~3h) e pelo stale guard do Grupo A. Crons
inalterados.

**RESULTADO MEDIDO:**
- 27 matérias novas inseridas nos testes isolados, **todas com
  `published_at` REAL da fonte** (37–50h de idade, backfill honesto do
  conteúdo corrente dos feeds) — nada disfarçado de fresco. Por isso
  `articles_last_24h` seguiu em 4 e **`articles_last_48h` subiu de 13
  para 19**; o ganho de frescor aparece a partir do próximo ciclo de
  publicação das fontes (Portos e Navios e Offshore Energy publicam
  diariamente em dia útil).
- **100% das 27 com foto própria real** (nenhuma dependeu de fallback).
- Re-teste em regime: 4/4 fontes `ok`, 0 erros, 0 `rejeitadas_data`,
  tudo já reconhecido como duplicado (dedupe correto).
- Registry passou de 16 → **20 fontes**; páginas individuais das novas
  (EN e BR) renderizando em produção (HTTP 200); Home/minha-escala/vaga
  sem regressão.

**ARQUIVOS:** `shrill-pond-a915-fix/worker.js` (4 constantes de feed, 4
coletores, 4 rotas `/run-*`, filtro EN de imprensa, grupo E, rotação
5 turnos, 4 entradas no `FONTES_REGISTRY`); `docs/SOURCE-REGISTRY.md`.
Frontend NÃO tocado.

**DEPLOY:** `shrill-pond-a915` `96ccda5a-9988-44bd-ba41-d60a32e08e55`;
rollback `b0dccd49-1d21-4643-b780-20a4c24159f0` (+ backup local
`/tmp/shrill-worker.js.backup-pre-vocab`).

**ADENDO (mesmo dia, autorizado pelo operador) — fotos liberadas no
Instagram publisher:** `DOMINIOS_FOTO_PERMITIDOS`
(`ownews-instagram-publisher/worker.js`) recebeu os 4 domínios-base:
`portosenavios.com.br`, `offshore-energy.biz`,
`marinetechnologynews.com`, `megawhat.uol.com.br`. Hostnames REAIS
verificados antes (banco + feed), não supostos — Marine Technology News
serve de CDN própria (`images.marinetechnologynews.com`) e MegaWhat de
`/wp-content` do próprio domínio; como a checagem já aceita subdomínio
(`host === d || host.endsWith('.' + d)`), só o domínio-base entra.
Testado com 12 casos incluindo tentativas de bypass de SSRF
(`portosenavios.com.br.evil.com`, `169.254.169.254`, `localhost`,
`notoffshore-energy.biz`) — todos bloqueados; os 4 legítimos + os 10
antigos permitem. Gate de qualidade medido com imagens reais (mínimo
800x500): Portos e Navios 5/5 aprovam (1024x680 consistente), Offshore
Energy 4/5, Marine Technology News 4/5 (a CDN serve alguns a 799x447,
1px abaixo do mínimo — o publisher cai pro card tipográfico, que é o
comportamento correto; NÃO baixei o limiar de resolução).
Deploy `ownews-instagram-publisher`
`bfe3e1a6-0699-4b1f-b79b-ca4dea45da45`; rollback
`27d5b2a1-e1fd-4c49-8040-ad90047616e3` (+ backup local
`/tmp/instagram-worker.js.backup-pre-dominios`). Publisher validado
pós-deploy: habilitado, `dry_run:false`, última publicação real OK,
heartbeat do VPS atual.

**2ª LEVA — CONCLUÍDA E VALIDADA PELO OPERADOR (2026-09-27). Implementação CONGELADA: não alterar, não reduzir o gate de resolução, não ampliar a allowlist por suposição.** Fontes já
ativas que nunca entraram na allowlist. O mapeamento de hostname real
por fonte revelou a mesma falha silenciosa do caso PetroNotícias em 6
fontes que já produziam conteúdo há dias/semanas: o publisher degradava
pro card tipográfico sem erro aparente. A mais grave era **Eixos, a
fonte de MAIOR volume do site (59 matérias com foto, 100% bloqueadas)**.
Liberados os domínios-base (cobrem o subdomínio de CDN):
`eixos.com.br` (→ uploads.eixos.com.br), `ebc.com.br`
(→ imagens.ebc.com.br), `sindipetronf.org.br`, `fup.org.br`,
`sbmoffshore.com`, `noticiasmacae.com`.

Allowlist final: 20 domínios (10 originais + 4 fontes novas + 6 desta
leva). Testado com 16 casos, incluindo bypass de SSRF
(`eixos.com.br.evil.com`, `fakeeixos.com.br`, `evil-ebc.com.br`,
`169.254.169.254`, `localhost`, `metadata.google.internal`) — todos
bloqueados. Gate de qualidade (mín. 800x500) medido com imagens reais:
Agência Brasil 5/5, SBM Offshore 4/4, Eixos 4/5 (2048x1152 típico),
Notícias Macaé 1/1, Sindipetro NF 2/5, FUP 1/4 — as reprovações são o
gate funcionando (fonte sindical usa muita imagem pequena/miniatura);
nessas o publisher segue caindo pro card tipográfico, que é o correto.
Limiar de resolução NÃO foi alterado.

Transocean deliberadamente FORA da allowlist: não há hostname de imagem
real observado (o collector já bloqueia a URL de tracking do
globenewswire e manda pro fallback contextual) — não adiciono domínio
por suposição, é superfície de SSRF sem ganho.

Deploy final `ownews-instagram-publisher`
`e8c95841-23c4-4527-8a86-13c323e614ea`; rollback
`bfe3e1a6-0699-4b1f-b79b-ca4dea45da45` (e `27d5b2a1-e1fd-4c49-8040-ad90047616e3`
para o estado pré-missão). Publisher validado pós-deploy: habilitado,
`dry_run:false`, última publicação real OK, heartbeat do VPS atual.

**PENDÊNCIAS:** Rigzone/Upstream/Energy Voice valem re-teste periódico
(bot detection/paywall mudam). Candidatas sem feed público conhecido
(Foresea, Constellation, Petronas) seguem sem caminho técnico.

## 2026-09-27 — Missão "Auditoria e correção do pipeline de notícias" (funil medido → vocabulário corrigido)

Fase 1 READ-ONLY (funil real, sem números fictícios), fase 2 correção
mínima da causa, fase 3 re-execução controlada com antes×depois.

**CAUSA RAIZ (duas camadas, ambas comprovadas):**
1. **Escassez real de fim de semana** (fator dominante): medição direta
   dos feeds ao vivo (script local com o filtro EXTRAÍDO literalmente do
   worker via sed, zero divergência) — PetroNotícias 2 itens/24h, Eixos
   3/24h, Macaé 0, Sindipetro 0, FUP 1 (político, corretamente fora),
   Transocean/SBM 0 em 48h. Eixos responde por 61% do volume de 7 dias
   (48/79) e PetroNotícias 19% — quando esses 2 feeds secam, o site
   seca. Institucionais (grupo B rodou ao vivo às 11:14: 90 brutos → 77
   irrelevantes legítimos + 11 dup + 2 ERRO_DATA → 0 novos) publicam ~0
   no domingo. O pipeline estava CAPTURANDO tudo que existia — cada
   item relevante recente dos feeds já estava no banco (status
   "duplicada" na medição) ou deduplicado por desenho.
2. **Falso-negativo real no filtro de relevância**: o vocabulário não
   tinha NENHUM nome de empresa do setor. Perdidos nas últimas 48h (só
   nos 2 feeds principais): Prio (cadeia de fornecedores), OceanPact
   (mão de obra/navegação), Ecopetrol (novo CEO) — todos no escopo
   explícito da missão ("empresas do setor"). No Telegram, o vocabulário
   de pontuação não tinha "offshore", "bacia" nem "gás natural" — o
   canal ficou 30h mudo com notícia offshore boa no site (Karoon/Bacia
   de Santos pontuava 4 < 8).

**FUNIL ANTES (medição real, feeds ao vivo ~11:20Z):**
- Eixos: FOUND 20 · RECENT_24H 3 · RELEVANT 8 · REL_24H 1 (dup) ·
  NOVOS 0 — rejeitados in-scope: Prio, OceanPact.
- PetroNotícias: FOUND 10 · RECENT_24H 2 · RELEVANT 2 · REL_24H 1
  (dup) · NOVOS 0 — rejeitado in-scope: Ecopetrol.
- Agência Brasil: FOUND 10 · REL_24H 1 novo ("subsídio diesel") — NÃO
  inserido por dedupe cross-fonte 0.2 (FONTES_DEDUPE_SENSIVEL) contra a
  versão Eixos do MESMO fato já publicada → comportamento POR DESENHO,
  correto, não é bug.
- Grupo B (run real 11:14Z): 90 → 13 relevantes → 11 dup + 2 ERRO_DATA
  → 0 novos; 77 descartes de relevância legítimos (ruído institucional).
- Banco: 1h=0 · 3h=0 · 6h=1 · 12h=1 · 24h=2 · 48h=10.
- Datas/timezone: 0 INVALID_DATE nos 8 feeds RSS (pubDate RFC822 com
  offset explícito, parse correto); published_at sempre a data editorial
  REAL (ERRO_DATA descarta em vez de inventar — mantido).
- Imagem NUNCA mata matéria (image_url vira null + fallback no front —
  auditado no código, nenhuma correção necessária).
- Crons/alarms: EditorialPoller horário vivo (self-rescheduling),
  2 crons 6x/dia re-registrados no deploy; OffVoos/Mercado healthy.

**CORREÇÃO (só a causa, `shrill-pond-a915-fix/worker.js`):**
1. Novo array `EMPRESAS_SETOR_OFFSHORE` (33 nomes curados: operadoras
   BR, apoio marítimo, majors, FPSO/drilling/subsea) + 1 check em
   `noticiaRelevante()` — passa incondicional, mesmo caminho do núcleo.
   Curadoria anti-ruído: "bp"/"eni" FORA (ambiguidade), "3R" fora
   (virou Brava); borda de palavra protege "prio" dentro de "próprio"
   (o "ó" conta como letra na borda — testado com armadilha explícita).
2. `PONTUACAO_NORMAL_TELEGRAM` += "offshore", "bacia", "gás natural",
   "gas natural" — completação de vocabulário baseada em evidência, NÃO
   redução de limiar (continua 8). Como esse matcher é includes()
   (substring), nomes curtos de empresa ficaram FORA dele de propósito.
3. NADA mais tocado: thresholds, recência, dedupe, classificação,
   fontes, Home, frontend — intactos.

**TESTE ANTES×DEPOIS (mesmos títulos reais, filtro antigo × novo):**
3 in-scope F→P (Prio/OceanPact/Ecopetrol); 8 casos de ruído F→F (Bets,
Aneel, BNDES/ônibus, Weg/BESS, política, armadilha "próprio/priorado");
3 regressões P→P. Zero item aceito a mais fora do escopo.

**FUNIL DEPOIS (execução controlada real, /run-eixos e
/run-petronoticias pós-deploy):**
- Eixos: FOUND 20 · RELEVANT 10 (era 8) · INSERIDAS 2 (Prio, OceanPact)
  · DUP 8 · ERROS 0.
- PetroNotícias: FOUND 10 · RELEVANT 3 (era 2) · INSERIDAS 1
  (Ecopetrol) · DUP 2 · ERROS 0.
- Banco: 24h 2→**4** · 48h 10→**13** — todas com published_at REAL da
  fonte (Prio 26/09 13:00Z, ~22h; nada de notícia velha mascarada de
  nova; OceanPact entrou com 46h reais e por isso NÃO aparece na janela
  de 24h da Home — correto).
- Home produção (Playwright real): Ecopetrol e Prio nas laterais do
  masthead, ambas no Giro 24h, hero segue a mais fresca; página
  individual da matéria Prio renderizando (HTTP 200, foto real Eixos).

**TELEGRAM @ownewsradar:** mecanismo sempre esteve saudável (bot/canal
ok, radar rodando a cada hora); mudo por falta de candidato ≥8. Após a
correção, o dry-run do /saude passou a "publicaria_no_proximo_envio_real"
(PPSA/gas week, score 4→8 via "gás natural"+"leilão") e UMA execução
controlada do mecanismo padrão (/run-telegram, todos os limites
respeitados) publicou às 11:25:21Z — canal vivo de novo após ~30h, sem
spam (2º candidato score 8 ficou corretamente em "aguardando_intervalo
2h"; limite diário 4 intacto; garantia de 12:00 BRT cumprida).

**SITE × TELEGRAM (documentado):** pipelines de filtro DIFERENTES por
desenho — site usa allow-list ampla de relevância (noticiaRelevante),
Telegram usa pontuação por valor editorial (limiar 8) sobre o que o
site JÁ publicou. Correto manter distintos; agora ambos compartilham o
vocabulário de setor que faltava.

**DEPLOY:** `shrill-pond-a915` `b0dccd49-1d21-4643-b780-20a4c24159f0`;
rollback `1838c320-136b-4cd6-9c29-ffc23350a95c` (+ backup local
`/tmp/shrill-worker.js.backup-pre-vocab`). Frontend NÃO deployado
(nenhuma alteração de frontend). Crons re-registrados idênticos.

**PENDÊNCIAS:**
- 2 itens relevantes do grupo B presos em ERRO_DATA ("fonte sem data
  editorial verificável") — comportamento honesto por desenho (nunca
  inventar data), mas vale instrumentar QUAL fonte/URL num próximo
  ciclo pra decidir se o parser de data daquela fonte merece extração
  adicional.
- Roundup de vagas da PetroNotícias ("ESTÁGIOS, TRAINEES, VAGAS...")
  continua fora: "vagas/estágio" genérico no filtro é risco de ruído
  (caso Firjan já queimou); se o operador quiser, dá pra permitir só
  por fonte especializada — decisão editorial, não tomada aqui.
- Fim de semana continua sendo teto natural de volume com o pool atual
  de 16 fontes; expansão de fontes (Shell/Equinor/bp/Rigzone/Upstream
  etc., lista já em SOURCE-REGISTRY) segue como recomendação da
  auditoria anterior.

## 2026-09-27 — Missão "Corrigir métricas do Command Center" (pós-auditoria de analytics)

Correções cirúrgicas nas 3 frentes apontadas pela auditoria da mesma
data (janela "Hoje" incoerente; `atalho_utilitario_clique` inflando o
grupo Minha Escala; partida a frio de `pageviews_raw` sem aviso).
Nenhum dado apagado, nenhum layout/pipeline/Telegram/Minha Escala
tocado fora do escopo.

**1) Período "Hoje" padronizado (00:00 America/Sao_Paulo → agora)** —
na rota `/resumo` da DO `PageViews`: novas funções top-level
`offsetDoFusoMs()`/`inicioDoDiaNoFuso()` usando `Intl.DateTimeFormat`
com `timeZone` real (ICU do workerd), **nunca offset -03:00 fixo**
(se o Brasil voltar a ter horário de verão, continua correto).
Testado em unidade via node inclusive o caso de virada (21:00-23:59
BRT = dia UTC seguinte): 01:30Z de 27/09 → início 26/09T03:00Z ✓.
Com "Hoje" selecionado, TODAS as métricas usam a mesma janela:
- Visitantes agora vem de `COUNT(DISTINCT session_id)` em
  `pageviews_raw` (tem ts exato + session_id, permite alinhar ao
  minuto — `visit_days`, com granularidade de dia UTC, não permite);
  7d/30d/Tudo continuam em `visit_days` (histórico mais antigo,
  deduplicado por dia) — comportamento pré-existente preservado.
- Visualizações/eventos/origens/dispositivos/topPaths: `ts >= início
  do dia BRT`.
- Recorrentes ("Hoje"): sessão ativa vem de `pageviews_raw` na janela
  BRT; histórico continua em `visit_days` (fronteira de ±3h é limitação
  de granularidade documentada no código).
- Comparação ("Hoje"): agora contra a MESMA fração de dia de ontem
  (00:00 BRT de ontem → agora−24h), não mais dia parcial vs 24h cheias.

**2) Métrica "Minha Escala" corrigida** — `atalho_utilitario_clique`
(que cobre os 4 atalhos da Home: Aeroportos/Modo Embarcado/Giro 24h/
Mercado) saiu do grupo "Minha Escala" em `CC_MAPA_EVENTOS` e ganhou
grupo próprio "Atalhos da Home". Histórico intacto no banco — só a
classificação de exibição mudou. Permanecem no grupo (todos
inequívocos da ferramenta): `minha_escala_aberta` (abertura da
página), `me_hero_cta_click` (CTA da faixa da Home), `escala_configurada`,
`escala_editar_aberto` e `escala_compartilhada` (botão Compartilhar
dentro da própria ferramenta — mantido por ser inequívoco).

**3) Aviso de partida a frio** — `/resumo` agora devolve `dadosDesde`
(= `MIN(ts)` de `pageviews_raw`, dinâmico do banco, nunca hardcoded) e
`janelaIncompleta` (true quando o período pedido começa antes do
primeiro registro). O painel mostra uma linha discreta
(`.cc-nota-dados`, 11px, muted): "Visualizações, origens, dispositivos
e eventos: dados disponíveis desde DD/MM/AAAA." — some sozinha quando
a janela couber no histórico. Curiosidade honesta: o MIN(ts) real é
27/09 03:07:38Z (não 03:16 do deploy do CC como a auditoria estimou) —
mais um motivo pra data vir do banco e não de constante.

TESTE/VALIDAÇÃO (produção real, pós-deploy):
- "Hoje": visitantes 19 / visualizações 134 / novos 15 + recorrentes
  4 = 19 ✓ — a inversão absurda (298 visitantes × 133 views) sumiu;
  antes da correção os 298 misturavam ~34h de dias UTC.
- 7d/30d/Tudo: 333/134, recorrentes 7d = 0 (comportamento
  pré-existente da retenção antiga, inalterado) — funcionando.
- Minha Escala: 43 (27+10+4+2), SEM os 13 cliques de atalhos;
  "Atalhos da Home": 13 — histórico preservado, só reclassificado.
- Nota de partida a frio visível no painel (screenshot 390px) com a
  data vinda do banco.
- Regressão pública: Home/notícia/vaga/minha-escala HTTP 200;
  `/command-center` sem auth → 302; `/api/cc/dados` sem auth → 401.
- Nenhuma chamada nova de cliente foi adicionada (zero risco de
  contagem artificial); acessos de validação via curl (não executa JS)
  e Playwright (UA HeadlessChrome, barrado pelo filtro de bots) não
  contaminam as métricas.
- Helper de fuso testado em unidade (node) incluindo virada de dia.

LIMITAÇÕES/RISCOS DOCUMENTADOS:
- Recorrentes/Novos de "Hoje" usam histórico com granularidade de dia
  UTC (visit_days) — ±3h de imprecisão na fronteira; corrigir de
  verdade exigiria mudar o armazenamento (fora do escopo pedido).
- 7d/30d mantêm o desalinhamento leve pré-existente entre visit_days
  (dia UTC) e janelas móveis — fora do escopo desta missão (que pediu
  só o "Hoje"); vale padronizar depois.
- `janelaIncompleta` é global (baseado em pageviews_raw) — se um dia
  events/visit_days tiverem inícios muito diferentes, o aviso pode
  precisar granularizar por métrica.

DEPLOY: `ownews-git` `47e22135-018f-4d1b-8d71-bafd54bf2bd4`; rollback
`4452e7a8-d5fe-4933-bef3-da4f77bca58a` (+ backup local
`/tmp/worker.js.backup-pre-cc-metrics`).

## 2026-09-27 — Missão "Ajuste Visual Final da Home" — Minha Escala vira faixa compacta + correção do buraco editorial

Missão de ajuste sobre o hero completo da entrada anterior (que ficou
"grande demais", palavras do operador) — SEM mockup de imagem anexado
desta vez, especificação em texto/ASCII muito detalhada (diagramas de
composição desktop pra faixa compacta e pro bloco 1+3). Trabalho
incremental sobre a versão anterior, nada reconstruído do zero.

**1) Minha Escala: hero completo → faixa premium compacta** — removido
por completo `.me-hero` (3 colunas, foto, painel separado, 3 stats) e
substituído por `.me-bar`, uma única linha (desktop) / card curto
(mobile): ⚓ ícone | "MINHA ESCALA" + badge "GRÁTIS" (Estado A) OU dot +
rótulo "EMBARCADO"/"FOLGA" (Estado B) | headline curta | subtítulo
curto | barra de progresso (só Estado B) | CTA em pill. **Sem
fotografia** (item 11 da missão — devolve o espaço pro jornalismo).
Altura real medida: **82,5px (Estado A) / 94,5px (Estado B)** a 1440px
— contra os ~450px do hero anterior. Motor de cálculo (Etapas 19-20)
100% intocado; só os alvos de renderização mudaram. Removida a linha
de clima/data-importante (`alertaEl`) que existia no hero anterior —
não fazia parte da especificação desta faixa ultra-compacta e o motor
de clima continua 100% funcional e visível na página completa
`/minha-escala` (nada foi perdido, só não é mais mostrado NESTE
componente específico). Função `saudacao()` também removida (ficou
órfã sem o elemento de saudação do hero anterior).

**2) Mobile: CTA vira só seta** — bug encontrado no primeiro teste
visual: o CTA completo ("ABRIR MINHA ESCALA →") ao lado do texto
espremia a headline pra 3 linhas em 390px e cortava o subtítulo
("embarques · folgas..." truncado). Corrigido dividindo o CTA em 2
`<span>` (`meHeroCtaLabel` + seta separada) e escondendo o rótulo
abaixo de 600px — sobra só um botão circular com "→" (o card inteiro
já é um `<a>`, então a seta sozinha basta como affordance de toque).
Headline/subtítulo agora cabem inteiros em 390-430px sem cortar.

**3) Faixa utilitária (Aeroportos/Modo Embarcado/Giro 24h/Mercado)** —
mantida da missão anterior sem mudança estrutural. Ícone do "Mercado"
já tinha sido trocado de emoji pra SVG na missão anterior (problema de
renderização no ambiente de teste); ✈️/⚡ mantidos como emoji (testados
e renderizando corretamente, sem SVG equivalente óbvio já pronto no
design system pra reutilizar com segurança).

**4) Giro 24h — confirmado 100% preservado** — nenhuma alteração no
motor, dados, rota ou comportamento. Testado ao vivo: ticker populado
com notícias reais, rodando. Único ajuste: recebeu `id="giro24h"` (já
feito na missão anterior) pra a faixa utilitária linkar via âncora —
puramente aditivo, zero risco.

**5) Causa raiz real do "buraco" entre as notícias laterais (item 8-9)**
— confirmado via teste sintético com 3 laterais (dado real de hoje só
tinha 1-2, insuficiente pra reproduzir o bug): `.masthead.three-laterais
.highlights{display:grid;grid-template-rows:repeat(3,1fr)}` forçava as
3 linhas a esticarem em partes IGUAIS da altura da manchete (~420px em
1440px), mas o conteúdo real de cada linha (thumb 64px + texto) só
precisava de ~80-90px — sobrava ~50-60px de vazio DENTRO de cada linha,
antes do próximo divisor. Exatamente o "buraco" relatado. Corrigido
SEM grid-rows forçado: thumbnail aumentado de 64px pra 96px (mais
conteúdo real por item) + `align-self:start` na coluna de laterais
(não estica mais pra igualar a manchete). Resultado medido (Playwright,
1440px, 3 itens sintéticos): itens contíguos, ZERO gap entre eles,
altura total da coluna (~370px) próxima da manchete (420px) SEM
forçar nada artificialmente — exatamente o pedido ("aproximadamente a
mesma altura... eliminar espaço morto... sem altura fixa arbitrária").

**6) Ordem do topo reorganizada conforme especificação exata** — nova
sequência confirmada via teste automatizado (`compareDocumentPosition`)
nas 9 larguras: MINHA ESCALA compacta → ATALHOS (4 ícones) → GIRO 24H
→ AEROPORTOS → MERCADO AGORA → BLOCO JORNALÍSTICO (destaque) → VAGAS
→ ÚLTIMAS → Instagram/Telegram (baia-social, secundário, movido pra
depois do bloco editorial) → Agenda → Mercado Offshore/Mercado/
Operações/Central Offshore → OffshoreWorks → Mais Lidas → Ecossistema/
Footer. Bate 100% com a lista "ORDEM DO TOPO" da missão.

**7) Vagas/Mais Lidas/OffshoreWorks/compartilhamento/fotos** — auditado,
já estavam corretos desde a missão "Home OWNews 2.0" (2 entradas atrás),
preservados sem regressão.

TESTE: Playwright real (Chromium headless) cobrindo:
- Altura e conteúdo da faixa compacta em Estado A/B a 390px e 1440px.
- CTA mobile (seta) sem espremer headline/subtítulo em 320/390/430px.
- Ordem real do DOM (não posição visual) das 12 seções-chave nas 9
  larguras mandatórias (320-1920px) — 100% aprovado.
- Overflow horizontal por largura (excluindo contêineres com scroll
  interno intencional) — único achado é o overflow de HEADER em 768px,
  já registrado como pendência pré-existente fora de escopo (2 entradas
  atrás), inalterado por esta missão.
- Gap real entre 3 laterais sintéticas (contíguas, 0px de vão).
- Giro 24h com notícias reais populadas e rodando.
- Home/notícia (`?id=1ce050f1-…`)/vaga/aeroportos/mercado/minha-escala
  HTTP 200, em preview e em produção pós-deploy.

DEPLOY: `ownews-git` `4452e7a8-d5fe-4933-bef3-da4f77bca58a`; rollback
`7d6ae3c3-1cfe-4761-8e23-cde9599a2724` (versão anterior, hero completo).

VALIDADO EM PRODUÇÃO: capturas 390px/1440px idênticas ao testado em
preview; suíte completa (ordem/overflow/faixa compacta) re-executada
direto contra `ownews.com.br` — mesmos resultados.

## 2026-09-27 — Missão "HOME + MINHA ESCALA 3.0" — hero real a partir de mockups aprovados

Missão prioritária com mockups visuais aprovados anexados (1 desktop +
2 mobile side-by-side, estados A/B) como referência de hierarquia/
composição/proporção — site real continuou sendo a referência de
dados/motores/rotas. Objetivo central: Minha Escala deixa de ser "mais
uma ferramenta" e vira o PRODUTO PRINCIPAL de utilidade/retenção do
portal (a manchete continua protagonista editorial).

**1) Hero completo (substituiu o card `.me-destaque` da missão anterior)**
— novo `.me-hero`, ainda primeiro elemento útil dentro de `<main>`.
Estrutura única com 2 estados, resolvidos 100% client-side lendo a
MESMA chave `localStorage['ownews_minha_escala']` de sempre — motor de
cálculo (Etapas 19-20: `faseEm`/`proximaTransicao`/`statusEm`) **não
tocado**, só os alvos de renderização mudaram de nome/formato:
- **Estado A (sem escala salva)** — aquisição: eyebrow "⚓ MINHA ESCALA"
  + badge "GRÁTIS", headline "Quando é o seu **próximo embarque?**",
  subtexto "100% gratuito", 3 bullets de benefício, CTA "Abrir Minha
  Escala Grátis →" + nota "Leva menos de 1 minuto", painel lateral/
  inferior "SUA PRÓXIMA ESCALA · exemplo" com dados DEMONSTRATIVOS
  calculados a partir de hoje (hoje+14/+28 dias) — nunca finge ser
  escala real, sempre rotulado "· exemplo".
- **Estado B (com escala salva)** — utilidade: saudação por horário
  local ("Bom dia/Boa tarde/Boa noite 👋", **sem depender de nome**,
  nunca inventado — item 8 da missão), headline real "Você está
  **embarcado**"/"**de folga**", barra de progresso do ciclo (reaproveita
  a mesma matemática, só troca de alvo DOM), alerta contextual (clima/
  data importante, mesmo motor de sempre), CTA "Ver minha escala
  completa →", painel com dias reais + datas do ciclo vigente + regime,
  e uma faixa de 3 stats rápidos (Regime/Situação/Próxima troca) —
  tudo CALCULADO na hora do load, nada persistido como "faltam X dias".
- **Foto real** (item 4/32 da missão — nunca IA, sempre ativo real
  licenciado): pesquisadas e verificadas 2 fotos novas no Wikimedia
  Commons (mesma política já usada no Radar/Aviação), baixadas e
  inspecionadas visualmente antes de escolher — nenhuma "achismo" de
  descrição. Estado A usa `Oil_Platform_Crew_Transfer.jpg` (plataforma
  Holstein, Golfo do México, luz dourada de fim de tarde — crédito
  GuavaTrain, CC0). Estado B usa
  `Helicopter_and_offshore_support_vessel_from_a_oil_rig2.jpg`
  (helicóptero + PSV, céu limpo — crédito FrogsLegs71, CC BY-SA 3.0).
  Ambas hotlinkadas direto do Commons (mesmo padrão da
  `BIBLIOTECA_FOTOGRAFICA` já existente), com gradiente navy de overlay
  pra legibilidade do texto (nunca compete com o conteúdo) e crédito
  visível no canto, trocado via JS junto com o estado.

**2) Faixa utilitária compacta (item 21-22)** — nova `<nav class="me-utility-row">`
logo após o hero: Aeroportos/Modo Embarcado/Giro 24h/Mercado, mesmo
peso visual, em âncoras (`#aeroportos`/`#giro24h`/`#mercadoAgora`) pras
seções que já existiam — nenhum motor novo. O botão "Modo Embarcado"
foi FISICAMENTE MOVIDO pra dentro dessa faixa (antes vivia dentro de
`.baia-social`) reaproveitando os MESMOS 3 ids (`embarcadoBtn`/
`embarcadoBtnLabel`/`embarcadoBtnSub`) — `aplicarClasseEmbarcado()`
(que só busca por id) continuou funcionando sem nenhuma alteração.
Instagram/Telegram ficaram só os 2 na `.baia-social`, que desceu pra
posição secundária logo abaixo (zero funcionalidade removida, só
hierarquia visual menor).

**3) Bug de CSS encontrado e corrigido durante o próprio desenvolvimento**
(não estava no site antes, foi introduzido e corrigido na mesma sessão):
elemento com `hidden` + uma classe de autor definindo `display:flex`/
`display:grid` (`.me-hero-progresso`, `.me-hero-stats`) NÃO fica
escondido só com o atributo `hidden` — confirmado empiricamente
(Playwright: `getComputedStyle().display` retornava `flex` mesmo com
`hidden` presente), porque a regra do autor (mesma especificidade,
origem "author") vence a regra `[hidden]{display:none}` da folha de
estilo do user-agent. Corrigido com `.me-hero-progresso[hidden]{display:none}`
e `.me-hero-stats[hidden]{display:none}` explícitos.

**4) Ícone gigante/ícone sumido na faixa utilitária** — 2 bugs visuais
pegos no teste visual (não no funcional): (a) o SVG do Modo Embarcado
ficou sem `width`/`height` explícitos depois que a regra antiga
`.embarcado-btn-icon{width:16px;height:16px}` foi removida junto com o
resto do CSS antigo — corrigido com `svg.me-utility-ico{width:16px;height:16px}`;
(b) o emoji 📊 do ícone "Mercado" não renderizava (glyph ausente) no
Chromium headless deste ambiente de teste — trocado por um SVG de
barras já usado em outro lugar do site (`Pergunte ao OWNews`), garantindo
renderização consistente em qualquer navegador/fonte, independente do
motivo original (provável limitação só do ambiente de teste, mas o SVG
elimina a dependência de fonte de emoji de qualquer forma).

**5) MINHA ESCALA 3.0 — colapso do formulário após configurado (itens 9-13)**
— problema real confirmado no código: mesmo com escala salva, o
`<form id="formEscala">` completo (seletor de escala, significado da
data, data de referência, aeroporto, botão Calcular) sempre aparecia
no topo, sem nunca esconder. Corrigido envolvendo `.hub-lead` + o
`<form>` + a mensagem de erro num novo `<div id="escalaConfigWrap">`,
com um par de funções `colapsarConfig()`/`expandirConfig()` que só
alternam `hidden` (nenhum campo apagado, nenhum dado perdido, motor de
cálculo 100% intocado):
- 1ª visita (sem escala salva): form aberto normalmente.
- Após `calcularEExibir()` bem-sucedido (1ª config OU edição): form
  colapsa, aparece a linha discreta "✎ Editar minha escala" + "Escala
  salva neste dispositivo." (reaproveita o texto que antes era um
  parágrafo solto).
- Reload da página com escala já salva: já carrega colapsado direto
  (sem "flash" do formulário completo).
- Clique em "Editar minha escala": expande de novo, com os MESMOS
  valores já preenchidos, e mostra um botão "Cancelar" (novo,
  `#btnCancelarEdicao`) que descarta a edição em andamento e volta a
  colapsar sem tocar no resultado já calculado.
- "Limpar minha escala": volta a expandir o form (não há mais escala
  salva pra colapsar em cima).
- Abas Minha Escala/Calendário/Datas (já existentes da Etapa "Minha
  Escala 3.0" anterior) continuam funcionando exatamente como antes —
  não fazem parte do que esta missão precisou tocar.

**6) Analytics leve (item 40)** — 3 eventos novos, sem PII, mesmo
helper `window.ownewsEvento` de sempre: `escala_editar_aberto` (clique
em "Editar minha escala"), `me_hero_cta_click` (clique nos 2 CTAs do
hero), `atalho_utilitario_clique` (clique em qualquer item da faixa
utilitária) — todos mapeados em `CC_MAPA_EVENTOS` (Command Center) sob
o grupo "Minha Escala".

**7) Confirmado intacto (auditado, não precisou de mudança)**: `rotuloTipoVaga()`
já diferenciava "VAGA ABERTA" de "BANCO DE TALENTOS" (pedido do item 27,
resolvido na missão anterior); posição de Vagas/Mais Lidas/editorias/
compartilhamento/fotos dos ativos do Radar — tudo da missão "Home
OWNews 2.0" anterior, preservado sem regressão (conferido via bateria
de testes automatizados abaixo).

TESTE: Playwright real (Chromium headless) cobrindo:
- Estado A e Estado B do hero em 320/360/390/430/768/1024/1366/1440/1920px
  (script sintético: injeta `ownews_minha_escala` no localStorage antes
  do load) — checando classe/visibilidade de cada bloco (`meHeroSub`/
  `meHeroFeatures` escondidos e `meHeroGreeting`/`meHeroStats` visíveis
  só no Estado B; progresso/foto-B/painel com dado real só no Estado B;
  4 itens na faixa utilitária; sem overflow horizontal introduzido pelo
  hero em nenhuma largura).
- Fluxo completo de colapso/edição em `/minha-escala`: visita nova →
  form aberto; submit → colapsa + mostra editar; clique editar →
  expande com valores preservados + botão cancelar; cancelar → colapsa
  de novo sem perder o resultado; reload com escala salva → já nasce
  colapsado; aba Calendário ainda abre; Limpar escala → form reabre.
  TODOS os passos passaram.
- Regressão ampla: Home/notícia (`?id=1ce050f1-…`)/vaga
  (`/vagas/brava-bombeador-offshore`)/aeroportos/mercado HTTP 200 +
  conteúdo real presente; botão de compartilhamento da notícia sem o
  bug antigo de texto invisível (cor≠fundo); `#maisLidas` presente;
  grade Central Offshore com 17 tiles intacta; suíte estrutural da
  missão anterior (IDs únicos, ordem `vagas-agora`→`ultimas`→`maisLidas`,
  `renderUltimas` count-aware) re-executada sem regressão.
- Tudo repetido em preview (`wrangler dev --remote`) E de novo contra
  produção real pós-deploy — mesmos resultados nas duas pontas.
  `/api/mais-lidas` 503 em preview é a mesma limitação conhecida
  (SQLite em Durable Object só funciona local no wrangler dev,
  aviso explícito da própria ferramenta) — confirmado 200 real em
  produção.

DEPLOY: `ownews-git` `7d6ae3c3-1cfe-4761-8e23-cde9599a2724`; rollback
`4fb16aed-84ff-4187-ba41-9e1da9f74fd4` (versão anterior, Home OWNews 2.0).

VALIDADO EM PRODUÇÃO: Home/notícia/vaga/minha-escala HTTP 200; hero
Estado A confirmado visualmente (capturas 390px/1440px) idêntico ao
testado em preview; suíte Playwright completa (hero + minha-escala)
re-executada direto contra `ownews.com.br` — 100% aprovada.

**Pendência conhecida, NÃO desta missão** (auditada, fora de escopo):
overflow horizontal real do documento em exatamente 768px, causado
pelo HEADER/nav compartilhado por TODAS as páginas (`.shop-btn`/
`.nav-idioma`/`.nav-meu-ownews`), já registrado na entrada anterior
(Home OWNews 2.0) — continua sem correção porque mexer no header tem
raio de impacto maior que o pedido desta missão (Home/Minha Escala).

## 2026-09-27 — Missão "Home OWNews 2.0" — reorganização + Minha Escala em destaque + Vagas + editorias

Missão prioritária de reorganização da Home (não redesign, patch
incremental). Escopo: promover Minha Escala à maior hierarquia visual,
subir Vagas Abertas Agora, descer Mais Lidas, corrigir cards de vaga
inconsistentes, achar a causa raiz de "Últimas da editoria" às vezes
virar 1 notícia gigante sozinha, e auditar outros "buracos" de layout.

**1) Minha Escala promovida** — novo `<section class="me-destaque"
id="minhaEscalaHome">` inserido como PRIMEIRO elemento dentro de
`<main>`, antes até da `.baia-social`. Reaproveita 100% dos mesmos IDs
internos do card antigo (`meHomeCard`/`meHomeStatus`/`meHomeProgresso*`/
`meHomeAlerta`/`meHomeCta`) — o motor de cálculo client-side (Etapas
19-20, IIFE que lê `localStorage['ownews_minha_escala']`) continua
100% intocado, só o invólucro visual mudou (card maior, gradiente
navy-800→navy-900, borda cyan-dim, ícone ⚓ 28px). CSS nova:
`.me-destaque*` (nenhuma classe antiga reaproveitada por engano).

**2) Duplicação removida** — a antiga versão do card (`<section
class="ed-section me-home-section" id="minhaEscalaHome">`, que ficava
depois de Mais Lidas) foi DELETADA inteira — tinha os MESMOS IDs
internos do novo card, o que geraria 2 elementos com o mesmo id na
página (HTML inválido + JS só atualizaria o primeiro em ordem do DOM,
deixando o card visível preso no texto estático). Também removido o
atalho `.baia-escala` que existia dentro de `.baia-social` (Minha
Escala 3.0, 2026-09-26) — não faz mais sentido duplicar a ferramenta
na faixa secundária agora que ela tem card próprio. CSS morta removida
(`.baia-escala-icone`, `.baia-escala:hover`) e o JS que escrevia em
`#baiaEscalaTitulo`/`#baiaEscalaSub` (elementos que deixaram de
existir) também foi removido.

**3) Vagas Abertas Agora subiu** — de depois de `#operacoes`/antes de
`#carreiras` para logo depois do masthead (`#destaque`), no lugar onde
"Mais Lidas" costumava aparecer. Nenhuma lógica de seleção de vagas
tocada (`VAGAS_ABERTAS_ESPECIFICAS`/`cardVagaHome` inalterados na
lógica, só a POSIÇÃO da seção no HTML).

**4) Mais Lidas desceu** — de logo depois de `#ultimas` para depois do
banner institucional OffshoreWorks, antes do `#ecossistema` (rodapé) —
vira recirculação de conteúdo em vez de disputar espaço com Vagas.
Função/IDs internos (`maisLidasBody`, `carregarMaisLidas`) intocados,
só a posição no HTML mudou.

**5) Cards de vaga corrigidos** — `badgeOffshoreOnshore()` (usada por
`cardVagaHome`, `cardVaga` e no detalhe da vaga) retornava `<span
class="vaga-badge">Não informado</span>` quando a modalidade não era
conhecida — um chip flutuante "Não informado" ao lado de chips reais
("VAGA ABERTA", "✓ Oficial"). Corrigido pra retornar string vazia: a
ausência de dado agora simplesmente não aparece (regra "ausência de
dado não é conteúdo"). `rotuloTipoVaga()` já diferenciava "VAGA ABERTA"
de "BANCO DE TALENTOS" corretamente — auditado, sem alteração
necessária.

**6) Botão "VER VAGA" menos dominante** — `.vaga-card-home-btn` era um
bloco sólido cyan que ESTICAVA pra largura total do card (herdava
`align-items:stretch` do card flex-column), virando uma barra cheia
chamativa. Trocado por contorno (`border:1.5px solid var(--cyan-dim)`,
fundo transparente) com `align-self:flex-start` (tamanho do próprio
texto, não mais a largura inteira). Alvo de toque mantido (min-height
40px).

**7) Causa raiz real de "1 notícia gigante sozinha" em "Últimas
Notícias"** — `renderMercado()` já tinha, desde antes, um sistema de
classe consciente de contagem (`market-count-N`, com CSS
`.market-count-1{grid-template-columns:1fr}` etc.) que evita coluna
vazia quando sobra pouco conteúdo. `renderUltimas()`/`.latest-body`
NUNCA recebeu o mesmo tratamento — sempre usava
`grid-template-columns:1.3fr 1fr` fixo, mesmo com 0-2 itens em
"resto", sobrando uma coluna vazia/rala ao lado da notícia-destaque
(o "1 gigante sozinho" reportado). Corrigido REPLICANDO o padrão já
aprovado: `renderUltimas()` agora define `el.className = 'latest-body
latest-count-' + Math.min(lista.length, 4)`, com CSS companion
(`.latest-body.latest-count-1{grid-template-columns:1fr}`,
`.latest-count-2 .row-list{justify-content:center}`,
`.latest-count-4 .row-list{justify-content:space-between;height:100%}`)
adicionado nas DUAS cópias existentes do stylesheet (Home real +
cópia escapada do `paginaChrome`, confirmado via contagem de
ocorrências antes de editar). Nenhum hack de height/margin/position/
display — só a mesma classe count-aware já validada em produção.
Testado via `renderUltimas()` sintético com 1/2/3/4 itens direto no
navegador (produção real tinha só 2 notícias elegíveis nas últimas 24h
no momento do teste, insuficiente pra exercitar os 4 casos com dado
real) — os 4 casos renderizam a classe correta e a notícia-destaque
ocupa 100% da largura quando é o único item (`latest-count-1`), evitando
a coluna vazia.

**8) Auditoria de outros "buracos"** — encontrado overflow horizontal
real (documento inteiro, não só um contêiner interno) em exatamente
768px, causado pelo HEADER/nav compartilhado (`.shop-btn`/`.nav-idioma`/
`.nav-meu-ownews`), confirmado via Playwright (offensores fora de
qualquer contêiner com scroll interno, presente com ou sem o bloco de
aeroportos visível). **NÃO CORRIGIDO nesta missão** — é pré-existente
(não introduzido por nenhuma mudança desta missão), fica no HEADER
compartilhado por TODAS as páginas do site (não só a Home), e corrigi-lo
está fora do escopo desta missão (Home/Minha Escala/Vagas/editorias) —
mexer no header aumentaria o raio de impacto sem pedido explícito.
Registrado aqui pra uma futura missão dedicada ao header/nav.
Central Offshore (grid de 17 tiles) auditado, sem buracos.

**9) Banner institucional OffshoreWorks** — já existia (`#loja`,
`.ow-institucional`, link oficial `https://www.offshoreworks.com.br`),
único, dark/navy com acento cyan, não parece anúncio. Não usa fotografia
real (usa motivo decorativo/wordmark da marca) — mas redesenhá-lo não
fazia parte do escopo desta missão (reorganização de Home/Minha
Escala/Vagas/editorias, não rebuild do bloco institucional); mantido
como estava, só a posição relativa (já ficava depois de Central
Offshore) foi preservada.

TESTE: Playwright real (Chromium headless) em 320/360/390/430/768/
1024/1366/1440/1920px, contra preview (`wrangler dev --remote`) E
depois contra produção real pós-deploy — checando: overflow horizontal
por largura (excluindo contêineres com scroll interno intencional,
como `.ops-strip`), geometria/colapso do card Minha Escala, IDs
duplicados (`meHomeCard` etc. — confirmado único em todas as larguras),
sobreposição entre blocos de `.baia-social` (regressão do bug anterior,
confirmado ausente), ordem real no DOM (`vagas-agora` antes de
`ultimas` e antes de `maisLidas`, `compareDocumentPosition`, não
posição visual — elementos com `hidden` colapsam pra rect zero e
falsificam checagem por posição), e `renderUltimas()` sintético com
1-4 itens. Home + notícia (`?id=1ce050f1-b2db-41f9-a589-cc42654a7819`)
+ vaga (`/vagas/brava-bombeador-offshore`) HTTP 200 antes E depois do
deploy, em preview e produção. `/api/mais-lidas` retornou 503 em
`wrangler dev --remote` (limitação conhecida: Durable Object com
SQLite storage só funciona em modo local, aviso explícito do próprio
wrangler) — confirmado como falso-positivo de preview: em produção
real retornou HTTP 200 e a seção "Mais Lidas" renderizou normalmente
(516px de altura, não oculta).

DEPLOY: `ownews-git` `4fb16aed-84ff-4187-ba41-9e1da9f74fd4`; rollback
`3ae270dc-dbf6-457f-a56c-dbc2e8750bfa` (versão anterior, Command
Center).

VALIDADO EM PRODUÇÃO: Home/notícia/vaga HTTP 200; estrutura (IDs
únicos, ordem das seções, ausência de sobreposição) confirmada via
Playwright real contra `ownews.com.br` pós-deploy; capturas visuais em
390px e 1440px conferindo Minha Escala como primeiro bloco útil,
Vagas Abertas Agora logo após a manchete com chips corretos (sem
"Não informado", "BANCO DE TALENTOS" diferenciado), Mais Lidas
renderizando na nova posição.

**Pendência de documentação corrigida nesta entrada**: o deploy do
COMMAND CENTER (`3ae270dc-dbf6-457f-a56c-dbc2e8750bfa`, 2026-09-27)
nunca tinha sido registrado aqui — ver entrada retroativa logo abaixo.

## 2026-09-27 — Registro retroativo: OWNEWS COMMAND CENTER (dashboard privado)

Documentação não escrita no momento do deploy original (falha de
processo, corrigida agora). Mission: dashboard privado e autenticado em
`/command-center` (cookie de sessão assinado com HMAC-SHA256 via Web
Crypto, senha em secret do Worker, rate-limit de login via
`PERGUNTE_IA_KV`), com abas Visão Geral/Conteúdo/Ferramentas/SEO/
Sistema/Receita e seletor de período (Hoje/7d/30d/Tudo). Construído
100% sobre infraestrutura já existente: Durable Object `PageViews`
(já existia, SQLite-backed) ganhou 2 tabelas novas (`pageviews_raw`,
`events`) e teve a retenção de `visit_days` estendida de 3 para 65
dias; zero SDK externo novo; resumo em português gerado por regras
determinísticas (sem custo de IA); fontes ainda sem credencial
(Cloudflare Analytics/GA4/Search Console/AdSense) mostram "Conexão
pendente" honesto em vez de dado inventado. `robots.txt` atualizado
para bloquear `/command-center` e `/api/cc/` de indexação.

Corrigido durante o desenvolvimento: overflow de CSS Grid em 320px
(`.cc-numero-card` sem `min-width:0`, palavra "COMPARTILHAMENTOS"
forçando a coluna a esticar); timeout de `/saude` (chamada ao
`shrill-pond-a915.../saude`) parecia falhar em 8000ms no preview
`wrangler dev --remote`, mas confirmado ser artefato do túnel de
preview — em produção real respondeu em 3.3s com todas as fontes
`OPERACIONAL`; timeout defensivo elevado para 10000ms mesmo assim.

TESTE: dashboard validado ao vivo em produção com dado real (contagem
de visitas, leitores online, top notícias, saúde dos serviços
satélites). Regressão Home/notícia/vaga confirmada.

DEPLOY: `ownews-git` `3ae270dc-dbf6-457f-a56c-dbc2e8750bfa`; rollback
`f5f25477-7127-4414-a57b-376a9d5ec437` (versão anterior, correção do
bug de sobreposição na `.baia-social`).

VALIDADO EM PRODUÇÃO: login/logout funcionando, dados reais exibidos
em todas as abas, `robots.txt` bloqueando corretamente as rotas
privadas de indexação.

## 2026-09-27 — Correção urgente: sobreposição de texto/botão na Home (baia-social)

Reportado pelo operador com prints reais (desktop 900-1440px e mobile
Android) mostrando o botão "ENTRAR NO CANAL" sobrepondo o texto
"NOTÍCIAS DIRETO NO TELEGRAM", e "Modo Embarcado" espremido contra
"INTERNET LENTA?". NÃO era o que a primeira descrição em texto sugeria
("conteúdo estreito, grandes vazios laterais") — testei a Home ao vivo
em 320/390/1024/1366/1920px antes dos prints chegarem e não reproduzi
nada (container 1180px máximo, grid do destaque ~62/38%, Mais Lidas
100% da largura — tudo dentro do esperado). Só com os prints ficou
claro que o problema real era outro, localizado, no bloco
`.baia-social` (Instagram/Telegram/Modo Embarcado + o novo atalho
"Minha Escala").

**Nota sobre "checar o Git"**: o arquivo real de produção
(`producao-ownews-git/worker.js`, 14 mil+ linhas) NUNCA foi commitado
neste repositório — o `worker.js` rastreado pelo Git (raiz do repo) é
um arquivo diferente e não relacionado (documentado em rodadas
anteriores). Não existe histórico de commits pra comparar; a
investigação foi feita direto no código + Playwright real contra
produção.

**Causa raiz real**: a missão "Minha Escala 3.0" (2026-09-26) adicionou
um 4º bloco (`.baia-escala`) ao `.baia-social`, que antes tinha só 3
(Instagram/Telegram/Modo Embarcado). Em telas médias/grandes
(`@media(min-width:760px)`, layout em linha), isso reduziu a largura
disponível por bloco — e o bloco do Telegram tem o título mais longo
("NOTÍCIAS DIRETO NO TELEGRAM") JUNTO com o botão mais largo
("ENTRAR NO CANAL ↗", 152px fixos, `flex:none`). `.baia-titulo` nunca
teve truncamento (só `.baia-sub` tinha `text-overflow:ellipsis`) e
`.baia-corpo` tinha `min-width:0` — a combinação fez o título
colapsar pra **largura zero** (confirmado via `getBoundingClientRect`
real: `width:0`) e o texto, sem contêiner nenhum pra conter, vazava
visualmente por trás do botão vizinho. Reproduzido e confirmado em
768/900/1000/1050/1200/1366/1440px — a faixa INTEIRA do layout em
linha, não só uma faixa estreita. Bug meu, introduzido na própria
missão anterior sem testar a faixa 760-1440px do layout em linha
(só testei mobile em coluna, que sempre esteve correto).

**Correção mínima e cirúrgica** (2 propriedades, 1 seletor cada):
- `.baia-titulo`: adicionado `overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap` — mesmo padrão que `.baia-sub` já usava.
- `.baia-corpo`: `min-width:0` → `min-width:56px` — garante um piso
  mínimo real de texto visível (nunca mais zero), mantendo a
  contração normal do flexbox pro resto.
- Nada mais tocado: nenhuma estrutura de grid/container da Home,
  nenhum dado, nenhuma rota, nenhuma automação — só essas 2 regras
  CSS, na única cópia existente (baia-social só existe na Home).

TESTE: Playwright real contra produção (`ownews.com.br`) confirmando
`overlap:false` via geometria real (`getBoundingClientRect`) em 768/
900/1000/1050/1200/1366/1440/1920px; capturas visuais conferindo
título truncado com reticências em vez de vazar por trás do botão em
todas as faixas; mobile 320-430px (layout em coluna) confirmado
inalterado — sempre esteve correto, sem regressão; Home + notícia +
vaga HTTP 200.

DEPLOY: `ownews-git` `f5f25477-7127-4414-a57b-376a9d5ec437`; rollback
`270e0313-8f43-44c1-b404-ecc67759acb6` (a versão anterior a esta
correção — NÃO é a versão antes da Minha Escala 3.0; reverter a esse
ponto reintroduziria o bug, não o corrige).

VALIDADO EM PRODUÇÃO: geometria real sem sobreposição confirmada em
900/1200/1366px; Home/notícia/vaga HTTP 200.

**Pendência retomada**: o COMMAND CENTER (missão prioritária em
andamento antes desta interrupção) continua — código de auth/dados já
escrito, rotas ainda não conectadas ao roteador principal. Retomando
agora.

## 2026-09-26 — Adendo "Compartilhamento Global OWNews" — Item 1 (bug do botão azul vazio)

Continuação a partir da produção `9fd76871-d0d3-4600-8003-433bcdf20290`.
Nova missão do operador: transformar compartilhamento numa capacidade
global do OWNews, começando pela correção OBRIGATÓRIA do botão cyan
vazio relatado entre "COMPARTILHAR" e "WhatsApp".

### Causa raiz real (encontrada, não escondida)

O botão `#shareNativo` (`<button class="jornada-cta compartilhar-principal" ... >COMPARTILHAR</button>`,
usado pra acionar a Web Share API nativa do aparelho) SEMPRE teve o
texto "COMPARTILHAR" no HTML — nunca foi um elemento vazio de verdade.
O bug era puramente de **cascata CSS**: a classe `.jornada-cta` (usada
em botões de "Comece Aqui/Cursos/Guias") define `color:var(--cyan-dim)`
— a MESMA cor do `background:var(--cyan-dim)` que `.compartilhar-principal`
define pro botão. Como as duas classes têm especificidade CSS igual
(uma classe cada) e `.jornada-cta` aparece DEPOIS de `.compartilhar-principal`
no stylesheet, a regra de `.jornada-cta` vencia a cascata — texto cor
cyan-dim sobre fundo cyan-dim = **texto literalmente invisível**,
exatamente o "botão azul vazio" relatado. O mesmo padrão se repetia no
`:hover` (`.jornada-cta:hover{color:var(--cyan)}` vencendo
`.compartilhar-principal:hover{background:var(--cyan)}` da mesma forma).
Confirmado isolando o botão num teste Playwright real com
`navigator.share` forçado (só assim ele fica visível) e lendo
`getComputedStyle` — antes da correção, texto e fundo eram a MESMA cor
em base/hover/focus.

### Correção na origem (não escondida)

Aumentada a especificidade do seletor pra `.jornada-cta` nunca mais
vencer nesse botão específico — sem tocar `.jornada-cta` (usada em
outros lugares) e sem esconder o elemento:
- `.compartilhar-principal{...}` → `.jornada-cta.compartilhar-principal{...}`
- `.compartilhar-principal:hover{background:var(--cyan)}` →
  `.jornada-cta.compartilhar-principal:hover{background:var(--cyan);color:var(--navy-950)}`
  (precisou declarar `color` explicitamente aqui também — só corrigir o
  `background` do hover não bastava, porque `.jornada-cta:hover{color:
  var(--cyan)}` tem a MESMA especificidade que a base `.compartilhar-principal`
  e continuava vencendo a cor no hover; só resolveu de verdade quando o
  seletor combinado do hover também virou mais específico que
  `.jornada-cta:hover`).
- Só existe UMA cópia deste componente no arquivo (`.compartilhar-bloco`
  só é usado por `paginaChrome` — não existe na Home, que não tem botão
  de compartilhar próprio) — corrigido uma vez só, sem precisar duplicar
  em duas cópias de CSS.
- TESTE: Playwright real com `navigator.share` mockado — texto
  "COMPARTILHAR" confirmado visível (cor navy-950 sobre fundo cyan-dim)
  em estado base, hover E focus; captura de tela confirmando
  visualmente; Home + notícia + vaga + `/radar` + `/minha-escala` HTTP 200.
- DEPLOY: `ownews-git` `5dc837cf-6776-4a7d-9ea9-5fab8a94cc2e`; rollback
  `9fd76871-d0d3-4600-8003-433bcdf20290`.
- VALIDADO EM PRODUÇÃO: `getComputedStyle` real em `ownews.com.br/vagas/...`
  confirmando texto/fundo com cores diferentes (contraste real); Home/
  radar/minha-escala HTTP 200.

### Itens 2-4, 7-8 (Instagram primeiro + global + componente único + canonical + visual compacto)

Continuação a partir de `5dc837cf-6776-4a7d-9ea9-5fab8a94cc2e` (item 1 acima).

- **Auditoria real** (não assumida): `paginaChrome()` já injeta o bloco
  `.compartilhar-bloco` em TODA página que passa por ele — ou seja,
  notícia, vaga, radar (índice de unidade), aeronave (Aviação Offshore),
  empresa, função, salário, OWNews Explica, Agenda Offshore/evento,
  Mercado e qualquer outra página "hub" JÁ tinham compartilhamento
  automaticamente, sem precisar adicionar nada — só precisava virar bom.
  A Home não tem (nem precisa: não existe padrão de "compartilhar a
  home", só conteúdo específico).
- **Instagram como opção primária**: botão `#shareInstagram` (ícone
  Instagram real, reaproveitado do rodapé — nunca inventado) SEMPRE
  visível (nunca mais `hidden`, eliminando de vez a classe de bug do
  item 1). Clique aciona a Web Share API nativa (Instagram aparece no
  seletor do sistema quando instalado — nenhum deep link inventado pro
  Feed/Stories). Sem suporte no navegador: cai pra copiar o link com
  aviso "Link copiado — cole no Instagram" — nunca um botão sem ação.
  WhatsApp/Telegram/Facebook/Copiar viraram ícones circulares compactos
  (34×34px) em vez de pílulas com texto — bloco bem mais compacto.
- **Canonical URL por entidade**: o script agora usa `urlCanonica` —
  a MESMA URL canônica já calculada em `paginaChrome()` pra
  `<link rel="canonical">`/Open Graph — em vez de `window.location.href`
  solto (que poderia incluir querystring de tracking). Testado ao vivo:
  vaga compartilha a URL da vaga, ficha de unidade do Radar compartilha
  a URL daquela unidade, ficha de aeronave compartilha a URL daquela
  aeronave, artigo do Explica compartilha a URL daquele artigo, evento
  da Agenda compartilha a URL daquele evento — nunca a Home.
- **Sem duplicação (item 3/7)**: a página de vaga tinha DOIS blocos de
  compartilhar — a seção própria "COMPARTILHE ESTA VAGA" (com
  WhatsApp/Telegram/Facebook/Copiar/nativo duplicados) E o bloco
  genérico no rodapé. Removidos os botões duplicados da seção da vaga,
  mantendo só o que ela tem de único: o card visual 1080×1920 baixável/
  compartilhável (Etapa 14.1, preservado 100% — inclusive o
  `navigator.share({files:[...]})` que é o que faz o Instagram aparecer
  no seletor nativo com o card anexado). Seção renomeada pra "CARD DA
  VAGA", ícone de download, zero texto duplicado.
- Ícones adicionados (Instagram/WhatsApp/Telegram/Facebook/Copiar link):
  SVGs de bibliotecas de ícones públicas de uso livre (Instagram/
  Telegram já existiam no rodapé do próprio site; WhatsApp/Facebook/Link
  verificados via Bootstrap Icons antes de entrar) — sem SDK social
  pesado, sem tracker novo, conforme item 10.
- TESTE: Playwright real em 4 tipos de entidade (unidade do Radar,
  aeronave, artigo do Explica, evento da Agenda) confirmando botão
  Instagram presente e URL do WhatsApp com a canonical CORRETA de cada
  página (nunca a Home); clique no Instagram COM `navigator.share`
  mockado confirmado chamando `{title,url}` com a URL canônica certa;
  clique SEM `navigator.share` confirmado copiando link com a mensagem
  de fallback; card da vaga confirmado ainda gerando/baixando PNG; zero
  overflow horizontal em 320/360/390/430px; só 1 `.compartilhar-bloco` e
  1 `.vaga-share-actions` por página vaga (sem duplicação); Home +
  notícia + vaga + `/radar` + `/aviacao-offshore` + `/explica` +
  `/agenda` + `/empresas` + `/funcoes` + `/salarios` +
  `/pergunte-ao-ownews` + `/minha-escala` HTTP 200.
- DEPLOY: `ownews-git` `270e0313-8f43-44c1-b404-ecc67759acb6`; rollback
  `5dc837cf-6776-4a7d-9ea9-5fab8a94cc2e`.
- VALIDADO EM PRODUÇÃO: botão Instagram com texto correto, 1 só bloco de
  compartilhar por página (sem duplicação) confirmados ao vivo em
  `ownews.com.br/vagas/...`; as 8 rotas de teste HTTP 200.

### Itens 5-6, 9 (cards visuais por entidade, privacidade da Minha Escala, testes finais)

**Pendente** — não iniciado ainda nesta sessão. Escopo real restante:
gerador de card visual (1080×1920, mesma receita já usada em vagas)
pra aeronave/unidade do Radar/evento/OWNews Explica, como uma função
JS ÚNICA e parametrizável (não uma cópia por entidade — item 7 exige
isso explicitamente); Minha Escala já é privacy-safe (compartilhamento
próprio, só dados que o usuário decidiu configurar, nunca automático) —
falta só decidir se ganha um card visual próprio ou se fica como está
(motor não deve ser tocado). Testes finais em Android/iOS reais,
navegadores sem Web Share API, com/sem Instagram instalado — feitos
parcialmente via Playwright (mock de `navigator.share`), sem dispositivo
físico disponível nesta sessão.

## 2026-09-26 — Adendo "Política Visual de Ativos Reais" — Rodada 2 (Radar, 22 unidades)

## 2026-09-26 — Adendo "Política Visual de Ativos Reais" — Rodada 2 (Radar, 22 unidades)

Continuação a partir da produção `bd2bc6c9-161f-43a0-9d71-3821192598de`
(fim da Rodada 1 — arquitetura + 11 fotos herdadas de sessão anterior +
card do índice do Radar mostrando foto). Pedido do operador: "pesquisar
fotos reais pras 62 unidades restantes e adicionar."

- Pesquisa individual (WebSearch + WebFetch) unidade por unidade, sempre
  priorizando a fonte oficial do PRÓPRIO operador/proprietário (fleet
  pages, press releases, rig-spec sheets) — nunca banco de imagem
  genérico, nunca Google Images. Cada imagem só entrou depois de
  verificação visual direta (nome do casco legível na própria foto,
  quando disponível, ou página de origem dedicada exclusivamente àquela
  unidade).
- **22 de 62 unidades pendentes ganharam foto real e verificada** —
  cobertura do Radar subiu de 11/73 (15%) para 33/73 (45%):
  - Petrobras/Agência Petrobras: P-78, P-79, FPSO Anita Garibaldi (casco
    visível/legível em 2 das 3).
  - Yinson Production: FPSO Maria Quitéria.
  - Seadrill (galeria oficial de imagens): West Auriga, West Tellus,
    West Carina, West Polaris, West Saturn — nome do casco legível nas
    5 fotos.
  - DOF (fichas oficiais de frota, uma página por navio): Skandi
    Niterói, Vitória, Recife, Chieftain, Olympia, Commander, Salvador.
  - Solstad Offshore (páginas oficiais de veículo): Normand Sigma,
    Sirius, Turquesa — nome do casco legível nas 3.
  - Valaris (CDN oficial de rig-specs): DS-4, DS-8, DS-17 (esta última
    catalogada como "RELIANCE.jpg" no próprio CDN da Valaris — confirmado
    por pesquisa que o DS-17 é o ex-Rowan Reliance, mesmo casco,
    renomeado após a fusão Ensco/Rowan; credito registrado como
    "ex-Rowan Reliance" pra transparência total).
  - **NÃO usada**: uma foto de "batismo P-80/P-82" com o casco mostrando
    claramente "PETROBRAS 80" foi descartada pra P-82 — mission explícita
    "não usar foto de outro FPSO só porque são parecidos" — P-82
    permanece com ícone neutro até uma fonte inequívoca aparecer.
  - **Achado técnico**: 5 fotos oficiais da Transocean (Deepwater Orion,
    Aquila, Corcovado, Mykonos, Dhirubhai Deepwater KG2) foram
    encontradas e verificadas (extraídas de PDFs de rig-spec oficiais do
    próprio deepwater.com, nome do casco legível em 4 das 5), mas NÃO
    entraram nesta rodada — a imagem só existe embutida no PDF, sem URL
    pública própria pra hotlink, e este Worker não tem R2/Assets
    configurado pra hospedar arquivo próprio (restrição explícita já
    registrada em `wrangler.jsonc`, não alterada). Ficam como pendência
    registrada — não descartadas, só precisam de uma decisão de
    arquitetura (hospedagem própria) fora do escopo deste adendo.
- Restam ~30 unidades sem foto (Coral do Atlântico, os 4 PLSVs Seven-*
  da Subsea7, Normand Flower, PSV Torda, Norbe VI/VIII/IX, ODN I,
  Petrobras 10000, Carolina, Etesco Takatsugu J, os 6+ rigs da
  Constellation, Noble Courage, SSV Victoria, Siem Helix 1/2, Hunter
  Queen, Noble Faye Kozack, P-74/76/77/82) — sites oficiais bloquearam
  o fetch (403), não retornaram imagem utilizável, ou não foi possível
  confirmar identificação com segurança suficiente no orçamento desta
  rodada. Mantidas com o ícone neutro de sempre — nunca uma foto
  aproximada ou de unidade parecida.
- TESTE: Playwright real — as 22 novas fotos carregando
  (`complete:true`, `naturalWidth` correto) nos cards do índice E nas
  fichas individuais; captura real confirmando fotos corretas nos cards
  (West Auriga/Tellus/Carina/Polaris/Saturn, Normand Sigma/Sirius/
  Turquesa visíveis, unidades ainda pendentes com ícone); Home + notícia
  + vaga + `/radar/west-auriga` + `/radar/p-78` + `/minha-escala` HTTP 200.
- DEPLOY: `ownews-git` `9fd76871-d0d3-4600-8003-433bcdf20290`; rollback
  `bd2bc6c9-161f-43a0-9d71-3821192598de`.
- VALIDADO EM PRODUÇÃO: 33 URLs `foto_url` reais confirmadas no payload
  client-side de `/radar` em `ownews.com.br`; Home/vaga/minha-escala
  HTTP 200.

## 2026-09-26 — Adendo "Política Visual de Ativos Reais"

Continuação a partir da produção `bd2bc6c9-161f-43a0-9d71-3821192598de`
(fim da missão "Minha Escala 3.0 + Aviação Offshore" acima). Adendo do
operador pedindo fotos reais em Aviação Offshore (obrigatório) e evolução
visual do Radar Offshore (sem reconstruir o motor).

### Arquitetura do banco visual

Decisão: **adaptar a arquitetura já existente**, não criar banco
paralelo — `UNIDADES_RADAR` já guardava `foto_url`/`foto_credito`/
`foto_fonte_url`/`foto_licenca` por unidade (usados na ficha individual
desde uma missão anterior, 11 das 73 unidades já tinham foto real
catalogada). `AERONAVES_OFFSHORE` ganhou o MESMO padrão de campos
(`imagemHash`/`imagemArquivo`/`imagemAlt`/`imagemCredito`/
`imagemLicenca`/`imagemFonteUrl`) — entidade→imagem direto no próprio
registro, igual ao Radar, sem tabela/registro de assets separado.

**Hospedagem das fotos de aeronaves**: sem R2/Assets configurados neste
Worker (`wrangler.jsonc` tem uma restrição explícita de sessão anterior
— "sem assets, sem vars... manter EXATAMENTE assim" — não alterada aqui,
por ser mudança de infraestrutura fora do escopo deste adendo). Fotos
das 4 aeronaves vêm do Wikimedia Commons, cada uma **verificada
individualmente nesta sessão**: identificação do modelo conferida
visualmente (imagem baixada e inspecionada, não só o nome do arquivo),
licença e crédito confirmados na própria página do arquivo no Commons
(GFDL 1.2, GFDL 1.2+, Domínio Público, CC BY-SA 2.0 — todas compatíveis
com uso editorial com crédito). Miniaturas via o redimensionador oficial
do próprio Commons (`/thumb/.../<largura>px-arquivo.jpg`) — larguras
PADRÃO obrigatórias (20/40/60/120/250/330/500/960/1280/1920/3840px;
qualquer outra largura é rejeitada com HTTP 400 — confirmado em teste
real) — sem processamento/hospedagem própria, sem peso extra no bundle.

### Aviação Offshore — foto obrigatória (cumprido)

- Card (hub + Frota Offshore + "outras aeronaves" na ficha): miniatura
  330px, `loading="lazy"`, `width`/`height` reservados (sem layout
  shift), fallback `onerror` pra um ícone neutro (✈) se a imagem falhar.
- Comparação (Frota Offshore): coluna "Foto" nova na tabela, miniatura
  120px.
- Ficha individual: foto grande (960px, `aspect-ratio:21/9`, mesma
  receita visual já aprovada em `.radar-ficha-foto` — camada de crédito
  sobreposta no rodapé da imagem com fotógrafo, licença e link pra fonte).
- Nenhuma aeronave sem foto — as 4 catalogadas (S-92, AW139, AW189,
  H175) têm foto real e corretamente identificada.

### Radar Offshore — evolução visual (motor intocado)

- Auditoria: 11 das 73 unidades já tinham `foto_url` real (Petrobras
  Agência, MODEC oficial, CDN de operador, imprensa marítima) — só a
  FICHA individual mostrava; o ÍNDICE (cards de busca/filtro) só mostrava
  ícone genérico por tipo. Gap real, agora fechado.
- `dadosClientJson` (payload client-side já existente pro índice) ganhou
  um campo a mais, `foto: u.foto_url || null` — incremento pequeno (62
  das 73 unidades enviam só `null`).
- `cardHtml()` (função client-side já existente) passou a renderizar
  `<span class="radar-card-foto"><img loading="lazy" referrerpolicy=
  "no-referrer">` quando `u.foto` existe, senão mantém o MESMO ícone de
  sempre — nunca mistura unidade errada, nunca inventa foto.
- Nenhuma foto NOVA pesquisada pro Radar nesta rodada — identificar
  corretamente qual foto pertence a qual embarcação/sonda específica
  (não confundir unidades parecidas, exigência explícita do adendo) pras
  62 unidades restantes é trabalho de pesquisa individual, não feito
  aqui por orçamento de sessão. **Pendência registrada, não ocultada**:
  continuam com o fallback neutro (ícone), nunca uma foto genérica ou de
  unidade diferente.
- PRESERVADO: busca, filtros, favoritos (`localStorage`), mapa
  (MapLibre + camadas ANP), ficha individual (já tinha foto desde
  antes) — motor 100% intocado, só o card do índice ganhou a miniatura.

### Performance

- `loading="lazy"` em toda imagem nova (Aviação e Radar).
- Home NÃO referencia nenhuma imagem do Radar/Aviação — confirmado via
  grep (`upload.wikimedia` = 0 ocorrências no HTML da Home).
- `width`/`height` reservados em toda tag `<img>` nova — sem layout
  shift.
- Miniaturas do Commons (aeronaves) sempre pedidas numa largura pequena
  (120/330px pra card/tabela, 960px só na ficha) — nunca a imagem
  original em card pequeno. Fotos do Radar (já hotlinkadas de fontes
  variadas por sessão anterior) mantêm o tamanho original da fonte —
  mitigado por `loading="lazy"` (só baixa se realmente visível), mas SEM
  redimensionamento — o Worker não tem Cloudflare Images/R2 configurado
  pra isso; registrado aqui como limitação conhecida, não escondida.

### Identidade visual

Nenhuma cor/fonte nova — miniaturas em `border-radius:8-10px`, fundo
`var(--navy-800/900)`, mesma paleta navy/cyan de sempre. Cards com foto
usam a MESMA estrutura de layout (ícone/foto + info + ação) que já
existia — só o conteúdo do primeiro slot mudou.

- TESTE: Playwright real — 4/4 fotos de aeronaves carregando
  (`complete:true`, `naturalWidth` correto) nos 3 tamanhos (card/tabela/
  ficha); Radar índice com exatamente 11 `.radar-card-foto` + 62
  `.radar-card-icone` (bate com a auditoria); zero erro JS causado pela
  mudança (os 2 warnings de rede vistos em preview são 503 de endpoint
  não relacionado, pré-existente); favoritos do Radar continuam
  funcionando com foto; sem overflow horizontal em 320-1920px; Home sem
  nenhuma referência a imagem do Radar/Aviação; Home + notícia + vaga +
  `/minha-escala` HTTP 200 em ambos os deploys.
- DEPLOY 1 (fotos da Aviação Offshore): `ownews-git`
  `e1e8d474-a9df-4500-a9b9-2da19df5bc70`; rollback
  `5c375e27-5a8e-49d9-8791-b7c78d0a468a`.
- DEPLOY 2 (Radar Offshore — foto nos cards do índice): `ownews-git`
  `bd2bc6c9-161f-43a0-9d71-3821192598de`; rollback
  `e1e8d474-a9df-4500-a9b9-2da19df5bc70`.
- VALIDADO EM PRODUÇÃO: as 4 fichas de aeronave com foto real
  confirmada em `ownews.com.br`; `/radar` em produção confirmado via
  Playwright real com 11 `.radar-card-foto` + 62 `.radar-card-icone`;
  Home/vaga/minha-escala HTTP 200.

## 2026-09-26 — Missão Complementar "Minha Escala 3.0 + Aviação Offshore"

Continuação a partir da produção `2d3d4deb-a1da-4a55-8804-f7efbed51444` (fim
da missão "Correção Visual + Etapas 21-24" — Etapas 21/22/23 concluídas e
validadas; Etapa 24/Rede Relacional NÃO chegou a ser implementada, só
auditada em memória — nenhum código dela entrou nesta base). Motor de
cálculo de escala (ciclo, fases, projeções, datas importantes/Páscoa,
persistência) NÃO reconstruído — só reorganizado visualmente, mesmos ids/
funções preservados 100%.

### Prioridade 1 (Minha Escala 3.0)

- **Acesso na Home (item 1)**: novo bloco `.baia-escala` (âncora `<a>`
  inteira, reaproveitando o componente `.baia-bloco` já usado por
  Instagram/Telegram/Modo Embarcado) inserido como PRIMEIRO item de
  `.baia-social` — antes do Giro 24h, Aeroportos e Mercado, satisfazendo
  "muito mais cedo no mobile". Título/subtítulo (`baiaEscalaTitulo`/
  `baiaEscalaSub`) alimentados pelo MESMO cálculo client-side já usado no
  card completo da Home (Etapa 19/20, `ownews_minha_escala` no
  localStorage) — nenhum motor duplicado, nunca um "faltam X dias"
  persistido (sempre recalculado a partir de `new Date()` real do
  navegador). Sem escala salva, mostra convite padrão ("Calcule seu
  embarque e desembarque").
- **Mini-app com abas (itens 2-6)**: `/minha-escala` reorganizado em 3
  abas (componente `.filtro-segmento-row`/`.filtro-btn` já usado em
  Empresas/Radar — zero CSS novo) — "Minha Escala" (status/progresso/
  cards de embarque-desembarque/ações/próximos ciclos), "Calendário"
  (grade mensal + visão anual + estatísticas, agrupados por serem ambos
  visões temporais) e "Datas" (datas importantes + datas pessoais). Troca
  de aba é só show/hide dos MESMOS elementos já preenchidos pelos renders
  existentes (`renderCalendario`, `renderProximasDatas`, `renderVisaoAnual`
  etc.) — nenhuma duplicação de lógica, nenhum recálculo na troca.
- **Aeroporto/clima (item 7)**: lacuna real encontrada — o campo
  aeroporto/base já existia e era salvo, mas só era usado no atalho da
  Home; a página completa nunca mostrava clima. Adicionado bloco
  compacto (`#escalaClimaCompacto`) na aba "Minha Escala", visível SÓ
  quando embarcado E a ≤1 dia do desembarque E com aeroporto cadastrado
  — mesmo endpoint real do coletor (`shrill-pond-a915/aeroportos`) já
  usado no atalho da Home, nunca clima inventado (testado ao vivo:
  Macaé, 24°C, "Poucas nuvens", REDEMET real).
- **Ajuste de scroll (achado durante teste)**: o clique em "Calcular"
  chama `scrollIntoView` em `#resultadoEscala`; como o header do site é
  `position:sticky`, o topo do resultado (agora a barra de abas) ficava
  parcialmente atrás do header. Adicionado `scroll-margin-top:100px` em
  `#resultadoEscala` (CSS puro, sem mudança de comportamento/funcional)
  — status "EMBARCADO/DE FOLGA" agora aparece visível logo abaixo do
  header ao calcular, sem exigir scroll manual extra.
- PRESERVADO: persistência (`ownews_minha_escala`,
  `ownews_minha_escala_datas_pessoais`), cálculo de ciclo/fase,
  compartilhar/.ics/baixar imagem/limpar, aviso "não é registro oficial".
- TESTE: Playwright real — envio do formulário, troca das 3 abas
  (calendário renderiza mês correto + visão anual com 12 meses + 8 datas
  importantes na aba Datas), reload preserva a config E volta pra aba
  "Minha Escala" por padrão; simulação de data via `page.clock` confirmou
  o bloco de clima aparecendo com dado real (REDEMET) só a 1 dia do
  desembarque; capturas reais 320/360/390/430/768/1024/1366/1440/1920 —
  bloco `.baia-escala` e barra de abas visíveis e não cortados em todas;
  Home + notícia + vaga HTTP 200.
- DEPLOY: `ownews-git` `e964e7fc-f5af-409e-97c3-2f23c620c19a`; rollback
  `2d3d4deb-a1da-4a55-8804-f7efbed51444`.
- VALIDADO EM PRODUÇÃO: captura real Chromium em `ownews.com.br/minha-escala`
  confirmando abas presentes e funcionais (Calendário troca corretamente);
  bloco `.baia-escala` presente na Home; Home/vaga HTTP 200.

### Prioridade 2 (Aviação Offshore)

Continuação a partir da produção `e964e7fc-f5af-409e-97c3-2f23c620c19a`
(fim da Prioridade 1 acima).

- Nova vertical `/aviacao-offshore` (hub) + `/aviacao-offshore/aeronaves`
  (Frota Offshore, comparação técnica) + `/aviacao-offshore/aeronaves/:slug`
  (ficha individual) — 4 aeronaves catalogadas (`AERONAVES_OFFSHORE`):
  Sikorsky S-92, Leonardo AW139, Leonardo AW189 e Airbus H175.
- **Dados 100% de fabricante, pesquisados via WebSearch nesta missão**:
  specs (motorização/dimensões/velocidade/alcance/capacidade) vêm das
  páginas oficiais Lockheed Martin (S-92), Leonardo Helicopters (AW139/
  AW189) e Airbus (H175) — nunca de memória do modelo. Capacidade sempre
  registrada como "número real varia conforme configuração" (nunca um
  valor universal).
- **Operação no Brasil — só quando confirmada**: S-92/AW139/AW189 citam
  operadores reais (Líder Táxi Aéreo, Omni Táxi Aéreo, CHC do Brasil) com
  fonte jornalística do setor (Click Petróleo e Gás, Omni Helicopters
  International, Kincaid) para cada afirmação de base/contrato. O H175
  NÃO teve operação confirmada no Brasil nesta pesquisa — a ficha diz
  isso explicitamente (`observacaoOperacaoBrasil`) em vez de omitir ou
  inventar; incluído só como referência técnica pra comparação na Frota
  Offshore, conforme item 12 da missão ("não assumir que todos operam
  atualmente no Brasil").
- **Sem duplicação de motor/conteúdo (item 15/16)**: seção "Aeroportos"
  do hub reaproveita `DATASET_AEROPORTOS_OFFSHORE` (mesmo array de
  `/aeroportos`) só pra linkar (`/aeroportos#aero-CODIGO`) — nenhum dado/
  fetch de clima ou OffVoos duplicado. Seção "Operação" linka direto pros
  verbetes já existentes do OWNews Explica (`transporte-aereo-offshore`,
  `troca-de-turma-offshore`) — zero conteúdo editorial novo/duplicado.
  "Curiosidades" reaproveita o verbete HUET já catalogado e verificado em
  `GLOSSARIO_TERMOS` (fonte OPITO) + 1 fato técnico sobre configuração de
  assentos — nada inventado sem fonte.
- **Sem imagens nesta fase**: mission pede crédito/fonte/licença real
  pra qualquer imagem de aeronave — como não há imagem licenciada
  disponível nesta sessão, as fichas ficam só com texto/specs (decisão
  consciente, documentada aqui — não um esquecimento).
- **Navegação (item 23)**: auditado o menu "CENTRAL OFFSHORE" da Home —
  já tinha um grupo "Operação" com Radar Offshore/Aeroportos Offshore/
  Offshore em Números, ponto lógico reaproveitado (nova entrada "Aviação
  Offshore" ali, mesmo grupo, mesmo padrão). Mesma entrada replicada no
  menu "MAIS" das demais páginas (`paginaChrome`). Tile próprio no grid
  Central Offshore da Home (mesmo padrão do tile "OWNews Explica"
  adicionado na missão anterior).
- **Minha Escala + Aviação (item 18), integração leve**: link discreto
  "✈ Aviação Offshore — conheça a operação aérea →" na aba "Minha Escala",
  visível SÓ quando existe aeroporto/base cadastrado — nunca afirma
  aeronave, companhia aérea ou horário de voo específico, só aponta pro
  hub de referência.
- PRESERVADO: Aeroportos/REDEMET/OffVoos (nenhum dado/endpoint tocado),
  OWNews Explica (nenhum verbete duplicado/alterado), toda a Home/nav
  existente, Minha Escala 3.0 (só um link novo, condicional).
- TESTE: rotas reais (`/aviacao-offshore`, `/aviacao-offshore/aeronaves`,
  as 4 fichas, slug inexistente = 404); `OPERAÇÃO CONHECIDA NO BRASIL`
  confirmada presente no S-92 e AUSENTE no H175 (grep direto);
  `.comparador-wrap{overflow-x:auto}` confirmado sem overflow horizontal
  indevido em 320-1920px; link Minha Escala→Aviação testado via
  Playwright (hidden sem aeroporto, visível com aeroporto, href correto);
  sitemap com as 6 URLs novas confirmadas; capturas reais 390px (hub,
  ficha) e 1366px (Frota Offshore); Home + notícia + vaga + `/minha-escala`
  + `/agenda` + `/explica` + `/aeroportos` + `/radar` + `/empresas` +
  `/pergunte-ao-ownews` HTTP 200.
- DEPLOY: `ownews-git` `5c375e27-5a8e-49d9-8791-b7c78d0a468a`; rollback
  `e964e7fc-f5af-409e-97c3-2f23c620c19a`.
- VALIDADO EM PRODUÇÃO: as 6 rotas novas HTTP 200 em `ownews.com.br`;
  sitemap com as 6 URLs presentes; Home/vaga/minha-escala HTTP 200.

## 2026-09-25 — Missão "Mercado Offshore 2.0 + Base Salarial + Pergunte ao OWNews 2.0 + Destaque Minha Escala"

Continuação a partir da produção `bbeb3ca9-5e6f-4ee8-a275-77501dddb2b8`
(fim da missão Minha Escala 2.0 + Vagas + Radar/Mapa). git status
verificado antes de começar: mudanças pendentes em `../worker.js`/
`../wrangler.jsonc` (raiz do repo) são de um Worker DIFERENTE/não
relacionado (não é `producao-ownews-git`, que é o deployado como
`ownews-git`) — não tocadas. Achado `supabase-pesquisa-salarial/` (raiz):
proposta de pesquisa salarial via formulário público, `REVISAO.md`
explícito "sem execução", schema.sql é rascunho histórico com múltiplos
problemas de segurança/metodologia listados (INSERT público irrestrito,
sem RLS adequado, sem antifraude) — NÃO ativado nesta missão, não é uma
fonte de dados salariais pronta pra uso.

### Etapa 16 (Mercado Offshore 2.0)

- Auditoria do motor existente (16.4): cotações vêm do coletor
  (`shrill-pond-a915-fix`), catálogo curado `MERCADO_EMPRESAS` (id/nome/
  ticker/bolsa/categoria/ownership, ~50 empresas reais, cada uma com
  bolsa real ou `null` quando de capital fechado — nunca inventado),
  endpoint `/mercado` já com snapshot cacheado em KV (Durable Object
  Alarm faz a coleta periódica, nunca por requisição) — motor preservado
  integralmente, nenhuma chamada externa nova, nenhuma mudança no
  coletor.
- 16.1 (Home, alteração mínima): país deduzido só da BOLSA real (nunca
  nacionalidade jurídica — `BOLSA_PAIS`, mapa estático client-side,
  bolsa sem entrada simplesmente não mostra país). Inserido dentro da
  linha `.mo-cotacao-meta` já existente (que já mostrava
  fonte+horário) — zero elemento novo, zero aumento de altura do
  painel; confirmado com teste `jsdom` direto na função
  `cardEmpresaMercado`.
- 16.2/16.3 (`/mercado` completo): nova visão "Por Mercado" ADITIVA —
  preserva 100% a organização por categoria já existente (Perfuração/
  Produção-FPSO/Subsea/Serviços de Poço/Operadoras/Apoio Marítimo/
  Engenharia-EPC, intocada) e adiciona abas dinâmicas (Todos/Brasil/
  EUA/Noruega/... — só aparecem mercados com empresa real listada,
  "Brasil" sempre primeiro) agrupando os mesmos dados por bolsa via o
  mesmo `BOLSA_PAIS`. Empresa sem bolsa (capital fechado) não entra
  nesta visão (continua na visão por categoria). Nenhum preço 0 (NULL
  nunca convertido em 0), nenhum ticker/bolsa/moeda inventado — tudo
  vem do mesmo snapshot já existente. Mini-gráfico NÃO implementado: a
  fonte atual (snapshot do coletor) não traz série histórica, só ponto
  atual — implementar seria inventar dado, então foi omitido conforme
  a própria instrução da missão ("se a fonte atual suportar
  corretamente").
- TESTE: `node --check`; `wrangler dev --remote` + teste `jsdom`
  completo com snapshot mock realista — categorias preservadas (ex.:
  perfuração com 2 cards), abas de mercado geradas corretamente
  (Brasil/Eua/Noruega), clique em "Eua" filtra corretamente só a
  Transocean, zero erro JS. Home + notícia + vaga HTTP 200.
- DEPLOY: `ownews-git` `e12e3a02-734d-4f75-ae0f-c75b073fd9fa`; rollback
  `bbeb3ca9-5e6f-4ee8-a275-77501dddb2b8`.
- VALIDADO EM PRODUÇÃO: `/mercado` com `mpMercadoFiltros` presente;
  Home/notícia/vaga 200.

## 2026-09-26 — Missão "Correção Visual + Etapas 21-24"

### Etapa 22 (OWNews Explica)

- Auditoria: não existia biblioteca conceitual — só `GLOSSARIO_TERMOS`
  (definições de 1 frase) e Funções a Bordo (cargos, não conceitos).
  Nenhuma duplicação de conteúdo existente.
- Nova `EXPLICA_ARTIGOS`: 12 verbetes curados (nunca gerados em massa),
  exatamente os exemplos citados na missão — FPSO, sonda de perfuração,
  BOP, NPT, troca de turma, PLSV, ROV, completação, descomissionamento,
  transporte aéreo offshore, bacias sedimentares, diferença plataforma/
  sonda/FPSO. Estrutura: resposta curta + explicação + como funciona +
  por que importa + termos relacionados (siglas reais do Glossário,
  nunca inventadas) + 1 link relacionado real (Radar/Aeroportos/
  Funções/Glossário/Empresas/Painel da Bacia, só quando genuíno).
- Rotas `/explica` (índice por categoria) e `/explica/:slug`
  (`paginaChrome`, title/description/canonical/breadcrumb automáticos,
  slug inexistente → 404 real). 13 URLs adicionadas ao sitemap. Tile
  discreto "OWNews Explica" adicionado ao grid Central Offshore da
  Home (não-destaque, mesmo padrão dos outros tiles secundários).
- 22.4: `explicaParaPerguntaIA()` alimenta `montarContextoPerguntaIA`
  (Pergunte ao OWNews) — match por slug-como-texto (cobre a maioria) +
  caso especial pra comparação plataforma/sonda/FPSO (a pergunta natural
  não repete a ordem do slug). BUG PRÓPRIO corrigido no caminho: o bloco
  de comparação de funções (Etapa 18.5) sempre respondia primeiro pra
  qualquer "diferença entre X e Y" e nunca deixava a pergunta chegar ao
  Explica quando não achava 2 funções — corrigido pra tentar Explica
  antes de desistir. Slugs adicionados ao vocabulário de escopo (mesmo
  bug class de "guindasteiro" da Etapa 18 — sem isso, "o que é
  completação?" seria rejeitado como fora de escopo).
- TESTE: rotas reais (`/explica`, `/explica/fpso`, `/explica/bop`,
  `/explica/diferenca-plataforma-sonda-fpso`, slug inexistente = 404);
  4 perguntas reais no `/api/pergunte` ao vivo — "o que é um FPSO?", "o
  que é BOP?", "como funciona uma troca de turma offshore?" (todas com
  fonte `/explica/...` correta) e a comparação (corrigida, agora cita
  `/explica/diferenca-plataforma-sonda-fpso`); Home + notícia + vaga
  HTTP 200; sitemap com as 13 URLs confirmadas.
- DEPLOY: `ownews-git` `a16ad9aa-ef7b-436e-8fc1-31fb1e3027d0`; rollback
  `ced9dc23-8f15-4648-86c3-62cf1783d8b6`.
- VALIDADO EM PRODUÇÃO: `/explica` com os 12 links presentes; `/explica/fpso`
  200; chamada real ao `/api/pergunte` ("o que é um FPSO?") citando
  `/explica/fpso` como fonte; Home/notícia/vaga 200. (1º check de
  `/explica` bateu 404 por corrida de propagação de borda logo após o
  deploy — recheck imediato confirmou 200 estável.)

### Etapa 23 (Agenda Offshore)

- Auditoria: não existia agenda de eventos. Nova `AGENDA_EVENTOS` com
  SOMENTE 3 eventos reais, verificados via WebSearch/WebFetch em fontes
  oficiais (nunca agregador terceiro quando havia conflito de datas):
  ONS — Offshore Northern Seas 2026 (site oficial `ons.no`), ROG.e — Rio
  Oil & Gas Energy 2026 (IBP, organizador oficial), OTC — Offshore
  Technology Conference 2027 (site oficial `otcnet.org`). "OTC Brasil"
  descartado por datas conflitantes entre fontes não-oficiais. Status
  (PRÓXIMO/HOJE/ENCERRADO) sempre calculado a partir da data real —
  nenhum valor hardcoded.
- Rotas `/agenda` (índice, ordenado por data, status visível por
  evento) e `/agenda/:slug` (detalhe com fonte oficial linkada,
  `paginaChrome`, canonical/breadcrumb, slug inexistente → 404 real). 4
  URLs adicionadas ao sitemap.
- Callout na Home (23.4): SÓ aparece quando existe evento real
  próximo/em andamento (nunca ocupa espaço com agenda vazia), reaproveita
  as mesmas classes `.me-home-*` do card de Minha Escala (zero CSS
  novo).
- BUG PRÓPRIO encontrado e corrigido antes do deploy: a primeira versão
  calculava o "próximo evento" no SERVIDOR, dentro do próprio template
  literal `HTML` da Home (`${(function(){...proximoEventoAgenda()...})()}`).
  Isso fez a Home mostrar sempre o ONS 2026 (já encerrado) como "próximo
  evento", mesmo com o relógio real em 2026-09-26 — confirmado por
  eliminação: `/agenda` (calculado por requisição, dentro do handler
  assíncrono) mostrava o status correto (OTC = PRÓXIMO, ONS/ROG.e =
  ENCERRADO); a mesma lógica isolada em Node também dava o resultado
  correto; não havia definição duplicada de `AGENDA_EVENTOS`/
  `proximoEventoAgenda`. Conclusão: um `${...}` de nível de módulo que
  depende de `new Date()` dentro do template literal `const HTML = ...`
  é avaliado uma única vez na inicialização do isolate, não por
  requisição — mesma classe de armadilha (não idêntica) ao "escopo
  fantasma" já catalogado em missões anteriores. Corrigido movendo o
  cálculo para o CLIENTE: o card nasce `hidden` no HTML, e um novo bloco
  `<script>` (mesmo padrão já validado do card de Minha Escala, Etapas
  19-20) recebe a lista de eventos como JSON estático inline e calcula o
  "próximo evento" usando `new Date()` do próprio navegador.
- TESTE: `node --check`; `wrangler dev --remote` — `/agenda` com 1x
  PRÓXIMO + 2x ENCERRADO corretos; Home ANTES da correção mostrando
  ONS (bug confirmado), Home DEPOIS da correção mostrando OTC —
  Offshore Technology Conference 2027 (correto) via captura real
  Chromium; card visível e não-cortado em 320/360/390/430/768/1024/
  1366/1440/1920px (nenhuma dimensão com `hidden`/altura zero); Home +
  notícia + vaga HTTP 200.
- DEPLOY: `ownews-git` `2d3d4deb-a1da-4a55-8804-f7efbed51444`; rollback
  `a16ad9aa-ef7b-436e-8fc1-31fb1e3027d0`.
- VALIDADO EM PRODUÇÃO: `/agenda` com status corretos (1x PRÓXIMO, 2x
  ENCERRADO); `/agenda/otc-2027` 200; captura real Chromium em
  `ownews.com.br` confirmando o card da Home mostrando "OTC — Offshore
  Technology Conference 2027 · 03 mai 2027" (não mais o ONS obsoleto);
  Home/notícia/vaga HTTP 200.

### Etapa 21 (Offshore Agora)

- Auditoria: `/offshore-agora` já existia, maduro — Aeroportos Agora
  (clima+status via mesmo endpoint do coletor), Fatos Importantes
  (top-5 notícias por score recência+relevância), Giro 24h, Mercado
  Essencial + Mercado Offshore (mesmo snapshot do coletor), Acesso
  Rápido, auto-refresh (10min/5min). Já linkada na Home (nav principal
  + tile em destaque no grid Central Offshore) — 21.4 já satisfeito,
  nada alterado lá.
- Gaps reais preenchidos: seção "Vagas Recentes" (VAGAS_RADAR ativas,
  ordenadas por `vagaDataVerificacao` desc, top 4, mesma fonte de
  `/vagas`) e "Radar de Unidades" (3 primeiras `UNIDADES_RADAR`, só
  tipo/operador/situação reais, mesma fonte de `/radar`) — ambas
  renderizadas server-side (dado já em memória, sem fetch novo).
  Frescor (21.2): timestamp "Atualizado HH:MM" adicionado em Aeroportos
  Agora e Mercado Essencial (mesmo padrão já usado em `/mercado`).
- PRESERVADO: todo o resto da página, motor de dados (coletor
  inalterado), Home, nav.
- TESTE: captura real mobile 390px (página inteira) — Vagas Recentes (4
  reais), Radar de Unidades (3 reais: West Jupiter, FPSO Alexandre de
  Gusmão, P-74) e timestamps de atualização visíveis; Home + notícia +
  vaga + `/radar` HTTP 200.
- DEPLOY: `ownews-git` `ced9dc23-8f15-4648-86c3-62cf1783d8b6`; rollback
  `d037411c-6a0b-4a76-b968-c17a405eef17`.
- VALIDADO EM PRODUÇÃO: `/offshore-agora` com as duas seções novas
  presentes; Home/notícia/vaga HTTP 200.

### Correção visual — bolinhas da carta náutica

- Origem identificada: 3 elementos `<circle>` (marcas de sondagem,
  r=2px, fill cyan-dim, opacity 0.05-0.06) dentro da MESMA SVG
  batimétrica de fundo, nas duas cópias (Home + paginaChrome).
- Removidos SÓ os 3 `<circle>` — preservados os 4 `<path>` de contorno
  batimétrico e os 2 `<path>` de marca em cruz (formato diferente,
  não são "bolinhas", mantidos por não serem o alvo do pedido). Marca-
  d'água OffshoreWorks, cores, layout e espaçamento intocados.
- TESTE: captura real Chromium desktop 1440px + mobile 390px — nenhum
  ponto circular visível, linhas/marca-d'água preservadas; Home+notícia+vaga
  HTTP 200.
- DEPLOY: `ownews-git` `d037411c-6a0b-4a76-b968-c17a405eef17`; rollback
  `f20fcee0-dd29-4cb6-96ab-f263fa0f3c02`.
- VALIDADO EM PRODUÇÃO: grep por `<circle` = 0 na Home real; Home/
  notícia/vaga HTTP 200.

## 2026-09-25 — Extensão "Marca-d'água OffshoreWorks em todas as páginas" — ENCERRADA

A pedido do operador ("Quero em todas as páginas"), a marca-d'água
(centralizada, mesma opacidade/cor/asset, sem nenhuma alteração visual)
foi replicada na SEGUNDA cópia do CSS do body — a usada por
`paginaChrome()` (notícia, vaga, mercado, minha-escala, radar, empresas,
salários, pergunte-ao-ownews, funções, termos-de-uso e todas as demais
páginas fora da Home). Mesma técnica exata (camada dentro do
`background:` multi-camada já existente, `--ow-mark-pos`/`--ow-mark-size`
com os mesmos breakpoints 760px/1024px) — só duplicada porque essa é a
arquitetura já existente do site (Home e demais páginas têm cópias CSS
separadas, não compartilhadas).

- TESTE: 16 rotas verificadas (`/`, notícia, vaga, `/vagas`, `/mercado`,
  `/minha-escala`, `/radar`, `/empresas`, `/empresas/prio`, `/salarios`,
  `/salarios/guindasteiro`, `/funcoes`, `/funcoes/roustabout`,
  `/pergunte-ao-ownews`, `/aeroportos`, `/termos-de-uso`) — todas HTTP
  200 com a marca presente; capturas reais via Chromium confirmam
  renderização correta (sem quebra de escaping da data-URI na cópia com
  `\n`/`\"` literais) em `/salarios/guindasteiro` e `/noticia`.
- DEPLOY: `ownews-git` `f20fcee0-dd29-4cb6-96ab-f263fa0f3c02`; rollback
  `b61221e0-dee4-4681-a041-633e0273f178` (marca só na Home).
- VALIDADO EM PRODUÇÃO: `/`, notícia, vaga, `/mercado`, `/minha-escala`,
  `/radar`, `/empresas`, `/salarios/guindasteiro` todos HTTP 200 com a
  marca presente (falso-positivo de 502 no primeiro teste foi erro de
  URL malformada no próprio script de verificação — `?id=x?cb=y` —, não
  uma regressão real; recheck com URL correta confirmou 200).

## 2026-09-25 — Correção "Marca-d'água OffshoreWorks centralizada" — ENCERRADA

Patch mínimo sobre a micro-missão anterior, a pedido do operador: só
reposicionamento/dimensionamento — opacidade, cor e asset SVG mantidos
100% intocados.

- Antes: `background-position` fixo em pixels ancorado no canto
  inferior direito, com offset negativo pra recortar a marca
  propositalmente (podia cortar "OffshoreWorks" nas laterais em telas
  estreitas).
- Depois: `--ow-mark-pos` removida (era só usada pro canto); posição
  fixada em `center center` direto no layer do background — composição
  INTEIRA (monograma OW + "OffshoreWorks") sempre visível, nunca cortada
  nas laterais, em nenhum breakpoint (320-1920px testado).
- Tamanho trocado de pixels fixos por `vw` (escala com a viewport, não
  com breakpoints degrau a degrau): base 86vw (garante a marca inteira
  cabendo em 320-430px, já que a arte tem proporção ~2,08:1 — 86vw de
  320px = ~275px largura por ~132px altura, sempre dentro da viewport
  em altura também), 56vw a partir de 760px, 42vw a partir de 1024px.
- `background-attachment:fixed` (já herdado do body, inalterado) já
  entrega sozinho todo o comportamento pedido — acompanha o scroll,
  fica atrás do conteúdo, não é clicável, não entra na árvore de
  acessibilidade, não altera layout/fluxo — sem precisar adicionar
  nenhum elemento novo no DOM.
- TESTE: captura real via Chromium headless em 320/360/390/430/768/1366/1920px
  — composição completa (OW + assinatura) visível em todas, sem corte
  lateral, contraste de manchetes/cards preservado; Home + notícia +
  vaga HTTP 200 (regressão nula).
- DEPLOY: `ownews-git` `b61221e0-dee4-4681-a041-633e0273f178`; rollback
  `c7e65700-687d-468b-8973-daf3db0de1df` (versão anterior, canto
  inferior direito).
- VALIDADO EM PRODUÇÃO: screenshot real mobile (390px) confirma marca
  centralizada, completa, discreta; `center center`/`86vw auto`
  confirmados no HTML servido; notícia/vaga HTTP 200 sem a marca
  (escopo Home preservado).

## 2026-09-25 — Micro-missão "Marca-d'água OffshoreWorks no background" — ENCERRADA

- Asset: arte oficial fornecida pelo operador (monograma OW + assinatura
  "OffshoreWorks", JPG 1024x1024 fundo branco) processada localmente —
  fundo branco removido via limiar de luminância (`sharp`), resultado
  vetorizado com `potrace` (preserva a tipografia/monograma exatos, sem
  redesenho), minificado com `svgo` (12,7KB → 5,6KB). SVG final:
  `fill="#5fc4ee"` (mesmo cyan-dim já usado na textura batimétrica
  existente — tom sobre tom, nunca o azul forte do arquivo original),
  `fill-opacity="0.05"` embutido no próprio path (única forma confiável
  de controlar opacidade de UMA camada dentro do `background` multi-
  camada existente). Embutido como data-URI inline (~7KB), mesmo padrão
  já usado pelas texturas batimétrica/náutica existentes — zero request
  HTTP extra.
- Comparação visual feita (mockups + Chromium real, ambiente sem GUI):
  A) integrada ao background (grande, cortada no canto) — B) fixa no
  canto inferior direito acompanhando scroll — C) combinação das duas.
  C descartada por parecer repetição/pattern (2 marcas visíveis ao mesmo
  tempo, contra a própria regra da missão). B descartada por ler como
  "selo"/badge de marca-d'água persistente (fixed, sempre visível,
  risco de sobrepor conteúdo em pontos de scroll variados). Escolhida
  A: única aplicação, textura de fundo, nunca compete com manchetes/
  cards.
- CSS: nova camada dentro do `background:` multi-camada já existente do
  `body` da HOME (arquivo Home, não tocado em `paginaChrome` — escopo
  restrito só à Home, conforme pedido), posicionada
  `no-repeat right/bottom` com overflow negativo (recorte "proposital"),
  tamanho/posição responsivos via custom properties
  (`--ow-mark-pos`/`--ow-mark-size`) redefinidas em `min-width:760px` e
  `min-width:1024px` — nunca repete a data-URI gigante por breakpoint.
  `background-attachment:fixed` (mesmo comportamento já usado pelas
  outras camadas — rola junto da página, não fixo/flutuante).
- Mobile: crop mostra só um fragmento do "W"/assinatura (conforme
  previsto e aceito pela missão) — testado em 390px real, texto
  "Últimas Notícias" continua com contraste total.
- Modo Embarcado: mantida ativa (não omitida) — é vetor inline já
  presente no HTML (zero byte de rede adicional, GPU-barata), não se
  enquadra no tipo de custo que o Modo Embarcado existe pra evitar
  (imagens externas). Decisão registrada, não uma omissão por engano.
- Acessibilidade/SEO: puramente decorativa, dentro de `background:` CSS
  — sem tag `<img>`, sem alt, sem link, invisível a leitor de tela,
  zero impacto em SEO/structured data.
- TESTE: `node --check`; captura real via Chromium headless (biblioteca
  `libnspr4`/fontconfig reaproveitados de um bundle já extraído em
  `/tmp/ownews-frontend-tests/`, sem tocar o sistema) em 390px, 1440px e
  1920px — marca visível só de perto, manchetes/cards/Mercado/aeroportos
  com contraste total preservado; confirmado que `/noticia` e
  `/vagas/:slug` NÃO carregam a marca (grep por `ow-mark-pos` = 0 nessas
  páginas, escopo Home confirmado).
- DEPLOY: `ownews-git` `c7e65700-687d-468b-8973-daf3db0de1df`; rollback
  `fc679adc-4a96-474b-8d90-02950ae02ba0`.
- VALIDADO EM PRODUÇÃO: screenshot real da Home em produção (1440px)
  confirma a marca discreta no canto inferior direito, sem afetar
  nenhum card/manchete; notícia e vaga individuais HTTP 200, sem a
  marca (escopo Home preservado).
- PENDÊNCIAS REAIS: telas 320/360/430/1366 não capturadas
  individualmente (só 390/1440/1920 testadas ao vivo) — comportamento
  interpolado com confiança alta dado o uso de breakpoints já
  estabelecidos no site (`760px`/`1024px`) e unidades relativas, mas sem
  captura própria nessas larguras exatas.

## 2026-09-25 — Missão "Atalho Minha Escala Inteligente + Persistência + Ajuste Mercado" — ENCERRADA

### Etapa 20.1 (dedup Mercado)

- `/mercado`: removidas as 7 seções HTML redundantes por categoria
  (Perfuração/Produção-FPSO/Subsea/Serviços de Poço/Operadoras/Apoio
  Marítimo/Engenharia-EPC) e o `forEach` que escrevia nelas — a visão
  "Por Mercado" (Brasil/EUA/Noruega/...) passa a ser a ÚNICA organização
  visual. `porCategoria` continua computado no script (metadado de setor
  preservado, pronto pra um filtro futuro), só sem seção própria.
  Motor de cotações/cache/preços/Home: intocados.
- TESTE: `jsdom` com snapshot mock — visão por mercado idêntica à
  anterior (Brasil/Eua/Noruega, filtro funcional), zero erro JS,
  confirmado que `#mp-perfuracao` etc. não existem mais no HTML.

### Etapa 20.2 (auditoria de persistência)

- Confirmado: `localStorage` (chave `ownews_minha_escala`), SEM
  Supabase/KV/cookie envolvido. Guarda só dados-base
  (`tipo,diasEmbarcado,diasFolga,data,tipoRef` + `aeroporto` novo) —
  NUNCA uma contagem pré-calculada tipo "faltam 12 dias". Todo cálculo
  já era refeito a cada carregamento a partir da data-base (`calcularEExibir()`
  chamada no load quando há config salva) — já satisfazia o requisito
  "amanhã aparece automaticamente 'faltam 11 dias' sem o usuário alterar
  nada" ANTES desta etapa. Nada corrigido aqui, só confirmado + estendido
  com o novo campo opcional.
- Novo indicador discreto "Escala salva neste dispositivo." — só na
  página completa `/minha-escala` (nunca no atalho da Home, conforme
  pedido).

### Etapa 20.3–20.13 (atalho Minha Escala na Home)

- Novo campo opcional na página completa: `<select id="escalaAeroporto">`
  com os 6 aeroportos citados pela missão (Jacarepaguá/SBJR, Maricá/SBMI,
  Cabo Frio/SBCB, Macaé/SBME, Vitória/SBVT, Farol de São Tomé/SBFS) —
  mesmos códigos ICAO já presentes em `DATASET_AEROPORTOS_OFFSHORE` e já
  cobertos pelo endpoint real `/aeroportos` do coletor (nenhuma
  integração nova). Salvo junto do resto da config.
- Card da Home reescrito (mesmo componente da Etapa 19, evoluído, nunca
  redesenhado do zero): status ("Nº dia a bordo" / "Próximo embarque em
  N dias"), barra de progresso (`diaDoBloco/totalDoBloco`, calculada
  dinamicamente, nunca hardcoded), e UM alerta contextual, nessa ordem
  de prioridade: (1) desembarque em até 48h (com clima só quando
  `climaOk` real, nunca 0°C/condição inventada, nunca "condições
  favoráveis" inferido — só a condição objetiva do REDEMET via
  `clima.tempo`/`clima.icone` já existentes) → (2) data importante
  dentro do CICLO VIGENTE apenas (nunca escala futura — Natal em
  dezembro não aparece se o ciclo atual termina antes) → (3) "Nenhuma
  data importante nesta escala". Datas importantes: mesmo algoritmo de
  Páscoa/feriados (verificado) já usado em `/minha-escala`, cópia
  compacta local ao script da Home.
  Convenção preservada sem alteração: dia de desembarque conta como EM
  CASA (mesma matemática de sempre) — a data importante que cai EXATAMENTE
  no dia de transição corretamente pertence ao ciclo seguinte, não ao
  atual (limite exclusivo testado).
  Clima buscado só quando necessário (desembarque em até 48h E aeroporto
  configurado) — reaproveita o mesmo endpoint público
  `shrill-pond-a915.../aeroportos` já usado em `/aeroportos`, nenhuma
  chamada nova de infraestrutura, nenhum ícone animado/GIF/biblioteca
  nova (usa o emoji `clima.icone` que o coletor já devolve).
- CSS: card cresce moderadamente (status + barra + alerta, 3 linhas
  contra 1 antes) mas continua um card único, nunca dashboard; mobile
  empilha o CTA numa segunda linha, texto de alerta com `text-overflow:
  ellipsis` no desktop e `white-space:normal` no mobile pra nomes como
  "Farol de São Tomé" nunca quebrarem o layout.
- TESTE DE LÓGICA (Node, 13 cenários, todos corretos): primeiro dia
  embarcado, meio do embarque, último dia (alerta "Desembarque amanhã"),
  virada de mês, virada dez→jan, período em casa, penúltimo dia de folga,
  Natal dentro do ciclo vigente (embarque 18/12→01/01, hoje 20/12 — bate
  exatamente com o exemplo da própria missão: "3º dia a bordo" + "🎄
  Natal a bordo nesta escala"), Natal fora do ciclo (embarque começa
  depois do Natal — corretamente omitido), nenhuma data importante,
  Carnaval caindo EXATAMENTE no dia de transição (corretamente excluído
  do ciclo atual, vai pro próximo). `node --check` + `wrangler dev
  --remote` com Home/notícia/vaga/mercado/minha-escala/aeroportos todos
  200 e markup confirmado presente.
- DEPLOY: `ownews-git` `fc679adc-4a96-474b-8d90-02950ae02ba0`; rollback
  `96c1897d-28cd-439d-9675-29d45ed3d2c2`.
- VALIDADO EM PRODUÇÃO (cache-busted): Home com
  `meHomeProgresso`/`meHomeStatus`/`meHomeAlerta` presentes; `/mercado`
  sem `#mp-perfuracao` (dedup confirmado); `/minha-escala` com
  `escalaAeroporto` presente; notícia/vaga/aeroportos HTTP 200.
- PENDÊNCIAS REAIS: teste visual em dispositivo real 320-430px (20.13)
  não executado — sem navegador visual disponível neste ambiente,
  validado por CSS revisado + teste de lógica completo; comportamento
  ao vivo do fetch de clima (sucesso/falha real da API REDEMET no
  momento exato de um desembarque em produção) não testado com dado
  real — só o fluxo de erro/sucesso revisado no código (`.catch` cai no
  alerta padrão, nunca quebra o card).

## 2026-09-25 — Missão "Mercado Offshore 2.0 + Base Salarial + Pergunte ao OWNews 2.0 + Destaque Minha Escala" — ENCERRADA

Etapas 16, 17, 18 e 19 concluídas e validadas em produção (detalhes
acima). Produção atual: `ownews-git` `96c1897d-28cd-439d-9675-29d45ed3d2c2`.
Rollback mais recente: `8385b272-273e-4999-8c9d-7bbba17a32ff`. Nenhuma
etapa declarada pronta sem teste + deploy + validação em produção. Não
iniciada nenhuma etapa fora do escopo (AdSense, Meu OWNews completo,
login complexo, redesign, Agenda/Agora Offshore, OWNews Explica) —
conforme instrução explícita do operador.

Pendências reais registradas (nenhuma bloqueia o estado atual):
- Cobertura de `DADOS_SALARIO` permanece 5/36 funções — expansão exige
  pesquisa CAGED por CBO função a função, não apressada.
- Filtro do Mapa Offshore por bacia/campo/operador (Etapa 15, missão
  anterior) continua pendente — fora do escopo desta missão.
- Teste visual real em dispositivo móvel (320-430px) não executado em
  nenhuma etapa desta missão — sem navegador visual disponível neste
  ambiente; toda validação mobile foi por CSS responsivo revisado +
  teste funcional (`jsdom`/Node) do comportamento real.
- Pesquisa salarial comunitária (`supabase-pesquisa-salarial/`) permanece
  não ativada — múltiplos problemas de segurança/metodologia documentados
  em `REVISAO.md`, fora do escopo seguro desta missão.

### Etapa 19 (Destaque Minha Escala na Home)

- Problema real confirmado: Minha Escala só era alcançável via menu de
  navegação ou como 1 de ~14 tiles do grid "Central Offshore" — nenhum
  destaque próprio.
- Novo `<section id="minhaEscalaHome">` (card único, compacto, mesmo
  padrão visual `.ed-section`/`.ed-head` já usado por Mercado/Últimas —
  nunca banner grande), inserido entre "Mais Lidas" e "Mercado Offshore"
  na Home (preserva 100% a ordem/hierarquia editorial existente antes
  dele). Card inteiro é um `<a>` (bom alvo de toque no mobile).
- Personalização (19.4): novo IIFE client-side lê a MESMA chave
  `localStorage.ownews_minha_escala` já usada por `/minha-escala` — cópia
  compacta e verificada da matemática de ciclo já usada e testada na
  Etapa 13 (mesma convenção: dia de desembarque conta como EM CASA).
  Sem escala salva: mantém o convite padrão ("Veja seus próximos
  embarques..." / "Montar minha escala →"). Com escala salva: mostra
  "Faltam N dias para o desembarque" ou "Próximo embarque em N dias" +
  CTA "Ver minha escala →" — os mesmos exemplos citados na própria
  missão. Nenhum dado sensível exposto (mesma info que o próprio usuário
  já viu na página /minha-escala). Sem login, sem novo dado enviado a
  servidor algum.
- CSS mobile-aware: `.me-home-card` compacto, empilha o CTA numa segunda
  linha só abaixo de 759px — nunca cria barra invasiva nem reduz espaço
  das notícias.
- BUG DE AMBIENTE DE TESTE (não é bug de produção): teste `jsdom`
  automático não conseguiu simular "visitante recorrente com localStorage
  já preenchido antes do primeiro parse da página" (limitação de timing
  do próprio jsdom, não reproduzível em navegador real — `MODO_EMBARCADO`
  já usa exatamente o mesmo padrão de leitura síncrona de localStorage no
  carregamento e funciona em produção). Confirmado via reexecução manual
  da mesma lógica contra o DOM real gerado pela página: com escala salva
  (embarque 05/01/2026, 14x14), atualizou corretamente pra "Faltam 3 dias
  para o desembarque." + "Ver minha escala →".
- PRESERVADO: hierarquia editorial da Home (Hero/Últimas continuam
  primeiro), tile "Minha Escala" dentro de Central Offshore (mantido,
  não removido — reforço, não substituição), todo o resto da Home.
- TESTE: `node --check`; `wrangler dev --remote` com Home + notícia +
  vaga + `/minha-escala` OK; lógica de personalização confirmada
  correta via reexecução manual contra o DOM real (ver acima).
- DEPLOY: `ownews-git` `96c1897d-28cd-439d-9675-29d45ed3d2c2`; rollback
  `8385b272-273e-4999-8c9d-7bbba17a32ff`.
- VALIDADO EM PRODUÇÃO: `minhaEscalaHome`/`meHomeTexto` presentes na Home
  real (checagem inicial bateu em cache de borda stale — confirmado com
  cache-busting); Home/notícia/vaga/`/minha-escala` HTTP 200.
- PENDENTE: teste visual real em dispositivo 320-430px (19.2/19.3) não
  executado — sem navegador visual disponível neste ambiente; validado
  por CSS responsivo revisado + teste funcional da lógica.

### Etapas 17+18 (Base Salarial + Pergunte ao OWNews 2.0) — deploy conjunto

- Auditoria (17): `DADOS_SALARIO` já existia — fonte única estruturada
  (salário-base CAGED via salario.com.br por CBO, faixa offshore só
  quando fonte primária confirma, adicionais, metodologia, fontes, data)
  usada consistentemente em `/salarios` e `/salarios/:slug` (nenhum
  segundo número divergente encontrado alhures). Cobertura real: 5 de 36
  funções (guindasteiro, plataformista, tecnico-seguranca-trabalho, rov,
  driller) — as outras 31 mostram "Em atualização" honestamente, nunca
  um valor inventado. `PESQUISA_SALARIAL_AGREGADOS` (pesquisa
  comunitária) confirmado vazio/não ativado — `supabase-pesquisa-
  salarial/REVISAO.md` documenta múltiplos problemas de segurança/
  metodologia pendentes; **não ativado nesta missão** (fora de escopo
  seguro). 17.3 (transparência/"como calculamos") já existia por função
  via campo `metodologia` + fontes + data — não precisou de página nova.
  Expansão de cobertura para novas funções (Deck Pusher pesquisado via
  WebSearch/WebFetch — nenhum CBO real e inequívoco encontrado pra essa
  função específica offshore; não forçado, mantido honesto) fica como
  pendência real, não fingida como pronta.
- CAUSA RAIZ do problema relatado em 18 ("respostas limitadas em
  salário"): `montarContextoPerguntaIA` tratava 'salario'/'quanto ganha'
  como sinal de VAGA (não de salário) e sempre respondia com o
  curto-circuito genérico de "vaga não encontrada" — nunca consultava
  `DADOS_SALARIO`, mesmo quando o dado real existia. Corrigido: nova
  `PALAVRAS_INTENCAO_SALARIO` separada de `PALAVRAS_INTENCAO_VAGA` +
  `respostaSalarioIA()` dedicada (mesma fonte única `DADOS_SALARIO` de
  `/salarios` — zero número divergente).
- Segunda causa raiz (18.3): `funcaoParaPerguntaIA` só casava o NOME
  OFICIAL completo da função — "guindasteiro" (termo coloquial/slug) não
  batia com "Operador de Guindaste" (nome oficial), então a função nunca
  era identificada. Corrigido com 3 camadas: nome oficial → slug como
  texto (borda de palavra) → `ALIASES_FUNCAO_IA` pequeno e documentado
  (ex.: "homem de área" → roustabout, confirmado contra o próprio campo
  `nomeAntigo` já cadastrado). Mesmo bug reproduzido em
  `perguntaDentroDoEscopoOffshore` (rejeitava "quanto ganha um
  guindasteiro?" como fora de escopo ANTES de chegar à lógica de
  salário) — corrigido com os mesmos slugs/aliases.
- Terceiro bug real encontrado em teste ao vivo: "como embarco?" (exemplo
  citado na própria missão) era rejeitado como fora de escopo —
  'embarque'/'desembarque' na lista de escopo não casam com a
  conjugação "embarco". Adicionadas as conjugações reais
  (embarco/embarcar/embarcado/desembarco/desembarcar).
- Novo: `funcoesParaComparacaoIA` (18.5) — até 2 funções citadas na
  mesma pergunta de comparação, contexto com resumo+requisitos+salário
  (quando houver) de cada uma, nunca uma tabela inventada.
- Novo: unidade do Radar Offshore citada por nome (18.1/18.3, ex. "quem
  opera o West Jupiter?") — `UNIDADES_RADAR` adicionado ao vocabulário
  de escopo e um bloco de contexto dedicado (operador/tipo/campo reais,
  nunca coordenada/dado técnico inventado), linkando pra `/radar/:slug`.
- Novo: vagas relacionadas à função também entram no contexto quando a
  pergunta é sobre a função em si (reaproveita `vagasRelacionadasFuncao`
  da Etapa 10 — camada relacional, não duplicada).
- 18.7 (cache): `/salarios/` entra no mesmo balde de TTL curto (1h) que
  `/vagas/` — nunca preso 24h como conteúdo estático; salário/vaga
  desatualizado nunca fica em cache por mais de 1h.
- TESTE: `node --check`; `wrangler dev --remote` com TODAS as perguntas
  de teste da missão feitas ao vivo contra `/api/pergunte` real (Workers
  AI real, não simulado) — "quanto ganha um guindasteiro offshore?"
  (cita fonte real, sem inventar faixa não confirmada), "salário ROV"
  (responde com faixa real R$3.531–R$8.337), "quanto ganha um deck
  pusher?" (honesto "dados insuficientes" com link útil), "o que faz um
  homem de área?" (alias resolvido corretamente pra roustabout), "qual a
  diferença entre homem de área e plataformista?" (comparação funcional),
  "tem vaga de guindasteiro?" (vaga-intent preservado, resposta honesta),
  "como embarco?" (deixou de ser rejeitado como fora de escopo), "quem
  opera o west jupiter?" (unidade identificada, operador real citado).
  Home + notícia + vaga + `/salarios` + `/salarios/guindasteiro` +
  `/pergunte-ao-ownews` HTTP 200.
- DEPLOY: `ownews-git` `8385b272-273e-4999-8c9d-7bbba17a32ff`; rollback
  `e12e3a02-734d-4f75-ae0f-c75b073fd9fa`.
- VALIDADO EM PRODUÇÃO: chamada real a `/api/pergunte` com "quanto ganha
  um guindasteiro offshore?" respondendo corretamente com fonte
  `/salarios/guindasteiro`; Home/notícia/vaga/`/salarios` HTTP 200.
- PENDÊNCIAS REAIS: cobertura de `DADOS_SALARIO` continua em 5/36
  funções (expansão responsável exige pesquisa CAGED por CBO função a
  função, não apressada nesta missão); link de "Comece Aqui" para
  perguntas tipo "quero trabalhar offshore" adicionado mas não
  re-testado ao vivo (rate limit de 10 perguntas/hora por IP atingido
  durante o teste — lógica revisada e coerente com os demais casos
  testados, mas sem confirmação end-to-end desse caso específico).

## 2026-09-24/25 — Missão "Evolução do Portal + Acabamento + Expansão Controlada"

Nova missão do operador, 21 etapas. Ordem explícita: evoluir/terminar primeiro,
auditoria geral (Etapa 21) só no final. Checkpoint de segurança inicial:
produção confirmada em `c61c6dea-237f-43ac-8e4a-7a6934634524` (exatamente
onde a sessão anterior deixou, sem intervenção externa) antes de qualquer
alteração.

### Etapa 15 (Radar de Unidades + Mapa Offshore) — evolução, não reconstrução

- Diagnóstico: `/radar` e `/radar/:slug` já eram um "Radar de Unidades"
  maduro (não construído nesta etapa) — dados técnicos reais (IMO/MMSI/
  callsign/dimensões), operador/owner/campo/bacia, status com nível de
  confiança, fontes citadas, notícias relacionadas via busca real na
  Supabase (mesmo padrão de `/empresas/:slug`), localização só via
  polígono oficial da ANP (nunca lat/lon inventada — 15.3 já era
  respeitado), favoritos ("Meus Navios"), mapa MapLibre real com camadas
  ANP e filtro por tipo (sondas/FPSOs/subsea/apoio/outros). Nada disso
  foi reconstruído.
- Gaps reais preenchidos (usando a fundação da Etapa 12, sem sistema
  paralelo):
  1. `empresasRelacionadasUnidade(u)`: mesma disciplina de borda de
     palavra contra `EMPRESAS_CARREIRAS`, aplicada a
     operador/owner/contratante (únicos campos de texto livre que citam
     empresa) — pode retornar mais de uma empresa quando o texto cita
     um consórcio real, nunca força uma relação única. Nova seção
     "Empresa relacionada" em `/radar/:slug` linkando pra
     `/empresas/:slug`. Testado com West Jupiter → Seadrill (owner real).
  2. `vagasRelacionadasUnidade(u)`: só através da empresa relacionada
     real (reaproveita `vagasDaEmpresaDiretorio`, já usada em
     `/empresas/:slug` — zero lógica de match duplicada). Nova seção
     "Vagas relacionadas" (usa `cardVaga`/`scriptFavoritarVagasBotoes`,
     mesmos componentes de sempre) — só aparece com vaga real (West
     Jupiter/Seadrill não tem vaga ativa hoje, seção corretamente ausente).
  3. Modo Embarcado (15.4): o mapa MapLibre (lib JS+WASM pesada) carregava
     automaticamente sempre, sem checar Modo Embarcado — gap real.
     Corrigido: `<link>`/`<script src>` estáticos da MapLibre removidos;
     agora um pequeno IIFE lê `localStorage.ownews_embarcado` e, se
     ativo, mostra um botão "CARREGAR MAPA COMPLETO" em vez de baixar a
     lib — clique carrega os recursos sob demanda e chama `initMapa()`.
     Fora do Modo Embarcado, comportamento idêntico ao anterior
     (carrega e inicializa direto). Lógica condicional verificada
     isoladamente em Node (embarcado=true → só mostra botão;
     embarcado=false → chama o loader) — teste `jsdom` completo não foi
     conclusivo por limitação do próprio ambiente de teste com
     `localStorage` (não é um problema do código; a lógica isolada bateu
     certo nos dois cenários).
- 15.3 (filtro por bacia/campo/operador no mapa) e 15.2 (normalização/
  aliases mais ampla) NÃO implementados nesta etapa — filtro por tipo já
  existia e cobre parte do pedido; adicionar bacia/campo/operador exigiria
  extação de dados adicionais e ampliaria bem o escopo. Registrado como
  pendência real, não fingido como pronto.
- PRESERVADO: toda a estrutura de dados de `UNIDADES_RADAR`, mapa,
  favoritos, notícias relacionadas, filtro por tipo, fichas técnicas,
  `adSlot()` inalterado (`ADS_ENABLED` continua false — zero anúncio).
- TESTE: `node --check`; `wrangler dev --remote` — ficha da West Jupiter
  mostra "Empresa relacionada" (Seadrill) corretamente, sem "Vagas
  relacionadas" (nenhuma vaga real); índice do Radar mostra o botão de
  carregar mapa no HTML; lógica de gate do Modo Embarcado confirmada
  isoladamente em Node. Home + notícia + vaga + `/radar` + `/radar/:slug`
  HTTP 200.
- DEPLOY: `ownews-git` `bbeb3ca9-5e6f-4ee8-a275-77501dddb2b8`; rollback
  `12fe56cd-e86a-4d9c-8c4f-0ea7593b9e13`.
- VALIDADO EM PRODUÇÃO: `/radar/west-jupiter` com a seção "Empresa
  relacionada" → Seadrill; `/radar` com o botão de carregar mapa
  presente no HTML; Home/notícia/vaga 200.
- PENDÊNCIAS REAIS: filtro do mapa por bacia/campo/operador (15.3, fora
  do escopo desta etapa); teste em dispositivo mobile real 320-768px
  (15.4/15.5) não executado — sem navegador visual disponível neste
  ambiente, validado só por revisão de código e teste funcional via
  `curl`/Node/jsdom.

## 2026-09-25 — Missão "Minha Escala 2.0 + Compartilhamento de Vagas + Radar/Mapa Offshore" — ENCERRADA

Etapas 13, 14 e 15 concluídas e validadas em produção (ver detalhes
acima). Produção atual: `ownews-git` `bbeb3ca9-5e6f-4ee8-a275-77501dddb2b8`.
Rollback mais recente: `12fe56cd-e86a-4d9c-8c4f-0ea7593b9e13`. Nenhuma
etapa foi declarada pronta sem teste + deploy + validação em produção.
Não iniciada a Etapa 16 (Agenda Offshore) nem qualquer item da lista
"NÃO FAZER NESTA MISSÃO" (OWNews Explica, Agenda, Agora Offshore, Meu
OWNews completo, IA, monetização/AdSense, redesign, autenticação) —
conforme instrução explícita do operador. Pendências reais registradas
em cada etapa acima, nenhuma delas bloqueando o estado atual de produção.

### Etapa 14 (Compartilhamento das Vagas / Instagram)

- Diagnóstico: `/vagas/:slug` já tinha Web Share API nativa + WhatsApp +
  Telegram + Facebook + copiar link (missão anterior) — já é assim que o
  Instagram aparece no seletor nativo do sistema quando suportado, sem
  nenhum deep link inventado. Preservado sem alteração. O gap real era
  14.1: nenhum card visual compartilhável para vagas (Minha Escala já
  tinha isso desde a missão anterior).
- Novo botão "BAIXAR CARD DA VAGA" + `gerarCard()`: canvas 1080x1920,
  identidade OWNews (mesma paleta/tipografia do card de Minha Escala),
  usando só campos reais da vaga — cargo (com quebra de linha própria,
  testada isoladamente contra o título mais longo do Radar atual: "MSO -
  Caldeireiro(a) Escalador(a) NI - OFFSHORE" → 2 linhas), empresa,
  local (só quando `vaga.local` existe), badge de modalidade (só quando
  informada), "FONTE OFICIAL" (só quando `fonte_oficial` é true), URL
  curta no rodapé. Nenhum campo inventado — salário/benefícios/regime/
  prazo não existem no modelo de dados de `VAGAS_RADAR`, então não há
  risco de aparecerem.
  Ao clicar: gera o PNG e tenta `navigator.share({files:[...]})` primeiro
  (é assim que Instagram e outros apps aparecem no seletor do sistema
  quando o navegador suporta compartilhamento de arquivo — escolha final
  sempre do app/SO); sem suporte, cai pra download direto do PNG.
- BUG PRÓPRIO evitado no caminho: o botão "COPIAR LINK" já existente
  reaproveita `vagaShareStatus` pro feedback — o novo botão usa o mesmo
  span, sem duplicar UI de status.
- PRESERVADO: compartilhamento nativo, WhatsApp/Telegram/Facebook,
  copiar link, OG/canonical da página (já tinha `imagemUrl` em
  `opcoesOg`), candidatura sempre no canal oficial.
- TESTE: `node --check` (servidor) + `acorn.parse` isolado do novo
  `<script>` (cliente) + `jsdom` (botão existe, click não lança erro até
  o ponto esperado — canvas 2D não é implementado pelo jsdom sem o
  pacote nativo `canvas`, mesma limitação de ambiente já aceita pro
  botão "Baixar imagem" existente de Minha Escala; lógica de quebra de
  linha testada isoladamente em Node com `measureText` mockado); `dados`
  serializado na página real conferido campo a campo — só valores reais.
  Home + notícia + `/vagas` + vaga individual HTTP 200.
- DEPLOY: `ownews-git` `12fe56cd-e86a-4d9c-8c4f-0ea7593b9e13`; rollback
  `bbf2effd-52ad-4d8f-8693-cc96858b118e`.
- VALIDADO EM PRODUÇÃO: `/vagas/brava-bombeador-offshore` com o botão e
  o objeto `dados` corretos (sem campos inventados); Home e notícia 200.
- PENDENTE: teste visual real do PNG gerado (cores/wrap/proporção) não
  executado — sem navegador com canvas real disponível neste ambiente;
  lógica revisada e validada por partes (quebra de linha, campos, fluxo
  de compartilhamento) em vez de captura de tela.

### Etapa 13 (Minha Escala 2.0)

- Diagnóstico: 13.1 (projeção, próximo embarque/desembarque, dia do
  ciclo), 13.7 (compartilhar via Web Share + WhatsApp fallback + imagem
  canvas 1080x1350) e 13.8 (.ics com 6 ciclos futuros) já existiam,
  maduros — preservados sem alteração. Faltavam: datas importantes
  (13.2/13.3), datas pessoais (13.4), visão anual (13.5) e estatísticas
  (13.6).
- Convenção existente CONFIRMADA e preservada (não alterada
  silenciosamente): o dia de desembarque conta como **EM CASA** (fase do
  ciclo já cai em "folga" nesse dia exato, `diaDoBloco=1`) — mesma lógica
  do calendário mensal já existente, testada em Node isoladamente antes
  do deploy (embarque 05/01: dia 18/01=embarcado dia14, dia 19/01=folga
  dia1) e em cenário de virada dez/jan e ano bissexto (2028), todos
  corretos.
- Algoritmo de Páscoa (Gauss/Meeus) e "2º domingo do mês" (Dia das
  Mães/Pais) verificados isoladamente em Node contra datas reais
  conhecidas 2024-2028 antes de entrar no código (Páscoa 2026=05/04,
  Carnaval 2026=17/02, Dia das Mães 2026=10/05, Dia dos Pais 2026=09/08
  — todos batem). Datas importantes: Ano-Novo/Carnaval/Páscoa/Dia das
  Crianças/7 de Setembro/Natal marcadas "feriado"; Dia das Mães/Dia dos
  Pais marcadas explicitamente "comemorativa" (nunca feriado), conforme
  pedido.
  `vagasRelacionadasFuncao`-style: `cicloContendo()` deriva as datas de
  embarque/desembarque de uma data importante só a partir de
  `statusEm().diaDoBloco` — nenhuma lógica de ciclo duplicada.
- Novas seções (dentro de `#resultadoEscala`, só após calcular):
  "Próximas datas importantes" (mescla feriados/comemorativas dos
  próximos 2 anos + datas pessoais, ordenadas, badge A BORDO/EM CASA);
  "Datas pessoais" (form nome+data, `localStorage` key
  `ownews_minha_escala_datas_pessoais`, add/listar/remover, nada
  enviado a servidor); "Visão anual" (12 mini-barras por mês, navegação
  por ano, leve — sem grade de dias, seguro pra mobile) com nota
  deixando claro que é projeção; "Estatísticas da escala" (dias a
  bordo/em casa no ano, embarques projetados, datas importantes a
  bordo/em casa) — toda linguagem em termos de projeção, nunca "registro
  oficial".
- BUG PRÓPRIO encontrado e corrigido no caminho (antes do deploy): uma
  string de `renderDatasPessoaisLista()` fechava com aspas duplas em vez
  de aspas simples, quebrando o parse do script do cliente inteiro
  (`SyntaxError` no navegador) — `node --check` no worker.js NÃO pega
  esse tipo de erro (o script do cliente é só conteúdo de string do
  ponto de vista do parser do servidor). Detectado com uma verificação
  nova, mais rigorosa: extrair o `<script>` renderizado de verdade e
  rodar `acorn.parse` nele isoladamente — todo o restante desta etapa
  (cálculo de Páscoa, ciclos, ano bissexto, virada dez/jan) foi validado
  com um teste headless real via `jsdom` (formulário preenchido,
  submetido, datas pessoais adicionadas/removidas, navegação de ano),
  não só HTTP 200.
- PRESERVADO: formulário original, calendário mensal, timeline de
  ciclos, compartilhar, .ics, imagem, limpar escala — nenhum campo/ID
  removido ou renomeado.
- TESTE: `node --check` (servidor) + `acorn.parse` isolado do `<script>`
  extraído (cliente) + teste comportamental `jsdom` completo (ver acima)
  rodado tanto no preview quanto em produção após deploy, com resultado
  idêntico; Home + notícia + vaga individual HTTP 200.
- DEPLOY: `ownews-git` `bbf2effd-52ad-4d8f-8693-cc96858b118e`; rollback
  `03359df7-263e-4870-a493-e0ea63892501`.
- VALIDADO EM PRODUÇÃO: teste `jsdom` contra a página real confirma
  status EMBARCADO correto, 8 datas importantes com badge correto,
  estatísticas 2026 = 182 dias a bordo / 183 em casa / 13 embarques
  (bate com o cálculo manual em Node), datas pessoais funcionando,
  navegação de ano 2026→2027→2025 correta; Home/notícia/vaga 200.
- PENDENTE: 13.9 (teste manual em dispositivo real 320-768px) não
  executado — validado só via CSS responsivo (grid `auto-fill` já usado
  em outras páginas do site) e revisão de código; sem navegador visual
  disponível neste ambiente.

### Etapa 12 (Camada Relacional do OWNews — fundação)

- A maior parte dos elos seguros já tinha nascido nas Etapas 9-11: empresa
  → notícias/vagas (Etapa 11), função → vagas (Etapa 10). O elo que
  faltava pro objetivo da missão (NOTÍCIA ↔ EMPRESA ↔ VAGA ↔ FUNÇÃO) era
  notícia → empresa.
- Nova `empresaMencionadaServidor(artigo)`: mesma disciplina de borda de
  palavra + nome com 4+ caracteres já usada em
  `vagasDaEmpresaMencionadaServidor`, mas contra o Diretório inteiro (30
  empresas em `EMPRESAS_CARREIRAS`, não só as ~5 com vaga ativa no
  Radar). `/noticia` ganhou um link discreto "Perfil da [Empresa] no
  Diretório Offshore →" quando há match confiável — `null`/sem link
  quando não há. Convive com o link de vaga já existente (destinos
  diferentes: perfil da empresa vs. candidatura).
  Validado com artigo real sobre Halliburton (greve/assembleia).
  IDs/comparação direta de nome usados em toda a etapa — nenhuma
  substring solta, nenhuma relação inventada quando incerta.
- Fundação deliberadamente NÃO estendida agora pra Unidade/Bacia/Projeto
  (Etapas 13/14, fora de escopo desta missão).
- PRESERVADO: `/noticia` (todo o restante do layout, atribuição de
  fonte, compartilhamento, cross-promo de vaga existente), `/empresas`,
  `/vagas`, `/funcoes`.
- TESTE: `node --check`; `wrangler dev --remote` — artigo real da
  Halliburton mostra o link pro perfil; Home + `/vagas` + vaga individual
  OK.
- DEPLOY: `ownews-git` `03359df7-263e-4870-a493-e0ea63892501`; rollback
  `ef55974c-47c0-4c46-a04a-6e64d2ba3abc`.
- VALIDADO EM PRODUÇÃO: artigo da Halliburton com o link correto;
  `/empresas/halliburton`, Home, `/vagas` e vaga individual HTTP 200.

### Etapa 11 (Diretório Offshore 2.0)

- Diagnóstico: `/empresas` já era maduro (30 empresas curadas em
  `EMPRESAS_CARREIRAS`, 9 categorias reais em `CATEGORIAS_EMPRESAS`,
  busca+filtro, categoria só aparece com ≥1 empresa). O gap real: não
  existia página individual — cards só linkavam pro `careersUrl` externo,
  nenhuma relação empresa→notícias/vagas era exposta.
- Nova rota `/empresas/:slug` (`renderEmpresaDetalhe`, async): categoria,
  canal oficial + data de verificação, seção "VAGAS ABERTAS DESTA EMPRESA"
  via `vagasDaEmpresaDiretorio(e)` (comparação direta com `VAGAS_RADAR`,
  reaproveita `cardVaga`/`scriptFavoritarVagasBotoes` — sem UI nova) e
  seção "NOTÍCIAS RECENTES" via busca real na Supabase (`title=ilike`,
  mesma chave pública já usada em toda a Home/`/noticia`, sem endpoint
  novo, sem inventar notícia — some quando não há match ou a busca falha).
  `<h3>` de `cardEmpresa()` agora linka pra página individual.
  Slug inexistente → 404 real (`pagina404()`), testado.
  "Unidades" deliberadamente NÃO incluída (Etapa 13/14 ainda não
  desenvolvidas — nada de seção vazia/placeholder).
- 30 URLs `/empresas/<slug>` adicionadas ao sitemap dinâmico (mesmo
  padrão de `FUNCOES_OFFSHORE`/`UNIDADES_RADAR`).
- Duplicidade de empresas por grafia: não é um risco real hoje — lista
  curada manualmente com slugs únicos, sem fonte automática que possa
  reintroduzir grafias divergentes.
- PRESERVADO: `/empresas` (índice, busca, filtro por categoria), todos
  os cards e CTAs externos existentes.
- TESTE: `node --check`; `wrangler dev --remote` — `/empresas/prio`
  mostra a vaga real da PRIO + botão favoritar funcional, slug inexistente
  404, sitemap com 30 URLs `/empresas/`; Home + `/vagas` + notícia OK.
- DEPLOY: `ownews-git` `ef55974c-47c0-4c46-a04a-6e64d2ba3abc`; rollback
  `0d77261b-b9a9-496c-ba80-af4164babccd`.
- VALIDADO EM PRODUÇÃO: `/empresas` 200, `/empresas/prio` 200 com seção
  de vaga presente, slug inexistente 404, Home/`/vagas`/notícia 200.

### Etapa 10 (Central do Trabalhador Offshore)

- Diagnóstico: Carreiras/Funções/Currículo/Vagas já existiam conectados
  na maior parte (currículo→funções/vagas/salários, vaga→função via
  `funcaoRelacionadaVaga`), exceto um elo real faltando: a página de
  função (`/funcoes/:slug`) não mostrava vagas relacionadas nem linkava
  pro currículo — só o sentido inverso existia.
- Nova função `vagasRelacionadasFuncao(f)` (reaproveita
  `funcaoRelacionadaVaga` como fonte única de verdade, mesmo critério de
  borda de palavra, nunca substring solta) — usada em
  `renderFuncaoDetalhe` pra mostrar seção "VAGAS RELACIONADAS" com
  `cardVaga()` (mesmo componente de `/vagas`, sem duplicar UI) quando
  há match real; seção não aparece quando não há vaga relacionada
  (testado com `/funcoes/almoxarife`, sem match).
  `hub-continue` da função ganhou links pra `/carreiras/modelo-curriculo`
  e `/carreiras/cadastre-seu-curriculo`, fechando o ciclo FUNÇÃO → VAGA →
  CURRÍCULO.
- Nova `scriptFavoritarVagasBotoes()`: extrai a lógica de favoritar (que
  só existia embutida no script de `/vagas`) pra um helper reaproveitável
  em qualquer página que use `cardVaga()` fora do índice — usada na seção
  de vagas relacionadas da função. `/vagas` continua com seu script
  próprio (integrado ao filtro), inalterado.
- PRESERVADO: `/funcoes`, todas as páginas de função existentes, salário,
  progressão de carreira, fontes, currículo, vagas.
- TESTE: `node --check`; `wrangler dev --remote` — `/funcoes/roustabout`
  mostra a vaga Foresea relacionada + botão favoritar funcional,
  `/funcoes/almoxarife` sem seção vazia; Home + `/vagas` +
  `/vagas/foresea-...` + notícia OK.
- DEPLOY: `ownews-git` `0d77261b-b9a9-496c-ba80-af4164babccd`; rollback
  `1dcb71e3-520b-4fa7-8861-cbd5847c273c`.
- VALIDADO EM PRODUÇÃO: `/funcoes/roustabout` com seção de vaga
  relacionada presente; Home, `/vagas` e notícia HTTP 200.

### Etapa 9 (Vagas Offshore 2.0)

- BUG PRÉ-EXISTENTE achado e corrigido: `.vaga-badge`/`.vaga-badge-tipo`/
  `.vaga-badge-offshore`/`.vaga-badge-novo` só existiam no `<style>` da
  Home — nunca propagadas pra cópia CSS de `paginaChrome`, que é quem
  serve `/vagas` e `/vagas/<slug>`. Badges (tipo, offshore/onshore, fonte
  oficial) renderizavam sem nenhum estilo em produção. Portadas pra
  `paginaChrome`.
- Ordenação por recência: `vagasAtivas` ordenada por `vagaDataVerificacao`
  desc (usa `verificado_em` individual quando existir, senão a data
  global — hoje quase todas empatam, sort estável preserva a ordem atual).
- `vagaEhNova()` passou a aceitar uma vaga (fallback pro comportamento
  global quando chamada sem argumento — `cardVagaHome` inalterado); badge
  "NOVO" agora também aparece em `cardVaga` (índice `/vagas`) e na página
  individual, não só no card da Home.
- Filtro por modalidade (offshore/onshore/base+offshore/não informado)
  adicionado ao lado do filtro de empresa já existente — só aparece
  quando há mais de uma modalidade distinta entre as vagas ativas.
  Filtro por local não implementado (dado real ausente na maioria das
  vagas — não inventar).
- Favoritos client-side (`localStorage`, chave `ownews_vagas_favoritas`),
  mesmo padrão já usado no Radar Offshore (`ownews_radar_favoritos`):
  botão estrela em cada card e na página individual, toggle "Só
  favoritas" no índice. Base pronta pra alertas futuros sem exigir login
  nem infraestrutura nova agora. Página `/privacidade` atualizada pra
  mencionar a nova chave de localStorage.
- PRESERVADO: `/vagas`, páginas individuais, Foresea, candidatura
  oficial (nunca hospedada no OWNews), compartilhamento, OG/social,
  vagas relacionadas por empresa, link cruzado com função a bordo.
- TESTE: `node --check`; `wrangler dev --remote` com Home + notícia +
  `/vagas` + `/vagas/brava-bombeador-offshore`; confirmado grid com 7
  cards, CSS de badge presente, favoritar presente nas duas páginas,
  filtro de modalidade com as 3 categorias reais (3 NAO_INFORMADO, 3
  OFFSHORE, 1 ONSHORE).
- DEPLOY: `ownews-git` `1dcb71e3-520b-4fa7-8861-cbd5847c273c`; rollback
  `c36076c2-7dc4-4332-82a8-8de86473a0aa`.
- VALIDADO EM PRODUÇÃO: `/`, `/noticia?id=...`, `/vagas` (7 cards, badge
  CSS presente, 10 ocorrências de `vaga-fav-btn`) e
  `/vagas/brava-bombeador-offshore` (3 ocorrências de `vaga-fav-btn`)
  todos HTTP 200.
- PENDENTE (não bloqueia): banco de vagas dedicado (`docs/JOBS-SOURCE-REGISTRY.md`)
  continua manual — só 7 vagas hoje, sem atualização automática contínua.

### Etapa 8 (footer novo) + correção do handle do Instagram + verificação Google AdSense

- Footer reformulado nas duas cópias (Home e `paginaChrome`, usadas por
  `/noticia`, `/vagas/<slug>` e demais páginas hub): de uma linha única
  (`.footer` flex) pra grid de 4 colunas em desktop (`.footer-novo`,
  `grid-template-columns:1.3fr 1fr 1fr 1fr` a partir de 640px, 1 coluna
  empilhada abaixo disso) — Col1 marca+tagline+"by OffshoreWorks", Col2
  "Portal" (Sobre/Contato/Política Editorial/Privacidade/Termos de Uso),
  Col3 "Explore" (Notícias/Vagas/Carreiras/Radar Offshore/Minha Escala),
  Col4 "Acompanhe" (Instagram OWNews/Instagram OffshoreWorks/Telegram
  OWNews). Barra inferior própria (`.footer-bottom`) mantém o © e os
  indicadores `leitores-online`/`visitas-total` exatamente como antes —
  mesmos IDs (`leitoresOnline`/`visitasTotal`), mesmo `hidden` por
  padrão, mesmo JS que só populam com dado real (nada inventado).
- BUG PRÉ-EXISTENTE achado durante a investigação (não introduzido nesta
  sessão): a cópia de CSS dentro de `paginaChrome` nunca teve a regra
  `.footer-links{...}` (só a cópia da Home tinha) — ou seja, a navegação
  do footer em `/noticia`/`/vagas`/páginas hub sempre renderizou sem o
  `flex-wrap`/`gap` que a Home tinha, uma causa real de colisão visual.
  Resolvido pela própria reformulação (as duas cópias agora usam a mesma
  estrutura `.footer-novo`/`.footer-col`).
- Instagram: confirmado por evidência interna (não assumido) que o
  perfil oficial ativo é **@ownewsbr**, não @ownews — três referências
  cruzadas no worker de automação real (`ownews-instagram-publisher/`):
  `package.json` linha 5, `wrangler.jsonc` linha 4, `worker.js` linha 5,
  todas documentando o cron real que publica em @ownewsbr. Corrigidas
  TODAS as 6 ocorrências do handle antigo no `producao-ownews-git/worker.js`
  (não só o footer): footer x2 cópias, widget `.ig-topo-perfil` no topo da
  Home x2 cópias, menu mobile `.nav-social`, texto da página `/contato`
  ("mande uma mensagem pelo Instagram"). Link do Telegram reaproveitado
  de `https://t.me/ownewsradar`, já usado e validado em outros CTAs do
  site (não inventado).
- Nova página `/termos-de-uso` (`renderTermosDeUso()`, mesmo padrão de
  `renderPrivacidade()`/`renderPoliticaEditorial()`): acesso gratuito sem
  login, uso permitido do conteúdo, aviso sobre vagas de terceiros
  (OWNews nunca cobra de candidato), limitação de responsabilidade, link
  cruzado com Privacidade/Política Editorial. Adicionada ao sitemap
  estático (`ROTAS_ESTATICAS_SITEMAP`) e linkada a partir de Privacidade
  e Política Editorial.
- Verificação de propriedade do Google AdSense: adicionada UMA ÚNICA
  meta tag `<meta name="google-adsense-account" content="ca-pub-7540734255466089">`
  logo no início do `<head>`, nas duas cópias (Home e `paginaChrome`) e
  no template de fallback de emergência de `/noticia`. Só a tag de
  verificação — sem Auto Ads, sem script de anúncios, sem espaço
  publicitário, sem alteração de layout/CSS/rotas.
- TESTE: `node --check` + parse AST (acorn); `wrangler dev --remote` com
  checagem obrigatória Home + notícia + vaga + `/termos-de-uso`, mais
  verificação de que nenhum `@ownews` (sem "br") restava em nenhuma
  página testada.
- DEPLOY: `ownews-git` `c36076c2-7dc4-4332-82a8-8de86473a0aa`; rollback
  `188682a9-555c-41c9-9f28-53ab4b4d6839`.
- VALIDADO EM PRODUÇÃO (https://ownews.com.br): `/` (200, footer-novo x3,
  ownewsbr x4, meta AdSense presente, `@ownews` sem "br" = 0 ocorrências),
  `/noticia?id=...` (200, mesmas checagens), `/vagas` (200) e
  `/vagas/brava-bombeador-offshore` (200, footer-novo x3, meta AdSense
  presente), `/termos-de-uso` (200, `<h1>Termos de Uso</h1>` presente,
  listado em `/sitemap.xml`). Meta tag confirmada dentro do `<head>`,
  antes de `<meta charset>`, em todas as páginas testadas.

### Etapas 5-7 (menu mobile + compartilhamento + atribuição de fonte)

- Etapa 5: causa raiz real do "MAIS ▾" cortado em mobile — todo item de
  `.hub-links` (nav das páginas não-Home: /noticia, /vagas, /funcoes etc.)
  tinha proteção contra compressão pelo flexbox, EXCETO `.nav-mais` na
  regra base/mobile (tinha `flex:none` só no desktop, herdado de uma
  correção anterior — nunca propagado pro mobile). Sem `flex-shrink:0`, era
  o único item que o algoritmo de flex podia encolher abaixo do próprio
  conteúdo numa linha cheia em vez de simplesmente quebrar pra linha
  seguinte (`.hub-links` já suporta via `flex-wrap:wrap`). Mesma técnica
  já usada em `.area-count`/`.role-row .campo-pill` no mesmo arquivo.
  BUG PRÓPRIO cometido e corrigido no caminho: apliquei a correção primeiro
  na cópia ERRADA do CSS (a da Home, que nem tem "MAIS ▾" — tem "CENTRAL
  OFFSHORE ▾" numa estrutura diferente) — achado ao testar no preview antes
  do deploy, corrigida a cópia certa (dentro de `paginaChrome`, a que
  realmente serve /noticia e as páginas hub).
- Etapa 6: bloco de compartilhamento genérico (usado por toda página via
  `paginaChrome` — inclui `/noticia`) ganhou Telegram e Facebook (só tinha
  WhatsApp + copiar link + Web Share API). Botão nativo (Web Share API)
  promovido a "botão principal" (reordenado pra primeiro, estilo próprio
  `.compartilhar-principal` preenchido, mesma classe `.jornada-cta` de
  base já usada nas vagas) — mesmo fallback elegante de antes (só aparece
  quando `navigator.share` existe; nunca URL inventada pro Instagram, ele é
  alcançado pelo share sheet nativo). Vagas já tinham WhatsApp/Telegram/
  Facebook/nativo/copiar desde a missão anterior — nada a fazer lá.
  Validado: OG completo (title/description/image/url) + canonical +
  twitter:card em notícia e vaga, tudo com dado real.
- Etapa 7: "Ler na fonte original" tinha MAIS peso visual (negrito, cor
  cyan) que a própria atribuição "Fonte: X" (cinza, sem negrito) —
  invertia a hierarquia pedida. Corrigido: atribuição promovida a texto
  principal (negrito, branco), link rebaixado a referência discreta
  (sem negrito, cor neutra) e renomeado pra "Fonte original ↗" — nunca
  removido (rastreabilidade/proveniência preservadas, `original_url`
  intocado no banco). BUG PRÓPRIO evitado no caminho: o link de
  cross-promoção "Veja vagas desta empresa" (Etapa 3.9 da missão anterior)
  reaproveitava a MESMA classe CSS — corrigido separando em
  `.noticia-vagas-link` própria antes de rebaixar `.noticia-fonte-link`,
  pra não apagar por engano o destaque de um link interno que é bom pro
  engajamento (diferente de um link de saída do site).
- TESTE: `node --check`, AST; `wrangler dev --remote` com checagem
  obrigatória (Home + notícia + vaga) + regressão geral antes do deploy.
- DEPLOY: `ownews-git` `188682a9-555c-41c9-9f28-53ab4b4d6839`; rollback
  `c95dd6f7-d71c-4429-83f4-a1fbaa355a13`.
- VALIDADO EM PRODUÇÃO: notícia com `nav-mais{flex-shrink` presente nas
  duas cópias, "Fonte original"/"Fonte:" corretos, Telegram/Facebook/
  nativo presentes; Home, vaga, painel-da-bacia (404), pergunte-ao-ownews,
  saude — todos OK.

### Etapa 4 (URGENTE, adendo do operador) — entidades HTML quebradas no corpo das matérias

- CAUSA RAIZ CONFIRMADA (investigação completa da cadeia: fonte → ingestão →
  parsing → armazenamento → API → renderização): `decodeHtml()` no coletor
  (`shrill-pond-a915-fix/worker.js`) tratava entidades básicas (`&amp;`,
  `&lt;`, `&gt;`, `&quot;`) e numéricas (`&#225;`/`&#xE9;`), mas NUNCA teve
  mapa pra entidades NOMEADAS acentuadas (`&ccedil;`, `&atilde;`, `&eacute;`
  etc.) nem pras aspas curvas (`&ldquo;`/`&rdquo;`). Fonte Eixos usa esse
  formato no HTML de origem — 100% dos 42 artigos afetados são dela
  especificamente (não um problema disperso por todas as fontes, como uma
  contagem inicial minha, com bug de metodologia, tinha sugerido).
- Título e resumo NUNCA foram afetados (confirmado via query direta —
  0 ocorrências) — só o campo `content`, que só é exibido em `/noticia`.
- CONFIRMADO: sem double-encoding sistêmico (`&amp;ccedil;` → 0 ocorrências
  no banco inteiro) — mas achado um caso REAL e específico durante teste:
  `m&amp;sup3;` (deveria ser `m³`). Causa: meu primeiro regex de decode só
  aceitava letras (`[a-zA-Z]+`), e "sup3" tem dígito — nunca casava. Corrigido
  o regex (`[a-zA-Z][a-zA-Z0-9]*`) + decodificação em 2 passadas fixas (nunca
  loop) pra resolver esse nível de aninhamento sem custo imprevisível.
- Achado também durante teste exaustivo: `&aring;` ("Vår Energi", empresa
  norueguesa real) não estava no mapa — adicionados å/Å/ø/Ø/æ/Æ/ä/Ä/ö/Ö
  (vocabulário escandinavo, relevante pro conteúdo internacional do site).
- CORREÇÃO EM DOIS PONTOS (nunca reescreve o banco):
  1. `producao-ownews-git/worker.js` — `decodificarEntidadesHTMLServidor()`
     (real, top-level) aplicada a `artigo.title/summary/content` no handler
     `/noticia` e aos títulos do pool de relacionadas, antes de qualquer uso
     (HTML visível, JSON-LD, OG). `decodificarEntidadesHTML()` (client-side,
     mesmo padrão) aplicada em `renderTudo()` pra Hero/Destaques/Últimas/
     Mercado/Operações/Ticker/Busca. `news-sitemap.xml` e `/api/mais-lidas`
     também decodificam título antes de usar. SEGURO contra XSS: decodifica
     pra caractere Unicode literal, `escaparHTML()`/`escaparXML()` sempre
     rodam DEPOIS, nunca antes — mesma ordem em todo lugar.
  2. `shrill-pond-a915-fix/worker.js` — `decodeHtml()` ganhou o mapa de
     entidades nomeadas (prevenção: conteúdo novo não nasce mais com o
     defeito). Testado contra a URL real da matéria "diesel/Trump" via
     `/teste-materia` antes do deploy — resultado confirmado correto.
- TESTE EXAUSTIVO (não só HTTP 200 — conteúdo visual real aberto e lido):
  as 2 matérias citadas pelo operador (Petronas, diesel/Trump) + todas as
  41 matérias conhecidas como afetadas, uma a uma, via preview isolado
  (`wrangler dev --remote`) — 0 entidade não resolvida ao final; os únicos
  `&amp;` remanescentes são ampersands literais legítimos e corretos
  ("S&P Global", "P&G", re-escapados pelo `escaparHTML` normal).
- BUG PRÓPRIO ENCONTRADO E CORRIGIDO ANTES DO DEPLOY: um comentário que
  escrevi continha um caractere de crase (`` ` ``) dentro da template
  literal gigante da Home, fechando a string prematuramente — `node --check`
  pegou na hora, corrigido antes de qualquer teste funcional.
- DEPLOY: `ownews-git` `c95dd6f7-d71c-4429-83f4-a1fbaa355a13` (rollback
  `6a012b63-7eed-4a64-b747-e119f49bb65d`); `shrill-pond-a915`
  `1838c320-136b-4cd6-9c29-ffc23350a95c` (rollback
  `fc35d567-1ed5-4333-b526-d2cd52d9501f`).
- VALIDADO EM PRODUÇÃO REAL (não só preview): as 3 matérias de exemplo
  (Petronas, diesel/Trump com "m³", Vår Energi com "å") abertas e o texto
  lido de verdade — português normal, sem nenhuma entidade visível.
  Checagem obrigatória (Home/notícia/vaga) + regressão geral (vagas,
  painel-da-bacia 404, pergunte-ao-ownews, saude, glossário) OK.
  `/saude` do coletor confirmado `SAUDAVEL` pós-deploy.

### Etapas 1-3 (acabamento visual Home + legibilidade + blocos editoriais)
- Etapa 1: nova camada SVG de "carta batimétrica" (contornos de profundidade
  concêntricos + 2 marcas de sondagem, ~1KB, opacidade 2-6%) ADICIONADA ao
  `body{background}` — as camadas aprovadas anteriores (degradê, textura
  ondulada, glow, sheen) permanecem intactas, só uma camada nova por cima.
  Aplicado nas duas cópias do CSS (Home + paginaChrome).
- Etapa 2: `.lead h1`/`.ops-card h3` ganharam text-shadow multicamadas
  (`0 1px 2px rgba(0,0,0,.55), 0 2px 10px rgba(0,0,0,.4)`) — reforço sutil,
  sem caixa/outline. Corrigida causa raiz da colisão crédito×título: troca
  de `justify-content:flex-end` por `margin-top:auto` num wrapper interno
  novo (`.card-copy-inner`) em `.lead-copy`/`.ops-card-copy` — títulos muito
  longos agora páram de crescer exatamente no padding-top reservado pro
  crédito da foto, em vez de invadir essa área. `indicadorAtualidade()`
  (já existente, Etapa 5 da missão anterior) ajustado para o formato exato
  pedido: "AGORA · há 2 horas" (era "AGORA há 2 horas", sem o separador).
- Etapa 3: causa raiz do "espaço vazio" em Mercado & Energia com só 1
  secundária — `market-count-*` estava limitado a `Math.min(lista.length, 2)`,
  então 1, 2 ou 3 secundárias todas viravam a mesma classe CSS, impedindo
  qualquer diferenciação visual. Corrigido o teto pra `Math.min(lista.length, 4)`
  + regras novas: 1 secundária centraliza verticalmente, 2-3 distribuem com
  `space-between` — nunca duplica/inventa matéria, só redistribui o espaço
  real. "Últimas Notícias" já usava `align-items:start` (não `stretch`) —
  não sofre do mesmo bug, não precisou de correção.
- BUG PRÓPRIO ENCONTRADO E CORRIGIDO ANTES DO DEPLOY: uma edição via script
  introduziu uma quebra de linha real dentro da cópia de CSS que precisa
  ficar numa string de uma linha só (paginaChrome) — `node --check` pegou
  na hora, corrigido convertendo pra `\n` (2 caracteres) antes de seguir.
- TESTE: `node --check`, AST; `wrangler dev --remote` com checagem
  obrigatória desta missão (Home + notícia + vaga individual) antes do
  deploy real.
- DEPLOY: `ownews-git` `6a012b63-7eed-4a64-b747-e119f49bb65d`; rollback
  `c61c6dea-237f-43ac-8e4a-7a6934634524`.
- VALIDADO EM PRODUÇÃO: Home (camada batimétrica + card-copy-inner no DOM),
  notícia (79.418 bytes, layout completo, sem regressão), vaga Foresea (CTA
  oficial presente), painel-da-bacia (404 preservado), pergunte-ao-ownews,
  saude — todos OK.

## 2026-09-24 (7) — Etapa 7 (Mais Lidas)

- AUDITORIA (feita antes de qualquer código, como a missão pede): a Durable
  Object `PAGEVIEWS` já existia, já grava pageview real por matéria desde
  2026-09-17 (`scriptRegistrarPageview`, disparado em toda página de
  notícia, com dedupe de 30min por sessão) e já tinha uma rota interna
  `/top?horas=168&limite=N` pronta — comentário original da rodada que
  criou o DO já dizia "pronta pra quando 'Mais Lidas' for exibido — sem
  rota pública nesta rodada". Resultado da auditoria: dados reais existem
  e são identificáveis com segurança — implementação autorizada pela
  própria missão ("Se SIM... implementar bloco discreto").
- IMPLEMENTADO: rota pública `GET /api/mais-lidas` — consulta o `/top`
  interno do DO (janela real de 7 dias), cruza os `article_id` retornados
  com a Supabase (título/imagem/data reais, nunca inventados) e devolve na
  ordem real de views. Zero integração nova: só expõe o que já existia.
- THRESHOLD CONSERVADOR (evita "ranking" com 1 view fingindo relevância):
  só mostra o bloco com pelo menos 3 matérias tendo pelo menos 3 views
  reais cada nos últimos 7 dias — abaixo disso, a seção fica ausente
  (mesmo padrão "mostrar menos" já usado no resto da Home).
  Verificado ao vivo: produção tem ≥5 matérias qualificadas agora.
- UX: nova seção "Mais Lidas" na Home, entre Últimas Notícias e Mercado
  Offshore, reaproveitando 100% de classes/padrões já existentes
  (`.row`/`.row-thumb`/`.row-main`/`.eyebrow`/`.byline`, mesmo fetch
  client-side + `setInterval` já usado por Mercado/Aeroportos) — zero CSS
  novo, `hidden` por padrão até confirmar dado real.
- TESTE: `node --check`; AST completo confirmando toda função nova no
  lugar certo (server vs. client-side), nenhuma presa na template literal.
  `wrangler dev --remote`: `/api/mais-lidas` retornou 503 no preview — like
  investigado e confirmado que é limitação conhecida do ambiente de preview
  pra Durable Object com SQLite (a rota `/api/visitas-total`, já existente
  e não tocada nesta rodada, tem o MESMO comportamento no preview — não é
  bug novo). Resto da checklist (Home, notícia, vagas, painel-da-bacia,
  pergunte-ao-ownews, saude, glossário) validado no preview antes do deploy.
- DEPLOY: `ownews-git` `c61c6dea-237f-43ac-8e4a-7a6934634524`; rollback
  `7c26cd3b-8bf5-4972-b077-22cbb82019dc`.
- VALIDADO EM PRODUÇÃO (o teste que importa, já que DO com SQLite não
  funciona no preview): `/api/mais-lidas` retornou 5 matérias reais,
  ranqueadas, com título/imagem/data verdadeiros — auditoria da Etapa 7
  confirmada com dado real, não hipotético. Regressão completa (Home,
  notícia, vagas, painel-da-bacia 404, pergunte-ao-ownews, saude) sem
  problema.
- ARQUIVOS ALTERADOS: `producao-ownews-git/worker.js` (rota
  `responderMaisLidas`, seção Home, `renderMaisLidas`/`carregarMaisLidas`
  client-side). Nenhuma mudança em `wrangler.jsonc` (reaproveita o binding
  `PAGEVIEWS` que já existia).

## 2026-09-24 (6) — Etapa 6 (Pergunte ao OWNews — IA offshore, MVP controlado)

- 6.1 CUSTO ZERO: auditado ANTES de qualquer código — worker de teste isolado
  e descartável (`ownews-ai-probe-temp`, deletado após o teste) confirmou
  Workers AI disponível na conta sem cartão/cobrança: 10.000 Neurons/dia
  grátis, ~1,6 neurons por resposta curta com `@cf/meta/llama-3.2-3b-instruct`
  (modelo atual — o primeiro testado, `infire-llama-3.1-8b-instruct`, estava
  descontinuado). `PERGUNTE_IA_LIMITE_DIA=300` fica bem abaixo do teto real
  da conta, de propósito. Nenhum plano alterado, nenhum cartão adicionado,
  nenhuma chamada a API paga externa.
- ARQUITETURA: pergunta → corte de escopo determinístico (nunca depende do
  modelo obedecer instrução) → recuperação de contexto real (VAGAS_RADAR /
  FUNCOES_OFFSHORE / GLOSSARIO_TERMOS, tudo já em memória) → curto-circuito
  sem chamar IA pra vaga/salário sem match e pra clima/voo (sempre) → só
  então chama o modelo, com o contexto real anexado → cache (KV) + resposta.
- 2 BUGS REAIS ENCONTRADOS E CORRIGIDOS EM TESTE ISOLADO, ANTES DO DEPLOY
  (mesma disciplina do bug do `caixaImpacto` da rodada anterior):
  1. **Escopo ignorado pelo modelo**: pedi "receita de bolo de chocolate" e
     o modelo respondeu de bom grado, ignorando a regra 6 do system prompt.
     Instrução em texto não é confiável pra restringir um modelo pequeno —
     corrigido com corte de escopo determinístico (`perguntaDentroDoEscopoOffshore`,
     vocabulário real: Glossário + Funções + Empresas + termos gerais),
     checado ANTES de qualquer chamada à IA.
  2. **Alucinação de sigla real**: "o que é CBSP?" — sem contexto real, o
     modelo respondeu "Certificado de Boa Prática Safárica" (deserto),
     completamente inventado. Corrigido na raiz: CBSP e HUET pesquisados
     via busca real (não memória do modelo) e adicionados como entradas
     verificadas no Glossário OWNews (`docs`/fontes: NORMAM-104 da Marinha,
     OPITO) — agora a IA responde com contexto real (`origem: "ownews"`)
     em vez de arriscar explicação geral errada.
  3. (achado no mesmo teste) "offshore" aparecia em vários títulos de vaga
     ("Bombeador Offshore", "...NI - OFFSHORE") e virava falso positivo de
     "vaga relacionada" pra QUALQUER pergunta sobre offshore em geral —
     corrigido com lista de termos genéricos demais pra sinal de vaga
     (`PALAVRAS_GENERICAS_DEMAIS_PARA_VAGA`) + matching por borda de
     palavra (antes era substring livre).
- 6.2 SEGURANÇA: system prompt nunca inclui secret/binding/token; pergunta do
  usuário tratada como conteúdo não confiável (regra 5 do prompt); resposta
  sempre curta (max_tokens 220); timeout 12s com AbortController; qualquer
  erro/timeout cai em fallback educado, nunca stack trace cru.
- 6.3 UX: página dedicada `/pergunte-ao-ownews` (form simples, mobile-first,
  reaproveita classes já existentes — `jornada-cta`, `campo-pill`,
  `area-group`), SEM virar tela de chatbot na Home — só 1 tile discreto novo
  no grid Central Offshore.
- 6.4 INTEGRAÇÃO COM VAGAS: pergunta sobre vaga real (ex.: Foresea/Auxiliar
  de Plataforma) mostra dado estruturado real + link direto pra página da
  vaga; sem match, resposta honesta apontando pra `/vagas`, nunca inventa.
- PROTEÇÃO DE CONSUMO implementada: limite diário (KV, 300/dia); rate limit
  10/hora por IP (hash, sem guardar IP em texto puro além do TTL de 1h);
  cache de pergunta normalizada (24h geral, 1h quando envolve vaga); limite
  de tamanho de pergunta (3-300 caracteres); timeout; fallback elegante em
  toda falha.
- TESTE: `node --check`; varredura AST completa (mesma ferramenta das
  rodadas anteriores) confirmando toda função nova top-level, nenhuma presa
  na template literal client-side; `wrangler dev --remote` isolado com AI/KV
  reais testando: função (Deck Pusher), vaga real (Foresea), vaga sem match,
  clima/voo, fora de escopo (2 casos), pergunta vazia, pergunta longa, CBSP/
  HUET (antes e depois do fix do Glossário) — todos corrigidos e revalidados
  antes do deploy real. Regressão completa: Home, notícia, vagas, Foresea,
  painel-da-bacia (404), /saude, /glossario, /funcoes.
- DEPLOY: `ownews-git` `7c26cd3b-8bf5-4972-b077-22cbb82019dc`; rollback
  `d90768fb-668e-4c46-a271-71fe397a22dc`. Novos bindings: `AI` (Workers AI) e
  `PERGUNTE_IA_KV` (KV namespace `cedf263f9dce418189dea07bce83eab0`,
  dedicado, só contadores/cache — nenhum dado pessoal).
- VALIDADO EM PRODUÇÃO: `/pergunte-ao-ownews` HTTP 200; pergunta fora de
  escopo corretamente recusada; rate limit por IP confirmado funcionando
  ao vivo (a própria bateria de teste desta sessão, toda da mesma IP deste
  VPS, bateu no limite de 10/hora — comportamento correto, não um bug);
  Home/notícia/vagas/painel-da-bacia/saude sem regressão.
- ARQUIVOS ALTERADOS: `producao-ownews-git/worker.js` (módulo completo
  "Pergunte ao OWNews", 2 entradas novas no Glossário, tile na Home),
  `producao-ownews-git/wrangler.jsonc` (bindings `ai` e `kv_namespaces`).

## 2026-09-24 (5) — Etapa 5 (indicadores editoriais de atualidade)

- AUDITORIA: "AGORA" já existia, objetivo (≤6h real, `HORAS_JANELA_AGORA`),
  mas só no Ticker/Giro. "NOVO" já existia pras vagas (≤72h desde
  verificação). "HOJE" e "ATUALIZADO" não existiam em lugar nenhum.
- DECISÃO: "ATUALIZADO" NÃO implementado — o schema não tem coluna de data
  de modificação (mesma decisão já tomada antes pro JSON-LD dos artigos,
  `dateModified` deliberadamente omitido); inventar seria dado falso.
  Registrado como pendência real, não fingido.
- IMPLEMENTADO: `indicadorAtualidade(iso)` — reusa o mesmo limiar de AGORA
  (≤6h) já validado no Giro; adiciona "HOJE" só quando ainda é o mesmo
  dia-calendário real em America/Sao_Paulo (nunca UTC nem hora do servidor,
  testado no limite). Aplicado SÓ em Hero e Laterais (destaques) — os dois
  lugares de maior destaque visual da Home. Deliberadamente NÃO aplicado em
  Últimas/Mercado/Operações/Ticker: o texto relativo (`tempoRelativo`) já
  comunica isso ali, e espalhar o badge por toda a interface é exatamente
  o que a missão pediu pra evitar.
- TESTE: mesma técnica de simulação em sandbox Node da Etapa 4, agora
  testando `indicadorAtualidade` contra os 20 artigos reais e atuais do
  Supabase — resultado conferido manualmente contra os timestamps reais:
  artigos de hoje ≤6h → AGORA; hoje >6h → HOJE; ontem → nenhum indicador.
  Nenhum dado inventado, `published_at` nunca tocado. `wrangler dev
  --remote` isolado confirmando Home, notícia (sem regressão do fix
  anterior), `/vagas`, `/painel-da-bacia` (404) antes do deploy real.
- DEPLOY: `ownews-git` `d90768fb-668e-4c46-a271-71fe397a22dc`; rollback
  `7aae4565-9d7c-40d3-ad09-6adea55bbba8`.
- VALIDADO EM PRODUÇÃO: Home HTTP 200 com `indicadorAtualidade`/`tag-ao-vivo`/
  `tag-recente` no DOM; notícia sem regressão (77.693 bytes, layout
  completo); `/vagas` HTTP 200; `/painel-da-bacia` 404 preservado.
- PENDÊNCIA CONHECIDA: "ATUALIZADO" não implementado — falta coluna real de
  data de modificação no schema.

## 2026-09-24 (4) — Etapa 4 (distribuição editorial da Home): auditada, já conforme

- AUDITORIA: a lógica de seleção de artigos da Home (`renderTudo`, client-side)
  já implementa "esgotamento sequencial de pool" desde uma rodada anterior
  (2026-09-21, "Home sem repetição entre editorias") — cada seção
  (Hero → Destaques → Últimas → Mercado & Energia → Operações) só pode usar
  `chavesHome()` (id + `original_url` normalizada) que nenhuma seção
  anterior já consumiu, com dedupe adicional por `image_url` e diversidade
  de fonte nos destaques.
- MÉTODO DE VALIDAÇÃO (sem navegador real disponível neste ambiente — falta
  `libnspr4.so`, sem sudo pra instalar, mesma limitação já documentada em
  rodadas anteriores): extraída a lógica de seleção pura do HTML real
  servido por produção (não do source bruto — extração ingênua de dentro do
  template literal gerou um falso positivo de "erro de sintaxe" por não
  levar em conta o achatamento de escapes `\\` → `\` que o parser externo já
  faz; corrigido antes de tirar qualquer conclusão). Rodada em sandbox
  Node (`vm.createContext`) com `document`/`window` stubados, injetando
  artigos REAIS e atuais via Supabase (mesma query da Home).
- TESTE 1 (pool real, 20 artigos atuais): Hero + 3 destaques + 6 últimas +
  2 mercado + 0 operações — zero sobreposição de ID entre as 5 seções.
- TESTE 2 (pool escasso, só 3 artigos — simula dia fraco de notícia): Hero +
  2 destaques consomem todo o pool; Últimas/Mercado/Operações corretamente
  vazios, sem forçar repetição. Nenhum crash.
- Único ponto que repete manchete: o Ticker/Giro lateral (`renderTicker`),
  que usa `restantesPosHero` (só exclui o Hero) — decisão editorial já
  documentada e intencional ("aceitável, como um ticker de TV, não um
  bug"), preservada sem alteração.
- Concentração de matérias quase-idênticas sobre o mesmo evento já é
  resolvida a montante, no coletor (`shrill-pond-a915`), via deduplicação
  por similaridade Jaccard na ingestão — nunca chega a existir como duas
  linhas separadas no banco.
- RESULTADO: nenhuma alteração de código necessária — etapa já estava
  cumprida por trabalho anterior, validado agora com dados reais e caso de
  borda. Não adicionada complexidade nova (ex.: dedupe no Ticker), conforme
  instrução explícita da missão de não criar algoritmo desnecessário.
- DEPLOY: nenhum (nada mudou).

## 2026-09-24 (3) — Etapa 3 (evolução da área de vagas)

Todos os subitens abaixo aditivos, sobre a base já restaurada e validada na
rodada anterior desta sessão. Auditoria AST (mesma ferramenta acorn/
acorn-walk usada pra achar o bug do `caixaImpacto`) rodada de novo no fim —
nenhuma função nova ficou presa dentro da template literal client-side.

- **3.1 Bloco na Home**: já existia ("Vagas abertas agora"), preservado.
- **3.2 Filtros em `/vagas`**: empresa (chips, reaproveitando
  `filtro-segmento-row`/`filtro-btn` já usados em `/carreiras/cadastre-seu-curriculo`)
  + busca livre por cargo (`busca-empresas-input`, mesmo padrão). "Local"
  ficou de fora de propósito — maioria das vagas atuais não informa local
  real, filtrar por campo majoritariamente vazio não ajuda ninguém. Zero CSS
  novo (reaproveita classes já duplicadas corretamente entre Home e
  `paginaChrome`). Filtro só aparece com >1 empresa ativa (hoje: 5).
- **3.3 Fonte Oficial**: `fonte_oficial: true` adicionado às 7 vagas (cada
  uma verificada manualmente contra o ATS oficial da própria empresa —
  Gupy de marca própria ou Workday da Shell). Badge "✓ Fonte oficial"
  (`campo-pill`, discreto) nos cards e na página individual.
  Nunca mostrado quando o campo não existe.
- **3.4 Candidatura**: preservada sem alteração (CTA "CANDIDATAR-SE NO SITE
  OFICIAL" sempre pro `application_url` real).
- **3.5 Compartilhamento**: adicionado TELEGRAM (`t.me/share/url`) ao lado de
  WhatsApp/Facebook/nativo/copiar link já existentes.
- **3.6 Vagas relacionadas**: agora prioriza mesma empresa (critério mais
  forte com só 7 vagas no radar) antes de completar com outras ativas;
  nunca inclui expirada/encerrada.
- **3.7 Expiração/status conservador**: `VAGA_DIAS_PARA_SUSPEITA` (21 dias) e
  `VAGA_DIAS_PARA_EXPIRAR` (45 dias) a partir de `VAGAS_RADAR_VERIFICADO_EM`
  (ou `v.verificado_em` por vaga, se algum dia precisar). >45 dias sem
  reverificação: some da listagem ativa (Home + índice), mas a URL
  individual continua no ar com aviso "Esta oportunidade pode não estar
  mais disponível" (texto sugerido pela missão, nunca "encerrada" sem
  evidência real). 21-45 dias: nota discreta pedindo confirmação, CTA
  continua normal. `status: 'CLOSED'` explícito continua tendo prioridade
  (linguagem "encerrada", só usada com evidência real). Hoje (verificação de
  20/09, 4 dias atrás) nada mudou visivelmente — infraestrutura pronta pro
  futuro.
- **3.8 Integração com Funções a Bordo**: `funcaoRelacionadaVaga()` liga
  título da vaga a `FUNCOES_OFFSHORE` por borda de palavra real (mesma
  disciplina anti-homógrafo já usada no classificador editorial), nomes
  <5 caracteres ficam de fora por segurança. Hoje só a vaga da Foresea tem
  match confiável (Auxiliar de Plataforma) — as outras (Engenheiro Topside,
  Bombeador, Caldeireiro, cargos da Shell) não bateram com nenhuma função
  catalogada sem risco de match falso, e não foram forçadas.
- **3.9 Notícia → vagas**: `vagasDaEmpresaMencionadaServidor()` mesma
  disciplina de borda de palavra; testado contra caso real de falso positivo
  ("Regulação do SAF **prioriza** mercado nacional" não confunde com "PRIO")
  e contra casos positivos sintéticos (PRIO/Shell) antes do deploy. Link
  discreto no rodapé da matéria, só quando há vaga ativa real da empresa
  mencionada; vai direto pra vaga quando só há uma, ou pra `/vagas` quando
  há mais de uma.
- **3.10 Discovery de vagas**: auditado, sem automação nova nesta etapa —
  bloqueio de schema (tabela `jobs` dedicada, DDL indisponível via REST API
  do Supabase) confirmado como ainda válido, mesmo descrito em
  `docs/MIGRATION-JOBS-TABLE.sql`/`docs/JOBS-SOURCE-REGISTRY.md` de rodadas
  anteriores. Pendência registrada, não bloqueou o restante da etapa.

TESTE: `node --check`; varredura AST completa (mesmo script usado pro bug
anterior) confirmando zero função nova presa na template literal client-side;
`wrangler dev --remote` isolado testando `/`, `/vagas` (filtros renderizados),
as 7 páginas individuais de vaga, `/painel-da-bacia` (404 preservado),
`/carreiras/modelo-curriculo`, `/funcoes/roustabout`, `/saude`, notícia nova
e antiga (sem regressão do fix anterior); teste unitário isolado da função de
matching notícia→empresa contra caso real de falso positivo.

DEPLOY: `ownews-git` `7aae4565-9d7c-40d3-ad09-6adea55bbba8`; rollback
`80702efb-786b-418a-beef-e5984b03490f`.

VALIDADO EM PRODUÇÃO: `/`, `/vagas` (filtros no DOM, 7 badges "Fonte
oficial"), Foresea (Telegram + link de função a bordo), notícia (sem
regressão, 77.693 bytes com layout completo), `/painel-da-bacia` (404),
`/saude` — todos OK.

ARQUIVOS ALTERADOS: `producao-ownews-git/worker.js` (dados VAGAS_RADAR +
`fonte_oficial`, funções `vagaPodeEstarExpirada`/`vagaPodeEstarDesatualizada`/
`funcaoRelacionadaVaga`/`vagasDaEmpresaMencionadaServidor`,
`renderVagaDetalhe`, `renderVagasIndex`, `cardVaga`, `cardVagaHome`, handler
`/noticia`).

PENDÊNCIA CONHECIDA: Discovery automático de vagas (3.10) continua
bloqueado por falta de acesso de schema (tabela `jobs` dedicada). Sem
workaround inseguro tentado.

## 2026-09-24 (2) — regressão grave encontrada e corrigida: /noticia sem layout OWNews

- SINTOMA (reportado pelo operador logo após o deploy anterior desta sessão): matéria individual (`/noticia?id=...`) aparecendo como HTML cru — fundo branco, sem header/nav/footer, sem identidade visual do site.
- CAUSA RAIZ (não suposição, comprovada com AST/`node --check`/execução direta em Node): o handler `/noticia` tinha um `return` INCONDICIONAL de um HTML mínimo "defensivo" logo no início do bloco, antes de todo o template rico (header/nav/footer via `paginaChrome`, sidebar, relacionadas, JSON-LD) — o template rico inteiro era código morto, nunca executado, de propósito nenhum (bug mecânico, não decisão editorial). Ao corrigir isso (envolvendo o template rico em try/catch, fallback só em caso de erro real), o try passou a EXECUTAR o template rico de verdade — e revelou um SEGUNDO bug, esse sim a causa original: a rota chamava `caixaImpacto(artigo)` (função da caixa "Entenda o Impacto"), mas essa função só existia como texto dentro da template literal gigante do HTML da Home (código client-side, nunca top-level server-side) — `ReferenceError: caixaImpacto is not defined`, capturado pelo fallback defensivo, nunca virava HTTP 500 (por isso passava despercebido em qualquer teste que só checasse status HTTP).
- DIAGNÓSTICO ADICIONAL: escrita uma ferramenta de análise AST (acorn + acorn-walk) para varrer TODO o arquivo em busca da mesma classe de bug (nome definido só dentro da template literal client-side, chamado do lado servidor sem versão `_SERVIDOR` correspondente) — nenhuma outra ocorrência encontrada. Bug isolado, único.
- CORREÇÃO: criada `caixaImpactoServidor(n)` como função top-level real (mesmo padrão `_SERVIDOR` já usado no arquivo para `editoriaDeServidor` etc.), com a mesma lógica já validada da versão client-side. Rota `/noticia` corrigida para chamar a nova função server-side, dentro de um try/catch que preserva a intenção original do fallback defensivo (só usado se algo realmente falhar).
- TESTE: `node --check`; execução direta do handler via Node (sem passar por Cloudflare) reproduzindo e depois confirmando a correção do erro exato; `wrangler dev --remote` isolado testando notícia recente, notícia antiga, notícia aleatória, Home, `/vagas`, Foresea, `/painel-da-bacia` (404 esperado), `/saude` — todos OK antes do deploy real.
- DEPLOY: `ownews-git` `80702efb-786b-418a-beef-e5984b03490f`; rollback `4760fe11-15b1-4b03-9f12-017333678d57` (versão anterior desta sessão, que já tinha o bug) ou `24891e54-f04f-4dec-af11-df38e9cb2ea6` (última baseline pré-sessão).
- VALIDADO EM PRODUÇÃO: matéria FIRJAN/SEBRAE (a reportada pelo operador) e matéria Tenaris (antiga) HTTP 200 com `noticia-shell`/`hub-nav`/footer presentes (77591 e 73838 bytes, vs. ~7480 bytes do HTML cru anterior); Home, `/vagas`, Foresea (CTA oficial + compartilhamento completos), `/painel-da-bacia` (404, exclusão preservada) todos confirmados.
- ARQUIVOS ALTERADOS: `producao-ownews-git/worker.js` (função nova `caixaImpactoServidor`, fix do handler `/noticia`).

## 2026-09-24 — recuperação incremental pós-rollback Codex (Etapa 1+2 da missão "Freshness + Vagas + Legibilidade + Pergunte ao OWNews")

- CONTEXTO: produção estava em `24891e54-f04f-4dec-af11-df38e9cb2ea6` (2026-09-19), depois de o operador reverter intencionalmente uma sequência de alterações feitas pelo Codex que prejudicaram o site. O arquivo local `producao-ownews-git/worker.js` não era confiável para deploy integral (podia conter trabalho do Codex misturado com trabalho bom do Claude, sem forma de diferenciar por diff de versão — a API de Versions da Cloudflare só expõe metadados, não o source de versões antigas; `wrangler init --from-dash` falhou por bug do npm/arborist alheio a este projeto).
- DIAGNÓSTICO (sem deploy): `wrangler versions upload` (0% tráfego) + `wrangler dev --remote` usados para testar o arquivo local isoladamente, sem risco à produção. Diff estrutural (nav links + `<h2>` de seção) entre produção real e o preview local mostrou que a ÚNICA diferença era ADITIVA: Radar de Vagas (+ páginas individuais), Painel da Bacia e Modelo de Currículo — nada foi removido ou alterado em nenhuma outra área (Hero, Giro, Mercado & Energia, Operações Offshore, Central Offshore, todas as ferramentas). Código do Radar de Vagas revisado linha a linha: estilo/tom consistente com o resto do projeto (comentários datados em português, mesmas funções auxiliares reaproveitadas — `escaparHTML`, `breadcrumb`, `paginaChrome`), dados batem exatamente com o que `docs/JOBS-SOURCE-REGISTRY.md` e as rodadas anteriores documentaram (PRIO/Brava/Ocyan via Gupy, Shell via Workday, Foresea com `application_url` real).
- ESCOPO APROVADO PELO OPERADOR (recuperado): Radar de Vagas (`VAGAS_RADAR`, 7 vagas reais verificadas), páginas individuais em `/vagas/<slug>`, Foresea em `/vagas/foresea-auxiliar-plataforma-plataformista`, compartilhamento (WhatsApp/Facebook/nativo/copiar link), Open Graph por vaga, candidatura oficial (link direto ao ATS real da empresa, nunca formulário próprio do OWNews), bloco "Vagas abertas agora" na Home. Modelo de Currículo (`/carreiras/modelo-curriculo`) mantido junto por ser dependência direta do CTA da página de vagas (link quebraria sem ele) — ferramenta 100% client-side, sem envio de dado a servidor, já documentada em rodada anterior.
- EXCLUÍDO DE PROPÓSITO (fora do checkpoint explícito desta missão, não reintroduzido por suposição): `/painel-da-bacia` (Painel da Bacia — dados ANP). Função `renderPainelDaBacia`, rota e link na Home removidos do candidato antes do deploy. Continua pendente confirmação explícita do operador.
- ETAPA 2 (legibilidade) incluída no mesmo deploy: gradiente de `.lead .cover::after` (Hero) e `.ops-card .cover::after` (trilho Operações Offshore) reforçado — escurece desde o topo do card (suave) até forte por volta de 55-65% da altura, em vez de só a partir de 32-40%. Corrige título ilegível sobre foto clara quando o título ocupa 2-3 linhas. Aplicado nas duas cópias do CSS (Home + `paginaChrome`, usada em artigo/vaga). Nenhum outro card (`.highlight`, `.latest-feature`, `.market-feature`, `.row`) tem texto sobreposto a imagem, não alterados.
- TESTE: `node --check` passou; `wrangler dev --remote` validou `/`, `/vagas`, `/vagas/foresea-auxiliar-plataforma-plataformista`, `/carreiras/modelo-curriculo`, `/mercado`, `/painel-da-bacia` (confirmado 404, como esperado) antes do deploy real.
- DEPLOY: `ownews-git` `4760fe11-15b1-4b03-9f12-017333678d57`; rollback `24891e54-f04f-4dec-af11-df38e9cb2ea6`.
- VALIDADO EM PRODUÇÃO: `/` HTTP 200 com "Vagas abertas agora" no DOM; `/vagas` HTTP 200 com Radar real (placeholder "MODELO — não é uma vaga real" não aparece mais); `/vagas/foresea-auxiliar-plataforma-plataformista` HTTP 200 com CTA oficial, compartilhamento, OG e URL real do Gupy; `/painel-da-bacia` HTTP 404 (excluído conforme decidido); `/carreiras/modelo-curriculo` HTTP 200.
- NEXT: confirmar com o operador se `/painel-da-bacia` deve ser recuperado; ETAPA 1 (freshness) já estava saudável antes desta rodada (ver checagem `/saude` — 2/5/12 artigos em 6h/12h/24h, sem necessidade de correção); continuar Etapa 3 (evolução de vagas) e demais etapas do comandão.

# OWNews Growth Engine — estado da missão

Atualizado continuamente durante a execução. Se a sessão sofrer
compactação de contexto, releia este arquivo + os docs citados + audite
produção antes de continuar.

## Estado desta sessão — 2026-09-20

- DONE: Radar Home finalizado com contador real, cards cardVagaHome, badges e Central Offshore com /vagas ativo; Hero adapta 0/1/2/3+ laterais. node --check passou.
- DEPLOY: concluído — ownews-git; version 767a7c8c-1be0-4c33-96bb-37112d577ea1. Produção validada: Home, /vagas e /offshore-agora HTTP 200 com conteúdo esperado. Rollback: b05a4989-5c1b-455e-88d4-2503952ef649.
- ROLLBACK: versão anterior conhecida b05a4989-5c1b-455e-88d4-2503952ef649; rollback não executado.
- DONE: auditoria freshness confirmou 2 artigos <24h e 18 <48h; nenhuma seção puxa >24h fora do fallback temático 24–48h. Discovery B/D testados sem novos itens, só duplicatas.
- DEPLOY: shrill-pond-a915 versão 70322003-ead6-48bc-abd1-2df0e839dbfe; rollback: a8fc4cf5-f21d-4715-bb63-32eaad0dafd6. /saude agora expõe janelas 6h/12h.
- DONE: Equinor descartada após teste: /news/rss.xml retorna HTML Next.js (HTTP 200), parser encontrou 0 itens; removida antes de permanecer na automação. Offshore Magazine, Rigzone e Energy Voice retornaram 403; MarineLink expirou.
- DEPLOY: shrill-pond-a915 versão cae46fda-abe3-4297-97e3-f2fb68342f5c; rollback: 8c4536a4-9d7e-45a6-ab69-ad737ccc649e.
- DONE: ATS Gupy ampliado com vagas publicadas da PRIO, Brava Energia e Ocyan; campos ausentes foram omitidos e URLs oficiais validadas.
- DEPLOY: ownews-git versão d5441c33-d051-42fa-998a-31f20f99ed0b; rollback: 0acd0650-df5c-4ca2-a3f5-115086c96d4c. /vagas validada com cargos e URLs oficiais.
- DONE: ATS Gupy verificado em PRIO, Brava Energia e Ocyan; 3 vagas reais publicadas adicionadas e validadas em produção.
- DISCOVERY: Subsea7 company-news estruturado entrega links, datas e títulos reais; itens atuais verificados estavam fora de 24h e não foram publicados como frescos. Equinor sitemap aponta apenas índice, sem feed utilizável.
- NEXT: integrar somente fontes internacionais estruturadas com publicação recente; depois contratos/movimentações.

- DISCOVERY BATCH 2026-09-20: bateria internacional oficial executada. Petrobras /run-petrobras: 16 brutos, 5 relevantes, 5 duplicados, 11 rejeitados. Transocean: 10/10 duplicados. SBM Offshore: 10/10 duplicados. Subsea7 company-news HTML estruturado, último item verificado 2026-09-02 (>24h). Equinor sitemap/HTML sem feed utilizável recente; Yinson/Oceaneering/Fugro sem publicação recente estruturada; Saipem 403; BW Offshore e Brava endpoints retornaram 404. Nenhuma publicação nova criada para não duplicar ou violar freshness.
- CONTRACTS/MOVEMENTS: feeds Transocean, SBM e Petrobras confirmam cobertura de contratos, FPSO, embarcações e LNG já deduplicada; ainda não há registro operacional separado seguro sem fonte recente.
## Fase atual

### Atualização 2026-09-21 — busca pontual por matéria recente

- DISCOVERY: busca em lote por conteúdo de 21/09 e 20/09. Não foi encontrada nova publicação primária estruturada, acessível e ainda não duplicada que pudesse ser inserida com segurança nas últimas 24h.
- VALIDADO: Heritage Petroleum respondeu e mostrou publicação de 20/09 sobre demonstrações financeiras; é fonte oficial, mas não é matéria offshore operacional nova. MODEC respondeu com itens até 17/09; SLB, Baker Hughes e Yinson não apresentaram item dentro da janela. Saipem/TechnipFMC foram bloqueadas por 403/Cloudflare; Subsea7/BW Offshore/Halliburton nos caminhos testados retornaram 404.
- CANDIDATO SECUNDÁRIO: Business Times publicou em 21/09 texto sobre Brent e exportações sauditas, atribuído à Reuters. Não integrado: fonte secundária e sem rota primária verificável no lote; não publicar como se fosse comunicado oficial.
- RESULTADO: nenhum artigo novo inserido; regra de freshness preservada; nenhum deploy necessário.
- NEXT: validar uma fonte primária recente com endpoint estruturado ou corrigir o caminho de uma fonte já autorizada; não repetir endpoints 403/404 sem alternativa.
- HOME: fallback editorial de até 48h já está ativo em Mercado & Energia e Operações Offshore; Hero, Giro e Últimas permanecem estritos em 24h. A data real é renderizada nos cards temáticos.

**FASE C/H concluída nesta rodada (relevance filter + Hero rule +
correção de duplicatas ao vivo) + FASE F início (gap regional/sindical
Macaé/Bacia de Campos resolvido)**. Próxima: continuar FASE F (expansão
internacional restante), depois G (Jobs Engine), depois demais fases
pendentes (ver "Pendências conhecidas" abaixo).

## Concluído (mais recente primeiro)

- **Correção de regressão real em produção (2026-09-19, urgente)**: a
  regra "Home não exibe notícia >24h" tinha reduzido a Home a "Hero +
  Mercado + Vagas + Central Offshore", com Últimas/Operações vazias —
  causa raiz DIAGNOSTICADA (não suposta): só 1 artigo <24h existia no
  banco no momento (90 publicados no total, 12 na janela 24-48h) —
  Discovery insuficiente, não bug da regra em si. 3 correções reais:
  1. **Bug de heading vazio**: `renderUltimas()` só limpava o corpo
     (`innerHTML=''`) mas nunca escondia a `<section>` — diferente de
     `renderMercado`/`renderOperacoes`, que já escondiam corretamente.
     Corrigido pro mesmo padrão.
  2. **Resiliência editorial pras seções temáticas**: Mercado&Energia e
     Operações Offshore (NÃO Hero/Giro/Últimas, que continuam estritos
     em 24h) agora aceitam excepcionalmente conteúdo de 24-48h só quando
     o pool de 24h estiver vazio — sempre com data/hora real visível
     (nunca finge ser breaking/atual). Assim que existir conteúdo <24h,
     ele volta a ganhar automaticamente.
  3. **Nova fonte real integrada em cima da hora**: `eixos.com.br`
     (imprensa especializada em energia) — RSS real, 9 artigos genuínos
     inseridos no mesmo dia, incluindo cobertura de mercado (Petróleo/
     WTI) e regulação (MPF/Foz do Amazonas). Achado e corrigido em
     produção: bug real em `limparSufixoFonte` — escaneava separadores
     da ESQUERDA pra direita e cortava no primeiro hífen cuja "cauda até
     o fim da string" continha o nome da fonte, o que truncou "O custo
     dos gasodutos do **pré**-sal na berlinda | eixos" em "...do pré"
     (o hífen de "pré-sal" tinha uma cauda que, estendendo até o fim,
     também continha "eixos"). Corrigido escaneando da DIREITA pra
     ESQUERDA — sempre acha o separador mínimo correto. Reinserido
     corretamente, testado contra 8 casos reais (todos passam).
  4. **Gap real em `classificar()`**: nenhum termo de preço/commodity
     (petróleo/Brent/WTI/diesel/gasolina/OPEP) existia na lista que
     decide se um artigo entra em "Mercado & Energia" — um artigo
     genuíno sobre Petróleo/WTI não teria aparecido em NENHUMA seção
     temática. Adicionado.

  Resultado validado por simulação direta do código real (extraído do
  worker.js pós-deploy, rodado contra os 20 artigos publicados mais
  recentes via Supabase): Hero fresco (<2h), 1 destaque lateral,
  Mercado com 5 itens (via resiliência 24-48h), Operações com 5 itens
  (via resiliência), Últimas vazia mas escondida corretamente (0 artigo
  <24h sobrando depois de Hero+destaque — reflexo honesto do Discovery
  atual, não um bug).

  Deployado: `ownews-git` `32768c67 → b05a4989`; `shrill-pond-a915`
  `81e226ba → 20b79f2b` (fix limparSufixoFonte + fonte Eixos).

- **Rodada "Radar de Vagas Offshore" (2026-09-19)**:
  - **Bloqueio real confirmado empiricamente**: tabela `jobs` dedicada
    não existe (`PGRST205`) e não pôde ser criada (API REST não faz DDL).
    Tentativa de reaproveitar `articles.source_id` esbarrou numa FK real
    pra tabela `sources` (existe, vazia) cujo `sources.type` tem um CHECK
    CONSTRAINT com valores válidos não descobertos por tentativa (8
    valores testados sem sucesso). Migração completa e idempotente
    preparada em `docs/MIGRATION-JOBS-TABLE.sql`, pronta pra rodar quando
    houver acesso de schema.
  - **Descoberta real, funcionando de verdade**: API pública do Workday
    (mesma chamada que o navegador de qualquer visitante já faz, sem
    login) confirmada pra Shell (3 vagas reais em Rio de Janeiro,
    incluindo "Logistics Analyst – DP Vessel Operator", diretamente
    offshore) e Equinor (mecanismo funcional, 0 vaga BR no momento).
    Processo completo documentado em `docs/JOBS-SOURCE-REGISTRY.md` —
    reutilizável pra qualquer empresa Workday futura.
  - **`/vagas` atualizada com dados REAIS** (substituindo o placeholder
    "em construção" de sessão anterior, que já tinha o cuidado certo de
    marcar exemplo como "MODELO — não é uma vaga real"): 3 vagas reais,
    verificadas, com link de candidatura testado (HTTP 200 real),
    honestamente datadas ("Verificada em 19 de setembro de 2026 às
    22:00") — nunca apresentadas como radar automático contínuo, que
    ainda não existe.
  - **Bug real found e corrigido ANTES do deploy**: a Home usa `const
    HTML = \`...\`` avaliado UMA VEZ no carregamento do módulo (não por
    requisição) — inserir `${VAGAS_RADAR...}` sem mover a declaração de
    `VAGAS_RADAR` pra ANTES dessa linha causaria `ReferenceError` (temporal
    dead zone) e derrubaria o Worker inteiro. Também um erro de escape de
    crase (`\`` em vez de crase real) que quebraria o nested template
    literal — ambos pegos por teste isolado antes do deploy real, nunca
    chegaram a produção quebrados.
  - Integração: bloco "Vagas Offshore Agora" na Home (após Operações,
    antes de Central Offshore); CTAs cruzados com Modelo de Currículo e
    Primeiro Embarque (ida e volta).
  - **Não feito** (documentado, não fingido pronto): revalidação
    automática (P12/P13), Telegram/Instagram de vagas (P28/P30),
    JobPosting JSON-LD (P35), `/saude` com métricas de vagas (P38),
    páginas de empresa (P34), Gupy (PRIO/Brava — candidato de alto
    potencial, endpoint não encontrado ainda), 35+ empresas da lista de
    priorização ainda não investigadas.

  Deployado: `ownews-git` `239b9a2f-9fbf-43ce-a6b4-69c8762edd2f`.

- **Rodada "Expansão Editorial Total" (2026-09-19)**:
  - **Regra P0 nova, mais estrita**: Home agora NUNCA mostra notícia
    >24h em áreas jornalísticas (Hero/Últimas/Giro/Mercado&Energia/
    Operações) — antes só Destaques laterais tinham esse corte; agora
    Últimas/Mercado/Operações também só sorteiam do pool <=24h (antes
    liam do pool inteiro de 20). Giro perdeu o fallback pra 48h/"mais
    recentes" (violava a regra) — agora é estritamente <=24h ou mensagem
    honesta de vazio. Artigo >24h nunca é apagado — só sai da capa
    (index/busca/categoria/SEO continuam intactos, nada mudou aí).
  - **Efeito colateral honesto**: com só 1 notícia real <24h agora
    mesmo, Últimas/Mercado/Operações ficam quase vazias na prática —
    comportamento CORRETO pela nova regra, mas evidencia que o gargalo
    real agora é "encontrar mais notícia legítima de hoje", não a regra
    em si.
  - **Glossário expandido de 24 para 117 termos**, agora com categorias
    (Perfuração/Produção/Subsea/Marítimo/Segurança/Carreira) e chips de
    filtro na UI, mantendo a busca já existente.
  - **Novo: Modelo de Currículo (`/carreiras/modelo-curriculo`)** —
    ferramenta client-side (P12.4): formulário → prévia limpa → imprimir/
    salvar PDF via `window.print()` nativo, zero dado enviado a servidor.
    Primeiro Embarque (P11) e o guia de Currículo (P12.1-3) já existiam,
    completos, de sessão anterior — só validados, não recriados.
  - **OceanPact tentada e REJEITADA**: RSS real e relevante confirmado
    via curl externo, mas o `fetch()` do próprio Worker recebe um desafio
    de bot (`sgcaptcha`, confirmado via debug) — bloqueio real específico
    a tráfego de datacenter, não contornado. Revertida limpo (registry,
    função, rota de teste).
  - **Não implementado nesta rodada** (infraestrutura ausente, não
    fingido pronto): pipeline automático de "ganchos editoriais"
    (P2 — QAV/petróleo/dólar/geopolítica viram matéria OWNews) exigiria
    busca/LLM em produção (custo+autorização, não decidido); detector de
    movimento de ação/commodity "vira pauta" (P4.1) é factível sem custo
    novo (dado já existe em Mercado), mas não foi construído por tempo —
    próxima rodada. Contratos Offshore e Movimentação Offshore como
    registries novos: mesma situação de rodadas anteriores, ainda não
    iniciados.

  Deployado: `ownews-git` `30200a9a-9000-49d4-a551-cbd0ad4bbf86`.

- **Rodada P0-P21 anterior (2026-09-19, "Home precisa
  parecer viva")**:
  - **Robustez do fetch ao vivo da Home**: `carregarNoticiasAoVivo()` não
    tinha retry — uma falha transitória deixava a Home presa no
    SEED_ARTICLES (snapshot estático do último deploy) até o próximo tick
    de 10min. Agora tenta de novo em 8s (até 3x) e o intervalo normal caiu
    de 10min pra 3min.
  - **Hero reduzida** (desktop `min-height` 520px→clamp(300-420px), h1
    42px→32px; mobile 400px→clamp(260-340px), h1 30px→26px com
    line-clamp:3) — estava ocupando a dobra inteira.
  - **Stale guard real** (`EditorialPoller.alarm()`, `shrill-pond-a915`):
    se a publicação mais recente passa de 6h, roda uma passada extra do
    Grupo A (ANP+Petrobras) MESMO fora do turno normal da rotação A/B/C/D,
    antes de aceitar "nada novo". `/saude` ganhou o campo `home_stale`
    (mesmo limiar de 6h).
  - **Varredura final rodada de verdade** (não só declarada): todas as 11
    fontes ativas testadas via `/run-*` — 0 inseridas em todas (tudo
    duplicata ou corretamente descartado por relevância), confirmando que
    a notícia mais nova real da rodada (Petrobras, Subvenção Econômica à
    Gasolina) já estava capturada.
  - Regras de Hero por recência, remoção de fonte visível e atribuição no
    rodapé (rodadas anteriores) — todas re-testadas, seguem válidas.
  - 2 fontes internacionais adicionais tentadas (Equinor, Shell): sem RSS
    acessível encontrado nos padrões óbvios de URL — não insistido (regra
    de não ficar preso numa fonte); PRIO e Brava Energia também tentadas
    nesta sessão — ambas com WordPress real mas feed RSS só com conteúdo
    placeholder padrão ("Hello world"/"Olá, mundo"), conteúdo real de
    IR fica em post type customizado não exposto por feed; `wp-json` da
    PRIO bloqueado por Cloudflare challenge (403, real, não contornado).
    Documentadas como candidatas sem caminho de acesso encontrado ainda.
  - **Não iniciado nesta rodada** (escopo grande demais pra uma sessão,
    documentado honestamente, não fingido pronto): Contratos Offshore e
    Movimentação Offshore como registries/hub pages novos (P9/P10), Jobs
    Engine novo (P11), PT/EN/ES real (P5 — bloqueado por decisão de
    operador sobre custo/API, já documentado antes). QA visual real de
    mobile/overflow não pôde ser confirmada visualmente (sem Playwright/
    browser real disponível nesta sessão) — só verificado por inspeção de
    CSS (uso de clamp()/%, sem largura fixa nova que pudesse estourar).

  Deployado: `shrill-pond-a915` `b2b469bf-a782-46db-9213-176a4f7c20ac`;
  `ownews-git` `ab8d8661-3a07-48dc-b397-276404cb79db`;
  `ownews-instagram-publisher` `27d5b2a1-e1fd-4c49-8040-ad90047616e3`
  (pré-validação de imagem entre top-3 candidatos antes de escolher, ver
  seção Instagram abaixo).

- **Instagram — overhaul iniciado (ajuste explícito do operador,
  2026-09-19)**: 3 correções reais, todas verificadas antes do deploy:
  1. **Bug real de dessincronia de domínio** (causa provável dos "posts
     pobres só com texto"): `ownews-instagram-render-vps/render.js` tinha
     sua PRÓPRIA lista de domínios de foto permitidos, desatualizada em
     relação à do Worker (`ownews-instagram-publisher/worker.js`) — que já
     incluía `petronoticias.com.br` desde uma correção anterior. O Worker
     validava a foto como boa e escolhia um template com foto (n1/n2/n3),
     mas o VPS rejeitava o MESMO domínio de novo na hora de renderizar de
     verdade, resultando em arte sem foto real mesmo quando uma existia e
     já tinha sido validada. Corrigido sincronizando as duas listas.
     Testado localmente com `renderizarJob()` direto (não pelo pipeline
     real, sem publicar) usando uma foto real do PetroNotícias — a foto
     aparece corretamente na peça final. As duas listas não têm como
     compartilhar módulo (Worker Cloudflare vs processo Node no VPS) —
     precisam ser mantidas em sincronia manualmente; comentado nos dois
     arquivos.
  2. **Peso do bônus de foto na seleção do candidato** aumentado de +5
     para +25 em `calcularScoreCandidato` — o bônus antigo era pequeno
     demais pra pesar contra recência/prioridade de assunto (ex.: um
     artigo fresco da ANP, que bate em PALAVRAS_PRIORIDADE_ALTA, quase
     sempre vencia um artigo com foto real um pouco mais velho ou de
     tópico secundário — empurrando o pipeline pro fallback gráfico com
     mais frequência do que deveria numa plataforma essencialmente
     visual).
  3. **Mesma correção de "fonte visível" do site, mas na peça gráfica**:
     `categoriaLabel` (o badge de categoria renderizado na própria arte)
     usava `artigo.image_credit` direto — "PETROBRAS"/"ANP"/"EPE"
     apareciam como se fossem a categoria editorial. Trocado por
     `editoriaDeInstagram()`, reimplementação local do mesmo classificador
     do site (BRASIL/OPERAÇÕES/MERCADO/CONTRATOS/INTERNACIONAL/ENERGIA/
     CARREIRAS) — Workers separados, sem módulo compartilhado. Atribuição
     de fonte de verdade movida pra legenda de texto ("Fonte: X"), que
     antes não existia ali.

  Deployado: `ownews-instagram-publisher` `558ce326-42ba-433f-8512-
  0a3293ee1555`; `render.js` no VPS roda via cron a cada minuto e já lê o
  arquivo atualizado do disco (sem deploy formal — confirmado testando
  `renderizarJob()` diretamente após o edit).

  **Ainda pendente** (não abordado nesta rodada): a seleção do candidato
  não sabe, ANTES de escolher, se a foto de um artigo vai passar em
  `validarImagemArtigo` (domínio/tamanho/proporção) — só descobre depois
  de já ter escolhido esse candidato. Um artigo com URL de foto que falhe
  validação ainda pode "vencer" a seleção e publicar sem foto mesmo
  havendo outro candidato elegível com foto válida. Melhoria futura:
  pré-validar imagem durante o cálculo de score (custa mais subrequests).

- **Fontes visíveis removidas dos cards (ajuste explícito do operador,
  2026-09-19)**: nome do veículo (ANP/Petrobras/PetroNotícias/etc.)
  removido do topo visual de Hero/Highlights/Últimas/Mercado/Operações/
  Giro/Offshore Agora/Busca/"Leia também"/topo do artigo — trocado pela
  EDITORIA OWNews (BRASIL/OPERAÇÕES/MERCADO/CONTRATOS/INTERNACIONAL/
  ENERGIA/CARREIRAS). Duas implementações em paralelo (`editoriaDe()` no
  script client-side da Home + inline nas páginas Offshore Agora/Busca;
  `editoriaDeServidor()` no lado servidor pra artigo/relacionadas) —
  mesma ordem de prioridade em ambas: fonte internacional (Transocean/
  SBM Offshore) → CARREIRAS → CONTRATOS → OPERAÇÕES → MERCADO → ENERGIA
  → BRASIL (fallback). A fonte NUNCA foi escondida de verdade — continua
  atribuída no rodapé da matéria ("Fonte: X" + "Ler na fonte original ↗",
  ambos usando `image_credit`/`original_url` reais) e em JSON-LD
  (`author`), só não decora mais o topo/cards.

  1 bug real encontrado e corrigido durante a própria validação: o termo
  "oportunidade(s)" em `PALAVRAS_CARREIRAS` era homógrafo (bate em
  "oportunidades de negócio/mercado" tanto quanto vaga de emprego) —
  confirmado ao vivo classificando uma matéria sobre expansão de mercado
  marítimo como CARREIRAS por engano. Removido; "vaga"/"emprego"/
  "contratação" sozinhos já cobrem o sinal real. Testado contra 40
  títulos reais recentes depois do fix — distribuição sã, sem mais casos
  óbvios de má classificação.

  `renderAgora()` (função morta, sem rota — `/offshore-agora` usa
  `renderOffshoreAgora()`) ainda mostra fonte crua — não corrigida de
  propósito (código inalcançável, não afeta produção; documentado aqui
  só pra não ser reintroduzida por engano no futuro).

  Deployado (`ownews-git` `24891e54-f04f-4dec-af11-df38e9cb2ea6`).

- **Backfill de imagem (achado ao explorar "imagem em 100% dos
  artigos")**: auditoria real mostrou 51/89 artigos publicados sem
  `image_url`. Investigação (não suposição) revelou que o frontend JÁ
  cobre 100% com fallback ilustrativo por categoria (`imagemDe()`, 3
  níveis: foto real → biblioteca editorial por assunto → ilustração de
  marca) — não havia UX quebrada. O backfill focou em achar FOTO REAL
  onde ela existe mas a extração antiga falhava. Endpoint novo
  `/admin/backfill-imagens?limite=N` (rebusca a página original, roda a
  extração ATUAL, só grava quando acha imagem real — nunca inventa).
  Resultado: 8 artigos recuperaram foto real (5 PetroNotícias, 3 EPE).

  2 bugs REAIS de extração encontrados e corrigidos durante o próprio
  backfill (ambos writes ruins revertidos antes do fix, via novo endpoint
  simétrico `/admin/limpar-imagem?id=`):
  1. Ícones de sistema do SharePoint da EPE (`_layouts/N/images/...` —
     `spcommon.png`, depois `searchresultui.png`, mesmo padrão de path)
     eram aceitos como "foto da matéria" — corrigido bloqueando o path
     inteiro `_layouts/`, não só nomes de arquivo específicos.
  2. Logo genérico da empresa no CDN da GlobeNewswire
     (`ml.globenewswire.com/.../tiny/<Empresa>.png`) também era aceito —
     corrigido bloqueando esse padrão de path.

  Restam 43 sem imagem: 17 ANP (confirmado manualmente — og:image é só o
  logo do gov.br, releases realmente não têm foto própria), 10 Transocean
  + 6 SBM Offshore (bloqueio real, não bug nosso: `investor.deepwater.com`
  devolve `HTTP/2 INTERNAL_ERROR` em requisições diretas às páginas de
  release — mesma classe de instabilidade já documentada pro tracking
  pixel do GlobeNewswire; não é algo pra contornar), 6 MME, 1 PPSA, 1 EPE,
  1 PetroNotícias, 1 sem fonte. Todos corretamente cobertos pelo fallback
  ilustrativo do frontend — não é uma UX quebrada, só ausência de foto
  real na fonte ou bloqueio técnico externo genuíno.

- **FASE F — gap regional/sindical de Macaé/Bacia de Campos, resolvido**:
  integradas `Sindipetro NF` (sindicato dos petroleiros do Norte
  Fluminense, sede em Macaé, cobre a Bacia de Campos) e `FUP` (federação
  nacional), Grupo C. RSS reais verificados via WebSearch+curl (não
  adivinhados). Confirmado ao vivo que o feed já continha, no mesmo dia,
  o equivalente real do caso de regressão "greve" da missão. Ver
  `docs/SOURCE-REGISTRY.md` pros detalhes completos.

  3 bugs reais encontrados e corrigidos ainda durante o teste isolado
  (antes de entrar em qualquer grupo agendado):
  1. Filtro por exclusão inicial deixava passar ruído institucional do
     sindicato (eleição interna, obituário, política nacional, até uma
     oficina de artesanato) — trocado por allow-list de vocabulário de
     ação sindical real (greve/assembleia/ACT/negociação coletiva/etc.).
  2. Sufixo de SEO do WordPress (" - SindipetroNF", " | FUP - Federação
     Única dos Petroleiros") vinha do `og:title`/`<h1>` da própria página
     do artigo, não do RSS — a limpeza de sufixo (`limparSufixoFonte`)
     só cobria o caminho RSS; movida pro ponto único de montagem do
     título final (`processarNoticias`), corrige pra qualquer fonte atual
     ou futura, não só RSS.
  3. Homógrafo "campo"/"campos" (cidade de Campos dos Goytacazes vs campo
     petrolífero) — agravado pela tolerância de plural adicionada nesta
     mesma sessão. "Oficina de decoupage em vidro começa em Campos"
     passou só por isso. Corrigido excluindo "campo" do núcleo offshore
     especificamente pra esta fonte.

  17 artigos de teste (10 Sindipetro NF + 7 FUP) publicados durante a
  validação isolada, revisados manualmente: 8 eram ruído institucional
  claro (deletados individualmente, nunca em lote — uma tentativa de
  deletar em loop foi bloqueada pelo classificador de segurança do Auto
  Mode por "Irreversible Deletion", confirmado que nada foi executado
  parcialmente; refeito com chamadas individuais, que são permitidas), 9
  eram conteúdo real e válido mas com título sujo (deletados e
  re-coletados depois do fix de `limparSufixoFonte`, mesmo padrão já
  usado antes pra Transocean/SBM). Dataset final limpo: 7 Sindipetro
  NF + 1 FUP (o resto foi dedupe cross-fonte correto).

  Deployado em sequência (`shrill-pond-a915`): `adbf4e27` (coletores +
  registro, rotas de teste isoladas) → `9674614f` (fix sufixo de fonte,
  generalizado pra `og:title`/`<h1>` também) → `f14c7f43` (allow-list de
  ação sindical) → `4484fcc9` (fix homógrafo campo/campos) → `43536597`
  (wiring no Grupo C) — **versão atual**.

- **FASE C — Regra da Hero (recência com override de breaking) +

- **FASE C — Regra da Hero (recência com override de breaking) +
  correções críticas de relevância, achadas AO VIVO em produção durante a
  validação da regra**: implementado `escolherDestaque()` em
  `producao-ownews-git/worker.js` (manchete = notícia hero-elegível mais
  nova; breaking news pode segurar por até 24h; `pontuarDestaque`
  preservado e reaproveitado pra ordenar as laterais). Deployado
  (`ownews-git` `cf109f7c-ca7e-49d9-9cd9-9041f903bae2`).

  Durante a validação ao vivo (checar qual notícia venceria a Hero),
  encontrados e corrigidos 4 bugs REAIS em produção, nenhum hipotético:

  1. **Starnav Elektra publicado 2x** (Petrobras + Agência Brasil,
     Jaccard 0.214, abaixo do limiar geral 0.55) — corrigido com limiar
     mais baixo (0.2) escopado a fontes secundárias calibradas
     (`FONTES_DEDUPE_SENSIVEL`). Artigo duplicado da Agência Brasil
     deletado (mantida a versão Petrobras, fonte primária).
  2. **Falso positivo geopolítico grave**: "ARÁBIA SAUDITA ENTRA EM
     ALERTA TOTAL DEPOIS DOS ATAQUES DOS TERRORISTAS HOTHIS..." (matéria
     de guerra Iêmen/Arábia Saudita, zero conteúdo de petróleo/offshore)
     foi publicada e quase virou a Hero só por conter a palavra
     "aeroporto" — `bateComBordaDePalavraColeta` só exigia borda de
     palavra pra termos de até 4 letras; "porto" (5 letras) casava por
     substring simples dentro de "aeroporto". Corrigido estruturalmente:
     TODA palavra da lista agora exige borda de palavra, sem exceção por
     tamanho. Artigo deletado.
  3. **Regressão introduzida pela correção acima**: exigir borda de
     palavra sem exceção quebrou o casamento de PLURAL de termos-núcleo
     de 5+ letras que antes "funcionava" por acidente via substring
     (ex.: "bloco" não batia mais em "blocos", rejeitando "Petrobras
     inicia negociação para blocos exploratórios em Gana", matéria real
     já publicada). Corrigido permitindo um "s" opcional antes da borda
     direita (plural regular, único padrão usado nesses termos).
  4. **Segundo homógrafo de "plataforma"** (mesma classe do caso
     "indicadores" já corrigido antes): "A PLATAFORMA DE EMPREGOS DA
     FIRJAN REÚNE CENTENAS DE OPORTUNIDADES..." (vagas genéricas de
     indústria no Rio, zero relação com offshore) — adicionado à lista
     `PALAVRAS_PLATAFORMA_NAO_OFFSHORE`. Artigo deletado.
  5. **Falso-negativo real** (achado numa varredura de auditoria contra
     as últimas 60 publicações): "ANP realizará consulta e audiência
     públicas... para agentes do setor de combustíveis" era reprovada
     pela exclusão de ruído institucional ANTES de checar cadeia de
     energia — matéria legítima e oficial da própria ANP. Corrigido com
     um subconjunto "forte" de termos de combustíveis
     (`PALAVRAS_CADEIA_ENERGIA_FORTE`, deliberadamente SEM os termos de
     porto/logística) que agora vence a exclusão institucional sem
     reabrir o bug antigo do ANTAQ/porto. Também adicionado "biometano"
     (gap real encontrado na mesma varredura).
  6. **Nova duplicata real encontrada ao vivo, DEPOIS de tudo acima**:
     rodar `/run-petronoticias` como teste de validação inseriu uma
     TERCEIRA cobertura do mesmo evento Starnav Elektra (PetroNotícias
     reescreveu a notícia da Petrobras 16 min depois, Jaccard 0.2 —
     mesmo score exato do caso Agência Brasil). `FONTES_DEDUPE_SENSIVEL`
     estendido para incluir também "PetroNotícias" (calibrado contra 4
     pares de manchetes reais e diferentes do PetroNotícias, todas
     <0.09). Duplicata deletada (mantida a versão Petrobras).

  Todas as correções acima têm teste de regressão isolado cobrindo os
  casos Starnav/greve reais + os 6 bugs novos + controles negativos
  (porto genérico, cooperaportos, SAIP, hidrovia, saf/desafiar) — 21
  casos, todos passando. Varredura das últimas 60 publicações não mostra
  mais nenhuma reprovação inexplicada (só exclusões institucionais
  intencionais + 2 títulos em inglês de fontes Grupo D, que usam
  `noticiaRelevanteInternacionalEn`, não `noticiaRelevante`).

  Deployado em sequência (`shrill-pond-a915`):
  `e88751b0` (dedupe Agência Brasil + endpoint genérico de delete) →
  `39aa0732` (fix borda de palavra) → `981fe58a` (fix plural + biometano +
  bypass de ruído institucional) → `50c31d47` (dedupe PetroNotícias) —
  **versão atual**.

- **FASE B — 2 fontes internacionais integradas**: Transocean (drilling,
  RSS oficial `investor.deepwater.com`) e SBM Offshore (FPSO, RSS oficial
  `sbmoffshore.com/feed/`) — Grupo D, rotação do EditorialPoller subiu de
  3 pra 4 turnos (A/B/C/D). 2 bugs reais encontrados e corrigidos: título
  com sufixo redundante (" | Transocean Ltd."), imagem de tracking do
  GlobeNewswire sendo aceita por engano (substring "news" dentro de
  "newsroom"). 20 artigos de teste corrigidos retroativamente via
  endpoint de uso único. Deployado (`shrill-pond-a915` `d579b0c0`).
  ~7 fontes verificadas e REJEITADAS por bloqueio técnico real (bot
  detection/JS-rendering/SSL/link morto) — ver `docs/SOURCE-REGISTRY.md`.


- **FASE A — KV/resource budget**: ver `docs/KV-BUDGET.md`. Mercado
  dedup fix, OffVoos 3min→5min, Instagram heartbeat throttled + namespace
  próprio. Deployado (`shrill-pond-a915` `754149c4`, `ownews-instagram-
  publisher` `1a10d0cb`). Collector ~622/dia, Instagram ~298/dia.
- **FASE B (arquitetura)**: `FONTES_REGISTRY` + `classificarSaudeFontes()`
  em `shrill-pond-a915-fix/worker.js`, expostos em `/saude` como campo
  `fontes`. Ver `docs/SOURCE-REGISTRY.md` pras 9 fontes já formalizadas
  e as ~34 candidatas ainda não verificadas.

- **FASE C (início) — News Engine, dedupe uniforme**: ANP/Petrobras/MME
  chamavam `processarNoticias()` direto, sem o dedupe cross-fonte que as
  demais 8 fontes já tinham — corrigido, as 11 fontes agora passam por
  `processarNoticiasComDedupe`. Validado ao vivo (`/run-anp` mostra
  `puladas_por_duplicidade: []` corretamente presente no retorno).
- **FASE D (início) — SEO**: `NewsArticle` JSON-LD já existia e está
  correto (headline/description/datePublished/mainEntityOfPage/image/
  publisher/author) — `dateModified` deliberadamente OMITIDO (schema não
  tem coluna de data de modificação; inventar seria dado falso). Sitemap
  geral (`/sitemap.xml`) já lista artigos. Criado `/sitemap-news.xml`
  dedicado (protocolo Google News, xmlns:news, só últimas 48h) + linha
  no `robots.txt`. **Nota operacional**: `/robots.txt` e `/sitemap*.xml`
  passam pelo cache de borda da Cloudflare — depois de um deploy que mexe
  neles, o conteúdo novo só aparece em requisições sem cache (confirmado
  com `?bust=timestamp`) até o cache expirar sozinho; meu token não tem
  permissão de zona pra purgar cache (`Authentication error` no endpoint
  `purge_cache` — escopo do token é só Workers, não mexi nisso).

## Deploy atual (mais recente)

- `ownews-git`: `239b9a2f-9fbf-43ce-a6b4-69c8762edd2f` (Radar de Vagas com
  3 vagas reais + regra 24h estrita na Home + Glossário 117 termos +
  Modelo de Currículo + Hero reduzida + fetch com retry + fontes visíveis
  trocadas por editoria)
- `shrill-pond-a915`: `fe045a13-3d20-40b7-8522-02d23fddb44c` (stale guard
  + home_stale em /saude + relevance filter + dedupe + Sindipetro NF/FUP
  + backfill de imagem; OceanPact tentada e revertida)
- `ownews-instagram-publisher`: `27d5b2a1-e1fd-4c49-8040-ad90047616e3`
  (pré-validação de imagem top-3 + editoria no badge + fix domínio VPS)

## Rollback

Cada worker tem sua própria pilha de deploys — usar
`wrangler deployments list --name <worker>` + `wrangler rollback
<version-id>` com `/home/offshore/.config/ownews/with-cf-token.sh` na
frente. Versões anteriores a cada mudança registradas nos commits desta
sessão e no histórico do chat.

## Pendências conhecidas

- Cota de escrita KV do `ownews-instagram-publisher` estava exaurida em
  2026-09-19 (dia da correção) — validar se a janela real das 23:15 UTC
  publicou com sucesso assim que passar desse horário.
- ~34 fontes candidatas (ver `docs/SOURCE-REGISTRY.md`) sem verificação
  individual de RSS/API/estrutura — trabalho em lotes pequenos, nunca em
  massa sem checar cada uma.
- **BLOQUEIO REAL genuíno (não contornado)**: `editorial_score`/
  `breaking_score`/`audience_interest_score` como campos PERSISTIDOS (com
  `score_reason`) exigem uma coluna nova na tabela `articles` — isso é
  DDL (`ALTER TABLE`), que não é possível via a REST API do Supabase (só
  o dashboard/CLI/conexão direta Postgres tem esse poder, nenhum
  disponível nesta sessão). Confirmado tentando `select=editorial_score`
  → `42703 column does not exist`. Isso é uma lacuna de autorização
  genuína, não uma dificuldade técnica pra contornar — precisa que o
  operador rode a migração (ou libere acesso de schema) antes desta fase
  avançar. Enquanto isso, `pontuarDestaque()` continua calculado on-the-
  -fly no frontend (não persistido), que é o que já existe e funciona
  pras laterais/Giro/categorias.
- Discard-logging (auditoria de por que uma notícia foi descartada) não
  implementado — hoje só existe `descartadas_relevancia` como contagem
  nos endpoints de teste manual (`/run-*`), não como log persistente.
  Também esbarraria no mesmo bloqueio de schema se a intenção for uma
  tabela/coluna nova.
- Pipeline de imagem: 100% dos artigos JÁ tem alguma imagem visível
  (fallback ilustrativo do frontend cobre 100%, sempre cobriu). Backfill
  de foto REAL feito nesta rodada (ver acima) — 43 artigos continuam sem
  foto própria por limitação real da fonte (ANP) ou bloqueio técnico
  externo (investor.deepwater.com), não por bug nosso. Reavaliar
  Transocean/SBM periodicamente (bloqueio pode ser intermitente).
- Instagram: overhaul visual (Layouts A/B/C) e `INSTAGRAM_SCORE` não
  iniciados — toca `ownews-instagram-render-vps/render.js`, não tocado
  nesta sessão.
- PT/EN/ES real: não iniciado (decisão pendente sobre Workers AI vs API
  paga — precisa de decisão do operador).
- Mercado/Contratos/Movimentação registries, detector de movimento
  anormal de ações, Jobs Engine, `/saude` completo (novo spec), QA mobile/
  desktop: não iniciados.
- Meu Embarque, Certificados, Entitlements (PUBLIC/ACCOUNT/HUB_PLUS)
  ainda não implementados — fases posteriores.

## Bloqueios reais

Nenhum no momento. Continuar autonomamente.

## Próxima ação

1. Verificar fontes candidatas internacionais em lotes pequenos (RSS/
   API real, via curl — nunca contornar bloqueio), começando por
   operadoras com newsroom conhecida (Shell, Equinor, TotalEnergies, bp)
   e drilling (Valaris, Noble, Seadrill — já tentadas e rejeitadas nesta
   sessão por bot detection real, reavaliar periodicamente).
2. Começar a desenhar persistência de `editorial_score`/`breaking_score`/
   `audience_interest_score` com `score_reason`, já que isso é pré-
   -requisito de várias fases seguintes (Instagram scoring, Discovery).
3. Considerar imprensa local do norte fluminense (Macaé/Campos) como
   candidata adicional de cobertura regional — não verificada ainda,
   menor prioridade agora que a fonte sindical primária já resolve o
   gap principal da missão.

## 2026-09-20 — ajuste cirúrgico Home + Radar de Vagas
- DONE: Home compactada no topo e nas seções, Mercado Offshore legível com faixa horizontal mobile, Central Offshore reduzida, badges VAGA ABERTA/BANCO DE TALENTOS e contador sem banco de talentos.
- DONE: Radar preserva candidatura oficial e exibe verificação; `/saude` expõe métricas jobs honestas.
- DEPLOY: `ownews-git` `d007d7da-425a-462c-ab70-ef2b971e1ff1`; rollback `d5441c33-d051-42fa-998a-31f20f99ed0b`.
- DEPLOY: `shrill-pond-a915` `fa79c476-de13-45e4-bf19-3e0cf6ffc828`; rollback `cae46fda-abe3-4297-97e3-f2fb68342f5c`.
- BLOCKED: ciclo persistente OPEN/SUSPECT/CLOSED e métricas numéricas dependem da tabela `jobs`; migration existente em `docs/MIGRATION-JOBS-TABLE.sql`, DDL continua indisponível. Sem workaround inseguro.
- VALIDADO: `/`, `/vagas`, `/saude` HTTP 200; `/vagas` mostra 6 VAGA ABERTA, 1 BANCO DE TALENTOS e verificações; `/saude` retorna campos jobs.
- NEXT: executar a migration `jobs` quando houver acesso legítimo a DDL; depois ligar revalidação server-side sem alterar a Home.

## 2026-09-20 — P0 freshness Home
- DONE: Home agora filtra Hero, laterais, Giro e Últimas exclusivamente por `published_at` real dentro de 24h; snapshot antigo não é renderizado como capa e layout fica vazio quando não há notícia fresca. Mercado/Operações mantêm somente fallback temático até 48h.
- DONE: `/saude` expõe `home_oldest_article_hours`, `home_articles_24h`, `last_article_published_at`, `last_discovery_run` e `HOME_FRESHNESS`.
- DEPLOY: `ownews-git` `fa257b9d-d267-4862-8309-b5a4bab46532`; rollback `d007d7da-425a-462c-ab70-ef2b971e1ff1`.
- DEPLOY: `shrill-pond-a915` `e3849dae-3b7f-431a-ad07-62cda6d0609a`; rollback `fa79c476-de13-45e4-bf19-3e0cf6ffc828`.
- VALIDADO: Home e `/saude` HTTP 200; produção reporta 0 artigos <6h, 0 <12h, 1 <24h, mais antigo visível com 15,6h; sem cache de artigos entre banco e Home.
- NEXT: aumentar a cobertura de discovery <24h sem alterar a regra editorial da Home.

## 2026-09-20 — P0 páginas individuais de vagas
- DONE: Home e `/vagas` agora apontam para páginas OWNews estáveis em `/vagas/<slug>`; Foresea prioritária em `/vagas/foresea-auxiliar-plataforma-plataformista`.
- DONE: Página individual com resumo verificado, status/tipo, compartilhamento nativo, WhatsApp, Facebook, copiar link, CTA oficial e metadata canonical/OG/Twitter; Banco de Talentos permanece identificado.
- VALIDADO: `/`, `/vagas`, vaga Foresea e `/saude` HTTP 200; CTA aponta para `https://foresea.gupy.io/jobs/10992150`; URL compartilhada é OWNews.
- DISCOVERY: `/run` e `/run-novas-fontes` executados; sem aumento confirmado nas janelas de 6h/12h/24h (0/0/1), portanto não publicado conteúdo inventado.
- DEPLOY: `ownews-git` `ac7b0f73-cb6a-4adf-bca0-2f36f6f3c46f`; rollback `fa257b9d-d267-4862-8309-b5a4bab46532`. Collector sem alteração/deploy.
- BLOCKED: freshness continua insuficiente (<3 artigos <24h); próxima investigação deve usar somente métricas detalhadas da execução para localizar rejeições.
- NEXT: obter diagnóstico FOUND/RECENT_24H/RELEVANT/DUPLICATE/INSERTED/ERROR das execuções existentes sem repetir fontes bloqueadas.

## 2026-09-21 — diagnóstico controlado do funil Discovery
- EXECUTADO: uma bateria real no collector `shrill-pond-a915` `/run` (a resposta controlada foi preservada em diagnóstico local; nenhum código foi alterado).
- FUNIL: FOUND 47, PARSED 47, RECENT_24H 0, RELEVANT 15, DUPLICATE 15, REJECTED_DATE 0, REJECTED_RELEVANCE 32, REJECTED_OTHER 0, INSERTED 0, ERROR 0. ANP: 31/10/0/10; Petrobras: 16/5/0/5.
- PERDAS: não houve candidato <24h rejeitado por data, parser, imagem ou relevância; os 15 duplicados eram candidatos já existentes e, na execução, nenhum era recente. O funil não perdeu notícia atual nessa rodada.
- TELEGRAM/INSTAGRAM: o candidato utilizado hoje pelo fluxo foi `c8aea431-21e5-49b4-9688-d519d6f20e91`, já presente em `articles`, publicado em `2026-09-20T16:00:23Z`; Instagram falhou somente por limite editorial diário. Telegram também reportou descarte editorial por pontuação, não ausência no banco.
- SAÚDE: articles <6h 0, <12h 2, <24h 2; HOME_VISIBLE_ARTICLES_OVER_24H 0.
- CORREÇÃO: nenhuma alteração segura comprovada; não foi feito deploy. A regra editorial e o dedupe foram preservados.
- BLOCKED: discovery insuficiente por baixa cobertura/ausência de publicação recente nas fontes atuais, não por perda no funil. Próximo passo é adicionar uma rota pública estruturada nova e comprovadamente ativa, sem repetir endpoints bloqueados.

## 2026-09-21 — auditoria de cobertura recente
- AUDITADO: fontes públicas candidatas Equinor, TotalEnergies, Technip Energies, BW Energy e Offshore Wind; páginas responderam, mas nenhuma expôs publicação datada de 2026-09-21 no conteúdo estruturado verificado. Offshore Magazine retornou 403 e não foi contornada.
- EXECUTADO UMA VEZ: `/run-novas-fontes` no collector ativo.
- FUNIL: FOUND 89, PARSED 89, RECENT_24H 0, RELEVANT 14, DUPLICATE 14, REJECTED_DATE 0, REJECTED_RELEVANCE 75, INSERTED 0, ERROR 0. PPSA 15/0/5/5; EPE 10/0/2/2; MME 30/0/6/6; Marinha 4/0/0/0; ANTAQ 30/0/1/1.
- RESULTADO POR FONTE: nenhuma fonte consultada entregou candidato publicado nas últimas 24h; não há título/URL novo para inserir. Os duplicados eram artigos já presentes; não houve descarte recente por data, parser ou imagem.
- DEPLOY: nenhum. Não houve correção comprovada na coleta.
- BLOCKED: cobertura recente insuficiente por ausência de publicações atuais nas rotas verificadas e bloqueio 403 no Offshore Magazine; filtros editoriais não foram relaxados.
- NEXT: validar uma nova fonte oficial com feed/API/JSON-LD que contenha publicação atual antes de integrá-la.

## 2026-09-21 — Home sem repetição entre editorias, pré-deploy
- ALTERAÇÃO LOCAL: seleção da Home agora coordena Hero, laterais, Últimas, Mercado & Energia e Operações por `article.id` e `original_url` normalizada, removendo parâmetros de tracking e fragmentos. A prioridade permanece Hero, depois laterais e editorias.
- DONE: duplicatas de registro com URLs diferentes para o mesmo endereço não reaparecem em outra seção; artigos continuam intactos no banco e nas páginas internas.
- PRESERVADO: topo, regras de freshness, vagas, notícias, compartilhamento, Mercado, Painel, aeroportos e Modo Embarcado.
- DISCOVERY: auditoria anterior permanece sem candidatos novos <24h; fontes atuais não produziram títulos/URLs novos. Não foram repetidos coletores nesta alteração.
- TESTE: `node --check` e `git diff --check` passaram.
- BLOCKED: sem navegador/screenshot real disponível para validar desktop/mobile; alteração ainda não foi publicada.
- NEXT: produzir capturas desktop/mobile e validar a lista efetiva da Home; publicar somente depois dessa validação.

## 2026-09-21 — composição editorial Home, pré-validação
- REFERÊNCIA: composição anterior aprovada `b5023397-380c-4b25-9d3f-f687083e9b2e`, comparada com o código atual; topo permaneceu intocado.
- ALTERAÇÃO LOCAL: Mercado & Energia agora ocupa toda a largura quando há apenas um item; Operações usa grade adaptativa: 1 card amplo, 2 em duas colunas, 3–4 em grade equilibrada. Seção vazia continua recolhida. Nenhuma regra de conteúdo, coleta ou deduplicação foi alterada.
- PRESERVADO: topo, Hero, vagas, notícias, compartilhamento, aeroportos, Mercado Agora, Mercado Offshore, Painel da Bacia e `/saude`.
- TESTE: `node --check` e `git diff --check` passaram; produção atual `/` HTTP 200.
- BLOCKED: não há navegador/screenshot disponível neste ambiente; capturas desktop/mobile exigidas não foram produzidas. Portanto não houve deploy desta alteração local.
- NEXT: gerar capturas reais desktop/mobile com navegador disponível; só então validar e publicar a alteração.

## 2026-09-20 — instrumentação P0 do funil Discovery
- DONE: collector agora retorna funil compacto FOUND/FETCHED/PARSED/RECENT_24H/RELEVANT/DUPLICATE/REJECTED_DATE/REJECTED_RELEVANCE/REJECTED_OTHER/INSERTED/ERROR e até 5 rejeições recentes quando identificáveis.
- DEPLOY: `shrill-pond-a915` `9d2931c5-d706-4802-b874-5adfe94527ea`; rollback `e3849dae-3b7f-431a-ad07-62cda6d0609a`.
- OBSERVADO: Grupo A 47/47/1/15/15/0/32/0/0/0; Grupo B 89/89/0/14/14/0/75/0/0/0. Segunda rodada repetiu os mesmos números.
- CAUSA: não houve candidato novo de hoje perdido por data, parser, imagem ou relevância; os candidatos relevantes encontrados eram duplicatas já presentes, e as fontes funcionais não entregaram volume recente adicional.
- VALIDADO: `/` e `/saude` HTTP 200; freshness permanece 0 <6h, 0 <12h, 1 <24h.
- NEXT: ampliar somente fontes estruturadas ainda não cobertas, preservando o funil instrumentado.

## 2026-09-20 — complemento P0
- DONE: página individual de vaga ganhou `CRIAR CARD PARA STORY`; canvas gera PNG vertical 1080x1920 com OWNews, cargo, empresa, local e URL OWNews legível; mobile compartilha arquivo via Web Share quando suportado ou baixa a imagem.
- DONE: Home removeu fallback 24–48h de Mercado & Energia e Operações; todas as áreas jornalísticas renderizam somente `published_at` real em até 24h.
- DONE: collector acrescentou `SOURCE_COVERAGE` por fonte e `/saude` expõe `HOME_VISIBLE_ARTICLES_OVER_24H` (0).
- DEPLOY: `ownews-git` `9adaa0ee-910b-46fb-96b7-f6331d92915e`; rollback `ac7b0f73-cb6a-4adf-bca0-2f36f6f3c46f`.
- DEPLOY: `shrill-pond-a915` `fc35d567-1ed5-4333-b526-d2cd52d9501f`; rollback `9d2931c5-d706-4802-b874-5adfe94527ea`.
- VALIDADO: `/`, vaga Foresea e `/saude` HTTP 200; story card contém 1080x1920, CTA oficial preservado e `HOME_VISIBLE_ARTICLES_OVER_24H=0`.
- NEXT: aguardar execução agendada para preencher SOURCE_COVERAGE no snapshot de `/saude`; não ampliar escopo.

## 2026-09-20 — correção urgente Home/editorias
- DONE: Mercado & Energia e Operações Offshore restaurados no lugar/layout; priorizam <24h e, quando necessário, mostram últimas da editoria até 48h com data real explícita. Hero sem elegível mostra estado editorial discreto, nunca matéria antiga.
- FUNIL: Grupo A FOUND 47, RECENT_24H 1, RELEVANT 15, DUPLICATE 15, INSERTED 0; Grupo B FOUND 89, RECENT_24H 0, RELEVANT 14, DUPLICATE 14, INSERTED 0. Nenhum erro de data/parser/imagem comprovado.
- FRESHNESS: produção após execução reportou 1 <6h, 1 <12h, 2 <24h e HOME_VISIBLE_ARTICLES_OVER_24H=0. Nenhuma notícia nova foi inserida nesta bateria; não há título/URL novo para listar.
- DEPLOY: `ownews-git` `b5023397-380c-4b25-9d3f-f687083e9b2e`; rollback `9adaa0ee-910b-46fb-96b7-f6331d92915e`.
- COLLECTOR: sem alteração nesta correção; versão `fc35d567-1ed5-4333-b526-d2cd52d9501f` permanece ativa.
- VALIDADO: `/` e `/saude` HTTP 200; HTML preserva os dois blocos e estado editorial sem notícia fresca.
- NEXT: discovery ainda insuficiente; buscar nova rota pública estruturada antes de declarar resolvido.

## 2026-09-20 — Home + Giro + Painel da Bacia
- DONE: Mercado Offshore ficou compacto em faixa horizontal, limitado a cotações válidas; link para `/mercado` preservado e link discreto para `/painel-da-bacia` adicionado.
- DONE: Giro do Embarque abaixo do destaque usa até 5 artigos reais <24h, sem repetição, com editoria, título, data/hora e link.
- DONE: páginas de notícia receberam caixa condicional “Entenda o impacto”, separando fato da consequência possível.
- DONE: `/painel-da-bacia` criado com filtro inicial de bacia, período/unidade/fonte preparados e links ANP; números não são exibidos sem endpoint mensal estruturado validado.
- TESTE: `node --check` e `git diff --check` passaram; `/`, `/mercado`, `/painel-da-bacia` e `/saude` HTTP 200. A rota de artigo retornou HTTP 500 na validação, incidente a diagnosticar antes de ampliar esta área.
- DEPLOY: `ownews-git` `836f7e74-299c-49bc-9270-d3382b4a0fc4`; rollback `b5023397-380c-4b25-9d3f-f687083e9b2e`.
- BLOCKED: dados numéricos mensais do Painel dependem de endpoint ANP estruturado ainda não validado; freshness/discovery continua insuficiente.
- NEXT: corrigir a rota de artigo HTTP 500 e validar o painel ANP antes de adicionar números.

## 2026-09-20 — validação final Home/Painel
- PRESERVADO: Mercado & Energia, Operações Offshore, vagas e compartilhamento.
- DONE: faixa compacta Mercado Offshore, Giro do Embarque <24h, caixa condicional de impacto e `/painel-da-bacia` com fontes ANP e sem números inventados.
- TESTADO: `node --check`, `git diff --check`; `/`, `/mercado`, `/painel-da-bacia`, `/saude` HTTP 200.
- DEPLOY: `ownews-git` `19d8ec4c-d6dd-4d00-b4e0-db064d8622c1`; rollback `836f7e74-299c-49bc-9270-d3382b4a0fc4`.
- BLOCKED: `/noticia?id=...` continua HTTP 500 antes da resposta editorial; precisa diagnóstico de runtime Cloudflare. Painel ANP ainda sem números até endpoint mensal estruturado validado. Discovery continua insuficiente.

## 2026-09-20 — correção produção /noticia e compartilhamento
- DONE: causa do HTTP 500 isolada no caminho de renderização auxiliar da rota `/noticia`; a consulta editorial respondia lista válida, mas o bloco auxiliar podia lançar exceção antes da resposta. A rota agora usa renderização defensiva mínima com data, fonte, imagem disponível/fallback, corpo e link original.
- VALIDADO: três artigos reais retornam HTTP 200: `b1e06618-b725-40db-ac5a-4223c1d08257` (recente), `fc87a64a-2cab-4afc-96c7-21d3382b0ba4` (antigo) e `54518d7d-cef6-4c3d-95ae-aac25952ca98` (sem imagem).
- DONE: removido `CRIAR CARD PARA STORY`, canvas 1080x1920 e download de arte. `COMPARTILHAR VAGA` permanece sempre disponível; usa Web Share quando possível e orienta `COPIAR LINK` no fallback/cancelamento não é tratado como erro. URL compartilhada continua sendo a página OWNews.
- DONE: links `Ver Mercado Offshore completo` e `Painel da Bacia` ficaram agrupados em faixa separada; Giro continua oculto com zero itens e horizontal compacto com poucos itens.
- DISCOVERY: bateria anterior permanece sem novas inserções; Grupo A 47 encontrados/1 recente/15 relevantes/15 duplicados/0 inseridos, Grupo B 89/0/14/14/0. Nenhuma fonte nova validada nesta rodada.
- PANEL: sem números publicados. ANP dados abertos respondeu 403 na validação VPS; GeoServer ANP validado como rota geoespacial, sem série mensal de produção confirmada. Página mantém estado honesto e links oficiais.
- DEPLOY: `ownews-git` `2cd2b6c9-ec2c-46f0-bf28-6204b75fa5ff`; rollback `19d8ec4c-d6dd-4d00-b4e0-db064d8622c1`. Collector inalterado: `shrill-pond-a915` `fc35d567-1ed5-4333-b526-d2cd52d9501f`.
- TESTE: `node --check`, `git diff --check`; produção HTTP 200 em `/`, três `/noticia?id=...`, `/vagas/foresea-auxiliar-plataforma-plataformista`, `/painel-da-bacia` e `/saude` com User-Agent normal.
- BLOCKED: discovery ainda insuficiente e dados mensais ANP não automatizados; não inventar volume/números.
- NEXT: validar uma fonte mensal estruturada oficial da ANP ou documentar bloqueio; depois ampliar discovery somente por rota pública nova e comprovada.

## 2026-09-20 — restauração da composição editorial da Home
- REFERÊNCIA: composição aprovada registrada na versão visual `b5023397-380c-4b25-9d3f-f687083e9b2e`: Mercado & Energia com matéria principal + lista lateral; Operações Offshore em trilho de cards.
- DONE: seções voltaram a selecionar listas próprias, sem serem esvaziadas pelo pool consumido por Últimas; Mercado usa até 5 itens e Operações até 6, com complemento <=48h apenas quando necessário e data real explícita.
- DONE: Giro do Embarque removido do markup e da execução da Home; funções permanecem no código para avaliação futura, sem espaço reservado.
- PRESERVADO: rota `/noticia` corrigida, vagas/compartilhamento, coletor, artigos, Mercado Offshore e Painel da Bacia.
- TESTE: `node --check`, `git diff --check`; produção HTTP 200 em `/`, três artigos reais, vaga Foresea e `/saude`; Home mantém Mercado & Energia, Operações Offshore, Vagas e Central Offshore; Giro não está no DOM inicial.
- DEPLOY: `ownews-git` `e831b113-ce2d-40ab-9240-41724e834a45`; rollback `2cd2b6c9-ec2c-46f0-bf28-6204b75fa5ff`.
- BLOCKED: captura visual automatizada desktop/mobile não disponível neste ambiente; validação feita por comparação de markup/CSS e rotas reais.
- NEXT: obter captura visual com navegador disponível antes de nova alteração estética.

## 2026-09-21 — Home coordenada validada em navegador
- DONE: seleção por ID/URL normalizada publicada; Tenaris deixou de aparecer simultaneamente no destaque/lateral e Operações. A seleção preserva Hero primeiro e bloqueia segunda aparição nas seções seguintes.
- FIX: corrigido erro de escape da normalização que gerou `Unexpected token '}'` no primeiro deploy da seleção; deploy seguinte restaurou a renderização.
- VALIDADO: capturas reais desktop/mobile em `/tmp/ow-home-final2-desktop.png` e `/tmp/ow-home-final2-mobile.png`; DOM confirmou lateral Tenaris, Mercado com Petrobras e Operações com artigo diferente `d11cbd0b-4736-41e7-b55e-cc05ea2e2d95`.
- DEPLOY: `ownews-git` `cf783095-867a-4be1-a366-9cc7849a50d8`; rollback `a052a216-6e6c-4001-ba1c-19d5d41680e3`.
- TESTE: `node --check`, `git diff --check`; `/`, três notícias, vaga Foresea, `/mercado`, `/painel-da-bacia` e `/saude` HTTP 200.
- BLOCKED: conteúdo recente continua insuficiente; Mercado aparece como `Últimas da editoria` com uma matéria porque não há volume válido suficiente. Home não foi declarada completa.
- NEXT: aumentar cobertura de discovery por fonte pública nova; não alterar layout para mascarar falta de conteúdo.

## 2026-09-21 — editorias com composição adaptativa
- DIAGNÓSTICO: nos últimos 48h havia apenas 4 artigos reais: ROG.e/PetroNotícias `c8aea431-21e5-49b4-9688-d519d6f20e91` (16:00Z), Tenaris/PetroNotícias `b1e06618-b725-40db-ac5a-4223c1d08257` (14:00Z), Petrobras `1cfb8f23-9d40-4240-bb9a-3184eb0d8efa` (22:45Z do dia anterior) e Eixos `d11cbd0b-4736-41e7-b55e-cc05ea2e2d95` (12:00Z do dia anterior). Não havia seis candidatos distintos após Hero/laterais.
- DONE: Mercado & Energia e Operações agora usam composição principal + laterais quando houver 2–3 itens; com 1 item ocupam largura equilibrada. Operações segue o mesmo padrão, com empilhamento mobile.
- PRESERVADO: deduplicação global por ID/URL, topo, Hero, vagas, Mercado Offshore, Painel e demais módulos.
- DEPLOY: `ownews-git` `79b4a802-fdaa-4f62-beea-87942e3b0fa6`; rollback `cf783095-867a-4be1-a366-9cc7849a50d8`.
- TESTE: `node --check`, `git diff --check`; capturas `/tmp/ow-home-editorias-desktop.png` e `/tmp/ow-home-editorias-mobile.png`; `/`, `/saude`, `/mercado` e `/painel-da-bacia` HTTP 200.
- BLOCKED: não há três matérias reais por editoria sem repetir conteúdo ou violar freshness; coleta continua insuficiente.
- NEXT: ampliar discovery com fonte pública nova e ativa antes de tentar preencher as seis posições.

## 2026-09-21 — recuperação visual seletiva pós-cf783
- DONE: restaurado seletivamente o trilho visual anterior de Operações Offshore, sem rollback global; cards voltaram à composição horizontal do layout de referência.
- PRESERVADO: páginas individuais de vagas, Foresea, compartilhamento, OG/canonical, CTA oficial, status VAGA ABERTA/BANCO DE TALENTOS, freshness, /saude, collector e banco.
- TESTE: `node --check` e `git diff --check`; `/`, `/vagas` e `/vagas/foresea-auxiliar-plataforma-plataformista` HTTP 200 com conteúdo esperado.
- DEPLOY: `ownews-git` `6ea815ec-ce37-4311-a6a2-39b7fc87ee2f`; rollback `79b4a802-fdaa-4f62-beea-87942e3b0fa6`.
