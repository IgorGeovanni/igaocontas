-- =====================================================================
-- IGÃO CONTAS — Funções de negócio
-- Toda a lógica financeira sensível mora no banco (não só no frontend).
-- Todas as funções usam auth.uid() internamente — nunca confiam em um
-- user_id vindo de fora.
-- =====================================================================

-- ---------------------------------------------------------------------
-- AUDITORIA GENÉRICA
-- ---------------------------------------------------------------------
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_acao text;
  v_registro_id uuid;
  v_detalhes jsonb;
begin
  if tg_op = 'INSERT' then
    v_user_id := new.user_id;
    v_acao := 'criar';
    v_registro_id := new.id;
    v_detalhes := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_user_id := new.user_id;
    v_acao := 'editar';
    v_registro_id := new.id;
    v_detalhes := jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new));
  elsif tg_op = 'DELETE' then
    v_user_id := old.user_id;
    v_acao := 'excluir';
    v_registro_id := old.id;
    v_detalhes := to_jsonb(old);
  end if;

  insert into public.audit_log(user_id, acao, tabela, registro_id, detalhes)
  values (v_user_id, v_acao || '_' || tg_table_name, tg_table_name, v_registro_id, v_detalhes);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Entradas: audita criação, edição e exclusão
create trigger trg_audit_incomes
  after insert or update or delete on public.incomes
  for each row execute procedure public.audit_trigger();

-- Fontes de despesa (contas simples/parceladas/recorrentes): idem
create trigger trg_audit_expense_sources
  after insert or update or delete on public.expense_sources
  for each row execute procedure public.audit_trigger();

-- Parcelas: só audita EDIÇÃO (pago / não pago / adiada) para não gerar
-- ruído quando uma compra de 10x cria 10 linhas de uma vez
create trigger trg_audit_expense_installments
  after update on public.expense_installments
  for each row execute procedure public.audit_trigger();

-- Categorias: audita alterações
create trigger trg_audit_categories
  after insert or update or delete on public.categories
  for each row execute procedure public.audit_trigger();


