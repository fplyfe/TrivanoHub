import { z } from "zod";

const money = z.coerce.number().positive("Valor deve ser maior que zero").max(999_999_999);
const money0 = z.coerce.number().min(0, "Valor inválido").max(999_999_999);
const pct = z.coerce.number().min(0, "Percentual inválido").max(100);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD)");
const monthStr = z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido (AAAA-MM)");
const optId = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().nullable());
const optText = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().max(500).nullable());
const optInt = z.preprocess((v) => (v === "" || v === undefined || v === null ? null : v), z.coerce.number().int().min(0).nullable());
const optMoney = z.preprocess((v) => (v === "" || v === undefined || v === null ? null : v), z.coerce.number().min(0).nullable());
const name = (max = 80) => z.string().trim().min(1, "Informe o nome").max(max);

export const settingsSchema = z.object({
  companyName: name(),
  regime: z.enum(["SIMPLES", "MEI", "MANUAL"]),
  manualTaxRate: pct.default(0),
  rbt12Override: optMoney,
  minMargin: pct.default(10),
  planTarget: money0.default(500000),
  planStart: monthStr.default("2026-12"),
  planEnd: monthStr.default("2027-12"),
});

export const channelSchema = z.object({
  name: name(40),
  commissionClassic: pct,
  commissionPremium: pct,
  fixedFee: money0,
  fixedFeeThreshold: money0,
  adsRate: pct.default(0),
  releaseDays: z.coerce.number().int().min(0).max(120),
  accountId: optId,
  active: z.boolean().default(true),
});

export const productSchema = z.object({
  sku: z.string().trim().min(1, "Informe o SKU").max(40),
  name: name(120),
  cost: money0,
  packaging: money0.default(0),
  shipping: money0.default(0),
  price: money0.default(0),
  minStock: z.coerce.number().int().min(0).default(0),
  supplierId: optId,
  active: z.boolean().default(true),
  stage: z.enum(["CANDIDATE", "TESTING", "APPROVED", "CHAMPION", "PAUSED"]).optional(),
  weightG: optInt,
  needsCert: z.boolean().default(false),
  researchNotes: optText,
});

export const stageSchema = z.object({ stage: z.enum(["CANDIDATE", "TESTING", "APPROVED", "CHAMPION", "PAUSED"]) });

export const adSpendSchema = z.object({
  productId: z.string().min(1, "Escolha o produto"),
  weekStart: dateStr,
  spend: money0,
  adSales: money0.default(0),
  adOrders: z.coerce.number().int().min(0).default(0),
  impressions: optInt,
  clicks: optInt,
  accountId: optId,
  /** Lançar o gasto como saída no Caixa (entra no lucro do mês) */
  createEntry: z.boolean().default(true),
});

export const phaseActionSchema = z.object({ action: z.enum(["toggleManual", "complete", "reopen"]) });

export const stockMoveSchema = z.object({
  type: z.enum(["IN", "ADJUST"]),
  qty: z.coerce.number().int(),
  unitCost: optMoney,
  date: dateStr,
  note: optText,
  /** Lançar a compra como despesa (conta a pagar) */
  createExpense: z.boolean().default(false),
  accountId: optId,
});

export const saleSchema = z.object({
  date: dateStr,
  channelId: z.string().min(1, "Escolha o canal"),
  productId: z.string().min(1, "Escolha o produto"),
  listingType: z.enum(["CLASSICO", "PREMIUM"]),
  qty: z.coerce.number().int().min(1, "Quantidade mínima 1"),
  price: money,
  shipping: optMoney,
  externalId: optText,
  note: optText,
});

export const accountSchema = z.object({
  name: name(40),
  type: z.enum(["BANK", "MARKETPLACE", "CASH"]),
  initialBalance: z.coerce.number().min(-999_999_999).max(999_999_999).default(0),
  active: z.boolean().default(true),
});

export const categorySchema = z.object({
  name: name(40),
  type: z.enum(["INCOME", "EXPENSE"]),
  group: z.enum(["SALES", "OTHER_INCOME", "FIXED", "VARIABLE", "PURCHASE", "TAX", "OWNER"]),
});

export const entrySchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  description: name(120),
  amount: money,
  date: dateStr,
  paid: z.boolean().default(false),
  accountId: optId,
  categoryId: optId,
  supplierId: optId,
  note: optText,
  /** Repetir mensalmente por N meses (1 = só este) */
  repeat: z.coerce.number().int().min(1).max(36).default(1),
});

export const supplierSchema = z.object({
  name: name(),
  contact: optText,
  phone: optText,
  email: optText,
  leadDays: optInt,
  notes: optText,
  active: z.boolean().default(true),
});

export const quoteSchema = z.object({
  productId: z.string().min(1, "Escolha o produto"),
  qty: z.coerce.number().int().min(1),
  note: optText,
});

export const offerSchema = z.object({
  supplierId: z.string().min(1, "Escolha o fornecedor"),
  unitPrice: money,
  freight: money0.default(0),
  leadDays: optInt,
  terms: optText,
});

export const approveQuoteSchema = z.object({
  offerId: z.string().min(1),
  date: dateStr,
  createExpense: z.boolean().default(true),
  accountId: optId,
});

export const investmentSchema = z.object({
  name: name(),
  kind: z.enum(["APPLICATION", "BUSINESS"]),
  notes: optText,
  active: z.boolean().default(true),
});

export const investmentMoveSchema = z.object({
  type: z.enum(["CONTRIBUTION", "WITHDRAWAL", "VALUATION"]),
  amount: money0,
  date: dateStr,
  accountId: optId,
  note: optText,
});

export const goalSchema = z.object({
  month: monthStr,
  profit: money0,
  revenue: money0.default(0),
  orders: z.coerce.number().int().min(0).default(0),
});

export const stepSchema = z.object({
  position: z.coerce.number().int().min(0).default(0),
  channel: name(40),
  title: name(120),
  description: optText,
  status: z.enum(["TODO", "DOING", "DONE"]).default("TODO"),
  owner: optText,
  dueDate: z.preprocess((v) => (v === "" || v === undefined ? null : v), dateStr.nullable()).transform((v) => (v ? new Date(v + "T00:00:00.000Z") : null)),
});

export const passwordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(8, "A nova senha deve ter ao menos 8 caracteres").max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

const email = z.string().trim().toLowerCase().email("E-mail inválido").max(120);
const newPassword = z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(100);

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(60),
  email,
  password: newPassword,
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(60),
  email,
  role: z.enum(["ADMIN", "MEMBER"]),
  active: z.boolean(),
});

export const resetPasswordSchema = z.object({ password: newPassword });

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(60),
  email,
});
