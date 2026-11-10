import { db } from "@/lib/db";
import { route } from "@/lib/api";

/** PATCH = cancelar a cotação. DELETE = excluir. */
export const PATCH = route(async (_req, { params }) => db.quote.update({ where: { id: params.id }, data: { status: "CANCELED" } }));

export const DELETE = route(async (_req, { params }) => {
  await db.quote.delete({ where: { id: params.id } });
  return { deleted: true };
});