-- ---------------------------------------------------------------------
-- CRIAR CONTA SIMPLES (avulsa, não parcelada, não recorrente)
-- ---------------------------------------------------------------------
create or replace function public.create_simple_expense(
  p_descricao text,
  p_categoria_id uuid,
  p_valor_centavos bigint,
  p_vencimento date,
  p_mes_referencia date default null,
  p_forma_pagamento text default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_source_id uuid;
  v_mes date;
begin
  v_mes := coalesce(date_trunc('month', p_mes_referencia)::date, date_trunc('month', p_vencimento)::date);

  insert into expense_sources (
    user_id, descricao, categoria_id, tipo, forma_pagamento, observacao, primeiro_vencimento
  ) values (
    auth.uid(), p_descricao, p_categoria_id, 'simples', p_forma_pagamento, p_observacao, p_vencimento
  ) returning id into v_source_id;

  insert into expense_installments (
    user_id, source_id, numero_parcela, total_parcelas, valor_centavos,
    mes_referencia_original, vencimento_original, mes_referencia, vencimento_atual, status
  ) values (
    auth.uid(), v_source_id, 1, 1, p_valor_centavos,
    v_mes, p_vencimento, v_mes, p_vencimento, 'pendente'
  );

  return v_source_id;
end;
$$;

grant execute on function public.create_simple_expense(text, uuid, bigint, date, date, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- CRIAR COMPRA PARCELADA
-- Gera automaticamente TODAS as parcelas, cada uma no seu mês,
-- distribuindo eventuais centavos de arredondamento na última parcela
-- para que a soma bata exatamente com o valor total.
-- ---------------------------------------------------------------------
create or replace function public.create_installment_purchase(
  p_descricao text,
  p_categoria_id uuid,
  p_valor_total_centavos bigint,
  p_num_parcelas int,
  p_primeiro_vencimento date,
  p_forma_pagamento text default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_source_id uuid;
  v_valor_parcela bigint;
  v_soma_parcial bigint := 0;
  v_valor_desta bigint;
  v_venc date;
  v_mes date;
  i int;
begin
  if p_num_parcelas < 1 then
    raise exception 'Número de parcelas deve ser pelo menos 1';
  end if;

  v_valor_parcela := p_valor_total_centavos / p_num_parcelas; -- divisão inteira (floor)

  insert into expense_sources (
    user_id, descricao, categoria_id, tipo, forma_pagamento, observacao,
    valor_total_centavos, num_parcelas, primeiro_vencimento
  ) values (
    auth.uid(), p_descricao, p_categoria_id, 'parcelado', p_forma_pagamento, p_observacao,
    p_valor_total_centavos, p_num_parcelas, p_primeiro_vencimento
  ) returning id into v_source_id;

  for i in 1..p_num_parcelas loop
    v_venc := (p_primeiro_vencimento + ((i - 1) || ' months')::interval)::date;
    v_mes := date_trunc('month', v_venc)::date;

    if i < p_num_parcelas then
      v_valor_desta := v_valor_parcela;
    else
      -- última parcela absorve o resto da divisão, garantindo soma exata
      v_valor_desta := p_valor_total_centavos - v_soma_parcial;
    end if;
    v_soma_parcial := v_soma_parcial + v_valor_desta;

    insert into expense_installments (
      user_id, source_id, numero_parcela, total_parcelas, valor_centavos,
      mes_referencia_original, vencimento_original, mes_referencia, vencimento_atual, status
    ) values (
      auth.uid(), v_source_id, i, p_num_parcelas, v_valor_desta,
      v_mes, v_venc, v_mes, v_venc, 'pendente'
    );
  end loop;

  return v_source_id;
end;
$$;

grant execute on function public.create_installment_purchase(text, uuid, bigint, int, date, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- CRIAR CONTA RECORRENTE
-- Cria a fonte + a primeira ocorrência. As ocorrências dos meses
-- seguintes são geradas sob demanda por generate_recurring_installments.
-- ---------------------------------------------------------------------
create or replace function public.create_recurring_expense(
  p_descricao text,
  p_categoria_id uuid,
  p_valor_centavos bigint,
  p_dia_vencimento int,
  p_primeiro_vencimento date,
  p_forma_pagamento text default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_source_id uuid;
  v_mes date;
begin
  v_mes := date_trunc('month', p_primeiro_vencimento)::date;

  insert into expense_sources (
    user_id, descricao, categoria_id, tipo, forma_pagamento, observacao,
    valor_recorrente_centavos, dia_vencimento, ativo, primeiro_vencimento
  ) values (
    auth.uid(), p_descricao, p_categoria_id, 'recorrente', p_forma_pagamento, p_observacao,
    p_valor_centavos, p_dia_vencimento, true, p_primeiro_vencimento
  ) returning id into v_source_id;

  insert into expense_installments (
    user_id, source_id, numero_parcela, total_parcelas, valor_centavos,
    mes_referencia_original, vencimento_original, mes_referencia, vencimento_atual, status
  ) values (
    auth.uid(), v_source_id, 1, null, p_valor_centavos,
    v_mes, p_primeiro_vencimento, v_mes, p_primeiro_vencimento, 'pendente'
  );

  return v_source_id;
end;
$$;

grant execute on function public.create_recurring_expense(text, uuid, bigint, int, date, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- ATIVAR/DESATIVAR RECORRÊNCIA
-- Desativar não apaga o histórico, apenas impede novas ocorrências futuras.
-- ---------------------------------------------------------------------
create or replace function public.set_recurring_active(p_source_id uuid, p_ativo boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update expense_sources
  set ativo = p_ativo, atualizado_em = now()
  where id = p_source_id and user_id = auth.uid() and tipo = 'recorrente';
end;
$$;

grant execute on function public.set_recurring_active(uuid, boolean) to authenticated;


-- ---------------------------------------------------------------------
-- GERAR OCORRÊNCIAS DE CONTAS RECORRENTES PARA UM MÊS
-- Idempotente: pode ser chamada sempre que o usuário abrir "Contas do Mês".
-- ---------------------------------------------------------------------
create or replace function public.generate_recurring_installments(p_mes date)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  src record;
  v_mes_trunc date;
  v_dia int;
  v_ultimo_dia date;
  v_venc date;
begin
  v_mes_trunc := date_trunc('month', p_mes)::date;
  v_ultimo_dia := (v_mes_trunc + interval '1 month' - interval '1 day')::date;

  for src in
    select * from expense_sources
    where user_id = auth.uid()
      and tipo = 'recorrente'
      and ativo = true
      and date_trunc('month', primeiro_vencimento)::date <= v_mes_trunc
  loop
    if not exists (
      select 1 from expense_installments
      where source_id = src.id and mes_referencia_original = v_mes_trunc
    ) then
      v_dia := coalesce(src.dia_vencimento, extract(day from src.primeiro_vencimento)::int);
      v_venc := least((v_mes_trunc + ((v_dia - 1) || ' days')::interval)::date, v_ultimo_dia);

      insert into expense_installments (
        user_id, source_id, numero_parcela, total_parcelas, valor_centavos,
        mes_referencia_original, vencimento_original, mes_referencia, vencimento_atual, status
      ) values (
        auth.uid(), src.id, 1, null, src.valor_recorrente_centavos,
        v_mes_trunc, v_venc, v_mes_trunc, v_venc, 'pendente'
      );
    end if;
  end loop;
end;
$$;

grant execute on function public.generate_recurring_installments(date) to authenticated;


-- ---------------------------------------------------------------------
-- MARCAR COMO PAGO
-- ---------------------------------------------------------------------
create or replace function public.mark_installment_paid(p_installment_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update expense_installments
  set status = 'pago', pago_em = now(), atualizado_em = now()
  where id = p_installment_id and user_id = auth.uid();
end;
$$;

grant execute on function public.mark_installment_paid(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- DESFAZER PAGAMENTO (volta para pendente, sem adiar)
-- ---------------------------------------------------------------------
create or replace function public.unmark_installment_paid(p_installment_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update expense_installments
  set status = 'pendente', pago_em = null, atualizado_em = now()
  where id = p_installment_id and user_id = auth.uid();
end;
$$;

grant execute on function public.unmark_installment_paid(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- ADIAR PARCELA PARA O MÊS SEGUINTE ("Não Pago")
-- Preserva vencimento/mês de referência ORIGINAIS para sempre e registra
-- o adiamento no histórico. Nunca apaga ou renumera a parcela.
-- p_tipo: 'adiamento' (adiar 1x) ou 'duas_parcelas_proximo_mes'
--         (o usuário confirma que pagará esta + a natural do próximo mês juntas)
-- ---------------------------------------------------------------------
create or replace function public.defer_installment(
  p_installment_id uuid,
  p_tipo text default 'adiamento',
  p_meses int default 1
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_row expense_installments%rowtype;
  v_novo_mes date;
  v_novo_venc date;
begin
  select * into v_row from expense_installments
  where id = p_installment_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Conta não encontrada';
  end if;

  if v_row.status = 'pago' then
    raise exception 'Não é possível adiar uma conta já paga';
  end if;

  v_novo_mes := (date_trunc('month', v_row.mes_referencia) + (p_meses || ' months')::interval)::date;
  v_novo_venc := (v_row.vencimento_atual + (p_meses || ' months')::interval)::date;

  insert into installment_deferrals (
    installment_id, user_id, mes_referencia_anterior, mes_referencia_novo,
    vencimento_anterior, vencimento_novo, tipo
  ) values (
    p_installment_id, auth.uid(), v_row.mes_referencia, v_novo_mes,
    v_row.vencimento_atual, v_novo_venc, p_tipo
  );

  update expense_installments
  set mes_referencia = v_novo_mes,
      vencimento_atual = v_novo_venc,
      transferida = true,
      atualizado_em = now()
  where id = p_installment_id;
end;
$$;

grant execute on function public.defer_installment(uuid, text, int) to authenticated;
