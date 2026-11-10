import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { toDate } from "@/lib/dates";
import { hashApiKey, sameHash } from "@/lib/secret";
import { ingestSchema } from "@/lib/validators";

/**
 * API de entrada de gastos de anúncios (para n8n, Make, Zapier, scripts do Google Ads...).
 * Autenticação: header "Authorization: Bearer <chave>" ou "x-api-key: <chave>".
 * Corpo: lista de linhas { date, source, campaignId, campaignName, spend, impressions?, clicks?, purchases?, purchaseValue?, sku? }.
 * Reenviar o mesmo dia/campanha atualiza os valores (idempotente).
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const stored = await db.integration.findUnique({ where: { id: "ingest" } });
  if (!key || !stored?.secret || !sameHash(hashApiKey(key), stored.secret)) {
    return NextResponse.json({ error: "Chave de API inválida" }, { status: 401 });
  }
  try {
    const rows = ingestSchema.parse(await req.json());
    const skus = Array.from(new Set(rows.map((r) => r.sku).filter((s): s is string => !!s)));
    const products = skus.length ? await db.product.findMany({ where: { sku: { in: skus } }, select: { id: true, sku: true } }) : [];
    for (const r of rows) {
      const { sku, date, source, campaignId, ...data } = r;
      const productId = sku ? (products.find((p) => p.sku === sku)?.id ?? null) : undefined;
      await db.adDaily.upsert({
        where: { source_campaignId_date: { source, campaignId, date: toDate(date) } },
        update: { ...data, ...(productId !== undefined ? { productId } : {}) },
        create: { ...data, source, campaignId, date: toDate(date), productId: productId ?? null },
      });
    }
    return NextResponse.json({ ok: true, rows: rows.length });
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
    if (e instanceof SyntaxError) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
