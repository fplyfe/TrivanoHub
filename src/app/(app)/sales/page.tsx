import { db, n, plain } from "@/lib/db";
import { channelRates, taxRateFor } from "@/lib/biz";
import { currentMonth, monthLabel, monthRange } from "@/lib/dates";
import { PageHeader } from "@/components/ui/misc";
import { MonthNav } from "@/components/app/month-nav";
import { SalesView } from "./sales-view";

export const metadata = { title: "Vendas" };

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ month?: string; channel?: string }> }) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth();
  const { start, end } = monthRange(month);
  const [sales, products, channels, tax] = await Promise.all([
    db.sale.findMany({
      where: { date: { gte: start, lt: end }, ...(sp.channel ? { channelId: sp.channel } : {}) },
      include: { product: { select: { name: true, sku: true } }, channel: { select: { name: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    db.product.findMany({
      where: { active: true },
      select: { id: true, name: true, sku: true, cost: true, packaging: true, shipping: true, price: true, stock: true },
      orderBy: { name: "asc" },
    }),
    db.channel.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    taxRateFor(currentMonth()),
  ]);
  return (
    <>
      <PageHeader title="Vendas" description={`${monthLabel(month, true)} · lucro calculado em cada venda`}>
        <MonthNav month={month} />
      </PageHeader>
      <SalesView
        sales={plain(sales)}
        products={plain(products)}
        channels={channels.map((c) => ({ id: c.id, name: c.name, ...channelRates(c) }))}
        taxRate={tax.rate}
        channelFilter={sp.channel ?? ""}
        // usado só para exibir
        totalStockless={products.filter((p) => n(p.cost) === 0).length}
      />
    </>
  );
}
