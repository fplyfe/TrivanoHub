import { db, n } from "@/lib/db";
import { mainChannel, marginBeforeAds, taxRateFor } from "@/lib/biz";
import { addDays, currentMonth, toDate, toStr, today } from "@/lib/dates";
import { computeProfit, fixedFeeFor } from "@/lib/pricing";
import { idealProductChecks, testAdvice } from "@/lib/growth";
import { PageHeader } from "@/components/ui/misc";
import { FunnelView, type FunnelCard } from "./funnel-view";

export const metadata = { title: "Funil de produtos" };

export default async function FunnelPage() {
  const since30 = toDate(addDays(today(), -30));
  const [products, ch, tax, sales30, adTotals, firstIns] = await Promise.all([
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    mainChannel(),
    taxRateFor(currentMonth()),
    db.sale.groupBy({ by: ["productId"], where: { status: "OK", date: { gte: since30 } }, _count: true, _sum: { qty: true } }),
    db.adSpend.groupBy({ by: ["productId"], _sum: { spend: true, adOrders: true } }),
    db.stockMove.findMany({ where: { type: "IN" }, orderBy: { date: "asc" }, distinct: ["productId"], select: { productId: true, qty: true } }),
  ]);
  const taxRate = tax.rate;

  const cards: FunnelCard[] = [];
  for (const p of products) {
    const price = n(p.price);
    const est =
      ch && price > 0
        ? computeProfit({
            price,
            qty: 1,
            cost: n(p.cost),
            packaging: n(p.packaging),
            shipping: n(p.shipping),
            commissionRate: ch.commissionClassic,
            fixedFee: fixedFeeFor(ch, price),
            adsRate: ch.adsRate,
            taxRate,
          }).margin
        : null;
    const s30 = sales30.find((x) => x.productId === p.id);
    const ads = adTotals.find((x) => x.productId === p.id);
    const card: FunnelCard = {
      id: p.id,
      sku: p.sku,
      name: p.name,
      stage: p.stage,
      price,
      cost: n(p.cost),
      packaging: n(p.packaging),
      shipping: n(p.shipping),
      weightG: p.weightG,
      needsCert: p.needsCert,
      researchNotes: p.researchNotes,
      stock: p.stock,
      minStock: p.minStock,
      supplierId: p.supplierId,
      margin: est,
      breakEven: marginBeforeAds(p, ch, taxRate),
      orders30: s30?._count ?? 0,
      units30: s30?._sum.qty ?? 0,
      checks: idealProductChecks({ price, cost: n(p.cost), weightG: p.weightG, needsCert: p.needsCert, margin: est }),
      advice: null,
      restock: null,
      testStartedAt: p.testStartedAt ? toStr(p.testStartedAt) : null,
    };

    if (p.stage === "TESTING") {
      const start = p.testStartedAt ? toStr(p.testStartedAt) : toStr(p.createdAt);
      const days = Math.max(0, Math.round((Date.parse(today()) - Date.parse(start)) / 864e5));
      const testSales = await db.sale.aggregate({
        where: { productId: p.id, status: "OK", date: { gte: toDate(start) } },
        _count: true,
        _sum: { gross: true, profit: true },
      });
      const gross = n(testSales._sum.gross);
      card.advice = testAdvice({
        days,
        orders30: s30?._count ?? 0,
        ordersTest: testSales._count,
        margin: gross > 0 ? (n(testSales._sum.profit) / gross) * 100 : null,
        adSpend: n(ads?._sum.spend),
        adOrders: ads?._sum.adOrders ?? 0,
      });
    }

    if (p.stage === "APPROVED" || p.stage === "CHAMPION") {
      const initial = firstIns.find((m) => m.productId === p.id)?.qty ?? 0;
      const perDay = (s30?._sum.qty ?? 0) / 30;
      const coverage = perDay > 0 ? Math.floor(Math.max(0, p.stock) / perDay) : null;
      // Repor para ~45 dias de venda, com piso de 2× o lote inicial (regra do plano)
      const target = Math.max(Math.ceil(perDay * 45), initial * 2);
      card.restock = { coverage, suggest: Math.max(0, target - Math.max(0, p.stock)), initial };
    }
    cards.push(card);
  }

  return (
    <>
      <PageHeader title="Funil de produtos" description="Do candidato ao campeão, com os critérios do plano: 1 venda/dia e margem de 15% ou mais" />
      <FunnelView cards={cards} channelName={ch?.name ?? null} />
    </>
  );
}
