"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCategories } from "@/lib/hooks/useCategories";
import { createClient } from "@/lib/supabase/client";
import type { Category, TipoCategoria } from "@/types/database";

export function CategoryManager({ userId }: { userId: string }) {
  const [tipo, setTipo] = useState<TipoCategoria>("saida");
  const { categorias, recarregar } = useCategories(tipo);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#E2185C");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<Category | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("categories")
      .insert({ user_id: userId, nome: nome.trim(), tipo, cor, is_default: false });
    setSalvando(false);
    if (error) {
      setErro("Já existe uma categoria com esse nome para este tipo.");
      return;
    }
    setNome("");
    recarregar();
  }

  async function excluir() {
    if (!excluindo) return;
    const supabase = createClient();
    await supabase.from("categories").delete().eq("id", excluindo.id);
    setExcluindo(null);
    recarregar();
  }

  return (
    <Card>
      <h3 className="mb-3 font-display text-base font-semibold">Categorias</h3>

      <div className="mb-3 flex rounded-pill bg-base-surface2 p-1">
        <button
          onClick={() => setTipo("saida")}
          className={`flex-1 rounded-pill py-1.5 text-xs font-medium ${
            tipo === "saida" ? "bg-brand-pink text-white" : "text-ink-muted"
          }`}
        >
          Saída
        </button>
        <button
          onClick={() => setTipo("entrada")}
          className={`flex-1 rounded-pill py-1.5 text-xs font-medium ${
            tipo === "entrada" ? "bg-brand-pink text-white" : "text-ink-muted"
          }`}
        >
          Entrada
        </button>
      </div>

      <ul className="mb-3 max-h-64 space-y-1.5 overflow-y-auto">
        {categorias.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-base-surface2">
            <span className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.cor }} />
              {c.nome}
              {c.is_default && <span className="text-xs text-ink-faint">(padrão)</span>}
            </span>
            {!c.is_default && (
              <button
                onClick={() => setExcluindo(c)}
                className="rounded-full p-1.5 text-ink-muted hover:bg-base-surface hover:text-money-out"
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={criar} className="flex items-center gap-2">
        <input
          type="color"
          value={cor}
          onChange={(e) => setCor(e.target.value)}
          className="h-9 w-9 shrink-0 rounded-lg border border-base-border bg-base-surface2"
        />
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nova categoria"
          className="flex-1 rounded-xl border border-base-border bg-base-surface2 px-3 py-2 text-sm outline-none focus:border-brand-pink"
        />
        <button
          type="submit"
          disabled={salvando}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-pink text-white hover:bg-brand-pinkDark disabled:opacity-60"
        >
          <Plus size={16} />
        </button>
      </form>
      {erro && <p className="mt-2 text-xs text-money-out">{erro}</p>}

      <ConfirmDialog
        aberto={!!excluindo}
        titulo="Excluir categoria?"
        descricao="Lançamentos que usam essa categoria ficarão sem categoria."
        perigoso
        confirmarLabel="Excluir"
        onCancelar={() => setExcluindo(null)}
        onConfirmar={excluir}
      />
    </Card>
  );
}
