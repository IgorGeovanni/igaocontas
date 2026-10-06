"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCategories } from "@/lib/hooks/useCategories";
import { textoParaCentavos, centavosParaReais } from "@/lib/finance/money";
import { mesReferenciaDeString } from "@/lib/finance/dates";
import type { Income } from "@/types/database";

interface Props {
  aberto: boolean;
  userId: string;
  entradaEditando: Income | null;
  onFechar: () => void;
  onSalvo: () => void;
}

export function IncomeFormModal({ aberto, userId, entradaEditando, onFechar, onSalvo }: Props) {
  const { categorias } = useCategories("entrada");
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (entradaEditando) {
      setDescricao(entradaEditando.descricao);
      setCategoriaId(entradaEditando.categoria_id ?? "");
      setValor(String(centavosParaReais(entradaEditando.valor_centavos)).replace(".", ","));
      setData(entradaEditando.data);
      setObservacao(entradaEditando.observacao ?? "");
    } else {
      setDescricao("");
      setCategoriaId("");
      setValor("");
      setData(new Date().toISOString().slice(0, 10));
      setObservacao("");
    }
    setErro(null);
  }, [entradaEditando, aberto]);

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
      categoria_id: categoriaId || null,
      valor_centavos: centavos,
      data,
      mes_referencia: mesReferenciaDeString(data),
      observacao: observacao.trim() || null,
    };

    const resultado = entradaEditando
      ? await supabase.from("incomes").update(payload).eq("id", entradaEditando.id)
      : await supabase.from("incomes").insert(payload);

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
          {entradaEditando ? "Editar entrada" : "Nova entrada"}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Descrição</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Salário"
              className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-muted">Categoria</label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
            >
              <option value="">Selecione</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
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
