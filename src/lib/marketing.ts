// Números do Dashboard de Ads: vendas, gastos com anúncios e lucro no período, com filtros.
import { Prisma } from "@prisma/client";
import { db, n } from "./db";
import { addDays, toDate, toStr, today } from "./dates";
import { round2 } from "./pricing";

import { PERIODS, SOURCE_LABEL, type PeriodKey, type Source } from "./marketing-shared";
export { PERIODS, SOURCE_LABEL, type PeriodKey, type Source };

/** Converte o filtro de período em datas (inclusive), no fuso da loja. */
export function resolvePeriod(key: string | undefined, from?: string, to?: string) {
  const t = today();
  const k = (PERIODS.some((p) => p.key === key) ? key : "today") as PeriodKey;
  const monthStart = t.slice(0, 8) + "01";
  switch (k) {
    case "yesterday":
      return { key: k, from: addDays(t, -1), to: addDays(t, -1) };
    case "7d":
      return { key: k, from: addDays(t, -6), to: t };
    case "30d":
      return { key: k, from: addDays(t, -29), to: t };
    case "month":
      return { key: k, from: monthStart, to: t };
    case "lastmonth": {
      const end = addDays(monthStart, -1);
      return { key: k, from: end.slice(0, 8) + "01", to: end };
    }
    case "custom": {
      const ok = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
      const f = ok(from) ? from! : t;
      const e = ok(to) ? to! : t;
      return f <= e ? { key: k, from: f, to: e } : { key: k, from: e, to: f };
    }
    default:
      return { key: k, from: t, to: t };
  }
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;

export type DashFilters = { from: string; to: string; channelId?: string; source?: Source; productId?: string };

export async function adsDashboard(f: DashFilters) {
  const start = toDate(f.from);
  const endExcl = toDate(addDays(f.to, 1));
  const saleWhere: Prisma.SaleWhereInput = {
    date: { gte: start, lt: endExcl },
    ...(f.channelId ? { channelId: f.channelId } : {}),
    ...(f.productId ? { productId: f.productId } : {}),
  };
  const adWhere: Prisma.AdDailyWhereInput = {
    date: { gte: start, lt: endExcl },
    ...(f.source ? { source: f.source } : {}),
    ...(f.productId ? { productId: f.productId } : {}),
  };
  // Gasto semanal por produto (tela "Ads por produto") entra como Mercado Ads, rateado por dia
  const includeWeekly = !f.source || f.source === "MERCADO_ADS";

  const [okSales, canceled, adRows, weekly, expenses, channels] = await Promise.all([
    db.sale.findMany({
      where: { ...saleWhere, status: "OK" },
      select: {
        date: true,
        qty: true,
        gross: true,
        commission: true,
        fixedFee: true,
        shipping: true,
        ads: true,
        tax: true,
        cost: true,
        packaging: true,
        profit: true,
        channelId: true,
        productId: true,
        product: { select: { name: true } },
      },
    }),
    db.sale.aggregate({ where: { ...saleWhere, status: "CANCELED" }, _sum: { gross: true }, _count: true }),
    db.adDaily.findMany({ where: adWhere, include: { product: { select: { name: true } } } }),
    includeWeekly
      ? db.adSpend.findMany({
          where: { weekStart: { gte: toDate(addDays(f.from, -6)), lt: endExcl }, ...(f.productId ? { productId: f.productId } : {}) },
          include: { product: { select: { name: true } } },
        })
      : Promise.resolve([]),
    // Despesas fixas/variáveis do período (sem as saídas geradas pelo Ads por produto). Só sem filtro de canal/produto.
    !f.channelId && !f.productId
      ? db.entry.aggregate({
          where: {
            type: "EXPENSE",
            date: { gte: start, lt: endExcl },
            adSpend: null,
            OR: [{ categoryId: null }, { category: { group: { in: ["FIXED", "VARIABLE"] } } }],
          },
          _sum: { amount: true },
        })
      : Promise.resolve(null),
    db.channel.findMany({ select: { id: true, name: true } }),
  ]);

  // Série diária
  const days = Math.min(daysBetween(f.from, f.to), 400);
  const series = new Map<string, { date: string; gross: number; ads: number; profit: number; orders: number }>();
  for (let i = 0; i < days; i++) {
    const d = addDays(f.from, i);
    series.set(d, { date: d, gross: 0, ads: 0, profit: 0, orders: 0 });
  }

  // Vendas
  let gross = 0, fees = 0, shipping = 0, tax = 0, cogs = 0, profitSales = 0, estAds = 0, units = 0;
  const byChannel = new Map<string, { name: string; orders: number; gross: number }>();
  const byProduct = new Map<string, { name: string; orders: number; units: number; gross: number; profit: number }>();
  for (const s of okSales) {
    const g = n(s.gross);
    gross += g;
    fees += n(s.commission) + n(s.fixedFee);
    shipping += n(s.shipping);
    tax += n(s.tax);
    cogs += n(s.cost) + n(s.packaging);
    profitSales += n(s.profit);
    estAds += n(s.ads);
    units += s.qty;
    const day = series.get(toStr(s.date));
    if (day) {
      day.gross += g;
      day.profit += n(s.profit);
      day.orders += 1;
    }
    const ch = byChannel.get(s.channelId) ?? { name: channels.find((c) => c.id === s.channelId)?.name ?? "Canal", orders: 0, gross: 0 };
    ch.orders += 1;
    ch.gross += g;
    byChannel.set(s.channelId, ch);
    const pr = byProduct.get(s.productId) ?? { name: s.product.name, orders: 0, units: 0, gross: 0, profit: 0 };
    pr.orders += 1;
    pr.units += s.qty;
    pr.gross += g;
    pr.profit += n(s.profit);
    byProduct.set(s.productId, pr);
  }

  // Anúncios (integrações + lançamentos diários)
  let adSpend = 0, impressions = 0, clicks = 0, platformPurchases = 0, platformValue = 0;
  const bySource = new Map<Source, number>();
  const campaigns = new Map<
    string,
    { key: string; source: Source; campaignId: string; name: string; status: string | null; productId: string | null; productName: string | null; spend: number; impressions: number; clicks: number; purchases: number; value: number; manual: boolean }
  >();
  for (const r of adRows) {
    const sp = n(r.spend);
    adSpend += sp;
    impressions += r.impressions;
    clicks += r.clicks;
    platformPurchases += r.purchases;
    platformValue += n(r.purchaseValue);
    bySource.set(r.source, (bySource.get(r.source) ?? 0) + sp);
    const day = series.get(toStr(r.date));
    if (day) day.ads += sp;
    const key = `${r.source}:${r.campaignId}`;
    const c = campaigns.get(key) ?? {
      key,
      source: r.source,
      campaignId: r.campaignId,
      name: r.campaignName,
      status: r.status,
      productId: r.productId,
      productName: r.product?.name ?? null,
      spend: 0,
      impressions: 0,
      clicks: 0,
      purchases: 0,
      value: 0,
      manual: r.accountId === "manual",
    };
    c.spend += sp;
    c.impressions += r.impressions;
    c.clicks += r.clicks;
    c.purchases += r.purchases;
    c.value += n(r.purchaseValue);
    if (r.status) c.status = r.status;
    campaigns.set(key, c);
  }

  // Ads por produto (semanal): rateia 1/7 por dia que cai no período
  for (const w of weekly) {
    const perDay = n(w.spend) / 7;
    let inRange = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(toStr(w.weekStart), i);
      if (d < f.from || d > f.to) continue;
      inRange++;
      const day = series.get(d);
      if (day) day.ads += perDay;
    }
    if (!inRange) continue;
    const part = perDay * inRange;
    adSpend += part;
    bySource.set("MERCADO_ADS", (bySource.get("MERCADO_ADS") ?? 0) + part);
    const key = `WEEKLY:${w.productId}`;
    const c = campaigns.get(key) ?? {
      key,
      source: "MERCADO_ADS" as Source,
      campaignId: key,
      name: `Ads por produto · ${w.product.name}`,
      status: null,
      productId: w.productId,
      productName: w.product.name,
      spend: 0,
      impressions: 0,
      clicks: 0,
      purchases: 0,
      value: 0,
      manual: true,
    };
    c.spend += part;
    c.purchases += Math.round((w.adOrders * inRange) / 7);
    c.value += (n(w.adSales) * inRange) / 7;
    c.impressions += Math.round(((w.impressions ?? 0) * inRange) / 7);
    c.clicks += Math.round(((w.clicks ?? 0) * inRange) / 7);
    campaigns.set(key, c);
  }

  const extra = expenses ? n(expenses._sum.amount) : 0;
  const orders = okSales.length;
  // O lucro das vendas já desconta o Ads estimado pelo % do canal; troca pelo gasto real
  const profit = profitSales + estAds - adSpend - extra;
  const netRevenue = gross - fees - shipping;

  const dailyMap = Array.from(series.values()).map((d) => ({ ...d, gross: round2(d.gross), ads: round2(d.ads), profit: round2(d.profit - d.ads) }));

  return {
    period: { from: f.from, to: f.to, days },
    gross: round2(gross),
    netRevenue: round2(netRevenue),
    adSpend: round2(adSpend),
    profit: round2(profit),
    roas: adSpend > 0 ? round2(gross / adSpend) : null,
    roi: adSpend > 0 ? round2(profit / adSpend) : null,
    margin: gross > 0 ? round2((profit / gross) * 100) : null,
    orders,
    units,
    ticket: orders ? round2(gross / orders) : 0,
    cpa: orders && adSpend ? round2(adSpend / orders) : null,
    fees: round2(fees),
    shipping: round2(shipping),
    tax: round2(tax),
    cogs: round2(cogs),
    extraExpenses: round2(extra),
    extraExpensesApplies: !!expenses,
    canceled: { count: canceled._count, gross: round2(n(canceled._sum.gross)) },
    impressions,
    clicks,
    ctr: impressions ? round2((clicks / impressions) * 100) : null,
    cpc: clicks ? round2(adSpend / clicks) : null,
    platformPurchases,
    platformValue: round2(platformValue),
    byChannel: Array.from(byChannel.values()).sort((a, b) => b.gross - a.gross).map((c) => ({ ...c, gross: round2(c.gross) })),
    byProduct: Array.from(byProduct.entries())
      .map(([id, p]) => ({ id, ...p, gross: round2(p.gross), profit: round2(p.profit) }))
      .sort((a, b) => b.gross - a.gross)
      .slice(0, 8),
    bySource: Array.from(bySource.entries()).map(([source, spend]) => ({ source, label: SOURCE_LABEL[source], spend: round2(spend) })).sort((a, b) => b.spend - a.spend),
    campaigns: Array.from(campaigns.values())
      .map((c) => ({
        ...c,
        spend: round2(c.spend),
        value: round2(c.value),
        ctr: c.impressions ? round2((c.clicks / c.impressions) * 100) : null,
        cpc: c.clicks ? round2(c.spend / c.clicks) : null,
        roas: c.spend ? round2(c.value / c.spend) : null,
        cpa: c.purchases ? round2(c.spend / c.purchases) : null,
      }))
      .sort((a, b) => b.spend - a.spend),
    daily: dailyMap,
  };
}

export type AdsDashboard = Awaited<ReturnType<typeof adsDashboard>>;
