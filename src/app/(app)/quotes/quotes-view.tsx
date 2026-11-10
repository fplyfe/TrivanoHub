"use client";

import { Ban, Check, Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, Empty } from "@/components/ui/misc";
import { ActionButton, DeleteButton, FormDialog } from "@/components/app/form-dialog";
import { api } from "@/lib/client";
import { today } from "@/lib/dates";
import { computeProfit, fixedFeeFor, type ChannelRates } from "@/lib/pricing";
import { brl, cn, fmtDate, fmtPct, QUOTE_LABEL } from "@/lib/utils";

type Offer = {
  id: string;
  supplierId: string;
  unitPrice: number;
  freight: number;
  leadDays: number | null;
  terms: string | null;
  chosen: boolean;
  supplier: { name: string };
};
type Quote = {
  id: string;
  qty: number;
  status: "OPEN" | "APPROVED" | "CANCELED";
  note: string | null;
  createdAt: string;
  product: { name: string; sku: string; price: number; packaging: number; shipping: number; cost: number };
  offers: Offer[];
};
type Opt = { id: string; name: string };

export function QuotesView({
  quotes,
  products,
  suppliers,
  accounts,
  channel,
  taxRate,
}: {
  quotes: Quote[];
  products: (Opt & { sku: string })[];
  suppliers: Opt[];
  accounts: Opt[];
  channel: (ChannelRates & { name: string }) | null;
  taxRate: number;
}) {
  const unitFinal = (q: Quote, o: Offer) => o.unitPrice + o.freight / q.qty;
  const profitAt = (q: Quote, cost: number) => {
    if (!channel || !q.product.price) return null;
    return computeProfit({
      price: q.product.price,
      qty: 1,
      cost,
      packaging: q.product.packaging,
      shipping: q.product.shipping,
      commissionRate: channel.commissionClassic,
      fixedFee: fixedFeeFor(channel, q.product.price),
      adsRate: channel.adsRate,
      taxRate,
    });
  };

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cadastre um produto para cotar.</p>
        ) : (
          <FormDialog
            title="Nova cotação"
            onSubmit={(fd) => api("/api/quotes", "POST", { productId: fd.get("productId"), qty: fd.get("qty"), note: fd.get("note") })}
            trigger={
              <Button>
                <Plus /> Nova cotação
              </Button>
            }
          >
            <Field label="Produto">
              <Select name="productId" required>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantidade">
                <Input name="qty" type="number" min="1" required />
              </Field>
              <Field label="Observação">
                <Input name="note" maxLength={200} />
              </Field>
            </div>
          </FormDialog>
        )}
      </div>

      {quotes.length === 0 ? (
        <Empty>Nenhuma cotação ainda.</Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {quotes.map((q) => {
            const best = q.offers.length ? Math.min(...q.offers.map((o) => unitFinal(q, o))) : null;
            const open = q.status === "OPEN";
            return (
              <Card key={q.id} className={cn(!open && "opacity-80")}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {q.product.name} · {q.qty} un.
                    </span>
                    <div className="flex items-center gap-1">
                      <Badge tone={q.status === "APPROVED" ? "success" : q.status === "CANCELED" ? "danger" : "primary"}>{QUOTE_LABEL[q.status]}</Badge>
                      {open && (
                        <ActionButton
                          variant="ghost"
                          size="icon"
                          title="Cancelar cotação"
                          aria-label="Cancelar cotação"
                          confirm="Cancelar esta cotação?"
                          action={() => api(`/api/quotes/${q.id}`, "PATCH")}
                        >
                          <Ban className="text-muted-foreground" />
                        </ActionButton>
                      )}
                      <DeleteButton confirm="Excluir esta cotação?" action={() => api(`/api/quotes/${q.id}`, "DELETE")} />
                    </div>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {q.product.sku} · criada em {fmtDate(q.createdAt)} · custo atual {brl(q.product.cost)}
                    {q.note && ` · ${q.note}`}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {q.offers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma proposta. Adicione as propostas dos fornecedores.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs text-muted-foreground">
                          <tr>
                            <th className="py-1.5 pr-2">Fornecedor</th>
                            <th className="py-1.5 pr-2 text-right">Unit.</th>
                            <th className="py-1.5 pr-2 text-right">Frete</th>
                            <th className="py-1.5 pr-2 text-right">Custo final/un.</th>
                            <th className="hidden py-1.5 pr-2 text-right sm:table-cell">Margem</th>
                            <th className="w-20" />
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {[...q.offers]
                            .sort((a, b) => unitFinal(q, a) - unitFinal(q, b))
                            .map((o) => {
                              const uf = unitFinal(q, o);
                              const pr = profitAt(q, uf);
                              const isBest = best !== null && uf === best;
                              return (
                                <tr key={o.id} className={cn(o.chosen && "bg-success/10")}>
                                  <td className="py-2 pr-2">
                                    <div className="flex items-center gap-1 font-medium">
                                      {isBest && <Trophy className="size-3.5 text-amber-500" />}
                                      {o.supplier.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {o.leadDays != null && `${o.leadDays} dias`}
                                      {o.terms && ` · ${o.terms}`}
                                    </div>
                                  </td>
                                  <td className="whitespace-nowrap py-2 pr-2 text-right">{brl(o.unitPrice)}</td>
                                  <td className="whitespace-nowrap py-2 pr-2 text-right">{brl(o.freight)}</td>
                                  <td className="whitespace-nowrap py-2 pr-2 text-right font-medium">{brl(uf)}</td>
                                  <td className="hidden whitespace-nowrap py-2 pr-2 text-right sm:table-cell">
                                    {pr ? <span className={pr.margin < 0 ? "text-destructive" : "text-success"}>{fmtPct(pr.margin)}</span> : "—"}
                                  </td>
                                  <td className="py-2">
                                    <div className="flex justify-end">
                                      {open && (
                                        <FormDialog
                                          title={`Aprovar ${o.supplier.name}`}
                                          description={`Entrada de ${q.qty} un. no estoque a ${brl(uf)} cada (total ${brl(o.unitPrice * q.qty + o.freight)}).`}
                                          submitLabel="Aprovar compra"
                                          onSubmit={(fd) =>
                                            api(`/api/quotes/${q.id}/approve`, "POST", {
                                              offerId: o.id,
                                              date: fd.get("date"),
                                              createExpense: fd.get("createExpense") === "on",
                                              accountId: fd.get("accountId"),
                                            })
                                          }
                                          trigger={
                                            <Button variant="ghost" size="icon" title="Aprovar esta proposta" aria-label="Aprovar">
                                              <Check className="text-success" />
                                            </Button>
                                          }
                                        >
                                          <div className="grid grid-cols-2 gap-3">
                                            <Field label="Data da compra">
                                              <Input name="date" type="date" defaultValue={today()} required />
                                            </Field>
                                            <Field label="Pagar pela conta">
                                              <Select name="accountId" defaultValue="">
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
                                            <input type="checkbox" name="createExpense" defaultChecked /> Lançar como conta a pagar no Caixa
                                          </label>
                                        </FormDialog>
                                      )}
                                      {open && <DeleteButton confirm="Excluir esta proposta?" action={() => api(`/api/offers/${o.id}`, "DELETE")} />}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {open && (
                    <FormDialog
                      title="Adicionar proposta"
                      onSubmit={(fd) =>
                        api(`/api/quotes/${q.id}/offers`, "POST", {
                          supplierId: fd.get("supplierId"),
                          unitPrice: fd.get("unitPrice"),
                          freight: fd.get("freight"),
                          leadDays: fd.get("leadDays"),
                          terms: fd.get("terms"),
                        })
                      }
                      trigger={
                        <Button variant="outline" size="sm" className="justify-self-start">
                          <Plus /> Proposta
                        </Button>
                      }
                    >
                      {suppliers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Cadastre fornecedores primeiro.</p>
                      ) : (
                        <>
                          <Field label="Fornecedor">
                            <Select name="supplierId" required>
                              {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Preço unitário (R$)">
                              <Input name="unitPrice" type="number" step="0.01" min="0.01" required />
                            </Field>
                            <Field label="Frete total (R$)">
                              <Input name="freight" type="number" step="0.01" min="0" defaultValue={0} />
                            </Field>
                            <Field label="Prazo (dias)">
                              <Input name="leadDays" type="number" min="0" />
                            </Field>
                            <Field label="Condição de pagamento">
                              <Input name="terms" placeholder="Ex.: 30 dias, PIX" maxLength={80} />
                            </Field>
                          </div>
                        </>
                      )}
                    </FormDialog>
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
