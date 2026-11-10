import { createRoute } from "@/lib/crud";
import { supplierSchema } from "@/lib/validators";

export const POST = createRoute("supplier", supplierSchema);
