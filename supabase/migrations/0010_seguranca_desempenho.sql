-- =====================================================================
-- IGÃO CONTAS — Correções de segurança, internet ruim e desempenho
--
-- NÃO APAGA NENHUM DADO (entradas, contas, parcelas, guardado, agenda,
-- categorias e grupos ficam exatamente como estão). Só:
--   - troca 2 funções por versões que não duplicam nada;
--   - cria funções novas de soma (para os totais ficarem certos mesmo
--     com milhares de lançamentos);
--   - acrescenta 1 coluna opcional, índices e a função "ping".
--
-- COMO USAR: Supabase → SQL Editor → New query → cole o arquivo INTEIRO → Run.
-- Pode ser executado mais de uma vez sem problema.
-- Rode ANTES de publicar a nova versão do site na Netlify.
-- =====================================================================

-- Trava: precisa das migrations anteriores. Se faltar, para sem mudar nada.
do $$
declare v_falta text := '';
begin
  if to_regclass('public.expense_installments') is null then
    v_falta := v_falta || ' 0001_schema.sql 0002_rls.sql 0003_functions.sql';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'expense_installments' and column_name = 'juros_centavos') then
    v_falta := v_falta || ' 0005_juros.sql';
  end if;
  if to_regprocedure('public.pay_partial_installment(uuid,bigint,bigint,integer)') is null then
    v_falta := v_falta || ' 0006_pagamento_parcial.sql 0007_juros_no_pagamento.sql';
  end if;
  if to_regclass('public.savings_entries') is null then
    v_falta := v_falta || ' 0008_guardado_investido.sql';
  end if;
  if to_regclass('public.expense_groups') is null
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'expense_sources' and column_name = 'grupo_id') then
    v_falta := v_falta || ' 0009_grupos_seguro.sql';
  end if;
  if v_falta <> '' then
    raise exception 'PARE: antes rode no SQL Editor:%. Nada foi alterado.', v_falta;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 0) CATEGORIAS PADRÃO
-- O arquivo 0004 dava erro ("null value in column user_id of audit_log")
-- porque o histórico tentava registrar as categorias do sistema, que não
-- têm dono. Resultado: as categorias padrão (Salário, Moradia...) podem
-- nunca ter sido criadas. O histórico agora ignora registros sem dono, e as
-- categorias padrão que faltarem são criadas (as suas não são tocadas).
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

  -- registros sem dono (categorias padrão do sistema) não vão para o histórico
  if v_user_id is not null then
    insert into public.audit_log(user_id, acao, tabela, registro_id, detalhes)
    values (v_user_id, v_acao || '_' || tg_table_name, tg_table_name, v_registro_id, v_detalhes);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

insert into public.categories (user_id, nome, tipo, cor, is_default)
select null, c.nome, c.tipo, c.cor, true
  from (values
    ('Salário', 'entrada', '#22C55E'), ('Trabalho', 'entrada', '#22C55E'), ('Bicos', 'entrada', '#4ADE80'),
    ('Vendas', 'entrada', '#4ADE80'), ('Investimentos', 'entrada', '#16A34A'), ('Outros (entrada)', 'entrada', '#86EFAC'),
    ('Moradia', 'saida', '#FF6B4A'), ('Alimentação', 'saida', '#F97316'), ('Transporte', 'saida', '#F59E0B'),
    ('Saúde', 'saida', '#EF4444'), ('Educação', 'saida', '#E2185C'), ('Lazer', 'saida', '#D946EF'),
    ('Assinaturas', 'saida', '#A855F7'), ('Compras', 'saida', '#EC4899'), ('Contas', 'saida', '#F43F5E'),
    ('Outros (saída)', 'saida', '#9A9AA5')
  ) as c(nome, tipo, cor)
 where not exists (
   select 1 from public.categories x where x.user_id is null and x.nome = c.nome and x.tipo = c.tipo
 );


-- ---------------------------------------------------------------------
-- 1) RECORRÊNCIAS SEM DUPLICAR
-- Antes: abrir o Dashboard e o Contas do Mês quase ao mesmo tempo (ou a
-- tela carregar 2x) podia criar a MESMA conta recorrente duas vezes no mês.
-- Agora a geração é feita uma de cada vez por usuário.
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
  if auth.uid() is null then
    return;
  end if;
  -- uma geração por vez para este usuário (a segunda espera a primeira terminar)
  perform pg_advisory_xact_lock(hashtext('igao_recorrencia_' || auth.uid()::text));

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
-- 2) "NÃO PAGO" (ADIAR) SEM ADIAR DUAS VEZES
-- Se a internet cair depois de adiar e a pessoa tocar de novo, a conta
-- não pula 2 meses: o app informa em que mês a conta estava, e se ela já
-- saiu de lá, nada é feito.
-- ---------------------------------------------------------------------
drop function if exists public.defer_installment(uuid, text, int);

