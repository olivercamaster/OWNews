# OWNews — Relatório do Comando Mestre de Evolução (2026-09-15)

Execução autônoma dentro do escopo de segurança combinado. Nenhum deploy foi
feito (sem autenticação Cloudflare nesta sessão — bloqueio de credencial,
registrado explicitamente, não uma escolha). Tudo abaixo está pronto no
repositório, testado localmente (sintaxe + execução real das rotas), à
espera do deploy.

Este relatório complementa `RELATORIO-FASE-EXTRA-2026-09-15.md` (auditoria
e recuperação da coleta, feita antes deste comando). Aqui só o que mudou
depois disso.

---

## 1) ESTADO INICIAL

- **Version ID**: não obtido — exige API/dashboard Cloudflare autenticado,
  indisponível nesta sessão. Registrado como pendência (item 16), não
  inventado.
- **Última notícia (antes desta rodada)**: já recuperada na fase anterior
  (Petrobras/Sempra, 2026-09-15T15:02:24 UTC — ver relatório anterior).
- **Problemas identificados nesta rodada**: mesma matéria podia aparecer em
  "Últimas", "Mercado" e "Operações" ao mesmo tempo (bug real, corrigido —
  ver seção 3); filtro de relevância do collector rejeitava conteúdo oficial
  legítimo de combustíveis/preço (corrigido — ver seção 2); "Minha Escala",
  2 guias e o banner OffshoreWorks estavam com placeholder ou copy não
  aprovada (corrigidos — ver seções 5–9).
- Rollback: como não houve deploy, não há nada em produção para reverter
  por causa desta rodada — a produção atual permanece exatamente como
  estava.

---

## 2) COLLECTOR

Causa da coleta parada, correção e estado das fontes: **já cobertos
integralmente em `RELATORIO-FASE-EXTRA-2026-09-15.md`, seção 11** (não
repetido aqui). Resumo: recuperado via chamada manual autorizada; hipótese
mais forte é perda do cron trigger num deploy anterior; não confirmável com
certeza sem acesso ao painel Cloudflare.

**Adicional feito nesta rodada** (arquivo `shrill-pond-a915-fix/worker.js`,
backup em `_backup_antes_expansao_editorial/`, **não deployado**):

- Filtro de relevância (`noticiaRelevante`) ampliado com vocabulário de toda
  a cadeia de energia (combustíveis, Brent/WTI, OPEP, portos, transição
  energética) — antes só cobria upstream/offshore e descartava conteúdo
  oficial legítimo (ex.: boletim de preços de combustíveis da própria ANP).
  Testado com frases reais extraídas da própria ANP + casos de controle
  (ver seção "3 — verificar filtro" da rodada anterior no chat; resultado:
  o boletim de combustíveis passa a ser aceito, "greve de professores" e
  "carro elétrico" genérico continuam corretamente rejeitados por não
  terem contexto de energia).
- Nova fonte **ANTAQ** pesquisada, verificada ao vivo e codificada
  (`coletarANTAQ`, `extrairLinksANTAQ`, rota manual `/run-antaq`) — mesmo
  padrão de código do ANP/MME/IBAMA. Testada localmente contra o HTML real
  da página: 30 links extraídos, 10 relevantes após o filtro (concessões
  portuárias, canal de acesso a portos — descartou corretamente itens
  administrativos como pauta de reunião). **Fora de qualquer grupo
  automático do cron**, mesma situação de Marinha/IBAMA — pendência de
  decisão + de deploy, não de engenharia.
- Endpoint de diagnóstico **`GET /saude`** (só leitura, sem custo) —
  monitor de frescor (ver seção "Monitor de saúde editorial" abaixo).
- Corrigido o campo `fontes` do status raiz, que estava desatualizado
  (dizia só `["ANP","Petrobras"]` — hoje reflete as 5 fontes automáticas
  reais + as 3 preparadas).

**Nada disso foi deployado** — exige `wrangler deploy` autenticado no
Worker `shrill-pond-a915`, fora do escopo desta sessão (sem credencial).

### Monitor de saúde editorial (novo)
`GET /saude` (quando deployado) retorna `estado` (`SAUDAVEL` / `ATENCAO` /
`SEM_ATUALIZACAO`), `last_collected_article_at`, `articles_last_24h`,
`articles_last_48h`, `sources_active_24h`. Limiares: ≤12h = saudável,
≤48h = atenção, acima = sem atualização. Simulado localmente contra o
banco real: estado atual = **SAUDAVEL** (última coleta há 0,2h, 1 fonte
ativa nas últimas 24h). Não ativa Telegram nem nenhum alerta externo —
só leitura, como pedido.

