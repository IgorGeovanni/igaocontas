"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useGroups } from "@/lib/hooks/useGroups";
import { mensagemErroGrupo } from "@/lib/finance/erros";
import { textoParaCentavos, centavosParaReais, formatarMoeda } from "@/lib/finance/money";
import { mesReferenciaDeString } from "@/lib/finance/dates";
import type { ExpenseInstallmentWithSource } from "@/types/database";

interface Props {
  parcela: ExpenseInstallmentWithSource | null;
  onFechar: () => void;
  onSalvo: () => void;
}

export function EditInstallmentModal({ parcela, onFechar, onSalvo }: Props) {
  const [valor, setValor] = useState("");
  const [juros, setJuros] = useState("");
  const [vencimento, setVencimento] = useState("");
  const { grupos, recarregar: recarregarGrupos } = useGroups();
  const [grupoId, setGrupoId] = useState("");
  const [novoGrupo, setNovoGrupo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (parcela) {
      setValor(String(centavosParaReais(parcela.valor_centavos)).replace(".", ","));
      setJuros(parcela.juros_centavos > 0 ? String(centavosParaReais(parcela.juros_centavos)).replace(".", ",") : "");
      setVencimento(parcela.vencimento_atual);
      setGrupoId(parcela.expense_sources.grupo_id ?? "");
      setNovoGrupo("");
      setErro(null);
    }
  }, [parcela]);

  if (!parcela) return null;

  const valorCentavos = textoParaCentavos(valor || "0");
  const jurosCentavos = textoParaCentavos(juros || "0");
  const total = valorCentavos + jurosCentavos;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (valorCentavos <= 0 || !vencimento) {
      setErro("Informe um valor e uma data de vencimento válidos.");
      return;
    }

    setSalvando(true);
    const supabase = createClient();

    // grupo: usa o escolhido na lista ou cria um novo se foi digitado
    let grupoFinal: string | null = grupoId || null;
    if (novoGrupo.trim()) {
      const { data: criado, error: erroGrupo } = await supabase
        .from("expense_groups")
        .insert({ user_id: (await supabase.auth.getUser()).data.user?.id, nome: novoGrupo.trim() })
        .select("id")
        .single();
      if (erroGrupo || !criado) {
        setSalvando(false);
        setErro(erroGrupo ? mensagemErroGrupo(erroGrupo) : "Não foi possível criar o grupo.");
        return;
      }
      grupoFinal = criado.id;
    }
    if (grupoFinal !== (parcela!.expense_sources.grupo_id ?? null)) {
      const { error: erroFonte } = await supabase
        .from("expense_sources")
        .update({ grupo_id: grupoFinal })
        .eq("id", parcela!.source_id);
      if (erroFonte) {
        setSalvando(false);
        setErro(erroFonte.message);
        return;
      }
    }
    recarregarGrupos();

    const { error } = await supabase
      .from("expense_installments")
      .update({
        valor_centavos: valorCentavos,
        juros_centavos: jurosCentavos,
        vencimento_atual: vencimento,
        mes_referencia: mesReferenciaDeString(vencimento),
      })
      .eq("id", parcela!.id);

    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    onSalvo();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center">
      <form
        onSubmit={salvar}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card border border-base-border bg-base-surface p-5 shadow-card"
      >
        <h2 className="mb-1 font-display text-lg font-semibold">Editar conta</h2>
        <p className="mb-4 truncate text-sm text-ink-muted">
          {parcela.expense_sources.descricao}
          {parcela.total_parcelas && parcela.total_parcelas > 1
            ? ` · Parcela ${parcela.numero_parcela}/${parcela.total_parcelas}`
            : ""}
        </p>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Valor principal (R$)</label>
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
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-muted">
              Juros / multa avulsa (R$) — opcional
            </label>
            <input
              value={juros}
              onChange={(e) => setJuros(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
            />
            <p className="mt-1 text-xs text-ink-muted">
              Some ao valor principal só desta conta. Não é calculado sozinho por atraso — você
              preenche quando precisar.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-muted">Grupo</label>
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
            {parcela.total_parcelas && parcela.total_parcelas > 1 && (
              <p className="mt-1 text-xs text-ink-muted">
                O grupo vale para todas as parcelas dessa compra.
              </p>
            )}
          </div>

          {jurosCentavos > 0 && (
            <div className="rounded-xl border border-base-border bg-base-surface2 px-4 py-3 text-sm">
              <div className="flex justify-between text-ink-muted">
                <span>Principal</span>
                <span>{formatarMoeda(valorCentavos)}</span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>Juros</span>
                <span>{formatarMoeda(jurosCentavos)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-base-border pt-1 font-semibold">
                <span>Total a pagar</span>
                <span>{formatarMoeda(total)}</span>
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-ink-muted">
          O mês de referência é ajustado automaticamente para o mês do novo vencimento.
        </p>

        {erro && <p className="mt-2 text-sm text-money-out">{erro}</p>}

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
