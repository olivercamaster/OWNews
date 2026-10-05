# OWNews — App-Ready Architecture

**Status:** Fundação implementada (2026-10-04)
**Contexto:** Worker único Cloudflare (worker.js), zero backend adicional, zero custo.

---

## Princípios

- **Single-file deployment:** Todo o servidor em `worker.js` (~19k linhas). Sem microsserviços, sem banco relacional, sem infra adicional.
- **Client-side state first:** localStorage como camada primária. Supabase `user_metadata` como sync secundário (opcional, requer login).
- **Custo zero:** Cloudflare Workers free tier + Supabase free tier. Nenhum serviço pago novo.
- **Progressive enhancement:** Funciona sem conta, melhora com conta.

---

## Camadas

```
Browser (PWA)
  └── localStorage  ←→  Supabase user_metadata (sync opcional)
        │
        └── Service Worker (cache shell estático)

Cloudflare Worker (worker.js)
  ├── HTML rendering (SSR puro, zero framework)
  ├── /api/* endpoints (JSON, sem auth pesado)
  ├── Durable Objects: PresencaOnline, PageViews, PesquisaSalarial
  ├── KV: PERGUNTE_IA_KV (cache IA)
  └── Workers AI (perguntas contextuais)
```

---

## localStorage Keys

| Chave | Conteúdo |
|-------|----------|
| `ownews_minha_escala` | `{ data: { tipo, diasEmbarcado, diasFolga, dataRef, tipoRef } }` |
| `ownews_certificados` | `[ { id, nome, validade, emissao, instituicao, obs } ]` |
| `ownews_auth_sessao` | `{ access_token, user: { user_metadata: { nome, escala_config, certificados, funcao } } }` |
| `ownews_checklist_mala` | `{ items: [ { id, t, cat, ok } ], ciclo: "YYYY-MM-DD" }` |
| `ownews_minha_viagem` | `{ tipo, data, hora, empresa?, num_voo?, origem?, destino?, poltrona?, ponto?, obs?, updated_at }` |
| `ownews_buddy_prefs` | `{ tom: "discreto"\|"buddy"\|"resenha", trat: "neutro"\|"parceiro"\|"parceira", apelido: string, updated_at }` |

---

## PWA Foundation (implementada)

- **Manifest:** `/manifest.webmanifest` — name, icons (SVG 192+512), 3 shortcuts
- **Icons:** `/icons/icon-192.svg`, `/icons/icon-512.svg` — SVG, navy + azul
- **Service Worker:** `/sw.js` — cache-first para shell estático
  - **NUNCA cacheia:** `/api/`, `/auth/`, `/meu-ownews`, `/central-do-trabalhador`, `/meus-certificados`, `/checklist-embarque`, `/command-center`, `/minha-escala?`, `supabase`
  - Cache de shell (`/`, `/minha-escala`, `/manifest.webmanifest`)
- **Registro:** Em toda página via paginaChrome() e Home template

---

## CSS Architecture

Duas zonas CSS:

1. **Home template literal** (`const HTML = \`...\``, linha ~449) — CSS no `<style>` inline do HTML
2. **paginaChrome CSS string** (linha ~6368) — CSS em string JS com `\\n` como separador

**Regra:** Qualquer CSS usado em páginas não-Home (Central, Certificados, Checklist, etc.) DEVE estar em ambas as zonas, ou apenas em paginaChrome se nunca aparecer na Home.

---

## Rotas Principais

| Rota | Função | Auth |
|------|--------|------|
| `/` | Home (SSR editorial) | Pública |
| `/central-do-trabalhador` | Hub pessoal | Pública (localStorage) |
| `/meus-certificados` | Gerenciar certificados | Pública (localStorage) |
| `/checklist-embarque` | Checklist de mala | Pública (localStorage) |
| `/minha-escala` | Calculadora de escala | Pública |
| `/meu-ownews` | Login/sync Supabase | Auth opcional |
| `/command-center` | Painel editorial interno | Auth obrigatório |
| `/manifest.webmanifest` | PWA manifest | Pública |
| `/sw.js` | Service worker | Pública |
| `/icons/icon-*.svg` | PWA icons | Pública |

---

## Sync Architecture

```
localStorage  ──(ao salvar)──►  Supabase PUT /auth/v1/user
                                  (user_metadata merge)

Supabase  ──(ao carregar)──►  localStorage (se mais recente)
(merge por updated_at)
```

Merge policy: `updated_at` mais recente vence. Em caso de conflito de arrays (certificados), merge por `id` com `updated_at` de cada item.
