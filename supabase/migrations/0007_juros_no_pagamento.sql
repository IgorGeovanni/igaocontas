-- =====================================================================
-- IGÃO CONTAS — Juros avulso no momento do pagamento
-- Seguro rodar em um banco que já está em uso.
--
-- Atualiza pay_partial_installment para aceitar um juros adicional
-- informado na hora de marcar como pago (além do que já possa existir
-- na conta). Substitui a versão anterior da função.
-- =====================================================================

drop function if exists public.pay_partial_installment(uuid, bigint, int);

create or replace function public.pay_partial_installment(
  p_installment_id uuid,
  p_valor_pago_centavos bigint,
  p_juros_adicional_centavos bigint default 0,
  p_meses_adiar int default 1
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_row expense_installments%rowtype;
  v_juros_final bigint;
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

  v_juros_final := v_row.juros_centavos + coalesce(p_juros_adicional_centavos, 0);
  v_total := v_row.valor_centavos + v_juros_final;

  if p_valor_pago_centavos >= v_total then
    update expense_installments
    set juros_centavos = v_juros_final,
        status = 'pago',
        pago_em = now(),
        atualizado_em = now()
    where id = p_installment_id;
    return;
  end if;

  v_restante := v_total - p_valor_pago_centavos;
  v_novo_mes := (date_trunc('month', v_row.mes_referencia) + (p_meses_adiar || ' months')::interval)::date;
  v_novo_venc := (v_row.vencimento_atual + (p_meses_adiar || ' months')::interval)::date;

  update expense_installments
  set valor_centavos = p_valor_pago_centavos,
      juros_centavos = 0,
      status = 'pago',
      pago_em = now(),
      atualizado_em = now()
  where id = p_installment_id;

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
      'Pagamento parcial: pago R$ %s de R$ %s (inclui R$ %s de juros), restante R$ %s adiado.',
      to_char(p_valor_pago_centavos / 100.0, 'FM999999990.00'),
      to_char(v_total / 100.0, 'FM999999990.00'),
      to_char(v_juros_final / 100.0, 'FM999999990.00'),
      to_char(v_restante / 100.0, 'FM999999990.00')
    )
  );
end;
$$;

grant execute on function public.pay_partial_installment(uuid, bigint, bigint, int) to authenticated;
