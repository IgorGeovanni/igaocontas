"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { textoParaCentavos, centavosParaReais } from "@/lib/finance/money";
import type { SavingsEntry, TipoGuardado } from "@/types/database";

interface Props {
  aberto: boolean;
  userId: string;
  itemEditando: SavingsEntry | null;
  onFechar: () => void;
  onSalvo: () => void;
}

export function SavingsFormModal({ aberto, userId, itemEditando, onFechar, onSalvo }: Props) {
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<TipoGuardado>("guardado");
  const [valor, setValor] = useState("");
  const [local, setLocal] = useState("");
  const [data, setData] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (itemEditando) {
      setDescricao(itemEditando.descricao);
      setTipo(itemEditando.tipo);
      setValor(String(centavosParaReais(itemEditando.valor_centavos)).replace(".", ","));
      setLocal(itemEditando.local ?? "");
      setData(itemEditando.data);
      setObservacao(itemEditando.observacao ?? "");
    } else {
      setDescricao("");
      setTipo("guardado");
      setValor("");
      setLocal("");
      setData(new Date().toISOString().slice(0, 10));
      setObservacao("");
    }
    setErro(null);
  }, [itemEditando, aberto]);

  if (!aberto) return null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const centavos = textoParaCentavos(valor);
    if (!descricao.trim() || centavos <= 0 || !data) {
      setErro("Preencha descrição, valor e data corretamente.");
      return;
    }

    setSalvando(true);
    const supabase = createClient();
    const payload = {
      user_id: userId,
      descricao: descricao.trim(),
      tipo,
      valor_centavos: centavos,
      local: local.trim() || null,
      data,
      observacao: observacao.trim() || null,
    };

    const resultado = itemEditando
      ? await supabase.from("savings_entries").update(payload).eq("id", itemEditando.id)
      : await supabase.from("savings_entries").insert(payload);

    setSalvando(false);
    if (resultado.error) {
      setErro(resultado.error.message);
      return;
    }
    onSalvo();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center">
      <form
        onSubmit={salvar}
        className="w-full max-w-md rounded-card border border-base-border bg-base-surface p-5 shadow-card"
      >
        <h2 className="mb-4 font-display text-lg font-semibold">
          {itemEditando ? "Editar registro" : "Novo registro"}
        </h2>

        <div className="mb-4 flex rounded-pill bg-base-surface2 p-1">
          <button
            type="button"
            onClick={() => setTipo("guardado")}
            className={`flex-1 rounded-pill py-2 text-sm font-medium transition ${
              tipo === "guardado" ? "bg-brand-pink text-white" : "text-ink-muted"
            }`}
          >
            Guardado
          </button>
          <button
            type="button"
            onClick={() => setTipo("investido")}
            className={`flex-1 rounded-pill py-2 text-sm font-medium transition ${
              tipo === "investido" ? "bg-brand-pink text-white" : "text-ink-muted"
            }`}
          >
            Investido
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Descrição</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Reserva de emergência, Tesouro Direto"
              className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Valor (R$)</label>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Data</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-muted">Onde (opcional)</label>
            <input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex: Nubank, XP, caixinha em casa"
              className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-muted">Observação (opcional)</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
            />
          </div>
        </div>

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
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
