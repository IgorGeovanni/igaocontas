-- =====================================================================
-- IGÃO CONTAS — Row Level Security
-- Cada usuário só pode ver e alterar os próprios dados.
-- Nada de confiar em filtros do frontend: tudo é reforçado no banco.
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.incomes enable row level security;
alter table public.expense_sources enable row level security;
alter table public.expense_installments enable row level security;
alter table public.installment_deferrals enable row level security;
alter table public.audit_log enable row level security;
alter table public.agenda_compromissos enable row level security;

-- ---------- PROFILES ----------
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- CATEGORIES ----------
-- Todo usuário autenticado enxerga as categorias padrão (user_id is null)
-- além das suas próprias categorias personalizadas.
create policy "categories_select" on public.categories
  for select using (user_id is null or auth.uid() = user_id);
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

-- ---------- INCOMES ----------
create policy "incomes_select_own" on public.incomes
  for select using (auth.uid() = user_id);
create policy "incomes_insert_own" on public.incomes
  for insert with check (auth.uid() = user_id);
create policy "incomes_update_own" on public.incomes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "incomes_delete_own" on public.incomes
  for delete using (auth.uid() = user_id);

-- ---------- EXPENSE SOURCES ----------
create policy "expense_sources_select_own" on public.expense_sources
  for select using (auth.uid() = user_id);
create policy "expense_sources_insert_own" on public.expense_sources
  for insert with check (auth.uid() = user_id);
create policy "expense_sources_update_own" on public.expense_sources
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "expense_sources_delete_own" on public.expense_sources
  for delete using (auth.uid() = user_id);

-- ---------- EXPENSE INSTALLMENTS ----------
create policy "expense_installments_select_own" on public.expense_installments
  for select using (auth.uid() = user_id);
create policy "expense_installments_insert_own" on public.expense_installments
  for insert with check (auth.uid() = user_id);
create policy "expense_installments_update_own" on public.expense_installments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "expense_installments_delete_own" on public.expense_installments
  for delete using (auth.uid() = user_id);

-- ---------- INSTALLMENT DEFERRALS ----------
create policy "deferrals_select_own" on public.installment_deferrals
  for select using (auth.uid() = user_id);
create policy "deferrals_insert_own" on public.installment_deferrals
  for insert with check (auth.uid() = user_id);

-- ---------- AUDIT LOG ----------
create policy "audit_select_own" on public.audit_log
  for select using (auth.uid() = user_id);
create policy "audit_insert_own" on public.audit_log
  for insert with check (auth.uid() = user_id);

-- ---------- AGENDA ----------
create policy "agenda_select_own" on public.agenda_compromissos
  for select using (auth.uid() = user_id);
create policy "agenda_insert_own" on public.agenda_compromissos
  for insert with check (auth.uid() = user_id);
create policy "agenda_update_own" on public.agenda_compromissos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "agenda_delete_own" on public.agenda_compromissos
  for delete using (auth.uid() = user_id);
