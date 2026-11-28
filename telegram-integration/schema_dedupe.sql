-- =========================================================================
-- Telegram | Radar Offshore — tabela de deduplicação/registro
-- =========================================================================
-- IMPORTANTE: esta sessão não tem credencial de owner/admin do Supabase
-- (nunca teve, em nenhuma fase deste projeto — só a chave anon pública).
-- Este arquivo está pronto e idempotente, mas **NÃO foi executado por
-- mim**. Alguém com acesso ao SQL Editor do Supabase (ou uma connection
-- string fornecida com segurança, nunca em texto no chat) precisa rodar
-- isto antes do envio automático real do Telegram poder acontecer com
-- segurança — sem esta tabela, o `telegramPublisher` integrado ao
-- collector se recusa a enviar qualquer coisa (fail-safe: sem tabela, sem
-- envio, nunca "assume histórico vazio e manda mesmo assim").
--
-- Idempotente: `create table if not exists`, índice com `if not exists`,
-- policy recriada via `drop policy if exists` + `create policy` — pode
-- rodar mais de uma vez sem erro e sem duplicar nada. Não é destrutivo
-- (não deleta, não faz DROP TABLE, não toca em nenhuma tabela existente).
-- Não enfraquece nenhuma RLS existente — é uma tabela nova, com sua
-- própria RLS, sem nenhuma policy de leitura pública.
--
-- Simplificado em 2026-09-16 pra ativação: o status só precisa distinguir
-- 'published' (enviado de verdade, é o que dedupe/limite diário usam) e
-- 'failed' (erro, fica disponível pra retry seguro — nunca conta como já
-- enviado). Os demais desfechos (descartado editorialmente, aguardando
-- intervalo, expirado) são recalculados a cada execução a partir da
-- própria tabela articles — não precisam de linha própria aqui.
-- =========================================================================

create table if not exists public.telegram_posts (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  article_id        uuid not null references public.articles(id),
  canonical_url     text not null,

  status            text not null,   -- 'published' | 'failed'
  motivo            text,            -- contexto adicional, quando aplicável
  pontuacao         numeric,         -- pontuação do score editorial no momento do envio
  categoria         text,            -- categoria exibida no post, null se nenhuma

  tipo_envio        text,            -- 'foto' | 'texto'
  fallback_de_foto  boolean not null default false,
  -- true só quando este envio furou o intervalo mínimo de 2h por
  -- prioridade muito alta (avaliarJanelaDeEnvio em telegramPublisher.js) —
  -- usado pra aplicar a regra de raridade (no máximo 1x por dia).
  furou_intervalo   boolean not null default false,

  telegram_message_id  text,         -- retornado pela API do Telegram após o envio real
  error_message     text,            -- preenchido só quando status = 'failed'

  published_at      timestamptz,     -- quando de fato foi publicado (null em failed)

  constraint status_valido check (status in ('published', 'failed')),
  constraint article_id_unico unique (article_id)
);

comment on table public.telegram_posts is
  'Registro de publicações reais no canal Telegram OWNews | Radar Offshore. article_id é UNIQUE: um artigo nunca é publicado duas vezes.';

-- RLS: nenhuma policy de leitura pública. Só o Worker publicador (service
-- role, que ignora RLS) deve ler/escrever aqui.
alter table public.telegram_posts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'telegram_posts_published_at_idx'
  ) then
    create index telegram_posts_published_at_idx
      on public.telegram_posts (published_at)
      where status = 'published';
  end if;
end $$;

-- =========================================================================
-- Checklist pra quem for aplicar:
-- [ ] Confirmar que public.articles já existe com coluna id uuid.
-- [ ] Rodar este arquivo inteiro no SQL Editor do Supabase (idempotente —
--     seguro rodar de novo se der algum erro no meio e precisar repetir).
-- [ ] Confirmar RLS ativo e nenhuma policy de SELECT para anon/authenticated
--     (testar com a chave anon: SELECT na tabela deve vir vazio/negado).
-- [ ] Avisar que a migração foi aplicada — o collector detecta a tabela
--     sozinho na próxima execução (sem precisar de novo deploy).
-- =========================================================================
