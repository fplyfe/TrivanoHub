import { db, n, plain } from "@/lib/db";
import { monthSummary } from "@/lib/biz";
import { currentMonth, shiftMonth } from "@/lib/dates";
import { PageHeader } from "@/components/ui/misc";
import { InvestmentsView } from "./investments-view";

export const metadata = { title: "Investimentos" };

export default async function InvestmentsPage() {
  const months = Array.from({ length: 3 }, (_, i) => shiftMonth(currentMonth(), -1 - i));
  const [investments, accounts, last3, fixed] = await Promise.all([
    db.investment.findMany({ include: { moves: { orderBy: { date: "desc" } } }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.account.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    Promise.all(months.map((m) => monthSummary(m))),
    db.entry.aggregate({
      where: { type: "EXPENSE", category: { group: "FIXED" }, date: { gte: new Date(months[2] + "-01T00:00:00Z"), lt: new Date(currentMonth() + "-01T00:00:00Z") } },
      _sum: { amount: true },
    }),
  ]);
  const avgProfit = last3.reduce((a, s) => a + s.result, 0) / 3;
  const avgFixed = n(fixed._sum.amount) / 3;
  return (
    <>
      <PageHeader title="Investimentos" description="Aplicações da empresa e investimentos no negócio (com payback)" />
      <InvestmentsView investments={plain(investments)} accounts={accounts} avgProfit={avgProfit} avgFixed={avgFixed} />
    </>
  );
}
