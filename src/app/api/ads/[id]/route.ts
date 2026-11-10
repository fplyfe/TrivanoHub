import { db } from "@/lib/db";
import { route } from "@/lib/api";

export const DELETE = route(async (_req, { params }) => {
  const a = await db.adSpend.findUniqueOrThrow({ where: { id: params.id } });
  await db.$transaction(async (tx) => {
    await tx.adSpend.delete({ where: { id: a.id } });
    if (a.entryId) await tx.entry.delete({ where: { id: a.entryId } }).catch(() => null);
  });
  return { deleted: true };
});
