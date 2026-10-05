# Command Center — Origem e confiabilidade de cada métrica

**Auditoria 2026-10-05 (checkpoint de arquitetura).** Lido do código real (`worker.js`: `SCRIPT_VISITAS`,
`scriptRegistrarPageview`, `SCRIPT_PRESENCA`, `responderVisita`, `responderPageview`, `responderEvento`,
`class PageViews`, `ccMontarDados`/`resumoTexto`, `fmtPct`). Nada aqui é estimativa.

---

## 1. Como um "visitante" nasce

1. Toda página do OWNews injeta `SCRIPT_VISITAS` (home e `paginaChrome`).
2. O script lê/cria `localStorage.ownews_sid` (UUID). **Esse UUID é o "visitante".**
3. `POST /api/visita {sessionId, path, ref, utm}` → `responderVisita` → Durable Object `PageViews` → `/visita`:
   `INSERT OR IGNORE visit_days(session_id, day)` (dia **UTC**) + `pageviews_raw(path, session_id, ref_tipo,
   dispositivo, ts)`.
4. Artigos ainda chamam `POST /api/pageview {articleId, sessionId}` → tabela `views` (+8 dias de retenção).
5. Eventos (`window.ownewsEvento("…")`) → `POST /api/evento` → `events`.

Portanto **1 visitante = 1 perfil de navegador com localStorage**, não 1 pessoa.

### O que NÃO conta (por construção)
- Qualquer coisa sem JavaScript: `curl`, `WebFetch`, scripts Python, crons, health-checks, Google Search bot sem
  render, `production_guard.py` (smoke HTTP), o próprio collector.
- User-Agent que bate em `PADRAO_BOT_PRESENCA` (bots declarados, `HeadlessChrome`, etc.) — rejeitado no servidor.
- `sessionId` fora de `PADRAO_ID_SESSAO_PRESENCA` (`/^[a-zA-Z0-9-]{8,64}$/`).

### O que CONTAVA e não devia (corrigido neste checkpoint, cliente apenas)
- Navegador automatizado com UA "normal" (Playwright `chromium` headless novo, `tests/playwright_escala.js`
  que abre **produção** `/minha-escala` e `/central-do-trabalhador`). Agora: `navigator.webdriver===true` → não envia
  `/api/visita`, `/api/pageview`, `/api/evento`.
- O navegador do administrador. Agora: abrir o Command Center grava `localStorage.ownews_interno="1"` e esse
  navegador deixa de contar dali em diante. **Histórico não é alterado** (não se falsifica passado).

### O que ainda conta e é inerente ao método
- Mesma pessoa em 2 navegadores / celular + desktop / aba anônima / webview do Instagram-WhatsApp = 2+ visitantes.
- localStorage limpo = novo visitante.
- Dois leitores no mesmo navegador = 1 visitante.

---

## 2. Definição exata de cada número do painel

| Métrica | Fonte | Definição | Janela | Confiável? | Inflável por automação? | Duplicável? |
|---|---|---|---|---|---|---|
| **Visitantes (hoje)** | `pageviews_raw` | `COUNT(DISTINCT session_id)` desde 00:00 **America/Sao_Paulo** | hoje BRT | média | sim (antes do fix: Playwright/admin) | sim (multi-navegador) |
| **Visitantes (7d/30d)** | `visit_days` | `COUNT(DISTINCT session_id)` nos últimos N dias **UTC** | dias UTC | média | idem | idem |
| **Visualizações** | `pageviews_raw` | `COUNT(*)` de `/api/visita` recebidos (1 por carregamento de página) | idem | média-alta | sim (reload = +1) | sim |
| **"vs anterior" (%)** | mesmas tabelas, período imediatamente anterior de mesmo tamanho | `round((atual-anterior)/anterior*100)` | — | **baixa com base < 20** | — | — |
| Total de visitas (rodapé) | `totals` | 1 por `session_id` por dia UTC, nunca decresce | histórico | média | sim | sim |
| Leitores online | `PresencaOnline` DO | heartbeats a cada 45 s por `ownews_sid` | ~1 min | média | admin conta +1 (não corrigido: métrica efêmera) | sim |
| Top páginas / origens / dispositivos | `pageviews_raw` | agrupamentos por `path` / `ref_tipo` / `dispositivo` | período | média | idem | — |
| Eventos (funil Minha Escala, carreiras, push…) | `events` | contagem de `name` | período | alta para o **evento**, não para "pessoas" | admin ao testar (corrigido) | sim |
| Push inscritos | KV `push:*` | assinaturas Web Push | atual | alta | não | 1 por navegador |
| Editorial / Sistema / Revisão | collector `/saude`, `/revisao`, KV | estado operacional | atual | alta | n/a | n/a |

**Inconsistência de janela (documentada, não mascarada):** "hoje" usa dia BRT; 7d/30d usam dia UTC. Entre 21:00
e 00:00 BRT um mesmo visitante pode estar em "hoje" e também no dia UTC seguinte. Impacto pequeno; corrigir só
quando `visit_days` passar a gravar dia local (mudança de DO — fora deste checkpoint).

