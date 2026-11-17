import { db, plain } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { SupplierFunnelView } from "./supplier-funnel-view";

export const metadata = { title: "Funil de fornecedores" };

export default async function SupplierFunnelPage() {
  const suppliers = await db.supplier.findMany({
    include: { _count: { select: { products: true, offers: true } } },
    orderBy: [{ followUpAt: { sort: "asc", nulls: "last" } }, { stageAt: "asc" }],
  });
  return (
    <>
      <PageHeader title="Funil de fornecedores" description="Do primeiro contato ao fornecedor aprovado: arraste os cards entre as etapas" />
      <SupplierFunnelView suppliers={plain(suppliers)} />
    </>
  );
}
