"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { brl } from "@/lib/utils";

const tip = {
  contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 },
  formatter: (v: number) => brl(v),
};
const k = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

/** Faturamento × lucro líquido por mês. */
export function RevenueProfitChart({ data }: { data: { label: string; gross: number; result: number; goal: number }[] }) {
  return (
    <div className="h-64 w-full sm:h-72 2xl:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -10, right: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={k} />
          <Tooltip {...tip} cursor={{ fill: "hsl(var(--muted))" }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="gross" name="Faturamento" fill="#2F7A6B" radius={[4, 4, 0, 0]} />
          <Bar dataKey="result" name="Lucro líquido" fill="#F2B23E" radius={[4, 4, 0, 0]} />
          <Bar dataKey="goal" name="Meta de lucro" fill="#9DB5AE" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Meta × realizado de faturamento por mês do plano. */
export function PlanChart({ data }: { data: { label: string; goal: number; actual: number | null }[] }) {
  return (
    <div className="h-64 w-full sm:h-72 2xl:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -10, right: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={k} />
          <Tooltip {...tip} cursor={{ fill: "hsl(var(--muted))" }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="goal" name="Meta de faturamento" fill="hsl(var(--muted-foreground) / 0.35)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="actual" name="Realizado" fill="#2F7A6B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
