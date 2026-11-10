import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

export const SESSION_COOKIE = "gs_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET ausente ou curto demais (mínimo 32 caracteres)");
  return new TextEncoder().encode(s);
};

export type Session = { userId: string; name: string; email: string; role: "ADMIN" | "MEMBER" };

export async function createSession(user: { id: string; name: string; sessionVersion: number }) {
  const token = await new SignJWT({ name: user.name, sv: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Valida o JWT e confere no banco se o usuário continua ativo e se a sessão
 * não foi invalidada (troca/redefinição de senha, desativação).
 */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (!payload.sub) return null;
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, active: true, sessionVersion: true },
    });
    if (!user || !user.active || user.sessionVersion !== Number(payload.sv ?? 0)) return null;
    return { userId: user.id, name: user.name, email: user.email, role: user.role };
  } catch {
    return null;
  }
}
