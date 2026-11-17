"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { Row } from "@/components/app/stat";
import {
  commissionFor,
  computeProfit,
  fixedFeeFor,
  idealPrice,
  shippingFor,
  type ChannelRates,
  type ProductRates,
  type ShipMode,
} from "@/lib/pricing";
import { brl, fmtPct } from "@/lib/utils";

type Channel = ChannelRates & { id: string; name: string };
type Product = ProductRates & {
  id: string;
  name: string;
  sku: string;
  cost: number;
  packaging: number;
  price: number;
};

const num = (s: string) => Number(String(s).replace(",", ".")) || 0;

/** Texto curto com as faixas de tarifa por unidade do canal. */
function feeSummary(ch: Channel) {
  if (ch.feeTiers && ch.feeTiers.length > 0) {
    let lo = 0;
    const parts = ch.feeTiers.map((t) => {
      const label = `${lo === 0 ? "até" : `${brl(lo)} a`} ${brl(t.below - 0.01)}: ${t.half ? "metade do preço" : brl(t.fee)}`;
      lo = t.below;
      return label;
    });
    return `tarifa por unidade ${ch.feeOwnShippingOnly ? "(só Flex/envio próprio) " : ""}${parts.join(" · ")}`;
  }
  return ch.fixedFee > 0
    ? `tarifa de ${brl(ch.fixedFee)} por unidade abaixo de ${brl(ch.fixedFeeThreshold)}`
    : "";
}

