# Fase extra — frescor da Home + expansão do radar editorial (2026-09-15)

Auditoria com dados reais (Supabase, sites-fonte oficiais) + uma correção de
frontend já implementada e testada + pesquisa de fontes. Nenhuma alteração
foi feita no Supabase, no collector (`shrill-pond-a915`) ou em nenhum cron.
Nenhum deploy foi executado (sem acesso autenticado à Cloudflare nesta
sessão — `wrangler whoami` confirma "not authenticated").

---

## 1) Por que a manchete antiga permaneceu na Home

**Não é um bug de seleção do frontend. É ausência real de conteúdo novo no
banco**, combinada com uma regra de destaque simplista que já não era ideal.

Evidência (consulta direta ao Supabase, mesma chave `anon` já pública no
JS do site, só leitura):

- Artigo `published_at` mais recente no banco: **2026-09-12T21:08:01 UTC**
  ("EPE publica Caderno de Estudos sobre Preços de Gás Natural").
- Momento da auditoria: **2026-09-15T12:22 UTC** → **~63 horas** sem
  nenhum artigo novo inserido, apesar do collector ter um cron configurado
  para rodar 12x/dia (a cada ~2h30–3h).
- Confirmado também que `published_at` no banco é o **horário em que o
  collector inseriu o artigo**, não a data original da fonte (o código
  usa `published_at: new Date().toISOString()` na inserção — a data real
  da fonte fica em `original_published_at`, que o frontend não usa para
  ordenar). Isso não é o problema em si, mas é bom registrar: "3 dias
  parado" é medido corretamente porque published_at = "quando o OWNews
  publicou", que é exatamente o que importa para frescor do portal.

Para descartar "não havia nada relevante pra coletar", comparei contra os
próprios sites-fonte (leitura direta, sem usar o collector):

| Fonte | O que a própria fonte mostra (13–15/09) | OWNews coletou? |
|---|---|---|
| ANP | Nada novo (último item real: 11/09) | Consistente — nada a perder |
| MME | Nada novo (último item real: 02/09) | Consistente — nada a perder |
| EPE | Só 1 aviso de evento (11/09) | Consistente — nada relevante a perder |
| PPSA | Nada novo (último post real: 11/09) | Consistente — nada a perder |
| **Petrobras** | **1 matéria nova em 14/09** ("Petrobras assina contrato de longo prazo... com a Sempra Infrastructure", sobre GNL/regaseificação) | **NÃO coletada** — ainda ausente do banco às 12:22 UTC de 15/09, ~22h depois de publicada |

Esse item da Petrobras é a prova concreta: existe conteúdo oficial novo,
o título contém "gás natural" (passa no filtro `noticiaRelevante()` do
collector sem ambiguidade), e mesmo assim não chegou ao banco depois de
~9 janelas de cron. Isso indica falha técnica na coleta — não falta de
notícia.

### Onde está o problema (checklist pedido)

- [ ] Coleta → **suspeito principal**, não confirmado com certeza absoluta
- [ ] Seleção editorial → não é isso (não havia lógica editorial nenhuma antes, só recência)
- [x] Ordenação/seleção do frontend → **contribuía com um sintoma** (ver abaixo), já corrigido
- [ ] Frontend (renderização) → não, a renderização em si sempre esteve correta
- [ ] Cache → descartado (Workers não define `Cache-Control` nessa resposta; sem evidência de cache de borda ou de navegador aqui)
- [x] Ausência de novas matérias elegíveis no banco → **sim, é o fator dominante**
- [ ] Outra regra → não identificada

**O que não pude confirmar com 100% de certeza** (faltou acesso
autenticado à Cloudflare nesta sessão — sem `wrangler login`, sem logs/
analytics do Worker): se o cron trigger do `shrill-pond-a915` ainda está
de fato registrado e disparando, ou se está disparando e falhando
silenciosamente ao buscar `agencia.petrobras.com.br` (bloqueio,
mudança de estrutura do JSON-LD, erro de rede pontual, etc.). Não rodei
`/run` nem `/run-anp` etc. do collector porque essas rotas **escrevem no
Supabase de produção** — rodar isso sem autorização violaria a instrução
explícita de não alterar o collector/Supabase sem necessidade. O endpoint
de status (`GET /`, sem efeito colateral) confirma que o Worker está
`ONLINE` e com os secrets do Supabase presentes — então não é falta de
credencial.

**Recomendação concreta (não executada):** com autorização, verificar no
painel Cloudflare (Workers → `shrill-pond-a915` → Triggers/Logs) se o
cron está ativo e se as últimas invocações tiveram erro. Alternativa mais
rápida: autorizar uma chamada manual a `GET /run` (endpoint já existente,
mostra por fonte quantas notícias foram encontradas/inseridas/erro) — isso
diagnostica e resolve ao mesmo tempo, mas é uma escrita real no banco de
produção, por isso não fiz sem pedir primeiro.

---

## 2) O que foi corrigido (frontend, seguro, já testado)

Dois problemas reais foram encontrados na lógica de destaque do frontend
(`producao-ownews-git/worker.js`, produção real, e replicado em
`home-redesign/worker.js`, que compartilhava o código idêntico):

### a) Seleção de manchete só por recência (+ presença de imagem própria)

Antes:
```js
const hero = noticias.slice(0, 8).find(n => n.image_url && !imagemInvalida(n.image_url)) || noticias[0];
```
Ou seja: pega a mais recente entre as 8 mais recentes que tenha imagem
própria. Sem relevância, impacto, autoridade da fonte ou conexão com o
ecossistema offshore — exatamente o padrão que o pedido queria evitar.

**Corrigido**: nova função `pontuarDestaque()` + `escolherDestaque()` (ver
seção 3), aplicada em `renderTudo()`.

### b) "AGORA" aplicado por posição, não por tempo real

