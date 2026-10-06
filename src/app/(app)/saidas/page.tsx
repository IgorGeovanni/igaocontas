"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Power } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Money } from "@/components/finance/Money";
import { NewExpenseModal } from "@/components/finance/NewExpenseModal";
import { EditExpenseSourceModal } from "@/components/finance/EditExpenseSourceModal";
import { useCategories } from "@/lib/hooks/useCategories";
import { useGroups } from "@/lib/hooks/useGroups";
import { createClient } from "@/lib/supabase/client";
import { formatarData } from "@/lib/finance/dates";
import { valorEfetivo } from "@/lib/finance/money";
import type { ExpenseSource } from "@/types/database";

const ROTULO_TIPO: Record<ExpenseSource["tipo"], string> = {
  simples: "Avulsa",
  parcelado: "Parcelada",
  recorrente: "Recorrente",
};

export default function SaidasPage() {
  const { categorias } = useCategories("saida");
  const { grupos } = useGroups();

  const [tipoFiltro, setTipoFiltro] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState("");
  const [busca, setBusca] = useState("");

  const [fontes, setFontes] = useState<ExpenseSource[]>([]);
  const [valoresAvulsas, setValoresAvulsas] = useState<Record<string, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [modalNovo, setModalNovo] = useState(false);
  const [editando, setEditando] = useState<ExpenseSource | null>(null);
  const [excluindo, setExcluindo] = useState<ExpenseSource | null>(null);

  async function carregar() {
    setCarregando(true);
    const supabase = createClient();
    let query = supabase.from("expense_sources").select("*");
    if (tipoFiltro) query = query.eq("tipo", tipoFiltro);
    if (categoriaFiltro) query = query.eq("categoria_id", categoriaFiltro);
    if (grupoFiltro) query = query.eq("grupo_id", grupoFiltro);
    if (busca.trim()) query = query.ilike("descricao", `%${busca.trim()}%`);
    const { data } = await query.order("criado_em", { ascending: false });
    const listaFontes = (data as ExpenseSource[]) ?? [];
    setFontes(listaFontes);

    // contas avulsas não guardam o valor na fonte — ele vive na única parcela gerada
    const idsAvulsas = listaFontes.filter((f) => f.tipo === "simples").map((f) => f.id);
    if (idsAvulsas.length > 0) {
      const { data: parcelas } = await supabase
        .from("expense_installments")
        .select("source_id, valor_centavos, juros_centavos")
        .in("source_id", idsAvulsas);
      const mapa: Record<string, number> = {};
      (parcelas ?? []).forEach((p) => {
        mapa[p.source_id] = valorEfetivo(p);
      });
      setValoresAvulsas(mapa);
    } else {
      setValoresAvulsas({});
    }

    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoFiltro, categoriaFiltro, grupoFiltro, busca]);

  const categoriaNome = (id: string | null) => categorias.find((c) => c.id === id)?.nome ?? "Sem categoria";
  const grupoNome = (id: string | null) => grupos.find((g) => g.id === id)?.nome ?? null;

  async function excluir() {
    if (!excluindo) return;
    const supabase = createClient();
    await supabase.from("expense_sources").delete().eq("id", excluindo.id);
    setExcluindo(null);
    carregar();
  }

  async function alternarRecorrencia(fonte: ExpenseSource) {
    const supabase = createClient();
    await supabase.rpc("set_recurring_active", { p_source_id: fonte.id, p_ativo: !fonte.ativo });
    carregar();
  }

  function resumo(fonte: ExpenseSource) {
    if (fonte.tipo === "parcelado") {
      return `${fonte.num_parcelas}x · desde ${formatarData(fonte.primeiro_vencimento)}`;
    }
    if (fonte.tipo === "recorrente") {
      return `Todo dia ${fonte.dia_vencimento} · ${fonte.ativo ? "ativa" : "desativada"}`;
    }
    return `Venc. ${formatarData(fonte.primeiro_vencimento)}`;
  }

  function valorPrincipal(fonte: ExpenseSource) {
    if (fonte.tipo === "parcelado") return fonte.valor_total_centavos ?? 0;
    if (fonte.tipo === "recorrente") return fonte.valor_recorrente_centavos ?? 0;
    return valoresAvulsas[fonte.id] ?? 0;
  }

  const totalFiltrado = fontes.reduce((acc, f) => acc + valorPrincipal(f), 0);

  // resumo por grupo — só faz sentido mostrar quando não se está já filtrando por um grupo
  const totaisPorGrupo = !grupoFiltro
    ? Array.from(
        fontes.reduce((mapa, f) => {
          if (!f.grupo_id) return mapa;
          mapa.set(f.grupo_id, (mapa.get(f.grupo_id) ?? 0) + valorPrincipal(f));
          return mapa;
        }, new Map<string, number>())
      )
        .map(([grupoId, total]) => ({ grupoId, nome: grupoNome(grupoId) ?? "Grupo", total }))
        .sort((a, b) => b.total - a.total)
    : [];

  return (
    <div>
      <PageHeader
        title="Saídas"
        subtitle="Cadastre suas contas: avulsas, parceladas ou recorrentes."
        actions={
          <button
            onClick={() => setModalNovo(true)}
            className="flex items-center gap-1.5 rounded-pill bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pinkDark"
          >
            <Plus size={16} /> Nova conta
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value)}
          className="w-full rounded-xl border border-base-border bg-base-surface2 px-3 py-2 text-sm outline-none sm:w-auto"
        >
          <option value="">Todos os tipos</option>
          <option value="simples">Avulsa</option>
          <option value="parcelado">Parcelada</option>
          <option value="recorrente">Recorrente</option>
        </select>
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
        {grupos.length > 0 && (
          <select
            value={grupoFiltro}
            onChange={(e) => setGrupoFiltro(e.target.value)}
            className="w-full rounded-xl border border-base-border bg-base-surface2 px-3 py-2 text-sm outline-none sm:w-auto"
          >
            <option value="">Todos os grupos</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
        )}
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por descrição"
          className="w-full rounded-xl border border-base-border bg-base-surface2 px-3 py-2 text-sm outline-none sm:min-w-[180px] sm:flex-1"
        />
      </div>

      <Card className="mb-4 flex items-center justify-between">
        <span className="text-sm text-ink-muted">
          Total {busca.trim() || tipoFiltro || categoriaFiltro ? "do filtro" : "cadastrado"}
          {fontes.length > 0 && ` (${fontes.length} ${fontes.length === 1 ? "conta" : "contas"})`}
        </span>
        <Money centavos={totalFiltrado} className="font-tabular text-xl font-semibold text-money-out" />
      </Card>

      {totaisPorGrupo.length > 0 && (
        <Card className="mb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Totais por grupo
          </p>
          <ul className="space-y-1.5">
            {totaisPorGrupo.map((g) => (
              <li key={g.grupoId} className="flex items-center justify-between text-sm">
                <button
                  onClick={() => setGrupoFiltro(g.grupoId)}
                  className="text-ink-primary hover:text-brand-pink"
                >
                  {g.nome}
                </button>
                <Money centavos={g.total} className="font-tabular font-medium text-money-out" />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {carregando ? (
        <p className="text-sm text-ink-muted">Carregando...</p>
      ) : fontes.length === 0 ? (
        <EmptyState titulo="Você ainda não cadastrou nenhuma conta." icone="🧾" />
      ) : (
        <div className="space-y-2.5">
          {fontes.map((fonte) => (
            <Card key={fonte.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{fonte.descricao}</p>
                  <span className="shrink-0 rounded-pill bg-base-surface2 px-2 py-0.5 text-[11px] text-ink-muted">
                    {ROTULO_TIPO[fonte.tipo]}
                  </span>
                  {grupoNome(fonte.grupo_id) && (
                    <span className="shrink-0 rounded-pill bg-brand-pink/15 px-2 py-0.5 text-[11px] text-brand-pink">
                      {grupoNome(fonte.grupo_id)}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-ink-muted">
                  {categoriaNome(fonte.categoria_id)} · {resumo(fonte)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
                <Money
                  centavos={valorPrincipal(fonte)}
                  className="font-tabular font-semibold text-money-out"
                />
                {fonte.tipo === "recorrente" && (
                  <button
                    onClick={() => alternarRecorrencia(fonte)}
                    title={fonte.ativo ? "Desativar recorrência" : "Ativar recorrência"}
                    className={`rounded-full p-2 hover:bg-base-surface2 ${
                      fonte.ativo ? "text-money-in" : "text-ink-faint"
                    }`}
                  >
                    <Power size={16} />
                  </button>
                )}
                <button
                  onClick={() => setEditando(fonte)}
                  className="rounded-full p-2 text-ink-muted hover:bg-base-surface2 hover:text-ink-primary"
                  aria-label="Editar"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => setExcluindo(fonte)}
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

      <NewExpenseModal
        aberto={modalNovo}
        onFechar={() => setModalNovo(false)}
        onSalvo={() => {
          setModalNovo(false);
          carregar();
        }}
      />

      <EditExpenseSourceModal
        fonte={editando}
        onFechar={() => setEditando(null)}
        onSalvo={() => {
          setEditando(null);
          carregar();
        }}
      />

      <ConfirmDialog
        aberto={!!excluindo}
        titulo="Excluir esta conta?"
        descricao={
          excluindo?.tipo === "parcelado"
            ? "Isso vai excluir TODAS as parcelas dessa compra, inclusive as já pagas. Essa ação não pode ser desfeita."
            : excluindo?.tipo === "recorrente"
              ? "Isso vai excluir a recorrência e todas as ocorrências já geradas. Considere apenas desativá-la se quiser manter o histórico. Essa ação não pode ser desfeita."
              : "Essa ação não poderá ser desfeita."
        }
        perigoso
        confirmarLabel="Excluir"
        onCancelar={() => setExcluindo(null)}
        onConfirmar={excluir}
      />
    </div>
  );
}
