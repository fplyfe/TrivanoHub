import { Prisma } from "@prisma/client";
import { db, n } from "./db";
import { HttpError } from "./api";
import { addDays, monthRange, shiftMonth, toDate, toStr } from "./dates";
import { commissionFor, computeProfit, fixedFeeFor, round2, simplesEffectiveRate, type ChannelRates } from "./pricing";

type Tx = Prisma.TransactionClient | typeof db;

export async function getSettings(tx: Tx = db) {
  return (await tx.settings.findUnique({ where: { id: 1 } })) ?? (await tx.settings.create({ data: { id: 1 } }));
}

export function channelRates(c: {
  commissionClassic: Prisma.Decimal;
  commissionPremium: Prisma.Decimal;
  fixedFee: Prisma.Decimal;
  fixedFeeThreshold: Prisma.Decimal;
  adsRate: Prisma.Decimal;
}): ChannelRates {
  return {
    commissionClassic: n(c.commissionClassic),
    commissionPremium: n(c.commissionPremium),
    fixedFee: n(c.fixedFee),
    fixedFeeThreshold: n(c.fixedFeeThreshold),
    adsRate: n(c.adsRate),
  };
}

/** Receita bruta dos 12 meses anteriores ao mês informado (proporcionalizada se a loja tem menos de 12 meses). */
export async function rbt12For(ym: string, tx: Tx = db): Promise<number> {
  const s = await getSettings(tx);
  if (s.rbt12Override != null) return n(s.rbt12Override);
  const from = toDate(shiftMonth(ym, -12) + "-01");
  const to = toDate(ym + "-01");
  const rows = await tx.sale.findMany({ where: { status: "OK", date: { gte: from, lt: to } }, select: { date: true, gross: true } });
  if (rows.length === 0) return 0;
  const months = new Set(rows.map((r) => toStr(r.date).slice(0, 7))).size;
  const sum = rows.reduce((a, r) => a + n(r.gross), 0);
  return months >= 12 ? sum : (sum / months) * 12;
}

/** Alíquota de imposto (%) aplicada às vendas de um mês. */
export async function taxRateFor(ym: string, tx: Tx = db) {
  const s = await getSettings(tx);
  if (s.regime === "MEI") return { rate: 0, rbt12: 0, bracket: 0, regime: s.regime };
  if (s.regime === "MANUAL") return { rate: n(s.manualTaxRate), rbt12: 0, bracket: 0, regime: s.regime };
  const rbt12 = await rbt12For(ym, tx);
  const { rate, bracket } = simplesEffectiveRate(rbt12);
  return { rate, rbt12, bracket, regime: s.regime };
}

export type SaleInput = {
  date: string;
  channelId: string;
  productId: string;
  listingType: "CLASSICO" | "PREMIUM";
  qty: number;
  price: number;
  shipping?: number | null; // por unidade; se vazio usa o do produto
  externalId?: string | null;
  note?: string | null;
};

/** Registra uma venda: congela custos e tarifas, baixa o estoque e cria o "a receber". */
export async function createSale(v: SaleInput) {
  return db.$transaction(async (tx) => {
    const [product, channel] = await Promise.all([
      tx.product.findUniqueOrThrow({ where: { id: v.productId } }),
      tx.channel.findUniqueOrThrow({ where: { id: v.channelId } }),
    ]);
    const ch = channelRates(channel);
    const { rate: taxRate } = await taxRateFor(v.date.slice(0, 7), tx);
    const r = computeProfit({
      price: v.price,
      qty: v.qty,
      cost: n(product.cost),
      packaging: n(product.packaging),
      shipping: v.shipping ?? n(product.shipping),
      commissionRate: commissionFor(ch, v.listingType),
      fixedFee: fixedFeeFor(ch, v.price),
      adsRate: ch.adsRate,
      taxRate,
    });
    const sale = await tx.sale.create({
      data: {
        date: toDate(v.date),
        channelId: v.channelId,
        productId: v.productId,
        listingType: v.listingType,
        qty: v.qty,
        price: v.price,
        gross: r.gross,
        commission: r.commission,
        fixedFee: r.fixedFee,
        shipping: r.shipping,
        ads: r.ads,
        taxRate,
        tax: r.tax,
        cost: r.cost,
        packaging: r.packaging,
        profit: r.profit,
        externalId: v.externalId ?? null,
        note: v.note ?? null,
      },
    });
    await tx.product.update({ where: { id: product.id }, data: { stock: { decrement: v.qty } } });
    await tx.stockMove.create({
      data: { productId: product.id, type: "OUT", qty: -v.qty, unitCost: product.cost, note: `Venda ${channel.name}`, date: toDate(v.date) },
    });
    const salesCat = await tx.category.findFirst({ where: { group: "SALES" } });
    await tx.entry.create({
      data: {
        type: "INCOME",
        description: `Venda ${product.name} (${v.qty}x) — ${channel.name}`,
        amount: r.net,
        date: toDate(addDays(v.date, channel.releaseDays)),
        paid: channel.releaseDays === 0,
        paidAt: channel.releaseDays === 0 ? toDate(v.date) : null,
        accountId: channel.accountId,
        categoryId: salesCat?.id ?? null,
        saleId: sale.id,
      },
    });
    return sale;
  });
}

