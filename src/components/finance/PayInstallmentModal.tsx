"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { textoParaCentavos, centavosParaReais, formatarMoeda, valorEfetivo } from "@/lib/finance/money";
import { rotuloMes, mesSeguinte } from "@/lib/finance/dates";
import type { ExpenseInstallmentWithSource } from "@/types/database";

interface Props {
  parcela: ExpenseInstallmentWithSource | null;
  onFechar: () => void;
  onConcluido: () => void;
}

export function PayInstallmentModal({ parcela, onFechar, onConcluido }: Props) {
  const [jurosAdicional, setJurosAdicional] = useState("");
  const [valorPago, setValorPago] = useState("");
  const [valorPagoTocado, setValorPagoTocado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const totalAtual = parcela ? valorEfetivo(parcela) : 0;
  const jurosAdicionalCentavos = textoParaCentavos(jurosAdicional || "0");
  const totalComJurosNovo = totalAtual + jurosAdicionalCentavos;

  useEffect(() => {
    if (parcela) {
      setJurosAdicional("");
      setValorPago(String(centavosParaReais(valorEfetivo(parcela))).replace(".", ","));
      setValorPagoTocado(false);
      setErro(null);
    }
  }, [parcela]);

  // enquanto o usuário não mexer manualmente no valor pago, ele acompanha
  // o total (incluindo o juros adicional que for digitado)
  useEffect(() => {
    if (!valorPagoTocado && parcela) {
      setValorPago(String(centavosParaReais(totalComJurosNovo)).replace(".", ","));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jurosAdicionalCentavos]);

  if (!parcela) return null;

  const valorPagoCentavos = textoParaCentavos(valorPago || "0");
  const restante = Math.max(totalComJurosNovo - valorPagoCentavos, 0);
  const ehParcial = valorPagoCentavos > 0 && valorPagoCentavos < totalComJurosNovo;
  const proximoMes = rotuloMes(mesSeguinte(parcela.mes_referencia));

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (valorPagoCentavos <= 0) {
      setErro("Informe um valor pago maior que zero.");
      return;
    }

    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("pay_partial_installment", {
      p_installment_id: parcela!.id,
      p_valor_pago_centavos: valorPagoCentavos,
      p_juros_adicional_centavos: jurosAdicionalCentavos,
      p_meses_adiar: 1,
    });

    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    onConcluido();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center">
      <form
        onSubmit={confirmar}
        className="w-full max-w-sm rounded-card border border-base-border bg-base-surface p-5 shadow-card"
      >
        <h2 className="mb-1 font-display text-lg font-semibold">Confirmar pagamento</h2>
        <p className="mb-4 truncate text-sm text-ink-muted">{parcela.expense_sources.descricao}</p>

        <div className="mb-3 flex items-center justify-between rounded-xl border border-base-border bg-base-surface2 px-4 py-3 text-sm">
          <span className="text-ink-muted">Valor da conta</span>
          <span className="font-tabular font-semibold">{formatarMoeda(totalAtual)}</span>
        </div>

        <label className="mb-1 block text-xs text-ink-muted">
          Juros / multa adicional agora (R$) — opcional
        </label>
        <input
          value={jurosAdicional}
          onChange={(e) => setJurosAdicional(e.target.value)}
          placeholder="0,00"
          inputMode="decimal"
          className="mb-3 w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
        />

        <label className="mb-1 block text-xs text-ink-muted">Quanto você está pagando agora? (R$)</label>
        <input
          value={valorPago}
          onChange={(e) => {
            setValorPagoTocado(true);
            setValorPago(e.target.value);
          }}
          inputMode="decimal"
          className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          Pagando menos que o total, o restante vai automaticamente pra {proximoMes}.
        </p>

        {jurosAdicionalCentavos > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-base-border bg-base-surface2 px-4 py-3 text-sm">
            <span className="text-ink-muted">Total com o juros informado</span>
            <span className="font-tabular font-semibold">{formatarMoeda(totalComJurosNovo)}</span>
          </div>
        )}

        {ehParcial && (
          <div className="mt-3 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-muted">Pago agora</span>
              <span className="font-semibold text-money-in">{formatarMoeda(valorPagoCentavos)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-ink-muted">Vai para {proximoMes}</span>
              <span className="font-semibold text-brand-gold">{formatarMoeda(restante)}</span>
            </div>
          </div>
        )}

        {erro && <p className="mt-3 text-sm text-money-out">{erro}</p>}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onFechar}
            className="flex-1 rounded-xl border border-base-border py-2.5 text-sm font-medium hover:bg-base-surface2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="flex-1 rounded-xl bg-brand-pink py-2.5 text-sm font-semibold text-white hover:bg-brand-pinkDark disabled:opacity-60"
          >
            {salvando ? "Salvando..." : ehParcial ? "Confirmar pagamento parcial" : "Confirmar pagamento"}
          </button>
        </div>
      </form>
    </div>
  );
}
