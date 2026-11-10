import { readJson, route } from "@/lib/api";
import { createSale } from "@/lib/biz";
import { saleSchema } from "@/lib/validators";

export const POST = route(async (req) => createSale(saleSchema.parse(await readJson(req))));