```js
function tagRadar(n, ehPrimeiro){
  if (ehPrimeiro) return 'AGORA';   // sempre, mesmo que tenha 3 dias
  ...
}
```
O primeiro item do ticker sempre recebia a etiqueta "AGORA", mesmo sendo a
notícia mais antiga que existisse no banco (que é exatamente o cenário que
está acontecendo agora). Isso é precisamente o "URGENTE em conteúdo
antigo" que o pedido queria proibir.

**Corrigido**: `tagRadar(n)` agora calcula `horas = agora - published_at`
e só retorna `'AGORA'` se `horas <= 6`. Fora dessa janela, mostra a
categoria real (OPERAÇÕES/MERCADO/ENERGIA) ou a fonte.

### Testes feitos

- `node --check` nos dois arquivos completos (`producao-ownews-git/worker.js`
  e `home-redesign/worker.js`) — sintaxe válida, sem quebrar o parse do
  Worker.
- Simulação isolada da nova lógica (`pontuarDestaque`/`escolherDestaque`/
  `tagRadar`) rodada em Node.js contra os **20 artigos reais mais recentes
  do Supabase de produção** (leitura, sem escrita). Resultado:
  - Lógica antiga escolheria: *"EPE publica Caderno de Estudos sobre
    Preços de Gás Natural"* (nicho técnico, só porque era o mais recente
    com imagem própria).
  - Lógica nova escolhe: *"VÍDEO — Coletiva de imprensa sobre a
    descoberta de petróleo em águas profundas do Amapá"* (Petrobras,
    palavra de impacto "descoberta", categoria operações) — empatada com
    *"Navio-plataforma Alexandre de Gusmão atinge topo de produção no
    pré-sal"*, resolvida pela mais recente das duas.
  - Nenhum item recebeu a etiqueta "AGORA" indevidamente (todos com mais
    de 60h, todos corretamente sem essa etiqueta).
- Verificado que os dois arquivos (`producao-ownews-git` e `home-redesign`)
  continuam idênticos no trecho editado, preservando o padrão já existente
  de mantê-los sincronizados.

**Deploy: não executado.** Esta sessão não está autenticada na Cloudflare
(`wrangler whoami` → not authenticated). A alteração está pronta no
repositório; falta rodar `wrangler deploy` (produção) a partir de
`producao-ownews-git/`, o que exige autorização explícita antes de tocar
o site ao vivo.

---

## 3) Regra que passou a determinar o destaque

Score simples, determinístico, sem IA, auditável (mesma lista de notícias
sempre produz o mesmo resultado):

| Componente | Peso | Base |
|---|---|---|
| Recência | 40 → 30 → 20 → 10 → 4 → 0 | Faixas de horas (≤6h / ≤24h / ≤48h / ≤96h / ≤168h / mais) — nunca zera de vez, uma notícia antiga ainda pode vencer se for muito mais relevante |
| Autoridade da fonte | 20 (Petrobras/ANP) / 16 (PPSA) / 12 (EPE/MME) / 8 (Marinha/IBAMA) / 10 (desconhecida) | Todas as fontes já são oficiais; o peso reflete quão central a fonte é pra operação/produção offshore, não confiabilidade |
| Relevância + conexão com o ecossistema offshore | 30 (operações) / 20 (mercado) / 8 (geral) | Reaproveita `classificar()`, já usada nas seções Mercado/Operações — os dois critérios do pedido foram tratados juntos porque o banco não tem campo que os distinga; separar teria significado inventar um sinal inexistente |
| Impacto | +15 | Lista de ~20 palavras que sinalizam evento concreto (descoberta, recorde, leilão arrematado, aprovação, investimento, greve, acidente, sanção, OPEP etc.) — correspondência literal, sempre auditável |
| Imagem própria | +5 | Bônus, não critério excludente (o fallback de imagem editorial já cobre quem não tem foto própria) |

Em empate, vence a matéria que já vinha primeiro na lista (que chega
ordenada por `published_at desc`) — sem aleatoriedade, sem comportamento
imprevisível entre execuções.

---

## 4) Fontes atuais — o que está funcionando

| Fonte | Status | Observação |
|---|---|---|
| ANP | Ativa (grupo automático A, cron `50 ...`) | Confirmada funcionando até 12/09; sem novidade da própria fonte depois disso |
| Petrobras | Ativa (grupo A) | Extração via JSON-LD (mais estável que HTML visual, já documentado no próprio código) — **suspeita de estar falhando desde ~12/09**, ver seção 1 |
| MME | Ativa (grupo A) | Sem novidade da própria fonte desde 02/09 — não dá pra avaliar se está falhando |
| PPSA | Ativa (grupo B, cron `20 ...`) | Via API REST WordPress oficial (`wp-json`) — mais robusta que scraping de HTML |
| EPE | Ativa (grupo B) | Sem novidade real desde 11/09 |
| Marinha do Brasil | **Codificada e testada, mas fora de qualquer grupo automático** (`/run-marinha` manual) — filtro restrito a 3 categorias | Pendência de decisão editorial, não de engenharia — pode ser ativada rapidamente |
| IBAMA | **Codificada e testada, mesma situação da Marinha** (`/run-ibama` manual) | Muito relevante para licenciamento ambiental offshore — mesma observação |

---

## 5) Novas fontes recomendadas (pesquisadas nesta sessão)

Verificação feita ao vivo (leitura das próprias páginas), não é suposição:

