"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PrintableReport } from "@/components/finance/PrintableReport";
import { useCategories } from "@/lib/hooks/useCategories";
import { carregarRelatorio, type ReportData } from "@/lib/finance/reportData";
import { mesAtualISO } from "@/lib/finance/dates";

type Modo = "mes" | "personalizado";

function mesParaInput(mesISO: string) {
  return mesISO.slice(0, 7); // "YYYY-MM"
}
function inputParaMes(valor: string) {
  return `${valor}-01`;
}

export default function RelatoriosPage() {
  const { categorias: categoriasSaida } = useCategories("saida");
  const { categorias: categoriasEntrada } = useCategories("entrada");

  const [modo, setModo] = useState<Modo>("mes");
  const [mesUnico, setMesUnico] = useState(mesAtualISO());
  const [mesInicio, setMesInicio] = useState(mesAtualISO());
  const [mesFim, setMesFim] = useState(mesAtualISO());

  const [dados, setDados] = useState<ReportData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  const inicioEfetivo = modo === "mes" ? mesUnico : mesInicio;
  const fimEfetivo = modo === "mes" ? mesUnico : mesFim;

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    carregarRelatorio(inicioEfetivo, fimEfetivo).then((d) => {
      if (ativo) {
        setDados(d);
        setCarregando(false);
      }
    });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicioEfetivo, fimEfetivo]);

  function categoriaNome(id: string | null) {
    return (
      categoriasSaida.find((c) => c.id === id)?.nome ??
      categoriasEntrada.find((c) => c.id === id)?.nome ??
      "Sem categoria"
    );
  }

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Um resumo claro e pronto para imprimir."
        actions={
          dados && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-pill bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pinkDark"
            >
              <Printer size={16} /> Gerar PDF
            </button>
          )
        }
      />

      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-pill bg-base-surface2 p-1">
          <button
            onClick={() => setModo("mes")}
            className={`rounded-pill px-3.5 py-1.5 text-xs font-medium ${
              modo === "mes" ? "bg-brand-pink text-white" : "text-ink-muted"
            }`}
          >
            Mês
          </button>
          <button
            onClick={() => setModo("personalizado")}
            className={`rounded-pill px-3.5 py-1.5 text-xs font-medium ${
              modo === "personalizado" ? "bg-brand-pink text-white" : "text-ink-muted"
            }`}
          >
            Período personalizado
          </button>
        </div>

        {modo === "mes" ? (
          <input
            type="month"
            value={mesParaInput(mesUnico)}
            onChange={(e) => setMesUnico(inputParaMes(e.target.value))}
            className="rounded-xl border border-base-border bg-base-surface2 px-3 py-2 text-sm outline-none"
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={mesParaInput(mesInicio)}
              onChange={(e) => setMesInicio(inputParaMes(e.target.value))}
              className="rounded-xl border border-base-border bg-base-surface2 px-3 py-2 text-sm outline-none"
            />
            <span className="text-ink-muted">até</span>
            <input
              type="month"
              value={mesParaInput(mesFim)}
              onChange={(e) => setMesFim(inputParaMes(e.target.value))}
              className="rounded-xl border border-base-border bg-base-surface2 px-3 py-2 text-sm outline-none"
            />
          </div>
        )}
      </div>

      <div className="no-print mb-6">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por descrição (filtra Entradas e Despesas abaixo)"
          className="w-full max-w-md rounded-xl border border-base-border bg-base-surface2 px-3 py-2 text-sm outline-none focus:border-brand-pink"
        />
      </div>

      {carregando || !dados ? (
        <p className="text-sm text-ink-muted">Carregando...</p>
      ) : (
        <PrintableReport
          dados={dados}
          mesInicio={inicioEfetivo}
          mesFim={fimEfetivo}
          categoriaNome={categoriaNome}
          busca={busca}
        />
      )}
    </div>
  );
}
