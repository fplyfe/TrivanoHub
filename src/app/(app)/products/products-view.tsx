"use client";

import { useState } from "react";
import { ArrowDownToLine, ClipboardCheck, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, Empty } from "@/components/ui/misc";
import { DeleteButton, FormDialog } from "@/components/app/form-dialog";
import { api } from "@/lib/client";
import { today } from "@/lib/dates";
import { computeProfit, fixedFeeFor, type ChannelRates } from "@/lib/pricing";
import { brl, cn, fmtDate, fmtPct } from "@/lib/utils";

type Move = { id: string; type: "IN" | "OUT" | "ADJUST"; qty: number; note: string | null; date: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  cost: number;
  packaging: number;
  shipping: number;
  price: number;
  stock: number;
  minStock: number;
  supplierId: string | null;
  active: boolean;
  weightG: number | null;
  needsCert: boolean;
  researchNotes: string | null;
  supplier: { name: string } | null;
  moves: Move[];
};
type Opt = { id: string; name: string };

const productBody = (fd: FormData) => ({
  sku: fd.get("sku"),
  name: fd.get("name"),
  cost: fd.get("cost"),
  packaging: fd.get("packaging"),
  shipping: fd.get("shipping"),
  price: fd.get("price"),
  minStock: fd.get("minStock"),
  supplierId: fd.get("supplierId"),
  active: fd.get("active") !== null ? fd.get("active") === "on" : true,
  weightG: fd.get("weightG"),
  needsCert: fd.get("needsCert") === "on",
  researchNotes: fd.get("researchNotes"),
});

function ProductForm({ p, suppliers }: { p?: Product; suppliers: Opt[] }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Field label="SKU" className="col-span-1">
          <Input name="sku" defaultValue={p?.sku} required maxLength={40} autoFocus={!p} />
        </Field>
        <Field label="Nome" className="col-span-2">
          <Input name="name" defaultValue={p?.name} required maxLength={120} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Custo unitário (R$)">
          <Input name="cost" type="number" step="0.01" min="0" defaultValue={p?.cost ?? ""} required />
        </Field>
        <Field label="Preço de venda (R$)">
          <Input name="price" type="number" step="0.01" min="0" defaultValue={p?.price ?? ""} />
        </Field>
        <Field label="Embalagem por unidade (R$)">
          <Input name="packaging" type="number" step="0.01" min="0" defaultValue={p?.packaging ?? 0} />
        </Field>
        <Field label="Frete médio pago pela loja (R$)">
          <Input name="shipping" type="number" step="0.01" min="0" defaultValue={p?.shipping ?? 0} />
        </Field>
        <Field label="Estoque mínimo">
          <Input name="minStock" type="number" min="0" defaultValue={p?.minStock ?? 0} />
        </Field>
        <Field label="Peso com embalagem (g)">
          <Input name="weightG" type="number" min="0" defaultValue={p?.weightG ?? ""} />
        </Field>
        <Field label="Fornecedor">
          <Select name="supplierId" defaultValue={p?.supplierId ?? ""}>
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="needsCert" defaultChecked={p?.needsCert ?? false} /> Exige certificação ou é marca de terceiros
      </label>
      <input type="hidden" name="researchNotes" defaultValue={p?.researchNotes ?? ""} />
      {p && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={p.active} /> Produto ativo
        </label>
      )}
      {!p && <p className="text-xs text-muted-foreground">O estoque começa em zero. Use &quot;Entrada&quot; para registrar a mercadoria.</p>}
    </>
  );
}

