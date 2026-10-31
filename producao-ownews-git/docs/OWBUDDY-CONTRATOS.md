# Contratos OWNews → OWBuddy

> Fonte da verdade dos endpoints que o app consome. Mudou um campo no worker
> `ownews-git` (`producao-ownews-git/worker.js`)? Atualize **este arquivo**,
> `apps/owbuddy/src/contratos.ts` / `src/api.ts` e rode:
>
> ```bash
> cd producao-ownews-git/apps/owbuddy
> npm test                     # contratos com fixtures (offline)
> npm run test:contrato        # contrato AO VIVO contra ownews.com.br
> ```

Regra de produto: **OWNews produz, OWBuddy consome.** O app não resume, não
reescreve, não gera Impacto e não mostra texto da fonte. Um item fora do contrato
é descartado pelo app, nunca completado.

Todos os endpoints são públicos (GET, sem autenticação, `Access-Control-Allow-Origin: *`)
e ficam em `https://ownews.com.br`. Nenhum grava em KV.

---

## `GET /api/buddy/feed` — notícias

Cache de borda 300 s. Até 20 matérias, mais recentes primeiro.
**Só entra matéria INDEXÁVEL** (mesmo gate da web: `classificarIndexacaoNoticia`
= `INDEXABLE`, ou seja Buddy + corpo + Impacto válidos).

```jsonc
{
  "schema_version": 2,
  "updated_at": "2026-10-18T17:30:00.000Z",
  "articles": [{
    "id": "uuid",
    "title": "string",
    "summary": null,              // SEMPRE null desde 2026-10-18 (era o lead da fonte)
    "corpo": "parágrafo\n\nparágrafo",   // CORPO EDITORIAL OWNEWS
    "buddy_summary": "string",    // BUDDY RESUME
    "why_it_matters": "string",   // O QUE ISSO IMPACTA PARA O OFFSHORE
    "image_url": "https://…|null",// já sem &amp;
    "image_credit": "Eixos|null", // nome da fonte
    "original_url": "https://…",  // fonte original (link opcional no app)
    "published_at": "ISO",
    "editorial_score": 90,        // número 0–100 do pipeline; o app ordena os destaques da Home com ele
    "url": "https://ownews.com.br/noticia?id=<id>",  // canônica — é o que se compartilha
    "buddy_reviewed_at": "YYYY-MM-DD|null",
    "buddy_source": "ownews",
    "explica": [{ "slug": "…", "titulo": "…", "url": "https://ownews.com.br/explica/…" }],
    "thin": false,
    "indexacao": "INDEXABLE"
  }]
}
```

O app exige: `id`, `title`, `buddy_summary`, `corpo`, `why_it_matters` não vazios
e `url` começando com `https://ownews.com.br/`. Ver `normalizarArtigo()`.

Home (Offshore Agora → Notícias): 1 a 3 destaques derivados localmente deste mesmo feed
(`destaquesHome()` em `src/frescor.ts`, mesma regra relevância × frescor e mesma regra de pauta
da Home OWNews). Não há endpoint separado. O app revalida ao abrir a tela e ao voltar do
segundo plano; pedidos simultâneos (Home + Notícias) viram um só.

Cache no app: `owbuddy_cache_feed_v3` (TTL 5 min; sem rede usa o último) e
`owbuddy_noticias_abertas_v1` (últimas 40 matérias abertas — abrem offline).

## `GET /api/buddy/vagas`

Cache 1 h. `{ vagas: [{ id, titulo, empresa, local, offshore_onshore, resumo,
application_url, verificado_em, escala, closing_date }], updated_at }`.
O app exige `id`, `titulo`, `empresa`. `application_url` só abre se for http(s).

## `GET /api/buddy/unidades` — Radar de unidades

Cache 1 h. `{ unidades: [{ slug, nome, tipo, tipo_label, codigo_petrobras,
codigo_confianca, owner, contratante, status_brasil, campo, sobre, image_url,
image_credit, image_status: "real"|"fallback", fleet_status_fonte, url }],
schema_version: 1, total, updated_at }`.

## `GET /api/buddy/aeroportos`

Cache 60 s. Proxy do collector (REDEMET). `{ aeroportos: [{ codigo, nome, cidade,
uf, status: "g"|"y"|"r"|null, temperatura, icone, tempo, horarioUTC }], fetched_at }`.

- `horarioUTC` vem como `"17:00 UTC"` (sem data). O app mostra em Brasília
  (UTC−3) e nunca apresenta dado salvo como atual (mostra "dados salvos às …").
- Não há METAR/TAF bruto nem status de voo. **Não inventar.**
- Em erro o endpoint devolve 200 com `aeroportos: []` — o app trata lista vazia
  como falha e usa o cache.

## Conta OW (Supabase Auth)

Projeto `awyowuhwkqfyhwgdpepp.supabase.co`, **chave publicável** (`sb_publishable_…`,
a mesma que está no HTML do site; nunca `service_role`). Fluxos: `signInWithPassword`,
`signUp`, `resetPasswordForEmail` (a troca de senha acontece na web),
`updateUser({ data })` para o sync. Detalhes em `OWBUDDY-1.0-HANDOFF.md` § Sync.

## Endpoints externos (sem conta, sem chave)

- Clima da Home: `api.open-meteo.com/v1/forecast` (lat/lon da cidade escolhida).
- Busca de cidade: `geocoding-api.open-meteo.com/v1/search`.
