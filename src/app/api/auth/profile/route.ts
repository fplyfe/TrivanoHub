import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { userPublicSelect } from "@/lib/users";
import { profileSchema } from "@/lib/validators";

/** Cada usuário edita o próprio nome e e-mail. */
export const PUT = route(async (req, { userId }) =>
  db.user.update({ where: { id: userId }, data: profileSchema.parse(await readJson(req)), select: userPublicSelect }),
);
