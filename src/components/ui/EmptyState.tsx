interface EmptyStateProps {
  titulo: string;
  descricao?: string;
  icone?: string;
}

export function EmptyState({ titulo, descricao, icone = "📭" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-base-border py-14 text-center">
      <span className="mb-3 text-3xl">{icone}</span>
      <p className="font-medium text-ink-primary">{titulo}</p>
      {descricao && <p className="mt-1 max-w-xs text-sm text-ink-muted">{descricao}</p>}
    </div>
  );
}
