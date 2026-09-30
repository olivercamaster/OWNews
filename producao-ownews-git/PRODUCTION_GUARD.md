# PRODUCTION GUARD — OWNews

Smoke + regression test suite. Runs in ~10s (without HTTP), ~30s (with HTTP).

## Executar

```bash
# Tudo — main worker + collector + smoke + editorial + security
python3 tests/production_guard.py

# Antes de cada deploy (offline ok — não precisa de internet)
python3 tests/production_guard.py --pre-deploy

# Por módulo
python3 tests/production_guard.py --static     # syntax, JS final, funções críticas
python3 tests/production_guard.py --logic      # engine deterministico (main + collector)
python3 tests/production_guard.py --smoke      # HTTP routes (precisa de internet)
python3 tests/production_guard.py --editorial  # PT-BR language, performance
python3 tests/production_guard.py --security   # XSS, secrets
```

## O que testa (133 testes)

### Main worker (producao-ownews-git/worker.js)

| Módulo | Qtd | O que verifica |
|---|---|---|
| STATIC — Syntax | 2 | `node --check`, browser JS `new Function()` |
| STATIC — Functions | 2 | 14 funções críticas no worker.js; 12 IDs críticos |
| STATIC — Calendar | 5 | aba padrão, DOBRA/FÉRIAS/FERIADO texto completo, catch vazio, renderCruzarSecao após submit |
| STATIC — Content | 2 | strip class fix, cruzar section presente |
| LOGIC — Schedule | 12 | `calcularEscala` 14×14/21×21/28×28, fase negativa, ciclo, tipoRef |
| LOGIC — JUNTOS | 5 | mesmas escalas, escalas opostas, offset 7 dias, fronteira ano |
| LOGIC — DP | 6 | formato legado, período, fronteira mês/ano |
| LOGIC — Misc | 4 | sanitize XSS, proximaTransicao |
| LOGIC — Runner | 1 | `node logic_test.js` passa (39 subtestes) |
| SMOKE — Routes | 17 | status 200, tamanho mínimo, conteúdo esperado |
| SMOKE — API | 4 | `/api/cc/dados` 401, `/saude` 200 + campos |
| SMOKE — Agenda | 2 | eventos futuros presentes |
| SMOKE — 500s | 8 | nenhuma rota crítica devolve 5xx |
| EDITORIAL | 3 | PT-BR keywords, sem EN-only títulos, agenda em PT |
| PERFORMANCE | 3 | worker.js < 2MB, home < 500KB, minha-escala < 300KB |
| AEROPORTOS | 1 | conteúdo ICAO presente |
| SECURITY — XSS | 5 | payloads `<script>` não renderizados |
| SECURITY — Secrets | 2 | nenhuma credencial privada no HTML renderizado |

### Collector (shrill-pond-a915-fix/worker.js) — node collector_test.js

| Módulo | Qtd | O que verifica |
|---|---|---|
| METAR | 22 | CAVOK, vento normal/rajada/variável/calmo, vis, teto, chuva, trovoada, névoa, temp negativa, horário, campo ausente, entrada inválida, TAF, SPECI |
| Aeroportos | 7 | array e object format, status g/y/r/null/desconhecido |
| Frescor | 6 | ao_vivo/recente/indisponivel/sem_dados, stale detection, data inválida |
| Dedupe | 8 | Jaccard idêntico/similar/diferente, comportamento documentado |
| Idioma | 7 | PT com diacrítico, EN puro, termos técnicos offshore não bloqueiam |
| Classificador de risco | 12 | fatalidade, desaparecimento, vítimas, acusação, overrides seguro, fail-closed |

## Fixtures vs smoke

- **Fixtures (logic/collector)**: testes determinísticos de funções puras. Não precisam de rede. Rodam sempre, inclusive offline. Falha aqui = bug no nosso código.
- **Smoke (HTTP)**: chama URLs reais. Podem falhar por instabilidade de rede ou fonte externa temporariamente indisponível. Falha aqui não necessariamente bloqueia deploy — investigar antes de decidir.

