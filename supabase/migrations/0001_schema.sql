-- =====================================================================
-- IGÃO CONTAS — Schema principal
-- Rode este arquivo no SQL Editor do Supabase (ou via supabase db push)
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- PERFIS (dados extras do usuário além do auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  moeda text not null default 'BRL',
  criado_em timestamptz not null default now()
);

-- Cria o perfil automaticamente quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- CATEGORIAS (entrada/saída, padrão do sistema ou criada pelo usuário)
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- null = categoria padrão do sistema
  nome text not null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  cor text not null default '#E2185C',
  icone text,
  is_default boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (user_id, nome, tipo)
);

create index idx_categories_user on public.categories(user_id);
create index idx_categories_tipo on public.categories(tipo);

-- ---------------------------------------------------------------------
-- ENTRADAS
-- ---------------------------------------------------------------------
create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  descricao text not null,
  categoria_id uuid references public.categories(id) on delete set null,
  valor_centavos bigint not null check (valor_centavos >= 0),
  data date not null,
  mes_referencia date not null, -- sempre truncado para o dia 1 do mês
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_incomes_user_mes on public.incomes(user_id, mes_referencia);
create index idx_incomes_user_categoria on public.incomes(user_id, categoria_id);

-- ---------------------------------------------------------------------
-- FONTES DE DESPESA
-- Representa a "origem" de uma conta: um lançamento simples (avulso),
-- uma compra parcelada ou uma conta recorrente.
-- ---------------------------------------------------------------------
create table public.expense_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  descricao text not null,
  categoria_id uuid references public.categories(id) on delete set null,
  tipo text not null check (tipo in ('simples', 'parcelado', 'recorrente')),
  forma_pagamento text,
  observacao text,

  -- usados quando tipo = 'parcelado'
  valor_total_centavos bigint,
  num_parcelas int,

  -- usados quando tipo = 'recorrente'
  valor_recorrente_centavos bigint,
  periodicidade text default 'mensal' check (periodicidade in ('mensal')),
  dia_vencimento int check (dia_vencimento between 1 and 31),
  ativo boolean not null default true,

  primeiro_vencimento date not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_expense_sources_user on public.expense_sources(user_id);
create index idx_expense_sources_tipo on public.expense_sources(user_id, tipo);

-- ---------------------------------------------------------------------
-- PARCELAS / CONTAS DO MÊS
-- Cada linha aqui é uma "conta" concreta que aparece em algum mês.
-- Toda conta (simples, parcela de compra ou ocorrência recorrente)
-- vira uma linha nesta tabela, sempre ligada à sua fonte (expense_sources).
-- ---------------------------------------------------------------------
create table public.expense_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.expense_sources(id) on delete cascade,

  numero_parcela int not null default 1,
  total_parcelas int, -- null quando não se aplica (recorrente contínua)

  valor_centavos bigint not null check (valor_centavos >= 0),

  -- juros/multa avulsa: preenchida manualmente pelo usuário quando precisar,
  -- nunca calculada automaticamente por atraso de vencimento
  juros_centavos bigint not null default 0 check (juros_centavos >= 0),

  -- competência/vencimento ORIGINAL: nunca muda depois de criado
  mes_referencia_original date not null,
  vencimento_original date not null,

  -- competência/vencimento ATUAL: muda quando a conta é adiada
  mes_referencia date not null,
  vencimento_atual date not null,

  -- 'atrasado' é sempre calculado em tempo real (vencimento_atual < hoje e pendente),
  -- nunca é gravado no banco, para não depender de um job para "atualizar status".
  status text not null default 'pendente' check (status in ('pendente', 'pago')),
  pago_em timestamptz,

  transferida boolean not null default false, -- true se já foi adiada alguma vez

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  unique (source_id, numero_parcela, mes_referencia_original)
);

create index idx_installments_user_mes on public.expense_installments(user_id, mes_referencia);
create index idx_installments_source on public.expense_installments(source_id);
create index idx_installments_status on public.expense_installments(user_id, status);

-- ---------------------------------------------------------------------
-- HISTÓRICO DE ADIAMENTOS (rastreabilidade completa)
-- ---------------------------------------------------------------------
create table public.installment_deferrals (
  id uuid primary key default gen_random_uuid(),
  installment_id uuid not null references public.expense_installments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  mes_referencia_anterior date not null,
  mes_referencia_novo date not null,
  vencimento_anterior date not null,
  vencimento_novo date not null,

  tipo text not null default 'adiamento' check (tipo in ('adiamento', 'duas_parcelas_proximo_mes')),
  motivo text,

  criado_em timestamptz not null default now()
);

create index idx_deferrals_installment on public.installment_deferrals(installment_id);
create index idx_deferrals_user on public.installment_deferrals(user_id);

-- ---------------------------------------------------------------------
-- HISTÓRICO / AUDITORIA GERAL
-- ---------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  acao text not null,       -- ex: 'criar_entrada', 'marcar_pago', 'adiar_parcela'
  tabela text not null,     -- ex: 'incomes', 'expense_installments'
  registro_id uuid,
  detalhes jsonb,
  criado_em timestamptz not null default now()
);

create index idx_audit_user on public.audit_log(user_id, criado_em desc);

-- ---------------------------------------------------------------------
-- AGENDA (independente do controle financeiro)
-- ---------------------------------------------------------------------
create table public.agenda_compromissos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  data date not null,
  horario time,
  observacao text,
  concluido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_agenda_user_data on public.agenda_compromissos(user_id, data);
