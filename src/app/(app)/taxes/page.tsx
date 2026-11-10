import Link from "next/link";
import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { monthSummary, taxRateFor } from "@/lib/biz";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/dates";
import { SIMPLES_ANEXO_I } from "@/lib/pricing";
import { brl, cn, fmtPct, REGIME_LABEL } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/misc";
import { Row } from "@/components/app/stat";
import { ActionButtonClient } from "./das-button";

export const metadata = { title: "Impostos" };

export default async function TaxesPage() {
  const month = currentMonth();
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, -i));
  const [tax, summaries, generated] = await Promise.all([
    taxRateFor(month),
    Promise.all(months.map((m) => monthSummary(m))),
    db.entry.findMany({ where: { description: { startsWith: "Imposto (DAS)" } }, select: { description: true, paid: true } }),
  ]);
  const genMap = new Map(generated.map((g) => [g.description, g.paid]));

  return (
    <>
      <PageHeader title="Impostos" description="Alíquota do mês e imposto estimado sobre as vendas" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{monthLabel(month, true)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Regime" value={REGIME_LABEL[tax.regime]} />
            {tax.regime === "SIMPLES" && (
              <>
                <Row label="Receita dos últimos 12 meses (RBT12)" value={brl(tax.rbt12)} />
                <Row label="Faixa" value={`${tax.bracket}ª`} />
              </>
            )}
            <Row label="Alíquota efetiva" value={fmtPct(tax.rate, 3)} strong />
            <p className="mt-3 text-xs text-muted-foreground">
              Novas vendas usam essa alíquota. Para mudar o regime ou informar o RBT12 à mão, vá em{" "}
              <Link href="/settings" className="text-primary hover:underline">
                Configurações
              </Link>
              . Confirme com o seu contador.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Imposto estimado por mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2">Mês</th>
                    <th className="py-2 text-right">Faturamento</th>
                    <th className="py-2 text-right">Imposto</th>
                    <th className="w-44 py-2 text-right">Conta a pagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summaries.map((s) => {
                    const desc = `Imposto (DAS) ${s.month}`;
                    const g = genMap.get(desc);
                    return (
                      <tr key={s.month}>
                        <td className="py-2 capitalize">{monthLabel(s.month, true)}</td>
                        <td className="py-2 text-right">{brl(s.gross)}</td>
                        <td className="py-2 text-right font-medium">{brl(s.tax)}</td>
                        <td className="py-2 text-right">
                          {g !== undefined ? (
                            <Badge tone={g ? "success" : "warning"}>{g ? "Pago" : "Gerada, em aberto"}</Badge>
                          ) : s.tax > 0 ? (
                            <ActionButtonClient month={s.month} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="size-3.5" /> &quot;Gerar conta&quot; cria a saída do DAS no Caixa com vencimento no dia 20 do mês seguinte.
            </p>
          </CardContent>
        </Card>

        {tax.regime === "SIMPLES" && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Simples Nacional · Anexo I (comércio)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2">Faixa</th>
                      <th className="py-2 text-right">RBT12 até</th>
                      <th className="py-2 text-right">Alíquota nominal</th>
                      <th className="py-2 text-right">Parcela a deduzir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {SIMPLES_ANEXO_I.map((b, i) => (
                      <tr key={b.upTo} className={cn(tax.bracket === i + 1 && "bg-accent/50 font-medium")}>
                        <td className="py-2">{i + 1}ª</td>
                        <td className="py-2 text-right">{brl(b.upTo)}</td>
                        <td className="py-2 text-right">{fmtPct(b.rate, 2)}</td>
                        <td className="py-2 text-right">{brl(b.deduction)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Alíquota efetiva = (RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
