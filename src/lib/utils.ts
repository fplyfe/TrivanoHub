import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (v: number | string | null | undefined) => brlFmt.format(Number(v ?? 0));

/** "2026-11-06..." -> "06/11/2026" */
export function fmtDate(s: string | null | undefined) {
  if (!s) return "";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export const pct = (part: number, total: number) => (total > 0 ? Math.min(100, Math.max(0, (part / total) * 100)) : 0);

export const fmtPct = (v: number | string | null | undefined, digits = 1) =>
  `${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export const LISTING_LABEL = { CLASSICO: "Clássico", PREMIUM: "Premium" } as const;
export const ACCOUNT_TYPE_LABEL = { BANK: "Banco", MARKETPLACE: "Carteira do marketplace", CASH: "Dinheiro" } as const;
export const ENTRY_TYPE_LABEL = { INCOME: "Entrada", EXPENSE: "Saída" } as const;
export const GROUP_LABEL = {
  SALES: "Recebimento de vendas",
  OTHER_INCOME: "Outras receitas",
  FIXED: "Despesa fixa",
  VARIABLE: "Despesa variável",
  PURCHASE: "Compra de mercadoria (estoque)",
  TAX: "Imposto",
  OWNER: "Retirada dos sócios",
} as const;
export const REGIME_LABEL = { SIMPLES: "Simples Nacional (Anexo I)", MEI: "MEI (DAS fixo)", MANUAL: "Alíquota manual" } as const;
export const INVESTMENT_KIND_LABEL = { APPLICATION: "Aplicação financeira", BUSINESS: "Investimento no negócio" } as const;
export const MOVE_LABEL = { CONTRIBUTION: "Aporte", WITHDRAWAL: "Resgate", VALUATION: "Atualização de valor" } as const;
export const STEP_LABEL = { TODO: "A fazer", DOING: "Em andamento", DONE: "Concluído" } as const;
export const QUOTE_LABEL = { OPEN: "Aberta", APPROVED: "Aprovada", CANCELED: "Cancelada" } as const;
