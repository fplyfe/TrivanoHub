import { createRoute } from "@/lib/crud";
import { productSchema } from "@/lib/validators";

export const POST = createRoute("product", productSchema);
