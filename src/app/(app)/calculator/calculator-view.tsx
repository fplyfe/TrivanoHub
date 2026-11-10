"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { Row } from "@/components/app/stat";
import { commissionFor, computeProfit, fixedFeeFor, idealPrice, type ChannelRates } from "@/lib/pricing";
import { brl, fmtPct } from "@/lib/utils";

type Channel = ChannelRates & { id: string; name: string };
type Product = { id: string; name: string; sku: string; cost: number; packaging: number; shipping: number; price: number };

const num = (s: string) => Number(String(s).replace(",", ".")) || 0;

export function CalculatorView({ channels, products, taxRate, minMargin }: { channels: Channel[]; products: Product[]; taxRate: number; minMargin: number }) {
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [f, setF] = useState({ price: "120", cost: "40", packaging: "2", shipping: "22", tax: String(taxRate), margin: "20" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const ch = channels.find((c) => c.id === channelId);

  if (!ch) return <p className="text-sm text-muted-foreground">Cadastre um canal de venda em Configurações.</p>;

  const price = num(f.price);
  const results = (["CLASSICO", "PREMIUM"] as const).map((listing) => {
    const r = computeProfit({
      price,
      qty: 1,
      cost: num(f.cost),
      packaging: num(f.packaging),
      shipping: num(f.shipping),
      commissionRate: commissionFor(ch, listing),
      fixedFee: fixedFeeFor(ch, price),
      adsRate: ch.adsRate,
      taxRate: num(f.tax),
    });
    const ideal = idealPrice({
      ch,
      listing,
      cost: num(f.cost),
      packaging: num(f.packaging),
      shipping: num(f.shipping),
      taxRate: num(f.tax),
      margin: num(f.margin),
    });
    return { listing, r, ideal, rate: commissionFor(ch, listing) };
  });

  const nearThreshold = ch.fixedFee > 0 && price < ch.fixedFeeThreshold && price >= ch.fixedFeeThreshold * 0.9;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Dados do produto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {products.length > 0 && (
            <Field label="Preencher com um produto (opcional)">
              <Select
                defaultValue=""
                onChange={(e) => {
                  const p = products.find((x) => x.id === e.target.value);
                  if (p) setF({ ...f, price: String(p.price || f.price), cost: String(p.cost), packaging: String(p.packaging), shipping: String(p.shipping) });
                }}
              >
                <option value="">—</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Canal">
            <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço de venda (R$)">
              <Input type="number" step="0.01" value={f.price} onChange={set("price")} />
            </Field>
            <Field label="Custo do produto (R$)">
              <Input type="number" step="0.01" value={f.cost} onChange={set("cost")} />
            </Field>
            <Field label="Embalagem (R$)">
              <Input type="number" step="0.01" value={f.packaging} onChange={set("packaging")} />
            </Field>
            <Field label="Frete pago pela loja (R$)">
              <Input type="number" step="0.01" value={f.shipping} onChange={set("shipping")} />
            </Field>
            <Field label="Imposto (%)">
              <Input type="number" step="0.01" value={f.tax} onChange={set("tax")} />
            </Field>
            <Field label="Margem desejada (%)">
              <Input type="number" step="0.1" value={f.margin} onChange={set("margin")} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            {ch.name}: Clássico {fmtPct(ch.commissionClassic)}, Premium {fmtPct(ch.commissionPremium)}
            {ch.fixedFee > 0 && `, tarifa de ${brl(ch.fixedFee)} por unidade abaixo de ${brl(ch.fixedFeeThreshold)}`}
            {ch.adsRate > 0 && `, anúncios ${fmtPct(ch.adsRate)}`}. Ajuste em Configurações.
          </p>
        </CardContent>
      </Card>

      {results.map(({ listing, r, ideal, rate }) => (
        <Card key={listing}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {listing === "PREMIUM" ? "Premium" : "Clássico"}
              <Badge tone={r.margin < 0 ? "danger" : r.margin < minMargin ? "warning" : "success"}>margem {fmtPct(r.margin)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Preço de venda" value={brl(r.gross)} />
            <Row label={`Comissão (${fmtPct(rate)})`} value={`− ${brl(r.commission)}`} />
            {r.fixedFee > 0 && <Row label="Tarifa por unidade" value={`− ${brl(r.fixedFee)}`} />}
            <Row label="Frete" value={`− ${brl(r.shipping)}`} />
            {r.ads > 0 && <Row label="Anúncios" value={`− ${brl(r.ads)}`} />}
            <Row label="Imposto" value={`− ${brl(r.tax)}`} />
            <Row label="Custo do produto" value={`− ${brl(r.cost)}`} />
            <Row label="Embalagem" value={`− ${brl(r.packaging)}`} />
            <Row label="Você recebe do canal" value={brl(r.net)} />
            <Row label="Lucro líquido" value={brl(r.profit)} strong tone={r.profit >= 0 ? "good" : "bad"} />
            <div className="mt-3 rounded-lg bg-secondary/60 p-3 text-sm">
              {ideal ? (
                <>
                  Para <b>{fmtPct(num(f.margin))}</b> de margem, venda por no mínimo <b className="text-primary">{brl(ideal)}</b>.
                </>
              ) : (
                <>Margem de {fmtPct(num(f.margin))} é impossível com estas tarifas.</>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {nearThreshold && (
        <p className="rounded-lg bg-amber-500/10 px-4 py-2 text-sm text-amber-700 lg:col-span-3 dark:text-amber-400">
          O preço está logo abaixo de {brl(ch.fixedFeeThreshold)}: subindo até esse valor, a tarifa de {brl(ch.fixedFee)} por unidade deixa de ser cobrada.
        </p>
      )}
    </div>
  );
}
