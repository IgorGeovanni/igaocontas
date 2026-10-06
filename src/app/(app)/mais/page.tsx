"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, FileBarChart2, PiggyBank, Settings, LogOut, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

const ITENS = [
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/guardado", label: "Guardado / Investido", icon: PiggyBank },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart2 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function MaisPage() {
  const router = useRouter();
  const supabase = createClient();

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="md:hidden">
      <PageHeader title="Mais" />
      <div className="space-y-2.5">
        {ITENS.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <item.icon size={18} className="text-brand-pink" />
                <span className="font-medium">{item.label}</span>
              </div>
              <ChevronRight size={18} className="text-ink-faint" />
            </Card>
          </Link>
        ))}
        <button onClick={sair} className="w-full text-left">
          <Card className="flex items-center gap-3 py-4">
            <LogOut size={18} className="text-money-out" />
            <span className="font-medium text-money-out">Sair</span>
          </Card>
        </button>
      </div>
    </div>
  );
}
