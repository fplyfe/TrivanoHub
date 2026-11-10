import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { hashApiKey, newApiKey } from "@/lib/secret";

/** Gera uma nova chave para a API de entrada de gastos. A chave aparece uma vez só; guardamos apenas o hash. */
export const POST = route(async () => {
  const key = newApiKey();
  const data = { secret: hashApiKey(key), config: { prefix: key.slice(0, 8) } };
  await db.integration.upsert({ where: { id: "ingest" }, update: data, create: { id: "ingest", ...data } });
  return { key };
}, { admin: true });

export const DELETE = route(async () => {
  await db.integration.deleteMany({ where: { id: "ingest" } });
  return { deleted: true };
}, { admin: true });
