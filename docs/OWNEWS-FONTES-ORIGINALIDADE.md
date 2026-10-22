# OWNews — Fontes, originalidade e transparência editorial (2026-10-22)

## Rodapé "Fonte" da matéria (frontend `blocoProvenienciaNoticia`)

- O rodapé tem quatro partes:
  - "Fonte: <nome>";
  - a frase "Conteúdo elaborado pelo OWNews a partir das informações da fonte citada.";
  - a data de publicação no OWNews;
  - os links "Como produzimos" (`/politica-editorial#como-produzimos`) e "Reportar erro" (`/correcoes?pagina=/noticia?id=<id>#como-reportar`).
- Datas:
  - `published_at` é a data da **fonte**;
  - a publicação no OWNews é `created_at`;
  - "Atualizado em" só aparece se `buddy_reviewed_at` for mais de 6 h depois de `created_at`.
- Links para a fonte:
  - fonte secundária (imprensa) **não** tem link;
  - fonte primária (órgão público, operadora ou empresa citada, definida por `classificarOrigemFonte`) ganha "Ver comunicado original" ou "Ver documento original" (.pdf), mas só se a URL for https e tiver pelo menos 2 segmentos de caminho (nunca a homepage);
  - página sem texto OWNews (registro, noindex) mantém "Ler na fonte".
- A proveniência continua íntegra em quatro lugares:
  - `original_url`, `image_credit`, `source_id`, `original_published_at` e `created_at` no banco;
  - `isBasedOn` e `sourceOrganization` no JSON-LD;
  - o arquivo write-once `fonte:<hash>` no BuddyIAPoller;
  - `/admin/pauta`.
- `CORRECOES_NOTICIAS` (frontend) gera a nota "Correção (data)" na matéria e o registro em `/correcoes`.
- A metodologia (IA, checagens, sem apuração própria, sem revisão humana nota a nota, limites) fica uma vez só, em `/politica-editorial#como-produzimos`.

## Auditoria de 30 matérias publicadas (19–21/10)

Resultado: A 5, B 14, C 8, D 3.

Problemas encontrados por categoria:
- **Erros factuais (3):**
  - "20 mil árvores submarinas": era especificação de 20,000 psi, não quantidade;
  - £24,5 mi do governo escocês atribuídos à Sumitomo;
  - valores de gás atribuídos à formação errada (Vår/Lakris).
- **Enquadramento errado (1):** licenças fora de rodada tratadas como parte da aprovação de Jackdaw.
- **Paráfrase próxima (5–6):** sempre de fonte em português (bigramas 0,24–0,45).
- **Impacto genérico ou especulativo (11):** "pode elevar a demanda", "podendo gerar novos contratos", "cadeia offshore".
- **Buddy fraco (6):** paráfrase do lead ou com o número errado.
- **Duplicata entre idiomas (1):** BP/TechnipFMC, Offshore Energy × PetroNotícias.
- **Índice de newsletter publicado como notícia (1):** Eixos, com a legenda da foto tratada como fato.
- **Títulos com tradução literal:** "Par de perfurações", "Nave", "Jogador de petróleo", "permissão offshore", "Fugro, EirGrid completa".

Ações aplicadas pela rota `/admin/materia-ownews`, que passa pelo mesmo gate:
- **Corrigidas com registro em /correcoes (4):** TechnipFMC, Sumitomo, Jackdaw, Vår.
- **Reescritas (5):** P-35, P-82, PPSA, Petronas e EirGrid (título, corpo e/ou impacto).
- **Títulos corrigidos (4):** Transocean, REM Ocean, Panoro e EMGS.
- **Mudança de status (3):**
  - `insuficiente` (newsletter Eixos);
  - `duplicada` (PetroNotícias BP/TechnipFMC);
  - `ia_fora_escopo` (Maersk etanol, sem relação offshore concreta).
- `published_at` não foi alterado em nenhuma.

## Pipeline (collector)

Regras só na geração; a exibição não muda, então não derruba matéria publicada:
- `parafrase_rasa`: limiar baixou de 0,4 para 0,3. Pega 3 de 45 no acervo, e a matéria ganha uma 2ª redação.
- `numero_unidade_trocada`: número que na fonte só aparece com psi/kV/MW/GW/hp/bar e que no texto ficou sem a unidade. Vale para Buddy, corpo, impacto e título.
- `impacto:especulativo`: "pode(m)/podendo/poderá + elevar/acelerar/gerar…" ou "cadeia (de suprimentos) offshore".
- Título `traducao_literal`.
- Material de newsletter ("NESTA EDIÇÃO" com menos de 900 caracteres) passa a ser `sem_material`.
- Duplicata de evento: Buddy ≥ 0,6, **ou** Buddy ≥ 0,4 **e** corpo ≥ 0,4. Os recentes agora trazem `content`.
- O prompt do redator ganhou regras novas:
  - Buddy diferente da abertura da matéria;
  - ordem por importância;
  - atribuição de números a quem os informou;
  - especificação técnica ≠ quantidade;
  - glossário rig/drillship/vessel/player/permit;
  - legendas não são fato;
  - impacto sem especulação.
- `BUDDY_IA_REJ_CORRIGIVEL_DESDE` = 2026-10-22T09:04Z (logo após o deploy do coletor; o cron das 08:59 ainda rodou o código antigo): as pautas corrigíveis ganham uma reavaliação.
- Todas as reprovações novas são **corrigíveis**: 2ª redação dirigida, sem loop.
