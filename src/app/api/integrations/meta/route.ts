import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { getMeta, normalizeAccount } from "@/lib/meta";
import { encryptSecret } from "@/lib/secret";
import { metaConfigSchema } from "@/lib/validators";
import { HttpError } from "@/lib/api";

/** Salva token (criptografado) e contas de anúncio do Meta. */
export const PUT = route(async (req) => {
  const v = metaConfigSchema.parse(await readJson(req));
  const accounts = Array.from(new Set(v.accounts.split(/[\s,;]+/).map(normalizeAccount).filter(Boolean)));
  if (!accounts.every((a) => /^act_\d{5,25}$/.test(a))) throw new HttpError(400, "Conta de anúncios deve ser só números, ex.: act_1234567890");
  const { row } = await getMeta();
  if (!v.token && !row?.secret) throw new HttpError(400, "Informe o token de acesso");
  const data = { config: { accounts, version: v.version, autoSync: v.autoSync }, ...(v.token ? { secret: encryptSecret(v.token), lastError: null } : {}) };
  await db.integration.upsert({ where: { id: "meta" }, update: data, create: { id: "meta", ...data } });
  return { ok: true, accounts };
}, { admin: true });

export const DELETE = route(async () => {
  await db.integration.deleteMany({ where: { id: "meta" } });
  return { deleted: true };
}, { admin: true });
