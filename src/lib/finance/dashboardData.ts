import { createClient } from "@/lib/supabase/client";
import { buscarTodos } from "@/lib/supabase/paginar";
import {
  hojeISO,
  inicioDoMesTimestamp,
  mesAnterior,
  mesReferencia,
  mesSeguinte,
  rotuloMesCurto,
} from "@/lib/finance/dates";
import { valorEfetivo } from "@/lib/finance/money";
import { importantesPrimeiro } from "@/lib/finance/importante";
import { subMonths } from "date-fns";
import type { ExpenseInstallment, ExpenseSource, Income } from "@/types/database";

export interface EvolucaoMes {
  mes: string;
  rotulo: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export interface ContaAcabando {
  sourceId: string;
  descricao: string;
  numeroAtual: number;
  totalParcelas: number;
  faltam: number;
}

export interface DashboardData {
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
  totalEntradasAnterior: number;
  totalSaidasAnterior: number;
  saldoAnterior: number;

  totalPendente: number;
  totalPago: number;
  qtdParcelasPendentes: number;
  totalJurosPago: number;
  totalJurosPendente: number;

  totalDevidoGeral: number;
  qtdContasPendentesGeral: number;

  // Regime de caixa: conta pelo mês em que o dinheiro realmente entrou/saiu,
  // não pelo mês da competência da conta.
  caixaEntradasMes: number;
  caixaSaidasMes: number;
  caixaSaldoMes: number;

  // Saldo para comparar com a conta bancária: tudo que já entrou, menos tudo
  // que já foi de fato pago, menos tudo que foi guardado/investido. Não
  // depende de mês nenhum — é o saldo acumulado desde o início.
  saldoBancario: number;
  totalGuardadoInvestido: number;
  totalEntradasGeral: number;
  totalPagoGeral: number;

  proximasContas: ExpenseInstallment[];
  contasAtrasadas: ExpenseInstallment[];
  // ids das CONTAS marcadas como importantes (para mostrar a estrela nas listas acima)
  contasImportantesIds: string[];
  contasAcabando: ContaAcabando[];

