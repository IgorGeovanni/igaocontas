-- =====================================================================
-- IGÃO CONTAS — Grupos de contas
-- Seguro rodar em um banco que já está em uso.
--
-- Agrupa várias contas sob um mesmo rótulo livre, independente da
-- categoria. Exemplos de uso: "SAAEB" juntando todas as contas de água
-- daquela concessionária, "CPFL" para energia, ou o nome de uma pessoa
-- para somar tudo que você deve a ela.
-- =====================================================================

create table public.expense_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  cor text not null default '#9A9AA5',
  criado_em timestamptz not null default now(),
  unique (user_id, nome)
);

alter table public.expense_sources
  add column if not exists grupo_id uuid references public.expense_groups(id) on delete set null;

create index idx_expense_sources_grupo on public.expense_sources(grupo_id);

alter table public.expense_groups enable row level security;

create policy "expense_groups_select_own" on public.expense_groups
  for select using (auth.uid() = user_id);
create policy "expense_groups_insert_own" on public.expense_groups
  for insert with check (auth.uid() = user_id);
create policy "expense_groups_update_own" on public.expense_groups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "expense_groups_delete_own" on public.expense_groups
  for delete using (auth.uid() = user_id);

create trigger trg_audit_expense_groups
  after insert or update or delete on public.expense_groups
  for each row execute procedure public.audit_trigger();
