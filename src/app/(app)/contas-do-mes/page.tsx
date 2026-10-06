"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Layers, Tag } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Money } from "@/components/finance/Money";
import { MonthSwitcher } from "@/components/finance/MonthSwitcher";
import { BillCard } from "@/components/finance/BillCard";
import { DeferInstallmentModal } from "@/components/finance/DeferInstallmentModal";
import { EditInstallmentModal } from "@/components/finance/EditInstallmentModal";
import { PayInstallmentModal } from "@/components/finance/PayInstallmentModal";
import { NewExpenseModal } from "@/components/finance/NewExpenseModal";
import { BulkGroupBar } from "@/components/finance/BulkGroupBar";
import { mensagemErroGrupo } from "@/lib/finance/erros";
import { useCategories } from "@/lib/hooks/useCategories";
import { useGroups } from "@/lib/hooks/useGroups";
import { createClient } from "@/lib/supabase/client";
import {
  estaAtrasada,
  inicioDoMesTimestamp,
  mesAtualISO,
  mesDoPagamento,
  mesSeguinte,
} from "@/lib/finance/dates";
import { valorEfetivo } from "@/lib/finance/money";
import type { ExpenseInstallmentWithSource, TipoFonteDespesa } from "@/types/database";

type FiltroStatus = "todas" | "pagas" | "nao_pagas" | "atrasadas";
type FiltroTipo = "" | TipoFonteDespesa;

// "Não pagas" e "Atrasadas" não fazem sentido presas a um único mês — quem está devendo
// quer ver tudo o que falta, então esses dois filtros sempre buscam em todos os meses.
const SEM_GRUPO = "__sem_grupo";

function statusExigeTodosMeses(status: FiltroStatus) {
  return status === "nao_pagas" || status === "atrasadas";
}

