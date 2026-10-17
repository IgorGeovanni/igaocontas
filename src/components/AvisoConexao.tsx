"use client";

import { useEffect, useState } from "react";
import { aoUsarCache } from "@/lib/rede/redeResiliente";

// Faixa no topo: sem internet, ou mostrando dados guardados de alguns minutos atrás.
export function AvisoConexao() {
  const [offline, setOffline] = useState(false);
  const [cacheDe, setCacheDe] = useState<number | null>(null);

  useEffect(() => {
    setOffline(navigator.onLine === false);
    const on = () => {
      setOffline(false);
      setCacheDe(null);
    };
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const sair = aoUsarCache(({ quando }) => setCacheDe(quando));
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      sair();
    };
  }, []);

  useEffect(() => {
    if (!cacheDe) return;
    const t = setTimeout(() => setCacheDe(null), 20_000);
    return () => clearTimeout(t);
  }, [cacheDe]);

  if (!offline && !cacheDe) return null;
  const texto = offline
    ? "Sem internet. O que você salvar agora vai esperar a conexão voltar (até 30 segundos)."
    : `Conexão instável: mostrando os dados de ${new Date(cacheDe!).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}.`;

  return (
    <div
      role="status"
      className={`sticky top-0 z-40 px-4 py-2 text-center text-xs font-semibold ${
        offline ? "bg-money-out text-white" : "bg-brand-gold/20 text-ink-primary"
      }`}
    >
      {texto}
    </div>
  );
}
