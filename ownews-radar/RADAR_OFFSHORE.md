# Radar Offshore (OWNews) — documentação técnica

O offshore brasileiro em dados: unidades, sondas, campos, operadores, produção, exploração,
futuro e mapa, a partir de **dados públicos oficiais da ANP**. Implantado em 31/10/2026.

## Arquitetura

```
ANP (gov.br/anp, dados abertos + GeoServer)
  └─ VPS: ingestao/run.mjs (crontab) ── descobre o arquivo vigente, baixa, valida, normaliza,
        │                               compara com o snapshot anterior (pautas), relaciona notícias
        └─ PUT /interno/snapshot (segredo RADAR_INGEST_SECRET) ─▶ worker ownews-radar ─▶ KV RADAR_KV
                                                                     │
ownews.com.br/radar-offshore/* ─▶ worker ownews-git (service binding RADAR) ─▶ ownews-radar
   páginas: JSON {titulo, descricao, html, canonical, jsonLd} vestido com paginaChrome (casca do site)
   API/sitemap/estáticos: repassados direto
```

- **Por que ingestão no VPS:** o plano Free da Cloudflare limita CPU por execução (~10 ms); os CSVs
  da ANP (produção: ~29 mil linhas) não cabem. O worker só lê JSON pronto.
- **Por que worker isolado:** o worker principal tem guard de 1.760.000 bytes. O Radar soma ~2,6 KB
  ao portal (rota + atalho na Home); todo o resto (67 KB) vive em `ownews-radar`.
- **Falha isolada:** Radar fora → `/radar-offshore` mostra aviso (503), o portal segue. ANP fora →
  último snapshot válido continua no ar com a data honesta.

## Fontes (catálogo único: `fontes.mjs`)

| Id | Base ANP | Formato | Periodicidade | Chave |
|---|---|---|---|---|
| plataformas | Plataformas em operação (`lpo/dados-abertos-plataformas-operacao.csv`) | CSV UTF-8 `,` | irregular | sigla da instalação |
| sondas | Sondas em operação por período (ano) | CSV UTF-8 `,` | anual, atualizada no ano | sigla da sonda |
| campos | Campos — dados cadastrais (`extracao-campo.csv`) | CSV UTF-8 `,` | irregular | código do campo |
| concessionarios | Campos — concessionários (`extracao-campo-concessionarios.csv`) | CSV UTF-8 `,` | irregular | código + CNPJ |
| producao_mar | Produção no mar por poço (`pm/producao-mar-AAAA.csv`, ano atual + anterior) | CSV UTF-8 `,` | mensal (~2 meses de defasagem) | poço/mês |
| pocos_exploratorios | Painel da fase de exploração — poços | CSV ISO-8859-1 `;` | mensal | poço ANP |
| pads_andamento | PADs em andamento | CSV ISO-8859-1 `;` | mensal | código do PAD |
| declaracoes_comercialidade | Declarações de comercialidade | CSV ISO-8859-1 `;` | mensal | área |
| blocos | Blocos sob contrato | CSV ISO-8859-1 `;` | mensal | bloco |
| investimento_bacia / previsao_atividade / previsao_producao | Previsões D&P | CSV UTF-8 `,` | anual (operadoras) | bacia/ano |
| previsao_exploracao | Previsão de atividades e investimentos exploratórios (PTE) | CSV UTF-8 `;` | anual | atividade/ano |
| geo (campos, blocos, pré-sal) | GeoServer ANP (WFS → GeoJSON, só mar) | JSON | semanal no OWNews | nome |

Arquivos mensais mudam de nome sem padrão (`-set.csv`, `_abr_2026.csv`, `-fev-26.csv`): o padrão de
cada fonte casa o link na página oficial e o mais recente (ano/mês) vence.

**Descartado/pendente:** poços detalhados (`situacao-pocos-1939-2026.csv`, base muito grande — hoje
só "poços produtores no mês" derivados da produção); posição de sondas (a ANP não publica);
investimento por atividade (não separa mar e terra).

## Validação e fallback

