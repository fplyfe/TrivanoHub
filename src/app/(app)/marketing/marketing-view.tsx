"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BadgeDollarSign,
  Megaphone,
  Percent,
  PiggyBank,
  Plus,
  RefreshCw,
  Repeat,
  ShoppingBag,
  Target,
  TrendingUp,
  Undo2,
  Wallet,
  Receipt,
  Package,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, Empty, PageHeader } from "@/components/ui/misc";
import { ActionButton, FormDialog } from "@/components/app/form-dialog";
import { brandColor, DailyAdsChart, DonutChart } from "@/components/app/charts";
import { api } from "@/lib/client";
import { today } from "@/lib/dates";
import { PERIODS, SOURCE_LABEL } from "@/lib/marketing-shared";
import type { AdsDashboard } from "@/lib/marketing";
import { brl, cn, fmtPct } from "@/lib/utils";

type Opt = { id: string; name: string };
type Filters = { period: string; from: string; to: string; channel: string; source: string; product: string };

const num = (v: number) => v.toLocaleString("pt-BR");
const dec = (v: number | null, d = 2) => (v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const ago = (iso: string | null) => {
  if (!iso) return "nunca";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "agora mesmo";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `há ${h} h` : `há ${Math.round(h / 24)} dias`;
};

/** Cartão de métrica no estilo "resumo" (grande ou compacto). */
function Metric({
  label,
  value,
  hint,
  icon,
  tone,
  big,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: "good" | "bad";
  big?: boolean;
}) {
  return (
    <Card className={cn(big && "border-primary/15")}>
      <CardContent className={cn("flex items-start justify-between gap-2", big ? "p-4 sm:p-5" : "p-3 sm:p-4")}>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground" title={hint}>
            {label}
          </p>
          <p
            className={cn(
              "mt-1 break-words font-bold leading-tight tracking-tight",
              big ? "font-brand text-xl sm:text-2xl 2xl:text-3xl" : "text-base sm:text-xl",
              tone === "good" && "text-success",
              tone === "bad" && "text-destructive",
            )}
          >
            {value}
          </p>
          {hint && big && <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
        </div>
        <span
          className={cn(
            "shrink-0 place-items-center rounded-full [&_svg]:size-4",
            big ? "hidden size-10 bg-primary text-primary-foreground sm:grid" : "hidden size-8 bg-secondary text-muted-foreground sm:grid",
          )}
        >
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}

function FilterBar({ filters, channels, products }: { filters: Filters; channels: Opt[]; products: (Opt & { sku: string })[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (patch: Partial<Filters>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (patch.period && patch.period !== "custom") {
      next.delete("from");
      next.delete("to");
    }
    router.push(`${pathname}?${next.toString()}`);
  };
  return (
    <Card>
      <CardContent className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4 lg:p-4">
        <Field label="Período">
          <Select value={filters.period} onChange={(e) => set({ period: e.target.value, ...(e.target.value === "custom" ? { from: filters.from, to: filters.to } : {}) })}>
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Canal de venda">
          <Select value={filters.channel} onChange={(e) => set({ channel: e.target.value })}>
            <option value="">Todos</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fonte de tráfego">
          <Select value={filters.source} onChange={(e) => set({ source: e.target.value })}>
            <option value="">Qualquer</option>
            {Object.entries(SOURCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Produto">
          <Select value={filters.product} onChange={(e) => set({ product: e.target.value })}>
            <option value="">Qualquer</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        {filters.period === "custom" && (
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <Field label="De">
              <Input type="date" defaultValue={filters.from} max={today()} onChange={(e) => e.target.value && set({ period: "custom", from: e.target.value, to: filters.to })} />
            </Field>
            <Field label="Até">
              <Input type="date" defaultValue={filters.to} max={today()} onChange={(e) => e.target.value && set({ period: "custom", from: filters.from, to: e.target.value })} />
            </Field>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ManualSpend({ products }: { products: Opt[] }) {
  return (
    <FormDialog
      title="Lançar gasto com anúncios"
      description="Para fontes sem integração (Mercado Ads, Google, influenciadores). Lançar de novo o mesmo dia e campanha atualiza o valor."
      onSubmit={(fd) =>
        api("/api/ad-daily", "POST", {
          date: fd.get("date"),
          source: fd.get("source"),
          campaignName: fd.get("campaignName"),
          spend: fd.get("spend"),
          purchases: fd.get("purchases") || 0,
          purchaseValue: fd.get("purchaseValue") || 0,
          productId: fd.get("productId"),
        })
      }
      trigger={
        <Button variant="outline">
          <Plus /> Lançar gasto
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <Input name="date" type="date" defaultValue={today()} required />
        </Field>
        <Field label="Fonte">
          <Select name="source" defaultValue="MERCADO_ADS">
            {Object.entries(SOURCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Campanha">
        <Input name="campaignName" placeholder="Ex.: Organizador de gaveta · Product Ads" required maxLength={200} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Gasto (R$)">
          <Input name="spend" type="number" step="0.01" min="0" required autoFocus />
        </Field>
        <Field label="Vendas">
          <Input name="purchases" type="number" min="0" defaultValue={0} />
        </Field>
        <Field label="Valor vendas (R$)">
          <Input name="purchaseValue" type="number" step="0.01" min="0" defaultValue={0} />
        </Field>
      </div>
      <Field label="Produto (opcional)">
        <Select name="productId" defaultValue="">
          <option value="">—</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
    </FormDialog>
  );
}

export function MarketingView({
  data,
  filters,
  channels,
  products,
  meta,
}: {
  data: AdsDashboard;
  filters: Filters;
  channels: Opt[];
  products: (Opt & { sku: string })[];
  meta: { configured: boolean; lastSyncAt: string | null; lastError: string | null };
}) {
  const router = useRouter();
  const d = data;
  const profitTone = d.profit >= 0 ? "good" : "bad";
  const fmtDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const maxProduct = Math.max(1, ...d.byProduct.map((p) => p.gross));
  const maxSource = Math.max(1, ...d.bySource.map((s) => s.spend));

  return (
    <>
      <PageHeader
        title="Dashboard de Ads"
        description={
          d.period.days === 1
            ? `Resumo de ${fmtDay(d.period.from)}`
            : `Resumo de ${fmtDay(d.period.from)} a ${fmtDay(d.period.to)} (${d.period.days} dias)`
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {meta.configured ? (
            <ActionButton variant="outline" action={() => api("/api/integrations/meta/sync", "POST", { since: filters.from, until: filters.to })}>
              <RefreshCw /> Sincronizar Meta
            </ActionButton>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/integrations">
                <Megaphone /> Conectar Meta Ads
              </Link>
            </Button>
          )}
          <ManualSpend products={products} />
        </div>
      </PageHeader>

      <div className="grid gap-4">
        {meta.configured && (
          <p className={cn("-mt-2 text-xs", meta.lastError ? "text-destructive" : "text-muted-foreground")}>
            {meta.lastError ? (
              <>
                <AlertTriangle className="mr-1 inline size-3.5" /> Última sincronização falhou: {meta.lastError}
              </>
            ) : (
              <>Meta Ads atualizado {ago(meta.lastSyncAt)}</>
            )}
          </p>
        )}

        <FilterBar filters={filters} channels={channels} products={products} />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Metric big label="Faturamento líquido" value={brl(d.netRevenue)} hint={`Bruto ${brl(d.gross)} − tarifas e frete`} icon={<Wallet />} />
          <Metric big label="Gastos com anúncios" value={brl(d.adSpend)} hint={d.bySource.map((s) => `${s.label} ${brl(s.spend)}`).join(" · ") || "Sem gastos no período"} icon={<Megaphone />} />
          <Metric big label="ROAS" value={d.roas == null ? "—" : dec(d.roas)} hint="Faturamento ÷ gastos com anúncios" icon={<Target />} />
          <Metric big label="Lucro" value={brl(d.profit)} tone={profitTone} hint="Depois de custo, tarifas, frete, imposto, Ads e despesas" icon={<PiggyBank />} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Vendas por canal</CardTitle>
            </CardHeader>
            <CardContent>
              {d.byChannel.length ? (
                <>
                  <DonutChart data={d.byChannel.map((c) => ({ name: c.name, value: c.orders }))} total={num(d.orders)} totalLabel="vendas" />
                  <div className="mt-3 grid gap-1.5 text-sm">
                    {d.byChannel.map((c, i) => (
                      <div key={c.name} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ background: brandColor(i) }} />
                          {c.name}
                        </span>
                        <span className="text-muted-foreground">
                          {c.orders} · {brl(c.gross)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <Empty>Sem vendas no período</Empty>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-2 lg:grid-cols-3">
            <Metric label="Vendas" value={num(d.orders)} icon={<ShoppingBag />} />
            <Metric label="Ticket médio" value={brl(d.ticket)} icon={<Receipt />} />
            <Metric label="ROI" value={d.roi == null ? "—" : dec(d.roi)} hint="Lucro ÷ gastos com anúncios" tone={d.roi != null ? (d.roi >= 0 ? "good" : "bad") : undefined} icon={<TrendingUp />} />
            <Metric label="Margem de lucro" value={d.margin == null ? "—" : fmtPct(d.margin)} tone={d.margin != null ? (d.margin >= 0 ? "good" : "bad") : undefined} icon={<Percent />} />
            <Metric label="Custo por venda (CPA)" value={d.cpa == null ? "—" : brl(d.cpa)} hint="Gastos com anúncios ÷ vendas" icon={<BadgeDollarSign />} />
            <Metric label="Custo dos produtos" value={brl(d.cogs)} hint="Custo médio + embalagem" icon={<Package />} />
            <Metric label="Tarifas e frete" value={brl(d.fees + d.shipping)} hint="Comissão, tarifa por unidade e frete pago pela loja" icon={<Truck />} />
            <Metric label="Imposto" value={brl(d.tax)} icon={<Percent />} />
            <Metric
              label="Vendas canceladas"
              value={brl(d.canceled.gross)}
              hint={`${d.canceled.count} venda(s)`}
              icon={<Undo2 />}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Metric label="Despesas adicionais" value={d.extraExpensesApplies ? brl(d.extraExpenses) : "—"} hint="Despesas fixas e variáveis do Caixa no período (sem filtro de canal/produto)" icon={<Repeat />} />
          <Metric label="Impressões" value={num(d.impressions)} icon={<Megaphone />} />
          <Metric label="CTR" value={d.ctr == null ? "—" : fmtPct(d.ctr, 2)} hint="Cliques ÷ impressões" icon={<Target />} />
          <Metric label="CPC" value={d.cpc == null ? "—" : brl(d.cpc)} hint="Gasto ÷ cliques" icon={<BadgeDollarSign />} />
        </div>

        {d.period.days > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Faturamento, gastos com Ads e lucro por dia</CardTitle>
            </CardHeader>
            <CardContent>
              <DailyAdsChart data={d.daily.map((x) => ({ label: fmtDay(x.date), gross: x.gross, ads: x.ads, profit: x.profit }))} />
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Vendas por produto</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {d.byProduct.length === 0 && <Empty>Sem vendas no período</Empty>}
              {d.byProduct.map((p) => (
                <div key={p.id} className="grid gap-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {p.units} un. · {brl(p.gross)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${(p.gross / maxProduct) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Gastos por fonte de tráfego</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {d.bySource.length === 0 && <Empty>Sem gastos com anúncios no período</Empty>}
              {d.bySource.map((s, i) => (
                <div key={s.source} className="grid gap-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{s.label}</span>
                    <span className="text-muted-foreground">
                      {brl(s.spend)} · {fmtPct(d.adSpend ? (s.spend / d.adSpend) * 100 : 0, 0)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary">
                    <div className="h-2 rounded-full" style={{ width: `${(s.spend / maxSource) * 100}%`, background: brandColor(i + 1) }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Campanhas</CardTitle>
            <p className="text-xs text-muted-foreground">
              Compras, valor e ROAS da campanha são os informados pela plataforma de anúncios (atribuição dela). Ligue cada campanha a um produto para filtrar o
              painel por produto.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {d.campaigns.length === 0 ? (
              <div className="p-6">
                <Empty>Nenhuma campanha no período. Conecte o Meta Ads em Integrações ou lance um gasto.</Empty>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-y bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3">Campanha</th>
                      <th className="p-3 text-right">Gasto</th>
                      <th className="hidden p-3 text-right 2xl:table-cell">Impressões</th>
                      <th className="hidden p-3 text-right md:table-cell">CTR</th>
                      <th className="hidden p-3 text-right 2xl:table-cell">CPC</th>
                      <th className="p-3 text-right">Compras</th>
                      <th className="hidden p-3 text-right sm:table-cell">Valor</th>
                      <th className="p-3 text-right">ROAS</th>
                      <th className="hidden p-3 text-right lg:table-cell">CPA</th>
                      <th className="hidden p-3 xl:table-cell">Produto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {d.campaigns.map((c) => (
                      <tr key={c.key} className="hover:bg-muted/30">
                        <td className="max-w-[16rem] p-3">
                          <div className="truncate font-medium" title={c.name}>
                            {c.name}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                            <Badge>{SOURCE_LABEL[c.source]}</Badge>
                            {c.status && (
                              <Badge tone={c.status === "ACTIVE" ? "success" : "muted"}>{c.status === "ACTIVE" ? "Ativa" : c.status === "PAUSED" ? "Pausada" : c.status}</Badge>
                            )}
                            {c.manual && <span>manual</span>}
                          </div>
                        </td>
                        <td className="whitespace-nowrap p-3 text-right font-medium">{brl(c.spend)}</td>
                        <td className="hidden whitespace-nowrap p-3 text-right 2xl:table-cell">{num(c.impressions)}</td>
                        <td className="hidden whitespace-nowrap p-3 text-right md:table-cell">{c.ctr == null ? "—" : fmtPct(c.ctr, 2)}</td>
                        <td className="hidden whitespace-nowrap p-3 text-right 2xl:table-cell">{c.cpc == null ? "—" : brl(c.cpc)}</td>
                        <td className="whitespace-nowrap p-3 text-right">{c.purchases}</td>
                        <td className="hidden whitespace-nowrap p-3 text-right sm:table-cell">{brl(c.value)}</td>
                        <td className="whitespace-nowrap p-3 text-right">
                          {c.roas == null ? "—" : <Badge tone={c.roas >= 3 ? "success" : c.roas >= 1.5 ? "warning" : "danger"}>{dec(c.roas)}</Badge>}
                        </td>
                        <td className="hidden whitespace-nowrap p-3 text-right lg:table-cell">{c.cpa == null ? "—" : brl(c.cpa)}</td>
                        <td className="hidden p-3 xl:table-cell">
                          {c.key.startsWith("WEEKLY:") ? (
                            <span className="text-xs text-muted-foreground">{c.productName}</span>
                          ) : (
                            <Select
                              className="h-8 w-40 text-xs"
                              value={c.productId ?? ""}
                              aria-label="Produto da campanha"
                              onChange={async (e) => {
                                await api("/api/ad-campaigns", "PATCH", { source: c.source, campaignId: c.campaignId, productId: e.target.value });
                                router.refresh();
                              }}
                            >
                              <option value="">— sem produto —</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </Select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
