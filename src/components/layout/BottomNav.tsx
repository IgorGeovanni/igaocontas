"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { MOBILE_NAV_ITEMS } from "@/lib/nav-items";

export function BottomNav() {
  const pathname = usePathname();
  const emMais = ["/agenda", "/relatorios", "/configuracoes"].some((p) =>
    pathname.startsWith(p)
  );

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-base-border bg-base-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden">
      {MOBILE_NAV_ITEMS.map((item) => {
        const ativo = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
              ativo ? "text-brand-pink" : "text-ink-muted"
            }`}
          >
            <Icon size={21} />
            {item.label === "Contas do Mês" ? "Contas" : item.label}
          </Link>
        );
      })}
      <Link
        href="/mais"
        className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
          emMais ? "text-brand-pink" : "text-ink-muted"
        }`}
      >
        <MoreHorizontal size={21} />
        Mais
      </Link>
    </nav>
  );
}
