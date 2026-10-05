# OWBuddy — Preparação de Lançamento nas Lojas

**Status:** Estrutura preparada. NÃO publicado. NÃO há conta de desenvolvedor.

---

## Identidade do App

| Campo | Valor |
|-------|-------|
| Nome | OWBuddy |
| Tagline | Seu parceiro na vida offshore. |
| Categoria | Produtividade / Lifestyle |
| Android package | `br.com.ownews.owbuddy` |
| iOS bundle ID | `br.com.ownews.owbuddy` |
| Versão | 0.1.0 |
| Build number | 1 |

---

## Assets necessários para publicação

| Asset | Status | Requisito |
|-------|--------|-----------|
| Ícone do app (1024×1024) | ❌ Pendente | PNG, sem transparência |
| Adaptive icon (Android) | ❌ Pendente | Foreground + Background |
| Splash screen | ❌ Pendente | 1284×2778 (iOS) / vários (Android) |
| Screenshots Android | ❌ Pendente | Mín. 2 screenshots |
| Screenshots iOS | ❌ Pendente | 6.5" e 5.5" |
| Feature graphic | ❌ Pendente | 1024×500 (Google Play) |

---

## Permissões declaradas

| Permissão | Justificativa |
|-----------|---------------|
| `RECEIVE_BOOT_COMPLETED` | Alarmes de lembretes (futura push local) |
| `VIBRATE` | Feedback háptico |
| Push notifications | Alertas de embarque e certificados (futura integração) |

---

## Configurações de privacidade (iOS App Store)

- **Dados coletados:** Nenhum dado enviado a servidores por padrão
- **Dados armazenados localmente:** escala, mala, viagem, certificados, preferências
- **Sync opcional:** via login Supabase (mesma conta OWNews) — somente dados não sensíveis
- **Dados que nunca saem do dispositivo:** localizador, observações pessoais, assento, bilhete
- **Analytics:** eventos anônimos de uso (sem conteúdo pessoal)

---

## Processo para publicação (custo)

### Google Play
1. Criar conta Google Play Developer: **US$ 25 (único)**
2. Gerar APK/AAB assinado: `eas build --platform android --profile production`
3. Assinar com keystore (gerado pelo EAS, guardar cópia segura)
4. Upload no Google Play Console

### Apple App Store
1. Criar conta Apple Developer: **US$ 99/ano**
2. Gerar IPA: `eas build --platform ios --profile production`
3. Upload via Transporter ou EAS Submit

**Total para lançamento inicial:** ~US$ 124 (US$ 25 + US$ 99)

---

## EAS Build (Expo Application Services)

**Tier gratuito:** 30 builds/mês para projetos Expo (suficiente para desenvolvimento).

```bash
# Setup inicial (requer conta Expo - grátis)
npx eas-cli@latest login
npx eas-cli@latest build:configure

# Build de desenvolvimento (para testes)
npx eas-cli@latest build --platform android --profile development

# Build de produção
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

**Arquivo de configuração:** criar `eas.json` em `apps/owbuddy/` antes de usar EAS.

---

## Descrição para as lojas (rascunho)

**Curta (80 chars):**  
`Escala, mala e viagem do trabalhador offshore — tudo em um lugar.`

**Longa:**  
OWBuddy é o companheiro do trabalhador offshore na vida fora e dentro da plataforma.

Configure sua escala 14x14, 14x21 ou personalizada e saiba exatamente quantos dias faltam para embarcar ou desembarcar.

Organize sua mala de embarque com a checklist inteligente — o OWBuddy lembra o que você esqueceu na última vez.

Registre sua viagem de embarque com todos os detalhes: voo, companhia, localizador e assento. Tudo fica só no seu dispositivo.

Acompanhe a validade dos seus certificados offshore e receba alertas antes de embarcar com documento vencido.

O OWBuddy fala do seu jeito. Configure o tom — Discreto, Buddy ou Resenha — e o tratamento que você prefere.

Conecte com o OWNews para sincronizar seus dados em todos os dispositivos.

---

## Pendências antes de publicar

- [ ] Logo/ícone definitivo do OWBuddy
- [ ] Screenshots do app real
- [ ] Conta Google Play Developer
- [ ] Conta Apple Developer
- [ ] Política de privacidade hospedada (URL pública)
- [ ] Auth integrado no app (login Supabase)
- [ ] Push notifications implementadas
- [ ] Testes em dispositivo físico Android e iOS
