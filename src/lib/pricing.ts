// Cálculo de lucro, preço ideal e imposto. Funções puras: servem no servidor e no navegador.

/** Forma de envio: Mercado Envios (Full, Coleta, Agência) ou entrega própria (Flex, Correios por conta). */
export type ShipMode = "MERCADO_ENVIOS" | "PROPRIO";
export const SHIP_MODE_LABEL: Record<ShipMode, string> = {
  MERCADO_ENVIOS: "Full / Coleta / Agência",
  PROPRIO: "Flex / envio próprio",
};

/** Faixa de tarifa por unidade: vale para preço abaixo de `below`; `half` = metade do preço. */
export type FeeTier = { below: number; fee: number; half?: boolean };

export type ChannelRates = {
  commissionClassic: number; // %
  commissionPremium: number; // %
  fixedFee: number; // R$ por unidade abaixo do limite (usado quando não há faixas)
  fixedFeeThreshold: number; // R$
  adsRate: number; // %
  /** Faixas de tarifa por unidade (substituem fixedFee/fixedFeeThreshold quando preenchidas) */
  feeTiers: FeeTier[] | null;
  /** Tarifa por unidade só no envio próprio/Flex (regra do Mercado Livre desde 02/03/2026) */
  feeOwnShippingOnly: boolean;
};

/** Dados do produto que mudam as tarifas. */
export type ProductRates = {
  shipping: number; // custo de envio no Mercado Envios por unidade (do simulador do ML)
  shippingOwn: number; // custo da entrega própria/Flex por unidade
  shipMode: ShipMode; // envio padrão
  commissionClassic: number | null; // % da categoria (vazio = padrão do canal)
  commissionPremium: number | null;
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

export function commissionFor(ch: ChannelRates, listing: "CLASSICO" | "PREMIUM", prod?: Pick<ProductRates, "commissionClassic" | "commissionPremium"> | null) {
  const own = listing === "PREMIUM" ? prod?.commissionPremium : prod?.commissionClassic;
  if (own != null && own > 0) return own;
  return listing === "PREMIUM" ? ch.commissionPremium : ch.commissionClassic;
}

/** Tarifa por unidade no preço informado, conforme as faixas do canal e a forma de envio. */
export function fixedFeeFor(ch: ChannelRates, price: number, mode: ShipMode) {
  if (ch.feeOwnShippingOnly && mode === "MERCADO_ENVIOS") return 0;
  if (ch.feeTiers && ch.feeTiers.length > 0) {
    const tier = [...ch.feeTiers].sort((x, y) => x.below - y.below).find((t) => price < t.below);
    if (!tier) return 0;
    return tier.half ? round2(price / 2) : tier.fee;
  }
  return price < ch.fixedFeeThreshold ? ch.fixedFee : 0;
}

/** Frete por unidade pago pela loja na forma de envio escolhida. */
export function shippingFor(prod: Pick<ProductRates, "shipping" | "shippingOwn">, mode: ShipMode) {
  return mode === "PROPRIO" ? prod.shippingOwn : prod.shipping;
}

/** Comissão, tarifa por unidade e frete de uma venda. */
export function unitCharges(ch: ChannelRates, prod: ProductRates, price: number, listing: "CLASSICO" | "PREMIUM", mode: ShipMode = prod.shipMode) {
  return {
    commissionRate: commissionFor(ch, listing, prod),
    fixedFee: fixedFeeFor(ch, price, mode),
    shipping: shippingFor(prod, mode),
  };
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
 * P = (custo + embalagem + frete + tarifa por unidade) / (1 − comissão − imposto − ads − margem).
 * A tarifa muda por faixa de preço; resolve faixa a faixa e fica com o menor preço que atinge a margem.
 */
export function idealPrice(args: {
  ch: ChannelRates;
  commissionRate: number; // %
  mode: ShipMode;
  cost: number;
  packaging: number;
  shipping: number;
  taxRate: number;
  margin: number; // % desejada
}): number | null {
  const pct = (args.commissionRate + args.taxRate + args.ch.adsRate + args.margin) / 100;
  if (pct >= 1) return null;
  const base = args.cost + args.packaging + args.shipping;
  const fee = (p: number) => fixedFeeFor(args.ch, p, args.mode);
  const reaches = (p: number) => p * (1 - pct) - base - fee(p) >= -1e-9;

  const cuts = new Set<number>([0]);
  if (args.ch.feeTiers && args.ch.feeTiers.length > 0) args.ch.feeTiers.forEach((t) => cuts.add(t.below));
  else cuts.add(args.ch.fixedFeeThreshold);
  const edges = [...cuts].filter((v) => v >= 0).sort((x, y) => x - y);
  edges.push(Infinity);

  const found: number[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    const mid = Number.isFinite(hi) ? (lo + hi) / 2 : lo + 1;
    const tier = args.ch.feeTiers?.length ? [...args.ch.feeTiers].sort((x, y) => x.below - y.below).find((t) => mid < t.below) : undefined;
    const half = !!tier?.half && !(args.ch.feeOwnShippingOnly && args.mode === "MERCADO_ENVIOS");
    let p: number;
    if (half) {
      const d = 1 - pct - 0.5;
      if (d <= 0) continue;
      p = base / d;
    } else {
      p = (base + fee(mid)) / (1 - pct);
    }
    p = Math.max(p, lo);
    p = Math.ceil(p * 100 - 1e-6) / 100;
    if (p < hi && reaches(p)) found.push(p);
  }
  return found.length ? Math.min(...found) : null;
}

/** Faixas atuais do Mercado Livre no envio próprio/Flex (referência; confira no simulador da sua conta). */
export const ML_FEE_TIERS: FeeTier[] = [
  { below: 19, fee: 6.25 },
  { below: 49, fee: 6.65 },
  { below: 79, fee: 7.75 },
];

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
