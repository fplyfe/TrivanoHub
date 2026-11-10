import { route } from "@/lib/api";
import { getMeta, testMeta } from "@/lib/meta";
import { decryptSecret } from "@/lib/secret";
import { HttpError } from "@/lib/api";

/** Testa o token salvo: lê o usuário e o nome de cada conta de anúncios. */
export const POST = route(async () => {
  const { row, config } = await getMeta();
  if (!row?.secret) throw new HttpError(400, "Salve o token primeiro");
  return testMeta(decryptSecret(row.secret), config.version, config.accounts);
}, { admin: true });
