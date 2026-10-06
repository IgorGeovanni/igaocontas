"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/finance/Money";
import { useValueVisibility } from "@/components/ValueVisibilityContext";
import { useCategories } from "@/lib/hooks/useCategories";
import { useGroups } from "@/lib/hooks/useGroups";
import { createClient } from "@/lib/supabase/client";
import { mesDoPagamento } from "@/lib/finance/dates";
import { formatarMoeda, valorEfetivo } from "@/lib/finance/money";

interface Linha {
  status: "pendente" | "pago";
  valor_centavos: number;
  juros_centavos: number | null;
  pago_em: string | null;
  mes_referencia: string;
  expense_sources: { categoria_id: string | null; grupo_id: string | null } | null;
}

type Agrupar = "categoria" | "grupo";
type Periodo = "mes" | "tudo";

const COR_PAGO = "#22C55E";
const COR_PENDENTE = "#FF6B4A";
const MAX_BARRAS = 8;

// Busca todas as parcelas em páginas (o Supabase limita 1000 linhas por consulta).
async function buscarTodas(): Promise<Linha[]> {
  const supabase = createClient();
  const todas: Linha[] = [];
  const tamanho = 1000;
  for (let pagina = 0; pagina < 10; pagina++) {
    const { data, error } = await supabase
      .from("expense_installments")
      .select(
        "status, valor_centavos, juros_centavos, pago_em, mes_referencia, expense_sources(categoria_id, grupo_id)"
      )
      .order("id", { ascending: true })
      .range(pagina * tamanho, (pagina + 1) * tamanho - 1);
    if (error || !data) break;
    todas.push(...(data as unknown as Linha[]));
    if (data.length < tamanho) break;
  }
  return todas;
}

export function PagoPendenteChart({ mes }: { mes: string }) {
  const { ocultar } = useValueVisibility();
  const { categorias } = useCategories("saida");
  const { grupos } = useGroups();

  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [agrupar, setAgrupar] = useState<Agrupar>("categoria");
  const [periodo, setPeriodo] = useState<Periodo>("tudo");

  useEffect(() => {
    buscarTodas().then(setLinhas);
  }, []);

  const dados = useMemo(() => {
    if (!linhas) return [];
    const nomes = new Map<string, { nome: string }>();
    if (agrupar === "categoria") categorias.forEach((c) => nomes.set(c.id, { nome: c.nome }));
    else grupos.forEach((g) => nomes.set(g.id, { nome: g.nome }));
    const semNome = agrupar === "categoria" ? "Sem categoria" : "Sem grupo";

    const mapa = new Map<string, { nome: string; pago: number; pendente: number }>();
    for (const l of linhas) {
      const entra =
        periodo === "tudo" ||
        (l.status === "pago" ? mesDoPagamento(l.pago_em) === mes : l.mes_referencia === mes);
      if (!entra) continue;

      const id =
        (agrupar === "categoria" ? l.expense_sources?.categoria_id : l.expense_sources?.grupo_id) ?? "";
      const nome = id ? nomes.get(id)?.nome ?? semNome : semNome;
      const atual = mapa.get(nome) ?? { nome, pago: 0, pendente: 0 };
      if (l.status === "pago") atual.pago += valorEfetivo(l);
      else atual.pendente += valorEfetivo(l);
      mapa.set(nome, atual);
    }

    return Array.from(mapa.values())
      .filter((d) => d.pago > 0 || d.pendente > 0)
      .sort((a, b) => b.pago + b.pendente - (a.pago + a.pendente));
  }, [linhas, agrupar, periodo, mes, categorias, grupos]);

  const maisPago = [...dados].sort((a, b) => b.pago - a.pago)[0];
  const maisDevendo = [...dados].sort((a, b) => b.pendente - a.pendente)[0];
  const visiveis = dados.slice(0, MAX_BARRAS).map((d) => ({
    nome: d.nome,
    pagoReais: d.pago / 100,
    pendenteReais: d.pendente / 100,
  }));

  const botao = (ativo: boolean) =>
    `rounded-pill px-3 py-1.5 text-xs font-medium transition ${
      ativo ? "bg-brand-pink text-white" : "border border-base-border text-ink-muted hover:bg-base-surface2"
    }`;

  return (
    <Card className="min-w-0">
      <h3 className="mb-3 font-display text-base font-semibold">Pago x a pagar</h3>

      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
        <div className="flex gap-2">
          <button onClick={() => setAgrupar("categoria")} className={botao(agrupar === "categoria")}>
            Por categoria
          </button>
          <button onClick={() => setAgrupar("grupo")} className={botao(agrupar === "grupo")}>
            Por grupo
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPeriodo("tudo")} className={botao(periodo === "tudo")}>
            Todos os meses
          </button>
          <button onClick={() => setPeriodo("mes")} className={botao(periodo === "mes")}>
            Só o mês
          </button>
        </div>
      </div>

      {!linhas ? (
        <p className="text-sm text-ink-muted">Carregando...</p>
      ) : dados.length === 0 ? (
        <p className="text-sm text-ink-muted">Sem contas para mostrar nesse filtro.</p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {maisPago && maisPago.pago > 0 && (
              <div className="min-w-0 rounded-xl border border-base-border bg-base-surface2 px-4 py-3">
                <p className="text-xs text-ink-muted">Onde mais pagou</p>
                <p className="truncate text-sm font-medium">{maisPago.nome}</p>
                <Money centavos={maisPago.pago} className="font-tabular text-sm font-semibold text-money-in" />
              </div>
            )}
            {maisDevendo && maisDevendo.pendente > 0 && (
              <div className="min-w-0 rounded-xl border border-base-border bg-base-surface2 px-4 py-3">
                <p className="text-xs text-ink-muted">Onde mais deve</p>
                <p className="truncate text-sm font-medium">{maisDevendo.nome}</p>
                <Money
                  centavos={maisDevendo.pendente}
                  className="font-tabular text-sm font-semibold text-money-out"
                />
              </div>
            )}
          </div>

          <div className="mb-2 flex gap-4 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_PAGO }} /> Pago
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_PENDENTE }} /> A pagar
            </span>
          </div>

          <div className="w-full" style={{ height: visiveis.length * 58 + 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visiveis} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={100}
                  stroke="#9A9AA5"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1C1C22",
                    border: "1px solid #2A2A32",
                    borderRadius: 12,
                    fontSize: 13,
                  }}
                  formatter={(value: number, nome: string) => [
                    ocultar ? "••••••" : formatarMoeda(Math.round(value * 100)),
                    nome === "pagoReais" ? "Pago" : "A pagar",
                  ]}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar dataKey="pagoReais" fill={COR_PAGO} radius={[0, 6, 6, 0]} barSize={14} />
                <Bar dataKey="pendenteReais" fill={COR_PENDENTE} radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {dados.length > MAX_BARRAS && (
            <p className="mt-2 text-xs text-ink-muted">
              Mostrando os {MAX_BARRAS} maiores de {dados.length}.
            </p>
          )}
          <p className="mt-2 text-xs text-ink-muted">
            {periodo === "tudo"
              ? "Pago e a pagar somando todos os meses."
              : "Pago: o que foi pago neste mês. A pagar: o que ainda está pendente nas contas deste mês."}
          </p>
        </>
      )}
    </Card>
  );
}
