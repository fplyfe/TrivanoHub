import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { toDate, today } from "@/lib/dates";
import { stageSchema } from "@/lib/validators";

/** Move o produto no funil. Ao entrar em teste, marca a data de início do teste. */
export const PATCH = route(async (req, { params }) => {
  const { stage } = stageSchema.parse(await readJson(req));
  const cur = await db.product.findUniqueOrThrow({ where: { id: params.id } });
  return db.product.update({
    where: { id: params.id },
    data: { stage, ...(stage === "TESTING" && cur.stage !== "TESTING" ? { testStartedAt: toDate(today()) } : {}) },
  });
});
