import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { addMonths, toDate } from "@/lib/dates";
import { entrySchema } from "@/lib/validators";

export const POST = route(async (req) => {
  const { repeat, ...v } = entrySchema.parse(await readJson(req));
  const rows = Array.from({ length: repeat }, (_, i) => {
    const date = addMonths(v.date, i);
    const paid = i === 0 ? v.paid : false;
    return {
      ...v,
      description: repeat > 1 ? `${v.description} (${i + 1}/${repeat})` : v.description,
      date: toDate(date),
      paid,
      paidAt: paid ? toDate(date) : null,
    };
  });
  await db.entry.createMany({ data: rows });
  return { created: rows.length };
});
