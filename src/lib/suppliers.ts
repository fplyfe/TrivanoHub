import { db } from "./db";
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
