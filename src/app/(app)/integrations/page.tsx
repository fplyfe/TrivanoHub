import { headers } from "next/headers";
import { db, n } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getMeta } from "@/lib/meta";
import { decryptSecret, maskSecret } from "@/lib/secret";
import { PageHeader } from "@/components/ui/misc";
import { IntegrationsView } from "./integrations-view";

export const metadata = { title: "Integrações" };

export default async function IntegrationsPage() {
  const [session, meta, ingest, totals, h] = await Promise.all([
    getSession(),
    getMeta(),
    db.integration.findUnique({ where: { id: "ingest" } }),
    db.adDaily.groupBy({ by: ["source"], _sum: { spend: true }, _count: true, _max: { date: true } }),
    headers(),
  ]);
  let tokenMask: string | null = null;
  try {
    tokenMask = meta.row?.secret ? maskSecret(decryptSecret(meta.row.secret)) : null;
  } catch {
    tokenMask = "token ilegível (AUTH_SECRET mudou?)";
  }
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3090";
  return (
    <>
      <PageHeader title="Integrações" description="De onde vêm os gastos com anúncios do Dashboard de Ads" />
      <IntegrationsView
        isAdmin={session?.role === "ADMIN"}
        meta={{
          configured: meta.configured,
          accounts: meta.config.accounts,
          version: meta.config.version,
          autoSync: meta.config.autoSync,
          tokenMask,
          lastSyncAt: meta.row?.lastSyncAt?.toISOString() ?? null,
          lastError: meta.row?.lastError ?? null,
        }}
        ingest={{ active: !!ingest?.secret, prefix: ((ingest?.config ?? {}) as { prefix?: string }).prefix ?? null }}
        endpoint={`${proto}://${host}/api/integrations/ad-spend`}
        totals={totals.map((t) => ({ source: t.source, spend: n(t._sum.spend), rows: t._count, last: t._max.date?.toISOString().slice(0, 10) ?? null }))}
      />
    </>
  );
}
