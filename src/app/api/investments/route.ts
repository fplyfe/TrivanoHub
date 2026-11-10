import { createRoute } from "@/lib/crud";
import { investmentSchema } from "@/lib/validators";

export const POST = createRoute("investment", investmentSchema);
