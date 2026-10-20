# OWNEWS LIVE NEWSROOM — pipeline editorial

Manual operacional do caminho **fonte → descoberta → coleta → classificação → redação OWNews → gate → publicação → Home/editorias → OWBuddy → Telegram**.
Atualizado em 2026-10-20 (missão Live Newsroom). Código: `shrill-pond-a915-fix/worker.js` (collector, Worker `shrill-pond-a915`) e `producao-ownews-git/worker.js` (front, Worker `ownews-git`).

## 1. Fontes e cadência

- **Registro de fontes:** `FONTES_REGISTRY` no collector; detalhes em `docs/SOURCE-REGISTRY.md`.
- **Grupos de fontes:**
  - **A:** ANP e Petrobras.
  - **B:** PPSA, EPE, MME, Marinha e ANTAQ.
  - **C:** IBAMA, PetroNotícias, Agência Brasil, Sindipetro NF, FUP, Eixos e Notícias Macaé.
  - **D:** Transocean, SBM Offshore e Offshore Energy.
  - **E:** Portos e Navios, MegaWhat e Marine Technology News.
- **Agendamento:**
  - Dois crons fixos: `50` e `20` nas horas 8, 11, 14, 17, 20 e 22 UTC (05–19 BRT). Eles rodam os grupos A e B.
  - Um alarm do Durable Object `EditorialPoller` a cada hora, girando A → B → C → D → E. Cada grupo roda a cada ~5h; A e B rodam a cada ~3h por causa dos crons.
  - **Stale guard:** se a última publicação passa de 6h, roda uma passada extra do grupo A.
- **Limite de requisições:** o plano Free permite 50 subrequests por invocação. Por isso os grupos são pequenos. "Too many subrequests" vira erro do item, que volta no ciclo seguinte.
- **Petrobras:** responde HTTP 403 para o IP do VPS (o harness local), mas funciona a partir da Cloudflare.

## 2. Filtros baratos antes da IA (nesta ordem)

1. `noticiaRelevante(título)`: vocabulário do setor e exclusões de ruído institucional.
2. **Dedup de URL no banco** (`filtrarUrlsExistentes`), com uma consulta por fonte.
3. **Dedup de título contra os últimos 5 dias** (`mesmoFatoTitulos`):
   - limiar de 0,55 para fontes normais;
   - limiar de 0,2 para fontes sensíveis (PetroNotícias, Agência Brasil), mas só conta como o mesmo fato se os títulos dividirem um número (valor, data ou unidade como P-82). Assim, mesmo assunto não é tratado como mesmo fato.
4. **Idade da pauta:** mais de `PAUTA_IDADE_MAX_H` = 72h vira status `antiga`. Pauta antiga não lê a página nem chama a IA.
5. **Data editorial:** sem data verificável, a pauta é descartada. Data mais de 15 min no futuro (fuso da fonte rotulado errado) é trocada pela hora da descoberta.
6. **Tradução:** só para fontes em inglês (m2m100). Se falhar, a pauta é bloqueada, nunca publicada em inglês.
7. **Risco editorial:** pauta sensível fica retida como draft.
8. **Memória de reprovação:** veja a seção 4.

## 3. Redator e gate

- **Redator:** `gerarCamadaEditorialIA` usa `@cf/openai/gpt-oss-120b` com `reasoning_effort: low`, cerca de 65–80 neurons por chamada.
- **Prompt:** `BUDDY_IA_SISTEMA`. Ele precisa pedir tudo o que o gate cobra:
  - **Título:** português natural, sem Title Case nem tradução literal.
  - **Buddy:** 2–3 frases com palavras próprias.
  - **Corpo:** 2–4 parágrafos. Ficha técnica com estrutura própria. Números exatamente como na fonte, sem arredondar, somar, subtrair ou converter.
  - **Impacto:** com nome próprio ou número da matéria no meio da frase, e consequência concreta.
  - **Empregos:** o texto só fala de empregos se a fonte falar.
- **Gate:** `validarMateriaOWNews` está no bloco `QUALIDADE EDITORIAL 2.1`, idêntico nos dois workers (o teste de paridade verifica). Verifica:
  - Buddy;
  - impacto (genérico, âncora, especulação, empregos sem base);
  - corpo (tamanho, parágrafos, clichê, cópia, paráfrase rasa, número sem fonte, maior que a fonte);
  - título (`validarTituloOWNews` / `escolherTituloOWNews`).
- **Anti-cópia por prosa (2026-10-20):** número, unidade e nome próprio da fonte são fatos que a nota tem de trazer e não contam como cópia.
  - A janela de 8 palavras só acusa cópia se tiver 5 ou mais palavras de prosa.
  - A paráfrase rasa mede só pares de palavras que contêm prosa.
  - Cópia literal e troca de poucas palavras continuam reprovando (veja `tests/newsroom_test.mjs`).
- **Segunda tentativa (no máximo 1 geração + 1 correção):**
  - Acontece só quando todos os motivos são de forma (`BUDDY_IA_MOTIVOS_REESCRITA`).
  - O pedido traz as dicas do motivo e as frases exatas que repetiram a fonte (`frasesCopiadasDaFonte`), com temperatura 0,35. Com 0,45, o gpt-oss vazava o raciocínio no JSON.
  - Saída degenerada na 2ª tentativa conta como a reprovação corrigível da 1ª. Na 1ª tentativa, conta como falha técnica.
- **Título traduzido:** a tradução automática só é publicada se o redator a devolver igual nas duas redações e ela passar no gate de título.
- **Falha técnica** (sem binding, erro da IA, cota 4006, timeout, JSON inválido): não publica nem memoriza. A pauta volta no próximo ciclo.

