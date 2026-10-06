-- =====================================================================
-- IGÃO CONTAS — Pagamento parcial
-- Seguro rodar em um banco que já está em uso.
--
-- Permite pagar só uma parte do valor de uma conta/parcela agora; o
-- restante vira automaticamente uma nova conta pendente no mês seguinte,
-- ligada à mesma origem (mesma lógica visual de "Adiada de [mês]" que já
-- existe para o botão "Não pago").
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Relaxar a restrição de unicidade em expense_installments.
-- Um pagamento parcial cria uma segunda linha com o MESMO
-- (source_id, numero_parcela, mes_referencia_original) da linha original
-- — de propósito, para preservar a ligação com a origem — então essa
-- restrição antiga passa a impedir um caso legítimo.
-- ---------------------------------------------------------------------
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.expense_installments'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) like '%source_id, numero_parcela, mes_referencia_original%';

  if v_conname is not null then
    execute format('alter table public.expense_installments drop constraint %I', v_conname);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) Permitir o novo tipo 'pagamento_parcial' no histórico de adiamentos.
-- ---------------------------------------------------------------------
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.installment_deferrals'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%tipo%';

  if v_conname is not null then
    execute format('alter table public.installment_deferrals drop constraint %I', v_conname);
  end if;

  alter table public.installment_deferrals
    add constraint installment_deferrals_tipo_check
    check (tipo in ('adiamento', 'duas_parcelas_proximo_mes', 'pagamento_parcial'));
end $$;

-- ---------------------------------------------------------------------
-- 3) Função: pagar parcialmente uma conta/parcela.
-- Se o valor pago cobrir o total, funciona igual a "marcar como pago".
-- Caso contrário, a linha atual registra o que foi pago (e é marcada como
-- paga), e uma nova linha pendente é criada com o restante, no mês
-- seguinte (ou quantos meses o usuário escolher adiar).
-- ---------------------------------------------------------------------
create or replace function public.pay_partial_installment(
  p_installment_id uuid,
  p_valor_pago_centavos bigint,
  p_meses_adiar int default 1
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_row expense_installments%rowtype;
  v_total bigint;
  v_restante bigint;
  v_novo_id uuid;
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
    raise exception 'Essa conta já está paga';
  end if;

  if p_valor_pago_centavos <= 0 then
    raise exception 'Informe um valor pago maior que zero';
  end if;

  v_total := v_row.valor_centavos + v_row.juros_centavos;

  if p_valor_pago_centavos >= v_total then
    update expense_installments
    set status = 'pago', pago_em = now(), atualizado_em = now()
    where id = p_installment_id;
    return;
  end if;

  v_restante := v_total - p_valor_pago_centavos;
  v_novo_mes := (date_trunc('month', v_row.mes_referencia) + (p_meses_adiar || ' months')::interval)::date;
  v_novo_venc := (v_row.vencimento_atual + (p_meses_adiar || ' months')::interval)::date;

  -- a linha original passa a registrar o que foi de fato pago agora
  update expense_installments
  set valor_centavos = p_valor_pago_centavos,
      juros_centavos = 0,
      status = 'pago',
      pago_em = now(),
      atualizado_em = now()
  where id = p_installment_id;

  -- o restante vira uma nova conta pendente, ligada à mesma origem
  insert into expense_installments (
    user_id, source_id, numero_parcela, total_parcelas, valor_centavos, juros_centavos,
    mes_referencia_original, vencimento_original, mes_referencia, vencimento_atual,
    status, transferida
  ) values (
    auth.uid(), v_row.source_id, v_row.numero_parcela, v_row.total_parcelas, v_restante, 0,
    v_row.mes_referencia_original, v_row.vencimento_original, v_novo_mes, v_novo_venc,
    'pendente', true
  ) returning id into v_novo_id;

  insert into installment_deferrals (
    installment_id, user_id, mes_referencia_anterior, mes_referencia_novo,
    vencimento_anterior, vencimento_novo, tipo, motivo
  ) values (
    v_novo_id, auth.uid(), v_row.mes_referencia, v_novo_mes,
    v_row.vencimento_atual, v_novo_venc, 'pagamento_parcial',
    format(
      'Pagamento parcial: pago R$ %s de R$ %s, restante R$ %s adiado.',
      to_char(p_valor_pago_centavos / 100.0, 'FM999999990.00'),
      to_char(v_total / 100.0, 'FM999999990.00'),
      to_char(v_restante / 100.0, 'FM999999990.00')
    )
  );
end;
$$;

grant execute on function public.pay_partial_installment(uuid, bigint, int) to authenticated;
