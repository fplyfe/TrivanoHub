import Link from "next/link";
import { AlertTriangle, Landmark, Package, ShoppingCart, Target, TrendingUp } from "lucide-react";
import { db, n } from "@/lib/db";
import { accountBalances, getSettings, monthSummary, phasesStatus } from "@/lib/biz";
import { currentMonth, monthLabel, MONTHS, shiftMonth, today } from "@/lib/dates";
import { brl, fmtPct, pct } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Empty, PageHeader, Progress } from "@/components/ui/misc";
import { MonthNav } from "@/components/app/month-nav";
import { Row, Stat } from "@/components/app/stat";
import { RevenueProfitChart } from "@/components/app/charts";

export const metadata = { title: "Painel" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth();
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(month, i - 11));

  const [summaries, balances, goals, settings, products, openEntries, lowMargin, phases] = await Promise.all([
    Promise.all(months.map((m) => monthSummary(m))),
    accountBalances(),
    db.monthlyGoal.findMany({ where: { month: { in: months } } }),
    getSettings(),
    db.product.findMany({ where: { active: true }, select: { id: true, name: true, sku: true, stock: true, minStock: true, cost: true } }),
    db.entry.groupBy({ by: ["type"], where: { paid: false }, _sum: { amount: true } }),
    db.sale.groupBy({
      by: ["productId"],
      where: { status: "OK", date: { gte: new Date(month + "-01T00:00:00Z"), lt: new Date(shiftMonth(month, 1) + "-01T00:00:00Z") } },
      _sum: { gross: true, profit: true, qty: true },
    }),
    phasesStatus(),
  ]);
  const phase = phases.find((p) => p.state === "current");

  const s = summaries.at(-1)!;
  const prev = summaries.at(-2)!;
  const goal = goals.find((g) => g.month === month);
  const goalProfit = goal ? n(goal.profit) : 0;
  const cash = balances.filter((b) => b.active).reduce((a, b) => a + b.balance, 0);
  const toReceive = n(openEntries.find((e) => e.type === "INCOME")?._sum.amount);
  const toPay = n(openEntries.find((e) => e.type === "EXPENSE")?._sum.amount);
  const stockValue = products.reduce((a, p) => a + Math.max(0, p.stock) * n(p.cost), 0);
  const lowStock = products.filter((p) => p.stock <= p.minStock).sort((a, b) => a.stock - b.stock);

  // Projeção do mês corrente pelo ritmo até hoje
  const isCurrent = month === currentMonth();
  const [y, m] = month.split("-").map(Number);
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = isCurrent ? Number(today().slice(8, 10)) : dim;
  const projection = isCurrent && day > 0 ? (s.result / day) * dim : s.result;

  const minMargin = n(settings.minMargin);
  const names = new Map(products.map((p) => [p.id, p.name]));
  const weak = lowMargin
    .map((r) => ({ id: r.productId, name: names.get(r.productId) ?? "Produto", gross: n(r._sum.gross), profit: n(r._sum.profit) }))
    .map((r) => ({ ...r, margin: r.gross > 0 ? (r.profit / r.gross) * 100 : 0 }))
    .filter((r) => r.margin < minMargin)
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 6);

  const per100 = (v: number) => (s.gross > 0 ? brl((v / s.gross) * 100) : brl(0));
  const delta = (cur: number, before: number) =>
    before !== 0 ? `${cur >= before ? "+" : ""}${fmtPct(((cur - before) / Math.abs(before)) * 100, 0)} vs. mês anterior` : "sem mês anterior";

  const series = summaries.map((x, i) => {
    const [, mm] = months[i].split("-").map(Number);
    const g = goals.find((gg) => gg.month === months[i]);
    return { label: MONTHS[mm - 1], gross: x.gross, result: x.result, goal: g ? n(g.profit) : 0 };
  });

  return (
    <>
      <PageHeader title="Painel" description={`Resultado de ${monthLabel(month, true)}`}>
        <MonthNav month={month} />
      </PageHeader>

      {phase && (
        <Link
          href="/plan"
          className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-primary/30 bg-accent/40 px-4 py-3 text-sm hover:bg-accent/60"
        >
          <span className="font-semibold">{phase.name}</span>
          <span className="text-muted-foreground">
            {phase.goalType === "TOTAL_ORDERS"
              ? `${phase.progress} de ${phase.goalValue} vendas para avançar`
              : phase.goalType === "MONTHLY_REVENUE"
                ? `Melhor mês ${brl(phase.progress)} de ${brl(phase.goalValue)} para avançar`
                : `Checklist: ${phase.steps.filter((s) => s.status === "DONE").length} de ${phase.steps.length}`}
          </span>
          {phase.goalType !== "NONE" && <Progress value={pct(phase.progress, phase.goalValue)} className="h-1.5 w-full sm:w-48" />}
          {phase.goalMet && <Badge tone="success">Meta batida: conclua a fase</Badge>}
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Faturamento" value={brl(s.gross)} hint={delta(s.gross, prev.gross)} icon={<ShoppingCart />} />
        <Stat
          label="Lucro líquido"
          value={brl(s.result)}
          tone={s.result >= 0 ? "good" : "bad"}
          hint={`Margem ${fmtPct(s.margin)} · ${delta(s.result, prev.result)}`}
          icon={<TrendingUp />}
        />
        <Stat label="Pedidos" value={String(s.orders)} hint={`Ticket médio ${brl(s.ticket)}`} icon={<Package />} />
        <Stat label="Saldo em caixa" value={brl(cash)} hint={`A receber ${brl(toReceive)} · a pagar ${brl(toPay)}`} icon={<Landmark />} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-4" /> Meta de lucro do mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {goal ? (
              <div className="grid gap-3">
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold">{fmtPct(pct(s.result, goalProfit), 0)}</span>
                  <span className="text-sm text-muted-foreground">
                    {brl(s.result)} de {brl(goalProfit)}
                  </span>
                </div>
                <Progress value={pct(s.result, goalProfit)} color={s.result >= goalProfit ? "hsl(var(--success))" : undefined} />
                {isCurrent && (
                  <p className="text-sm text-muted-foreground">
                    No ritmo atual o mês fecha em <b className="text-foreground">{brl(projection)}</b>.
                    {s.result < goalProfit && dim - day > 0 && (
                      <>
                        {" "}
                        Faltam <b className="text-foreground">{brl((goalProfit - s.result) / (dim - day))}</b> de lucro por dia.
                      </>
                    )}
                  </p>
                )}
              </div>
            ) : (
              <Empty>
                Nenhuma meta para este mês. <Link className="text-primary hover:underline" href="/goals">Definir meta</Link>
              </Empty>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Para onde vai cada R$ 100 vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {s.gross > 0 ? (
              <div>
                <Row label="Custo do produto e embalagem" value={per100(s.cogs)} />
                <Row label="Tarifas e anúncios" value={per100(s.fees)} />
                <Row label="Frete pago pela loja" value={per100(s.shipping)} />
                <Row label="Imposto" value={per100(s.tax)} />
                <Row label="Despesas fixas e variáveis" value={per100(s.expenses)} />
                <Row label="Sobra (lucro líquido)" value={per100(s.result)} strong tone={s.result >= 0 ? "good" : "bad"} />
              </div>
            ) : (
              <Empty>Sem vendas neste mês</Empty>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado do mês</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Faturamento" value={brl(s.gross)} />
            <Row label="(−) Tarifas, frete, imposto e custo" value={brl(s.gross - s.contribution)} />
            <Row label="= Margem de contribuição" value={`${brl(s.contribution)} (${fmtPct(s.contributionMargin)})`} />
            <Row label="(−) Despesas do mês" value={brl(s.expenses)} />
            {s.otherIncome > 0 && <Row label="(+) Outras receitas" value={brl(s.otherIncome)} />}
            <Row label="= Lucro líquido" value={brl(s.result)} strong tone={s.result >= 0 ? "good" : "bad"} />
            {s.ownerWithdrawals > 0 && <Row label="Retiradas dos sócios" value={brl(s.ownerWithdrawals)} />}
            {s.contributionMargin > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Ponto de equilíbrio: faturar {brl(s.expenses / (s.contributionMargin / 100))} para cobrir as despesas.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Últimos 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueProfitChart data={series} />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" /> Produtos com margem abaixo de {fmtPct(minMargin, 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weak.length ? (
              <div className="divide-y">
                {weak.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="truncate">{w.name}</span>
                    <Badge tone={w.margin < 0 ? "danger" : "warning"}>{fmtPct(w.margin)}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>Nenhum produto abaixo da margem mínima</Empty>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Estoque baixo</span>
              <span className="text-xs font-normal text-muted-foreground">Valor em estoque: {brl(stockValue)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length ? (
              <div className="divide-y">
                {lowStock.slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="truncate">
                      {p.name} <span className="text-xs text-muted-foreground">{p.sku}</span>
                    </span>
                    <Badge tone={p.stock <= 0 ? "danger" : "warning"}>
                      {p.stock} un. (mín. {p.minStock})
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>Nenhum produto abaixo do estoque mínimo</Empty>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
