import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { linkCampaignSchema } from "@/lib/validators";

/** Liga (ou desliga) uma campanha a um produto, em todos os dias dela. */
export const PATCH = route(async (req) => {
  const v = linkCampaignSchema.parse(await readJson(req));
  const r = await db.adDaily.updateMany({ where: { source: v.source, campaignId: v.campaignId }, data: { productId: v.productId } });
  return { updated: r.count };
});