---

## 3. O caso "267 visitantes únicos / 299 visualizações / +761%"

- **267** = `COUNT(DISTINCT session_id)` no período selecionado (identificadores de navegador).
- **299** = carregamentos de página com JS. 299/267 ≈ 1,12 página por navegador: coerente com tráfego de
  busca/social "entra e sai", **e também** coerente com runs automatizados que abrem 1–2 páginas.
- **+761%** = `(267 − 31) / 31`. A base anterior era ≈ **31**. `fmtPct` não tinha base mínima — qualquer período
  partindo de dezenas gera centenas de %. Agora: base < 20 mostra "base anterior N — variação não significativa";
  acima disso o percentual exibe a base entre parênteses.

### Os 267 representam pessoas reais?

**NÃO É POSSÍVEL GARANTIR.** Tecnicamente:
1. A unidade é `localStorage.ownews_sid`, não pessoa, não dispositivo, não conta.
2. Até este checkpoint, o navegador do administrador e o Playwright de produção (`tests/playwright_escala.js`,
   `navigator.webdriver` não checado, UA de Chromium 133 sem "Headless") **eram contados** como visitantes
   novos a cada perfil/execução. Não há como separar retroativamente: a tabela não guarda UA nem IP.
3. Não há fingerprint, nem login obrigatório, nem IP (por desenho — privacidade). Logo também não há como
   provar duplicidade da mesma pessoa.
4. O que **é** verdade: 267 navegadores distintos **executaram JavaScript** do OWNews no período e não bateram no
   filtro de bots. Bots declarados, crawlers e ferramentas sem JS **não** estão nesse número.

### A atividade de desenvolvimento (Claude) inflou?
- Sessões de Claude Code usam `curl`/`WebFetch`/Python: **não executam JS → não contam**.
- `python3 tests/production_guard.py`: HTTP puro → **não conta**.
- `tests/playwright_escala.js` (produção, Chromium completo): **contava** 1 visitante + 2 visualizações por
  execução, quando rodava com sucesso. Nesta máquina ele falha hoje (binário sem libs, exit 127); nas execuções
  anteriores que funcionaram, cada uma entrou no histórico. Ordem de grandeza: unidades a poucas dezenas, não
  centenas — mas **não há registro** que permita subtrair com precisão.
- Navegação manual do administrador: contava. Idem — não separável retroativamente.

Conclusão honesta: parte dos 267 é interna (dev + admin), a maior parte provavelmente não é, e o número certo
não é recuperável. Daqui em diante a contaminação interna é bloqueada no cliente (§1).

---

## 4. Classificação HUMANO PROVÁVEL / INTERNO-DEV / BOTS / DESCONHECIDO

Só é confiável **a partir de agora** e apenas parcialmente:

| Classe | Como identificar | Confiável? |
|---|---|---|
| BOTS declarados | UA em `PADRAO_BOT_PRESENCA` | sim — já excluídos antes de gravar |
| INTERNO-DEV | `navigator.webdriver` ou `ownews_interno` (cliente) | sim para o futuro; **impossível** para o passado |
| HUMANO PROVÁVEL | o resto que executa JS e não é interno | **não** é prova de humano; é "navegador não automatizado conhecido" |
| DESCONHECIDO | tudo antes de 2026-10-05 | — |

O painel **não** deve exibir "pessoas". Rótulo adotado: **"Visitantes (navegadores únicos)"** e texto-resumo
"navegadores únicos (visitantes)". Nenhuma contagem foi recalculada, apagada ou "corrigida" no histórico.

---

## 5. Área "Usuários OW" (proposta, não implementada)

- Fonte: GoTrue Admin API (`/auth/v1/admin/users`) — exige **service role**, que só existe no collector.
- Implementar como endpoint interno do collector (`/usuarios-resumo`, header `X-OWNews-Internal`), respondendo
  **apenas agregados**: total de contas, contas com `escala_config`, distribuição por `funcao`, por `tipo` de
  escala, por `aeroporto`, contas criadas por semana, com `consent_noticias/ofertas`.
- O CC consome via `/api/cc/usuarios` (sessão CC) e renderiza aba "USUÁRIOS OW".
- **Nunca**: e-mail, telefone, nascimento, nome, escala individual, nem contagens < 5 por célula (k-anonimato
  simples: célula com menos de 5 contas mostra "<5").
- Bloqueio atual: a cópia de trabalho do collector está sobrescrita (ver `OW_PLATAFORMA.md` D9). Fazer só após
  restaurar e com deploy anunciado.

---

## 6. Regras

- Nenhuma métrica nova sem linha nesta tabela (fonte, definição, janela, confiabilidade, inflável?, duplicável?).
- Nunca relatar "pessoas"; relatar "navegadores únicos" ou "identificadores".
- Nunca editar histórico para "limpar" contaminação; documentar a data do fix e deixar o gráfico mostrar a quebra.
- `tests/playwright_escala.js` bate em produção: rodar só quando necessário; ele agora é ignorado pelo contador,
  mas continua gerando carga e heartbeats de presença.
