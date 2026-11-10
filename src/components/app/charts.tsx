"use client";

import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { brl } from "@/lib/utils";

const tip = {
  contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 },
  formatter: (v: number) => brl(v),
};
const k = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: Math.abs(v) >= 10000 ? 0 : 1 })}k` : String(v));

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

const BRAND = ["#1E4D44", "#F2B23E", "#2F7A6B", "#9DB5AE", "#C98A12", "#6B8F86", "#E8774A", "#3D4F4B"];

/** Rosca com total no centro (ex.: vendas por canal). */
export function DonutChart({ data, total, totalLabel }: { data: { name: string; value: number }[]; total: string; totalLabel: string }) {
  return (
    <div className="relative h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={data.length > 1 ? 2 : 0} stroke="none">
            {data.map((_, i) => (
              <Cell key={i} fill={BRAND[i % BRAND.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tip.contentStyle} formatter={(v: number) => String(v)} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[11px] text-muted-foreground">{totalLabel}</p>
          <p className="text-xl font-bold">{total}</p>
        </div>
      </div>
    </div>
  );
}

export const brandColor = (i: number) => BRAND[i % BRAND.length];

/** Faturamento e gasto em barras, lucro em linha, por dia. */
export function DailyAdsChart({ data }: { data: { label: string; gross: number; ads: number; profit: number }[] }) {
  return (
    <div className="h-64 w-full sm:h-72 2xl:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: -10, right: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} minTickGap={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={k} />
          <Tooltip {...tip} cursor={{ fill: "hsl(var(--muted))" }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="gross" name="Faturamento" fill="#2F7A6B" radius={[4, 4, 0, 0]} />
          <Bar dataKey="ads" name="Gastos com Ads" fill="#9DB5AE" radius={[4, 4, 0, 0]} />
          <Line dataKey="profit" name="Lucro" stroke="#F2B23E" strokeWidth={2.5} dot={false} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
