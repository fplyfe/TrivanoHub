import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";

// Limite simples de tentativas por IP (o Nginx também aplica limit_req).
const attempts = new Map<string, { count: number; reset: number }>();
const MAX = 8;
const WINDOW = 15 * 60 * 1000;
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.2n3g1sJ5v4kq8dN0yS6l8w1m6Y8y";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const a = attempts.get(ip);
  if (a && a.reset > now && a.count >= MAX) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) {
    const cur = a && a.reset > now ? a : { count: 0, reset: now + WINDOW };
    cur.count++;
    attempts.set(ip, cur);
    return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
  }

  attempts.delete(ip);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user);
  return NextResponse.json({ ok: true });
}
