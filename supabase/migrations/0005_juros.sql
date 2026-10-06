-- =====================================================================
-- IGÃO CONTAS — Juros avulso por parcela/conta
-- Rode este arquivo no SQL Editor do Supabase (é seguro rodar em um banco
-- que já está em uso — só adiciona uma coluna nova, não apaga nada).
-- =====================================================================

alter table public.expense_installments
  add column if not exists juros_centavos bigint not null default 0
    check (juros_centavos >= 0);

comment on column public.expense_installments.juros_centavos is
  'Juros/multa avulsa adicionada manualmente a esta conta/parcela específica, '
  'em centavos. Não é calculada automaticamente por atraso — é sempre um valor '
  'que o próprio usuário informa quando precisa.';
