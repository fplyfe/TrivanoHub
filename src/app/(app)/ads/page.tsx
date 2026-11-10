import { db, n } from "@/lib/db";
import { mainChannel, marginBeforeAds, monthSummary, taxRateFor } from "@/lib/biz";
import { addDays, currentMonth, monthRange, toDate, toStr, today } from "@/lib/dates";
import { adsAdvice, mondayOf } from "@/lib/growth";
import { PageHeader } from "@/components/ui/misc";
import { AdsView, type AdsRow } from "./ads-view";

export const metadata = { title: "Ads" };

export default async function AdsPage() {
  const month = currentMonth();
  const { start, end } = monthRange(month);
  const since = toDate(addDays(mondayOf(today()), -7 * 7)); // últimas 8 semanas
  const [products, spends, ch, tax, summary, accounts, monthAds] = await Promise.all([
    db.product.findMany({
      where: { OR: [{ stage: { in: ["TESTING", "APPROVED", "CHAMPION"] }, active: true }, { adSpends: { some: {} } }] },
      orderBy: { name: "asc" },
    }),
    db.adSpend.findMany({ where: { weekStart: { gte: since } }, orderBy: { weekStart: "asc" } }),
    mainChannel(),
    taxRateFor(month),
    monthSummary(month),
    db.account.findMany({ where: { active: true }, select: { id: true, name: true, type: true }, orderBy: { name: "asc" } }),
    db.adSpend.aggregate({ where: { weekStart: { gte: start, lt: end } }, _sum: { spend: true, adSales: true, adOrders: true } }),
  ]);

  const rows: AdsRow[] = products.map((p) => {
    const weeks = spends
      .filter((s) => s.productId === p.id)
      .map((s) => ({
        id: s.id,
        weekStart: toStr(s.weekStart),
        spend: n(s.spend),
        adSales: n(s.adSales),
        adOrders: s.adOrders,
        impressions: s.impressions,
        clicks: s.clicks,
      }));
    const breakEven = marginBeforeAds(p, ch, tax.rate);
    return { id: p.id, name: p.name, sku: p.sku, stage: p.stage, price: n(p.price), breakEven, weeks, advice: adsAdvice(weeks, breakEven) };
  });

  const spend = n(monthAds._sum.spend);
  const adSales = n(monthAds._sum.adSales);
  return (
    <>
      <PageHeader title="Ads" description="Gasto semanal por produto, ACOS e o que fazer, pelas regras do plano" />
      <AdsView
        rows={rows}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, marketplace: a.type === "MARKETPLACE" }))}
        month={{ spend, adSales, adOrders: monthAds._sum.adOrders ?? 0, revenue: summary.gross }}
        channelAdsRate={ch?.adsRate ?? 0}
        thisWeek={mondayOf(today())}
      />
    </>
  );
}