/** Cancela a venda: devolve o estoque e remove o "a receber" ainda não recebido. */
export async function cancelSale(id: string) {
  return db.$transaction(async (tx) => {
    const s = await tx.sale.findUniqueOrThrow({ where: { id } });
    if (s.status === "CANCELED") throw new HttpError(400, "Venda já cancelada");
    await tx.sale.update({ where: { id }, data: { status: "CANCELED" } });
    await tx.product.update({ where: { id: s.productId }, data: { stock: { increment: s.qty } } });
    await tx.stockMove.create({
      data: { productId: s.productId, type: "IN", qty: s.qty, unitCost: n(s.cost) / s.qty, note: "Cancelamento de venda", date: s.date },
    });
    await tx.entry.deleteMany({ where: { saleId: id, paid: false } });
  });
}

/** Entrada de estoque com recálculo do custo médio. */
export async function stockIn(tx: Tx, productId: string, qty: number, unitCost: number, date: string, note: string) {
  const p = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  const cur = Math.max(0, p.stock);
  const avg = cur + qty > 0 ? round2((cur * n(p.cost) + qty * unitCost) / (cur + qty)) : unitCost;
  await tx.product.update({ where: { id: productId }, data: { stock: { increment: qty }, cost: avg } });
  await tx.stockMove.create({ data: { productId, type: "IN", qty, unitCost, note, date: toDate(date) } });
  return avg;
}

/** Saldo de cada conta: inicial + entradas pagas − saídas pagas − aportes + resgates. */
export async function accountBalances() {
  const [accounts, entries, moves] = await Promise.all([
    db.account.findMany({ orderBy: { name: "asc" } }),
    db.entry.groupBy({ by: ["accountId", "type"], where: { paid: true, accountId: { not: null } }, _sum: { amount: true } }),
    db.investmentMove.groupBy({ by: ["accountId", "type"], where: { accountId: { not: null } }, _sum: { amount: true } }),
  ]);
  return accounts.map((a) => {
    let bal = n(a.initialBalance);
    for (const e of entries) if (e.accountId === a.id) bal += (e.type === "INCOME" ? 1 : -1) * n(e._sum.amount);
    for (const m of moves) {
      if (m.accountId !== a.id) continue;
      if (m.type === "CONTRIBUTION") bal -= n(m._sum.amount);
      if (m.type === "WITHDRAWAL") bal += n(m._sum.amount);
    }
    return { id: a.id, name: a.name, type: a.type, active: a.active, initialBalance: n(a.initialBalance), balance: round2(bal) };
  });
}

/** Resultado do mês: vendas (lucro já líquido de tarifas, imposto e custo) menos despesas do mês. */
export async function monthSummary(ym: string) {
  const { start, end } = monthRange(ym);
  const [sales, expenses, otherIncome, owner] = await Promise.all([
    db.sale.aggregate({
      where: { status: "OK", date: { gte: start, lt: end } },
      _sum: { gross: true, commission: true, fixedFee: true, shipping: true, ads: true, tax: true, cost: true, packaging: true, profit: true, qty: true },
      _count: true,
    }),
    db.entry.groupBy({
      by: ["categoryId"],
      where: { type: "EXPENSE", date: { gte: start, lt: end }, OR: [{ categoryId: null }, { category: { group: { in: ["FIXED", "VARIABLE"] } } }] },
      _sum: { amount: true },
    }),
    db.entry.aggregate({ where: { type: "INCOME", date: { gte: start, lt: end }, category: { group: "OTHER_INCOME" } }, _sum: { amount: true } }),
    db.entry.aggregate({ where: { type: "EXPENSE", date: { gte: start, lt: end }, category: { group: "OWNER" } }, _sum: { amount: true } }),
  ]);
  const s = sales._sum;
  const gross = n(s.gross);
  const fees = n(s.commission) + n(s.fixedFee) + n(s.ads);
  const shipping = n(s.shipping);
  const tax = n(s.tax);
  const cogs = n(s.cost) + n(s.packaging);
  const contribution = n(s.profit);
  const expensesTotal = expenses.reduce((a, e) => a + n(e._sum.amount), 0);
  const other = n(otherIncome._sum.amount);
  const result = round2(contribution - expensesTotal + other);
  return {
    month: ym,
    orders: sales._count,
    units: n(s.qty),
    gross: round2(gross),
    fees: round2(fees),
    shipping: round2(shipping),
    tax: round2(tax),
    cogs: round2(cogs),
    contribution: round2(contribution),
    expenses: round2(expensesTotal),
    otherIncome: round2(other),
    result,
    margin: gross > 0 ? round2((result / gross) * 100) : 0,
    contributionMargin: gross > 0 ? round2((contribution / gross) * 100) : 0,
    ticket: sales._count > 0 ? round2(gross / sales._count) : 0,
    ownerWithdrawals: round2(n(owner._sum.amount)),
  };
}