create or replace function public.defer_installment(
  p_installment_id uuid,
  p_tipo text default 'adiamento',
  p_meses int default 1,
  p_mes_esperado date default null
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

  -- repetição do mesmo pedido: a conta já foi adiada para outro mês
  if p_mes_esperado is not null and v_row.mes_referencia <> date_trunc('month', p_mes_esperado)::date then
    return;
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

grant execute on function public.defer_installment(uuid, text, int, date) to authenticated;


-- ---------------------------------------------------------------------
-- 3) CADASTRAR CONTA DE UMA VEZ SÓ (sem duplicar com internet ruim)
-- Antes eram até 4 gravações separadas (criar, colocar no grupo, marcar
-- paga, corrigir a data do pagamento): se a internet caísse no meio, a
-- conta ficava pela metade, e tocar em "Salvar" de novo criava outra igual.
-- Agora é tudo numa operação só, e o app manda um código único por
-- cadastro: repetir o mesmo cadastro devolve a conta já criada.
-- ---------------------------------------------------------------------
alter table public.expense_sources add column if not exists chave_criacao uuid;
create unique index if not exists expense_sources_chave_criacao_idx
  on public.expense_sources (user_id, chave_criacao) where chave_criacao is not null;

create or replace function public.criar_conta(
  p_chave uuid,
  p_tipo text,
  p_descricao text,
  p_categoria_id uuid,
  p_grupo_id uuid,
  p_forma_pagamento text,
  p_observacao text,
  p_valor_centavos bigint,          -- avulsa: valor | parcelada: valor TOTAL | recorrente: valor mensal
  p_vencimento date,                -- avulsa: vencimento | parcelada: 1º vencimento | recorrente: início
  p_mes_referencia date default null,
  p_num_parcelas int default null,
  p_dia_vencimento int default null,
  p_pago_em timestamptz default null -- preenchido = já cadastra paga (parcelada/recorrente: só a 1ª)
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_primeira uuid;
begin
  if auth.uid() is null then
    raise exception 'Faça login novamente.';
  end if;

  if p_chave is not null then
    -- dois toques em "Salvar" ao mesmo tempo: o segundo espera e recebe a mesma conta
    perform pg_advisory_xact_lock(hashtext('igao_criar_' || p_chave::text));
    select id into v_id from expense_sources where user_id = auth.uid() and chave_criacao = p_chave;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  if coalesce(p_valor_centavos, 0) <= 0 then
    raise exception 'Informe um valor válido.';
  end if;
  if p_grupo_id is not null and not exists (
    select 1 from expense_groups where id = p_grupo_id and user_id = auth.uid()
  ) then
    raise exception 'Grupo não encontrado.';
  end if;

  if p_tipo = 'simples' then
    v_id := public.create_simple_expense(p_descricao, p_categoria_id, p_valor_centavos, p_vencimento,
                                         p_mes_referencia, p_forma_pagamento, p_observacao);
  elsif p_tipo = 'parcelado' then
    if coalesce(p_num_parcelas, 0) < 1 or p_num_parcelas > 600 then
      raise exception 'Informe o número de parcelas.';
    end if;
    v_id := public.create_installment_purchase(p_descricao, p_categoria_id, p_valor_centavos, p_num_parcelas,
                                               p_vencimento, p_forma_pagamento, p_observacao);
  elsif p_tipo = 'recorrente' then
    if p_dia_vencimento is null or p_dia_vencimento not between 1 and 31 then
      raise exception 'Informe o dia de vencimento (1 a 31).';
    end if;
    v_id := public.create_recurring_expense(p_descricao, p_categoria_id, p_valor_centavos, p_dia_vencimento,
                                            p_vencimento, p_forma_pagamento, p_observacao);
  else
    raise exception 'Tipo de conta inválido.';
  end if;

  update expense_sources set grupo_id = p_grupo_id, chave_criacao = p_chave where id = v_id;

  if p_pago_em is not null then
    select id into v_primeira from expense_installments
     where source_id = v_id order by vencimento_atual, numero_parcela limit 1;
    update expense_installments
       set status = 'pago', pago_em = p_pago_em, atualizado_em = now()
     where id = v_primeira;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.criar_conta(uuid, text, text, uuid, uuid, text, text, bigint, date, date, int, int, timestamptz) from public, anon;
grant execute on function public.criar_conta(uuid, text, text, uuid, uuid, text, text, bigint, date, date, int, int, timestamptz) to authenticated;


-- ---------------------------------------------------------------------
-- 4) TOTAIS CALCULADOS NO BANCO
-- O Supabase devolve no máximo 1000 linhas por consulta. O "Saldo para
-- comparar com o banco", o "Total devido" e o saldo anterior do Relatório
-- somavam TODOS os lançamentos no celular: passando de 1000, a soma saía
-- errada sem aviso. Agora o banco soma tudo e manda só o resultado
-- (também bem mais leve para a internet do celular).
-- ---------------------------------------------------------------------
create or replace function public.resumo_saldos(
  p_antes_de date default null,             -- relatório: soma do que é anterior a este mês
  p_caixa_data_ini date default null,       -- fluxo de caixa: entradas com data neste intervalo
  p_caixa_data_fim date default null,
  p_caixa_ts_ini timestamptz default null,  -- fluxo de caixa: contas pagas neste intervalo
  p_caixa_ts_fim timestamptz default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'entradas_total', (select coalesce(sum(valor_centavos), 0)::bigint from incomes where user_id = auth.uid()),
    'pago_total', (select coalesce(sum(valor_centavos + juros_centavos), 0)::bigint
                     from expense_installments where user_id = auth.uid() and status = 'pago'),
    'guardado_total', (select coalesce(sum(valor_centavos), 0)::bigint from savings_entries where user_id = auth.uid()),
    'pendente_total', (select coalesce(sum(valor_centavos + juros_centavos), 0)::bigint
                         from expense_installments where user_id = auth.uid() and status = 'pendente'),
    'pendente_qtd', (select count(*) from expense_installments where user_id = auth.uid() and status = 'pendente'),
    'entradas_antes', case when p_antes_de is null then 0 else
        (select coalesce(sum(valor_centavos), 0)::bigint from incomes
          where user_id = auth.uid() and mes_referencia < p_antes_de) end,
    'despesas_antes', case when p_antes_de is null then 0 else
        (select coalesce(sum(valor_centavos + juros_centavos), 0)::bigint from expense_installments
          where user_id = auth.uid() and mes_referencia < p_antes_de) end,
    'caixa_entradas', case when p_caixa_data_ini is null then 0 else
        (select coalesce(sum(valor_centavos), 0)::bigint from incomes
          where user_id = auth.uid() and data >= p_caixa_data_ini and data < p_caixa_data_fim) end,
    'caixa_saidas', case when p_caixa_ts_ini is null then 0 else
        (select coalesce(sum(valor_centavos + juros_centavos), 0)::bigint from expense_installments
          where user_id = auth.uid() and status = 'pago' and pago_em >= p_caixa_ts_ini and pago_em < p_caixa_ts_fim) end
  );