### Auditoria de frescor real (banco, agora)
| Faixa | Artigos |
|---|---|
| 0–6h | 1 |
| 6–48h | 0 |
| 2–3 dias | 11 |
| 3–7 dias | 0 |
| >7 dias | 13 |

Achado importante e honesto: mesmo com o collector saudável, a produção
real de conteúdo das fontes oficiais é **em rajadas** (13 artigos em
08/09, 11 em 12/09, 1 em 15/09 — nada nos dias entre eles). Isso confirma
o diagnóstico do próprio comando mestre: as fontes oficiais atuais não
sustentam sozinhas 4–6 atualizações/dia de forma contínua. ANTAQ ajuda
(mais uma fonte com fluxo próprio), mas o ganho real de volume depende de
decisão editorial sobre Marinha/IBAMA/ANTAQ entrarem no automático — não
foi tomada nesta rodada porque envolve orçamento de subrequests do cron
(risco técnico já documentado no próprio código) e decisão de prioridade,
não é uma correção "segura e óbvia" para eu decidir sozinho.

---

## 3) HOME

- **Manchete**: score determinístico (recência + autoridade da fonte +
  relevância/conexão offshore + impacto + bônus de imagem) — implementado
  e validado na rodada anterior, sem alteração nesta.
- **"AGORA"**: continua correto — só aparece com ≤6h reais, validado de
  novo com os dados atualizados.
