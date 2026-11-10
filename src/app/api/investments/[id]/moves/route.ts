import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { toDate } from "@/lib/dates";
import { investmentMoveSchema } from "@/lib/validators";

export const POST = route(async (req, { params }) => {
  const v = investmentMoveSchema.parse(await readJson(req));
  return db.investmentMove.create({
    data: { ...v, date: toDate(v.date), accountId: v.type === "VALUATION" ? null : v.accountId, investmentId: params.id },
  });
});
