-- OWNews — Radar de Vagas Offshore — migração da tabela `jobs`
-- Preparada em 2026-09-19 (Missão Contínua — Radar de Vagas). NÃO aplicada
-- ainda: requer acesso de schema (Supabase Dashboard SQL editor, CLI com
-- migrations, ou conexão direta Postgres) que esta sessão não possui —
-- a API REST (PostgREST) usada em produção só faz CRUD em tabelas já
-- existentes, nunca DDL (CREATE TABLE/ALTER TABLE).
--
-- Confirmado nesta sessão, empiricamente (não suposição):
--   1. Tentativa de criar/consultar `public.jobs` via REST retornou
--      PGRST205 "Could not find the table" — tabela não existe.
--   2. `articles.source_id` tem uma FOREIGN KEY real pra uma tabela
--      `sources` já existente (mas vazia, 0 linhas) — confirmado via
--      erro 23503 ao tentar inserir um UUID arbitrário.
--   3. `sources.type` tem uma CHECK CONSTRAINT cujos valores válidos não
--      foram descobertos por tentativa (testados sem sucesso: company,
--      government, regulator, primary, official, press, media,
--      secondary) — precisaria de acesso a `pg_constraint`/dashboard
--      pra ler a definição exata, que esta sessão não tem.
--   4. Por isso, reaproveitar `articles`/`sources` pra guardar vagas foi
--      descartado: exigiria ou adivinhar mais valores de enum (arriscado,
--      sem garantia) ou alterar toda consulta existente de notícia (Home/
--      Giro/Últimas/busca/sitemap) pra excluir linhas de vaga — risco de
--      regressão real no que já está funcionando, sem necessidade.
--
-- Esta migração é idempotente (IF NOT EXISTS em tudo) — pode ser rodada
-- com segurança mesmo que parte já exista. Sem dados de exemplo/fictícios
-- — só a estrutura.

CREATE TABLE IF NOT EXISTS public.jobs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identidade e dedupe (ver P11 da missão)
  external_job_id       text,
  job_fingerprint        text NOT NULL,

  -- Empresa
  company_id            uuid,          -- FK opcional pra uma futura tabela companies; NULL é válido
  company_name          text NOT NULL,

  -- Vaga
  title                 text NOT NULL,
  normalized_title      text,          -- título normalizado pra dedupe/alias de função (ver P22 — DPO, ROV etc.)
  description_summary   text,          -- resumo FACTUAL escrito pelo OWNews, nunca cópia integral (P16)
  requirements_summary  text,
  certifications        text[],        -- ex.: {CBSP, HUET, NR-33} — só quando a própria vaga informar (P15)
  experience_required   text,
  education_required    text,
  language_required     text,

  -- Local e modalidade
  location              text,
  city                  text,
  state                 text,
  country               text DEFAULT 'BR',
  work_mode             text,          -- ex.: presencial/embarcado/híbrido, só se informado
  offshore_onshore      text NOT NULL DEFAULT 'NAO_INFORMADO'
                          CHECK (offshore_onshore IN ('OFFSHORE','ONSHORE','BASE_MAIS_OFFSHORE','NAO_INFORMADO')),
  rotation              text,          -- ex.: "14x14" — NUNCA inferido, só quando publicado (P14)
  employment_type       text,          -- CLT/PJ/temporário etc., só se informado
  department            text,

  -- Fonte e rastreabilidade (P4, P8, P9)
  source_type           text NOT NULL, -- 'company_careers_page' | 'ats' | 'press_release' | 'public_api' | 'json_ld' | 'rss'
  source_name           text NOT NULL, -- nome da fonte (ex.: "TechnipFMC Careers", "Gupy — Petrobras")
  source_url            text NOT NULL, -- página onde a vaga foi descoberta
  application_url       text NOT NULL, -- link oficial de candidatura (pode ser igual a source_url)
  confidence            text NOT NULL DEFAULT 'MEDIA'
                          CHECK (confidence IN ('ALTA','MEDIA','BAIXA')),

  -- Ciclo de vida (P5, P12, P13)
  status                text NOT NULL DEFAULT 'NEW'
                          CHECK (status IN ('NEW','OPEN','UPDATED','CLOSED','EXPIRED','UNKNOWN')),
  published_at          timestamptz,   -- data real de publicação na fonte, quando informada
  discovered_at         timestamptz NOT NULL DEFAULT now(),
  last_verified_at      timestamptz,
  last_check_error      text,          -- erro técnico da última tentativa de revalidação (P13 — nunca vira CLOSED sozinho)
  expires_at            timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Só uma vaga por fingerprint — garante o dedupe do P11 no nível do banco,
-- não só na lógica de aplicação (defesa em profundidade).
CREATE UNIQUE INDEX IF NOT EXISTS jobs_fingerprint_uniq ON public.jobs (job_fingerprint);

-- Índices pra consulta pública (/vagas com filtros) e pro job de revalidação.
CREATE INDEX IF NOT EXISTS jobs_status_idx ON public.jobs (status);
CREATE INDEX IF NOT EXISTS jobs_offshore_onshore_idx ON public.jobs (offshore_onshore);
CREATE INDEX IF NOT EXISTS jobs_discovered_at_idx ON public.jobs (discovered_at DESC);
CREATE INDEX IF NOT EXISTS jobs_last_verified_at_idx ON public.jobs (last_verified_at);
CREATE INDEX IF NOT EXISTS jobs_company_name_idx ON public.jobs (company_name);

COMMENT ON TABLE public.jobs IS 'Radar de Vagas Offshore — vagas reais descobertas em canais oficiais (nunca inventadas). Ver docs/MISSION-STATE.md e docs/JOBS-SOURCE-REGISTRY.md.';
