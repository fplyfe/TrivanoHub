import { db } from "./db";
import { toDate } from "./dates";
import { HttpError } from "./api";

/** Impede fornecedor com o mesmo nome ou e-mail de outro já cadastrado. */
export async function assertUniqueSupplier(data: { name: string; email: string | null }, exceptId?: string) {
  const not = exceptId ? { NOT: { id: exceptId } } : {};
  const sameName = await db.supplier.findFirst({ where: { ...not, name: { equals: data.name, mode: "insensitive" } }, select: { id: true } });
  if (sameName) throw new HttpError(409, `Já existe um fornecedor chamado "${data.name}"`);
  if (data.email) {
    const sameEmail = await db.supplier.findFirst({ where: { ...not, email: data.email }, select: { name: true } });
    if (sameEmail) throw new HttpError(409, `O e-mail ${data.email} já está no fornecedor "${sameEmail.name}"`);
  }
}

type SupplierParsed = {
  stage?: "PROSPECT" | "CONTACTED" | "CATALOG" | "PRICING" | "NEGOTIATING" | "APPROVED" | "DISCARDED";
  followUpAt?: string | null;
};

/** Converte o que veio validado para o formato do banco (data do próximo passo, etapa e ativo). */
export function supplierData<T extends SupplierParsed>(v: T, opts: { allowStage: boolean }) {
  const { stage, followUpAt, ...rest } = v;
  return {
    ...rest,
    ...(followUpAt !== undefined ? { followUpAt: followUpAt ? toDate(followUpAt) : null } : {}),
    ...(opts.allowStage && stage ? { stage, stageAt: new Date(), active: stage !== "DISCARDED" } : {}),
  };
}
