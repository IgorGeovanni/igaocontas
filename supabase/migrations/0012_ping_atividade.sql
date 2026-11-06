-- =====================================================================
-- PING COM ATIVIDADE REAL — evita o Supabase grátis pausar o projeto
--
-- O ping antigo só fazia "select 1" e não mexia em nenhuma tabela. O Supabase
-- pode não contar isso como atividade. Agora o ping ATUALIZA uma tabelinha
-- (keep_alive) com 1 única linha: a data/hora do último ping e quantas vezes
-- já rodou. Isso é atividade real no banco, e a tabela nunca cresce (sempre 1 linha).
--
-- NÃO MEXE em nenhum dado do sistema. Só cria 1 tabela nova e troca a função ping.
-- Serve para QUALQUER um dos projetos (K-Mix, Kanoa, Igão Contas): rode o MESMO
-- arquivo no SQL Editor de cada projeto. Pode rodar mais de uma vez.
--
-- COMO USAR: Supabase → SQL Editor → New query → cole o arquivo INTEIRO → Run.
-- =====================================================================

create table if not exists public.keep_alive (
  id         integer primary key default 1 check (id = 1),   -- só pode existir a linha 1
  ultima_vez timestamptz not null default now(),
  contagem   bigint      not null default 0
);

-- Ninguém de fora lê nem grava nesta tabela: só a função ping abaixo.
alter table public.keep_alive enable row level security;
revoke all on public.keep_alive from anon, authenticated;

insert into public.keep_alive (id) values (1) on conflict (id) do nothing;

create or replace function public.ping()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.keep_alive
     set ultima_vez = now(), contagem = contagem + 1
   where id = 1;
  if not found then
    insert into public.keep_alive (id, contagem) values (1, 1) on conflict (id) do nothing;
  end if;
  return 1;
end;
$$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

notify pgrst, 'reload schema';

-- CONFERÊNCIA: deve mostrar 1 linha e a contagem já aumentada pelo teste abaixo.
select public.ping() as ping_ok;
select id, ultima_vez, contagem from public.keep_alive;
