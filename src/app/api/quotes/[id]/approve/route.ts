import { db } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/api";
import { stockIn } from "@/lib/biz";
import { addDays, toDate } from "@/lib/dates";
import { n } from "@/lib/db";
import { approveQuoteSchema } from "@/lib/validators";

/** Aprova a proposta escolhida: dá entrada no estoque pelo custo final e lança a conta a pagar. */
export const POST = route(async (req, { params }) => {
  const v = approveQuoteSchema.parse(await readJson(req));
  return db.$transaction(async (tx) => {
    const q = await tx.quote.findUniqueOrThrow({ where: { id: params.id }, include: { product: true } });
    if (q.status !== "OPEN") throw new HttpError(400, "Cotação já encerrada");
    const o = await tx.quoteOffer.findUniqueOrThrow({ where: { id: v.offerId }, include: { supplier: true } });
    if (o.quoteId !== q.id) throw new HttpError(400, "Proposta não pertence a esta cotação");
    const total = Math.round((n(o.unitPrice) * q.qty + n(o.freight)) * 100) / 100;
    const unitFinal = Math.round((total / q.qty) * 100) / 100;
    await tx.quoteOffer.update({ where: { id: o.id }, data: { chosen: true } });
    await tx.quote.update({ where: { id: q.id }, data: { status: "APPROVED" } });
    await tx.product.update({ where: { id: q.productId }, data: { supplierId: o.supplierId } });
    const arrival = addDays(v.date, o.leadDays ?? 0);
    await stockIn(tx, q.productId, q.qty, unitFinal, arrival, `Compra de ${o.supplier.name} (cotação)`);
    if (v.createExpense) {
      const cat = await tx.category.findFirst({ where: { group: "PURCHASE" } });
      await tx.entry.create({
        data: {
          type: "EXPENSE",
          description: `Compra ${q.product.name} (${q.qty}x) — ${o.supplier.name}`,
          amount: total,
          date: toDate(v.date),
          accountId: v.accountId,
          categoryId: cat?.id ?? null,
          supplierId: o.supplierId,
        },
      });
    }
    return { ok: true, unitFinal };
  });
});
