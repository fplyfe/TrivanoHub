import { itemRoutes } from "@/lib/crud";
import { investmentSchema } from "@/lib/validators";

export const { PUT, DELETE } = itemRoutes("investment", investmentSchema);
