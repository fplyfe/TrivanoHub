// Datas tratadas como strings "YYYY-MM-DD" (sem fuso) para evitar deslocamentos.
// Servem tanto no servidor quanto no cliente.

const TZ = process.env.APP_TZ || "America/Sao_Paulo";

const pad = (n: number) => String(n).padStart(2, "0");

export const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const toDate = (s: string) => new Date(s.slice(0, 10) + "T00:00:00.000Z");
export const toStr = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

export const today = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
export const currentMonth = () => today().slice(0, 7);

export function addMonths(s: string, n: number): string {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  const ny = Math.floor(t / 12);
  const nm = t % 12;
  const dim = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, dim))}`;
}

export function addDays(s: string, n: number): string {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toStr(d);
}

export const shiftMonth = (ym: string, n: number) => addMonths(ym + "-01", n).slice(0, 7);

export function monthRange(ym: string) {
  return { start: toDate(ym + "-01"), end: toDate(shiftMonth(ym, 1) + "-01") };
}

export function monthLabel(ym: string, long = false) {
  const [y, m] = ym.split("-").map(Number);
  const name = long
    ? ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][m - 1]
    : MONTHS[m - 1];
  return `${name}/${y}`;
}

export function monthsBetween(a: string, b: string) {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/** Próxima ocorrência de uma recorrência, sem "deriva" de dia (ex.: dia 31). */
export function advanceDate(start: string, current: string, frequency: "WEEKLY" | "MONTHLY" | "YEARLY"): string {
  if (frequency === "WEEKLY") return addDays(current, 7);
  const k = monthsBetween(start, current);
  if (frequency === "MONTHLY") return addMonths(start, k + 1);
  return addMonths(start, (Math.floor(k / 12) + 1) * 12);
}

/** Mês da fatura (mês em que ela fecha) para uma compra no cartão. */
export function invoiceMonth(date: string, closingDay: number): string {
  const ym = date.slice(0, 7);
  const day = Number(date.slice(8, 10));
  return day > closingDay ? shiftMonth(ym, 1) : ym;
}

export function invoiceDueDate(invMonth: string, closingDay: number, dueDay: number): string {
  const dueMonth = dueDay > closingDay ? invMonth : shiftMonth(invMonth, 1);
  const [y, m] = dueMonth.split("-").map(Number);
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${dueMonth}-${pad(Math.min(dueDay, dim))}`;
}
