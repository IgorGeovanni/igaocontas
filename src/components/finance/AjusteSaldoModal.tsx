"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { textoParaCentavos, formatarMoeda } from "@/lib/finance/money";
import { hojeISO, mesAtualISO } from "@/lib/finance/dates";

interface Props {
  aberto: boolean;
  /** saldo que o app mostra hoje (centavos) */
  saldoApp: number;
  onFechar: () => void;
  onSalvo: () => void;
}

// Lança a diferença entre o saldo do app e o saldo real do banco.
// Diferença a favor do banco -> entrada "Ajuste de saldo".
// Diferença a favor do app   -> saída "Ajuste de saldo" já paga.
export function AjusteSaldoModal({ aberto, saldoApp, onFechar, onSalvo }: Props) {
  const [saldoBanco, setSaldoBanco] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) return null;

  const informou = saldoBanco.trim() !== "";
  const diferenca = informou ? textoParaCentavos(saldoBanco) - saldoApp : 0;

  function fechar() {
    setSaldoBanco("");
    setErro(null);
    onFechar();
  }

  async function lancar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!informou || diferenca === 0) {
      setErro("Informe o saldo do banco. Se for igual ao do app, não há diferença para lançar.");
      return;
    }

    setSalvando(true);
    const supabase = createClient();
    const observacao = "Diferença lançada para acertar o saldo com o banco";

    if (diferenca > 0) {
      const { error } = await supabase.from("incomes").insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        descricao: "Ajuste de saldo",
        categoria_id: null,
        valor_centavos: diferenca,
        data: hojeISO(),
        mes_referencia: mesAtualISO(),
        observacao,
      });
      if (error) {
        setSalvando(false);
        setErro(error.message);
        return;
      }
    } else {
      const { data: fonteId, error } = await supabase.rpc("create_simple_expense", {
        p_descricao: "Ajuste de saldo",
        p_categoria_id: null,
        p_valor_centavos: -diferenca,
        p_vencimento: hojeISO(),
        p_mes_referencia: null,
        p_forma_pagamento: null,
        p_observacao: observacao,
      });
      if (error || !fonteId) {
        setSalvando(false);
        setErro(error?.message ?? "Não foi possível lançar a diferença.");
        return;
      }
      const { data: parcela } = await supabase
        .from("expense_installments")
        .select("id")
        .eq("source_id", fonteId)
        .limit(1)
        .maybeSingle();
      if (parcela) {
        await supabase.rpc("mark_installment_paid", { p_installment_id: parcela.id });
      }
    }

    setSalvando(false);
    setSaldoBanco("");
    onSalvo();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 p-4 md:items-center">
      <form
        onSubmit={lancar}
        className="my-auto w-full max-w-sm rounded-card border border-base-border bg-base-surface p-5 shadow-card"
      >
        <h2 className="mb-1 font-display text-lg font-semibold">Lançar diferença de saldo</h2>
        <p className="mb-4 text-sm text-ink-muted">
          Use quando o saldo do app não bate com o do banco (por exemplo, centavos que já estavam
          na conta antes de você começar).
        </p>

        <div className="mb-3 flex items-center justify-between rounded-xl border border-base-border bg-base-surface2 px-4 py-3 text-sm">
          <span className="text-ink-muted">Saldo no app</span>
          <span className="font-tabular font-semibold">{formatarMoeda(saldoApp)}</span>
        </div>

        <label className="mb-1 block text-xs text-ink-muted">Saldo que aparece no seu banco (R$)</label>
        <input
          value={saldoBanco}
          onChange={(e) => setSaldoBanco(e.target.value)}
          placeholder="0,00"
          inputMode="decimal"
          className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
        />

        {informou && diferenca !== 0 && (
          <div className="mt-3 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-muted">Diferença</span>
              <span className={`font-tabular font-semibold ${diferenca > 0 ? "text-money-in" : "text-money-out"}`}>
                {diferenca > 0 ? "+" : "−"} {formatarMoeda(Math.abs(diferenca))}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {diferenca > 0
                ? 'Será lançada como uma entrada chamada "Ajuste de saldo".'
                : 'Será lançada como uma saída já paga chamada "Ajuste de saldo".'}
            </p>
          </div>
        )}
        {informou && diferenca === 0 && (
          <p className="mt-3 text-sm text-ink-muted">O saldo já bate com o banco. Nada a lançar.</p>
        )}

        {erro && <p className="mt-3 text-sm text-money-out">{erro}</p>}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={fechar}
            className="flex-1 rounded-xl border border-base-border py-2.5 text-sm font-medium hover:bg-base-surface2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando || !informou || diferenca === 0}
            className="flex-1 rounded-xl bg-brand-pink py-2.5 text-sm font-semibold text-white hover:bg-brand-pinkDark disabled:opacity-60"
          >
            {salvando ? "Lançando..." : "Lançar diferença"}
          </button>
        </div>
      </form>
    </div>
  );
}
