import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { supplierData } from "@/lib/suppliers";
import { supplierFunnelSchema } from "@/lib/validators";

/** Move o fornecedor no funil (registra quando entrou na etapa) e/ou define o próximo passo. */
export const PATCH = route(async (req, { params }) => {
  const v = supplierFunnelSchema.parse(await readJson(req));
  const cur = await db.supplier.findUniqueOrThrow({ where: { id: params.id }, select: { stage: true } });
  const changed = v.stage && v.stage !== cur.stage ? v.stage : undefined;
  return db.supplier.update({ where: { id: params.id }, data: supplierData({ ...v, stage: changed }, { allowStage: true }) });
});
