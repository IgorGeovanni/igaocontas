"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { CategoryManager } from "@/components/CategoryManager";
import { GroupManager } from "@/components/GroupManager";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export default function ConfiguracoesPage() {
  const { user } = useUser();
  const router = useRouter();
  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setPerfil(data as Profile);
        setNome((data as Profile)?.nome ?? "");
      });
  }, [user]);

  async function salvarPerfil(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSalvando(true);
    setMensagem(null);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ nome }).eq("id", user.id);
    setSalvando(false);
    setMensagem(error ? "Não foi possível salvar." : "Salvo!");
  }

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Seu perfil e preferências do IGÃO CONTAS." />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-display text-base font-semibold">Perfil</h3>
          <form onSubmit={salvarPerfil} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm outline-none focus:border-brand-pink"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">E-mail</label>
              <input
                value={user?.email ?? ""}
                disabled
                className="w-full rounded-xl border border-base-border bg-base-surface2 px-4 py-2.5 text-sm text-ink-muted outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-xl bg-brand-pink px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-pinkDark disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            {mensagem && <p className="text-xs text-ink-muted">{mensagem}</p>}
          </form>
        </Card>

        {user && <CategoryManager userId={user.id} />}
        {user && <GroupManager userId={user.id} />}
      </div>

      <button
        onClick={sair}
        className="mt-4 flex items-center gap-2 rounded-xl border border-base-border px-4 py-2.5 text-sm font-medium text-money-out hover:bg-base-surface2"
      >
        <LogOut size={16} /> Sair da conta
      </button>
    </div>
  );
}
