"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { marcarInicioDaSessao } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("motivo") === "expirada") {
      setAviso("Sua sessão expirou após 30 minutos. Entre novamente.");
    }
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (error) {
      setCarregando(false);
      setErro("E-mail ou senha inválidos.");
      return;
    }

    // Marca o início da sessão (deslogar após 30 minutos)
    marcarInicioDaSessao();

    // Consulta leve no banco a cada login, para o Supabase não pausar o
    // projeto por inatividade. Se falhar, não atrapalha o login.
    try {
      await supabase.from("categories").select("id").limit(1);
    } catch {
      // ignorado de propósito
    }

    setCarregando(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 flex flex-col items-center">
        <Image src="/logo.png" alt="IGÃO CONTAS" width={120} height={120} priority />
      </div>

      <div className="w-full max-w-sm rounded-card border border-base-border bg-base-surface p-6 shadow-card">
        <h1 className="mb-6 text-center font-display text-lg font-semibold">Entrar</h1>

        <form onSubmit={entrar} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-ink-muted">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-3 text-sm outline-none focus:border-brand-pink"
              placeholder="voce@email.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-muted">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-3 text-sm outline-none focus:border-brand-pink"
              placeholder="••••••••"
            />
          </div>

          {aviso && !erro && <p className="text-sm text-ink-muted">{aviso}</p>}
          {erro && <p className="text-sm text-money-out">{erro}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-brand-pink py-3 text-sm font-semibold text-white transition hover:bg-brand-pinkDark disabled:opacity-60"
          >
            {carregando ? "Aguarde..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