export function ProductsView({
  products,
  suppliers,
  accounts,
  channel,
  taxRate,
}: {
  products: Product[];
  suppliers: Opt[];
  accounts: Opt[];
  channel: (ChannelRates & { name: string }) | null;
  taxRate: number;
}) {
  const [q, setQ] = useState("");
  const list = products.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(q.toLowerCase()));
  const stockValue = products.reduce((a, p) => a + Math.max(0, p.stock) * p.cost, 0);

  const margin = (p: Product) => {
    if (!channel || !p.price) return null;
    return computeProfit({
      price: p.price,
      qty: 1,
      cost: p.cost,
      packaging: p.packaging,
      shipping: p.shipping,
      commissionRate: channel.commissionClassic,
      fixedFee: fixedFeeFor(channel, p.price),
      adsRate: channel.adsRate,
      taxRate,
    });
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-48 flex-1 sm:w-auto">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou SKU…" className="pl-9" />
        </div>
        <FormDialog
          title="Novo produto"
          onSubmit={(fd) => api("/api/products", "POST", productBody(fd))}
          trigger={
            <Button>
              <Plus /> Novo produto
            </Button>
          }
        >
          <ProductForm suppliers={suppliers} />
        </FormDialog>
      </div>

      <p className="text-sm text-muted-foreground">
        {products.filter((p) => p.active).length} produtos ativos · valor em estoque (a custo) <b className="text-foreground">{brl(stockValue)}</b>
        {channel && <> · margem estimada no {channel.name} Clássico</>}
      </p>

      {list.length === 0 ? (
        <Empty>{products.length ? "Nenhum produto encontrado." : "Nenhum produto cadastrado."}</Empty>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Produto</th>
                  <th className="p-3 text-right">Estoque</th>
                  <th className="hidden p-3 text-right sm:table-cell">Custo</th>
                  <th className="hidden p-3 text-right md:table-cell">Preço</th>
                  <th className="p-3 text-right">Margem est.</th>
                  <th className="w-32 p-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.map((p) => {
                  const m = margin(p);
                  return (
                    <tr key={p.id} className={cn("hover:bg-muted/30", !p.active && "opacity-50")}>
                      <td className="p-3">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.sku}
                          {p.supplier && ` · ${p.supplier.name}`}
                          {p.moves[0] && ` · últ. mov. ${fmtDate(p.moves[0].date)}`}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <Badge tone={p.stock <= 0 ? "danger" : p.stock <= p.minStock ? "warning" : "muted"}>{p.stock} un.</Badge>
                      </td>
                      <td className="hidden whitespace-nowrap p-3 text-right sm:table-cell">{brl(p.cost)}</td>
                      <td className="hidden whitespace-nowrap p-3 text-right md:table-cell">{p.price ? brl(p.price) : "—"}</td>
                      <td className="whitespace-nowrap p-3 text-right">
                        {m ? (
                          <span className={m.margin < 0 ? "text-destructive" : m.margin < 10 ? "text-amber-600" : "text-success"}>
                            {fmtPct(m.margin)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end">
                          <FormDialog
                            title={`Entrada · ${p.name}`}
                            description="Recalcula o custo médio do produto."
                            onSubmit={(fd) =>
                              api(`/api/products/${p.id}/stock`, "POST", {
                                type: "IN",
                                qty: fd.get("qty"),
                                unitCost: fd.get("unitCost"),
                                date: fd.get("date"),
                                note: fd.get("note"),
                                createExpense: fd.get("createExpense") === "on",
                                accountId: fd.get("accountId"),
                              })
                            }
                            trigger={
                              <Button variant="ghost" size="icon" title="Entrada de mercadoria" aria-label="Entrada">
                                <ArrowDownToLine />
                              </Button>
                            }
                          >
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Quantidade">
                                <Input name="qty" type="number" min="1" required autoFocus />
                              </Field>
                              <Field label="Custo unitário (R$)">
                                <Input name="unitCost" type="number" step="0.01" min="0" defaultValue={p.cost || ""} required />
                              </Field>
                              <Field label="Data">
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
                            <Field label="Observação">
                              <Input name="note" maxLength={200} />
                            </Field>
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" name="createExpense" defaultChecked /> Lançar como conta a pagar no Caixa
                            </label>
                          </FormDialog>
                          <FormDialog
                            title={`Inventário · ${p.name}`}
                            description="Informe a quantidade contada; o sistema registra a diferença."
                            onSubmit={(fd) =>
                              api(`/api/products/${p.id}/stock`, "POST", { type: "ADJUST", qty: fd.get("qty"), date: fd.get("date"), note: fd.get("note") })
                            }
                            trigger={
                              <Button variant="ghost" size="icon" title="Ajustar estoque" aria-label="Ajustar estoque">
                                <ClipboardCheck />
                              </Button>
                            }
                          >
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Quantidade contada">
                                <Input name="qty" type="number" min="0" defaultValue={p.stock} required />
                              </Field>
                              <Field label="Data">
                                <Input name="date" type="date" defaultValue={today()} required />
                              </Field>
                            </div>
                            <Field label="Motivo">
                              <Input name="note" placeholder="Ex.: avaria, contagem" maxLength={200} />
                            </Field>
                          </FormDialog>
                          <FormDialog
                            title={`Editar · ${p.name}`}
                            onSubmit={(fd) => api(`/api/products/${p.id}`, "PUT", productBody(fd))}
                            trigger={
                              <Button variant="ghost" size="icon" title="Editar" aria-label="Editar">
                                <Pencil />
                              </Button>
                            }
                          >
                            <ProductForm p={p} suppliers={suppliers} />
                          </FormDialog>
                          <DeleteButton
                            confirm={`Excluir ${p.name}? Produtos com vendas não podem ser excluídos (desative-os).`}
                            action={() => api(`/api/products/${p.id}`, "DELETE")}
                          />
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
