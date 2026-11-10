import { test } from "node:test";
import assert from "node:assert/strict";
import { adsAdvice, idealProductChecks, mondayOf, testAdvice } from "./growth";

test("Ads: R$ 150 sem venda manda pausar", () => {
  const a = adsAdvice([{ spend: 80, adSales: 0, adOrders: 0 }, { spend: 75, adSales: 0, adOrders: 0 }], 24);
  assert.equal(a.title, "Pausar e revisar o anúncio");
});

test("Ads: ACOS acima do empate manda pausar", () => {
  assert.equal(adsAdvice([{ spend: 30, adSales: 100, adOrders: 1 }], 24).title, "Pausar e revisar");
});

test("Ads: ACOS abaixo de 10% manda aumentar", () => {
  assert.equal(adsAdvice([{ spend: 8, adSales: 100, adOrders: 2 }], 24).tone, "good");
});

test("Ads: acima de 20% por 2 semanas manda baixar o lance", () => {
  const a = adsAdvice([{ spend: 22, adSales: 100, adOrders: 1 }, { spend: 23, adSales: 100, adOrders: 1 }], 30);
  assert.equal(a.title, "Baixar lance ou orçamento");
});

test("Ads: muitas impressões e poucos cliques aponta a foto", () => {
  const a = adsAdvice([{ spend: 20, adSales: 0, adOrders: 0, impressions: 5000, clicks: 10 }], 24);
  assert.equal(a.title, "Poucos cliques");
});

test("Teste: 1 venda/dia com margem 15% aprova", () => {
  const a = testAdvice({ days: 14, orders30: 16, ordersTest: 16, margin: 18, adSpend: 100, adOrders: 6 });
  assert.equal(a.suggest, "APPROVED");
});

test("Teste: menos de 10 vendas em 30 dias = parado", () => {
  const a = testAdvice({ days: 35, orders30: 6, ordersTest: 7, margin: 20, adSpend: 90, adOrders: 2 });
  assert.equal(a.suggest, "PAUSED");
});

test("Filtro do produto ideal", () => {
  const c = idealProductChecks({ price: 109.9, cost: 40, weightG: 600, needsCert: false, margin: 16 });
  assert.ok(c.every((x) => x.ok));
});

test("Segunda-feira da semana", () => {
  assert.equal(mondayOf("2026-11-09"), "2026-11-09"); // segunda
  assert.equal(mondayOf("2026-11-15"), "2026-11-09"); // domingo
});
