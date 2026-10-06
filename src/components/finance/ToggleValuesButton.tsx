"use client";

import { Eye, EyeOff } from "lucide-react";
import { useValueVisibility } from "@/components/ValueVisibilityContext";

export function ToggleValuesButton() {
  const { ocultar, alternar } = useValueVisibility();

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={ocultar ? "Mostrar valores" : "Ocultar valores"}
      title={ocultar ? "Mostrar valores" : "Ocultar valores"}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-base-surface2 text-ink-primary transition hover:bg-base-border active:scale-95"
    >
      {ocultar ? <EyeOff size={19} /> : <Eye size={19} />}
    </button>
  );
}
