"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { formatarData, hojeISO } from "@/lib/finance/dates";
import type { AgendaCompromisso } from "@/types/database";

export function ProximosCompromissosCard() {
  const [itens, setItens] = useState<AgendaCompromisso[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("agenda_compromissos")
      .select("*")
      .eq("concluido", false)
      .gte("data", hojeISO())
      .order("data", { ascending: true })
      .order("horario", { ascending: true })
      .limit(4)
      .then(({ data }) => {
        setItens((data as AgendaCompromisso[]) ?? []);
        setCarregando(false);
      });
  }, []);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-brand-pink" />
          <h3 className="font-display text-base font-semibold">Próximos compromissos</h3>
        </div>
        <Link href="/agenda" className="text-xs text-ink-muted hover:text-brand-pink">
          Ver agenda
        </Link>
      </div>

      {carregando ? (
        <p className="text-sm text-ink-muted">Carregando...</p>
      ) : itens.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum compromisso agendado.</p>
      ) : (
        <ul className="space-y-2.5">
          {itens.map((item) => (
            <li key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-ink-primary">{item.titulo}</span>
              <span className="text-ink-muted">
                {item.data === hojeISO() ? "Hoje" : formatarData(item.data)}
                {item.horario ? ` · ${item.horario.slice(0, 5)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
