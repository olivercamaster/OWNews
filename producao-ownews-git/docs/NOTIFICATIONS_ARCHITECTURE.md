# OWNews — Central de Alertas 1.0

**Status:** Implementado (2026-10-04). Deploy pendente.
**Custo adicional:** Zero. Usa PERGUNTE_IA_KV existente com prefixo `push:`.

---

## Stack

- **Web Push Protocol** (RFC 8291) — sem biblioteca externa, WebCrypto puro
- **VAPID ES256** — autenticação JWT assinada com P-256 via WebCrypto
- **Criptografia:** aes128gcm + HKDF-SHA256
- **Storage:** PERGUNTE_IA_KV (prefix `push:`)
- **Scheduler:** `ctx.waitUntil` em `/central-do-trabalhador` (sem cron triggers)

---

## Tipos de alerta

| Tipo | Disparadores | Dedup |
|------|-------------|-------|
| Embarque | 3 dias, 1 dia, 0 dias | 8 dias por threshold |
| Certificados | 30 dias, 7 dias, 1 dia, 0 dias | 8 dias por cert+threshold |
| Checklist | Pendente no embarque (count only) | 8 dias |

---

## VAPID Keys

- `VAPID_PUBLIC_KEY` — CF Worker Secret (exposta ao cliente via HTML/endpoint)
- `VAPID_PRIVATE_KEY` — CF Worker Secret (**NUNCA no código, git, HTML, relatório**)
- Subject: `mailto:ownews@ownews.com.br`

---

## KV Key Structure (PERGUNTE_IA_KV)

| Key | Valor | TTL |
|-----|-------|-----|
| `push:sub:{deviceId}` | `{endpoint, keys, userId, device_id, created_at}` | 60 dias |
| `push:user:{userId}` | `[deviceId, ...]` | 60 dias |
| `push:prefs:{deviceId}` | `{embarque, checklist, certificados, checklist_pending, certs, escala, updated_at}` | 90 dias |
| `push:dedup:{deviceId}:{key}` | `'1'` | 8 dias |
| `push:sched:last_run` | timestamp ms | sem TTL |

---

## API Endpoints

| Endpoint | Método | Auth | Descrição |
|----------|--------|------|-----------|
| `/api/push/vapid-public-key` | GET | — | Retorna a chave pública VAPID |
| `/api/push/subscribe` | POST | — | Registra subscription + prefs + dados |
| `/api/push/unsubscribe` | DELETE | — | Remove subscription e prefs |
| `/api/push/preferences` | POST | — | Atualiza prefs + dados de cert/escala |
| `/api/push/test` | POST | — | Envia push de teste ao deviceId |
| `/api/push/stats` | GET | CC | Contagem e last_run (sem PII) |

### POST /api/push/subscribe
```json
{
  "subscription": { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } },
  "deviceId": "dev-xxx",
  "userId": "supabase-uid-ou-null",
  "prefs": { "embarque": true, "checklist": true, "certificados": true },
  "certs": [{ "id": "...", "nome": "CBSP", "validade": "2027-03-15" }],
  "escala": { "data": { "tipo": "14x14", "dataRef": "2026-01-01", ... } }
}
```

### POST /api/push/preferences
```json
{
  "deviceId": "dev-xxx",
  "prefs": { "embarque": true, "checklist": false, "certificados": true },
  "certs": [...],
  "escala": {...}
}
```

---

## Scheduler

Disparado via `ctx.waitUntil(maybeTriggerPushScheduler(env, ctx))` na rota `/central-do-trabalhador`.

- `PUSH_SCHED_TTL = 20h` — executa no máximo uma vez a cada 20 horas
- Lista todos `push:sub:*` do KV e processa cada dispositivo
- Deduplicação por `push:dedup:{deviceId}:{tag}` (TTL 8 dias)
- Expiry handling: 404/410 do push endpoint → deleta a subscription

---

## Privacy

- Checklist: apenas `checklist_pending` (contagem inteira) armazenado — texto dos itens nunca enviado ao servidor
- Dados de cert/escala: sincronizados a cada visita a `/meus-alertas` (mesmos dados já em Supabase user_metadata)
- Sem PII nos endpoints de observabilidade (CC)
- deviceId gerado pelo cliente, sem vínculo obrigatório com userId

---

## Páginas

- `/meus-alertas` — opt-in explícito, gerenciamento de tipos, teste
- `/central-do-trabalhador` — pill ALERTAS com estado (ATIVO/CONFIGURAR/BLOQUEADO)
- `/command-center` — aba PUSH com total de dispositivos e last_run

---

## Decisões de implementação

- **Sem cron trigger** — wrangler.jsonc proibe `triggers.crons`; scheduler usa waitUntil lazy
- **KV existente** — sem custo adicional de novo namespace
- **Opt-in explícito** — `Notification.requestPermission()` NUNCA chamado automaticamente
- **Sem biblioteca npm** — WebCrypto puro em worker.js (single-file)
