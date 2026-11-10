import { db } from "@/lib/db";
import { adsDashboard, resolvePeriod, SOURCE_LABEL, type Source } from "@/lib/marketing";
import { getMeta, maybeAutoSyncMeta } from "@/lib/meta";
import { MarketingView } from "./marketing-view";

export const metadata = { title: "Dashboard de Ads" };

type SP = { period?: string; from?: string; to?: string; channel?: string; source?: string; product?: string };

export default async function MarketingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  await maybeAutoSyncMeta();
  const period = resolvePeriod(sp.period, sp.from, sp.to);
  const source = sp.source && sp.source in SOURCE_LABEL ? (sp.source as Source) : undefined;
  const [data, channels, products, meta] = await Promise.all([
    adsDashboard({ from: period.from, to: period.to, channelId: sp.channel || undefined, source, productId: sp.product || undefined }),
    db.channel.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { active: true }, select: { id: true, name: true, sku: true }, orderBy: { name: "asc" } }),
    getMeta(),
  ]);
  return (
    <MarketingView
      data={data}
      filters={{ period: period.key, from: period.from, to: period.to, channel: sp.channel ?? "", source: source ?? "", product: sp.product ?? "" }}
      channels={channels}
      products={products}
      meta={{ configured: meta.configured, lastSyncAt: meta.row?.lastSyncAt?.toISOString() ?? null, lastError: meta.row?.lastError ?? null }}
    />
  );
}
