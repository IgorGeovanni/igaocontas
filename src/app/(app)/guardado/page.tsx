"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, PiggyBank, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Money } from "@/components/finance/Money";
import { SavingsFormModal } from "@/components/finance/SavingsFormModal";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { formatarData } from "@/lib/finance/dates";
import type { SavingsEntry, TipoGuardado } from "@/types/database";

export default function GuardadoPage() {
  const { user } = useUser();
  const [filtroTipo, setFiltroTipo] = useState<"" | TipoGuardado>("");
  const [itens, setItens] = useState<SavingsEntry[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<SavingsEntry | null>(null);
  const [excluindo, setExcluindo] = useState<SavingsEntry | null>(null);

  async function carregar() {
    setCarregando(true);
    const supabase = createClient();
    let query = supabase.from("savings_entries").select("*");
    if (filtroTipo) query = query.eq("tipo", filtroTipo);
    const { data } = await query.order("data", { ascending: false });
    setItens((data as SavingsEntry[]) ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTipo]);

  const totalGuardado = itens.filter((i) => i.tipo === "guardado").reduce((a, i) => a + i.valor_centavos, 0);
  const totalInvestido = itens.filter((i) => i.tipo === "investido").reduce((a, i) => a + i.valor_centavos, 0);

  async function excluir() {
    if (!excluindo) return;
    const supabase = createClient();
    await supabase.from("savings_entries").delete().eq("id", excluindo.id);
    setExcluindo(null);
    carregar();
  }

  return (
    <div>
      <PageHeader
        title="Guardado / Investido"
        subtitle="Dinheiro que você tirou do dia a dia e colocou de lado."
        actions={
          <button
            onClick={() => {
              setEditando(null);
              setModalAberto(true);
            }}
            className="flex items-center gap-1.5 rounded-pill bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pinkDark"
          >
            <Plus size={16} /> Novo
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4">
        <Card className="flex items-center gap-3">
          <PiggyBank size={22} className="shrink-0 text-brand-pink" />
          <div className="min-w-0">
            <p className="truncate text-sm text-ink-muted">Guardado</p>
            <Money centavos={totalGuardado} className="block truncate font-tabular text-lg font-semibold" />
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <TrendingUp size={22} className="shrink-0 text-money-in" />
          <div className="min-w-0">
            <p className="truncate text-sm text-ink-muted">Investido</p>
            <Money centavos={totalInvestido} className="block truncate font-tabular text-lg font-semibold" />
          </div>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["", "Tudo"],
            ["guardado", "Guardado"],
            ["investido", "Investido"],
          ] as ["" | TipoGuardado, string][]
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            onClick={() => setFiltroTipo(valor)}
            className={`rounded-pill px-3.5 py-1.5 text-xs font-medium transition ${
              filtroTipo === valor
                ? "bg-brand-pink text-white"
                : "border border-base-border text-ink-muted hover:bg-base-surface2"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {carregando ? (
        <p className="text-sm text-ink-muted">Carregando...</p>
      ) : itens.length === 0 ? (
        <EmptyState
          titulo="Nada guardado ou investido ainda."
          descricao="Registre aqui sempre que tirar um dinheiro do fluxo normal pra guardar ou investir."
          icone="🐷"
        />
      ) : (
        <div className="space-y-2.5">
          {itens.map((item) => (
            <Card key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{item.descricao}</p>
                  <span
                    className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] ${
                      item.tipo === "investido"
                        ? "bg-money-in/15 text-money-in"
                        : "bg-brand-pink/15 text-brand-pink"
                    }`}
                  >
                    {item.tipo === "investido" ? "Investido" : "Guardado"}
                  </span>
                </div>
                <p className="truncate text-xs text-ink-muted">
                  {item.local ? `${item.local} · ` : ""}
                  {formatarData(item.data)}
                </p>
                {item.observacao && <p className="mt-1 truncate text-xs text-ink-faint">{item.observacao}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
                <Money centavos={item.valor_centavos} className="font-tabular font-semibold" />
                <button
                  onClick={() => {
                    setEditando(item);
                    setModalAberto(true);
                  }}
                  className="rounded-full p-2 text-ink-muted hover:bg-base-surface2 hover:text-ink-primary"
                  aria-label="Editar"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => setExcluindo(item)}
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
        <SavingsFormModal
          aberto={modalAberto}
          userId={user.id}
          itemEditando={editando}
          onFechar={() => setModalAberto(false)}
          onSalvo={() => {
            setModalAberto(false);
            carregar();
          }}
        />
      )}

      <ConfirmDialog
        aberto={!!excluindo}
        titulo="Excluir este registro?"
        descricao="Essa ação não poderá ser desfeita."
        perigoso
        confirmarLabel="Excluir"
        onCancelar={() => setExcluindo(null)}
        onConfirmar={excluir}
      />
    </div>
  );
}
