-- =========================================================================
-- Instagram — tabela de deduplicação/registro
-- =========================================================================
-- Este arquivo precisa ser executado UMA VEZ por quem tem acesso de
-- owner/admin ao Supabase (SQL editor do painel, ou psql com a connection
-- string do banco) — o Worker publicador nunca tem permissão de DDL, só
-- INSERT/SELECT via service role key. Mesmo padrão já usado em
-- supabase-pesquisa-salarial/schema.sql e telegram-integration/schema.sql.
--
-- 2026-09-17: article_id passou a ser opcional — posts institucionais
-- (ETAPA 11 da missão Instagram) não se referem a nenhum artigo do banco de
-- notícias, então não podem exigir article_id not null. UNIQUE(article_id)
-- continua funcionando: Postgres nunca considera dois NULLs iguais, então
-- vários posts institucionais (article_id null) convivem sem violar a
-- constraint, enquanto cada artigo de notícia real ainda só pode aparecer
-- uma única vez.
create table public.instagram_posts (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  post_type         text not null default 'noticia',  -- 'noticia' | 'institucional'
  article_id        uuid references public.articles(id),  -- null quando post_type='institucional'
  canonical_url     text,                                   -- null quando post_type='institucional'
  janela            text,            -- 'manha_04h50' | 'noite_20h15' | 'institucional_domingo' | 'teste_manual'
  tema_institucional text,           -- só quando post_type='institucional' (rotação da ETAPA 11)

  status            text not null,   -- 'dry_run' | 'published' | 'failed'

  headline          text,            -- manchete/headline usada na arte
  caption           text,            -- legenda usada no post
  score             numeric,         -- score da pontuação editorial no momento da escolha (null em institucional)

  ig_media_id       text,            -- retornado pela Graph API após publicar
  ig_permalink      text,            -- link do post, quando disponível
  error_message     text,            -- preenchido só quando status = 'failed'

  published_at      timestamptz,     -- quando de fato foi publicado (null em dry_run/failed)

  constraint post_type_valido check (post_type in ('noticia', 'institucional')),
  constraint status_valido check (status in ('dry_run', 'published', 'failed')),
  constraint article_id_unico unique (article_id),
  constraint noticia_tem_article_id check (post_type <> 'noticia' or article_id is not null),
  constraint institucional_tem_tema check (post_type <> 'institucional' or tema_institucional is not null)
);

comment on table public.instagram_posts is
  'Registro de publicações (reais ou dry-run) no Instagram do OWNews. article_id é UNIQUE (NULLs não colidem entre si): um artigo de notícia nunca é publicado duas vezes; posts institucionais (article_id null) usam tema_institucional para a rotação.';

-- RLS — decisão tomada em 2026-09-17 (MISSÃO FINAL Instagram): o Worker
-- ownews-instagram-publisher é novo e não recebeu (nem pediu) a
-- SUPABASE_SERVICE_ROLE_KEY — só a credencial do Instagram foi fornecida
-- nesta missão. Em vez de bloquear a missão inteira esperando um segredo
-- novo do Supabase, optei por reaproveitar a MESMA chave publicável (anon)
-- que o frontend já usa publicamente para ler "articles", com duas
-- policies estritas e não mais que isso:
--   - INSERT: permitido pro anon (o Worker grava seu próprio histórico)
--   - SELECT: permitido pro anon (o Worker precisa ler o histórico pra
--     checar deduplicação antes de escolher a próxima notícia)
--   - UPDATE/DELETE: NÃO concedidos a anon — uma vez gravada, uma linha
--     não pode ser alterada nem apagada por essa chave, então ninguém que
--     só tenha a chave pública (que já é pública, embutida no JS do site)
--     consegue reescrever histórico ou apagar prova de uma publicação.
-- Risco aceito conscientemente: alguém com a chave anon poderia inserir
-- linhas de spam nesta tabela (não consegue alterar/apagar as reais, só
-- poluir). Impacto limitado a esta tabela interna (não afeta "articles",
-- não afeta o site, não afeta o Instagram de fato — só o dedupe interno).
-- Recomendação futura: se o proprietário preferir, gerar um secret dedicado
-- (ex.: uma chave RLS-bypassing específica só pra este Worker) e trocar
-- essas duas policies por acesso via service role — reversível a qualquer
-- momento, sem mudar nenhum código além do binding de env.
alter table public.instagram_posts enable row level security;

create policy instagram_posts_anon_insert
  on public.instagram_posts for insert
  to anon
  with check (true);

create policy instagram_posts_anon_select
  on public.instagram_posts for select
  to anon
  using (true);

-- Índice auxiliar para a checagem "já publicou algo hoje" (trava por dia).
create index instagram_posts_published_at_idx
  on public.instagram_posts (published_at)
  where status = 'published';

-- =========================================================================
-- AÇÃO NECESSÁRIA DO PROPRIETÁRIO (Claude não tem acesso de DDL ao Supabase
-- — só a service role key via REST, que não executa CREATE TABLE):
-- [ ] Rodar este arquivo inteiro uma vez no SQL editor do painel Supabase
--     do projeto awyowuhwkqfyhwgdpepp.
-- [ ] Confirmar RLS ativo com exatamente as duas policies acima (insert e
--     select para anon, nada de update/delete) — ver justificativa acima.
-- Depois disso, o Worker publicador (modo DRY RUN) já consegue gravar e
-- consultar histórico normalmente, usando a mesma chave anon pública.
-- =========================================================================
