import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validators";

/** Administrador define uma nova senha para outro usuário (encerra as sessões dele). */
export const POST = route(
  async (req, { params, userId }) => {
    if (params.id === userId) throw new HttpError(400, "Para a sua própria senha, use \"Alterar minha senha\"");
    const { password } = resetPasswordSchema.parse(await readJson(req));
    await db.user.update({
      where: { id: params.id },
      data: { passwordHash: await bcrypt.hash(password, 12), sessionVersion: { increment: 1 } },
    });
    return { ok: true };
  },
  { admin: true },
);
