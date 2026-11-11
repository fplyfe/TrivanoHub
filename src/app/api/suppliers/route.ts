import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { assertUniqueSupplier } from "@/lib/suppliers";
import { supplierSchema } from "@/lib/validators";

export const POST = route(async (req) => {
  const data = supplierSchema.parse(await readJson(req));
  await assertUniqueSupplier(data);
  return db.supplier.create({ data });
});
