// Integração com a Marketing API do Meta (Facebook/Instagram Ads): insights por campanha e por dia.
import { db, n } from "./db";
import { HttpError } from "./api";
import { addDays, toDate, today } from "./dates";
import { decryptSecret } from "./secret";

export const META_DEFAULT_VERSION = "v26.0";
const BASE = () => (process.env.META_GRAPH_BASE ?? "https://graph.facebook.com").replace(/\/$/, "");

export type MetaConfig = { accounts: string[]; version: string; autoSync: boolean };

export async function getMeta() {
  const row = await db.integration.findUnique({ where: { id: "meta" } });
  const cfg = (row?.config ?? {}) as Partial<MetaConfig>;
  return {
    row,
    config: { accounts: cfg.accounts ?? [], version: cfg.version ?? META_DEFAULT_VERSION, autoSync: cfg.autoSync ?? true } as MetaConfig,
    configured: !!row?.secret && (cfg.accounts?.length ?? 0) > 0,
  };
}

export const normalizeAccount = (a: string) => {
  const id = a.trim().replace(/^act_/i, "");
  return id ? `act_${id}` : "";
};

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number } };

async function graph<T>(version: string, token: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE()}/${version}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || body.error) {
    const e = body.error;
    const hint = e?.code === 190 ? " (token inválido ou expirado: gere um novo)" : e?.code === 17 || e?.code === 80004 ? " (limite de chamadas do Meta: tente em alguns minutos)" : "";
    throw new HttpError(400, `Meta: ${e?.message ?? `HTTP ${res.status}`}${hint}`);
  }
  return body;
}

/** Segue a paginação do Graph (campo paging.next). */
async function graphAll<R>(version: string, token: string, path: string, params: Record<string, string>): Promise<R[]> {
  const out: R[] = [];
  let page = await graph<{ data: R[]; paging?: { next?: string; cursors?: { after?: string } } }>(version, token, path, params);
  out.push(...page.data);
  for (let i = 0; i < 50 && page.paging?.next && page.paging.cursors?.after; i++) {
    page = await graph(version, token, path, { ...params, after: page.paging.cursors.after });
    out.push(...page.data);
  }
  return out;
}

export async function testMeta(token: string, version: string, accounts: string[]) {
  const me = await graph<{ id: string; name?: string }>(version, token, "me", { fields: "id,name" });
  const accs = [];
  for (const a of accounts) {
    const info = await graph<{ id: string; name: string; currency: string; account_status: number }>(version, token, a, {
      fields: "name,currency,account_status",
    });
    accs.push({ id: a, name: info.name, currency: info.currency, active: info.account_status === 1 });
  }
  return { user: me.name ?? me.id, accounts: accs };
}

type InsightRow = {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
};

// Ordem de preferência para "compra" (depende do pixel/API de conversões configurados)
const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "onsite_web_purchase"];
export function pickPurchase(list?: { action_type: string; value: string }[]) {
  if (!list) return 0;
  for (const t of PURCHASE_TYPES) {
    const f = list.find((x) => x.action_type === t);
    if (f) return Number(f.value) || 0;
  }
  return 0;
}

/** Baixa os insights diários por campanha e grava/atualiza a tabela AdDaily. */
export async function syncMeta(opts: { since?: string; until?: string } = {}) {
  const { row, config, configured } = await getMeta();
  if (!configured || !row?.secret) throw new HttpError(400, "Configure o token e a conta de anúncios do Meta primeiro");
  const token = decryptSecret(row.secret);
  const until = opts.until ?? today();
  const since = opts.since ?? addDays(until, -6);

  const products = await db.product.findMany({ select: { id: true, sku: true } });
  const linked = await db.adDaily.findMany({
    where: { source: "META", productId: { not: null } },
    distinct: ["campaignId"],
    select: { campaignId: true, productId: true },
  });
  const linkMap = new Map(linked.map((l) => [l.campaignId, l.productId]));
  // Liga automaticamente a campanha ao produto quando o nome da campanha contém o SKU
  const bySku = (name: string) => products.find((p) => p.sku.length >= 3 && name.toLowerCase().includes(p.sku.toLowerCase()))?.id ?? null;

  let rows = 0;
  let spend = 0;
  try {
    for (const account of config.accounts) {
      const [insights, campaigns] = await Promise.all([
        graphAll<InsightRow>(config.version, token, `${account}/insights`, {
          level: "campaign",
          fields: "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values",
          time_range: JSON.stringify({ since, until }),
          time_increment: "1",
          limit: "500",
        }),
        graphAll<{ id: string; effective_status?: string }>(config.version, token, `${account}/campaigns`, {
          fields: "id,effective_status",
          limit: "500",
        }),
      ]);
      const status = new Map(campaigns.map((c) => [c.id, c.effective_status ?? null]));
      for (const r of insights) {
        const data = {
          accountId: account,
          campaignName: r.campaign_name,
          status: status.get(r.campaign_id) ?? null,
          spend: Number(r.spend ?? 0),
          impressions: Number(r.impressions ?? 0),
          clicks: Number(r.clicks ?? 0),
          purchases: Math.round(pickPurchase(r.actions)),
          purchaseValue: pickPurchase(r.action_values),
        };
        const productId = linkMap.get(r.campaign_id) ?? bySku(r.campaign_name);
        await db.adDaily.upsert({
          where: { source_campaignId_date: { source: "META", campaignId: r.campaign_id, date: toDate(r.date_start) } },
          update: { ...data, ...(productId ? { productId } : {}) },
          create: { ...data, source: "META", campaignId: r.campaign_id, date: toDate(r.date_start), productId },
        });
        rows++;
        spend += data.spend;
      }
    }
    await db.integration.update({ where: { id: "meta" }, data: { lastSyncAt: new Date(), lastError: null } });
  } catch (e) {
    await db.integration.update({ where: { id: "meta" }, data: { lastError: e instanceof Error ? e.message : String(e) } });
    throw e;
  }
  return { rows, spend: Math.round(spend * 100) / 100, since, until };
}

/** Sincroniza sozinho (últimos 3 dias) se a última sincronização tem mais de 1 hora. Nunca derruba a página. */
export async function maybeAutoSyncMeta() {
  try {
    const { row, config, configured } = await getMeta();
    if (!configured || !config.autoSync) return;
    if (row?.lastSyncAt && Date.now() - row.lastSyncAt.getTime() < 60 * 60 * 1000) return;
    await Promise.race([syncMeta({ since: addDays(today(), -2) }), new Promise((r) => setTimeout(r, 8000))]);
  } catch {
    // o erro fica gravado em lastError e aparece em Integrações
  }
}

export const metaSpendTotal = async (since: Date, until: Date) =>
  n((await db.adDaily.aggregate({ where: { date: { gte: since, lt: until } }, _sum: { spend: true } }))._sum.spend);
