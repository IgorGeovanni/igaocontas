interface StatusBadgeProps {
  status: "pago" | "pendente" | "atrasado";
}

const estilos: Record<StatusBadgeProps["status"], string> = {
  pago: "bg-money-in/15 text-money-in",
  pendente: "bg-brand-gold/15 text-brand-gold",
  atrasado: "bg-money-out/15 text-money-out",
};

const rotulos: Record<StatusBadgeProps["status"], string> = {
  pago: "Pago",
  pendente: "Pendente",
  atrasado: "Atrasada",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${estilos[status]}`}>
      {rotulos[status]}
    </span>
  );
}
