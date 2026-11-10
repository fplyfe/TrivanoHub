import { db } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/api";
import { assertAdminRemains, userPublicSelect } from "@/lib/users";
import { userUpdateSchema } from "@/lib/validators";

export const PUT = route(
  async (req, { params, userId }) => {
    const v = userUpdateSchema.parse(await readJson(req));
    const current = await db.user.findUniqueOrThrow({ where: { id: params.id } });
    if (params.id === userId && (!v.active || v.role !== current.role)) {
      throw new HttpError(400, "Você não pode alterar seu próprio perfil de acesso nem se desativar");
    }
    await assertAdminRemains(params.id, v);
    return db.user.update({
      where: { id: params.id },
      data: {
        ...v,
        // desativar encerra as sessões abertas do usuário imediatamente
        ...(current.active && !v.active ? { sessionVersion: { increment: 1 } } : {}),
      },
      select: userPublicSelect,
    });
  },
  { admin: true },
);

/** Exclui o usuário (o histórico de vendas e lançamentos não depende dele). */
export const DELETE = route(
  async (_req, { params, userId }) => {
    if (params.id === userId) throw new HttpError(400, "Você não pode excluir a si mesmo");
    await assertAdminRemains(params.id, { role: "MEMBER", active: false });
    await db.user.delete({ where: { id: params.id } });
    return { deleted: true };
  },
  { admin: true },
);
