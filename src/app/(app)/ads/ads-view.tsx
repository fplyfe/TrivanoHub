"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, Empty } from "@/components/ui/misc";
import { ActionButton, FormDialog } from "@/components/app/form-dialog";
import { Stat } from "@/components/app/stat";
import { api } from "@/lib/client";
import { acosOf, ADS_LOSS_LIMIT, type Advice } from "@/lib/growth";
import { brl, cn, fmtDate, fmtPct } from "@/lib/utils";

type Week = { id: string; weekStart: string; spend: number; adSales: number; adOrders: number; impressions: number | null; clicks: number | null };
export type AdsRow = {
  id: string;
  name: string;
  sku: string;
  stage: string;
  price: number;
  breakEven: number | null;
  weeks: Week[];
  advice: Advice;
};
type Acc = { id: string; name: string; marketplace: boolean };

const toneCls = {
  good: "border-success/40 bg-success/10 text-success",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-border bg-secondary/50 text-muted-foreground",
};

function WeekForm({ row, accounts, thisWeek }: { row: AdsRow; accounts: Acc[]; thisWeek: string }) {
  const last = row.weeks.at(-1);
  const defAcc = accounts.find((a) => a.marketplace)?.id ?? "";
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Semana (qualquer dia dela)">
          <Input name="weekStart" type="date" defaultValue={thisWeek} required />
        </Field>
        <Field label="Gasto em Ads (R$)">
          <Input name="spend" type="number" step="0.01" min="0" required autoFocus />
        </Field>
        <Field label="Vendas por Ads (R$)">
          <Input name="adSales" type="number" step="0.01" min="0" defaultValue={0} />
        </Field>
        <Field label="Nº de vendas por Ads">
          <Input name="adOrders" type="number" min="0" defaultValue={0} />
        </Field>
        <Field label="Impressões (opcional)">
          <Input name="impressions" type="number" min="0" />
        </Field>
        <Field label="Cliques (opcional)">
          <Input name="clicks" type="number" min="0" />
        </Field>
        <Field label="Debitado da conta" className="col-span-2">
          <Select name="accountId" defaultValue={defAcc}>
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="createEntry" defaultChecked /> Lançar o gasto como saída no Caixa (entra no lucro do mês)
      </label>
      <p className="text-xs text-muted-foreground">
        Copie os números do painel do Mercado Ads. Lançar de novo a mesma semana atualiza os valores.
        {last && ` Última semana lançada: ${fmtDate(last.weekStart)}.`}
      </p>
    </>
  );
}

export function AdsView({
  rows,
  accounts,
  month,
  channelAdsRate,
  thisWeek,
}: {
  rows: AdsRow[];
  accounts: Acc[];
  month: { spend: number; adSales: number; adOrders: number; revenue: number };
  channelAdsRate: number;
  thisWeek: string;
}) {
  const acos = month.adSales > 0 ? (month.spend / month.adSales) * 100 : null;
  const share = month.revenue > 0 ? (month.spend / month.revenue) * 100 : null;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Gasto em Ads no mês" value={brl(month.spend)} hint={`${month.adOrders} venda(s) por Ads`} />
        <Stat label="Vendas por Ads no mês" value={brl(month.adSales)} />
        <Stat label="ACOS do mês" value={acos != null ? fmtPct(acos) : "—"} tone={acos != null ? (acos <= 15 ? "good" : "bad") : undefined} hint="Alvo: abaixo de 15%" />
        <Stat
          label="Ads ÷ faturamento total"
          value={share != null ? fmtPct(share) : "—"}
          tone={share != null ? (share <= 10 ? "good" : "bad") : undefined}
          hint="Alvo: 5% a 10%"
        />
      </div>

      {channelAdsRate > 0 && (
        <p className="rounded-lg bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          O canal principal ainda estima {fmtPct(channelAdsRate)} de Ads em cada venda. Lançando o gasto real aqui, zere esse percentual em Configurações → Canais
          para não contar o Ads duas vezes.
        </p>
      )}

      {rows.length === 0 ? (
        <Empty>Nenhum produto em teste, aprovado ou campeão. Mova produtos no Funil para acompanhar o Ads.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {rows.map((r) => {
            const total = r.weeks.reduce((a, w) => a + w.spend, 0);
            const orders = r.weeks.reduce((a, w) => a + w.adOrders, 0);
            return (
              <Card key={r.id}>
                <CardContent className="grid gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.sku} · {r.price ? brl(r.price) : "sem preço"} · ACOS de empate{" "}
                        <b className="text-foreground">{r.breakEven != null ? fmtPct(r.breakEven) : "—"}</b>
                      </p>
                    </div>
                    <FormDialog
                      title={`Ads da semana · ${r.name}`}
                      onSubmit={(fd) =>
                        api("/api/ads", "POST", {
                          productId: r.id,
                          weekStart: fd.get("weekStart"),
                          spend: fd.get("spend"),
                          adSales: fd.get("adSales"),
                          adOrders: fd.get("adOrders"),
                          impressions: fd.get("impressions"),
                          clicks: fd.get("clicks"),
                          accountId: fd.get("accountId"),
                          createEntry: fd.get("createEntry") === "on",
                        })
                      }
                      trigger={
                        <Button size="sm" variant="outline">
                          <Plus /> Semana
                        </Button>
                      }
                    >
                      <WeekForm row={r} accounts={accounts} thisWeek={thisWeek} />
                    </FormDialog>
                  </div>

                  <div className={cn("rounded-md border px-3 py-2 text-sm", toneCls[r.advice.tone])}>
                    <p className="font-semibold">{r.advice.title}</p>
                    <p className="text-xs">{r.advice.detail}</p>
                  </div>

                  {r.weeks.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-left text-muted-foreground">
                          <tr>
                            <th className="py-1 pr-2">Semana</th>
                            <th className="py-1 pr-2 text-right">Gasto</th>
                            <th className="py-1 pr-2 text-right">Vendas Ads</th>
                            <th className="py-1 pr-2 text-right">ACOS</th>
                            <th className="w-6" />
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {[...r.weeks].reverse().map((w) => {
                            const a = acosOf(w);
                            return (
                              <tr key={w.id}>
                                <td className="py-1 pr-2">{fmtDate(w.weekStart).slice(0, 5)}</td>
                                <td className="py-1 pr-2 text-right">{brl(w.spend)}</td>
                                <td className="py-1 pr-2 text-right">
                                  {brl(w.adSales)} <span className="text-muted-foreground">({w.adOrders})</span>
                                </td>
                                <td className="py-1 pr-2 text-right">
                                  {a == null ? (
                                    "—"
                                  ) : (
                                    <Badge tone={r.breakEven != null && a > r.breakEven ? "danger" : a > 20 ? "warning" : a < 10 ? "success" : "muted"}>{fmtPct(a)}</Badge>
                                  )}
                                </td>
                                <td>
                                  <ActionButton
                                    variant="ghost"
                                    size="icon"
                                    className="size-6"
                                    aria-label="Excluir semana"
                                    confirm="Excluir esta semana (e a saída no Caixa)?"
                                    action={() => api(`/api/ads/${w.id}`, "DELETE")}
                                  >
                                    <Trash2 className="size-3.5 text-muted-foreground" />
                                  </ActionButton>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {orders === 0 && total > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {brl(total)} de {brl(ADS_LOSS_LIMIT)} do limite de perda sem vendas.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
