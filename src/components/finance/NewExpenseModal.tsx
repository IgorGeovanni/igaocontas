"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCategories } from "@/lib/hooks/useCategories";
import { useGroups } from "@/lib/hooks/useGroups";
import { textoParaCentavos, formatarMoeda } from "@/lib/finance/money";
import { hojeISO } from "@/lib/finance/dates";
import { mensagemErroGrupo } from "@/lib/finance/erros";

type Tipo = "simples" | "parcelado" | "recorrente";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}

const hojeStr = hojeISO; // data local (evita virar "amanhã" à noite)

export function NewExpenseModal({ aberto, onFechar, onSalvo }: Props) {
  const { categorias } = useCategories("saida");
  const { grupos, recarregar: recarregarGrupos } = useGroups();

  const [tipo, setTipo] = useState<Tipo>("simples");
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [novoGrupo, setNovoGrupo] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacao, setObservacao] = useState("");

  // simples
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(hojeStr());
  const [mesReferenciaCustom, setMesReferenciaCustom] = useState(""); // "YYYY-MM", opcional

  // parcelado
  const [valorTotal, setValorTotal] = useState("");
  const [numParcelas, setNumParcelas] = useState("2");
  const [primeiroVencimento, setPrimeiroVencimento] = useState(hojeStr());

  // recorrente
  const [valorRecorrente, setValorRecorrente] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("10");
  const [inicioRecorrencia, setInicioRecorrencia] = useState(hojeStr());

  const [jaPaga, setJaPaga] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(hojeStr());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) return null;

  function limpar() {
    setDescricao("");
    setCategoriaId("");
    setGrupoId("");
    setNovoGrupo("");
    setFormaPagamento("");
    setObservacao("");
    setValor("");
    setVencimento(hojeStr());
    setValorTotal("");
    setNumParcelas("2");
    setPrimeiroVencimento(hojeStr());
    setValorRecorrente("");
    setDiaVencimento("10");
    setInicioRecorrencia(hojeStr());
    setTipo("simples");
    setJaPaga(false);
    setDataPagamento(hojeStr());
    setErro(null);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!descricao.trim()) {
      setErro("Informe uma descrição para a conta.");
      return;
    }

    const supabase = createClient();
    setSalvando(true);

    // se o usuário digitou um grupo novo, cria antes e usa o id dele
    let grupoIdFinal = grupoId || null;
    if (novoGrupo.trim()) {
      const { data: grupoCriado, error: erroGrupo } = await supabase
        .from("expense_groups")
        .insert({ user_id: (await supabase.auth.getUser()).data.user?.id, nome: novoGrupo.trim() })
        .select("id")
        .single();
      if (erroGrupo) {
        setSalvando(false);
        setErro(mensagemErroGrupo(erroGrupo));
        return;
      }
      grupoIdFinal = grupoCriado.id;
      recarregarGrupos();
    }

    let resultado;

    if (tipo === "simples") {
      const centavos = textoParaCentavos(valor);
      if (centavos <= 0) {
        setSalvando(false);
        setErro("Informe um valor válido.");
        return;
      }
      resultado = await supabase.rpc("create_simple_expense", {
        p_descricao: descricao.trim(),
        p_categoria_id: categoriaId || null,
        p_valor_centavos: centavos,
        p_vencimento: vencimento,
        p_mes_referencia: mesReferenciaCustom ? `${mesReferenciaCustom}-01` : null,
        p_forma_pagamento: formaPagamento || null,
        p_observacao: observacao || null,
      });
    } else if (tipo === "parcelado") {
      const totalCentavos = textoParaCentavos(valorTotal);
      const n = parseInt(numParcelas, 10);
      if (totalCentavos <= 0 || !n || n < 1) {
        setSalvando(false);
        setErro("Informe o valor total e o número de parcelas.");
        return;
      }
      resultado = await supabase.rpc("create_installment_purchase", {
        p_descricao: descricao.trim(),
        p_categoria_id: categoriaId || null,
        p_valor_total_centavos: totalCentavos,
        p_num_parcelas: n,
        p_primeiro_vencimento: primeiroVencimento,
        p_forma_pagamento: formaPagamento || null,
        p_observacao: observacao || null,
      });
    } else {
      const centavos = textoParaCentavos(valorRecorrente);
      const dia = parseInt(diaVencimento, 10);
      if (centavos <= 0 || !dia || dia < 1 || dia > 31) {
        setSalvando(false);
        setErro("Informe o valor mensal e o dia de vencimento (1 a 31).");
        return;
      }
      resultado = await supabase.rpc("create_recurring_expense", {
        p_descricao: descricao.trim(),
        p_categoria_id: categoriaId || null,
        p_valor_centavos: centavos,
        p_dia_vencimento: dia,
        p_primeiro_vencimento: inicioRecorrencia,
        p_forma_pagamento: formaPagamento || null,
        p_observacao: observacao || null,
      });
    }

    if (resultado?.error) {
      setSalvando(false);
      setErro(resultado.error.message);
      return;
    }

    // as funções de criação não recebem grupo direto; associa logo em seguida
    if (grupoIdFinal && resultado?.data) {
      await supabase.from("expense_sources").update({ grupo_id: grupoIdFinal }).eq("id", resultado.data);
    }

    // já cadastra como paga (para parcelada/recorrente, marca só a primeira)
    if (jaPaga && resultado?.data) {
      const { data: primeira } = await supabase
        .from("expense_installments")
        .select("id")
        .eq("source_id", resultado.data)
        .order("vencimento_atual", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (primeira) {
        const { error: erroPagamento } = await supabase.rpc("mark_installment_paid", {
          p_installment_id: primeira.id,
        });
        if (erroPagamento) {
          window.alert(`Conta criada, mas não foi possível marcá-la como paga: ${erroPagamento.message}`);
        } else if (dataPagamento && dataPagamento !== hojeStr()) {
          await supabase
            .from("expense_installments")
            .update({ pago_em: new Date(`${dataPagamento}T12:00:00`).toISOString() })
            .eq("id", primeira.id);
        }
      }
    }

    setSalvando(false);
    limpar();
    onSalvo();
  }

  const parcelaEstimativa =
    tipo === "parcelado" && valorTotal && numParcelas
      ? formatarMoeda(Math.round(textoParaCentavos(valorTotal) / (parseInt(numParcelas, 10) || 1)))
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 p-4 md:items-center">
      <form
        onSubmit={salvar}
        className="my-auto w-full max-w-md rounded-card border border-base-border bg-base-surface p-5 shadow-card"
      >
        <h2 className="mb-1 font-display text-lg font-semibold">Como é essa conta?</h2>
        <p className="mb-4 text-sm text-ink-muted">Escolha o tipo para organizarmos tudo automaticamente.</p>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {(
            [
              ["simples", "Avulsa"],
              ["parcelado", "Parcelada"],
              ["recorrente", "Recorrente"],
            ] as [Tipo, string][]
          ).map(([valorTipo, rotulo]) => (
            <button
              type="button"
              key={valorTipo}
              onClick={() => setTipo(valorTipo)}
              className={`rounded-xl border py-2.5 text-xs font-semibold transition ${
                tipo === valorTipo
                  ? "border-brand-pink bg-brand-pink/10 text-brand-pink"
                  : "border-base-border text-ink-muted hover:bg-base-surface2"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Descrição</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Internet, Geladeira, Mercado"
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

          <div>
            <label className="mb-1 block text-xs text-ink-muted">
              Grupo (opcional) — junta várias contas, ex: "SAAEB", "CPFL", nome de alguém
            </label>
            <select
              value={grupoId}
              onChange={(e) => {
                setGrupoId(e.target.value);
                if (e.target.value) setNovoGrupo("");
              }}
              className="mb-2 w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
            >
              <option value="">Sem grupo</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
            <input
              value={novoGrupo}
              onChange={(e) => {
                setNovoGrupo(e.target.value);
                if (e.target.value) setGrupoId("");
              }}
              placeholder="...ou crie um grupo novo"
              className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
            />
          </div>

          {tipo === "simples" && (
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
                <label className="mb-1 block text-xs text-ink-muted">Vencimento</label>
                <input
                  type="date"
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                  className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
                />
              </div>
              <p className="col-span-2 text-xs text-ink-muted">
                A conta entra no mês do vencimento informado — mesmo que seja de um mês passado ou futuro.
              </p>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-ink-muted">
                  Mês de referência (opcional, se for diferente do vencimento)
                </label>
                <input
                  type="month"
                  value={mesReferenciaCustom}
                  onChange={(e) => setMesReferenciaCustom(e.target.value)}
                  className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
                />
              </div>
            </div>
          )}

          {tipo === "parcelado" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Valor total (R$)</label>
                <input
                  value={valorTotal}
                  onChange={(e) => setValorTotal(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Número de parcelas</label>
                <input
                  type="number"
                  min={1}
                  value={numParcelas}
                  onChange={(e) => setNumParcelas(e.target.value)}
                  className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-ink-muted">Primeiro vencimento</label>
                <input
                  type="date"
                  value={primeiroVencimento}
                  onChange={(e) => setPrimeiroVencimento(e.target.value)}
                  className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
                />
              </div>
              {parcelaEstimativa && (
                <p className="col-span-2 text-xs text-ink-muted">
                  ≈ {parcelaEstimativa} por mês, durante {numParcelas || 0} meses.
                </p>
              )}
            </div>
          )}

          {tipo === "recorrente" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Valor mensal (R$)</label>
                <input
                  value={valorRecorrente}
                  onChange={(e) => setValorRecorrente(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Dia do vencimento</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={diaVencimento}
                  onChange={(e) => setDiaVencimento(e.target.value)}
                  className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-ink-muted">Começa em</label>
                <input
                  type="date"
                  value={inicioRecorrencia}
                  onChange={(e) => setInicioRecorrencia(e.target.value)}
                  className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
                />
              </div>
              <p className="col-span-2 text-xs text-ink-muted">
                Vai continuar aparecendo todo mês até você desativá-la em Saídas.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-ink-muted">Forma de pagamento (opcional)</label>
            <input
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              placeholder="Ex: Pix, Cartão, Dinheiro"
              className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
            />
          </div>

          <div className="rounded-xl border border-base-border bg-base-surface2 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={jaPaga}
                onChange={(e) => setJaPaga(e.target.checked)}
                className="h-4 w-4 accent-brand-pink"
              />
              Essa conta já está paga
            </label>
            {jaPaga && (
              <div className="mt-3">
                <label className="mb-1 block text-xs text-ink-muted">Paga em</label>
                <input
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                  className="w-full rounded-xl border border-base-border bg-base-surface px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
                />
                {tipo !== "simples" && (
                  <p className="mt-1 text-xs text-ink-muted">
                    {tipo === "parcelado"
                      ? "Marca só a primeira parcela como paga."
                      : "Marca só o primeiro mês como pago."}
                  </p>
                )}
              </div>
            )}
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
