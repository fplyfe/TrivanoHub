import { readJson, route, HttpError } from "@/lib/api";
import { syncMeta } from "@/lib/meta";
import { syncSchema } from "@/lib/validators";

/** Sincroniza os gastos do Meta no período (padrão: últimos 7 dias; máximo 90 dias). */
export const POST = route(async (req) => {
  const v = syncSchema.parse(await readJson(req).catch(() => ({})));
  if (v.since && v.until && (Date.parse(v.until) - Date.parse(v.since)) / 864e5 > 90) throw new HttpError(400, "Período máximo de 90 dias por sincronização");
  return syncMeta(v);
});
