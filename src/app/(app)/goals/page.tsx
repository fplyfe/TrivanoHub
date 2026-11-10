import { db, n, plain } from "@/lib/db";
import { monthSummary } from "@/lib/biz";
import { currentMonth, shiftMonth, today } from "@/lib/dates";
import { PageHeader } from "@/components/ui/misc";
import { GoalsView } from "./goals-view";

export const metadata = { title: "Metas e escala" };

export default async function GoalsPage() {
  const month = currentMonth();
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(month, -i));
  const [goals, summaries, steps] = await Promise.all([
    db.monthlyGoal.findMany({ orderBy: { month: "desc" } }),
    Promise.all(months.map((m) => monthSummary(m))),
    db.growthStep.findMany({ where: { phaseId: null }, orderBy: [{ channel: "asc" }, { position: "asc" }] }),
  ]);
  const [y, m] = month.split("-").map(Number);
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Number(today().slice(8, 10));
  const history = months.map((mm, i) => {
    const g = goals.find((x) => x.month === mm);
    const s = summaries[i];
    return {
      month: mm,
      goalId: g?.id ?? null,
      goalProfit: g ? n(g.profit) : null,
      goalRevenue: g ? n(g.revenue) : null,
      goalOrders: g?.orders ?? null,
      profit: s.result,
      revenue: s.gross,
      orders: s.orders,
      margin: s.contributionMargin,
      ticket: s.ticket,
    };
  });
  // Metas futuras (já cadastradas)
  const future = goals.filter((g) => g.month > month).map((g) => ({ month: g.month, id: g.id, profit: n(g.profit), revenue: n(g.revenue), orders: g.orders }));
  return (
    <>
      <PageHeader title="Metas e escala" description="Meta de lucro mensal e o plano para crescer no Mercado Livre e na Amazon" />
      <GoalsView history={history} future={future} steps={plain(steps)} day={day} daysInMonth={dim} />
    </>
  );
}
