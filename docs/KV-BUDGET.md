# Orçamento de escrita — Cloudflare Workers KV

Auditoria completa em 2026-09-19, motivada por um incidente real em
produção (ver `especificacoes/INCIDENTE-KV-QUOTA-2026-09-19.md`): o
`ownews-instagram-publisher` recebeu o erro real da Cloudflare **"KV
put() limit exceeded for the day."** — o plano Free do Workers KV tem um
teto de **1000 escritas/dia**.

**Descoberta importante**: testamos mover o Instagram publisher para um
namespace KV novo e vazio (`89bbf2698c1a483eb48e1e88aa000343`, separado do
namespace compartilhado com o collector, `d56be506566247ed8a76f74eef14cd6d`)
e o erro **continuou**, mesmo sem nenhuma escrita anterior nesse
namespace novo, enquanto o `/saude` do collector (outro Worker, namespace
diferente) respondia normalmente na mesma janela de tempo. Conclusão: a
cota do plano Free parece ser aplicada **por Worker (script)**, não por
namespace. Migrar de namespace isola os dados (bom pra organização), mas
não devolve cota pro mesmo Worker que já estourou no dia.

**Meta desta auditoria**: nenhum Worker deve sequer chegar perto de
1000 writes/dia em operação normal — orçamento-alvo de **≤ 600/dia por
Worker**, deixando margem real para picos/retries.

## `shrill-pond-a915` (collector) — namespace `d56be506566247ed8a76f74eef14cd6d`

| Chave | Origem | Frequência real | Necessidade | TTL | Writes/dia (estimado) |
|---|---|---|---|---|---|
| `ultima_execucao` | `registrarExecucaoEmKV`, chamada pelo `scheduled()` (2 crons × 6x/dia) + `EditorialPoller.alarm()` (hourly) | 12 (cron) + 24 (hourly) = 36 invocações/dia | Real — é a única prova de que a coleta rodou, usada pelo `/saude` público | nenhum (sobrescreve) | **~36** |
| `offvoos_snapshot` | `OffVoosPoller.alarm()`, `coletarTodosOffVoos` | a cada 5min (era 3min — corrigido nesta auditoria; Alarm de Durable Object, não conta no limite de 5 cron triggers) | Real — dado ao vivo mostrado em `/aeroportos` e na Home | nenhum (sobrescreve) | **~288** (era ~480) |
| `offvoos_backoff` | `gravarBackoffOffVoosNoKV`, só em transição de estado (começou a falhar / voltou a funcionar) | raro — só em mudança real de estado, não a cada tick | Real, mas já é condicional (só grava quando muda) | nenhum | **~0-10** |
| `mercado_snapshot` | `MercadoPoller.alarm()` → `coletarTodoMercado` | a cada 5min | Real — cotações mostradas em `/mercado` e na Home | nenhum (sobrescreve) | **~288** (era ~576 — ver correção abaixo) |

**Subtotal collector, pós-correções desta sessão: ~36+288+10+288 ≈ 622/dia** (era ~1.100-1.390/dia antes). Dentro do orçamento-alvo de 600/dia com margem pequena mas real.

**Correções já aplicadas nesta auditoria:**
1. `coletarLoteMercado` gravava `mercado_snapshot` e, logo em seguida,
   `coletarTodoMercado` (sua única chamadora) gravava a MESMA chave de
   novo com um campo a mais (`ultimo_turno`) — dobro de escritas por
   ciclo, sem necessidade (a versão sem `ultimo_turno` nunca era lida por
   ninguém). Corrigido: agora só a função externa grava, uma vez por
   ciclo. Efeito: Mercado cai de ~576/dia para ~288/dia.
2. `OffVoosPoller` subiu de 3min para 5min de intervalo (era a opção 1
   das recomendações — implementada, não só documentada, por ser uma
   troca de constante reversível e de baixo risco real: dado de
   aeroporto não perde utilidade prática por atualizar a cada 5min em
   vez de 3min). Efeito: OffVoos cai de ~480/dia para ~288/dia.

## `ownews-instagram-publisher` — namespace próprio `89bbf2698c1a483eb48e1e88aa000343`

| Chave | Origem | Frequência real | Necessidade | TTL | Writes/dia (estimado) |
|---|---|---|---|---|---|
| `instagram_ultimo_heartbeat_vps` | `/render-jobs/pending`, chamado pelo poller do VPS a cada minuto | **corrigido nesta auditoria**: só grava se o heartbeat atual tem 5+ min (antes: toda chamada) | Observabilidade (detectar VPS parado) — não precisa granularidade de 1min | 3600s | **antes: até 1440 · depois: ~288** |
| `render_job_current` | `enfileirarJob` (cria) + handler `/render-jobs/pending` (marca in_progress) + handler `/complete` (marca done/failed) | 3 escritas por job real enfileirado | Real — é a fila de trabalho em si, precisa persistir entre o Worker e o poller do VPS | 3600s | **~6-9** (2-3 janelas reais/dia × 3 escritas) |
| `instagram_ultima_execucao` | `registrarExecucao`, 1x por invocação do `scheduled()` (skip ou job_enfileirado) | 2 crons diários + 1 semanal (domingo) | Observabilidade — última tentativa, usada no `/saude-fragment` | nenhum | **~3** |
| `media_<articleId ou institucional-<tema>>` | `finalizarComImagem`, só quando publica de verdade | só em publicação real bem-sucedida | Real — é a imagem servida pro Graph API buscar via URL | 600s | **~1** |

**Subtotal Instagram (pós-correção): ~298-301/dia** — bem dentro do orçamento-alvo. Era ~1449-1452/dia antes (o heartbeat sozinho já estourava o limite inteiro do Worker).

## `ownews-git` (frontend)

Não usa Workers KV — usa **Durable Object Storage** (`PresencaOnline`,
`PageViews`), um sistema de quota **separado** do Workers KV e não afetado
por este incidente. Confirmado via `wrangler.jsonc`: só há
`durable_objects`, nenhum `kv_namespaces`. Nada a orçar aqui.

## Resumo e recomendação

| Worker | Antes da auditoria | Depois das correções desta sessão | Orçamento-alvo |
|---|---|---|---|
| `shrill-pond-a915` | ~1.100-1.390/dia (Mercado duplicado + OffVoos a cada 3min) | **~622/dia** | ≤ 600/dia (margem pequena mas real) |
| `ownews-instagram-publisher` | ~1.449-1.452/dia | **~298-301/dia** | ≤ 600/dia ✅ |

Evolução futura, se o tráfego/número de fontes crescer e a margem do
collector apertar de novo: **escrever só quando o snapshot muda de
verdade** (comparar com o anterior antes de gravar, em vez de sobrescrever
sempre) — mais correto arquiteturalmente ("escrita somente quando estado
muda"), mas exige código extra pra comparar objetos aninhados com
segurança. Não necessário agora com a margem atual.

## Princípios adotados daqui pra frente

- Heartbeat/observabilidade pura nunca deve escrever a cada execução —
  sempre throttled (mínimo alguns minutos entre escritas).
- Preferir **inferir por log/execução** a persistir estado que muda pouco.
- Dado que já tem outra fonte de verdade (ex.: Supabase) não duplica em KV
  só por conveniência.
- Antes de qualquer novo poller/Alarm: estimar writes/dia PRIMEIRO,
  escrever aqui, e só depois implementar.
- Nunca contratar upgrade de plano sem autorização explícita do
  proprietário — os limites do Free são um orçamento real de produto, não
  um obstáculo a contornar com dinheiro por padrão.
