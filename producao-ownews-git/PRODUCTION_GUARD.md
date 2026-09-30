# PRODUCTION GUARD — OWNews

Smoke + regression test suite. Runs in ~10s (without HTTP), ~30s (with HTTP).

## Executar

```bash
# Tudo — static + logic + smoke + editorial + security
python3 tests/production_guard.py

# Antes de cada deploy (offline ok)
python3 tests/production_guard.py --pre-deploy

# Por módulo
python3 tests/production_guard.py --static     # syntax, JS final, funções críticas
python3 tests/production_guard.py --logic      # engine deterministico (node logic_test.js)
python3 tests/production_guard.py --smoke      # HTTP routes (precisa de internet)
python3 tests/production_guard.py --editorial  # PT-BR language, performance
python3 tests/production_guard.py --security   # XSS, secrets
```

## O que testa (70 testes)

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

## Críticos (falha = não deploy)

- `node --check worker.js` — syntax error = deploy quebrado
- `new Function()` no browser JS — JS inválido = tela em branco para o usuário
- 14 funções críticas presentes (ex: `calcularEscala`, `renderMinhaEscala`, `renderCruzarSecao`)
- Nenhum Telegram token no worker.js (`\d{8,10}:[A-Za-z0-9_-]{35,}`)
- `/saude` retorna `{"ok":true,...}`

## O que fazer se falhar

| Falha | Ação |
|---|---|
| `node --check` | Erro de syntax no worker.js — NÃO DEPLOY. Checar último `git diff` |
| `new Function()` | Browser JS quebrado — NÃO DEPLOY. Checar aspas/escape na string concat |
| Função crítica ausente | Regressão de refactor — verificar se foi renomeada ou apagada por acidente |
| Smoke 404 | Rota removida — verificar se foi intencional, update no teste se sim |
| Secret no HTML | CRÍTICO — rollback imediato, investigar origem |
| Performance > limite | worker.js cresceu demais — auditar o que foi adicionado |

## Rollback

```bash
# Version IDs em producao-ownews-git/worker.js header e no memory project_minha_escala_status.md
# Último Version ID estável: 7fddf551
npx wrangler deployments list  # lista Version IDs
npx wrangler rollback <version-id>
```

## Pre-deploy checklist manual

1. `python3 tests/production_guard.py --pre-deploy` → 0 falhas
2. `git diff HEAD~1 -- worker.js | wc -l` — mudança proporcional ao que foi editado?
3. Nenhum token/credencial na diff
4. `node --check worker.js` separado como sanity check