/** Margem (%) antes do Ads de um produto no preço atual = ACOS de empate. */
export function marginBeforeAds(p: { price: Prisma.Decimal | number; cost: Prisma.Decimal | number; packaging: Prisma.Decimal | number; shipping: Prisma.Decimal | number }, ch: ChannelRates | null, taxRate: number): number | null {
  const price = n(p.price);
  if (!ch || price <= 0) return null;
  const r = computeProfit({
    price,
    qty: 1,
    cost: n(p.cost),
    packaging: n(p.packaging),
    shipping: n(p.shipping),
    commissionRate: ch.commissionClassic,
    fixedFee: fixedFeeFor(ch, price),
    adsRate: 0,
    taxRate,
  });
  return r.margin;
}

/** Canal principal (o primeiro ativo, em ordem alfabética) com as tarifas. */
export async function mainChannel() {
  const c = await db.channel.findFirst({ where: { active: true }, orderBy: { name: "asc" } });
  return c ? { id: c.id, name: c.name, ...channelRates(c) } : null;
}

export type PhaseStatus = {
  id: string;
  position: number;
  name: string;
  startMonth: string;
  endMonth: string;
  goalType: "TOTAL_ORDERS" | "MONTHLY_REVENUE" | "NONE";
  goalValue: number;
  manualGate: string | null;
  manualOk: boolean;
  completedAt: string | null;
  state: "done" | "current" | "next";
  progress: number; // valor atual da métrica do portão
  goalMet: boolean;
  steps: { id: string; title: string; status: "TODO" | "DOING" | "DONE"; description: string | null }[];
};

/** Situação de cada fase: concluída, atual (a primeira não concluída) ou próxima, com o progresso do portão. */
export async function phasesStatus(): Promise<PhaseStatus[]> {
  const phases = await db.planPhase.findMany({ orderBy: { position: "asc" }, include: { steps: { orderBy: { position: "asc" } } } });
  const currentIdx = phases.findIndex((p) => !p.completedAt);
  const out: PhaseStatus[] = [];
  for (const [i, p] of phases.entries()) {
    // A fase começa no início do mês planejado ou na conclusão da anterior, o que vier antes
    const prevDone = i > 0 ? phases[i - 1].completedAt : null;
    const plannedStart = toDate(p.startMonth + "-01");
    const from = prevDone && prevDone < plannedStart ? prevDone : plannedStart;
    let progress = 0;
    if (p.goalType === "TOTAL_ORDERS") {
      progress = await db.sale.count({ where: { status: "OK", date: { gte: from } } });
    } else if (p.goalType === "MONTHLY_REVENUE") {
      const rows = await db.sale.findMany({ where: { status: "OK", date: { gte: from } }, select: { date: true, gross: true } });
      const byMonth = new Map<string, number>();
      for (const r of rows) {
        const m = toStr(r.date).slice(0, 7);
        byMonth.set(m, (byMonth.get(m) ?? 0) + n(r.gross));
      }
      progress = round2(Math.max(0, ...byMonth.values()));
    }
    const goal = n(p.goalValue);
    out.push({
      id: p.id,
      position: p.position,
      name: p.name,
      startMonth: p.startMonth,
      endMonth: p.endMonth,
      goalType: p.goalType,
      goalValue: goal,
      manualGate: p.manualGate,
      manualOk: p.manualOk,
      completedAt: p.completedAt ? toStr(p.completedAt) : null,
      state: p.completedAt ? "done" : i === currentIdx ? "current" : "next",
      progress,
      goalMet: p.goalType === "NONE" ? p.steps.every((s) => s.status === "DONE") : progress >= goal,
      steps: p.steps.map((s) => ({ id: s.id, title: s.title, status: s.status, description: s.description })),
    });
  }
  return out;
}
