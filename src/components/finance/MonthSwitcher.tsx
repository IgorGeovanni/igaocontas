"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { mesAnterior, mesSeguinte, rotuloMes } from "@/lib/finance/dates";

interface MonthSwitcherProps {
  mes: string; // "YYYY-MM-01"
  onChange: (novoMes: string) => void;
}

export function MonthSwitcher({ mes, onChange }: MonthSwitcherProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-pill border border-base-border bg-base-surface px-2 py-1.5">
      <button
        onClick={() => onChange(mesAnterior(mes))}
        aria-label="Mês anterior"
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-base-surface2"
      >
        <ChevronLeft size={18} />
      </button>
      <span className="min-w-[9rem] text-center text-sm font-semibold capitalize">
        {rotuloMes(mes)}
      </span>
      <button
        onClick={() => onChange(mesSeguinte(mes))}
        aria-label="Próximo mês"
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-base-surface2"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
