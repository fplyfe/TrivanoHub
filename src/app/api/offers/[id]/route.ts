import { db } from "@/lib/db";
import { route } from "@/lib/api";

export const DELETE = route(async (_req, { params }) => {
  await db.quoteOffer.delete({ where: { id: params.id } });
  return { deleted: true };
});
