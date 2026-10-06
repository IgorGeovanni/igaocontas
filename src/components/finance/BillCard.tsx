"use client";

import { useState } from "react";
import { Check, Undo2, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/finance/Money";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { formatarData, estaAtrasada, rotuloMes } from "@/lib/finance/dates";
import { valorEfetivo } from "@/lib/finance/money";
import type { ExpenseInstallmentWithSource } from "@/types/database";

interface Props {
  parcela: ExpenseInstallmentWithSource;
  categoriaNome: string;
  grupoNome?: string | null;
  onPagar: () => void;
  onDesmarcarPago: () => void;
  onNaoPago: () => void;
  onEditar: () => void;
}

export function BillCard({
  parcela,
  categoriaNome,
  grupoNome,
  onPagar,
  onDesmarcarPago,
  onNaoPago,
  onEditar,
}: Props) {
  const [processando, setProcessando] = useState(false);
  const atrasada = estaAtrasada(parcela.vencimento_atual, parcela.status);
  const status = parcela.status === "pago" ? "pago" : atrasada ? "atrasado" : "pendente";
  const temJuros = parcela.juros_centavos > 0;

  async function acao(fn: () => void) {
    setProcessando(true);
    await fn();
    setProcessando(false);
  }

  return (
    <Card className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{parcela.expense_sources.descricao}</p>
          {parcela.total_parcelas && parcela.total_parcelas > 1 && (
            <span className="shrink-0 rounded-pill bg-base-surface2 px-2 py-0.5 text-[11px] text-ink-muted">
              {parcela.numero_parcela}/{parcela.total_parcelas}
            </span>
          )}
          {grupoNome && (
            <span className="shrink-0 rounded-pill bg-brand-pink/15 px-2 py-0.5 text-[11px] text-brand-pink">
              {grupoNome}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-muted">
          {categoriaNome} · Vencimento {formatarData(parcela.vencimento_atual)}
        </p>
        {temJuros && (
          <p className="mt-0.5 text-xs text-brand-gold">
            + <Money centavos={parcela.juros_centavos} className="text-xs" /> de juros
          </p>
        )}
        {parcela.transferida && parcela.mes_referencia_original !== parcela.mes_referencia && (
          <p className="mt-0.5 text-xs text-brand-gold">
            Adiada de {rotuloMes(parcela.mes_referencia_original)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
        <Money centavos={valorEfetivo(parcela)} className="font-tabular font-semibold" />
        <StatusBadge status={status} />

        <button
          onClick={onEditar}
          title="Editar valor, juros ou vencimento"
          className="rounded-full p-2 text-ink-muted hover:bg-base-surface2 hover:text-ink-primary"
        >
          <Pencil size={15} />
        </button>

        {parcela.status === "pago" ? (
          <button
            disabled={processando}
            onClick={() => acao(onDesmarcarPago)}
            title="Desfazer pagamento"
            className="rounded-full p-2 text-ink-muted hover:bg-base-surface2 hover:text-ink-primary"
          >
            <Undo2 size={16} />
          </button>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <button
              disabled={processando}
              onClick={onPagar}
              className="flex items-center gap-1 rounded-pill bg-money-in/15 px-3 py-1.5 text-xs font-semibold text-money-in hover:bg-money-in/25"
            >
              <Check size={14} /> Pago
            </button>
            <button
              disabled={processando}
              onClick={onNaoPago}
              className="rounded-pill border border-base-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-base-surface2"
            >
              Não pago
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
