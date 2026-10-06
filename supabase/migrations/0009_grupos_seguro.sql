-- =====================================================================
-- IGÃO CONTAS — Grupos de contas (versão que pode ser rodada várias vezes)
-- Use esta se a 0009_grupos.sql não foi executada ou deu erro no meio.
-- =====================================================================

create table if not exists public.expense_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  cor text not null default '#9A9AA5',
  criado_em timestamptz not null default now(),
  unique (user_id, nome)
);

alter table public.expense_sources
  add column if not exists grupo_id uuid references public.expense_groups(id) on delete set null;

create index if not exists idx_expense_sources_grupo on public.expense_sources(grupo_id);

alter table public.expense_groups enable row level security;

drop policy if exists "expense_groups_select_own" on public.expense_groups;
drop policy if exists "expense_groups_insert_own" on public.expense_groups;
drop policy if exists "expense_groups_update_own" on public.expense_groups;
drop policy if exists "expense_groups_delete_own" on public.expense_groups;

create policy "expense_groups_select_own" on public.expense_groups
  for select using (auth.uid() = user_id);
create policy "expense_groups_insert_own" on public.expense_groups
  for insert with check (auth.uid() = user_id);
create policy "expense_groups_update_own" on public.expense_groups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "expense_groups_delete_own" on public.expense_groups
  for delete using (auth.uid() = user_id);

drop trigger if exists trg_audit_expense_groups on public.expense_groups;
create trigger trg_audit_expense_groups
  after insert or update or delete on public.expense_groups
  for each row execute procedure public.audit_trigger();

-- faz a API do Supabase enxergar a tabela nova na hora
notify pgrst, 'reload schema';
