import { itemRoutes } from "@/lib/crud";
import { accountSchema } from "@/lib/validators";

export const { PUT, DELETE } = itemRoutes("account", accountSchema, { admin: true });
