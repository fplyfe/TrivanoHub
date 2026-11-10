import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { toDate } from "@/lib/dates";
import { mondayOf } from "@/lib/growth";
import { adSpendSchema } from "@/lib/validators";

/** Lança (ou atualiza) o gasto de Ads de um produto na semana. */
export const POST = route(async (req) => {
  const { createEntry, accountId, ...v } = adSpendSchema.parse(await readJson(req));
  const weekStart = mondayOf(v.weekStart);
  return db.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({ where: { id: v.productId } });
    const existing = await tx.adSpend.findUnique({ where: { productId_weekStart: { productId: v.productId, weekStart: toDate(weekStart) } } });
    let entryId = existing?.entryId ?? null;
    if (createEntry && v.spend > 0) {
      const cat = await tx.category.findFirst({ where: { group: "VARIABLE", name: { contains: "Ads" } } });
      const data = {
        type: "EXPENSE" as const,
        description: `Ads ${product.name} — semana de ${weekStart.split("-").reverse().join("/")}`,
        amount: v.spend,
        date: toDate(weekStart),
        paid: true,
        paidAt: toDate(weekStart),
        accountId,
        categoryId: cat?.id ?? null,
      };
      entryId = entryId ? (await tx.entry.update({ where: { id: entryId }, data })).id : (await tx.entry.create({ data })).id;
    } else if (entryId) {
      await tx.entry.delete({ where: { id: entryId } });
      entryId = null;
    }
    const data = { ...v, weekStart: toDate(weekStart), entryId };
    return existing ? tx.adSpend.update({ where: { id: existing.id }, data }) : tx.adSpend.create({ data });
  });
});
