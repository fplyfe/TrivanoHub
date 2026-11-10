import { createRoute } from "@/lib/crud";
import { stepSchema } from "@/lib/validators";

export const POST = createRoute("growthStep", stepSchema);
