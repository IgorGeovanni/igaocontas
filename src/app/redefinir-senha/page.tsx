"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { marcarInicioDaSessao } from "@/lib/session";

export default function RedefinirSenhaPage() {
  const supabase = createClient();
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase.auth.updateUser({ password: senha });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    // a sessão criada pelo link de recuperação conta como um novo login
    marcarInicioDaSessao();
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-card border border-base-border bg-base-surface p-6 shadow-card">
        <h1 className="mb-1 font-display text-xl font-semibold">Nova senha</h1>
        <p className="mb-6 text-sm text-ink-muted">Escolha uma nova senha para sua conta.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Nova senha"
            className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-3 text-sm outline-none focus:border-brand-pink"
          />
          {erro && <p className="text-sm text-money-out">{erro}</p>}
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-brand-pink py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {carregando ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
