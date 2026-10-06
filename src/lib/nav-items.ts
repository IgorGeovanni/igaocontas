import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarCheck2,
  CalendarDays,
  FileBarChart2,
  PiggyBank,
  Settings,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/entradas", label: "Entradas", icon: ArrowDownCircle },
  { href: "/saidas", label: "Saídas", icon: ArrowUpCircle },
  { href: "/contas-do-mes", label: "Contas do Mês", icon: CalendarCheck2 },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/guardado", label: "Guardado", icon: PiggyBank },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart2 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

// Subconjunto usado na barra inferior do celular (espaço limitado) —
// referenciado por href, não por índice, pra nunca desalinhar se a lista acima mudar
function porHref(href: string): NavItem {
  return NAV_ITEMS.find((item) => item.href === href)!;
}

export const MOBILE_NAV_ITEMS: NavItem[] = [
  porHref("/dashboard"),
  porHref("/contas-do-mes"),
  porHref("/entradas"),
  porHref("/saidas"),
];