Antes de aceitar uma base: encoding esperado, não é HTML, colunas essenciais presentes, volume entre
mínimo e máximo plausíveis. Falhou → mantém a última versão válida (status `falhou` no meta; a página
avisa "A ANP não respondeu na última verificação; exibindo a base de DD/MM/AAAA"). Logs JSON por
linha em `~/ownews-radar-state/ingestao.log`: `dataset_refresh_success`, `dataset_refresh_failed`,
`dataset_validation_failed`, `snapshot_sent`.

## Modelo canônico e identidade (`ingestao/normalizar.mjs`)

- Unidade de produção = `plat-<SIGLA>`; sonda = `sonda-<sigla>`; campo = `campo-<código>`;
  operador = `op-<CNPJ>` (sem CNPJ: `op-<nome>` + item de revisão). **Nomes parecidos nunca unem.**
- Slugs estáveis: guardados em `slugs.json`; uma vez atribuído a um id, nunca muda.
- Sondas: só as com atividade em campo marítimo. Tipo pelo prefixo da sigla apenas quando inequívoco
  (NS navio-sonda, SS semissubmersível, PA autoelevatória).
- Produção: petróleo = óleo + condensado (m³ × 6,28981 ÷ dias do mês = barris/dia); gás = associado +
  não associado (mil m³/dia). Variações: absoluta e percentual (base zero → sem percentual).
- Fotos: só da ficha curada do OWNews (`/radar`) com nome EXATO.

## Notícias relacionadas (`ingestao/noticias.mjs`)

Título + 1ª frase do resumo do Buddy. Unidade: nome completo (ou alias P-NN); nome de 1 palavra sem
número não casa. Campo: só com "campo(s)" antes e apenas conectores/outros campos no meio. Operadora:
só no título, com aliases revisados (`ALIASES_OPERADOR`). Notícia da unidade ≠ notícia da empresa.

## Storage e cache

KV `RADAR_KV` (8fe9a6acb25d45eb98245225fed3c658): ~16 chaves `radar:*`, escritas só quando o
conteúdo muda (hash local em `enviados.json`) — poucas escritas por dia. HTML com Cache API por
versão do snapshot + `VERSAO_UI`; memória de 60 s por isolate.

## Freshness

Cada página lista as bases usadas e a data em que foram consultadas; dado mensal diz o mês de
referência ("dados de agosto de 2026"). Previsões sempre marcadas "Previsto — informado pelas
operadoras à ANP"; análise marcada "Contexto OWNews — análise, não dado da ANP".

## Pautas

`detectarPautas` compara snapshots (nova unidade/sonda, saída, mudança de operador, novo campo,
mudança de situação, novo mês de produção com variação, nova declaração de comercialidade, nova
descoberta, nova previsão). Ficam em `radar:pautas` (GET `/interno/pautas` com segredo). Nada é
publicado automaticamente.

## OWBuddy

- `GET /radar-offshore/api/buddy`: pacote público (catálogo + notícias de todas as unidades, ~48 KB).
  O app baixa inteiro e filtra no aparelho: **o OWNews nunca sabe a unidade de quem usa**.
- Minha Unidade: chave local `owbuddy_minha_unidade` (fora do sync/analytics). Texto livre sempre
  funciona; escolher do catálogo guarda `{id, slug}`. Histórico: `unidade_ref` opcional no registro;
  registros antigos só recebem SUGESTÃO por nome exato (toque da pessoa).
- Analytics: `my_unit_opened`, `my_unit_set`, `my_unit_radar_opened` — sem nome nem id.

## Operação

- Rodar à mão: `ownews-radar/ingestao/radar-cron.sh` (completa) ou `radar-cron.sh --so-noticias`.
- Crontab (UTC): `10 10 * * *` completa; `40 1,4,13,16,19,22 * * *` só notícias.
- Segredo: `~/.config/ownews/radar-ingest-secret` (600) = Worker Secret `RADAR_INGEST_SECRET`.
- Testes: `node ownews-radar/tests/radar_test.mjs`.

## Como adicionar uma fonte

1. Entrada em `FONTES` (página oficial, padrão do arquivo, encoding, separador, colunas essenciais,
   mínimo/máximo, chave). 2. Normalizar em `normalizar.mjs` (nunca usar a coluna crua na UI).
3. Chave nova em `run.mjs` e em `CHAVES_PERMITIDAS` do worker. 4. Página/API + rodapé de fonte.
5. Fixture no formato real em `tests/radar_test.mjs`.
