import { itemRoutes } from "@/lib/crud";
import { categorySchema } from "@/lib/validators";

export const { PUT, DELETE } = itemRoutes("category", categorySchema, { admin: true });
