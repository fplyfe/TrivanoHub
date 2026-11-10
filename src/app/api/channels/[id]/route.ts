import { itemRoutes } from "@/lib/crud";
import { channelSchema } from "@/lib/validators";

export const { PUT, DELETE } = itemRoutes("channel", channelSchema, { admin: true });
