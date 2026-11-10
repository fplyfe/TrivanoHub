import { createRoute } from "@/lib/crud";
import { categorySchema } from "@/lib/validators";

export const POST = createRoute("category", categorySchema, { admin: true });