function ContasDoMesConteudo() {
  const searchParams = useSearchParams();
  const { categorias } = useCategories("saida");
  const { grupos, recarregar: recarregarGrupos } = useGroups();

  const vemDePendencias = searchParams.get("pendencias") === "1";

  const [mes, setMes] = useState(mesAtualISO());
  const [verTodosMeses, setVerTodosMeses] = useState(vemDePendencias);
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatus>(
    vemDePendencias ? "nao_pagas" : "todas"
  );
  const [tipoFiltro, setTipoFiltro] = useState<FiltroTipo>("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState("");
  const [busca, setBusca] = useState("");

  const [parcelas, setParcelas] = useState<ExpenseInstallmentWithSource[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [adiando, setAdiando] = useState<ExpenseInstallmentWithSource | null>(null);
  const [editando, setEditando] = useState<ExpenseInstallmentWithSource | null>(null);
  const [pagando, setPagando] = useState<ExpenseInstallmentWithSource | null>(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [aplicandoGrupo, setAplicandoGrupo] = useState(false);
  const [erroSelecao, setErroSelecao] = useState<string | null>(null);

  // "Sem grupo" também olha todos os meses: a ideia é ver tudo que falta classificar
  const semGrupoAtivo = grupoFiltro === SEM_GRUPO;
  const modoTodosMeses = verTodosMeses || statusExigeTodosMeses(statusFiltro) || semGrupoAtivo;

  function alternarSelecao(id: string) {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function sairDaSelecao() {
    setModoSelecao(false);
    setSelecionadas(new Set());
    setErroSelecao(null);
  }

  async function aplicarGrupoEmLote(grupoId: string | null, novoGrupo: string) {
    // só conta o que está visível na lista (filtros podem esconder itens marcados antes)
    const escolhidas = filtradas.filter((p) => selecionadas.has(p.id));
    if (escolhidas.length === 0) return;

    setAplicandoGrupo(true);
    setErroSelecao(null);
    const supabase = createClient();

    let grupoFinal = grupoId;
    if (novoGrupo.trim()) {
      const { data: criado, error: erroCriar } = await supabase
        .from("expense_groups")
        .insert({ user_id: (await supabase.auth.getUser()).data.user?.id, nome: novoGrupo.trim() })
        .select("id")
        .single();
      if (erroCriar || !criado) {
        setAplicandoGrupo(false);
        setErroSelecao(erroCriar ? mensagemErroGrupo(erroCriar) : "Não foi possível criar o grupo.");
        return;
      }
      grupoFinal = criado.id;
    }

    const idsContas = Array.from(new Set(escolhidas.map((p) => p.source_id)));
    const { error } = await supabase
      .from("expense_sources")
      .update({ grupo_id: grupoFinal })
      .in("id", idsContas);

    setAplicandoGrupo(false);
    if (error) {
      setErroSelecao(error.message);
      return;
    }
    sairDaSelecao();
    recarregarGrupos();
    carregar();
  }

  async function carregar() {
    setCarregando(true);
    const supabase = createClient();

    // garante que as recorrências ativas já tenham uma ocorrência criada neste mês
    await supabase.rpc("generate_recurring_installments", { p_mes: mes });

    let query = supabase.from("expense_installments").select("*, expense_sources(*)");
    if (!modoTodosMeses) {
      query = query.eq("mes_referencia", mes);
    }
    const { data } = await query.order("vencimento_atual", { ascending: true });
    let lista = (data as ExpenseInstallmentWithSource[]) ?? [];

    // Contas de outros meses que foram pagas NESTE mês também aparecem aqui:
    // mantêm o vencimento do mês de origem, mas contam como pagas no mês do pagamento.
    if (!modoTodosMeses) {
      const { data: pagasNoMes } = await supabase
        .from("expense_installments")
        .select("*, expense_sources(*)")
        .eq("status", "pago")
        .gte("pago_em", inicioDoMesTimestamp(mes))
        .lt("pago_em", inicioDoMesTimestamp(mesSeguinte(mes)));

      const idsJaNaLista = new Set(lista.map((p) => p.id));
      const extras = ((pagasNoMes as ExpenseInstallmentWithSource[]) ?? []).filter(
        (p) => !idsJaNaLista.has(p.id)
      );
      lista = [...lista, ...extras].sort((a, b) => a.vencimento_atual.localeCompare(b.vencimento_atual));
    }

    setParcelas(lista);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, modoTodosMeses]);

  const categoriaNome = (id: string | null) => categorias.find((c) => c.id === id)?.nome ?? "Sem categoria";
  const grupoNome = (id: string | null) => grupos.find((g) => g.id === id)?.nome ?? null;

  const filtradas = parcelas.filter((p) => {
    const atrasada = estaAtrasada(p.vencimento_atual, p.status);
    if (statusFiltro === "pagas" && p.status !== "pago") return false;
    if (statusFiltro === "nao_pagas" && p.status !== "pendente") return false;
    if (statusFiltro === "atrasadas" && !atrasada) return false;
    if (tipoFiltro && p.expense_sources.tipo !== tipoFiltro) return false;
    if (categoriaFiltro && p.expense_sources.categoria_id !== categoriaFiltro) return false;
    if (grupoFiltro === SEM_GRUPO) {
      if (p.expense_sources.grupo_id) return false;
    } else if (grupoFiltro && p.expense_sources.grupo_id !== grupoFiltro) return false;
    if (busca.trim() && !p.expense_sources.descricao.toLowerCase().includes(busca.trim().toLowerCase()))
      return false;
    return true;
  });

  const totalPendente = filtradas
    .filter((p) => p.status === "pendente")
    .reduce((acc, p) => acc + valorEfetivo(p), 0);
  // Na visão por mês, "Já pago" conta o que foi pago neste mês (mesmo que a conta seja de outro mês).
  const totalPago = filtradas
    .filter((p) => p.status === "pago" && (modoTodosMeses || mesDoPagamento(p.pago_em) === mes))
    .reduce((acc, p) => acc + valorEfetivo(p), 0);

  async function desmarcarPago(id: string) {
    const supabase = createClient();
    await supabase.rpc("unmark_installment_paid", { p_installment_id: id });
    carregar();
  }

  return (
    <div>
      <PageHeader
        title="Contas do Mês"
        subtitle={
          modoTodosMeses
            ? "Todas as contas, de todos os meses, da mais antiga pra mais nova."
            : "Tudo o que vence neste mês, num só lugar."
        }
        actions={
          <button
            onClick={() => setModalNovo(true)}
            className="flex items-center gap-1.5 rounded-pill bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pinkDark"
          >
            <Plus size={16} /> Nova conta
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {modoTodosMeses ? (
          <span className="rounded-pill border border-base-border bg-base-surface px-4 py-2 text-sm font-semibold text-ink-muted">
            Todos os meses
          </span>
        ) : (
          <MonthSwitcher mes={mes} onChange={setMes} />
        )}

        <button
          onClick={() => setVerTodosMeses((atual) => !atual)}
          disabled={statusExigeTodosMeses(statusFiltro) || semGrupoAtivo}
          className={`flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            modoTodosMeses
              ? "bg-brand-pink text-white"
              : "border border-base-border text-ink-muted hover:bg-base-surface2"
          }`}
        >
          <Layers size={14} />
          {modoTodosMeses ? "Voltar a ver por mês" : "Ver todas as pendências"}
        </button>

        <button
          onClick={() => (modoSelecao ? sairDaSelecao() : setModoSelecao(true))}
          className={`flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-xs font-semibold transition ${
            modoSelecao
              ? "bg-brand-pink text-white"
              : "border border-base-border text-ink-muted hover:bg-base-surface2"
          }`}
        >
          <Tag size={14} />
          {modoSelecao ? "Sair da seleção" : "Agrupar contas"}
        </button>
      </div>

      {modoTodosMeses && (
        <p className="mb-4 text-xs text-ink-muted">
          Mostrando contas de todos os meses, das mais antigas para as mais novas — ótimo pra ir
          quitando uma por uma sem depender de navegar mês a mês.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["todas", "Todas"],
            ["nao_pagas", "Não pagas"],
            ["pagas", "Pagas"],
            ["atrasadas", "Atrasadas"],
          ] as [FiltroStatus, string][]
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            onClick={() => setStatusFiltro(valor)}
            className={`rounded-pill px-3.5 py-1.5 text-xs font-medium transition ${
              statusFiltro === valor
                ? "bg-brand-pink text-white"
                : "border border-base-border text-ink-muted hover:bg-base-surface2"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value as FiltroTipo)}
          className="w-full rounded-xl border border-base-border bg-base-surface2 px-3 py-2 text-sm outline-none sm:w-auto"
        >
          <option value="">Todos os tipos</option>
          <option value="simples">Avulsas</option>
          <option value="parcelado">Parceladas</option>
          <option value="recorrente">Recorrentes</option>
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
        <select
          value={grupoFiltro}
          onChange={(e) => setGrupoFiltro(e.target.value)}
          className="w-full rounded-xl border border-base-border bg-base-surface2 px-3 py-2 text-sm outline-none sm:w-auto"
        >
          <option value="">Todos os grupos</option>
          <option value={SEM_GRUPO}>Sem grupo</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nome}
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

      <div className="mb-4 grid grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-ink-muted">Falta pagar</p>
          <Money centavos={totalPendente} className="font-tabular text-xl font-semibold text-money-out" />
        </Card>
        <Card>
          <p className="text-sm text-ink-muted">Já pago</p>
          <Money centavos={totalPago} className="font-tabular text-xl font-semibold text-money-in" />
        </Card>
      </div>

      {carregando ? (
        <p className="text-sm text-ink-muted">Carregando...</p>
      ) : filtradas.length === 0 ? (
        <div>
          <EmptyState
            titulo={
              statusFiltro === "todas"
                ? modoTodosMeses
                  ? "Nenhuma conta cadastrada ainda."
                  : "Você ainda não possui contas neste mês."
                : "Nenhuma conta encontrada com esse filtro. 🎉"
            }
            icone="🗓️"
          />
          {statusFiltro === "todas" && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setModalNovo(true)}
                className="flex items-center gap-1.5 rounded-pill bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pinkDark"
              >
                <Plus size={16} /> Cadastrar a primeira conta
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtradas.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              {modoSelecao && (
                <input
                  type="checkbox"
                  checked={selecionadas.has(p.id)}
                  onChange={() => alternarSelecao(p.id)}
                  aria-label={`Selecionar ${p.expense_sources.descricao}`}
                  className="h-5 w-5 shrink-0 accent-brand-pink"
                />
              )}
              <div className="min-w-0 flex-1">
                <BillCard
                  parcela={p}
                  categoriaNome={categoriaNome(p.expense_sources.categoria_id)}
                  grupoNome={grupoNome(p.expense_sources.grupo_id)}
                  onPagar={() => setPagando(p)}
                  onDesmarcarPago={() => desmarcarPago(p.id)}
                  onNaoPago={() => setAdiando(p)}
                  onEditar={() => setEditando(p)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {modoSelecao && (
        <BulkGroupBar
          grupos={grupos}
          qtdParcelas={filtradas.filter((p) => selecionadas.has(p.id)).length}
          qtdContas={
            new Set(filtradas.filter((p) => selecionadas.has(p.id)).map((p) => p.source_id)).size
          }
          aplicando={aplicandoGrupo}
          erro={erroSelecao}
          onTodas={() => setSelecionadas(new Set(filtradas.map((p) => p.id)))}
          onLimpar={() => setSelecionadas(new Set())}
          onAplicar={aplicarGrupoEmLote}
          onCancelar={sairDaSelecao}
        />
      )}

      <DeferInstallmentModal
        parcela={adiando}
        onFechar={() => setAdiando(null)}
        onConcluido={() => {
          setAdiando(null);
          carregar();
        }}
      />

      <EditInstallmentModal
        parcela={editando}
        onFechar={() => setEditando(null)}
        onSalvo={() => {
          setEditando(null);
          recarregarGrupos();
          carregar();
        }}
      />

      <PayInstallmentModal
        parcela={pagando}
        onFechar={() => setPagando(null)}
        onConcluido={() => {
          setPagando(null);
          carregar();
        }}
      />

      <NewExpenseModal
        aberto={modalNovo}
        onFechar={() => setModalNovo(false)}
        onSalvo={() => {
          setModalNovo(false);
          carregar();
        }}
      />
    </div>
  );
}

export default function ContasDoMesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Carregando...</p>}>
      <ContasDoMesConteudo />
    </Suspense>
  );
}
