import { db } from "./db";
import { HttpError } from "./api";

export const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

/** Impede deixar o sistema sem nenhum administrador ativo. */
export async function assertAdminRemains(targetId: string, next: { role: "ADMIN" | "MEMBER"; active: boolean }) {
  const target = await db.user.findUniqueOrThrow({ where: { id: targetId }, select: { role: true, active: true } });
  const losesAdmin = target.role === "ADMIN" && target.active && (next.role !== "ADMIN" || !next.active);
  if (!losesAdmin) return;
  const others = await db.user.count({ where: { role: "ADMIN", active: true, id: { not: targetId } } });
  if (others === 0) throw new HttpError(400, "É preciso manter ao menos um administrador ativo");
}
