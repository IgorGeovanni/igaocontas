-- =====================================================================
-- IGÃO CONTAS — Tag "Importante" nas contas
--
-- NÃO APAGA NENHUM DADO. Só acrescenta 1 coluna (importante) na tabela de
-- contas, começando como "não" para tudo que já existe.
--
-- A tag fica na CONTA (expense_sources), não na parcela:
--   - conta recorrente: marcou uma vez, vale para todos os meses (passados,
--     o atual e os que ainda vão ser criados);
--   - conta parcelada: vale para todas as parcelas da compra;
--   - conta avulsa: vale para a própria conta.
--
-- COMO USAR: Supabase → SQL Editor → New query → cole o arquivo INTEIRO → Run.
-- Pode ser executado mais de uma vez sem problema.
-- Rode ANTES de publicar a nova versão do site na Netlify.
-- =====================================================================

-- Trava: precisa das migrations anteriores. Se faltar, para sem mudar nada.
do $$
begin
  if to_regclass('public.expense_sources') is null
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'expense_sources' and column_name = 'grupo_id') then
    raise exception 'PARE: antes rode no SQL Editor as migrations 0001 a 0010 (a 0009_grupos_seguro.sql e a 0010_seguranca_desempenho.sql). Nada foi alterado.';
  end if;
end $$;

alter table public.expense_sources
  add column if not exists importante boolean not null default false;

-- faz a API do Supabase enxergar a coluna nova na hora
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- CONFERÊNCIA (aparece embaixo, em Results): os números não devem mudar.
-- ---------------------------------------------------------------------
select
  (select count(*) from public.expense_sources) as contas,
  (select count(*) from public.expense_installments) as parcelas,
  (select count(*) from public.expense_sources where importante) as contas_importantes;
