-- =====================================================================
-- IGÃO CONTAS — Categorias padrão (visíveis para todos os usuários)
-- =====================================================================

insert into public.categories (user_id, nome, tipo, cor, is_default) values
  (null, 'Salário', 'entrada', '#22C55E', true),
  (null, 'Trabalho', 'entrada', '#22C55E', true),
  (null, 'Bicos', 'entrada', '#4ADE80', true),
  (null, 'Vendas', 'entrada', '#4ADE80', true),
  (null, 'Investimentos', 'entrada', '#16A34A', true),
  (null, 'Outros (entrada)', 'entrada', '#86EFAC', true),

  (null, 'Moradia', 'saida', '#FF6B4A', true),
  (null, 'Alimentação', 'saida', '#F97316', true),
  (null, 'Transporte', 'saida', '#F59E0B', true),
  (null, 'Saúde', 'saida', '#EF4444', true),
  (null, 'Educação', 'saida', '#E2185C', true),
  (null, 'Lazer', 'saida', '#D946EF', true),
  (null, 'Assinaturas', 'saida', '#A855F7', true),
  (null, 'Compras', 'saida', '#EC4899', true),
  (null, 'Contas', 'saida', '#F43F5E', true),
  (null, 'Outros (saída)', 'saida', '#9A9AA5', true)
on conflict do nothing;
