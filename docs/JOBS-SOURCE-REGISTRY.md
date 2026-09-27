# Radar de Vagas Offshore — registro de fontes e métodos de descoberta

Criado em 2026-09-19 (Missão Contínua — Radar de Vagas). Documenta o que
foi verificado de verdade nesta sessão (nunca suposição) sobre como
descobrir vagas reais nos canais oficiais das empresas do setor.

## Bloqueio real de infraestrutura (leia isto primeiro)

O Radar de Vagas precisa de uma tabela `jobs` dedicada (ver
`docs/MIGRATION-JOBS-TABLE.sql`) — ela **não existe ainda** e não pôde
ser criada nesta sessão porque a API REST (PostgREST) usada em produção
só faz CRUD em tabelas já existentes, nunca DDL. Confirmado
empiricamente:

- `GET /rest/v1/jobs` → `PGRST205` (tabela não existe).
- Tentativa de reaproveitar `articles.source_id` (que tem FK real pra uma
  tabela `sources` já existente, hoje vazia) esbarrou num
  `CHECK CONSTRAINT` em `sources.type` cujos valores válidos não foram
  descobertos por tentativa (testados sem sucesso: company, government,
  regulator, primary, official, press, media, secondary) — precisaria de
  acesso a `pg_constraint`/dashboard, que esta sessão não tem.
- Reaproveitar a tabela `articles` diretamente pra guardar vagas foi
  descartado por risco: exigiria alterar toda consulta existente de
  notícia (Home/Giro/Últimas/busca/sitemap) pra excluir linhas de vaga,
  risco real de regressão no que já está funcionando.

**Enquanto a migração não roda**, o Radar de Vagas existe como página
real (`/vagas`) com uma AMOSTRA REAL, verificada e datada (não uma lista
fictícia) — nunca uma lista "ao vivo" contínua, porque isso exigiria
persistência que não temos ainda.

## Método CONFIRMADO e funcionando: API pública do Workday

Empresas que usam Workday como ATS expõem, na própria página pública de
carreiras, uma chamada JSON que o navegador do visitante já faz sem
login nenhum — não é bypass de proteção nenhuma, é a mesma requisição que
qualquer pessoa visitando o site já dispara. Padrão:

```
POST https://<tenant>.wd3.myworkdayjobs.com/wday/cxs/<tenant>/<siteId>/jobs
Content-Type: application/json
{"limit": 20, "offset": 0, "searchText": "Brazil"}
```

`<tenant>` e `<siteId>` variam por empresa e precisam ser confirmados
individualmente (nunca adivinhados — ver casos abaixo). Verificado ao
vivo, com resultado real:

| Empresa | tenant | siteId | Resultado real (19/09/2026) |
|---|---|---|---|
| Shell | `shell` | `ShellCareers` | 3 vagas reais em Rio de Janeiro — Ventura Office, incluindo **"Logistics Analyst - DP Vessel Operator"** (diretamente offshore) |
| Equinor | `equinor` | `EQNR` | API funcional, 0 resultados pra "Brazil" no momento da checagem — mecanismo válido, sem vaga BR agora |

**Achado real e citável**: a vaga "Logistics Analyst - DP Vessel Operator"
da Shell em Rio de Janeiro (Ventura Office) é uma oportunidade real,
verificada, ligada a operação offshore (DP = Dynamic Positioning).

## Método a investigar mais: Gupy

PRIO e Brava Energia usam Gupy (ATS brasileiro muito comum no setor).
Confirmado via WebSearch: `programadeestagioprio.gupy.io`,
`bravaenergia.gupy.io`, `traineebravaoffshore2026.gupy.io`. Tentativa
rápida de endpoint público (`portal.api.gupy.io/api/v1/jobs`) retornou
404 — chute de endpoint errado, não uma prova de bloqueio. Gupy
provavelmente tem uma API pública real (o próprio site é uma SPA que
busca vagas de algum lugar), mas o endpoint exato não foi encontrado
nesta sessão — marcado `MANUAL_DISCOVERY_REQUIRED`, candidato de alto
potencial pra próxima rodada (duas empresas brasileiras relevantes já
confirmadas na mesma plataforma).

## Bloqueado — bot detection real (não contornado)

- **OceanPact** (`oceanpact.com`) — já documentado em
  `SOURCE-REGISTRY.md`: desafio de bot `sgcaptcha` específico a tráfego
  de datacenter/Workers.

## Requer renderização JS (SPA sem dado no HTML bruto)

- **TechnipFMC** (`careers.technipfmc.com`) — confirmado usar SuccessFactors
  (SAP) via string no HTML; página carrega vagas via JS depois do load,
  HTML bruto não contém nenhum `JobPosting`/dado de vaga. Sem headless
  browser (não disponível nesta sessão, Cloudflare Workers não roda
  Chromium sem serviço pago de Browser Rendering), não dá pra ler sem
  reverse-engineering da API interna do SuccessFactors — não tentado
  (risco de ultrapassar "API pública" e virar "engenharia reversa de
  endpoint privado", que a missão pediu pra evitar). `MANUAL_DISCOVERY_
  REQUIRED`.

## Ainda não verificadas nesta sessão (candidatas, não tentadas por tempo)

Seadrill, Foresea, Constellation, Subsea7, DOF, Oceaneering, Fugro,
Saipem, Bram/Grupo Bravante, CBO, Starnav, Wilson Sons, Solstad, MODEC,
SBM Offshore, Yinson, BW Offshore, SLB, Halliburton, Baker Hughes,
Weatherford, TotalEnergies, bp, ExxonMobil, Chevron. Cada uma precisa do
mesmo processo: descobrir o ATS real (WebSearch, nunca advinhar URL),
testar o padrão de API pública se for Workday/plataforma conhecida,
documentar bloqueio real se houver.

## Verificações adicionais — 2026-09-20

- PRIO: Gupy público; job 12081138, Engenheiro(a) de Projetos Topside Sênior, status published, candidatura oficial validada.
- Brava Energia: Gupy público; job 12401067, Bombeador Offshore, status published, candidatura oficial validada.
- Ocyan: Gupy público; job 12394579, MSO - Caldeireiro(a) Escalador(a) NI - OFFSHORE, status published, candidatura oficial validada.
- Outros itens Gupy consultados eram funções administrativas, expiradas ou banco de talentos genérico e não foram adicionados como oportunidades específicas.

## Processo (reaproveitar em toda expansão futura)

1. WebSearch pelo nome da empresa + "careers"/"vagas" pra achar a URL
   real do portal — nunca adivinhar domínio.
2. Identificar a plataforma (string no HTML, padrão de URL: `myworkdayjobs.com`,
   `gupy.io`, `greenhouse.io`, `lever.co`, `smartrecruiters.com` etc.).
3. Se Workday: testar `POST /wday/cxs/<tenant>/<siteId>/jobs` — `<tenant>`
   e `<siteId>` saem da própria URL pública do portal (nunca adivinhados
   isolados, sempre confirmados por WebSearch primeiro, como feito aqui).
4. Se SPA sem API óbvia: marcar `MANUAL_DISCOVERY_REQUIRED`, seguir pra
   próxima — nunca tentar engenharia reversa de endpoint autenticado.
5. Se CAPTCHA/challenge: documentar e seguir, nunca contornar.
