-- ============================================================================
-- MIGRATION-BUDDY-EXPLICA.sql — camada editorial "Buddy te explica"
-- OWNews — Missão AdSense Recovery 1.0 (2026-10-06)
--
-- STATUS: NÃO aplicada ainda. Documento de referência para execução manual
--         no Supabase (SQL Editor) por quem tem acesso de DDL.
--
-- O worker principal (producao-ownews-git/worker.js) JÁ funciona sem estas
-- colunas: ele tenta selecioná-las, recebe 400/42703 enquanto não existem e
-- cai para o select base (feature-detection em `camadaColunasDisponiveis`).
-- Até a migração ser aplicada, a camada editorial vem exclusivamente do mapa
-- curado em código (CAMADA_EDITORIAL_CURADA). Depois dela, textos revisados
-- podem viver no banco e alimentar web + /api/buddy/feed sem deploy.
--
-- GARANTIAS:
--   * 100% ADITIVA — só ADD COLUMN, todas NULLABLE, sem DEFAULT, sem NOT NULL.
--   * Idempotente — IF NOT EXISTS em tudo.
--   * Zero impacto em leitura existente — o PostgREST continua servindo os
--     selects atuais; colunas novas só aparecem quando pedidas.
--   * Nenhum dado é alterado, nenhum trigger, nenhuma FK.
--   * Rollback trivial no fim do arquivo.
-- ============================================================================

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS buddy_summary     text,         -- 2–4 frases, PT-BR adulto, sem repetir o 1º parágrafo
  ADD COLUMN IF NOT EXISTS why_it_matters    text,         -- opcional; só quando há base concreta
  ADD COLUMN IF NOT EXISTS buddy_source      text,         -- 'curadoria' | 'editor' | 'revisao' (quem escreveu/validou)
  ADD COLUMN IF NOT EXISTS buddy_reviewed_at timestamptz;  -- data de revisão exibida na página

COMMENT ON COLUMN public.articles.buddy_summary     IS 'Camada editorial OWNews: o que a notícia significa (2–4 frases). Validada por validarTextoCamadaEditorial no worker.';
COMMENT ON COLUMN public.articles.why_it_matters    IS 'Camada editorial OWNews: por que importa para quem trabalha offshore. NULL quando não há base concreta.';
COMMENT ON COLUMN public.articles.buddy_source      IS 'Origem do texto da camada: curadoria | editor | revisao.';
COMMENT ON COLUMN public.articles.buddy_reviewed_at IS 'Data da última revisão humana da camada editorial.';

-- Índice parcial opcional (ajuda a listar "matérias com camada" no CC).
-- Comentado: só criar se a consulta passar a existir.
-- CREATE INDEX IF NOT EXISTS articles_buddy_reviewed_idx
--   ON public.articles (buddy_reviewed_at DESC)
--   WHERE buddy_summary IS NOT NULL;

-- ============================================================================
-- VERIFICAÇÃO (rodar depois):
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'articles'
--      AND column_name IN ('buddy_summary','why_it_matters','buddy_source','buddy_reviewed_at');
--
-- Esperado: 4 linhas, todas is_nullable = 'YES'.
--
-- No worker, após aplicar: nenhuma ação necessária. A próxima requisição a
-- /noticia ou /api/buddy/feed detecta as colunas (status 200) e passa a
-- usá-las. A curadoria em código continua tendo precedência sobre o banco.
-- ============================================================================

-- ============================================================================
-- ROLLBACK (reversível, não destrói nada além das colunas novas):
--
-- ALTER TABLE public.articles
--   DROP COLUMN IF EXISTS buddy_summary,
--   DROP COLUMN IF EXISTS why_it_matters,
--   DROP COLUMN IF EXISTS buddy_source,
--   DROP COLUMN IF EXISTS buddy_reviewed_at;
-- ============================================================================
