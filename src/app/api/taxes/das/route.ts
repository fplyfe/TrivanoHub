import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/api";
import { monthSummary } from "@/lib/biz";
import { shiftMonth, toDate } from "@/lib/dates";

const schema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) });

/** Gera a conta a pagar do imposto do mês (vence no dia 20 do mês seguinte). */
export const POST = route(async (req) => {
  const { month } = schema.parse(await readJson(req));
  const s = await monthSummary(month);
  if (s.tax <= 0) throw new HttpError(400, "Não há imposto estimado neste mês");
  const description = `Imposto (DAS) ${month}`;
  const exists = await db.entry.findFirst({ where: { description, type: "EXPENSE" } });
  if (exists) throw new HttpError(409, "A conta deste imposto já foi gerada");
  const cat = await db.category.findFirst({ where: { group: "TAX" } });
  return db.entry.create({
    data: { type: "EXPENSE", description, amount: s.tax, date: toDate(shiftMonth(month, 1) + "-20"), categoryId: cat?.id ?? null },
  });
});
