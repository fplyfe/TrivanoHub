import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { cancelSale } from "@/lib/biz";

/** PATCH = cancelar (devolve estoque). DELETE = excluir de vez (só vendas canceladas). */
export const PATCH = route(async (_req, { params }) => {
  await cancelSale(params.id);
  return { ok: true };
});

export const DELETE = route(async (_req, { params }) => {
  const s = await db.sale.findUniqueOrThrow({ where: { id: params.id } });
  if (s.status !== "CANCELED") {
    await cancelSale(params.id);
  }
  await db.sale.delete({ where: { id: params.id } });
  return { deleted: true };
}, { admin: true });
