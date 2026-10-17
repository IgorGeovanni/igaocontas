"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mensagemDeErro } from "@/lib/rede/redeResiliente";
import { useCategories } from "@/lib/hooks/useCategories";
import { useGroups } from "@/lib/hooks/useGroups";
import { mesAtualISO } from "@/lib/finance/dates";
import type { ExpenseSource } from "@/types/database";

interface Props {
  fonte: ExpenseSource | null;
  onFechar: () => void;
  onSalvo: () => void;
}

export function EditExpenseSourceModal({ fonte, onFechar, onSalvo }: Props) {
  const { categorias } = useCategories("saida");
  const { grupos } = useGroups();
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("");
  const [atualizarPendentes, setAtualizarPendentes] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (fonte) {
      setDescricao(fonte.descricao);
      setCategoriaId(fonte.categoria_id ?? "");
      setGrupoId(fonte.grupo_id ?? "");
      setFormaPagamento(fonte.forma_pagamento ?? "");
      setObservacao(fonte.observacao ?? "");
      setDiaVencimento(fonte.dia_vencimento ? String(fonte.dia_vencimento) : "");
      setAtualizarPendentes(true);
      setErro(null);
    }
  }, [fonte]);

  if (!fonte) return null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim()) {
      setErro("Informe uma descrição.");
      return;
    }
    const recorrente = fonte!.tipo === "recorrente";
    const dia = Number(diaVencimento);
    if (recorrente && (!Number.isInteger(dia) || dia < 1 || dia > 31)) {
      setErro("Informe um dia de vencimento entre 1 e 31.");
      return;
    }

    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("expense_sources")
      .update({
        descricao: descricao.trim(),
        categoria_id: categoriaId || null,
        grupo_id: grupoId || null,
        forma_pagamento: formaPagamento || null,
        observacao: observacao || null,
        ...(recorrente ? { dia_vencimento: dia } : {}),
      })
      .eq("id", fonte!.id);
    if (error) {
      setSalvando(false);
      setErro(mensagemDeErro(error));
      return;
    }

    // Recorrente com dia novo: ajusta as contas pendentes já criadas (deste mês em diante).
    // Meses anteriores, contas pagas e contas adiadas ficam como estão.
    if (recorrente && atualizarPendentes && dia !== fonte!.dia_vencimento) {
      const { data: pendentes, error: erroPendentes } = await supabase
        .from("expense_installments")
        .select("id, mes_referencia, mes_referencia_original")
        .eq("source_id", fonte!.id)
        .eq("status", "pendente")
        .gte("mes_referencia", mesAtualISO());

      if (erroPendentes) {
        setSalvando(false);
        setErro(`A conta foi salva, mas não deu para ajustar o vencimento das próximas: ${mensagemDeErro(erroPendentes)}`);
        return;
      }
      for (const parcela of pendentes ?? []) {
        if (parcela.mes_referencia !== parcela.mes_referencia_original) continue; // adiada
        const [ano, mes] = parcela.mes_referencia.split("-").map(Number);
        const ultimoDia = new Date(ano, mes, 0).getDate();
        const novoVencimento = `${ano}-${String(mes).padStart(2, "0")}-${String(
          Math.min(dia, ultimoDia)
        ).padStart(2, "0")}`;
        const { error: erroParcela } = await supabase
          .from("expense_installments")
          .update({ vencimento_atual: novoVencimento, vencimento_original: novoVencimento })
          .eq("id", parcela.id);
        if (erroParcela) {
          setSalvando(false);
          setErro(`A conta foi salva, mas parte dos vencimentos não foi ajustada (toque em Salvar de novo): ${mensagemDeErro(erroParcela)}`);
          return;
        }
      }
    }

    setSalvando(false);
    onSalvo();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center">
      <form
        onSubmit={salvar}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card border border-base-border bg-base-surface p-5 shadow-card"
      >
        <h2 className="mb-4 font-display text-lg font-semibold">Editar conta</h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Descrição</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
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
            <label className="mb-1 block text-xs text-ink-muted">Grupo</label>
            <select
              value={grupoId}
              onChange={(e) => setGrupoId(e.target.value)}
              className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
            >
              <option value="">Sem grupo</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-muted">
              Novos grupos são criados em Configurações ou ao cadastrar uma conta nova.
            </p>
          </div>
          {fonte.tipo === "recorrente" && (
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Dia do vencimento (todo mês)</label>
              <input
                type="number"
                min={1}
                max={31}
                value={diaVencimento}
                onChange={(e) => setDiaVencimento(e.target.value)}
                className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
              />
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={atualizarPendentes}
                  onChange={(e) => setAtualizarPendentes(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-brand-pink"
                />
                Atualizar também as contas ainda pendentes deste mês em diante. Contas já pagas e meses
                anteriores não mudam.
              </label>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Forma de pagamento</label>
            <input
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Observação</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-ink-muted">
          {fonte.tipo === "recorrente"
            ? "O valor não pode ser editado por aqui para preservar o histórico. Para mudar o valor, exclua e cadastre novamente."
            : "Valor, parcelas e datas não podem ser editados por aqui para preservar o histórico. Para isso, exclua e cadastre novamente."}
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
