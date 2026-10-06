// Tipos que espelham as tabelas do Supabase.
// Valores monetários são sempre inteiros em CENTAVOS (bigint no banco,
// number aqui — seguro até ~9x10^15, muito acima do necessário).

export type TipoCategoria = "entrada" | "saida";
export type TipoFonteDespesa = "simples" | "parcelado" | "recorrente";
export type StatusParcela = "pendente" | "pago";
export type TipoAdiamento = "adiamento" | "duas_parcelas_proximo_mes" | "pagamento_parcial";

export interface Profile {
  id: string;
  nome: string | null;
  moeda: string;
  criado_em: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  nome: string;
  tipo: TipoCategoria;
  cor: string;
  icone: string | null;
  is_default: boolean;
  criado_em: string;
}

export interface Income {
  id: string;
  user_id: string;
  descricao: string;
  categoria_id: string | null;
  valor_centavos: number;
  data: string;
  mes_referencia: string;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ExpenseGroup {
  id: string;
  user_id: string;
  nome: string;
  cor: string;
  criado_em: string;
}

export interface ExpenseSource {
  id: string;
  user_id: string;
  descricao: string;
  categoria_id: string | null;
  grupo_id: string | null;
  tipo: TipoFonteDespesa;
  forma_pagamento: string | null;
  observacao: string | null;
  valor_total_centavos: number | null;
  num_parcelas: number | null;
  valor_recorrente_centavos: number | null;
  periodicidade: string | null;
  dia_vencimento: number | null;
  ativo: boolean;
  primeiro_vencimento: string;
  criado_em: string;
  atualizado_em: string;
}

export interface ExpenseInstallment {
  id: string;
  user_id: string;
  source_id: string;
  numero_parcela: number;
  total_parcelas: number | null;
  valor_centavos: number;
  juros_centavos: number;
  mes_referencia_original: string;
  vencimento_original: string;
  mes_referencia: string;
  vencimento_atual: string;
  status: StatusParcela;
  pago_em: string | null;
  transferida: boolean;
  criado_em: string;
  atualizado_em: string;
}

// Parcela "enriquecida" com dados da fonte, usada na UI
export interface ExpenseInstallmentWithSource extends ExpenseInstallment {
  expense_sources: ExpenseSource;
}

export interface InstallmentDeferral {
  id: string;
  installment_id: string;
  user_id: string;
  mes_referencia_anterior: string;
  mes_referencia_novo: string;
  vencimento_anterior: string;
  vencimento_novo: string;
  tipo: TipoAdiamento;
  motivo: string | null;
  criado_em: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  acao: string;
  tabela: string;
  registro_id: string | null;
  detalhes: Record<string, unknown> | null;
  criado_em: string;
}

export type TipoGuardado = "guardado" | "investido";

export interface SavingsEntry {
  id: string;
  user_id: string;
  descricao: string;
  tipo: TipoGuardado;
  valor_centavos: number;
  local: string | null;
  data: string;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface AgendaCompromisso {
  id: string;
  user_id: string;
  titulo: string;
  data: string;
  horario: string | null;
  observacao: string | null;
  concluido: boolean;
  criado_em: string;
  atualizado_em: string;
}
