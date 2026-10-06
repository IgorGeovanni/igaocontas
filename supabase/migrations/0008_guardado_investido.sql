-- =====================================================================
-- IGÃO CONTAS — Dinheiro guardado / investido
-- Seguro rodar em um banco que já está em uso.
--
-- Registro à parte de entradas/saídas: dinheiro que você tirou do fluxo
-- do dia a dia e guardou ou investiu em algum lugar. Entra no cálculo do
-- "saldo para comparar com o banco" (reduz o saldo disponível, já que
-- esse dinheiro normalmente sai da conta corrente).
-- =====================================================================

create table public.savings_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  descricao text not null,
  tipo text not null default 'guardado' check (tipo in ('guardado', 'investido')),
  valor_centavos bigint not null check (valor_centavos >= 0),
  local text, -- onde: nome do banco, corretora, caixinha, etc.
  data date not null,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_savings_user_data on public.savings_entries(user_id, data);

alter table public.savings_entries enable row level security;

create policy "savings_select_own" on public.savings_entries
  for select using (auth.uid() = user_id);
create policy "savings_insert_own" on public.savings_entries
  for insert with check (auth.uid() = user_id);
create policy "savings_update_own" on public.savings_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "savings_delete_own" on public.savings_entries
  for delete using (auth.uid() = user_id);

create trigger trg_audit_savings_entries
  after insert or update or delete on public.savings_entries
  for each row execute procedure public.audit_trigger();
