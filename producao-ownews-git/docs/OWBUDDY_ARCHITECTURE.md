# OWBuddy — Arquitetura

**Status:** App v0.1.0 criado (2026-10-05). Build web validado.

---

## Stack Mobile Escolhida: React Native + Expo SDK 57

**Por que Expo:**
- TypeScript/JavaScript (mesmo idioma que worker.js OWNews)
- Android + iOS a partir de um único codebase
- Expo Router v4 para roteamento por arquivo
- EAS Build para APK/IPA sem Android Studio local
- Expo Go para teste rápido durante desenvolvimento
- Supabase JS SDK funciona nativamente
- Offline: AsyncStorage como camada primária
- Push: Expo Push Notifications (futura integração)
- Deep links: Expo Router cuida automaticamente

**applicationId Android:** `br.com.ownews.owbuddy`  
**bundleIdentifier iOS:** `br.com.ownews.owbuddy`

---

## Estrutura de Repositório

```
producao-ownews-git/
  packages/
    ow-domain/             ← Lógica compartilhada (TypeScript puro)
      src/
        types.ts           ← Todos os tipos compartilhados
        escala.ts          ← Motor canônico de escala
        buddy-voice.ts     ← Buddy Voice 2.0
        certs.ts           ← Regras de certificados
        viagem.ts          ← Tipos e helpers de viagem
        checklist.ts       ← Regras de checklist
        index.ts           ← Re-exports
      tests/
        escala.test.mjs
        buddy-voice.test.mjs
        certs.test.mjs
        checklist.test.mjs
  apps/
    owbuddy/               ← App React Native / Expo
      app/
        _layout.tsx        ← Root layout (Stack)
        (tabs)/
          _layout.tsx      ← Tab navigator
          index.tsx        ← Tela Hoje
          mala.tsx         ← Minha Mala
          viagem.tsx       ← Minha Viagem
          certs.tsx        ← Certificados (Docs)
        buddy-config.tsx   ← Configuração Buddy (modal)
        escala-config.tsx  ← Configurar escala
      src/
        theme.ts           ← Design tokens (cores, spacing, tipografia)
        storage.ts         ← AsyncStorage helpers com chaves compatíveis
  producao-ownews-git/     ← OWNews (worker.js, sem alterações)
```

---

## Core Compartilhado (`packages/ow-domain`)

Regra: **funcionalidade pessoal nova → avaliar Web + OWBuddy simultaneamente.**

| Módulo | Conteúdo | Usado em |
|--------|----------|---------|
| `escala.ts` | `calcEscala`, `calcularMomento`, datas | Web + App |
| `buddy-voice.ts` | `gerarMensagem`, `gerarMensagemMomento` | Web + App |
| `certs.ts` | `calcCertStatus` | Web + App |
| `viagem.ts` | `TIPO_LABELS`, `getViagemRota` | Web + App |
| `checklist.ts` | `criarChecklistPadrao`, `toggleItem`, `contarPendentes` | Web + App |

---

## Identidade Visual

| Cor | Hex | Uso |
|-----|-----|-----|
| navy-950 | `#061c2b` | Background principal |
| navy-900 | `#08283a` | Background cards |
| navy-800 | `#0a2c40` | Background inputs |
| cyan | `#12a8ee` | Accent, CTA, wordmark |
| white | `#f7fafc` | Texto principal |
| muted | `#9eb5c5` | Texto secundário |
| green | `#22c55e` | Sucesso, embarcado |
| amber | `#f59e0b` | Atenção, embarque próximo |

**Logo:** Placeholder (wordmark "OWBuddy" em cyan). Asset definitivo pendente.

---

## Storage: Compatibilidade Web ↔ App

AsyncStorage usa as **mesmas chaves** do localStorage OWNews. Sync via Supabase user_metadata (futuro).

| Chave | Formato |
|-------|---------|
| `ownews_minha_escala` | `{ data: EscalaConfig }` |
| `ownews_certificados` | `Certificado[]` |
| `ownews_checklist_mala` | `ChecklistData` |
| `ownews_minha_viagem` | `Viagem` |
| `ownews_buddy_prefs` | `BuddyPrefs` |

---

## Build Real

| Target | Status | Comando |
|--------|--------|---------|
| Web (preview) | ✅ Gerado (`dist/`) | `npx expo export --platform web` |
| Android APK | ⚠ Requer EAS ou Android SDK | `eas build --platform android` |
| iOS IPA | ⚠ Requer macOS + EAS | `eas build --platform ios` |

**Para gerar APK de desenvolvimento:**
```bash
# Requer conta Expo (grátis) e EAS CLI
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile development
```

---

## Privacidade

**Nunca enviar a analytics:**
- apelido do usuário
- localizador/código de reserva
- conteúdo da mala
- observações pessoais
- documentos e bilhetes

**Eventos genéricos permitidos:** `trip_created`, `cert_added`, `checklist_toggled` (sem conteúdo)
