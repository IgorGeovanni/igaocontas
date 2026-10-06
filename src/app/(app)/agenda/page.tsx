"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AgendaFormModal } from "@/components/agenda/AgendaFormModal";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { formatarData, hojeISO } from "@/lib/finance/dates";
import type { AgendaCompromisso } from "@/types/database";

type Filtro = "proximos" | "hoje" | "concluidos" | "todos";

export default function AgendaPage() {
  const { user } = useUser();
  const [filtro, setFiltro] = useState<Filtro>("proximos");
  const [itens, setItens] = useState<AgendaCompromisso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<AgendaCompromisso | null>(null);
  const [excluindo, setExcluindo] = useState<AgendaCompromisso | null>(null);

  async function carregar() {
    setCarregando(true);
    const supabase = createClient();
    let query = supabase.from("agenda_compromissos").select("*");

    if (filtro === "hoje") query = query.eq("data", hojeISO());
    if (filtro === "proximos") query = query.eq("concluido", false).gte("data", hojeISO());
    if (filtro === "concluidos") query = query.eq("concluido", true);

    const { data } = await query.order("data", { ascending: true }).order("horario", { ascending: true });
    setItens((data as AgendaCompromisso[]) ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function alternarConcluido(item: AgendaCompromisso) {
    const supabase = createClient();
    await supabase
      .from("agenda_compromissos")
      .update({ concluido: !item.concluido })
      .eq("id", item.id);
    carregar();
  }

  async function excluir() {
    if (!excluindo) return;
    const supabase = createClient();
    await supabase.from("agenda_compromissos").delete().eq("id", excluindo.id);
    setExcluindo(null);
    carregar();
  }

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Seus compromissos, separados do controle financeiro."
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

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["proximos", "Próximos"],
            ["hoje", "Hoje"],
            ["concluidos", "Concluídos"],
            ["todos", "Todos"],
          ] as [Filtro, string][]
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            onClick={() => setFiltro(valor)}
            className={`rounded-pill px-3.5 py-1.5 text-xs font-medium transition ${
              filtro === valor
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
        <EmptyState titulo="Nada por aqui ainda." descricao="Cadastre seu primeiro compromisso." icone="🗒️" />
      ) : (
        <div className="space-y-2.5">
          {itens.map((item) => {
            const ehHoje = item.data === hojeISO();
            return (
              <Card
                key={item.id}
                className={`flex items-center justify-between py-4 ${item.concluido ? "opacity-60" : ""}`}
              >
                <div className="min-w-0">
                  <p className={`truncate font-medium ${item.concluido ? "line-through" : ""}`}>{item.titulo}</p>
                  <p className="text-xs text-ink-muted">
                    {ehHoje ? "Hoje" : formatarData(item.data)}
                    {item.horario ? ` · ${item.horario.slice(0, 5)}` : ""}
                  </p>
                  {item.observacao && <p className="mt-1 text-xs text-ink-faint">{item.observacao}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => alternarConcluido(item)}
                    title={item.concluido ? "Reabrir" : "Concluir"}
                    className={`rounded-full p-2 hover:bg-base-surface2 ${
                      item.concluido ? "text-ink-muted" : "text-money-in"
                    }`}
                  >
                    {item.concluido ? <RotateCcw size={16} /> : <Check size={16} />}
                  </button>
                  <button
                    onClick={() => {
                      setEditando(item);
                      setModalAberto(true);
                    }}
                    className="rounded-full p-2 text-ink-muted hover:bg-base-surface2 hover:text-ink-primary"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setExcluindo(item)}
                    className="rounded-full p-2 text-ink-muted hover:bg-base-surface2 hover:text-money-out"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {user && (
        <AgendaFormModal
          aberto={modalAberto}
          userId={user.id}
          compromissoEditando={editando}
          onFechar={() => setModalAberto(false)}
          onSalvo={() => {
            setModalAberto(false);
            carregar();
          }}
        />
      )}

      <ConfirmDialog
        aberto={!!excluindo}
        titulo="Excluir compromisso?"
        descricao="Essa ação não poderá ser desfeita."
        perigoso
        confirmarLabel="Excluir"
        onCancelar={() => setExcluindo(null)}
        onConfirmar={excluir}
      />
    </div>
  );
}
