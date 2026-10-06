import { Card } from "@/components/ui/Card";
import type { ContaAcabando } from "@/lib/finance/dashboardData";

export function ContasAcabandoCard({ contas }: { contas: ContaAcabando[] }) {
  if (contas.length === 0) return null;

  return (
    <Card>
      <h3 className="mb-3 font-display text-base font-semibold">Contas acabando</h3>
      <ul className="space-y-3">
        {contas.map((c) => (
          <li key={c.sourceId} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink-primary">{c.descricao}</p>
              <p className="text-xs text-ink-muted">
                Parcela {c.numeroAtual}/{c.totalParcelas}
              </p>
            </div>
            <span className="rounded-pill bg-brand-gold/15 px-2.5 py-1 text-xs font-medium text-brand-gold">
              Falta{c.faltam > 1 ? "m" : ""} {c.faltam}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
