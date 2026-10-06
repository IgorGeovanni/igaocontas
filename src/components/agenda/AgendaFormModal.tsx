"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AgendaCompromisso } from "@/types/database";

interface Props {
  aberto: boolean;
  userId: string;
  compromissoEditando: AgendaCompromisso | null;
  onFechar: () => void;
  onSalvo: () => void;
}

export function AgendaFormModal({ aberto, userId, compromissoEditando, onFechar, onSalvo }: Props) {
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (compromissoEditando) {
      setTitulo(compromissoEditando.titulo);
      setData(compromissoEditando.data);
      setHorario(compromissoEditando.horario?.slice(0, 5) ?? "");
      setObservacao(compromissoEditando.observacao ?? "");
    } else {
      setTitulo("");
      setData(new Date().toISOString().slice(0, 10));
      setHorario("");
      setObservacao("");
    }
    setErro(null);
  }, [compromissoEditando, aberto]);

  if (!aberto) return null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !data) {
      setErro("Informe pelo menos o título e a data.");
      return;
    }
    setSalvando(true);
    const supabase = createClient();
    const payload = {
      user_id: userId,
      titulo: titulo.trim(),
      data,
      horario: horario || null,
      observacao: observacao.trim() || null,
    };

    const resultado = compromissoEditando
      ? await supabase.from("agenda_compromissos").update(payload).eq("id", compromissoEditando.id)
      : await supabase.from("agenda_compromissos").insert(payload);

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
          {compromissoEditando ? "Editar compromisso" : "Novo compromisso"}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Título</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Consulta médica"
              className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Data</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Horário (opcional)</label>
              <input
                type="time"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
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
