"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { rotuloMes, mesSeguinte } from "@/lib/finance/dates";
import type { ExpenseInstallment } from "@/types/database";

interface Props {
  parcela: ExpenseInstallment | null;
  onFechar: () => void;
  onConcluido: () => void;
}

export function DeferInstallmentModal({ parcela, onFechar, onConcluido }: Props) {
  const [salvando, setSalvando] = useState(false);

  if (!parcela) return null;

  const proximoMes = rotuloMes(mesSeguinte(parcela.mes_referencia));

  async function escolher(tipo: "adiamento" | "duas_parcelas_proximo_mes") {
    setSalvando(true);
    const supabase = createClient();
    await supabase.rpc("defer_installment", {
      p_installment_id: parcela!.id,
      p_tipo: tipo,
      p_meses: 1,
    });
    setSalvando(false);
    onConcluido();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center">
      <div className="w-full max-w-sm rounded-card border border-base-border bg-base-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold">Não pagou essa conta?</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Sem problema. O histórico original fica guardado — escolha o que fazer com ela agora:
        </p>

        <div className="mt-4 space-y-3">
          <button
            disabled={salvando}
            onClick={() => escolher("adiamento")}
            className="w-full rounded-xl border border-base-border p-3 text-left hover:border-brand-pink hover:bg-brand-pink/5 disabled:opacity-60"
          >
            <p className="text-sm font-medium">Adiar para {proximoMes}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Essa conta passa a vencer no mês seguinte, junto com o que já estava previsto lá.
            </p>
          </button>

          <button
            disabled={salvando}
            onClick={() => escolher("duas_parcelas_proximo_mes")}
            className="w-full rounded-xl border border-base-border p-3 text-left hover:border-brand-pink hover:bg-brand-pink/5 disabled:opacity-60"
          >
            <p className="text-sm font-medium">Vou pagar duas parcelas em {proximoMes}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Confirma que pretende quitar essa e a do próximo mês juntas.
            </p>
          </button>
        </div>

        <button
          onClick={onFechar}
          disabled={salvando}
          className="mt-4 w-full rounded-xl border border-base-border py-2.5 text-sm font-medium hover:bg-base-surface2"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
