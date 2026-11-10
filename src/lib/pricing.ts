// Cálculo de lucro, preço ideal e imposto. Funções puras: servem no servidor e no navegador.

export type ChannelRates = {
  commissionClassic: number; // %
  commissionPremium: number; // %
  fixedFee: number; // R$ por unidade abaixo do limite
  fixedFeeThreshold: number; // R$
  adsRate: number; // %
};

export type ProfitInput = {
  price: number; // preço unitário
  qty: number;
  cost: number; // custo unitário do produto
  packaging: number; // embalagem por unidade
  shipping: number; // frete pago pelo vendedor por unidade
  commissionRate: number; // %
  fixedFee: number; // tarifa por unidade (já decidida pela faixa de preço)
  adsRate: number; // %
  taxRate: number; // %
};

export type ProfitResult = {
  gross: number;
  commission: number;
  fixedFee: number;
  shipping: number;
  ads: number;
  tax: number;
  cost: number;
  packaging: number;
  profit: number;
  margin: number; // %
  /// O que cai na conta do marketplace (antes de imposto e custo do produto)
  net: number;
};

export const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function commissionFor(ch: ChannelRates, listing: "CLASSICO" | "PREMIUM") {
  return listing === "PREMIUM" ? ch.commissionPremium : ch.commissionClassic;
}

export function fixedFeeFor(ch: ChannelRates, price: number) {
  return price < ch.fixedFeeThreshold ? ch.fixedFee : 0;
}

export function computeProfit(i: ProfitInput): ProfitResult {
  const q = Math.max(1, i.qty);
  const gross = round2(i.price * q);
  const commission = round2(gross * (i.commissionRate / 100));
  const fixedFee = round2(i.fixedFee * q);
  const shipping = round2(i.shipping * q);
  const ads = round2(gross * (i.adsRate / 100));
  const tax = round2(gross * (i.taxRate / 100));
  const cost = round2(i.cost * q);
  const packaging = round2(i.packaging * q);
  const profit = round2(gross - commission - fixedFee - shipping - ads - tax - cost - packaging);
  const margin = gross > 0 ? round2((profit / gross) * 100) : 0;
  const net = round2(gross - commission - fixedFee - shipping);
  return { gross, commission, fixedFee, shipping, ads, tax, cost, packaging, profit, margin, net };
}

/**
 * Preço mínimo para atingir a margem desejada:
 * P = (custo + embalagem + frete + tarifa fixa) / (1 − comissão − imposto − ads − margem).
 * Como a tarifa fixa depende da faixa de preço, recalcula até estabilizar.
 */
export function idealPrice(args: {
  ch: ChannelRates;
  listing: "CLASSICO" | "PREMIUM";
  cost: number;
  packaging: number;
  shipping: number;
  taxRate: number;
  margin: number; // % desejada
}): number | null {
  const pct = (commissionFor(args.ch, args.listing) + args.taxRate + args.ch.adsRate + args.margin) / 100;
  if (pct >= 1) return null;
  const base = args.cost + args.packaging + args.shipping;
  let fee = args.ch.fixedFee; // começa supondo que cai na faixa com tarifa
  let price = 0;
  for (let i = 0; i < 5; i++) {
    price = round2((base + fee) / (1 - pct));
    const next = fixedFeeFor(args.ch, price);
    if (next === fee) break;
    fee = next;
  }
  // Se sem a tarifa o preço cai abaixo do limite, a tarifa volta: usa o limite como piso.
  if (fixedFeeFor(args.ch, price) !== fee) price = round2(Math.max(price, args.ch.fixedFeeThreshold));
  return price;
}

/** Simples Nacional, Anexo I (comércio). Limites de RBT12, alíquota nominal (%) e parcela a deduzir. */
export const SIMPLES_ANEXO_I = [
  { upTo: 180_000, rate: 4.0, deduction: 0 },
  { upTo: 360_000, rate: 7.3, deduction: 5_940 },
  { upTo: 720_000, rate: 9.5, deduction: 13_860 },
  { upTo: 1_800_000, rate: 10.7, deduction: 22_500 },
  { upTo: 3_600_000, rate: 14.3, deduction: 87_300 },
  { upTo: 4_800_000, rate: 19.0, deduction: 378_000 },
] as const;

/** Alíquota efetiva (%) a partir da receita bruta dos últimos 12 meses. */
export function simplesEffectiveRate(rbt12: number): { rate: number; bracket: number } {
  if (rbt12 <= 0) return { rate: SIMPLES_ANEXO_I[0].rate, bracket: 1 };
  const idx = SIMPLES_ANEXO_I.findIndex((b) => rbt12 <= b.upTo);
  const i = idx === -1 ? SIMPLES_ANEXO_I.length - 1 : idx;
  const b = SIMPLES_ANEXO_I[i];
  const rate = ((rbt12 * (b.rate / 100) - b.deduction) / rbt12) * 100;
  return { rate: Math.round(rate * 10000) / 10000, bracket: i + 1 };
}
