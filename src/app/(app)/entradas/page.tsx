"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Money } from "@/components/finance/Money";
import { MonthSwitcher } from "@/components/finance/MonthSwitcher";
import { IncomeFormModal } from "@/components/finance/IncomeFormModal";
import { useUser } from "@/lib/hooks/useUser";
import { useCategories } from "@/lib/hooks/useCategories";
import { createClient } from "@/lib/supabase/client";
import { formatarData, mesAtualISO } from "@/lib/finance/dates";
import type { Income } from "@/types/database";

export default function EntradasPage() {
  const { user } = useUser();
  const { categorias } = useCategories("entrada");

  const [mes, setMes] = useState(mesAtualISO());
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [busca, setBusca] = useState("");

  const [entradas, setEntradas] = useState<Income[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Income | null>(null);
  const [excluindo, setExcluindo] = useState<Income | null>(null);

  async function carregar() {
    setCarregando(true);
    const supabase = createClient();
    let query = supabase.from("incomes").select("*").eq("mes_referencia", mes);
    if (categoriaFiltro) query = query.eq("categoria_id", categoriaFiltro);
    if (busca.trim()) query = query.ilike("descricao", `%${busca.trim()}%`);
    const { data } = await query.order("data", { ascending: false });
    setEntradas((data as Income[]) ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, categoriaFiltro, busca]);

  const total = entradas.reduce((acc, e) => acc + e.valor_centavos, 0);
  const categoriaNome = (id: string | null) => categorias.find((c) => c.id === id)?.nome ?? "Sem categoria";

  async function excluir() {
    if (!excluindo) return;
    const supabase = createClient();
    await supabase.from("incomes").delete().eq("id", excluindo.id);
    setExcluindo(null);
    carregar();
  }

  return (
    <div>
      <PageHeader
        title="Entradas"
        subtitle="Tudo o que entra no seu bolso."
        actions={
          <button
            onClick={() => {
              setEditando(null);
              setModalAberto(true);
            }}
            className="flex items-center gap-1.5 rounded-pill bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pinkDark"
          >
            <Plus size={16} /> Nova
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <MonthSwitcher mes={mes} onChange={setMes} />
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="w-full rounded-xl border border-base-border bg-base-surface2 px-3 py-2 text-sm outline-none sm:w-auto"
        >
          <option value="">Todas categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por descrição"
          className="w-full rounded-xl border border-base-border bg-base-surface2 px-3 py-2 text-sm outline-none sm:min-w-[180px] sm:flex-1"
        />
      </div>

      <Card className="mb-4 flex items-center justify-between">
        <span className="text-sm text-ink-muted">Total do período</span>
        <Money centavos={total} className="font-tabular text-xl font-semibold text-money-in" />
      </Card>

      {carregando ? (
        <p className="text-sm text-ink-muted">Carregando...</p>
      ) : entradas.length === 0 ? (
        <EmptyState titulo="Você ainda não cadastrou nenhuma entrada." icone="💸" />
      ) : (
        <div className="space-y-2.5">
          {entradas.map((entrada) => (
            <Card key={entrada.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{entrada.descricao}</p>
                <p className="truncate text-xs text-ink-muted">
                  {categoriaNome(entrada.categoria_id)} · {formatarData(entrada.data)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:flex-nowrap">
                <Money centavos={entrada.valor_centavos} className="font-tabular font-semibold text-money-in" />
                <button
                  onClick={() => {
                    setEditando(entrada);
                    setModalAberto(true);
                  }}
                  className="rounded-full p-2 text-ink-muted hover:bg-base-surface2 hover:text-ink-primary"
                  aria-label="Editar"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => setExcluindo(entrada)}
                  className="rounded-full p-2 text-ink-muted hover:bg-base-surface2 hover:text-money-out"
                  aria-label="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {user && (
        <IncomeFormModal
          aberto={modalAberto}
          userId={user.id}
          entradaEditando={editando}
          onFechar={() => setModalAberto(false)}
          onSalvo={() => {
            setModalAberto(false);
            carregar();
          }}
        />
      )}

      <ConfirmDialog
        aberto={!!excluindo}
        titulo="Excluir entrada?"
        descricao="Essa ação não poderá ser desfeita."
        perigoso
        confirmarLabel="Excluir"
        onCancelar={() => setExcluindo(null)}
        onConfirmar={excluir}
      />
    </div>
  );
}
