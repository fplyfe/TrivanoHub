import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { today, toDate } from "@/lib/dates";
import { entrySchema } from "@/lib/validators";

export const PUT = route(async (req, { params }) => {
  const { repeat: _r, ...v } = entrySchema.parse(await readJson(req));
  const cur = await db.entry.findUniqueOrThrow({ where: { id: params.id } });
  return db.entry.update({
    where: { id: params.id },
    data: { ...v, date: toDate(v.date), paidAt: v.paid ? (cur.paidAt ?? toDate(today())) : null },
  });
});

/** Alterna pago / em aberto. */
export const PATCH = route(async (_req, { params }) => {
  const cur = await db.entry.findUniqueOrThrow({ where: { id: params.id } });
  return db.entry.update({ where: { id: params.id }, data: { paid: !cur.paid, paidAt: cur.paid ? null : toDate(today()) } });
});

export const DELETE = route(async (_req, { params }) => {
  await db.entry.delete({ where: { id: params.id } });
  return { deleted: true };
});