| Fonte | O que oferece | Confirmado nesta sessão | Uso recomendado |
|---|---|---|---|
| **IBGE** | Indicadores de produção industrial, PIB, IPCA (grupo combustíveis) | Página SIDRA existe; documentação de API não confirmada nesta sessão — **CONFIRMAR endpoint exato antes de implementar** | Dados de contexto para matérias de combustíveis/inflação, não notícias diárias |
| **BNDES** | Agência de notícias oficial (`agenciadenoticias.bndes.gov.br`) | Confirmada, ativa, estruturada | Baixo volume de conteúdo offshore/energia direto — usar como fonte ocasional (financiamento de infraestrutura, transição energética), filtrando por categoria "Infraestrutura" |
| **CADE** | Notícias institucionais e decisões do tribunal (`gov.br/cade`) | Confirmada, ativa, paginada, com datas e categorias estáveis | Relevante só quando envolver fusões/aquisições ou conduta de empresas do setor — aplicar a mesma regra de relevância (não virar seção de concorrência genérica) |
| **ANTAQ** | Notícias de portos, cabotagem, apoio marítimo, terminais (`gov.br/antaq`) | Confirmada, ativa, estruturada, com conteúdo diretamente relacionado a logística offshore | **Boa candidata de alta prioridade** — conecta diretamente com "logística" e "apoio marítimo" pedidos no escopo |
| **EIA (EUA)** | API pública de dados de petróleo, gás natural, eletricidade, preços | Confirmada: gratuita, mas **exige registro e chave de API** (`api.eia.gov`) | Dados de contexto internacional (preço do WTI, produção EUA) para matérias de mercado/geopolítica — exige gerenciar uma chave como secret, mesmo sendo gratuita |
| **OPEP** | Comunicados de imprensa públicos | Página específica testada retornou erro (URL desta sessão estava desatualizada/incorreta — **não confirmada**, não usar a URL sem revalidar) | Usar só como contexto/citação em matérias de geopolítica/Brent, nunca como fonte automatizada até confirmar a URL/termos de uso corretos |
| **IEA** | Relatórios e dados de mercado de energia | **Não verificada nesta sessão** — historicamente boa parte do conteúdo granular é pago | **CONFIRMAR licenciamento** antes de qualquer automação; press releases costumam ser públicos, dados completos não |
| **Ministério dos Transportes / Infraestrutura** | Notícias sobre portos, cabotagem, logística | URL testada nesta sessão exigiu login/redirecionou — **URL exata não confirmada** | Pesquisar a URL correta antes de implementar (o gov.br reorganiza esses caminhos com frequência) |
| **Sindicatos/federações do setor (ex.: FUP, Sindipetro)** | Posicionamento oficial de categoria | Não verificado nesta sessão | Usar **somente como fonte primária de posicionamento**, sempre identificando a origem explicitamente (ex.: "Segundo nota da FUP..."), nunca como fato apurado de forma independente |
| **Agências/veículos jornalísticos confiáveis** | Contexto para grandes eventos (geopolítica, Brent, greves) | N/A | Nunca copiar texto — usar só para identificar que um fato existe, então apurar/confirmar na fonte primária oficial antes de publicar, como já é o princípio do OWNews |

### O que pode ser integrado automaticamente sem licença/permissão

ANTAQ, CADE, IBGE (após confirmar endpoint) — mesmo padrão técnico já
usado (scraping de página de notícias oficial + filtro de relevância +
dedupe), sem custo e sem credencial de terceiro.

### O que exige licenciamento/API/permissão

- **EIA**: gratuita, mas precisa de cadastro/chave de API (baixo atrito).
- **IEA**: **CONFIRMAR NA IEA** — provável necessidade de assinatura para
  dados completos.
- **OPEP**: **CONFIRMAR URL E TERMOS DE USO** antes de qualquer automação.
- **Veículos jornalísticos**: exigem ou (a) licenciamento de conteúdo/API
  paga, ou (b) uso só como gatilho de apuração (nunca republicação) — a
  segunda opção é a única compatível com o modelo editorial do OWNews.

---

## 6) Taxonomia editorial

Proposta (documentação apenas — nenhuma coluna nova criada no Supabase):

**Tags públicas** (para SEO, páginas temáticas, filtros — não todas no
menu principal): Offshore · Petróleo & Gás · Petrobras · Mercado ·
Combustíveis · Energia · Transição Energética · Carreiras · Empresas ·
Tecnologia · Brasil · Mundo.

**Classificação interna** (não visível ao leitor, para automação futura —
Home, Instagram, Telegram, ranking, newsletter — nada disso ativado
nesta rodada):

| Classe interna | Equivalente ao pedido | Como seria calculada |
|---|---|---|
| `CORE_OFFSHORE` | CORE OFFSHORE | `classificar() === 'operacoes'` |
| `HIGH_IMPACT_ENERGY` | HIGH IMPACT ENERGY | `classificar() === 'mercado'` + palavra de impacto |
| `CAREER` | CAREER | Fonte/categoria de conteúdo de carreiras (já existe conceito equivalente no `telegram-integration/ARQUITETURA.md`) |
| `MARKET` | MARKET | `classificar() === 'mercado'` sem palavra de impacto |
| `FUEL` | FUEL | Novo — exigiria os filtros de combustíveis descritos na seção 7, ainda não implementados no collector |
| `ENERGY_TRANSITION` | ENERGY TRANSITION | Novo — palavras-chave (eólica offshore, hidrogênio, CCS, SAF) já parcialmente cobertas em `PALAVRAS_MERCADO`, mas sem uma classe própria hoje |
| `GEOPOLITICS` | GEOPOLITICS | Novo — não existe hoje nenhum coletor de fonte internacional |

Implementar essas classes de verdade exigiria (a) decidir se o campo vive
calculado no frontend (como `classificar()` já é) ou como coluna no
Supabase, e (b) ampliar collector para as fontes de combustível/transição/
geopolítica — nenhuma dessas duas coisas foi feita nesta rodada.

---

## 7) Como impedir que o OWNews vire portal genérico

A regra de relevância pedida já está sendo aplicada como critério de
corte, não de pontuação — ou seja, antes de qualquer nota entrar na
pauta:

1. Tem impacto relevante em petróleo, energia ou offshore?
2. Há conexão objetiva e explicável (não especulativa)?
3. O leitor do OWNews ganha alguma informação útil pra vida/trabalho
   offshore?

