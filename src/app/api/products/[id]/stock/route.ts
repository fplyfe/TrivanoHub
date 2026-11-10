import { db } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/api";
import { stockIn } from "@/lib/biz";
import { toDate } from "@/lib/dates";
import { stockMoveSchema } from "@/lib/validators";

/** Entrada de mercadoria (atualiza custo médio) ou ajuste de inventário. */
export const POST = route(async (req, { params }) => {
  const v = stockMoveSchema.parse(await readJson(req));
  return db.$transaction(async (tx) => {
    const p = await tx.product.findUniqueOrThrow({ where: { id: params.id } });
    if (v.type === "IN") {
      if (v.qty <= 0) throw new HttpError(400, "Quantidade deve ser maior que zero");
      if (v.unitCost == null) throw new HttpError(400, "Informe o custo unitário");
      await stockIn(tx, p.id, v.qty, v.unitCost, v.date, v.note ?? "Entrada de mercadoria");
      if (v.createExpense) {
        const cat = await tx.category.findFirst({ where: { group: "PURCHASE" } });
        await tx.entry.create({
          data: {
            type: "EXPENSE",
            description: `Compra ${p.name} (${v.qty}x)`,
            amount: Math.round(v.qty * v.unitCost * 100) / 100,
            date: toDate(v.date),
            paid: false,
            accountId: v.accountId,
            categoryId: cat?.id ?? null,
            supplierId: p.supplierId,
          },
        });
      }
    } else {
      // ajuste: qty = novo saldo contado
      const diff = v.qty - p.stock;
      if (diff === 0) return { ok: true };
      await tx.product.update({ where: { id: p.id }, data: { stock: v.qty } });
      await tx.stockMove.create({ data: { productId: p.id, type: "ADJUST", qty: diff, unitCost: p.cost, note: v.note ?? "Ajuste de inventário", date: toDate(v.date) } });
    }
    return { ok: true };
  });
});
