"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SESSION_MAX_MS, lerInicioDaSessao, limparInicioDaSessao } from "@/lib/session";

// Desloga o usuário 30 minutos depois do login. Usa intervalo + eventos de
// foco porque timers de abas em segundo plano (principalmente no celular)
// podem ser pausados pelo navegador.
export function SessionTimeout() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let encerrando = false;

    async function encerrar() {
      if (encerrando) return;
      encerrando = true;
      limparInicioDaSessao();
      // scope "local": encerra só este dispositivo
      await supabase.auth.signOut({ scope: "local" });
      router.replace("/login?motivo=expirada");
      router.refresh();
    }

    function verificar() {
      const inicio = lerInicioDaSessao();
      if (inicio === null || Date.now() - inicio >= SESSION_MAX_MS) {
        encerrar();
      }
    }

    verificar();
    const intervalo = setInterval(verificar, 5_000);
    document.addEventListener("visibilitychange", verificar);
    window.addEventListener("focus", verificar);

    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", verificar);
      window.removeEventListener("focus", verificar);
    };
  }, [router]);

  return null;
}
