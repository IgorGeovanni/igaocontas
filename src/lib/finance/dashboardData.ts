import { createClient } from "@/lib/supabase/client";
import {
  hojeISO,
  inicioDoMesTimestamp,
  mesAnterior,
  mesReferencia,
  mesSeguinte,
  rotuloMesCurto,
} from "@/lib/finance/dates";
import { valorEfetivo } from "@/lib/finance/money";
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
  contasAcabando: ContaAcabando[];

  evolucao: EvolucaoMes[];
  despesasPorCategoria: { categoria: string; cor: string; total: number }[];
}

export async function carregarDashboard(mes: string): Promise<DashboardData> {
  const supabase = createClient();
  const mesAnt = mesAnterior(mes);
  const hoje = hojeISO();

  // gera ocorrências de recorrências para o mês atual e anterior, se ainda não existirem
  await Promise.all([
    supabase.rpc("generate_recurring_installments", { p_mes: mes }),
    supabase.rpc("generate_recurring_installments", { p_mes: mesAnt }),
  ]);

  const inicioJanela = mesReferencia(subMonths(new Date(`${mes}T00:00:00`), 5));

  const [
    incomesRes,
    installmentsRes,
    sourcesRes,
    atrasadasRes,
    devidoGeralRes,
    caixaEntradasRes,
    caixaSaidasRes,
    todasEntradasRes,
    todasSaidasPagasRes,
    guardadoRes,
  ] = await Promise.all([
    supabase
      .from("incomes")
      .select("valor_centavos, mes_referencia")
      .gte("mes_referencia", inicioJanela)
      .lte("mes_referencia", mes),
    supabase
      .from("expense_installments")
      .select(
        "id, source_id, numero_parcela, total_parcelas, valor_centavos, juros_centavos, mes_referencia, vencimento_atual, status, pago_em, transferida, mes_referencia_original, vencimento_original, criado_em, atualizado_em, user_id"
      )
      .gte("mes_referencia", inicioJanela)
      .lte("mes_referencia", mes),
    supabase.from("expense_sources").select("id, descricao, categoria_id, tipo"),
    // busca SEM limite de janela: uma conta atrasada nunca deve "desaparecer" por ser antiga
    supabase
      .from("expense_installments")
      .select(
        "id, source_id, numero_parcela, total_parcelas, valor_centavos, juros_centavos, mes_referencia, vencimento_atual, status, pago_em, transferida, mes_referencia_original, vencimento_original, criado_em, atualizado_em, user_id"
      )
      .eq("status", "pendente")
      .lt("vencimento_atual", hoje)
      .order("vencimento_atual", { ascending: true }),
    // total geral devido, considerando TODOS os meses (passado, presente e futuro), sem filtro de data
    supabase.from("expense_installments").select("valor_centavos, juros_centavos").eq("status", "pendente"),
    // regime de caixa: entradas RECEBIDAS neste mês (pela data real, não a competência)
    supabase.from("incomes").select("valor_centavos").gte("data", mes).lt("data", mesSeguinte(mes)),
    // regime de caixa: saídas de fato PAGAS neste mês (pela data do pagamento, não a competência)
    supabase
      .from("expense_installments")
      .select("valor_centavos, juros_centavos")
      .eq("status", "pago")
      .gte("pago_em", inicioDoMesTimestamp(mes))
      .lt("pago_em", inicioDoMesTimestamp(mesSeguinte(mes))),
    // saldo bancário: desde sempre, sem filtro de mês nenhum
    supabase.from("incomes").select("valor_centavos"),
    supabase.from("expense_installments").select("valor_centavos, juros_centavos").eq("status", "pago"),
    supabase.from("savings_entries").select("valor_centavos"),
  ]);

  const incomes = (incomesRes.data as Pick<Income, "valor_centavos" | "mes_referencia">[]) ?? [];
  const installments = (installmentsRes.data as ExpenseInstallment[]) ?? [];
  const sources = (sourcesRes.data as Pick<ExpenseSource, "id" | "descricao" | "categoria_id" | "tipo">[]) ?? [];
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

  const proximasContas = doMes
    .filter((i) => i.status === "pendente" && i.vencimento_atual >= hoje)
    .sort((a, b) => a.vencimento_atual.localeCompare(b.vencimento_atual))
    .slice(0, 5);

  const contasAtrasadas = ((atrasadasRes.data as ExpenseInstallment[]) ?? []).sort((a, b) =>
    a.vencimento_atual.localeCompare(b.vencimento_atual)
  );

  const devidoGeral = (devidoGeralRes.data as { valor_centavos: number; juros_centavos: number }[]) ?? [];
  const totalDevidoGeral = devidoGeral.reduce((acc, i) => acc + valorEfetivo(i), 0);
  const qtdContasPendentesGeral = devidoGeral.length;

  // ---- Regime de caixa (mês selecionado) ----
  const caixaEntradasMes = somar((caixaEntradasRes.data as { valor_centavos: number }[]) ?? [], "valor_centavos");
  const caixaSaidasMes = ((caixaSaidasRes.data as { valor_centavos: number; juros_centavos: number }[]) ?? []).reduce(
    (acc, i) => acc + valorEfetivo(i),
    0
  );

  // ---- Saldo para comparar com o banco (desde sempre) ----
  const totalEntradasGeral = somar((todasEntradasRes.data as { valor_centavos: number }[]) ?? [], "valor_centavos");
  const totalPagoGeral = (
    (todasSaidasPagasRes.data as { valor_centavos: number; juros_centavos: number }[]) ?? []
  ).reduce((acc, i) => acc + valorEfetivo(i), 0);
  const totalGuardadoInvestido = somar(
    (guardadoRes.data as { valor_centavos: number }[]) ?? [],
    "valor_centavos"
  );
  const saldoBancario = totalEntradasGeral - totalPagoGeral - totalGuardadoInvestido;

  // ---- Contas parceladas acabando (faltam 1 ou 2 parcelas) ----
  const parceladoIds = sources.filter((s) => s.tipo === "parcelado").map((s) => s.id);
  let contasAcabando: ContaAcabando[] = [];
  if (parceladoIds.length > 0) {
    const { data: todasParcelas } = await supabase
      .from("expense_installments")
      .select("source_id, numero_parcela, total_parcelas, status")
      .in("source_id", parceladoIds);

    const porFonte = new Map<string, { numero_parcela: number; status: string; total: number }[]>();
    (todasParcelas ?? []).forEach((p) => {
      const lista = porFonte.get(p.source_id) ?? [];
      lista.push({ numero_parcela: p.numero_parcela, status: p.status, total: p.total_parcelas ?? 0 });
      porFonte.set(p.source_id, lista);
    });

    contasAcabando = Array.from(porFonte.entries())
      .map(([sourceId, parcelas]) => {
        const total = parcelas[0]?.total ?? parcelas.length;
        const pagas = parcelas.filter((p) => p.status === "pago").length;
        const faltam = total - pagas;
        const proxima = parcelas
          .filter((p) => p.status === "pendente")
          .sort((a, b) => a.numero_parcela - b.numero_parcela)[0];
        return {
          sourceId,
          descricao: sourceById.get(sourceId)?.descricao ?? "Compra",
          numeroAtual: proxima?.numero_parcela ?? total,
          totalParcelas: total,
          faltam,
        };
      })
      .filter((c) => c.faltam > 0 && c.faltam <= 2)
      .sort((a, b) => a.faltam - b.faltam);
  }

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
  const categoriasRes = await supabase.from("categories").select("id, nome, cor");
  const categorias = (categoriasRes.data ?? []) as { id: string; nome: string; cor: string }[];
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
    contasAcabando,
    evolucao,
    despesasPorCategoria,
  };
}

function somar<T>(lista: T[], campo: keyof T): number {
  return lista.reduce((acc, item) => acc + (Number(item[campo]) || 0), 0);
}
