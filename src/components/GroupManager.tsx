"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useGroups } from "@/lib/hooks/useGroups";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseGroup } from "@/types/database";

export function GroupManager({ userId }: { userId: string }) {
  const { grupos, recarregar } = useGroups();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#9A9AA5");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<ExpenseGroup | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("expense_groups")
      .insert({ user_id: userId, nome: nome.trim(), cor });
    setSalvando(false);
    if (error) {
      setErro("Já existe um grupo com esse nome.");
      return;
    }
    setNome("");
    recarregar();
  }

  async function excluir() {
    if (!excluindo) return;
    const supabase = createClient();
    await supabase.from("expense_groups").delete().eq("id", excluindo.id);
    setExcluindo(null);
    recarregar();
  }

  return (
    <Card>
      <h3 className="mb-1 font-display text-base font-semibold">Grupos de contas</h3>
      <p className="mb-3 text-xs text-ink-muted">
        Junte várias contas sob um rótulo, tipo "SAAEB", "CPFL" ou o nome de alguém a quem você
        deve. Use no cadastro de uma saída para depois ver o total de cada grupo.
      </p>

      {grupos.length > 0 && (
        <ul className="mb-3 max-h-64 space-y-1.5 overflow-y-auto">
          {grupos.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-base-surface2"
            >
              <span className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.cor }} />
                {g.nome}
              </span>
              <button
                onClick={() => setExcluindo(g)}
                className="rounded-full p-1.5 text-ink-muted hover:bg-base-surface hover:text-money-out"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

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
          placeholder="Novo grupo (ex: SAAEB, CPFL, João)"
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
        titulo="Excluir grupo?"
        descricao="As contas que usam esse grupo não serão excluídas, só ficarão sem grupo."
        perigoso
        confirmarLabel="Excluir"
        onCancelar={() => setExcluindo(null)}
        onConfirmar={excluir}
      />
    </Card>
  );
}
