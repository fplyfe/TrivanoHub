import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { getSession, type Session } from "./auth";
import { plain } from "./db";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Handler = (req: NextRequest, ctx: { params: Record<string, string>; userId: string; session: Session }) => Promise<unknown>;

/** Envolve um handler: autenticação, validação (zod) e tratamento de erros. */
export function route(handler: Handler, opts: { admin?: boolean } = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: NextRequest, ctx: { params: Promise<any> }) => {
    try {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
      if (opts.admin && session.role !== "ADMIN") return NextResponse.json({ error: "Apenas administradores" }, { status: 403 });
      const params = (await ctx?.params) ?? {};
      const data = await handler(req, { params, userId: session.userId, session });
      if (data instanceof Response) return data;
      return NextResponse.json(plain(data ?? { ok: true }));
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        const msg = e.issues.map((i) => `${i.path.join(".") || "campo"}: ${i.message}`).join("; ");
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2025") return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
        if (e.code === "P2002") return NextResponse.json({ error: "Já existe um registro com esses dados" }, { status: 409 });
        if (e.code === "P2003") return NextResponse.json({ error: "Registro em uso por outros dados" }, { status: 409 });
      }
      console.error("[api]", e);
      return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
    }
  };
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "JSON inválido");
  }
}
