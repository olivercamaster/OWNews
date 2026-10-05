# OWBuddy — Product Specification

**Status:** App v0.1.0 criado (2026-10-05). Marca ativa. Build web validado. Android/iOS via EAS Build.
**Definição:** Camada de produto "app-like" sobre o OWNews, sem app nativo.

---

## Problema que resolve

O trabalhador offshore tem ferramentas fragmentadas: escala em papel/planilha, certificados em gaveta, alertas por WhatsApp (unreliable). OWBuddy seria a camada de produto que conecta escala ↔ certificados ↔ checklist ↔ notificações em uma experiência unificada.

---

## Produtos ativos (já existem)

| Produto | URL | Persistência |
|---------|-----|--------------|
| Minha Escala | `/minha-escala` | localStorage + Supabase |
| Meus Certificados | `/meus-certificados` | localStorage + Supabase |
| Checklist de Embarque | `/checklist-embarque` | localStorage |
| Central do Trabalhador | `/central-do-trabalhador` | Hub (agrega os acima) |

---

## Integrações entre produtos

### Escala ↔ Certificados
- Insight "Vence enquanto você está embarcado" — ativo
- Alerta strip na Central quando cert vence em ≤90 dias — ativo

### Escala ↔ Checklist
- Ciclo do checklist reseta automático por data de embarque — ativo
- Strip "MALA · X/Y preparados" aparece quando embarque ≤7 dias — ativo

### Futuro: Escala ↔ Notificações
- Web Push quando embarque ≤3 dias: "Sua mala está X% preparada"
- Web Push quando cert vence em ≤30 dias: "Renove [nome] antes de embarcar"
- Arquitetura: ver `docs/NOTIFICATIONS_ARCHITECTURE.md`

---

## Roadmap de produto (priorizados)

### P0 (implementado)
- [x] Cert CSS fix em paginaChrome
- [x] Estados VÁLIDO / PRÓXIMO / VENCE HOJE / VENCIDO com "Atualizar →"
- [x] Checklist de Embarque com ciclo automático
- [x] Central checklist strip (embarque ≤7 dias)
- [x] PWA: manifest com icons, SW básico, shortcuts
- [x] OW Hub → OWBuddy: renomeação pública completa (2026-10-05)
- [x] OWBuddy pre-launch strip na Central do Trabalhador
- [x] Tela Hoje no /meu-ownews (motor contextual)
- [x] Minha Viagem: localStorage + UI completa (AVIAO/ONIBUS/CARRO/VAN/EMPRESA/OUTRO)
- [x] Buddy Voice: preferências de tom/tratamento/apelido + live preview
- [x] Motor contextual: FOLGA/EMBARQUE_PROXIMO/EMBARCADO/DESEMBARQUE_PROXIMO/etc.

### P1 (próxima iteração)
- [ ] Notificações Web Push (VAPID) para vencimento de cert
- [ ] Notificações Web Push para lembrete de embarque (usando Buddy Voice)
- [ ] Checklist: categorias customizáveis
- [ ] Cert: upload de imagem (R2)
- [ ] Minha Viagem → sincronizar em Supabase user_metadata (mesma pattern de escala/certs)

### P0 (implementado — Missão 003)
- [x] App React Native + Expo v0.1.0 criado
- [x] Core compartilhado: `packages/ow-domain` (escala, buddy-voice, certs, viagem, checklist)
- [x] Buddy Voice 2.0: compositor que nunca concatena apelido + vocativo
- [x] Tela Hoje: motor contextual, mensagem, cards, viagem, mala, certs alertas
- [x] Minha Mala: lista, toggle, add, reset por ciclo
- [x] Minha Viagem: 6 tipos, localizador implementado, campos por tipo
- [x] Certificados: CRUD, status VÁLIDO/ATENÇÃO/VENCE HOJE/VENCIDO
- [x] Escala config: todos os tipos preset + custom
- [x] Buddy Config: tom, tratamento, apelido, preview ao vivo
- [x] Build web gerado (dist/ 1.2MB, 797 módulos)
- [x] 32/32 testes do ow-domain passando
- [x] TypeScript: zero erros
- [x] Docs: OWBUDDY_ARCHITECTURE.md, OWBUDDY_SYNC.md, OWBUDDY_VOICE.md, OWBUDDY_STORE_RELEASE.md

### P1 (próxima iteração)
- [ ] Auth Supabase no app (login por magic link)
- [ ] Sync via user_metadata (escala, certs, checklist, viagem, buddy prefs)
- [ ] Notificações Web Push com Buddy Voice
- [ ] EAS Build: APK Android de desenvolvimento
- [ ] Logo/ícone definitivo

### P2 (após validação P1)
- [ ] Modo offline melhorado (cache de notícias recentes)
- [ ] Share de escala com parceiro (já tem: `/cross`)
- [ ] Publicação Google Play + App Store

---

## Constraints permanentes

- CUSTO ZERO: nenhum serviço pago novo sem autorização explícita
- NÃO reescrever Home, NÃO alterar Editorial Engine, NÃO tocar Instagram/Telegram
- NÃO DDL sem autorização
- NÃO nome OWBuddy em produção até decisão de branding