$$;

-- Parceladas que estão acabando (faltam 1 ou 2 parcelas). Antes buscava
-- todas as parcelas de todas as compras (lento e limitado a 1000 linhas).
create or replace function public.contas_acabando()
returns table(source_id uuid, descricao text, numero_atual int, total_parcelas int, faltam int)
language sql
stable
security invoker
set search_path = public
as $$
  with p as (
    select ei.source_id, ei.numero_parcela, ei.status, ei.total_parcelas
      from expense_installments ei
      join expense_sources es on es.id = ei.source_id
     where es.user_id = auth.uid() and es.tipo = 'parcelado'
  ), t as (
    select p.source_id,
           coalesce(max(p.total_parcelas), 0)::int as total,
           (count(*) filter (where p.status = 'pago'))::int as pagas,
           min(p.numero_parcela) filter (where p.status = 'pendente') as proxima
      from p group by p.source_id
  )
  select t.source_id, es.descricao, coalesce(t.proxima, t.total)::int, t.total, (t.total - t.pagas)::int
    from t join expense_sources es on es.id = t.source_id
   where t.total - t.pagas between 1 and 2
   order by t.total - t.pagas, es.descricao;
$$;

-- Gráfico "Pago x a pagar": somas por categoria e por grupo, em todos os
-- meses e só no mês escolhido (antes baixava TODAS as parcelas a cada abertura do Dashboard).
create or replace function public.pago_pendente_resumo(p_mes date, p_ts_ini timestamptz, p_ts_fim timestamptz)
returns table(agrupar text, chave uuid, periodo text, pago bigint, pendente bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with l as (
    select ei.status, ei.valor_centavos + ei.juros_centavos as v, ei.pago_em, ei.mes_referencia,
           es.categoria_id, es.grupo_id
      from expense_installments ei
      left join expense_sources es on es.id = ei.source_id
     where ei.user_id = auth.uid()
  ), lp as (
    select l.*, 'tudo'::text as periodo from l
    union all
    select l.*, 'mes'::text from l
     where (l.status = 'pago' and l.pago_em >= p_ts_ini and l.pago_em < p_ts_fim)
        or (l.status <> 'pago' and l.mes_referencia = p_mes)
  )
  select 'categoria', categoria_id, periodo,
         coalesce(sum(v) filter (where status = 'pago'), 0)::bigint,
         coalesce(sum(v) filter (where status <> 'pago'), 0)::bigint
    from lp group by categoria_id, periodo
  union all
  select 'grupo', grupo_id, periodo,
         coalesce(sum(v) filter (where status = 'pago'), 0)::bigint,
         coalesce(sum(v) filter (where status <> 'pago'), 0)::bigint
    from lp group by grupo_id, periodo;
$$;

revoke execute on function public.resumo_saldos(date, date, date, timestamptz, timestamptz) from public, anon;
revoke execute on function public.contas_acabando() from public, anon;
revoke execute on function public.pago_pendente_resumo(date, timestamptz, timestamptz) from public, anon;
grant execute on function public.resumo_saldos(date, date, date, timestamptz, timestamptz) to authenticated;
grant execute on function public.contas_acabando() to authenticated;
grant execute on function public.pago_pendente_resumo(date, timestamptz, timestamptz) to authenticated;


-- ---------------------------------------------------------------------
-- 5) ÍNDICES (consultas rápidas mesmo com anos de lançamentos)
-- ---------------------------------------------------------------------
create index if not exists idx_installments_user_pago_em
  on public.expense_installments (user_id, pago_em) where status = 'pago';
