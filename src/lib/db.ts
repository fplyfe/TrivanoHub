import { Prisma, PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

export const db = g.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") g.prisma = db;

export const n = (v: Prisma.Decimal | number | string | null | undefined) => (v == null ? 0 : Number(v));

/** Converte Decimal -> number e Date -> ISO, para passar de Server para Client Components / JSON. */
export type Plain<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Plain<U>[]
      : T extends object
        ? { [K in keyof T]: Plain<T[K]> }
        : T;

export function plain<T>(value: T): Plain<T> {
  return JSON.parse(
    JSON.stringify(value, function (this: Record<string, unknown>, key: string, v: unknown) {
      const original = this[key];
      return Prisma.Decimal.isDecimal(original) ? (original as Prisma.Decimal).toNumber() : v;
    }),
  );
}
