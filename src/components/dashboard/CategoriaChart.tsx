"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { Card } from "@/components/ui/Card";
import { formatarMoeda } from "@/lib/finance/money";

interface Props {
  dados: { categoria: string; cor: string; total: number }[];
}

export function CategoriaChart({ dados }: Props) {
  if (dados.length === 0) return null;

  const paraReais = dados.slice(0, 6).map((d) => ({ ...d, totalReais: d.total / 100 }));

  return (
    <Card>
      <h3 className="mb-4 font-display text-base font-semibold">Despesas por categoria</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={paraReais} layout="vertical" margin={{ left: 10, right: 20 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="categoria"
              width={110}
              stroke="#9A9AA5"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#1C1C22",
                border: "1px solid #2A2A32",
                borderRadius: 12,
                fontSize: 13,
              }}
              formatter={(value: number) => formatarMoeda(Math.round(value * 100))}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
            />
            <Bar dataKey="totalReais" radius={[0, 8, 8, 0]} barSize={16}>
              {paraReais.map((d, idx) => (
                <Cell key={idx} fill={d.cor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
