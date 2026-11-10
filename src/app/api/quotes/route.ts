import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { quoteSchema } from "@/lib/validators";

export const POST = route(async (req) => db.quote.create({ data: quoteSchema.parse(await readJson(req)) }));
