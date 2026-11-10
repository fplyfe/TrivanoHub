import { itemRoutes } from "@/lib/crud";
import { productSchema } from "@/lib/validators";

export const { PUT, DELETE } = itemRoutes("product", productSchema);