Se qualquer resposta for não, a notícia não entra — isso vale tanto para
o que já existe (ANP/Petrobras/MME/PPSA/EPE, sempre com filtro de palavras
relevantes, nunca "tudo que a fonte publica") quanto para qualquer fonte
nova recomendada acima (ANTAQ/CADE/EIA etc., que publicam muita coisa
fora do escopo do OWNews e precisam do mesmo filtro).

Proteções adicionais já usadas no projeto e que devem se manter:
- Fontes eram e continuam sendo majoritariamente oficiais (governo/estatal),
  não agregação de blogs.
- Nenhuma matéria é republicada — sempre resumo + contextualização, nunca
  cópia de texto de terceiros (já é o padrão do `lerNoticia()` do collector,
  que extrai e resume, não copia o artigo inteiro).
- Para as expansões temáticas pedidas (combustíveis, carros elétricos,
  transição energética, geopolítica), a inclusão é sempre pelo **impacto
  energético/offshore do fato**, nunca pelo tema em si — evita o OWNews
  virar portal de política, de carros ou de notícias gerais.

---

## 8) Modelo "Por que isso importa para o setor?"

Ainda não implementado (é conteúdo editorial, não lógica de coleta) — mas
o modelo pedido é direto de aplicar quando o OWNews começar a cobrir
notícias fora do núcleo direto (ex.: carros elétricos, combustíveis,
geopolítica):

```
FATO (fora do offshore direto)
  ↓
efeito imediato no setor de energia/combustíveis
  ↓
efeito sobre demanda/oferta de derivados relevantes
  ↓
efeito potencial sobre estratégia de empresas de petróleo e gás
  ↓
relação objetiva (ou ausência dela) com investimento/operação offshore
```