**Regra**: só bloqueia deploy automático se `--pre-deploy` falhar (static + logic, sem HTTP).

## Críticos (falha = não deploy)

- `node --check worker.js` — syntax error = deploy quebrado
- `new Function()` no browser JS — JS inválido = tela em branco para o usuário
- 14 funções críticas presentes (`calcularEscala`, `renderMinhaEscala`, `renderCruzarSecao`...)
- Nenhum Telegram token no worker.js (`\d{8,10}:[A-Za-z0-9_-]{35,}`)
- `/saude` retorna `{"ok":true,...}`
- `node logic_test.js` 39/39 — engine de escala deterministico
- `node collector_test.js` 63/63 — METAR, dedupe, idioma, risco

## O que fazer se falhar

| Falha | Ação |
|---|---|
| `node --check` | Syntax error no worker.js — NÃO DEPLOY. Checar último `git diff` |
| `new Function()` | Browser JS quebrado — NÃO DEPLOY. Checar aspas/escape na string concat |
| Função crítica ausente | Regressão de refactor — verificar se foi renomeada ou apagada por acidente |
| METAR test falhou | Alguém modificou `interpretarMetar` de forma incompatível — revisar a mudança |
| Dedupe test falhou | `similaridadeTitulos` ou limiar alterado — revisar impacto editorial |
| Risco test falhou | Classifier alterado — testar manualmente com fixtures antes de deploy |
| Smoke 404 | Rota removida — verificar se foi intencional, update no teste se sim |
| Smoke falhou (externo) | Pode ser fonte temporariamente indisponível — não bloquear deploy por isso |
| Secret no HTML | CRÍTICO — rollback imediato, investigar origem |
| Performance > limite | worker.js cresceu demais — auditar o que foi adicionado |

## Rollback

```bash
# Version IDs listados no memory project_minha_escala_status.md
# Último Version ID estável: 7fddf551
cd producao-ownews-git
/home/offshore/.config/ownews/with-cf-token.sh npx wrangler deployments list
/home/offshore/.config/ownews/with-cf-token.sh npx wrangler rollback <version-id>
```

## Pre-deploy checklist manual

1. `python3 tests/production_guard.py --pre-deploy` → 0 falhas (static + logic, offline)
2. `git diff HEAD~1 -- worker.js | wc -l` — mudança proporcional ao que foi editado?
3. Nenhum token/credencial na diff
4. `node --check worker.js` separado como sanity check

## Arquitetura do collector (shrill-pond-a915-fix)

O collector é um Cloudflare Worker separado com:
- **20 fontes**: ANP, Petrobras, PPSA, EPE, MME, Marinha, ANTAQ, IBAMA, PetroNotícias, Agência Brasil, Sindipetro NF, FUP, Eixos, Notícias Macaé, Portos e Navios, MegaWhat, Offshore Energy, Marine Technology News, Transocean, SBM Offshore
- **EditorialPoller** (Durable Object): rotação A/B/C/D/E a cada hora
- **TelegramAgendadorPoller** (Durable Object): boletim automático com condições meteorológicas
- **METAR via REDEMET**: `interpretarMetar()` — parse puro sem chamadas LLM
- **Dedupe Jaccard**: `similaridadeTitulos()` com limiar 0.55
- **Idioma**: `detectarIdiomaEN()` → tradução via @cf/meta/m2m100-1.2b (sem custo adicional — Cloudflare Workers AI free tier)
- **Classifier de risco**: `classificarRiscoEditorial()` — determinístico, fail-closed

**Limitação conhecida do Jaccard (documentada em collector_test.js)**: títulos com mesmo fato mas ordem de palavras invertida podem ter score=0.5 (abaixo do limiar 0.55), resultando em duas publicações do mesmo evento. Isso é a limitação atual do algoritmo, não um bug a corrigir agora.
