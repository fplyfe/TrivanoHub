import { itemRoutes } from "@/lib/crud";
import { supplierSchema } from "@/lib/validators";

export const { PUT, DELETE } = itemRoutes("supplier", supplierSchema);
