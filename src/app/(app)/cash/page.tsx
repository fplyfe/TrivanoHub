import { db, plain } from "@/lib/db";
import { accountBalances } from "@/lib/biz";
import { currentMonth, monthLabel, monthRange } from "@/lib/dates";
import { PageHeader } from "@/components/ui/misc";
import { MonthNav } from "@/components/app/month-nav";
import { CashView } from "./cash-view";

export const metadata = { title: "Caixa" };

export default async function CashPage({ searchParams }: { searchParams: Promise<{ month?: string; type?: string; status?: string }> }) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth();
  const { start, end } = monthRange(month);
  const type = sp.type === "INCOME" || sp.type === "EXPENSE" ? sp.type : undefined;
  const paid = sp.status === "paid" ? true : sp.status === "open" ? false : undefined;
  const [entries, balances, categories, suppliers, overdue] = await Promise.all([
    db.entry.findMany({
      where: { date: { gte: start, lt: end }, ...(type ? { type } : {}), ...(paid !== undefined ? { paid } : {}) },
      include: { account: { select: { name: true } }, category: { select: { name: true } }, supplier: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    accountBalances(),
    db.category.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
    db.supplier.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.entry.aggregate({ where: { paid: false, type: "EXPENSE", date: { lt: start } }, _sum: { amount: true }, _count: true }),
  ]);
  return (
    <>
      <PageHeader title="Caixa" description={`Entradas e saídas de ${monthLabel(month, true)}`}>
        <MonthNav month={month} />
      </PageHeader>
      <CashView
        entries={plain(entries)}
        balances={balances.filter((b) => b.active)}
        categories={categories}
        suppliers={suppliers}
        filters={{ type: sp.type ?? "", status: sp.status ?? "" }}
        overduePrev={{ count: overdue._count, amount: Number(overdue._sum.amount ?? 0) }}
      />
    </>
  );
}
