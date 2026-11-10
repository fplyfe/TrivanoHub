import { db, plain } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { SuppliersView } from "./suppliers-view";

export const metadata = { title: "Fornecedores" };

export default async function SuppliersPage() {
  const suppliers = await db.supplier.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return (
    <>
      <PageHeader title="Fornecedores" description="Contatos, prazos e produtos de cada fornecedor" />
      <SuppliersView suppliers={plain(suppliers)} />
    </>
  );
}