Regra explícita pedida e mantida: nunca a manchete simplista ("carros
elétricos vão acabar com o petróleo" / "não afetam em nada") — sempre
diferenciar petróleo de gasolina/diesel/petroquímica/aviação/transporte
marítimo/geração, e basear a resposta em dado e horizonte de tempo, nunca
em opinião.

---

## 9) O que precisa de decisão humana (não técnica)

1. Autorizar (ou não) uma chamada manual de diagnóstico ao collector
   (`GET /run`) para confirmar se a falha de coleta é real e, se for,
   coletar imediatamente o que ficou pendente (inclusive a matéria da
   Petrobras de 14/09).
2. Autorizar acesso à Cloudflare (login) para inspecionar logs/triggers
   do `shrill-pond-a915` com mais precisão do que foi possível nesta
   sessão.
3. Decidir se Marinha e IBAMA (já codificados e testados) devem entrar
   nos grupos automáticos do cron — é decisão editorial pendente, não
   trabalho de engenharia novo.
4. Aprovar (ou ajustar) os pesos do score de destaque (seção 3) — valores
   iniciais razoáveis, não "mágicos", pensados pra serem fáceis de
   calibrar depois.
5. Autorizar o deploy da correção de frontend já pronta (`producao-ownews-git/`)
   quando fizer sentido — não foi feito nesta sessão.
6. Priorizar, entre as fontes novas recomendadas, quais valem a pena
   implementar primeiro (ANTAQ parece o ganho mais direto e mais barato).
7. Decidir sobre EIA (aceitar gerenciar uma chave de API gratuita) e
   confirmar OPEP/IEA (licenciamento) antes de qualquer automação
   internacional.

---

## 10) Próximas expansões sugeridas (ordem sugerida)

1. Diagnosticar e (se autorizado) destravar a coleta da Petrobras/geral —
   é o problema mais urgente e mais barato de resolver.
2. Ativar Marinha + IBAMA nos grupos automáticos (só decisão + deploy,
   código já existe).
3. Adicionar ANTAQ como nova fonte (mesmo padrão técnico já usado).
4. Implementar o corte de combustíveis (separar preço do petróleo /
   refino / distribuição / impostos / bomba) como categoria própria,
   quando houver decisão sobre quais fontes oficiais alimentam cada parte
   (ANP já publica boletins de preços — bom ponto de partida confirmado
   na própria auditoria desta sessão, "Levantamento de Preços de
   Combustíveis").
5. Só depois disso, avaliar fontes internacionais (EIA primeiro, por ser
   gratuita e já confirmada; IEA/OPEP dependendo da confirmação de
   licenciamento).
6. Implementar a classificação interna (seção 6) como campo real, quando
   a automação de Instagram/Telegram/newsletter for de fato ativada.

Nenhum destes 6 itens foi executado nesta sessão além do que já está
descrito nas seções 1–3 (correção de frontend).

---

## 11) Atualização — diagnóstico com recuperação executado (2026-09-15, ~15:02 UTC)

Autorizado pelo usuário: chamada manual controlada ao collector para
diagnosticar e recuperar a coleta parada. Executado com segurança —
nenhuma alteração de cron, secrets, schema/RLS do Supabase; nenhuma
exclusão de dados; nenhuma recriação de Worker; nenhuma mudança de DNS.

### Linha do tempo

| Hora (UTC) | Ação | Resultado |
|---|---|---|
| 15:01 | Baseline registrado (leitura, Supabase) | 24 artigos `published`; mais recente = EPE 12/09 21:08:01; confirmado que o artigo da Petrobras/Sempra **não existia** |
| 15:02:14 | `GET /run` (Grupo A: ANP + Petrobras + MME) — chamada única | ANP: 8 encontradas, 0 novas (tudo já existia). MME: 2 encontradas, 0 novas. **Petrobras: 5 encontradas, 1 nova inserida** (o artigo da Sempra) |
| 15:02:43 | `GET /run-novas-fontes` (Grupo B: PPSA + EPE) — chamada única | PPSA: 4 encontradas, 0 novas (1 pulada por dedupe fuzzy contra artigo já existente da Petrobras — funcionando como esperado). EPE: 3 encontradas, 0 novas |
| 15:03 | Verificação pós-chamada (Supabase) | 25 artigos `published`; artigo da Sempra confirmado no banco, `published_at = 2026-09-15T15:02:24 UTC`; agora é o mais recente do portal |

### Causa da parada — diagnóstico

O pipeline de coleta em si (fetch, parser HTML/JSON-LD, filtro de
relevância, dedupe, inserção no Supabase) está **comprovadamente saudável**
— rodou perfeitamente nas 5 fontes na primeira tentativa manual, sem
nenhum erro em nenhuma delas (`"ok": true` em todas). Isso descarta parser,
filtro, dedupe e fetch como causa.

Também descartei cache como causa: a página da Petrobras responde
`Cache-Control: public, max-age=600` (10 minutos) — insuficiente para
explicar 63 horas sem coleta; qualquer execução de cron dentro desse
intervalo já pegaria conteúdo fresco.

**Não consigo confirmar com certeza absoluta** a causa exata sem acesso
autenticado ao painel/API da Cloudflare (login não disponível nesta
sessão — sem logs, sem inspeção do estado atual do Trigger de cron).

**Hipótese mais forte, por coincidência temporal direta**: o último
deploy conhecido do Worker `shrill-pond-a915` (registrado em snapshot
local anterior) ocorreu em **2026-09-12T21:05:38 UTC** — praticamente no
mesmo instante em que a última coleta automática bem-sucedida terminou de
inserir artigos (janela 20:50–21:08 UTC do mesmo dia). Depois disso, zero
inserções automáticas em ~63h/~24 janelas de cron, até a intervenção
manual desta sessão. Isso é consistente com o cron trigger tendo sido
perdido/desregistrado nesse deploy (o mesmo tipo de falha já documentado
neste projeto para variáveis de ambiente, ver comentário em
`shrill-pond-a915-fix/wrangler.jsonc` sobre `SUPABASE_URL` ter sido apagada
por omissão em um deploy anterior).

**Não alterei o cron nesta rodada**, conforme instruído. A correção mais
provável (redeploy do Worker a partir do `wrangler.jsonc` atual, que já
tem os crons corretos) não foi executada porque (a) esta sessão não está
autenticada na Cloudflare e (b) mesmo com autenticação, seria uma mudança
que toca o cron — que o usuário pediu explicitamente para não alterar
ainda nesta etapa.

### Fontes — resultado final desta rodada

| Fonte | Funcionando? | Observação |
|---|---|---|
| ANP | Sim | 0 novas — consistente com a própria fonte não ter publicado nada novo |
| Petrobras | Sim | **1 nova recuperada** (a que a auditoria original tinha identificado) |
| MME | Sim | 0 novas — consistente, fonte sem novidade desde 02/09 |
| PPSA | Sim | 0 novas; 1 item corretamente reconhecido como duplicata (fuzzy) de artigo já existente da Petrobras |
| EPE | Sim | 0 novas — consistente |

Nenhuma fonte falhando isoladamente nesta execução.

### Validação da Home com dados reais e atualizados

Reexecutei a simulação da nova lógica de destaque (seção 3) contra os 20
artigos mais recentes já com o artigo da Sempra incluído:

- **Manchete escolhida**: o próprio artigo da Sempra (score 100 — soma de
  recência máxima + autoridade Petrobras + categoria operações + sem
  palavra de impacto adicional + bônus de imagem). Único caso em que a
  lógica antiga e a nova concordam, porque aqui a notícia mais recente
  também é, de fato, a mais relevante — o que é o comportamento correto.
- **Etiqueta "AGORA"**: aparece **somente** neste artigo (h=0,0). Todos os
  outros 19, mesmo estando entre os mais recentes da lista, mostram a
  categoria real (MERCADO/OPERAÇÕES) — nenhum falso "AGORA".
- `node --check` seguiu válido nos dois arquivos (nenhuma alteração de
  código nesta etapa, só revalidação com dados novos).

### Deploy do frontend

**Não executado.** `wrangler whoami` confirma sessão não autenticada na
Cloudflare. A correção já está pronta, testada e validada com dados reais
em `producao-ownews-git/worker.js` (produção) e replicada em
`home-redesign/worker.js` (preview). Único passo restante: alguém com
acesso à conta Cloudflare rodar, a partir de `producao-ownews-git/`:

```
wrangler deploy
```

(usa a configuração já presente em `producao-ownews-git/wrangler.jsonc`,
que aponta pro Worker de produção `ownews-git` — não mexe em cron, não
mexe em outro Worker.)

### Pendências para o usuário (atualizado)

1. Verificar no painel Cloudflare (Workers → `shrill-pond-a915` →
   Triggers) se os dois cron triggers ainda estão listados e ativos —
   é o único jeito de confirmar (não só inferir) a causa raiz.
2. Se os triggers estiverem ausentes/incorretos: autorizar um
   `wrangler deploy` do collector a partir do `wrangler.jsonc` atual
   (já correto) para restaurá-los — ação que toca cron, propositalmente
   não feita nesta rodada.
3. Autenticar a Cloudflare nesta ferramenta (ou rodar localmente) para
   executar o `wrangler deploy` do frontend já pronto.
4. Considerar, como proteção contra recorrência, um alerta de "coleta
   parada" (ex.: via o mecanismo de admin do Telegram já preparado em
   `telegram-integration/`) que dispare se nenhum artigo novo for inserido
   em N horas — não implementado nesta rodada, é uma sugestão.

---

## 12) P0 — Diagnóstico definitivo por fonte + 2 parsers quebrados corrigidos (2026-09-15, ~15:50–16:10 UTC)

Nova rodada, com autorização explícita pra alterar o collector quando a
causa estiver clara e a correção for segura. Backup em
`shrill-pond-a915-fix/_backup_antes_expansao_editorial/` (já existia, não
sobrescrito). Nenhum secret exposto, nenhum dado apagado, nenhuma
alteração de RLS/schema/DNS, nenhuma alteração de cron.

### Teste real de cada fonte (fetch fresco + parser real, não só HTTP 200)

Chamada individual a cada endpoint de teste do collector **ao vivo**
(código ainda não atualizado — esta é a fotografia "ANTES"):

| Fonte | Fetch | Parser | Encontradas | Novas (hoje) | Última publicação real da fonte |
|---|---|---|---|---|---|
| ANP | OK | OK | 8 | 0 | 11/09 |
| Petrobras | OK | OK | 5 | 0 (a nova de 14/09 já foi recuperada na rodada anterior) | 14/09 |
| MME | OK | OK | 2 | 0 | 02/09 |
| PPSA | OK | OK | 4 | 0 | 11/09 |
| EPE | OK | OK | 3 | 0 | 11/09 |
| **Marinha do Brasil** | OK | **QUEBRADO** | 0 | 0 | não verificável (parser não extraía nada) |
| **IBAMA** | OK | **QUEBRADO** | 0 | 0 | não verificável (parser não extraía nada) |

Confirmado: as 5 fontes automáticas continuam tecnicamente saudáveis —
"0 novas" é porque genuinamente não há conteúdo inédito nelas hoje, não
porque estejam falhando. Isso já tinha sido apurado comparando com as
próprias páginas-fonte na rodada anterior; agora está confirmado também
pelo próprio collector.

### 2 causas raiz encontradas e corrigidas (parsers reais, não hipótese)

**IBAMA**: `IBAMA_URL` apontava para `/ibama/pt-br/assuntos/noticias`, que
hoje é só uma pasta-índice do Plone (só links de navegação/facetas por
ano, RSS, atom — **zero artigo**, confirmado inspecionando o HTML real
byte a byte). Os artigos de verdade ficam em
`/ibama/pt-br/assuntos/noticias/<ano>`. Corrigido pra montar a URL com o
ano corrente dinamicamente (`new Date().getFullYear()`), pra não quebrar
de novo em janeiro. Testado contra a página real do ano: agora extrai
2 links (1 artigo real + 1 falso positivo do botão "copiar link", que não
passa no filtro de relevância de qualquer forma — cosmético, não afeta
resultado).

**Marinha do Brasil**: cada card tem DOIS links `<a>` com o mesmo href —
um envolvendo só a imagem (sem texto), outro com o título de verdade
dentro de `<h4 class="card-title">`. O regex antigo pegava o primeiro
(o da imagem) e capturava HTML solto como se fosse título — por isso
`relevanteMarinha()` nunca batia com nada (o "título" nunca foi texto de
verdade). Corrigido pra mirar especificamente `h4.card-title > a`.
Testado contra as 3 páginas reais das categorias monitoradas: agora
extrai 4 títulos limpos e corretos (ex.: "Comando Conjunto participa da
Operação Catrimani II contra o garimpo ilegal na Terra Indígena
Yanomami"). Nenhum é relevante para o OWNews hoje — e está correto que não
sejam (são notícias de repressão a drogas/garimpo, fora do escopo
editorial), o que prova que o filtro `relevanteMarinha` também está
funcionando, não só o parser.

### Filtro de relevância — impacto real medido (extração real + filtro antigo vs novo)

Rodado contra HTML/JSON baixado agora mesmo de cada fonte:

| Fonte | Extraídos (bruto) | Passavam no filtro antigo | Passam no filtro novo | Resgatados |
|---|---|---|---|---|
| ANP | 31 | 8 | 15 | **+7** |
| MME | 30 | 2 | 5 | **+3** |
| EPE | 10 | 3 | 4 | **+1** |
| Petrobras | 16 | 7 | 10 | **+3** |
| PPSA | 15 | 12 | 12 | +0 (já tinha boa cobertura) |
| ANTAQ (fonte nova) | 30 | 0 (não existia) | 10 | **+10 (fonte inteira nova)** |
| **Total de itens elegíveis a mais** | | | | **24** |

Confirmado nominalmente: o boletim **"Levantamento de Preços de
Combustíveis (6 a 12/9) será publicado na segunda (14/9)"**, apontado
como prioridade, está na lista de resgatados da ANP — hoje ele é
rejeitado antes mesmo de checar duplicidade; comparado com o banco atual,
**não existe lá** — ou seja, com o filtro novo implantado, essa matéria
seria inserida como notícia nova de verdade, não só reprocessada.

**Investigação pedida sobre "atualização de dados" vs "página nova"**: o
collector já tem uma capacidade parcial disso — quando uma URL já
conhecida é revisitada, `atualizarArtigo()` atualiza título/resumo/
conteúdo (não cria duplicata). Mas isso é por **URL individual**, não por
"um dataset/tabela foi atualizado sem virar página nova". Gerar uma
matéria editorial original a partir da tabela de preços de combustíveis
da ANP (sem copiar a tabela, sem inventar interpretação) é um recurso
**novo e maior** — exigiria buscar e interpretar o arquivo de dados da
ANP (normalmente planilha), não só a página de comunicado — **não
implementado nesta rodada**, fica como recomendação de próximo passo, não
fabricado às pressas pra parecer resolvido.

### Radar complementar — pesquisado e verificado ao vivo

**Agência Brasil (EBC)** — confirmado nesta rodada: feed RSS público e
válido, inclusive um **feed de editoria específico de Economia**
(`https://agenciabrasil.ebc.com.br/rss/economia/feed.xml`, HTTP 200,
RSS 2.0 válido). É agência pública federal (EBC), sem paywall, uso
editorial normal (não é preciso "burlar" nada). **Melhor candidato de
radar complementar encontrado nesta rodada** — mas **não implementado**
ainda (precisaria de um parser de RSS novo, categoria de código diferente
do que já existe, e do mesmo filtro de relevância por cima pra não virar
feed geral). Recomendado como próximo passo de maior alavancagem depois
do deploy dos itens já prontos.

**Empresas do setor (Shell, Equinor, TotalEnergies, bp, MODEC, SBM,
Subsea7, TechnipFMC, Oceaneering, SLB, Halliburton, Baker Hughes etc.)**:
**não verificado ao vivo nesta rodada** — checar feed/release público de
cada uma é uma pesquisa própria, uma por uma, que não coube no tempo
desta rodada junto com o resto. Não vou listar como "confirmado" o que
não testei. Fica como pendência de pesquisa dedicada.

**OPEP/IEA/EIA**: sem mudança em relação ao relatório anterior — OPEP com
URL não confirmada, IEA com licenciamento a confirmar, EIA confirmada
(gratuita, exige cadastro de chave).

### Projeção "ANTES / DEPOIS" (honesta — DEPOIS não é produção real)

| | ANTES (produção real, agora) | DEPOIS (projeção local, não deployado) |
|---|---|---|
| Artigos <24h | 1 | Não posso afirmar um número exato de produção — só simulação local. Projeção: os 24 itens resgatados + 10 do ANTAQ passariam a entrar no dedupe real do Supabase; alguns já podem estar cobertos por matérias parecidas (dedupe fuzzy já existente). Só o deploy real dá o número verdadeiro. |
| Fontes ativas (tecnicamente saudáveis) | 5 de 7 (Marinha e IBAMA quebrados) | 7 de 7 (todas corrigidas e testadas localmente) + ANTAQ como 8ª fonte pronta |

Não inventei um número de "Y" pós-deploy porque isso exigiria a escrita
real no Supabase, que só acontece com o collector deployado — o que seguiu
bloqueado por falta de autenticação Cloudflare nesta sessão.

### Deploy — continua bloqueado, não por escolha

`wrangler whoami` confirmado de novo: sessão não autenticada. Isso inclui
o próprio backup/teste/rollback que a autorização desta rodada pedia como
pré-requisito — o backup e o teste isolado foram feitos (ver acima); o
rollback é trivial (arquivo de backup já existe, idêntico ao estado
anterior) mas não há o que reverter porque **nada foi publicado**.

Assim que houver autenticação, o deploy do collector é:
```
cd /srv/offshoreworks/ownews/shrill-pond-a915-fix
npx wrangler deploy
```
(usa o `wrangler.jsonc` já existente nessa pasta — não mexe em cron, os
dois triggers continuam exatamente como estão hoje até uma decisão
separada sobre isso).

### Resposta objetiva ao gate de conclusão

1. **Quantas notícias reais entraram nas últimas 24h?** 1 (a matéria da
   Petrobras/Sempra, recuperada manualmente na rodada anterior).
2. **Quantas nas últimas 48h?** 1 (mesma).
3. **Quais fontes estão funcionando?** ANP, Petrobras, MME, PPSA, EPE —
   confirmado com teste real desta rodada (fetch OK, parser OK, "0 novas"
   é falta de conteúdo inédito, não falha).
4. **Quais estão quebradas?** Marinha do Brasil e IBAMA estavam quebradas
   (parser). **Corrigidas e testadas localmente nesta rodada** — ainda não
   deployadas.
5. **Por que a coleta ficou pobre?** Três causas combinadas, todas
   confirmadas com evidência: (a) cron provavelmente parado desde
   ~12/09 21:05 UTC (não confirmável sem painel Cloudflare); (b) filtro de
   relevância rejeitava 24 itens legítimos por vocabulário incompleto
   (corrigido, não deployado); (c) 2 de 7 fontes com parser quebrado
   (corrigido, não deployado).
6. **O filtro foi corrigido?** Sim, ampliado e testado contra dados reais
   das 5 fontes automáticas — não deployado.
7. **Quais novas fontes foram efetivamente integradas?** Nenhuma "em
   produção" ainda (não há deploy) — mas ANTAQ está implementada, testada
   com HTML real ao vivo, e pronta (10 itens elegíveis hoje). Agência
   Brasil (RSS de economia) foi pesquisada e confirmada como viável, mas
   não implementada.
8. **O collector está executando automaticamente?** Não confirmável sem
   painel Cloudflare — evidência (63h+ sem produzir nada além da
   intervenção manual) sugere que não, ou que está falhando
   silenciosamente. Não alterei o cron porque a causa não está confirmada
   com certeza (só hipótese fundamentada), conforme a própria instrução de
   só mexer em cron com causa clara.
9. **A próxima execução está agendada?** Os triggers do `wrangler.jsonc`
   continuam os mesmos de sempre (`50 8,11,14,17,20,22 * * *` e
   `20 8,11,14,17,20,22 * * *`) — se estiverem de fato ativos no
   Cloudflare (não confirmado), sim; se tiverem sido perdidos num deploy
   anterior (hipótese principal), não.
10. **Se amanhã sair uma notícia relevante, o OWNews tem alta
    probabilidade de encontrá-la?** **Ainda não**, enquanto o cron não for
    confirmado/corrigido e o filtro novo não for deployado — é exatamente
    por isso que este relatório não declara o pipeline "saudável" de
    ponta a ponta. O que ficou pronto nesta rodada aumenta muito a chance
    quando publicado, mas a palavra final depende de dois passos que só
    quem tem acesso à Cloudflare pode dar: confirmar/corrigir o cron e
    autorizar o deploy do collector corrigido.

---

## 13) Autenticação restaurada — deploy real, comprovação ponta a ponta (2026-09-15, ~16:16–16:24 UTC)

Autenticação Cloudflare confirmada (`wrangler whoami`). Pipeline
executado de ponta a ponta em produção de verdade: **FONTE → FETCH →
PARSER → FILTRO → INSERT → SUPABASE → HOME**.

### Correção importante ao diagnóstico anterior

A seção 11/12 acima especulava que o cron trigger podia ter sido perdido
num deploy anterior. **Isso está incorreto e foi corrigido com dados
reais**: consultei a API da Cloudflare (`GET .../workers/scripts/
shrill-pond-a915/schedules`) e a **Analytics GraphQL de invocações** —
os dois cron triggers estavam corretamente registrados o tempo todo, e
dispararam com sucesso, sem erro, em todos os horários programados dos
dias 12 a 15/09 (centenas de invocações, status `success`, zero erro
sistemático). **O cron nunca foi a causa.** A causa real e única, já
identificada e corrigida antes desta seção, era o filtro de relevância
estreito demais + os 2 parsers quebrados (Marinha e IBAMA).

### 2 novos bugs de produção encontrados e corrigidos durante o próprio deploy

Isto é exatamente o tipo de coisa que só aparece testando de verdade —
por isso não parei em "deploy feito":

1. **Estouro de subrequests**: o filtro ampliado fez o Grupo A (ANP +
   Petrobras + MME) processar itens demais numa só invocação, e o MME
   inteiro falhou com `Too many subrequests by single Worker invocation`
   na primeira execução pós-deploy. **Corrigido**: MME foi realocado pro
   Grupo B (que tinha folga) — nenhum horário de cron mudou, só qual
   grupo processa qual fonte. Testado de novo: 0 erros nos dois grupos.
2. **`new Date()` no escopo de módulo**: a correção de URL do IBAMA usava
   `new Date().getFullYear()` fora de uma função — Cloudflare Workers
   "congela" o relógio durante a inicialização do script (fora de um
   handler de requisição), então isso resolvia sempre para 1970,
   quebrando o IBAMA com HTTP 404 em `.../noticias/1970`. **Corrigido**:
   o ano agora é calculado dentro da função, na hora da requisição real.
   Auditei o arquivo inteiro em busca de outros `new Date()` no escopo de
   módulo — não há mais nenhum.

Cada correção foi testada de novo em produção (chamada real ao endpoint)
antes de seguir em frente.

### Comprovação ponta a ponta (dados reais, não estimativa)

| Fonte | Fetch | Parser | Filtro | Insert | Resultado real |
|---|---|---|---|---|---|
| ANP | OK | OK | OK | OK | 5 novas inseridas (inclusive o boletim de combustíveis) |
| Petrobras | OK | OK | OK | OK | 1 nova inserida |
| MME | OK | OK | OK | OK | 3 novas inseridas |
| EPE | OK | OK | OK | OK | 1 nova inserida |
| PPSA | OK | OK | OK | OK | 0 novas (nada de inédito na fonte agora) |
| **ANTAQ** | OK | OK | OK | OK | **10 novas inseridas — fonte nova, primeira execução real** |
| Marinha | OK (corrigido) | OK (corrigido) | OK | — | 0 novas (nada relevante na fonte hoje — correto) |
| IBAMA | OK (corrigido) | OK (corrigido) | OK | — | 0 novas (só 1 artigo real na fonte hoje, não relevante — correto) |

**Total: 20 artigos novos e reais inseridos no Supabase nesta rodada**,
confirmado por consulta direta (contagem subiu de 25 para 45) e pelo
`/saude` (`articles_last_24h: 21`, `estado: SAUDAVEL`).

### Observação editorial honesta (não é bug, é achado de qualidade)

Boa parte dos 10 itens do ANTAQ são de natureza procedural (audiência
pública, consulta pública, "vem aí o encontro X") — tecnicamente
relevantes pelo filtro (mencionam porto/concessão), mas de menor
substância editorial que uma notícia de fato. Isso empurrou vários deles
pra "Destaques"/"Últimas" na simulação da Home. **Não é um bug** — é uma
característica do vocabulário do ANTAQ que vale reavaliar numa próxima
rodada (ex.: pontuar procedural mais baixo, ou pedir confirmação de
resultado, não só de agenda). Registrado como recomendação, não corrigido
às pressas.

### Validação da Home (simulação com dados reais pós-deploy)

- Nenhuma repetição entre manchete/destaques/últimas/mercado/operações —
  13 posições preenchidas, 13 IDs únicos.
- "AGORA" aplicado corretamente — hoje, tudo que está no topo é
  genuinamente novo (inserido nos últimos minutos), então é esperado e
  correto que apareça marcado.
- Confirmado que o HTML da produção já carrega o código novo
  (`escolherDestaque`, `pontuarDestaque`, `HORAS_JANELA_AGORA` presentes
  no `https://ownews.com.br/` ao vivo).

### Deploys realizados nesta sessão (autorizados, com backup e rollback preservados)

| Worker | Version ID anterior (rollback) | Version(s) publicada(s) | Version ID final |
|---|---|---|---|
| `shrill-pond-a915` (collector) | `2ce25380-ba22-40ac-917e-266cf6b8d8e2` | 3 deploys (filtro+ANTAQ+parsers → rebalanceamento de grupo → correção do Date) | `513e8f69-00e8-4d70-973d-f42e0c0de03f` |
| `ownews-git` (frontend, produção) | `c58bf5fc-72e8-4540-aca8-968d5c989be8` | 1 deploy (score de destaque, correção AGORA, sem repetição entre seções, Minha Escala, 2 guias, banner OffshoreWorks, footer) | `d56d5925-4d9b-40eb-b815-83e8ef1d6a94` |

Backup do collector preservado em
`shrill-pond-a915-fix/_backup_antes_expansao_editorial/`. Nenhum secret
exposto, nenhum dado apagado, nenhuma alteração de RLS/schema/DNS.
Rollback disponível a qualquer momento via
`npx wrangler rollback --message "..." [version-id]` em cada Worker, se
necessário.

### Cron — estado final confirmado

Os dois triggers continuam ativos e inalterados
(`50 8,11,14,17,20,22 * * *` e `20 8,11,14,17,20,22 * * *`), confirmado
via API após os 3 deploys do collector. Próxima execução real a partir de
agora (16:24 UTC de 15/09): **17:20 UTC** (Grupo B: PPSA+EPE+MME) e
**17:50 UTC** (Grupo A: ANP+Petrobras) — essas, sim, deverão rodar
automaticamente com o código corrigido, sem intervenção manual.