  evolucao: EvolucaoMes[];
  despesasPorCategoria: { categoria: string; cor: string; total: number }[];
}

const CAMPOS_PARCELA =
  "id, source_id, numero_parcela, total_parcelas, valor_centavos, juros_centavos, mes_referencia, vencimento_atual, status, pago_em, transferida, mes_referencia_original, vencimento_original, criado_em, atualizado_em, user_id";

interface ResumoSaldos {
  entradas_total: number;
  pago_total: number;
  guardado_total: number;
  pendente_total: number;
  pendente_qtd: number;
  caixa_entradas: number;
  caixa_saidas: number;
}

// Qualquer consulta que falhar derruba o carregamento inteiro (a tela mostra
// "não foi possível carregar"). Antes, uma falha virava ZERO e o Dashboard
// mostrava saldo errado sem avisar — perigoso com internet ruim.
function exigir<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

export async function carregarDashboard(mes: string): Promise<DashboardData> {
  const supabase = createClient();
  const mesAnt = mesAnterior(mes);
  const hoje = hojeISO();

  // gera ocorrências de recorrências para o mês atual e anterior, se ainda não existirem
  // (em sequência: o banco também garante que nunca duplica)
  exigir(await supabase.rpc("generate_recurring_installments", { p_mes: mesAnt }));
  exigir(await supabase.rpc("generate_recurring_installments", { p_mes: mes }));

  const inicioJanela = mesReferencia(subMonths(new Date(`${mes}T00:00:00`), 5));

  const [incomes, installments, sources, atrasadas, resumo, acabando, categoriasRes] = await Promise.all([
    buscarTodos<Pick<Income, "valor_centavos" | "mes_referencia">>((de, ate) =>
      supabase
        .from("incomes")
        .select("valor_centavos, mes_referencia")
        .gte("mes_referencia", inicioJanela)
        .lte("mes_referencia", mes)
        .order("id")
        .range(de, ate)
    ),
    buscarTodos<ExpenseInstallment>((de, ate) =>
      supabase
        .from("expense_installments")
        .select(CAMPOS_PARCELA)
        .gte("mes_referencia", inicioJanela)
        .lte("mes_referencia", mes)
        .order("id")
        .range(de, ate)
    ),
    buscarTodos<Pick<ExpenseSource, "id" | "descricao" | "categoria_id" | "tipo" | "importante">>((de, ate) =>
      supabase.from("expense_sources").select("id, descricao, categoria_id, tipo, importante").order("id").range(de, ate)
    ),
    // busca SEM limite de janela: uma conta atrasada nunca deve "desaparecer" por ser antiga
    buscarTodos<ExpenseInstallment>((de, ate) =>
      supabase
        .from("expense_installments")
        .select(CAMPOS_PARCELA)
        .eq("status", "pendente")
        .lt("vencimento_atual", hoje)
        .order("vencimento_atual", { ascending: true })
        .order("id")
        .range(de, ate)
    ),
    // somas "desde sempre" e do fluxo de caixa: calculadas no banco (sem limite de 1000 linhas)
    supabase.rpc("resumo_saldos", {
      p_antes_de: null,
      p_caixa_data_ini: mes,
      p_caixa_data_fim: mesSeguinte(mes),
      p_caixa_ts_ini: inicioDoMesTimestamp(mes),
      p_caixa_ts_fim: inicioDoMesTimestamp(mesSeguinte(mes)),
    }),
    supabase.rpc("contas_acabando"),
    supabase.from("categories").select("id, nome, cor"),
  ]);

  const r = exigir(resumo) as ResumoSaldos;
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  // ---- Totais do mês e do mês anterior ----
  const doMes = installments.filter((i) => i.mes_referencia === mes);
  const doMesAnt = installments.filter((i) => i.mes_referencia === mesAnt);
  const entradasDoMes = incomes.filter((i) => i.mes_referencia === mes);
  const entradasDoMesAnt = incomes.filter((i) => i.mes_referencia === mesAnt);

  const totalEntradas = somar(entradasDoMes, "valor_centavos");
  const totalSaidas = doMes.reduce((acc, i) => acc + valorEfetivo(i), 0);
  const totalEntradasAnterior = somar(entradasDoMesAnt, "valor_centavos");
  const totalSaidasAnterior = doMesAnt.reduce((acc, i) => acc + valorEfetivo(i), 0);

  const totalPendente = doMes
    .filter((i) => i.status === "pendente")
    .reduce((acc, i) => acc + valorEfetivo(i), 0);
  const totalPago = doMes
    .filter((i) => i.status === "pago")
    .reduce((acc, i) => acc + valorEfetivo(i), 0);
  const qtdParcelasPendentes = doMes.filter((i) => i.status === "pendente").length;

  const totalJurosPago = doMes
    .filter((i) => i.status === "pago")
    .reduce((acc, i) => acc + (i.juros_centavos || 0), 0);
  const totalJurosPendente = doMes
    .filter((i) => i.status === "pendente")
    .reduce((acc, i) => acc + (i.juros_centavos || 0), 0);

  // contas marcadas como importantes vêm primeiro; dentro de cada bloco, por vencimento
  const ehImportante = (i: ExpenseInstallment) => !!sourceById.get(i.source_id)?.importante;

  const proximasContas = importantesPrimeiro(
    doMes
      .filter((i) => i.status === "pendente" && i.vencimento_atual >= hoje)
      .sort((a, b) => a.vencimento_atual.localeCompare(b.vencimento_atual)),
    ehImportante
  ).slice(0, 5);

  const contasAtrasadas = importantesPrimeiro(
    [...atrasadas].sort((a, b) => a.vencimento_atual.localeCompare(b.vencimento_atual)),
    ehImportante
  );

  // ---- Total devido (todos os meses), fluxo de caixa e saldo bancário: vêm somados do banco ----
  const totalDevidoGeral = Number(r.pendente_total);
  const qtdContasPendentesGeral = Number(r.pendente_qtd);
  const caixaEntradasMes = Number(r.caixa_entradas);
  const caixaSaidasMes = Number(r.caixa_saidas);
  const totalEntradasGeral = Number(r.entradas_total);
  const totalPagoGeral = Number(r.pago_total);
  const totalGuardadoInvestido = Number(r.guardado_total);
  const saldoBancario = totalEntradasGeral - totalPagoGeral - totalGuardadoInvestido;

  // ---- Contas parceladas acabando (faltam 1 ou 2 parcelas) ----
  const contasAcabando: ContaAcabando[] = (
    (exigir(acabando) as {
      source_id: string;
      descricao: string;
      numero_atual: number;
      total_parcelas: number;
      faltam: number;
    }[]) ?? []
  ).map((c) => ({
    sourceId: c.source_id,
    descricao: c.descricao ?? "Compra",
    numeroAtual: c.numero_atual,
    totalParcelas: c.total_parcelas,
    faltam: c.faltam,
  }));

  // ---- Evolução dos últimos 6 meses ----
  const meses: string[] = [];
  for (let i = 5; i >= 0; i--) {
    meses.push(mesReferencia(subMonths(new Date(`${mes}T00:00:00`), i)));
  }
  const evolucao: EvolucaoMes[] = meses.map((m) => {
    const ent = somar(
      incomes.filter((i) => i.mes_referencia === m),
      "valor_centavos"
    );
    const sai = installments
      .filter((i) => i.mes_referencia === m)
      .reduce((acc, i) => acc + valorEfetivo(i), 0);
    return { mes: m, rotulo: rotuloMesCurto(m), entradas: ent, saidas: sai, saldo: ent - sai };
  });

  // ---- Despesas por categoria (mês atual) ----
  const categorias = (exigir(categoriasRes) ?? []) as { id: string; nome: string; cor: string }[];
  const categoriaMap = new Map(categorias.map((c) => [c.id, c]));

  const totalPorCategoria = new Map<string, number>();
  doMes.forEach((i) => {
    const source = sourceById.get(i.source_id);
    const catId = source?.categoria_id ?? "sem-categoria";
    totalPorCategoria.set(catId, (totalPorCategoria.get(catId) ?? 0) + valorEfetivo(i));
  });

  const despesasPorCategoria = Array.from(totalPorCategoria.entries())
    .map(([catId, total]) => ({
      categoria: categoriaMap.get(catId)?.nome ?? "Outros",
      cor: categoriaMap.get(catId)?.cor ?? "#9A9AA5",
      total,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    totalEntradas,
    totalSaidas,
    saldo: totalEntradas - totalSaidas,
    totalEntradasAnterior,
    totalSaidasAnterior,
    saldoAnterior: totalEntradasAnterior - totalSaidasAnterior,
    totalPendente,
    totalPago,
    qtdParcelasPendentes,
    totalJurosPago,
    totalJurosPendente,
    totalDevidoGeral,
    qtdContasPendentesGeral,
    caixaEntradasMes,
    caixaSaidasMes,
    caixaSaldoMes: caixaEntradasMes - caixaSaidasMes,
    saldoBancario,
    totalGuardadoInvestido,
    totalEntradasGeral,
    totalPagoGeral,
    proximasContas,
    contasAtrasadas,
    contasImportantesIds: sources.filter((src) => src.importante).map((src) => src.id),
    contasAcabando,
    evolucao,
    despesasPorCategoria,
  };
}

function somar<T>(lista: T[], campo: keyof T): number {
  return lista.reduce((acc, item) => acc + (Number(item[campo]) || 0), 0);
}
