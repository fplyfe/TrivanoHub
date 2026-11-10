import { db, plain } from "@/lib/db";
import { channelRates, taxRateFor } from "@/lib/biz";
import { currentMonth } from "@/lib/dates";
import { PageHeader } from "@/components/ui/misc";
import { QuotesView } from "./quotes-view";

export const metadata = { title: "Cotações" };

export default async function QuotesPage() {
  const [quotes, products, suppliers, accounts, channel, tax] = await Promise.all([
    db.quote.findMany({
      include: {
        product: { select: { name: true, sku: true, price: true, packaging: true, shipping: true, cost: true } },
        offers: { include: { supplier: { select: { name: true } } } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 60,
    }),
    db.product.findMany({ where: { active: true }, select: { id: true, name: true, sku: true }, orderBy: { name: "asc" } }),
    db.supplier.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.account.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.channel.findFirst({ where: { active: true }, orderBy: { name: "asc" } }),
    taxRateFor(currentMonth()),
  ]);
  return (
    <>
      <PageHeader title="Cotações" description="Compare fornecedores pelo custo final por unidade e pelo lucro que cada proposta gera" />
      <QuotesView
        quotes={plain(quotes)}
        products={products}
        suppliers={suppliers}
        accounts={accounts}
        channel={channel ? { name: channel.name, ...channelRates(channel) } : null}
        taxRate={tax.rate}
      />
    </>
  );
}
