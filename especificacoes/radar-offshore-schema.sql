-- =========================================================================
-- Radar Offshore — schema de referência (NÃO EXECUTADO)
-- =========================================================================
-- Sem acesso de owner/admin do Supabase nesta sessão (mesma limitação já
-- registrada em todas as fases anteriores do projeto). A V1 do Radar
-- Offshore (2026-09-16) usa dados embutidos no próprio Worker
-- (UNIDADES_RADAR em producao-ownews-git/worker.js) — não uma tabela.
-- Este arquivo documenta a migração conceitual pra quando o Radar crescer
-- além do que cabe embutido no código, ou quando AIS for aprovado.
--
-- Idempotente (create table if not exists), não destrutivo, RLS própria,
-- sem policy de leitura pública além do necessário. Separação explícita
-- entre unidade (fixo) e posição (dinâmico), conforme pedido: nunca versionar
-- histórico grande nesta primeira fase — só a ÚLTIMA posição conhecida.
-- =========================================================================

create table if not exists public.offshore_units (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  slug              text not null unique,
  nome              text not null,
  tipo              text not null,   -- ver RADAR_TIPOS_LABEL no worker.js

  imo               text,
  mmsi              text,
  callsign          text,
  bandeira          text,

  ano_construcao    integer,
  estaleiro         text,
  comprimento_m     numeric,
  boca_m            numeric,
  calado_m          numeric,
  gt                numeric,
  dwt               numeric,

  owner             text,
  manager           text,
  operador          text,

  campo             text,      -- texto livre, ex.: "Búzios — Bacia de Santos, pré-sal"
  capacidade        text,      -- texto livre, ex.: "225 mil barris/dia..."
  sobre             text,

  foto_url          text,
  foto_credito      text,
  foto_licenca      text,

  fontes            jsonb,     -- [{label, url}], nunca vazio para dado publicado

  constraint tipo_valido check (tipo in (
    'drillship','semissubmersivel','fpso','fso','plataforma','plsv','rsv',
    'ahts','psv','dsv','osrv','rov_support','offshore_construction','outro'
  ))
);

comment on table public.offshore_units is
  'Radar Offshore — dados fixos de identidade/especificações de cada unidade. Nunca guardar posição aqui.';

alter table public.offshore_units enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='offshore_units' and policyname='leitura publica offshore_units') then
    create policy "leitura publica offshore_units" on public.offshore_units for select to anon using (true);
  end if;
end $$;

-- ---------- Posição — SÓ A ÚLTIMA conhecida por unidade (sem histórico) ----------
create table if not exists public.offshore_latest_positions (
  unit_id             uuid primary key references public.offshore_units(id) on delete cascade,

  latitude            numeric not null,
  longitude           numeric not null,
  sog_nos             numeric,          -- speed over ground, nós
  cog_graus           numeric,          -- course over ground
  heading_graus       numeric,
  nav_status          text,
  destination         text,
  eta                 timestamptz,

  position_timestamp  timestamptz not null,  -- quando a posição foi observada pela fonte AIS
  received_at         timestamptz not null default now(), -- quando o OWNews recebeu/gravou
  source              text not null,          -- ex.: 'aisstream', 'aishub' — só depois de licença confirmada

  bacia_inferida      text,   -- point-in-polygon contra shapefile oficial ANP, nunca "opera em"
  campo_inferido      text    -- idem, mais conservador ainda — só se o polígono for do campo exato
);

comment on table public.offshore_latest_positions is
  'Radar Offshore — só a posição AIS mais recente por unidade. NÃO ativa nesta V1 (nenhuma fonte gratuita pesquisada tinha licença clara de redistribuição pública). Nunca preencher com dado inventado ou de fonte sem licença confirmada.';

alter table public.offshore_latest_positions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='offshore_latest_positions' and policyname='leitura publica offshore_latest_positions') then
    create policy "leitura publica offshore_latest_positions" on public.offshore_latest_positions for select to anon using (true);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='offshore_units_tipo_idx') then
    create index offshore_units_tipo_idx on public.offshore_units (tipo);
  end if;
end $$;

-- =========================================================================
-- Checklist pra quem for aplicar (não fazer sem decisão explícita — a V1
-- não depende disso, funciona com os dados embutidos no Worker):
-- [ ] Confirmar necessidade real (V1 embutida já atende o volume atual).
-- [ ] Rodar este arquivo no SQL Editor do Supabase.
-- [ ] Migrar UNIDADES_RADAR (worker.js) pra linhas desta tabela.
-- [ ] SÓ preencher offshore_latest_positions quando uma fonte AIS com
--     licença de redistribuição pública clara for aprovada — ver
--     "AIS — decisão desta rodada" no relatório do Radar Offshore.
-- =========================================================================
