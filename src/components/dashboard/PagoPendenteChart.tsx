"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/finance/Money";
import { useValueVisibility } from "@/components/ValueVisibilityContext";
import { useCategories } from "@/lib/hooks/useCategories";
import { useGroups } from "@/lib/hooks/useGroups";
import { createClient } from "@/lib/supabase/client";
import { inicioDoMesTimestamp, mesSeguinte } from "@/lib/finance/dates";
import { mensagemDeErro } from "@/lib/rede/redeResiliente";
import { formatarMoeda } from "@/lib/finance/money";

// Somas já agrupadas pelo banco (por categoria e por grupo, todos os meses e só o mês).
interface Linha {
  agrupar: "categoria" | "grupo";
  chave: string | null;
  periodo: "tudo" | "mes";
  pago: number;
  pendente: number;
}

type Agrupar = "categoria" | "grupo";
type Periodo = "mes" | "tudo";

const COR_PAGO = "#22C55E";
const COR_PENDENTE = "#FF6B4A";
const MAX_BARRAS = 8;

// Antes baixava TODAS as parcelas a cada abertura do Dashboard (pesado no
// celular e, se uma página falhasse, o gráfico saía incompleto sem aviso).
// Agora o banco devolve só as somas.
async function buscarResumo(mes: string): Promise<Linha[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("pago_pendente_resumo", {
    p_mes: mes,
    p_ts_ini: inicioDoMesTimestamp(mes),
    p_ts_fim: inicioDoMesTimestamp(mesSeguinte(mes)),
  });
  if (error) throw error;
  return ((data ?? []) as Linha[]).map((l) => ({ ...l, pago: Number(l.pago), pendente: Number(l.pendente) }));
}

export function PagoPendenteChart({ mes }: { mes: string }) {
  const { ocultar } = useValueVisibility();
  const { categorias } = useCategories("saida");
  const { grupos } = useGroups();

  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [agrupar, setAgrupar] = useState<Agrupar>("categoria");
  const [periodo, setPeriodo] = useState<Periodo>("tudo");

  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setErro(null);
    buscarResumo(mes)
      .then((l) => ativo && setLinhas(l))
      .catch((e) => ativo && setErro(mensagemDeErro(e)));
    return () => {
      ativo = false;
    };
  }, [mes]);

  const dados = useMemo(() => {
    if (!linhas) return [];
    const nomes = new Map<string, { nome: string }>();
    if (agrupar === "categoria") categorias.forEach((c) => nomes.set(c.id, { nome: c.nome }));
    else grupos.forEach((g) => nomes.set(g.id, { nome: g.nome }));
    const semNome = agrupar === "categoria" ? "Sem categoria" : "Sem grupo";

    const mapa = new Map<string, { nome: string; pago: number; pendente: number }>();
    for (const l of linhas) {
      if (l.agrupar !== agrupar || l.periodo !== periodo) continue;
      const nome = l.chave ? nomes.get(l.chave)?.nome ?? semNome : semNome;
      const atual = mapa.get(nome) ?? { nome, pago: 0, pendente: 0 };
      atual.pago += l.pago;
      atual.pendente += l.pendente;
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

      {erro ? (
        <p className="text-sm text-money-out">Não foi possível carregar o gráfico: {erro}</p>
      ) : !linhas ? (
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
