# OWBuddy — Product Specification

**Status:** Nome de trabalho provisório. NÃO embedar em infra/branding público.
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

### P0 (já implementado 2026-10-04)
- [x] Cert CSS fix em paginaChrome
- [x] Estados VÁLIDO / PRÓXIMO / VENCE HOJE / VENCIDO com "Atualizar →"
- [x] Checklist de Embarque com ciclo automático
- [x] Central checklist strip (embarque ≤7 dias)
- [x] PWA: manifest com icons, SW básico, shortcuts

### P1 (próxima iteração)
- [ ] Notificações Web Push (VAPID) para vencimento de cert
- [ ] Notificações Web Push para lembrete de embarque
- [ ] Checklist: categorias customizáveis
- [ ] Cert: upload de imagem (R2)

### P2 (após validação P1)
- [ ] Modo offline melhorado (cache de notícias recentes)
- [ ] Share de escala com parceiro (já tem: `/cross`)
- [ ] OWBuddy nome público (se validado pelo time)

---

## Constraints permanentes

- CUSTO ZERO: nenhum serviço pago novo sem autorização explícita
- NÃO reescrever Home, NÃO alterar Editorial Engine, NÃO tocar Instagram/Telegram
- NÃO DDL sem autorização
- NÃO nome OWBuddy em produção até decisão de branding
