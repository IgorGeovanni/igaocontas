import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/finance/Money";
import { formatarPercentual } from "@/lib/finance/money";

interface StatCardProps {
  label: string;
  centavos: number;
  icon?: LucideIcon;
  /**
   * "in": sempre verde (entradas/dinheiro que entra)
   * "out": sempre vermelho/laranja (saídas/dinheiro que sai)
   * "auto": verde se positivo, vermelho se negativo (ex: saldo)
   * indefinido: sem cor (neutro)
   */
  tom?: "in" | "out" | "auto";
  variacao?: number | null; // percentual, opcional
  variacaoLabel?: string;
}

export function StatCard({
  label,
  centavos,
  icon: Icon,
  tom,
  variacao,
  variacaoLabel,
}: StatCardProps) {
  const positivo = (variacao ?? 0) >= 0;

  const corValor =
    tom === "in"
      ? "text-money-in"
      : tom === "out"
        ? "text-money-out"
        : tom === "auto"
          ? centavos >= 0
            ? "text-money-in"
            : "text-money-out"
          : "";

  return (
    <Card className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-ink-muted">{label}</span>
        {Icon && <Icon size={18} className="shrink-0 text-ink-faint" />}
      </div>
      <Money
        centavos={centavos}
        className={`block truncate font-tabular text-xl font-semibold sm:text-2xl ${corValor}`}
      />
      {variacao !== null && variacao !== undefined && (
        <span className={`truncate text-xs ${positivo ? "text-money-in" : "text-money-out"}`}>
          {formatarPercentual(variacao)} {variacaoLabel ?? "vs. mês anterior"}
        </span>
      )}
    </Card>
  );
}
