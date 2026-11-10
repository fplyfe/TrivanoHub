import { itemRoutes } from "@/lib/crud";
import { stepSchema } from "@/lib/validators";

export const { PUT, DELETE } = itemRoutes("growthStep", stepSchema);
