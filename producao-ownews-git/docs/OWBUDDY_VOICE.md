# OWBuddy Voice 2.0

**Status:** Implementado (2026-10-05). Corrige problema de concatenação apelido+vocativo.

---

## Problema resolvido

**Antes (Missão 002):**
```
"Oliver, Hey, Buddy! Faltam 2 dias pro embarque."
```
O código concatenava apelido + vocativo + template, gerando abertura dupla artificial.

**Depois (Missão 003):**
```
"Oliver, Faltam 2 dias pro embarque. Bora conferir a mala?"
"Hey! Faltam 2 dias pro embarque."
"Brother, tá chegando a hora."
```
O compositor escolhe UMA abertura — nunca combina apelido + vocativo.

---

## Arquitetura do Compositor

```typescript
function composeOpener(prefs: BuddyPrefs, seed: number): string
// Retorna: apelido, OU vocativo, OU vazio — nunca os dois

function gerarMensagem(prefs, evento, ctx, seed): string
// Abre com opener + pick(templates[tom][evento])
```

### Regras do opener

| Tom | Com apelido | Sem apelido |
|-----|-------------|-------------|
| DISCRETO | `"Oliver,"` | `""` |
| BUDDY | `"Oliver,"` ou `"Hey!"` ou `""` (pick) | `"Hey, Buddy!"` ou `"Ei,"` |
| RESENHA | `"Oliver,"` ou `""` (pick) | `"Amigão,"` / `"Amiga,"` / `"Brother,"` |

**Invariante:** nunca produz `"Oliver, Hey, Buddy!"` nem `"Hey, Buddy! Oliver,"`.

---

## Tons

| Tom | Característica | Exemplo |
|-----|----------------|---------|
| DISCRETO | Direto ao ponto, sem floreio | `"Embarque em 2 dias."` |
| BUDDY | Próximo, animado, informal | `"Faltam 2 dias pro embarque. Bora conferir a mala?"` |
| RESENHA | Descontraído, gíria leve | `"Tá chegando a hora. 2 dias pro embarque."` |

---

## Tratamentos

| Tratamento | Vocativos (BUDDY) | Vocativos (RESENHA) |
|------------|-------------------|---------------------|
| NEUTRO | `Hey!`, `""` | `Então...`, `""` |
| PARCEIRO | `Hey, Buddy!`, `Ei,` | `Amigão,`, `Brother,`, `Cara,` |
| PARCEIRA | `Hey, Buddy!`, `Ei,` | `Amiga,`, `Mana,` |

O usuário escolhe tratamento. O sistema **nunca infere gênero** por nome ou comportamento.

---

## Variedade determinística

O mesmo evento pode produzir mensagens diferentes em dias diferentes:
- `seed = dia_do_mes + mes * 31` (muda a cada dia)
- Pick determinístico: `arr[seed % arr.length]`
- Resultado: variedade sem API de IA, custo zero, mensagem estável dentro do mesmo dia

---

## Eventos suportados

| Evento | Contexto |
|--------|----------|
| `folga_distante` | FOLGA com embarque > 5 dias |
| `embarque_distante` | Embarque em 3–5 dias |
| `embarque_proximo` | Embarque em 1–2 dias |
| `vespera_embarque` | Embarque amanhã |
| `embarcado` | No trabalho |
| `desembarque_proximo` | Desembarque em 1–2 dias |
| `viagem_amanha` | Viagem cadastrada para amanhã |
| `mala_incompleta` | Items pendentes na mala |
| `cert_vencendo` | Certificado crítico |

---

## Privacidade

**Nunca incluir em mensagem:** localizador, número de bilhete, assento, observações, documentos.  
**Apelido:** usado ocasionalmente (não em toda mensagem). Armazenado localmente. Opcional.  
**Analytics:** evento genérico apenas (`buddy_voice_shown`), sem conteúdo da mensagem.
