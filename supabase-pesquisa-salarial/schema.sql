-- =========================================================================
-- Pesquisa Salarial OWNews — schema proposto (REFERÊNCIA, NÃO EXECUTADO)
-- =========================================================================
-- Este arquivo documenta exatamente o que precisa ser aplicado no Supabase
-- para o formulário em /pesquisa-salarial começar a funcionar de verdade.
-- Ninguém rodou isso ainda: eu (Claude) não tenho a service role key nem
-- acesso ao painel/API de administração do Supabase nesta sessão — só a
-- chave publicável (anon), que não tem permissão para criar tabelas.
--
-- Quem aplicar isso precisa ter acesso de owner/admin ao projeto Supabase
-- (SQL editor do painel, ou psql com a connection string do banco).
--
-- ATENÇÃO: o frontend mantém a coleta em preparação e NÃO envia respostas.
-- Executar este SQL não ativa o formulário. Qualquer ativação exige revisão
-- deste rascunho, validação do backend e autorização explícita separada.
-- Veja REVISAO.md: esta proposta ainda não está pronta para produção.
-- =========================================================================

-- 1) Tabela: só respostas anônimas. Nenhum campo de identificação pessoal
--    (nome, CPF, matrícula, telefone, e-mail) existe aqui de propósito.
create table public.pesquisa_salarial_respostas (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),

  funcao_slug              text not null,   -- slug de FUNCOES_OFFSHORE, ou 'outro'
  funcao_outro             text,            -- só preenchido quando funcao_slug = 'outro'
  area                     text,            -- opcional (deck/drilling/subsea/...)

  experiencia_faixa        text not null,   -- 'menos-1-ano' | '1-3-anos' | '3-5-anos' | '5-10-anos' | 'mais-10-anos'
  tipo_unidade             text not null,   -- 'fpso' | 'sonda' | 'plataforma' | 'embarcacao' | 'apoio-maritimo' | 'rov' | 'outro'
  escala                   text,            -- '14x14' | '14x21' | '21x21' | '28x28' | 'outro' (texto curto)
  empresa                  text,            -- OPCIONAL — nunca exibido individualmente em lugar nenhum
  vinculo                  text not null,   -- 'clt' | 'pj' | 'temporario' | 'outro'

  salario_base_faixa       text not null,   -- faixa (ex.: '12000-18000'), nunca valor exato livre
  remuneracao_total_faixa  text not null,   -- faixa (ex.: '25000-35000'), com adicionais
  adicionais               text[],          -- ['periculosidade','confinamento','embarque','produtividade-plr','hora-extra','nenhum']

  estado                   text,            -- UF, opcional
  observacao                text,            -- texto livre, opcional

  constraint observacao_tamanho_max check (char_length(observacao) <= 500)
);

comment on table public.pesquisa_salarial_respostas is
  'Respostas anônimas da Pesquisa Salarial OWNews. Nunca conter PII.';

-- 2) RLS: liga a proteção e só permite INSERT pela chave pública (anon).
--    Não existe policy de SELECT/UPDATE/DELETE para anon — ou seja, é
--    a política proposta não concede leitura a anon. A garantia depende
--    também de grants, outras policies, roles, views e funções existentes;
--    verificar esses caminhos em uma revisão autorizada antes da ativação.
alter table public.pesquisa_salarial_respostas enable row level security;

create policy "permite insercao anonima"
  on public.pesquisa_salarial_respostas
  for insert
  to anon
  with check (true);

-- 3) Agregação futura (exemplo de estrutura, ajustar antes de usar em
--    produção): uma função SECURITY DEFINER que só devolve estatística
--    quando há amostra mínima (10, por decisão editorial do OWNews) —
--    nunca linhas individuais. O cálculo real de mediana por faixa exige
--    mapear cada faixa (ex.: '12000-18000') pra um valor numérico
--    representativo antes de agregar; isso é decisão de implementação de
--    quem for construir o painel público, não algo a inventar aqui.
--
-- create or replace function public.estatisticas_salariais(p_funcao_slug text)
-- returns table(n integer, ...)
-- language sql
-- security definer
-- as $$
--   select count(*)::int as n, ...
--   from public.pesquisa_salarial_respostas
--   where funcao_slug = p_funcao_slug
--   having count(*) >= 10;
-- $$;

-- =========================================================================
-- Checklist pra quem for aplicar:
-- [ ] Rodar a criação da tabela (bloco 1) no SQL editor do Supabase.
-- [ ] Rodar RLS + policy de INSERT (bloco 2).
-- [ ] Confirmar que NÃO existe nenhuma policy de SELECT para o role anon
--     (testar com a chave publicável: um GET na tabela deve retornar
--     vazio ou erro de permissão, nunca as linhas).
-- [ ] Só depois disso, testar o formulário real em /pesquisa-salarial.
-- [ ] A função de agregação (bloco 3) só é necessária quando alguma
--     função atingir as primeiras 10 respostas — pode esperar.
-- =========================================================================
