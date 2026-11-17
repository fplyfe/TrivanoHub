import { test } from "node:test";
import assert from "node:assert/strict";
import { commissionFor, computeProfit, fixedFeeFor, idealPrice, ML_FEE_TIERS, simplesEffectiveRate, unitCharges, type ChannelRates } from "./pricing";

test("exemplo da especificação: R$ 120 no Premium dá R$ 30,80 de lucro", () => {
  const r = computeProfit({
    price: 120,
    qty: 1,
    cost: 40,
    packaging: 2,
    shipping: 22,
    commissionRate: 17,
    fixedFee: 0,
    adsRate: 0,
    taxRate: 4,
  });
  assert.equal(r.commission, 20.4);
  assert.equal(r.tax, 4.8);
  assert.equal(r.profit, 30.8);
  assert.equal(r.margin, 25.67);
});

test("Simples Nacional: RBT12 de R$ 500 mil dá 6,728%", () => {
  assert.deepEqual(simplesEffectiveRate(500_000), { rate: 6.728, bracket: 3 });
  assert.equal(simplesEffectiveRate(100_000).rate, 4);
});

const legacy: ChannelRates = { commissionClassic: 12, commissionPremium: 17, fixedFee: 6.5, fixedFeeThreshold: 79, adsRate: 0, feeTiers: null, feeOwnShippingOnly: false };
const ml: ChannelRates = { ...legacy, fixedFee: 0, feeTiers: ML_FEE_TIERS, feeOwnShippingOnly: true };

test("preço ideal entrega a margem pedida", () => {
  const price = idealPrice({ ch: legacy, commissionRate: 17, mode: "PROPRIO", cost: 40, packaging: 2, shipping: 22, taxRate: 4, margin: 20 })!;
  const r = computeProfit({ price, qty: 1, cost: 40, packaging: 2, shipping: 22, commissionRate: 17, fixedFee: price < 79 ? 6.5 : 0, adsRate: 0, taxRate: 4 });
  assert.ok(Math.abs(r.margin - 20) < 0.1, `margem ${r.margin}`);
});

test("margem impossível devolve null", () => {
  assert.equal(idealPrice({ ch: { ...legacy, fixedFee: 0 }, commissionRate: 17, mode: "PROPRIO", cost: 10, packaging: 0, shipping: 0, taxRate: 4, margin: 80 }), null);
});

test("Mercado Livre: tarifa por unidade só no envio próprio/Flex, por faixa", () => {
  assert.equal(fixedFeeFor(ml, 15, "PROPRIO"), 6.25);
  assert.equal(fixedFeeFor(ml, 19, "PROPRIO"), 6.65);
  assert.equal(fixedFeeFor(ml, 48.99, "PROPRIO"), 6.65);
  assert.equal(fixedFeeFor(ml, 49, "PROPRIO"), 7.75);
  assert.equal(fixedFeeFor(ml, 79, "PROPRIO"), 0);
  assert.equal(fixedFeeFor(ml, 40, "MERCADO_ENVIOS"), 0);
  assert.equal(fixedFeeFor({ ...ml, feeTiers: [{ below: 12.5, fee: 0, half: true }, ...ML_FEE_TIERS] }, 10, "PROPRIO"), 5);
  assert.equal(fixedFeeFor(legacy, 40, "MERCADO_ENVIOS"), 6.5); // outros canais não mudam
});

test("comissão da categoria do produto substitui a do canal", () => {
  const prod = { shipping: 8.15, shippingOwn: 3, shipMode: "MERCADO_ENVIOS" as const, commissionClassic: 11, commissionPremium: null };
  assert.equal(commissionFor(ml, "CLASSICO", prod), 11);
  assert.equal(commissionFor(ml, "PREMIUM", prod), 17);
  assert.deepEqual(unitCharges(ml, prod, 60, "CLASSICO"), { commissionRate: 11, fixedFee: 0, shipping: 8.15 });
  assert.deepEqual(unitCharges(ml, prod, 60, "CLASSICO", "PROPRIO"), { commissionRate: 11, fixedFee: 7.75, shipping: 3 });
});

test("preço ideal com faixas: menor preço que atinge a margem em cada forma de envio", () => {
  for (const mode of ["PROPRIO", "MERCADO_ENVIOS"] as const) {
    for (const cost of [5, 12, 20, 30, 45, 60]) {
      const price = idealPrice({ ch: ml, commissionRate: 12, mode, cost, packaging: 1, shipping: 6.85, taxRate: 4, margin: 15 })!;
      const at = (p: number) => computeProfit({ price: p, qty: 1, cost, packaging: 1, shipping: 6.85, commissionRate: 12, fixedFee: fixedFeeFor(ml, p, mode), adsRate: 0, taxRate: 4 });
      const exact = (p: number) => p * (1 - 0.31) - (cost + 1 + 6.85) - fixedFeeFor(ml, p, mode); // lucro acima da margem
      assert.ok(at(price).margin >= 14.98, `${mode} custo ${cost}: margem ${at(price).margin} em ${price}`);
      // nenhum preço menor (em passos de R$ 0,01) atinge a margem
      for (let p = Math.max(0.01, price - 15); p < price - 0.001; p = Math.round((p + 0.01) * 100) / 100)
        assert.ok(exact(p) < -1e-9, `${mode} custo ${cost}: ${p} já atingia a margem`);
    }
  }
});
