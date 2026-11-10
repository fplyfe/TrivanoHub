import type { z } from "zod";
import { db } from "./db";
import { readJson, route } from "./api";

type Model = "channel" | "account" | "category" | "product" | "supplier" | "investment" | "growthStep";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const delegate = (m: Model) => (db as any)[m];

/** POST de cadastro simples, validado pelo schema. */
export function createRoute(model: Model, schema: z.ZodTypeAny, opts: { admin?: boolean } = {}) {
  return route(async (req) => delegate(model).create({ data: schema.parse(await readJson(req)) }), opts);
}

/** PUT e DELETE de cadastro simples. Exclusão de registro em uso devolve 409 (desative em vez de excluir). */
export function itemRoutes(model: Model, schema: z.ZodTypeAny, opts: { admin?: boolean } = {}) {
  return {
    PUT: route(async (req, { params }) => delegate(model).update({ where: { id: params.id }, data: schema.parse(await readJson(req)) }), opts),
    DELETE: route(async (_req, { params }) => {
      await delegate(model).delete({ where: { id: params.id } });
      return { deleted: true };
    }, opts),
  };
}
