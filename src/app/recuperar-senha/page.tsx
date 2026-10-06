"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RecuperarSenhaPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/redefinir-senha` : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setEnviado(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-card border border-base-border bg-base-surface p-6 shadow-card">
        <h1 className="mb-1 font-display text-xl font-semibold">Recuperar senha</h1>
        <p className="mb-6 text-sm text-ink-muted">
          Informe seu e-mail e enviaremos um link para redefinir sua senha.
        </p>

        {enviado ? (
          <p className="text-sm text-money-in">
            Se este e-mail existir na nossa base, você receberá um link em instantes.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-3 text-sm outline-none focus:border-brand-pink"
            />
            {erro && <p className="text-sm text-money-out">{erro}</p>}
            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded-xl bg-brand-pink py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {carregando ? "Enviando..." : "Enviar link"}
            </button>
          </form>
        )}

        <div className="mt-4 text-center">
          <Link href="/login" className="text-sm text-ink-muted hover:text-brand-pink">
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
