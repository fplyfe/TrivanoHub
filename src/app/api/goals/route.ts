import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { goalSchema } from "@/lib/validators";

/** Cria ou atualiza a meta do mês. */
export const POST = route(async (req) => {
  const v = goalSchema.parse(await readJson(req));
  return db.monthlyGoal.upsert({ where: { month: v.month }, update: v, create: v });
});
