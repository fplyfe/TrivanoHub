import { createRoute } from "@/lib/crud";
import { accountSchema } from "@/lib/validators";

export const POST = createRoute("account", accountSchema, { admin: true });
