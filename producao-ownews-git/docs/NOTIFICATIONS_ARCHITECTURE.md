# OWNews — Notifications Architecture

**Status:** Design document. Não implementado (aguarda decisão de negócio).
**Custo estimado:** Zero (Web Push é free; VAPID keys geradas localmente).

---

## Tecnologia: Web Push + VAPID

Web Push é suportado em Chrome (Android/Desktop), Firefox, Edge, Safari 16.4+. Não requer app nativo. Funciona como PWA installable.

### Como funciona

```
1. Usuário instala PWA (ou apenas aceita notificações no browser)
2. Browser registra ServiceWorker (/sw.js)
3. SW solicita permissão de push: navigator.serviceWorker.ready
       .then(reg => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY }))
4. Subscription (endpoint + keys) enviada para /api/push/subscribe
5. Worker armazena subscription em KV (PERGUNTE_IA_KV ou novo namespace)
6. Worker envia push via Web Push Protocol quando evento ocorre
7. SW recebe 'push' event e exibe notificação
```

---

## Eventos → Notificações

| Evento | Canal | Timing | Copy |
|--------|-------|--------|------|
| Cert vence em 30 dias | Web Push | 30 dias antes | "⚠ [Nome cert] vence em 30 dias. Renove antes de embarcar." |
| Cert vence em 7 dias | Web Push | 7 dias antes | "🚨 [Nome cert] vence em 7 dias. Ação urgente." |
| Embarque em 3 dias | Web Push | 3 dias antes | "⏱ Você embarca em 3 dias. Mala: X/Y preparados." |
| Embarque amanhã | Web Push | 1 dia antes | "📦 Embarque amanhã! Verifique sua mala." |

---

## API Contracts (a implementar)

### POST /api/push/subscribe
```json
{
  "subscription": { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } },
  "userId": "supabase-user-id ou null",
  "deviceId": "uuid-gerado-no-cliente"
}
```
Resposta: `{ "ok": true }`

### POST /api/push/send (interno, triggered por cron)
```json
{
  "event": "cert_vencendo_30d",
  "userId": "...",
  "data": { "certNome": "CBSP", "diasRestantes": 30 }
}
```

### DELETE /api/push/unsubscribe
```json
{ "endpoint": "..." }
```

---

## Storage

Subscriptions em Workers KV:
- Key: `push:sub:{deviceId}` → JSON subscription
- Key: `push:user:{userId}` → `[ deviceId, ... ]`
- Key: `push:cert-alert:{userId}:{certId}:{diasRestantes}` → timestamp do último envio (dedup)

---

## VAPID Keys

Geradas uma vez com `web-push generate-vapid-keys` e armazenadas como Worker Secrets:
- `VAPID_PUBLIC_KEY` (exposível ao cliente)
- `VAPID_PRIVATE_KEY` (nunca expor)
- `VAPID_SUBJECT` (`mailto:ownews@ownews.com.br`)

---

## Cron Trigger

```toml
# wrangler.toml
[[triggers.crons]]
cron = "0 9 * * *"  # 09:00 UTC diariamente
```

Handler verifica subscriptions ativas e envia notificações pendentes.

---

## Decisão de negócio necessária antes de implementar

1. Criar novo KV namespace para subscriptions? (proposto: `PUSH_SUBSCRIPTIONS_KV`)
2. Email VAPID subject?
3. Copy final das notificações (PT-BR, voz OWNews)
4. Opt-in explícito ou silencioso?

**NÃO implementar sem autorização** — envolve armazenar dados de usuário adicionais.
