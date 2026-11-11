import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { itemRoutes } from "@/lib/crud";
import { supplierSchema } from "@/lib/validators";
import { assertUniqueSupplier } from "@/lib/suppliers";

export const { DELETE } = itemRoutes("supplier", supplierSchema);

export const PUT = route(async (req, { params }) => {
  const data = supplierSchema.parse(await readJson(req));
  await assertUniqueSupplier(data, params.id);
  return db.supplier.update({ where: { id: params.id }, data });
});
