"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Ban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, Empty } from "@/components/ui/misc";
import { ActionButton, DeleteButton, FormDialog } from "@/components/app/form-dialog";
import { Row } from "@/components/app/stat";
import { api } from "@/lib/client";
import { today } from "@/lib/dates";
import { commissionFor, computeProfit, fixedFeeFor, type ChannelRates } from "@/lib/pricing";
import { brl, cn, fmtDate, fmtPct, LISTING_LABEL } from "@/lib/utils";

type Sale = {
  id: string;
  date: string;
  qty: number;
  price: number;
  gross: number;
  commission: number;
  fixedFee: number;
  shipping: number;
  ads: number;
  tax: number;
  cost: number;
  packaging: number;
  profit: number;
  listingType: "CLASSICO" | "PREMIUM";
  status: "OK" | "CANCELED";
  externalId: string | null;
  product: { name: string; sku: string };
  channel: { name: string };
};
type Product = { id: string; name: string; sku: string; cost: number; packaging: number; shipping: number; price: number; stock: number };
type Channel = ChannelRates & { id: string; name: string };

function SaleForm({ products, channels, taxRate }: { products: Product[]; channels: Channel[]; taxRate: number }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [listing, setListing] = useState<"CLASSICO" | "PREMIUM">("CLASSICO");
  const p = products.find((x) => x.id === productId);
  const [price, setPrice] = useState(p?.price ? String(p.price) : "");
  const [qty, setQty] = useState("1");
  const [shipping, setShipping] = useState("");
  const ch = channels.find((c) => c.id === channelId);

  const preview = useMemo(() => {
    if (!p || !ch || !Number(price)) return null;
    return computeProfit({
      price: Number(price),
      qty: Number(qty) || 1,
      cost: p.cost,
      packaging: p.packaging,
      shipping: shipping === "" ? p.shipping : Number(shipping),
      commissionRate: commissionFor(ch, listing),
      fixedFee: fixedFeeFor(ch, Number(price)),
      adsRate: ch.adsRate,
      taxRate,
    });
  }, [p, ch, price, qty, shipping, listing, taxRate]);

  return (
    <>
      <Field label="Produto">
        <Select
          name="productId"
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            const np = products.find((x) => x.id === e.target.value);
            if (np?.price) setPrice(String(np.price));
          }}
          required
        >
          {products.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} ({x.sku}) · {x.stock} em estoque
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Canal">
          <Select name="channelId" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo de anúncio">
          <Select name="listingType" value={listing} onChange={(e) => setListing(e.target.value as "CLASSICO" | "PREMIUM")}>
            <option value="CLASSICO">Clássico</option>
            <option value="PREMIUM">Premium</option>
          </Select>
        </Field>
        <Field label="Preço unitário (R$)">
          <Input name="price" type="number" step="0.01" min="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>
        <Field label="Quantidade">
          <Input name="qty" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} required />
        </Field>
        <Field label="Frete pago pela loja (un.)">
          <Input
            name="shipping"
            type="number"
            step="0.01"
            min="0"
            placeholder={p ? `padrão ${brl(p.shipping)}` : ""}
            value={shipping}
            onChange={(e) => setShipping(e.target.value)}
          />
        </Field>
        <Field label="Data">
          <Input name="date" type="date" defaultValue={today()} required />
        </Field>
      </div>
      <Field label="Nº do pedido no canal (opcional)">
        <Input name="externalId" maxLength={60} />
      </Field>
      {preview && (
        <div className="rounded-lg border bg-secondary/40 p-3">
          <Row label="Faturamento" value={brl(preview.gross)} />
          <Row label="Comissão + tarifa fixa" value={`− ${brl(preview.commission + preview.fixedFee)}`} />
          <Row label="Frete" value={`− ${brl(preview.shipping)}`} />
          {preview.ads > 0 && <Row label="Anúncios (estimado)" value={`− ${brl(preview.ads)}`} />}
          <Row label={`Imposto (${fmtPct(taxRate, 2)})`} value={`− ${brl(preview.tax)}`} />
          <Row label="Custo + embalagem" value={`− ${brl(preview.cost + preview.packaging)}`} />
          <Row
            label="Lucro desta venda"
            value={`${brl(preview.profit)} (${fmtPct(preview.margin)})`}
            strong
            tone={preview.profit >= 0 ? "good" : "bad"}
          />
        </div>
      )}
    </>
  );
}

