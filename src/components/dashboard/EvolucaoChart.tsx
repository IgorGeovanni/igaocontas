"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { formatarMoeda } from "@/lib/finance/money";
import type { EvolucaoMes } from "@/lib/finance/dashboardData";

export function EvolucaoChart({ dados }: { dados: EvolucaoMes[] }) {
  const paraReais = dados.map((d) => ({
    ...d,
    entradasReais: d.entradas / 100,
    saidasReais: d.saidas / 100,
    saldoReais: d.saldo / 100,
  }));

  return (
    <Card>
      <h3 className="mb-4 font-display text-base font-semibold">Evolução (últimos 6 meses)</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={paraReais} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A32" vertical={false} />
            <XAxis dataKey="rotulo" stroke="#9A9AA5" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9A9AA5" fontSize={12} tickLine={false} axisLine={false} width={0} />
            <Tooltip
              contentStyle={{
                background: "#1C1C22",
                border: "1px solid #2A2A32",
                borderRadius: 12,
                fontSize: 13,
              }}
              formatter={(value: number) => formatarMoeda(Math.round(value * 100))}
            />
            <Line type="monotone" dataKey="entradasReais" name="Entradas" stroke="#22C55E" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="saidasReais" name="Saídas" stroke="#FF6B4A" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="saldoReais" name="Saldo" stroke="#E2185C" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