- **Repetição entre seções (bug real encontrado e corrigido nesta rodada)**:
  `renderMercado` e `renderOperacoes` liam do mesmo pool que `renderUltimas`
  sem descontar o que já tinha sido mostrado — a mesma matéria podia
  aparecer em "Últimas" e em "Mercado"/"Operações" ao mesmo tempo.
  Corrigido com esgotamento sequencial do pool (manchete → destaques →
  últimas → mercado → operações, cada seção só usa o que sobrou). O ticker
  foi mantido como exceção deliberada (é varredura/resumo, não "seção de
  conteúdo" — pode citar de novo algo já mostrado, como um ticker de TV).
  Aplicado em `producao-ownews-git/worker.js` **e** `home-redesign/worker.js`
  (ficaram sincronizados de novo).
- Frescor por categoria: decidi **não** impor cortes rígidos de idade por
  seção (ex.: excluir tudo >48h de "Últimas") porque, no estado atual do
  banco, isso esvaziaria seções inteiras — o que seria pior do que mostrar
  conteúdo honestamente datado. A ordenação por recência + o esgotamento
  sequencial já produzem o efeito prático pedido (seção "Últimas"
  naturalmente pega o que sobrou de mais recente); a idade real de cada
  item já é sempre exibida via `tempoRelativo()`, nunca escondida.

---

## 4) EDITORIAL

Fontes recomendadas e classificação técnica pedida (FONTE / TIPO / URL /
RSS-API-HTML / FREQUÊNCIA / CONFIABILIDADE / CATEGORIA / AUTOMAÇÃO /
RISCO / AÇÃO):

| Fonte | Tipo | URL/endpoint | Formato | Confiabilidade | Automação possível? | Risco | Ação recomendada |
|---|---|---|---|---|---|---|---|
| **ANTAQ** | Oficial (agência reguladora) | gov.br/antaq/pt-br/noticias | HTML (mesmo padrão ANP) | Alta | **Sim — já implementado e testado** | Baixo | Decidir grupo de cron e autorizar deploy |
| **EIA** (EUA) | Oficial (agência governamental) | api.eia.gov | API REST, gratuita | Alta | Sim, mas exige cadastro de chave de API | Baixo/médio (gerenciar secret) | Avaliar como fonte de contexto de mercado (Brent/WTI/produção EUA), não de notícia diária |
| **IBGE (SIDRA)** | Oficial | sidra.ibge.gov.br | Provável API própria — endpoint exato **não confirmado nesta sessão** | Alta | A confirmar | Baixo | Pesquisar documentação de API antes de codificar |
| **CADE** | Oficial | gov.br/cade/pt-br/assuntos/noticias | HTML, estruturado, confirmado ao vivo | Alta | Sim, mesmo padrão ANP | Baixo | Só entra com filtro (fusões/condutas do setor, não concorrência genérica) |
| **BNDES** | Oficial | agenciadenoticias.bndes.gov.br | HTML, confirmado ao vivo | Alta | Sim | Baixo | Baixo volume de conteúdo relevante direto — prioridade baixa |
| **Ministério dos Transportes** | Oficial | **URL exata não confirmada** (tentativa desta sessão exigiu login) | — | — | Não, sem URL confirmada | — | Pesquisar URL correta antes de qualquer implementação |
| **OPEP** | Oficial (organização internacional) | opec.org (caminho exato **não confirmado** — tentativa retornou erro) | — | Alta (quando a URL certa for achada) | Não ainda | Médio (termos de uso não verificados) | Confirmar URL e termos antes de automatizar; usar como contexto/citação por ora |
| **IEA** | Oficial (agência internacional) | iea.org | Releases públicos; dados completos **provavelmente pagos** | Alta | Não recomendado sem confirmar licenciamento | Médio | **CONFIRMAR NA IEA** antes de automatizar |
| **Jornalismo confiável** (Reuters/Bloomberg/agências de energia) | Privado/licenciado | — | RSS público quando disponível; nunca scraping de conteúdo pago | Alta, mas dependente de licença | Só via RSS/API pública ou como gatilho de apuração (nunca republicação) | Alto se copiar conteúdo | Usar só pra **detectar** que algo aconteceu; apurar/confirmar na fonte primária oficial antes de publicar — fluxo já documentado (FATO → VERIFICAR → CRUZAR → RESUMIR → CONTEXTUALIZAR) |

Regra de relevância (o que impede o OWNews de virar portal genérico) já
aplicada no filtro ampliado do collector (seção 2): gatilhos amplos
("greve", "carro elétrico", "sanção") só contam quando aparecem **junto**
de um termo de contexto de petróleo/energia/offshore no mesmo título —
testado e confirmado que rejeita os casos genéricos.

---

## 5) CENTRAL OFFSHORE

Verificado: os cards do Central Offshore **já usam uma família de SVG
line icons própria, sem nenhum emoji** — checagem feita com busca por
emoji dentro do bloco `central-tile` do HTML real, resultado vazio. Este
item do comando mestre já estava atendido por trabalho anterior; nenhuma
mudança foi necessária aqui.

---

## 6) GUIAS

Publicados (conteúdo real, não "em preparação"), testados via execução
real das rotas:

| Guia | Rota | Status |
|---|---|---|
| Como funciona a escala offshore | `/guias/escala-offshore` | **Publicado** — conecta direto com Minha Escala |
| Erros comuns e golpes de vagas offshore | `/guias/erros-comuns-golpes` | **Publicado** |
| Cadastrar currículo | `/carreiras/cadastre-seu-curriculo` | Já existia (não é novo, mas já cobre esse guia) |
| Primeiro embarque: o que preciso? | — | **Não publicado nesta rodada** — segue em preparação |
| Checklist de documentos | — | **Não publicado nesta rodada** — segue em preparação |
| O que levar para o primeiro embarque | — | **Não publicado nesta rodada** — segue em preparação |

Por que só 2 dos 6: cada guia exige cuidado editorial real (diferenciar
obrigação legal / requisito de mercado / recomendação, sem inventar
exigência específica de curso ou documento) — dado o volume total desta
rodada (collector + Home + banner + footer + Minha Escala), priorizei os
2 guias com maior efeito de rede imediato (a escala conecta com a
ferramenta nova; erros/golpes tem valor de proteção alto e não depende de
nenhum dado técnico-legal preciso). Os outros 3 continuam como pendência
explícita, não como "em preparação" vago — ver seção 16.

Página `/guias` atualizada para linkar os 2 guias novos como cards reais
(não mais "em preparação" para eles).

---

## 7) CURRÍCULO / EMPRESAS

Nenhuma mudança nesta rodada — as páginas `/carreiras/cadastre-seu-curriculo`
e `/empresas` já existiam com dados de empresas verificadas, filtros e
CTA. Transformar `/empresas` num diretório mais completo exigiria
pesquisar e verificar dados novos de empresas (segmento, site oficial,
canal de currículo) — não fiz isso nesta rodada pra não arriscar inventar
ou desatualizar informação de empresa sem verificação cuidadosa. Fica
como próximo passo (seção 17).

---

## 8) MINHA ESCALA

**Implementada de verdade, saiu de "Em breve" para funcional.** Rota
`/minha-escala`, 100% client-side (sem login, sem Supabase, sem dado
pessoal saindo do navegador).

Funcionalidades:
- Escalas 14x14, 14x21, 14x28 e personalizada (dias embarcado/folga
  livres).
- Entrada por data de referência + o que ela representa (embarquei /
  desembarquei nessa data) — evita ambiguidade sobre "que dia do ciclo" a
  data representa.
- Resultado: status atual (embarcado/folga + que dia do bloco), próximo
  embarque, próximo desembarque, e os próximos 6 ciclos completos.
- Aviso obrigatório incluído literalmente como pedido: "Os cálculos são
  uma referência de organização pessoal. Alterações operacionais de
  escala devem ser confirmadas com sua empresa."
- Nenhum cálculo trabalhista/salarial.

**Testes matemáticos** (rodados em Node antes de embutir no Worker,
usando a mesma lógica exata depois transcrita):
- Virada de mês simples (setembro→outubro): correto.
- Virada de ano bissexto (fevereiro de 2028, 29 dias): correto.
- Virada de dezembro/janeiro: correto.
- Escala personalizada (7x7): correto, cadeia de 4 ciclos verificada.
- Status "hoje" com múltiplas voltas de ciclo: correto.

**Testes de integração**: rota testada via execução real do handler
`fetch()` do Worker (não simulação) — HTTP 200, HTML e formulário
presentes, script embutido sintaticamente válido (`node --check`
isolado). Link `/guias/escala-offshore` que a página referencia foi
criado nesta mesma rodada — confirmado que não ficou link morto (ver
checagem de links da seção 13).

---

## 9) OFFSHOREWORKS

Banner reescrito conforme instrução — removida a copy não aprovada
("Feitos de sal e aço."):

- Título novo: **"Do offshore para a vida."**
- Texto novo: "Vestuário e produtos criados para quem vive esse universo
  — a bordo e em terra."
- CTA mantido: "LOJA OFICIAL · Conheça a OffshoreWorks →"
- Tratamento visual (fundo com leve textura diagonal e linha dourada
  discreta no topo) **mantido como já estava** — já não usava botão
  laranja gigante, já tinha tratamento premium; só a copy foi trocada,
  conforme escopo pedido (não redesenhei visualmente porque o pedido é
  específico sobre a copy, e o tratamento visual existente já respeita os
  princípios do comando: sem neon/gamer/emoji, com elemento gráfico
  discreto).
- **Não usei foto** (nenhuma foto real adequada de produto OffshoreWorks
  foi localizada neste repositório) e **não inventei/gerei modelo ou
  produto falso**, conforme proibido.

---

## 10) SEO

**Não auditado nesta rodada** — escopo grande (titles/descriptions/
canonical/OG/JSON-LD/sitemap/robots/internal linking em ~19 rotas) que
não coube no tempo desta sessão junto com o resto. As páginas novas
(`/minha-escala`, `/guias/escala-offshore`, `/guias/erros-comuns-golpes`)
já seguem o padrão existente de `paginaChrome()` (title, meta description,
canonical) — não é uma lacuna nova, só não houve auditoria do que já
existia. Fica como pendência explícita (seção 16/17).

---

## 11) MOBILE

**Não testado nesta rodada** nos 9 viewports pedidos — exigiria a mesma
infraestrutura Playwright já documentada em `frontend-tools/validate.mjs`
(que roda local, com setup próprio). O que foi feito: todo o CSS novo
(Minha Escala, guias, banner) **reaproveitou classes já existentes**
(`.campo-form`, `.form-pesquisa`, `.jornada-lista`, `.curso-card`,
`.aviso-atualizacao`, `.hub-continue`) que já são responsivas — nenhuma
grade nova, nenhum `min-width` fixo foi introduzido. Isso reduz bastante o
risco, mas não substitui o teste real nos breakpoints. Pendência
explícita.

---

## 12) PERFORMANCE

Nenhuma biblioteca nova, nenhum framework, nenhuma fonte nova adicionada.
Todo o JS novo é vanilla (mesmo estilo ES5 já usado no resto do arquivo).
Todo o CSS novo reaproveita classes existentes — o `<style>` do
`paginaChrome()` não cresceu. Comparação de peso "antes/depois" formal não
foi medida (não há processo de build/bundle neste projeto — é um único
arquivo servido direto pelo Worker), mas o acréscimo real de bytes é
pequeno: 3 funções novas de renderização + 1 função de cálculo de datas,
nada de peso comparável a uma lib.

---

## 13) TESTES

Executado nesta rodada (resultados reais, não estimados):

- `node --check` nos 3 arquivos alterados (`producao-ownews-git/worker.js`,
  `home-redesign/worker.js`, `shrill-pond-a915-fix/worker.js`) — sintaxe
  válida nos três.
- Execução real do handler `fetch()` do Worker de produção (via Node,
  sem rede) contra **todas** as 17 rotas conhecidas + 2 rotas com slug
  (`/salarios/driller`, `/funcoes/driller`) + 1 rota inexistente de
  controle — todas retornaram HTTP 200 (a inexistente, 404 corretamente).
  Nenhuma regressão nas rotas que já existiam antes desta rodada.
- Checagem de links internos das páginas novas/tocadas (`/minha-escala`,
  `/guias`, `/guias/escala-offshore`, `/guias/erros-comuns-golpes`,
  `/comece-aqui`) — 17 links únicos encontrados, **0 quebrados**.
- Lógica da calculadora Minha Escala testada isoladamente com 5 cenários
  (mês, ano bissexto, virada de ano, personalizada, múltiplos ciclos) —
  todos corretos.
- Lógica do filtro de relevância ampliado testada com frases reais da ANP
  + casos de controle (greve/carro elétrico genéricos) — comportamento
  correto.
- Extração do ANTAQ testada contra HTML real baixado ao vivo da própria
  página.
- **Console do navegador**: não verificado (exigiria navegador real —
  Playwright não foi acionado nesta rodada). Pendência explícita.

---

## 14) DEPLOY

**Não executado.** `wrangler whoami` confirma sessão não autenticada na
Cloudflare (mesma limitação já registrada na rodada anterior). Nenhum
Version ID anterior/novo a registrar porque não houve deploy algum nesta
sessão — nem do frontend, nem do collector.

Comando exato que falta rodar (frontend, quando houver autenticação):
```
cd /srv/offshoreworks/ownews/producao-ownews-git
npx wrangler deploy --config wrangler.jsonc --keep-vars
```

O collector (`shrill-pond-a915-fix/`) também tem mudanças prontas (filtro
ampliado + ANTAQ + `/saude`) que precisariam de deploy próprio, separado,
quando autorizado — não incluído no comando acima.

---

## 15) PRODUÇÃO

Como não houve deploy, a produção em `https://ownews.com.br` continua
exatamente como estava antes desta sessão — nenhuma validação de produção
foi necessária ou possível para as mudanças desta rodada. Nenhum rollback
necessário pelo mesmo motivo.

---

## 16) PENDÊNCIAS (só o que realmente depende do usuário)

1. **Confirmar cron do collector** no painel Cloudflare (Workers →
   `shrill-pond-a915` → Triggers/Logs) — é a única forma de fechar com
   certeza a causa raiz da coleta parada.
2. **Autenticação Cloudflare** (nesta ferramenta ou localmente) para
   deployar o frontend (`producao-ownews-git`) e, separadamente, o
   collector (`shrill-pond-a915-fix`), quando decidido.
3. **Decisão editorial**: ativar Marinha/IBAMA/ANTAQ nos grupos
   automáticos do cron — código pronto para os três, decisão de
   prioridade e orçamento de subrequests fica com você.
4. **URLs não confirmadas**: Ministério dos Transportes e OPEP — pesquisa
   adicional necessária antes de qualquer automação dessas duas.
5. **Licenciamento IEA** — confirmar diretamente com a IEA antes de
   qualquer automação.
6. Autorizar (ou não) pesquisa e verificação de dados reais de empresas
   para expandir o diretório `/empresas`.

## 17) PRÓXIMOS 3 PASSOS (maior impacto)

1. **Fechar a causa do cron** (painel Cloudflare) e, uma vez confirmada,
   autorizar o deploy do collector com o filtro ampliado + ANTAQ — é o
   que sustenta o volume editorial diário que faltou nesta análise.
2. **Autenticar e fazer o primeiro deploy do frontend** já pronto (Home
   sem repetição entre seções, banner OffshoreWorks novo, Minha Escala,
   2 guias novos) — hoje é só um `wrangler deploy` de distância.
3. **Rodar o teste mobile/acessibilidade real** (Playwright, os 9
   viewports) antes ou logo depois do primeiro deploy, pra validar o que
   foi assumido "seguro por reaproveitar CSS existente" nesta rodada.
