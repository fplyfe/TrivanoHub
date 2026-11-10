import { db } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/api";
import { offerSchema } from "@/lib/validators";

export const POST = route(async (req, { params }) => {
  const q = await db.quote.findUniqueOrThrow({ where: { id: params.id } });
  if (q.status !== "OPEN") throw new HttpError(400, "Cotação já encerrada");
  return db.quoteOffer.create({ data: { ...offerSchema.parse(await readJson(req)), quoteId: q.id } });
});
