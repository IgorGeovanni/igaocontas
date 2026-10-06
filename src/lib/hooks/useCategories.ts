"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, TipoCategoria } from "@/types/database";

export function useCategories(tipo: TipoCategoria) {
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function recarregar() {
    setCarregando(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("tipo", tipo)
      .order("is_default", { ascending: false })
      .order("nome", { ascending: true });
    setCategorias((data as Category[]) ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  return { categorias, carregando, recarregar };
}