export function CalculatorView({
  channels,
  products,
  taxRate,
  minMargin,
}: {
  channels: Channel[];
  products: Product[];
  taxRate: number;
  minMargin: number;
}) {
  const [channelId, setChannelId] = useState(
    (channels.find((c) => c.feeOwnShippingOnly) ?? channels[0])?.id ?? "",
  );
  const [mode, setMode] = useState<ShipMode>("MERCADO_ENVIOS");
  const [productId, setProductId] = useState("");
  const ch0 = channels.find((c) => c.id === channelId);
  const [f, setF] = useState({
    price: "120",
    cost: "40",
    packaging: "2",
    shipping: "22",
    tax: String(taxRate),
    margin: "20",
    cClassic: String(ch0?.commissionClassic ?? 12),
    cPremium: String(ch0?.commissionPremium ?? 17),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });
  const ch = ch0;
  const product = products.find((p) => p.id === productId);

  if (!ch)
    return (
      <p className="text-sm text-muted-foreground">
        Cadastre um canal de venda em Configurações.
      </p>
    );

  const fillFrom = (p: Product | undefined, c: Channel, m: ShipMode) =>
    setF((cur) => ({
      ...cur,
      ...(p
        ? {
            price: String(p.price || cur.price),
            cost: String(p.cost),
            packaging: String(p.packaging),
            shipping: String(shippingFor(p, m)),
          }
        : {}),
      cClassic: String(commissionFor(c, "CLASSICO", p)),
      cPremium: String(commissionFor(c, "PREMIUM", p)),
    }));

  const price = num(f.price);
  const fee = fixedFeeFor(ch, price, mode);
  const results = (["CLASSICO", "PREMIUM"] as const).map((listing) => {
    const rate = num(listing === "PREMIUM" ? f.cPremium : f.cClassic);
    const r = computeProfit({
      price,
      qty: 1,
      cost: num(f.cost),
      packaging: num(f.packaging),
      shipping: num(f.shipping),
      commissionRate: rate,
      fixedFee: fee,
      adsRate: ch.adsRate,
      taxRate: num(f.tax),
    });
    const ideal = idealPrice({
      ch,
      commissionRate: rate,
      mode,
      cost: num(f.cost),
      packaging: num(f.packaging),
      shipping: num(f.shipping),
      taxRate: num(f.tax),
      margin: num(f.margin),
    });
    return { listing, r, ideal, rate };
  });

  // Subindo um pouco o preço, a tarifa por unidade cai ou some?
  const cuts = ch.feeTiers?.length
    ? ch.feeTiers.map((t) => t.below)
    : [ch.fixedFeeThreshold];
  const nextCut = cuts.find(
    (c) => c > price && price >= c * 0.9 && fixedFeeFor(ch, c, mode) < fee,
  );
  const isMl = ch.feeOwnShippingOnly;

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
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  const p = products.find((x) => x.id === e.target.value);
                  if (p) {
                    setMode(p.shipMode);
                    fillFrom(p, ch, p.shipMode);
                  }
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
          <div className="grid gap-3">
            <Field label="Canal">
              <Select
                value={channelId}
                onChange={(e) => {
                  setChannelId(e.target.value);
                  const c = channels.find((x) => x.id === e.target.value);
                  if (!c) return;
                  const m: ShipMode = c.feeOwnShippingOnly
                    ? mode
                    : "MERCADO_ENVIOS";
                  setMode(m);
                  fillFrom(product, c, m);
                }}
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            {ch.feeOwnShippingOnly && (
              <Field label="Envio">
                <Select
                  value={mode}
                  onChange={(e) => {
                    const m = e.target.value as ShipMode;
                    setMode(m);
                    if (product)
                      setF((cur) => ({
                        ...cur,
                        shipping: String(shippingFor(product, m)),
                      }));
                  }}
                >
                  <option value="MERCADO_ENVIOS">
                    Full / Coleta / Agência
                  </option>
                  <option value="PROPRIO">Flex / envio próprio</option>
                </Select>
              </Field>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço de venda (R$)">
              <Input
                type="number"
                step="0.01"
                value={f.price}
                onChange={set("price")}
              />
            </Field>
            <Field label="Custo do produto (R$)">
              <Input
                type="number"
                step="0.01"
                value={f.cost}
                onChange={set("cost")}
              />
            </Field>
            <Field label="Embalagem (R$)">
              <Input
                type="number"
                step="0.01"
                value={f.packaging}
                onChange={set("packaging")}
              />
            </Field>
            <Field
              label={
                !ch.feeOwnShippingOnly
                  ? "Frete pago pela loja (R$)"
                  : mode === "MERCADO_ENVIOS"
                    ? "Custo de envio ML (R$)"
                    : "Entrega própria/Flex (R$)"
              }
            >
              <Input
                type="number"
                step="0.01"
                value={f.shipping}
                onChange={set("shipping")}
              />
            </Field>
            <Field label="Comissão Clássico (%)">
              <Input
                type="number"
                step="0.01"
                value={f.cClassic}
                onChange={set("cClassic")}
              />
            </Field>
            <Field label="Comissão Premium (%)">
              <Input
                type="number"
                step="0.01"
                value={f.cPremium}
                onChange={set("cPremium")}
              />
            </Field>
            <Field label="Imposto (%)">
              <Input
                type="number"
                step="0.01"
                value={f.tax}
                onChange={set("tax")}
              />
            </Field>
            <Field label="Margem desejada (%)">
              <Input
                type="number"
                step="0.1"
                value={f.margin}
                onChange={set("margin")}
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            {ch.name}: Clássico {fmtPct(ch.commissionClassic)}, Premium{" "}
            {fmtPct(ch.commissionPremium)} (padrão do canal)
            {feeSummary(ch) && `, ${feeSummary(ch)}`}
            {ch.adsRate > 0 && `, anúncios ${fmtPct(ch.adsRate)}`}. Ajuste em
            Configurações.
          </p>
          {isMl && mode === "MERCADO_ENVIOS" && (
            <p className="rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
              No Full, Coleta e Agência não há tarifa por unidade, mas toda
              venda paga o custo de envio, que muda com o peso e a faixa de
              preço. Confira o valor no simulador de custos do Mercado Livre
              para este preço.
            </p>
          )}
        </CardContent>
      </Card>

      {results.map(({ listing, r, ideal, rate }) => (
        <Card key={listing}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {listing === "PREMIUM" ? "Premium" : "Clássico"}
              <Badge
                tone={
                  r.margin < 0
                    ? "danger"
                    : r.margin < minMargin
                      ? "warning"
                      : "success"
                }
              >
                margem {fmtPct(r.margin)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Preço de venda" value={brl(r.gross)} />
            <Row
              label={`Comissão (${fmtPct(rate)})`}
              value={`− ${brl(r.commission)}`}
            />
            {r.fixedFee > 0 && (
              <Row label="Tarifa por unidade" value={`− ${brl(r.fixedFee)}`} />
            )}
            <Row
              label={
                mode === "MERCADO_ENVIOS" ? "Custo de envio" : "Entrega própria"
              }
              value={`− ${brl(r.shipping)}`}
            />
            {r.ads > 0 && <Row label="Anúncios" value={`− ${brl(r.ads)}`} />}
            <Row label="Imposto" value={`− ${brl(r.tax)}`} />
            <Row label="Custo do produto" value={`− ${brl(r.cost)}`} />
            <Row label="Embalagem" value={`− ${brl(r.packaging)}`} />
            <Row label="Você recebe do canal" value={brl(r.net)} />
            <Row
              label="Lucro líquido"
              value={brl(r.profit)}
              strong
              tone={r.profit >= 0 ? "good" : "bad"}
            />
            <div className="mt-3 rounded-lg bg-secondary/60 p-3 text-sm">
              {ideal ? (
                <>
                  Para <b>{fmtPct(num(f.margin))}</b> de margem, venda por no
                  mínimo <b className="text-primary">{brl(ideal)}</b>
                  {mode === "MERCADO_ENVIOS" &&
                    isMl &&
                    " (com o mesmo custo de envio)"}
                  .
                </>
              ) : (
                <>
                  Margem de {fmtPct(num(f.margin))} é impossível com estas
                  tarifas.
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {nextCut != null && (
        <p className="rounded-lg bg-amber-500/10 px-4 py-2 text-sm text-amber-700 lg:col-span-3 dark:text-amber-400">
          O preço está logo abaixo de {brl(nextCut)}: subindo até esse valor, a
          tarifa por unidade cai de {brl(fee)} para{" "}
          {brl(fixedFeeFor(ch, nextCut, mode))}.
        </p>
      )}
    </div>
  );
}
