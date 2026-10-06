"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseGroup } from "@/types/database";

export function useGroups() {
  const [grupos, setGrupos] = useState<ExpenseGroup[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function recarregar() {
    setCarregando(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("expense_groups")
      .select("*")
      .order("nome", { ascending: true });
    if (error) console.error("Erro ao carregar grupos:", error.message);
    setGrupos((data as ExpenseGroup[]) ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    recarregar();
  }, []);

  return { grupos, carregando, recarregar };
}