## 4. Memória de reprovação (`rej:<hash>` no DO `BuddyIAPoller`)

- **Definitiva:** `fora_escopo`, `sem_material`, `impacto:sem_relevancia_offshore`, `impacto:vazio` (o redator não viu efeito offshore). Vale 3 dias.
- **Corrigível:** forma de Buddy, impacto, corpo ou título.
  - Vale até a próxima mudança do redator ou do gate: `BUDDY_IA_REJ_CORRIGIVEL_DESDE`.
  - **Ao melhorar o redator, avance essa constante para a hora do deploy.** Cada pauta ainda no feed e com até 72h ganha uma única nova avaliação.
  - Entradas antigas sem classe contam como corrigíveis.
- O registro de reprovação usa o storage do Durable Object, sem KV.

## 5. Publicação e consumo

- **Gravação:** `inserirArtigo` com `buddy_source='ownews'`. `content` é o corpo OWNews; o texto da fonte vai para o arquivo `fonte:<hash>` no DO.
- **Dedup por evento:** uma matéria cujo Buddy coincide 60% ou mais com o de outra já publicada é gravada como `duplicada` (fica fora do índice e da Home).
- `published_at` é a data da fonte e nunca é alterada para parecer nova.
- **Home:** `selecionarHomeServidor` no front, com relevância × frescor e freshness budget. Diagnóstico em `/api/home-selecao?diagnostico=1`.
- **Editoria:** `materiaInternacional` decide pelo conteúdo (país citado contra marcadores brasileiros), não pela fonte. É uma função única, enviada aos scripts do navegador via `toString()`.
- **OWBuddy:** `/api/buddy/feed` usa os mesmos campos canônicos. Não há pipeline separado.
- **Telegram:**
  - candidatos só `buddy_source=ownews` com até 24h;
  - 2 notícias por dia nos slots 08:50 e 17:50 BRT; breaking só com score de 22 ou mais;
  - Boletim de Aeroportos às 06:15 e Dica Offshore às 12:00 (via `TelegramAgendadorPoller`);
  - sem candidato válido, não publica.

## 6. Observabilidade (sem escrita por request)

- **`GET /saude` do collector → `saude_editorial`** (`calcularSaudeEditorial`, calculado na leitura). Traz:
  - status VERDE / AMARELO / VERMELHO e os motivos;
  - `silencio_alerta`;
  - idade da última matéria OWNews;
  - publicadas em 24h e hoje (BRT);
  - funil de 24h: avaliadas pela IA, aprovadas e aprovadas na 2ª tentativa, corrigíveis, definitivas, barradas pela memória;
  - taxa de aprovação real;
  - latência fonte→OWNews (mediana de 7 dias, `created_at − published_at`);
  - `ia_status` (ok, cota_esgotada, falha);
  - fontes com erro.
- **Regras do semáforo:**
  - **VERMELHO:** 12h ou mais sem publicar com pautas chegando (alerta de silêncio), ou redator sem cota / com falha há 6h ou mais.
  - **AMARELO:** 6h ou mais sem publicar, aprovação abaixo de 25% (com 4 ou mais avaliadas) ou fonte com erro.
  - **VERDE:** o resto.
- **Command Center → aba Editorial → "Saúde editorial"**, acima de "Pipeline editorial".
- **Escritas em KV:** `gate_acum` continua com 1 PUT por rodada com dado (0 sem dado). Os contadores novos entram no mesmo objeto. Veja `docs/KV-BUDGET.md`.
- **Uso de neurons:** GraphQL `aiInferenceAdaptiveGroups`. Esse número subnotifica: no dia 20/10 marcava ~4,4 mil quando a API já devolvia 4006. Não serve como medidor de folga.

## 7. Workers AI — limites

- **Cota:** 10 mil neurons por dia por conta (Free), compartilhada entre collector, front e testes locais. Zera às 00:00 UTC.
- **Testes locais com IA real** (harness `p0/` no scratchpad, proxy `wrangler dev` com o binding AI) gastam a mesma cota. Use no máximo ~15 chamadas por dia e prefira reaplicar o gate sobre saídas já gravadas.
- **Teto do retroprocessamento do acervo** (`BuddyIAPoller`): 24 por dia.

## 8. Falhas comuns → o que olhar

- **Home velha:**
  1. Abra `/api/home-selecao?diagnostico=1` e veja se existe matéria nova elegível.
  2. Depois abra `saude_editorial` no `/saude` do collector.
- **Silêncio com pautas chegando:** veja `gate_editorial['24h'].motivos` e `fontes`. Para reproduzir, rode o harness local com `AI_BUDGET=0` (o funil roda sem gastar IA).
- **`ia_status=cota_esgotada`:** não há o que fazer até 00:00 UTC. As pautas voltam sozinhas no ciclo seguinte (não são memorizadas).
- **Fonte com erro:** `fontes_com_erro` na última execução. Teste a fonte isolada com `/run-<fonte>` (exige `X-OWNews-Token`; executa de verdade).

## 9. Rollback

- **Collector:** `wrangler rollback <version-id>` em `shrill-pond-a915-fix`, ou `git revert` do commit e novo deploy.
- **Front:** o mesmo em `producao-ownews-git`.
- **Version IDs:** ficam no relatório da missão e no memory `project-live-newsroom`.
- **Os ícones** (`/icons/*.png`) agora vêm de Workers Static Assets (`producao-ownews-git/public`). Um rollback para uma versão anterior ao commit da missão volta a servi-los em base64 pelo próprio worker, sem perda.
