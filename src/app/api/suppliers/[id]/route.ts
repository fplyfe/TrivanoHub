import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { itemRoutes } from "@/lib/crud";
import { assertUniqueSupplier, supplierData } from "@/lib/suppliers";
import { supplierSchema } from "@/lib/validators";

export const { DELETE } = itemRoutes("supplier", supplierSchema);

/** Edita o cadastro. A etapa do funil muda só pelo PATCH /funnel (que registra a data). */
export const PUT = route(async (req, { params }) => {
  const data = supplierSchema.parse(await readJson(req));
  await assertUniqueSupplier(data, params.id);
  return db.supplier.update({ where: { id: params.id }, data: supplierData(data, { allowStage: false }) });
});
