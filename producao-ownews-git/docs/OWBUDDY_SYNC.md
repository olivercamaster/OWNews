# OWBuddy — Sincronização com a conta OW

**Status (2026-10-05, checkpoint de arquitetura):** regras de reconciliação implementadas e testadas
(`packages/ow-domain/src/sync-merge.ts`, `apps/owbuddy/src/sync.ts`); **nenhuma tela do app chama sync ainda**.
Sem DDL. Regra-mãe e matrizes em `docs/OW_PLATAFORMA.md`.

---

## Estado real (lido do código)

| Dado | Web | App | Chave em `user_metadata` | Sync hoje |
|------|-----|-----|---------------------------|-----------|
| Escala | `localStorage ownews_minha_escala` | AsyncStorage `ownews_minha_escala` (envelope v2) | `escala_config` (web grava; app preparado) | ✅ web ↔ conta · ⏳ app (código pronto, não ligado) |
| Certificados | `ownews_certificados` | idem | `certificados` | ✅ web ↔ conta · ⏳ app |
| Cruzar / datas pessoais | `ownews_cruzar_v2`, `…_datas_pessoais` | idem | `cruzar_config`, `datas_pessoais_config` | ✅ web · ❌ app (FUTURO) |
| Checklist | `ownews_checklist_mala` | idem | `ownews_checklist_mala` (só app) | ❌ web · ⏳ app |
| Viagem | `ownews_minha_viagem` | idem | `ownews_minha_viagem` sem campos sensíveis (só app) | ❌ web · ⏳ app |
| Buddy prefs | `ownews_buddy_prefs` | idem | `ownews_buddy_prefs` (só app) | ❌ web · ⏳ app |
| Artigos salvos | `ownews_noticias_salvas` | — | — | ✅ web (local) · ❌ app |

> O erro da versão anterior deste documento ("Escala ❌ não sincroniza") está corrigido: o web sincroniza a escala
> via `escala_config` desde o OW Hub (`salvarEscalaNoMeta`, painel de conflito `escalasSaoDiferentes`).

---

## Dialeto único (o app fala o do web)

```
escala_config  = { ...toWebEscalaConfig(cfg), salvo_em }   // tipo web: 14x14|14x21|14x28|personalizada, data:'YYYY-MM-DD'
certificados   = [{ id, nome, validade, emissao, instituicao, obs, updated_at, _deleted }]
```

Leitura (pull) aceita também as chaves legadas `ownews_minha_escala` ({data, updated_at}) e `ownews_certificados`.
Escrita (push) grava `escala_config` **só** quando `podeGravarEscalaNaNuvem(local, nuvem)` — o carimbo local é
pelo menos tão novo quanto `salvo_em` da nuvem. `ownews_minha_escala` continua sendo gravada por compatibilidade
com builds antigos do app; deixa de ser gravada quando não houver mais builds < 0.1.5 em uso.

## Política de conflito (única, sem improviso)

| Dado | Regra |
|------|-------|
| Escala | carimbo mais novo vence (`salvo_em` / `updated_at`); empate → web; app nunca sobrescreve nuvem mais nova |
| Certificados | merge por `id`; `updated_at` mais novo vence; `_deleted` é tombstone e propaga; sem carimbo nos dois → local vence |
| Checklist | nuvem só entra se o dispositivo não tem checklist |
| Buddy prefs | `updated_at` mais novo vence |
| Viagem | só sobe sem `localizador`, `obs`, `assento`, `poltrona`; nunca desce por cima de viagem local |

Testes: `apps/owbuddy/tests/sync-merge.test.mjs` (10 casos, roda contra o domínio real).

---

## Para ligar o sync no app (Missão S4 — Conta OW)

1. Tela "Conta OW" opcional (nunca obrigatória): e-mail + senha (mesmo do OWNews) e OTP como alternativa.
2. Ao logar: `pullFromServer()` → mostrar o que veio e de onde (`origem: 'web' | 'buddy'`), sem sobrescrever
   silenciosamente nada mais novo.
3. Ao salvar escala/certificado com sessão ativa: `pushToServer()` (debounce), falha silenciosa offline, fila
   simples "pendente de envio".
4. Sessão em `SecureStore` (adapter já existente em `src/supabase.ts`).
5. Nenhum DDL. `user_trips` (histórico de viagens) continua apenas proposta — **não executar**.

## Campos que NUNCA saem do dispositivo
`localizador`, `obs`, `assento`, `poltrona` da viagem; `apelido` do Buddy só com opt-in.
