"use client";

import { useState } from "react";
import type { Category, ExpenseGroup } from "@/types/database";

// undefined = não mexer · null = remover · string = id escolhido
export interface AlteracaoEmLote {
  grupoId?: string | null;
  novoGrupo: string;
  categoriaId?: string | null;
}

interface Props {
  grupos: ExpenseGroup[];
  categorias: Category[];
  qtdParcelas: number;
  qtdContas: number;
  aplicando: boolean;
  erro: string | null;
  onTodas: () => void;
  onLimpar: () => void;
  onAplicar: (alteracao: AlteracaoEmLote) => void;
  onCancelar: () => void;
}

const REMOVER = "__remover";

const estiloSelect =
  "w-full rounded-xl border border-base-border bg-base-surface2 px-3 py-2 text-sm outline-none focus:border-brand-pink";

// Barra fixa no rodapé para definir grupo e/ou categoria de várias contas de uma vez.
export function BulkGroupBar({
  grupos,
  categorias,
  qtdParcelas,
  qtdContas,
  aplicando,
  erro,
  onTodas,
  onLimpar,
  onAplicar,
  onCancelar,
}: Props) {
  const [grupoSel, setGrupoSel] = useState("");
  const [novoGrupo, setNovoGrupo] = useState("");
  const [categoriaSel, setCategoriaSel] = useState("");

  const algumaMudanca = grupoSel !== "" || novoGrupo.trim() !== "" || categoriaSel !== "";
  const podeAplicar = qtdParcelas > 0 && algumaMudanca;

  function aplicar() {
    onAplicar({
      grupoId: grupoSel === "" ? undefined : grupoSel === REMOVER ? null : grupoSel,
      novoGrupo,
      categoriaId: categoriaSel === "" ? undefined : categoriaSel === REMOVER ? null : categoriaSel,
    });
  }

  return (
    <div className="sticky bottom-20 z-30 mt-4 rounded-card border border-brand-pink/40 bg-base-surface p-4 shadow-card md:bottom-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {qtdParcelas === 0
            ? "Marque as contas que quer alterar"
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

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Grupo</label>
          <select
            value={grupoSel}
            onChange={(e) => {
              setGrupoSel(e.target.value);
              if (e.target.value) setNovoGrupo("");
            }}
            className={estiloSelect}
          >
            <option value="">Não alterar</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
            <option value={REMOVER}>Tirar do grupo (sem grupo)</option>
          </select>
          <input
            value={novoGrupo}
            onChange={(e) => {
              setNovoGrupo(e.target.value);
              if (e.target.value) setGrupoSel("");
            }}
            placeholder="...ou crie um grupo novo"
            className={`${estiloSelect} mt-2`}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-muted">Categoria</label>
          <select value={categoriaSel} onChange={(e) => setCategoriaSel(e.target.value)} className={estiloSelect}>
            <option value="">Não alterar</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
            <option value={REMOVER}>Tirar da categoria (sem categoria)</option>
          </select>
        </div>
      </div>

      <div className="mt-3 flex gap-2 sm:justify-end">
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
          onClick={aplicar}
          className="flex-1 rounded-xl bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pinkDark disabled:opacity-50 sm:flex-none"
        >
          {aplicando ? "Aplicando..." : "Aplicar"}
        </button>
      </div>

      {qtdParcelas > 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          {qtdContas === qtdParcelas
            ? `${qtdContas} conta${qtdContas > 1 ? "s" : ""} será${qtdContas > 1 ? "ão" : ""} alterada${qtdContas > 1 ? "s" : ""}.`
            : `${qtdContas} conta${qtdContas > 1 ? "s" : ""} no total, pois algumas parcelas são da mesma compra.`}{" "}
          Em contas parceladas ou recorrentes, a mudança vale para todas as parcelas e meses.
        </p>
      )}
      {erro && <p className="mt-2 text-xs text-money-out">{erro}</p>}
    </div>
  );
}
