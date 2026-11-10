import { createRoute } from "@/lib/crud";
import { channelSchema } from "@/lib/validators";

export const POST = createRoute("channel", channelSchema, { admin: true });
