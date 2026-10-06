"use client";

import { useState } from "react";
import type { ExpenseGroup } from "@/types/database";

interface Props {
  grupos: ExpenseGroup[];
  qtdParcelas: number;
  qtdContas: number;
  aplicando: boolean;
  erro: string | null;
  onTodas: () => void;
  onLimpar: () => void;
  onAplicar: (grupoId: string | null, novoGrupo: string) => void;
  onCancelar: () => void;
}

// Barra fixa no rodapé para colocar várias contas em um grupo de uma vez.
export function BulkGroupBar({
  grupos,
  qtdParcelas,
  qtdContas,
  aplicando,
  erro,
  onTodas,
  onLimpar,
  onAplicar,
  onCancelar,
}: Props) {
  const [grupoId, setGrupoId] = useState("");
  const [novoGrupo, setNovoGrupo] = useState("");
  const [removerGrupo, setRemoverGrupo] = useState(false);

  const podeAplicar = qtdParcelas > 0 && (removerGrupo || grupoId !== "" || novoGrupo.trim() !== "");

  return (
    <div className="sticky bottom-20 z-30 mt-4 rounded-card border border-brand-pink/40 bg-base-surface p-4 shadow-card md:bottom-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {qtdParcelas === 0
            ? "Marque as contas que quer agrupar"
            : `${qtdParcelas} selecionada${qtdParcelas > 1 ? "s" : ""}`}
        </p>
        <div className="flex gap-3 text-xs">
          <button type="button" onClick={onTodas} className="font-semibold text-brand-pink hover:underline">
            Selecionar todas
          </button>
          <button type="button" onClick={onLimpar} className="text-ink-muted hover:underline">
            Limpar
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={removerGrupo ? "__remover" : grupoId}
          onChange={(e) => {
            const v = e.target.value;
            setRemoverGrupo(v === "__remover");
            setGrupoId(v === "__remover" ? "" : v);
            if (v) setNovoGrupo("");
          }}
          className="w-full rounded-xl border border-base-border bg-base-surface2 px-3 py-2 text-sm outline-none focus:border-brand-pink sm:w-auto sm:min-w-[170px]"
        >
          <option value="">Escolha o grupo...</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nome}
            </option>
          ))}
          <option value="__remover">Tirar do grupo (sem grupo)</option>
        </select>
        <input
          value={novoGrupo}
          onChange={(e) => {
            setNovoGrupo(e.target.value);
            if (e.target.value) {
              setGrupoId("");
              setRemoverGrupo(false);
            }
          }}
          placeholder="...ou crie um grupo novo"
          className="w-full rounded-xl border border-base-border bg-base-surface2 px-3 py-2 text-sm outline-none focus:border-brand-pink sm:flex-1"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 rounded-xl border border-base-border px-4 py-2 text-sm font-medium hover:bg-base-surface2 sm:flex-none"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!podeAplicar || aplicando}
            onClick={() => onAplicar(removerGrupo ? null : grupoId || null, novoGrupo)}
            className="flex-1 rounded-xl bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pinkDark disabled:opacity-50 sm:flex-none"
          >
            {aplicando ? "Aplicando..." : "Aplicar"}
          </button>
        </div>
      </div>

      {qtdParcelas > 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          {qtdContas === qtdParcelas
            ? `${qtdContas} conta${qtdContas > 1 ? "s" : ""} será${qtdContas > 1 ? "ão" : ""} alterada${qtdContas > 1 ? "s" : ""}.`
            : `${qtdContas} conta${qtdContas > 1 ? "s" : ""} no total, pois algumas parcelas são da mesma compra.`}{" "}
          Em contas parceladas ou recorrentes, o grupo vale para todas as parcelas e meses.
        </p>
      )}
      {erro && <p className="mt-2 text-xs text-money-out">{erro}</p>}
    </div>
  );
}
