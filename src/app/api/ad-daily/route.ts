import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { toDate } from "@/lib/dates";
import { manualAdSchema } from "@/lib/validators";

/** Lançamento manual de gasto diário (ex.: Mercado Ads, Google, influenciador). */
export const POST = route(async (req) => {
  const v = manualAdSchema.parse(await readJson(req));
  // Mesma campanha (fonte + nome) usa o mesmo id, para somar no dashboard e permitir corrigir o dia
  const existing = await db.adDaily.findFirst({ where: { source: v.source, campaignName: v.campaignName, accountId: "manual" }, select: { campaignId: true } });
  const campaignId = existing?.campaignId ?? `manual-${randomUUID().slice(0, 8)}`;
  return db.adDaily.upsert({
    where: { source_campaignId_date: { source: v.source, campaignId, date: toDate(v.date) } },
    update: { spend: v.spend, purchases: v.purchases, purchaseValue: v.purchaseValue, productId: v.productId },
    create: {
      source: v.source,
      campaignId,
      campaignName: v.campaignName,
      accountId: "manual",
      date: toDate(v.date),
      spend: v.spend,
      purchases: v.purchases,
      purchaseValue: v.purchaseValue,
      productId: v.productId,
    },
  });
});