create index if not exists idx_installments_user_pendente_venc
  on public.expense_installments (user_id, vencimento_atual) where status = 'pendente';
create index if not exists idx_installments_source_mes_original
  on public.expense_installments (source_id, mes_referencia_original);
create index if not exists idx_incomes_user_data on public.incomes (user_id, data);
create index if not exists idx_expense_sources_user_criado on public.expense_sources (user_id, criado_em desc);


-- ---------------------------------------------------------------------
-- 6) "PING" PARA O SUPABASE NÃO PAUSAR
-- Chamado 1x por dia pela Netlify. Não lê nem grava nenhum dado.
-- ---------------------------------------------------------------------
create or replace function public.ping()
returns integer language sql stable as $$ select 1 $$;
grant execute on function public.ping() to anon, authenticated;

-- faz a API do Supabase enxergar as funções novas na hora
notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------
-- CONFERÊNCIA (aparece embaixo, em Results)
-- "recorrentes_possivelmente_duplicadas": contas recorrentes que aparecem
-- 2x no mesmo mês (causadas pelo problema corrigido no item 1). NADA é
-- apagado automaticamente — confira no app e exclua a repetida se for o caso.
-- ---------------------------------------------------------------------
select
  (select count(*) from public.incomes) as entradas,
  (select count(*) from public.expense_sources) as contas,
  (select count(*) from public.expense_installments) as parcelas,
  (select count(*) from public.savings_entries) as guardado,
  (select coalesce(string_agg(d.descricao || ' (' || to_char(d.mes, 'MM/YYYY') || ')', ', '), 'nenhuma')
     from (select es.descricao, ei.mes_referencia_original as mes
             from public.expense_installments ei
             join public.expense_sources es on es.id = ei.source_id
            where es.tipo = 'recorrente' and not ei.transferida
            group by es.descricao, ei.source_id, ei.mes_referencia_original
           having count(*) > 1) d) as recorrentes_possivelmente_duplicadas;
