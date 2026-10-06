"use client";

interface ConfirmDialogProps {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  confirmarLabel?: string;
  cancelarLabel?: string;
  perigoso?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ConfirmDialog({
  aberto,
  titulo,
  descricao,
  confirmarLabel = "Confirmar",
  cancelarLabel = "Cancelar",
  perigoso = false,
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center">
      <div className="w-full max-w-sm rounded-card border border-base-border bg-base-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold">{titulo}</h2>
        {descricao && <p className="mt-2 text-sm text-ink-muted">{descricao}</p>}
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancelar}
            className="flex-1 rounded-xl border border-base-border py-2.5 text-sm font-medium text-ink-primary hover:bg-base-surface2"
          >
            {cancelarLabel}
          </button>
          <button
            onClick={onConfirmar}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white ${
              perigoso ? "bg-money-out hover:opacity-90" : "bg-brand-pink hover:bg-brand-pinkDark"
            }`}
          >
            {confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
