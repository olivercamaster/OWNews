# OWBuddy — Arquitetura de Sincronização

**Status:** Auditado. DDL pendente. Implementação local funcional.

---

## Estado atual (2026-10-05)

| Dado | Onde está | Sync status |
|------|-----------|-------------|
| Escala | localStorage (web) + AsyncStorage (app) | ❌ Não sincroniza |
| Certificados | localStorage + Supabase user_metadata | ✅ Sincroniza (web) |
| Checklist | localStorage apenas | ❌ Não sincroniza |
| Viagem | localStorage + AsyncStorage | ❌ Não sincroniza |
| Buddy prefs | localStorage + AsyncStorage | ❌ Não sincroniza |
| Artigos salvos | localStorage + Supabase user_metadata | ✅ Sincroniza (web) |

---

## Design alvo: Web ↔ App via Supabase

```
OWNews (web, localStorage)
  ↕ (ao login / ao salvar)
Supabase user_metadata
  ↕ (ao login / ao sync)
OWBuddy (app, AsyncStorage)
```

**Política de merge:** `updated_at` mais recente vence.  
Para arrays (certificados, checklist items): merge por `id`, com `updated_at` de cada item.

---

## O que pode usar `user_metadata` agora (sem DDL)

Supabase `user_metadata` é um JSON livre — qualquer campo pode ser adicionado sem migration.

| Campo | Pode ir para user_metadata? | Notas |
|-------|---------------------------|-------|
| `escala_config` | ✅ Já vai (web) | Reutilizar |
| `certificados` | ✅ Já vai (web) | Reutilizar |
| `checklist_mala` | ✅ Pode ir | Adicionar ao PUT |
| `minha_viagem` | ✅ Pode ir | **Não incluir**: localizador, obs, assento — campos sensíveis |
| `buddy_prefs` | ✅ Pode ir | Exceto apelido (opcional — deixar para o usuário decidir) |

---

## O que precisaria de tabela dedicada (DDL)

> **NÃO executar sem autorização explícita.**

```sql
-- Proposta: tabela para histórico de viagens
CREATE TABLE user_trips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,
  data        DATE NOT NULL,
  hora        TEXT,
  origem      TEXT,
  destino     TEXT,
  empresa     TEXT,
  num_voo     TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  -- Campos sensíveis NUNCA no banco: localizador, obs, assento
  CONSTRAINT valid_tipo CHECK (tipo IN ('AVIAO','ONIBUS','CARRO','VAN','EMPRESA','OUTRO'))
);
```

**Por que não user_metadata:** viagens históricas acumulariam, o JSON ficaria grande.  
**Para v0.1:** viagem vai em user_metadata (apenas a viagem atual, sem histórico).

---

## Implementação recomendada v0.1 (sem DDL)

No app, ao fazer login:
1. `GET /auth/v1/user` → pegar `user_metadata`
2. Merge escala, certs, checklist, viagem, buddy_prefs por `updated_at`
3. Salvar o mais recente em AsyncStorage
4. Ao salvar qualquer dado localmente: `PUT /auth/v1/user` com `user_metadata` atualizado

**Campos a excluir do sync:**
- `localizador` (código de reserva)
- `obs` (observações pessoais)  
- `assento`/`poltrona`
- `apelido` do Buddy (o usuário pode preferir não sincronizar)

---

## Dependências para ativar sync no app

1. Supabase JS SDK instalado no owbuddy (`@supabase/supabase-js`)
2. `SUPABASE_URL` e `SUPABASE_ANON_KEY` em variáveis de ambiente (não no bundle — usar Expo Config)
3. Auth flow: login por email/magic link (mesmo sistema do OWNews)
4. Nenhum DDL necessário para v0.1

**Bloqueio atual:** credencial Supabase não está configurada no app. Implementar em Missão 004.
