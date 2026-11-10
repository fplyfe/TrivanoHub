// Constantes do Dashboard de Ads usadas no navegador e no servidor (sem acesso ao banco).
export const PERIODS = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "month", label: "Este mês" },
  { key: "lastmonth", label: "Mês passado" },
  { key: "custom", label: "Personalizado" },
] as const;
export type PeriodKey = (typeof PERIODS)[number]["key"];

export const SOURCE_LABEL = { META: "Meta Ads", MERCADO_ADS: "Mercado Ads", GOOGLE: "Google Ads", TIKTOK: "TikTok Ads", OTHER: "Outros" } as const;
export type Source = keyof typeof SOURCE_LABEL;