export function SalesView({
  sales,
  products,
  channels,
  taxRate,
  channelFilter,
  totalStockless,
}: {
  sales: Sale[];
  products: Product[];
  channels: Channel[];
  taxRate: number;
  channelFilter: string;
  totalStockless: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const ok = sales.filter((s) => s.status === "OK");
  const gross = ok.reduce((a, s) => a + s.gross, 0);
  const profit = ok.reduce((a, s) => a + s.profit, 0);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <Select
          className="w-full sm:w-56"
          value={channelFilter}
          aria-label="Canal"
          onChange={(e) => {
            const next = new URLSearchParams(sp.toString());
            if (e.target.value) next.set("channel", e.target.value);
            else next.delete("channel");
            router.push(`${pathname}?${next.toString()}`);
          }}
        >
          <option value="">Todos os canais</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <div className="flex-1" />
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cadastre um produto antes de lançar vendas.</p>
        ) : (
          <FormDialog
            title="Nova venda"
            description="Tarifas, imposto e custo são calculados e gravados na venda."
            onSubmit={(fd) =>
              api("/api/sales", "POST", {
                date: fd.get("date"),
                channelId: fd.get("channelId"),
                productId: fd.get("productId"),
                listingType: fd.get("listingType"),
                qty: fd.get("qty"),
                price: fd.get("price"),
                shipping: fd.get("shipping"),
                externalId: fd.get("externalId"),
              })
            }
            trigger={
              <Button>
                <Plus /> Nova venda
              </Button>
            }
          >
            <SaleForm products={products} channels={channels} taxRate={taxRate} />
          </FormDialog>
        )}
      </div>

      {totalStockless > 0 && (
        <p className="rounded-lg bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          {totalStockless} produto(s) sem custo cadastrado: o lucro deles aparece maior do que é.
        </p>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          Vendas: <b className="text-foreground">{ok.length}</b>
        </span>
        <span>
          Faturamento: <b className="text-foreground">{brl(gross)}</b>
        </span>
        <span>
          Lucro das vendas: <b className={profit >= 0 ? "text-success" : "text-destructive"}>{brl(profit)}</b>
        </span>
        <span>
          Margem: <b className="text-foreground">{fmtPct(gross > 0 ? (profit / gross) * 100 : 0)}</b>
        </span>
      </div>

      {sales.length === 0 ? (
        <Empty>Nenhuma venda neste período.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Produto</th>
                  <th className="hidden p-3 md:table-cell">Canal</th>
                  <th className="p-3 text-right">Venda</th>
                  <th className="hidden p-3 text-right lg:table-cell">Tarifas + frete</th>
                  <th className="hidden p-3 text-right lg:table-cell">Imposto</th>
                  <th className="hidden p-3 text-right sm:table-cell">Custo</th>
                  <th className="p-3 text-right">Lucro</th>
                  <th className="w-20 p-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sales.map((s) => {
                  const margin = s.gross > 0 ? (s.profit / s.gross) * 100 : 0;
                  const canceled = s.status === "CANCELED";
                  return (
                    <tr key={s.id} className={cn("hover:bg-muted/30", canceled && "opacity-50")}>
                      <td className="whitespace-nowrap p-3">{fmtDate(s.date).slice(0, 5)}</td>
                      <td className="p-3">
                        <div className="font-medium">
                          {s.product.name} {s.qty > 1 && <span className="text-muted-foreground">×{s.qty}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.product.sku} · {LISTING_LABEL[s.listingType]}
                          {s.externalId && ` · #${s.externalId}`}
                          {canceled && (
                            <Badge tone="danger" className="ml-1">
                              Cancelada
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="hidden p-3 md:table-cell">{s.channel.name}</td>
                      <td className="whitespace-nowrap p-3 text-right">{brl(s.gross)}</td>
                      <td className="hidden whitespace-nowrap p-3 text-right text-muted-foreground lg:table-cell">
                        {brl(s.commission + s.fixedFee + s.shipping + s.ads)}
                      </td>
                      <td className="hidden whitespace-nowrap p-3 text-right text-muted-foreground lg:table-cell">{brl(s.tax)}</td>
                      <td className="hidden whitespace-nowrap p-3 text-right text-muted-foreground sm:table-cell">{brl(s.cost + s.packaging)}</td>
                      <td className="whitespace-nowrap p-3 text-right">
                        <div className={cn("font-medium", s.profit >= 0 ? "text-success" : "text-destructive")}>{brl(s.profit)}</div>
                        <div className="text-xs text-muted-foreground">{fmtPct(margin)}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end">
                          {!canceled && (
                            <ActionButton
                              variant="ghost"
                              size="icon"
                              title="Cancelar venda"
                              aria-label="Cancelar venda"
                              confirm="Cancelar esta venda? O estoque volta e o valor a receber é removido."
                              action={() => api(`/api/sales/${s.id}`, "PATCH")}
                            >
                              <Ban className="text-muted-foreground" />
                            </ActionButton>
                          )}
                          <DeleteButton confirm="Excluir esta venda definitivamente?" action={() => api(`/api/sales/${s.id}`, "DELETE")} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
