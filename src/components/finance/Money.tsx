"use client";

import { formatarMoeda } from "@/lib/finance/money";
import { useValueVisibility } from "@/components/ValueVisibilityContext";

interface MoneyProps {
  centavos: number;
  className?: string;
  colorir?: boolean; // se true, verde quando positivo e laranja quando negativo
}

export function Money({ centavos, className = "", colorir = false }: MoneyProps) {
  const { ocultar } = useValueVisibility();

  if (ocultar) {
    return <span className={`whitespace-nowrap ${className}`}>••••••</span>;
  }

  const cor = colorir ? (centavos >= 0 ? "text-money-in" : "text-money-out") : "";

  return <span className={`whitespace-nowrap ${className} ${cor}`}>{formatarMoeda(centavos)}</span>;
}
