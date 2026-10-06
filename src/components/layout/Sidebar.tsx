"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ChevronsLeft, ChevronsRight } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav-items";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "igao-contas:sidebar-colapsada";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [colapsada, setColapsada] = useState(false);

  useEffect(() => {
    const salvo = window.localStorage.getItem(STORAGE_KEY);
    if (salvo === "1") setColapsada(true);
  }, []);

  function alternarColapso() {
    setColapsada((atual) => {
      const novo = !atual;
      window.localStorage.setItem(STORAGE_KEY, novo ? "1" : "0");
      return novo;
    });
  }

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={`no-print relative hidden shrink-0 flex-col border-r border-base-border bg-base-surface py-6 transition-all duration-200 md:flex ${
        colapsada ? "w-20 px-2" : "w-64 px-4"
      }`}
    >
      <div className={`mb-8 flex items-center gap-2 ${colapsada ? "justify-center px-0" : "px-2"}`}>
        <Image src="/logo.png" alt="IGÃO CONTAS" width={36} height={36} className="shrink-0 rounded-lg" />
        {!colapsada && <span className="truncate font-display text-lg font-bold">IGÃO CONTAS</span>}
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const ativo = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={colapsada ? item.label : undefined}
              className={`flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition ${
                colapsada ? "justify-center px-0" : "px-3"
              } ${
                ativo
                  ? "bg-brand-pink text-white"
                  : "text-ink-muted hover:bg-base-surface2 hover:text-ink-primary"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {!colapsada && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={sair}
        title={colapsada ? "Sair" : undefined}
        className={`flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium text-ink-muted transition hover:bg-base-surface2 hover:text-money-out ${
          colapsada ? "justify-center px-0" : "px-3"
        }`}
      >
        <LogOut size={18} className="shrink-0" />
        {!colapsada && "Sair"}
      </button>

      <button
        onClick={alternarColapso}
        aria-label={colapsada ? "Expandir menu" : "Recolher menu"}
        title={colapsada ? "Expandir menu" : "Recolher menu"}
        className="absolute -right-3 top-9 flex h-6 w-6 items-center justify-center rounded-full border border-base-border bg-base-surface2 text-ink-muted hover:text-brand-pink"
      >
        {colapsada ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
      </button>
    </aside>
  );
}
