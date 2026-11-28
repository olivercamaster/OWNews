# Incidente — cota de escrita KV excedida (Instagram publisher)

Data: 2026-09-19. Encontrado durante investigação do heartbeat do poller VPS
parado (`ultimo_heartbeat_vps: null` no `/saude-fragment`).

## O que aconteceu

`env.SAUDE_KV.put(...)` no Worker `ownews-instagram-publisher` passou a
falhar com o erro real da Cloudflare **"KV put() limit exceeded for the
day."** — o plano Free do Workers KV tem um teto de 1000 escritas/dia.

Causa raiz: o heartbeat de observabilidade em `/render-jobs/pending`
gravava no KV a **cada chamada**, e o poller do VPS chama essa rota a cada
minuto (cron `* * * * *`) — sozinho isso é até 1440 escritas/dia, acima do
limite inteiro.

## Descoberta importante sobre o escopo da cota

A hipótese inicial era que a cota fosse por *namespace* (o binding
`SAUDE_KV` era compartilhado com o collector `shrill-pond-a915`). Criamos
um namespace KV novo e dedicado só para o Instagram
(`89bbf2698c1a483eb48e1e88aa000343`) para testar — **o erro continuou**,
mesmo num namespace recém-criado sem nenhuma escrita anterior, enquanto o
`/saude` do collector (outro Worker, namespace antigo `d56be5...`)
continuava respondendo normalmente na mesma janela de tempo. Isso indica
que a cota do plano Free é aplicada **por Worker (script)**, não por
namespace nem só por conta — trocar de namespace não restaura a cota do
dia para o mesmo Worker que já estourou.

## Correções aplicadas (2026-09-19)

1. Heartbeat throttled: só grava se o heartbeat atual tem 5+ minutos (ou
   não existe) — reduz de até 1440/dia para no máximo ~288/dia. Resolve o
   problema **a partir do próximo reset da cota**.
2. Namespace KV dedicado pro Instagram publisher (não resolveu o
   travamento de hoje, mas isola esse Worker do namespace do collector —
   mantém o princípio já documentado no código de "nunca fundir" os dois).

## Risco real pendente

A cota do `ownews-instagram-publisher` já estourada hoje (2026-09-19) pode
**não** resetar antes da janela real das 23:15 UTC (20:15 BRT) — se o
reset for à meia-noite UTC, a tentativa de enfileirar o job dessa janela
(`enfileirarJob` → `SAUDE_KV.put`) pode falhar. Não há forma de contornar
isso sem esperar o reset natural ou fazer upgrade de plano (decisão do
proprietário — envolve pagamento, não executado sem autorização).

## Verificação recomendada

Checar `/saude-fragment` do `ownews-instagram-publisher` depois de
2026-09-19T23:15Z (ou o log `poll.log` do VPS) para confirmar se a
publicação real da noite ocorreu. Se falhar por causa da cota, deve voltar
ao normal no dia seguinte com o heartbeat já throttled.
