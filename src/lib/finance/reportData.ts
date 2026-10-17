import { createClient } from "@/lib/supabase/client";
import { buscarTodos } from "@/lib/supabase/paginar";
import { addMonths, differenceInCalendarMonths, subMonths } from "date-fns";
import { mesReferencia } from "@/lib/finance/dates";
import { valorEfetivo } from "@/lib/finance/money";
import type { ExpenseInstallmentWithSource, Income } from "@/types/database";

export interface CategoriaResumo {
  categoria: string;
  cor: string;
  total: number;
}

export interface ReportData {
  entradas: Income[];
  despesas: ExpenseInstallmentWithSource[];
  totalEntradas: number;
  totalDespesas: number;
  saldoPeriodo: number;
  saldoAnterior: number;
  saldoAcumulado: number;
  categorias: CategoriaResumo[];
  comparacao: {
    totalEntradasAnterior: number;
    totalDespesasAnterior: number;
    saldoPeriodoAnterior: number;
  };
}

export async function carregarRelatorio(mesInicio: string, mesFim: string): Promise<ReportData> {
  const supabase = createClient();

  const qtdMeses = differenceInCalendarMonths(new Date(`${mesFim}T00:00:00`), new Date(`${mesInicio}T00:00:00`)) + 1;
  const mesInicioAnterior = mesReferencia(subMonths(new Date(`${mesInicio}T00:00:00`), qtdMeses));
  const mesFimAnterior = mesReferencia(subMonths(new Date(`${mesFim}T00:00:00`), qtdMeses));

  type Valor = { valor_centavos: number; juros_centavos?: number | null };

  // Listas do período em páginas (mais de 1000 lançamentos num período não
  // somem mais do relatório) e o saldo anterior somado no próprio banco.
  const [entradas, despesas, entradasAnt, despesasAnt, resumoRes, categoriasRes] = await Promise.all([
    buscarTodos<Income>((de, ate) =>
      supabase.from("incomes").select("*").gte("mes_referencia", mesInicio).lte("mes_referencia", mesFim).order("id").range(de, ate)
    ),
    buscarTodos<ExpenseInstallmentWithSource>((de, ate) =>
      supabase
        .from("expense_installments")
        .select("*, expense_sources(*)")
        .gte("mes_referencia", mesInicio)
        .lte("mes_referencia", mesFim)
        .order("id")
        .range(de, ate)
    ),
    buscarTodos<Valor>((de, ate) =>
      supabase
        .from("incomes")
        .select("valor_centavos")
        .gte("mes_referencia", mesInicioAnterior)
        .lte("mes_referencia", mesFimAnterior)
        .order("id")
        .range(de, ate)
    ),
    buscarTodos<Valor>((de, ate) =>
      supabase
        .from("expense_installments")
        .select("valor_centavos, juros_centavos")
        .gte("mes_referencia", mesInicioAnterior)
        .lte("mes_referencia", mesFimAnterior)
        .order("id")
        .range(de, ate)
    ),
    supabase.rpc("resumo_saldos", { p_antes_de: mesInicio }),
    supabase.from("categories").select("id, nome, cor"),
  ]);
  if (resumoRes.error) throw resumoRes.error;
  if (categoriasRes.error) throw categoriasRes.error;

  const categorias = (categoriasRes.data ?? []) as { id: string; nome: string; cor: string }[];
  const categoriaMap = new Map(categorias.map((c) => [c.id, c]));

  const totalEntradas = somar(entradas);
  const totalDespesas = despesas.reduce((acc, d) => acc + valorEfetivo(d), 0);

  const totalEntradasAnterior = somar(entradasAnt);
  const totalDespesasAnterior = despesasAnt.reduce(
    (acc: number, d) => acc + valorEfetivo({ valor_centavos: d.valor_centavos, juros_centavos: d.juros_centavos ?? 0 }),
    0
  );

  const resumo = resumoRes.data as { entradas_antes: number; despesas_antes: number };
  const saldoAnterior = Number(resumo.entradas_antes) - Number(resumo.despesas_antes);

  const totalPorCategoria = new Map<string, number>();
  despesas.forEach((d) => {
    const catId = d.expense_sources?.categoria_id ?? "sem-categoria";
    totalPorCategoria.set(catId, (totalPorCategoria.get(catId) ?? 0) + valorEfetivo(d));
  });

  const categoriasResumo: CategoriaResumo[] = Array.from(totalPorCategoria.entries())
    .map(([catId, total]) => ({
      categoria: categoriaMap.get(catId)?.nome ?? "Outros",
      cor: categoriaMap.get(catId)?.cor ?? "#9A9AA5",
      total,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    entradas: entradas.sort((a, b) => a.data.localeCompare(b.data)),
    despesas: despesas.sort((a, b) => a.vencimento_atual.localeCompare(b.vencimento_atual)),
    totalEntradas,
    totalDespesas,
    saldoPeriodo: totalEntradas - totalDespesas,
    saldoAnterior,
    saldoAcumulado: saldoAnterior + (totalEntradas - totalDespesas),
    categorias: categoriasResumo,
    comparacao: {
      totalEntradasAnterior,
      totalDespesasAnterior,
      saldoPeriodoAnterior: totalEntradasAnterior - totalDespesasAnterior,
    },
  };
}

function somar(lista: { valor_centavos: number }[]): number {
  return lista.reduce((acc, item) => acc + (item.valor_centavos || 0), 0);
}

export function proximoMesLabel(mesISO: string): string {
  return mesReferencia(addMonths(new Date(`${mesISO}T00:00:00`), 1));
}
