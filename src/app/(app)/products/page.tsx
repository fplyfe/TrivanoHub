import { db, plain } from "@/lib/db";
import { channelRates, taxRateFor } from "@/lib/biz";
import { currentMonth } from "@/lib/dates";
import { PageHeader } from "@/components/ui/misc";
import { ProductsView } from "./products-view";

export const metadata = { title: "Produtos e estoque" };

export default async function ProductsPage() {
  const [products, suppliers, accounts, channel, tax] = await Promise.all([
    db.product.findMany({
      include: { supplier: { select: { name: true } }, moves: { orderBy: { createdAt: "desc" }, take: 5 } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    db.supplier.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.account.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.channel.findFirst({ where: { active: true }, orderBy: { name: "asc" } }),
    taxRateFor(currentMonth()),
  ]);
  return (
    <>
      <PageHeader title="Produtos e estoque" description="Custo médio, estoque e margem estimada de cada produto" />
      <ProductsView
        products={plain(products)}
        suppliers={suppliers}
        accounts={accounts}
        channel={channel ? { name: channel.name, ...channelRates(channel) } : null}
        taxRate={tax.rate}
      />
    </>
  );
}
