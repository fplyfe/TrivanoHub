import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { settingsSchema } from "@/lib/validators";

export const PUT = route(async (req) => {
  const v = settingsSchema.parse(await readJson(req));
  return db.settings.upsert({ where: { id: 1 }, update: v, create: { id: 1, ...v } });
}, { admin: true });
