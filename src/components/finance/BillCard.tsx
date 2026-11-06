"use client";

import { useState } from "react";
import { Check, Undo2, Pencil, Star } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/finance/Money";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { formatarData, formatarDataHora, estaAtrasada, rotuloMes, mesDoPagamento } from "@/lib/finance/dates";
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
  onAlternarImportante: () => void;
}

export function BillCard({
  parcela,
  categoriaNome,
  grupoNome,
  onPagar,
  onDesmarcarPago,
  onNaoPago,
  onEditar,
  onAlternarImportante,
}: Props) {
  const [processando, setProcessando] = useState(false);
  const atrasada = estaAtrasada(parcela.vencimento_atual, parcela.status);
  const status = parcela.status === "pago" ? "pago" : atrasada ? "atrasado" : "pendente";
  const temJuros = parcela.juros_centavos > 0;
  const importante = !!parcela.expense_sources.importante;
  const recorrente = parcela.expense_sources.tipo === "recorrente";
  const mesPago = mesDoPagamento(parcela.pago_em);
  const pagaEmOutroMes = parcela.status === "pago" && !!parcela.pago_em && mesPago !== parcela.mes_referencia;

  async function acao(fn: () => void) {
    setProcessando(true);
    await fn();
    setProcessando(false);
  }

  return (
    <Card
      className={`flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between ${
        importante ? "!border-violet-400/60" : ""
      }`}
    >
      <div className="min-w-0 lg:flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 break-words font-medium">{parcela.expense_sources.descricao}</p>
          {importante && (
            <span className="flex shrink-0 items-center gap-1 rounded-pill bg-violet-400/15 px-2 py-0.5 text-[11px] font-semibold text-violet-300">
              <Star size={11} fill="currentColor" /> Importante
            </span>
          )}
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
        <p className="mt-0.5 text-xs text-ink-muted">
          {categoriaNome} · Vencimento {formatarData(parcela.vencimento_atual)}
        </p>
        {parcela.status === "pago" && parcela.pago_em && (
          <p className="mt-0.5 text-xs text-money-in">
            Paga em {formatarDataHora(parcela.pago_em)}
            {pagaEmOutroMes && <> · conta de {rotuloMes(parcela.mes_referencia)}</>}
          </p>
        )}
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

      <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:flex-nowrap">
        <Money centavos={valorEfetivo(parcela)} className="font-tabular font-semibold" />
        <StatusBadge status={status} />

        <button
          onClick={onAlternarImportante}
          aria-pressed={importante}
          title={
            importante
              ? recorrente
                ? "Tirar a marca de importante (vale para todos os meses)"
                : "Tirar a marca de importante"
              : recorrente
                ? "Marcar como importante (vale para todos os meses)"
                : "Marcar como importante"
          }
          className={`rounded-full p-2 hover:bg-base-surface2 ${
            importante ? "text-violet-300" : "text-ink-muted hover:text-ink-primary"
          }`}
        >
          <Star size={16} fill={importante ? "currentColor" : "none"} />
        </button>

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
              className="flex items-center gap-1 rounded-pill bg-brand-pink/15 px-3 py-1.5 text-xs font-semibold text-brand-pink hover:bg-brand-pink/25"
            >
              <Check size={14} /> Pagar
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
