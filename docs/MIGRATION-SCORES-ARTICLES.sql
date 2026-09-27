-- OWNews — persistência dos scores editoriais na tabela `articles`
-- Preparada em 2026-09-27 (execução autônoma da missão de pipeline).
-- NÃO aplicada ainda: requer acesso de schema (Supabase Dashboard → SQL
-- Editor, CLI com migrations ou conexão Postgres direta). A REST API
-- (PostgREST) usada em produção só faz CRUD em colunas já existentes,
-- nunca DDL — confirmado empiricamente nesta sessão:
--   SELECT editorial_score  → 42703 "column articles.editorial_score does not exist"
--   (idem breaking_score, audience_interest_score, score_reason)
--
-- Colunas atuais de `articles` (verificadas via REST em 2026-09-27):
--   category_id, content, created_at, hash, id, image_caption,
--   image_credit, image_url, is_sensitive, original_published_at,
--   original_url, published_at, reviewed_at, reviewed_by, slug,
--   source_id, status, summary, title
--
-- POR QUE ISSO É PRÉ-REQUISITO
-- Hoje `pontuarDestaque()` roda no FRONTEND, a cada carregamento, e o
-- resultado é descartado. Isso funciona pra ordenar laterais/Giro, mas
-- impede três fases já previstas no MISSION-STATE:
--   1. INSTAGRAM_SCORE (escolher automaticamente a matéria do post);
--   2. Discovery (ranking histórico, "por que esta matéria subiu");
--   3. discard-logging (auditar por que uma matéria NÃO foi escolhida).
-- Sem persistir, não há como responder "qual era o score no momento da
-- publicação" — o cálculo on-the-fly muda sozinho conforme o tempo passa
-- (o componente de recência decai), então o número de ontem é
-- irrecuperável.
--
-- SEGURANÇA DESTA MIGRAÇÃO
-- - 100% ADITIVA: nenhuma coluna existente é alterada, renomeada ou
--   removida; nenhum dado é apagado.
-- - Todas as colunas são NULLABLE e sem DEFAULT: as 183+ linhas já
--   existentes ficam com NULL e continuam funcionando exatamente como
--   hoje (o frontend segue calculando on-the-fly quando o valor é NULL).
-- - `IF NOT EXISTS` em cada ADD COLUMN: rodar duas vezes é inofensivo.
-- - Rollback: `ALTER TABLE articles DROP COLUMN ...` (ver bloco no fim),
--   mas NÃO é necessário pra reverter código — o coletor só passa a
--   escrever nessas colunas num deploy posterior e explícito.

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS editorial_score          smallint,
  ADD COLUMN IF NOT EXISTS breaking_score           smallint,
  ADD COLUMN IF NOT EXISTS audience_interest_score  smallint,
  ADD COLUMN IF NOT EXISTS score_reason             jsonb;

COMMENT ON COLUMN public.articles.editorial_score IS
  'Score editorial no momento da coleta (0-130). Soma de recência + autoridade da fonte + relevância offshore + impacto + bônus de imagem própria — mesma fórmula de pontuarDestaque(). NULL = artigo anterior à migração; o frontend recalcula on-the-fly nesse caso.';
COMMENT ON COLUMN public.articles.breaking_score IS
  'Score de urgência/breaking no momento da coleta (0-100). NULL enquanto a fase de breaking não for implementada.';
COMMENT ON COLUMN public.articles.audience_interest_score IS
  'Score de interesse de audiência (0-100), alimentado depois por dados reais de leitura (PageViews DO). NULL até existir volume suficiente.';
COMMENT ON COLUMN public.articles.score_reason IS
  'Detalhamento auditável do cálculo, em JSON: {recencia, autoridade, relevancia_offshore, impacto, bonus_imagem, categoria, fonte, calculado_em}. Serve pro discard-logging e pra explicar "por que esta matéria foi escolhida".';

-- Índice só pro caso de uso real previsto (ranking por score dentro de
-- uma janela de tempo). Parcial, pra não indexar as linhas legadas NULL.
CREATE INDEX IF NOT EXISTS articles_editorial_score_published_idx
  ON public.articles (published_at DESC, editorial_score DESC)
  WHERE editorial_score IS NOT NULL;

-- ---------------------------------------------------------------------
-- VERIFICAÇÃO (rodar depois; deve devolver as 4 colunas)
-- ---------------------------------------------------------------------
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'articles'
--    AND column_name IN ('editorial_score','breaking_score',
--                        'audience_interest_score','score_reason')
--  ORDER BY column_name;
--
-- Do lado da aplicação, confirmar via REST (não deve mais dar 42703):
--   GET /rest/v1/articles?select=id,editorial_score,score_reason&limit=1
--
-- ---------------------------------------------------------------------
-- ROLLBACK (só se necessário — nada depende destas colunas até o deploy
-- do coletor que passa a escrevê-las)
-- ---------------------------------------------------------------------
-- DROP INDEX IF EXISTS public.articles_editorial_score_published_idx;
-- ALTER TABLE public.articles
--   DROP COLUMN IF EXISTS editorial_score,
--   DROP COLUMN IF EXISTS breaking_score,
--   DROP COLUMN IF EXISTS audience_interest_score,
--   DROP COLUMN IF EXISTS score_reason;
--
-- ---------------------------------------------------------------------
-- DEPOIS DE APLICAR: o que muda no código (1 deploy, escopo pequeno)
-- ---------------------------------------------------------------------
-- 1. shrill-pond-a915-fix/worker.js → em processarNoticias(), no objeto
--    `artigo` montado antes de inserirArtigo(): incluir editorial_score e
--    score_reason calculados na coleta. breaking_score e
--    audience_interest_score ficam NULL até suas fases existirem.
-- 2. producao-ownews-git/worker.js → ler o score persistido quando não
--    for NULL, mantendo pontuarDestaque() como fallback pro legado.
-- 3. Backfill opcional dos 183 artigos antigos: NÃO recomendado sem
--    decisão editorial — recalcular hoje daria um score de recência
--    diferente do que valia na publicação (seria reescrever história).
