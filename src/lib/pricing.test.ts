import { test } from "node:test";
import assert from "node:assert/strict";
import { computeProfit, idealPrice, simplesEffectiveRate } from "./pricing";

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

test("preço ideal entrega a margem pedida", () => {
  const ch = { commissionClassic: 12, commissionPremium: 17, fixedFee: 6.5, fixedFeeThreshold: 79, adsRate: 0 };
  const price = idealPrice({ ch, listing: "PREMIUM", cost: 40, packaging: 2, shipping: 22, taxRate: 4, margin: 20 })!;
  const r = computeProfit({ price, qty: 1, cost: 40, packaging: 2, shipping: 22, commissionRate: 17, fixedFee: price < 79 ? 6.5 : 0, adsRate: 0, taxRate: 4 });
  assert.ok(Math.abs(r.margin - 20) < 0.1, `margem ${r.margin}`);
});

test("margem impossível devolve null", () => {
  const ch = { commissionClassic: 12, commissionPremium: 17, fixedFee: 0, fixedFeeThreshold: 79, adsRate: 0 };
  assert.equal(idealPrice({ ch, listing: "PREMIUM", cost: 10, packaging: 0, shipping: 0, taxRate: 4, margin: 80 }), null);
});
