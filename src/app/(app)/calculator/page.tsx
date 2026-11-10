import { db, plain } from "@/lib/db";
import { channelRates, getSettings, taxRateFor } from "@/lib/biz";
import { currentMonth } from "@/lib/dates";
import { n } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { CalculatorView } from "./calculator-view";

export const metadata = { title: "Calculadora" };

export default async function CalculatorPage() {
  const [channels, products, tax, settings] = await Promise.all([
    db.channel.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.product.findMany({
      where: { active: true },
      select: { id: true, name: true, sku: true, cost: true, packaging: true, shipping: true, price: true },
      orderBy: { name: "asc" },
    }),
    taxRateFor(currentMonth()),
    getSettings(),
  ]);
  return (
    <>
      <PageHeader title="Calculadora de lucro" description="Simule o preço antes de anunciar: veja cada desconto e o que sobra." />
      <CalculatorView
        channels={channels.map((c) => ({ id: c.id, name: c.name, ...channelRates(c) }))}
        products={plain(products)}
        taxRate={tax.rate}
        minMargin={n(settings.minMargin)}
      />
    </>
  );
}
