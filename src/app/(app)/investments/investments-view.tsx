"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, Empty } from "@/components/ui/misc";
import { ActionButton, DeleteButton, FormDialog } from "@/components/app/form-dialog";
import { Row, Stat } from "@/components/app/stat";
import { api } from "@/lib/client";
import { today } from "@/lib/dates";
import { brl, cn, fmtDate, fmtPct, INVESTMENT_KIND_LABEL, MOVE_LABEL } from "@/lib/utils";

type Move = { id: string; type: keyof typeof MOVE_LABEL; amount: number; date: string; note: string | null };
type Investment = { id: string; name: string; kind: keyof typeof INVESTMENT_KIND_LABEL; notes: string | null; active: boolean; moves: Move[] };
type Opt = { id: string; name: string };

function stats(inv: Investment) {
  const contributed = inv.moves.filter((m) => m.type === "CONTRIBUTION").reduce((a, m) => a + m.amount, 0);
  const withdrawn = inv.moves.filter((m) => m.type === "WITHDRAWAL").reduce((a, m) => a + m.amount, 0);
  const invested = contributed - withdrawn;
  const lastVal = inv.moves.find((m) => m.type === "VALUATION");
  // Valor atual: última atualização + movimentos posteriores a ela
  let current = invested;
  if (lastVal) {
    const after = inv.moves.filter((m) => m.date > lastVal.date && m.type !== "VALUATION");
    current = lastVal.amount + after.reduce((a, m) => a + (m.type === "CONTRIBUTION" ? m.amount : -m.amount), 0);
  }
  return { invested, current, gain: current - invested };
}

const invBody = (fd: FormData) => ({
  name: fd.get("name"),
  kind: fd.get("kind"),
  notes: fd.get("notes"),
  active: fd.get("active") !== null ? fd.get("active") === "on" : true,
});

function InvestmentForm({ inv }: { inv?: Investment }) {
  return (
    <>
      <Field label="Nome">
        <Input name="name" defaultValue={inv?.name} placeholder="Ex.: CDB Banco X, Reserva, Máquina de etiquetas" required maxLength={80} autoFocus />
      </Field>
      <Field label="Tipo">
        <Select name="kind" defaultValue={inv?.kind ?? "APPLICATION"}>
          <option value="APPLICATION">Aplicação financeira (dinheiro rendendo)</option>
          <option value="BUSINESS">Investimento no negócio (equipamento, marca, estoque inicial…)</option>
        </Select>
      </Field>
      <Field label="Observações">
        <Input name="notes" defaultValue={inv?.notes ?? ""} maxLength={300} />
      </Field>
      {inv && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={inv.active} /> Ativo
        </label>
      )}
    </>
  );
}

export function InvestmentsView({ investments, accounts, avgProfit, avgFixed }: { investments: Investment[]; accounts: Opt[]; avgProfit: number; avgFixed: number }) {
  const apps = investments.filter((i) => i.kind === "APPLICATION");
  const biz = investments.filter((i) => i.kind === "BUSINESS");
  const appTotal = apps.reduce((a, i) => a + stats(i).current, 0);
  const bizTotal = biz.reduce((a, i) => a + stats(i).invested, 0);
  const reserveMonths = avgFixed > 0 ? appTotal / avgFixed : null;
  const payback = avgProfit > 0 && bizTotal > 0 ? bizTotal / avgProfit : null;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Aplicações (valor atual)" value={brl(appTotal)} hint={reserveMonths != null ? `Cobre ${reserveMonths.toFixed(1)} meses de despesa fixa` : "Lance despesas fixas para medir a reserva"} />
        <Stat label="Investido no negócio" value={brl(bizTotal)} />
        <Stat label="Lucro médio (3 meses)" value={brl(avgProfit)} tone={avgProfit >= 0 ? "good" : "bad"} />
        <Stat label="Payback do negócio" value={payback ? `${payback.toFixed(1)} meses` : "—"} hint="Investido ÷ lucro médio mensal" />
      </div>

      <div className="flex justify-end">
        <FormDialog
          title="Novo investimento"
          onSubmit={(fd) => api("/api/investments", "POST", invBody(fd))}
          trigger={
            <Button>
              <Plus /> Novo investimento
            </Button>
          }
        >
          <InvestmentForm />
        </FormDialog>
      </div>

      {investments.length === 0 ? (
        <Empty>Nenhum investimento cadastrado.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {investments.map((inv) => {
            const st = stats(inv);
            const pctGain = st.invested > 0 ? (st.gain / st.invested) * 100 : 0;
            return (
              <Card key={inv.id} className={cn(!inv.active && "opacity-60")}>
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-2">
                    <div>
                      <p>{inv.name}</p>
                      <Badge className="mt-1.5" tone={inv.kind === "BUSINESS" ? "primary" : "muted"}>
                        {INVESTMENT_KIND_LABEL[inv.kind]}
                      </Badge>
                    </div>
                    <div className="-mr-2 -mt-1 flex">
                      <FormDialog
                        title={`Editar · ${inv.name}`}
                        onSubmit={(fd) => api(`/api/investments/${inv.id}`, "PUT", invBody(fd))}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="Editar">
                            <Pencil />
                          </Button>
                        }
                      >
                        <InvestmentForm inv={inv} />
                      </FormDialog>
                      <DeleteButton confirm={`Excluir ${inv.name} e todo o histórico?`} action={() => api(`/api/investments/${inv.id}`, "DELETE")} />
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <Row label="Investido" value={brl(st.invested)} />
                  {inv.kind === "APPLICATION" && (
                    <>
                      <Row label="Valor atual" value={brl(st.current)} strong />
                      <Row label="Rendimento" value={`${brl(st.gain)} (${fmtPct(pctGain)})`} tone={st.gain >= 0 ? "good" : "bad"} />
                    </>
                  )}
                  <FormDialog
                    title={`Movimentar · ${inv.name}`}
                    description="Aporte debita a conta escolhida; resgate credita. Atualização só registra o valor atual."
                    onSubmit={(fd) =>
                      api(`/api/investments/${inv.id}/moves`, "POST", {
                        type: fd.get("type"),
                        amount: fd.get("amount"),
                        date: fd.get("date"),
                        accountId: fd.get("accountId"),
                        note: fd.get("note"),
                      })
                    }
                    trigger={
                      <Button variant="outline" size="sm" className="mt-1 justify-self-start">
                        <Plus /> Movimento
                      </Button>
                    }
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Tipo">
                        <Select name="type" defaultValue="CONTRIBUTION">
                          <option value="CONTRIBUTION">Aporte</option>
                          <option value="WITHDRAWAL">Resgate</option>
                          {inv.kind === "APPLICATION" && <option value="VALUATION">Atualização de valor</option>}
                        </Select>
                      </Field>
                      <Field label="Valor (R$)">
                        <Input name="amount" type="number" step="0.01" min="0" required />
                      </Field>
                      <Field label="Data">
                        <Input name="date" type="date" defaultValue={today()} required />
                      </Field>
                      <Field label="Conta">
                        <Select name="accountId" defaultValue="">
                          <option value="">—</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <Field label="Observação">
                      <Input name="note" maxLength={200} />
                    </Field>
                  </FormDialog>
                  {inv.moves.length > 0 && (
                    <div className="mt-1 divide-y border-t text-xs">
                      {inv.moves.slice(0, 5).map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                          <span className="text-muted-foreground">
                            {fmtDate(m.date)} · {MOVE_LABEL[m.type]}
                          </span>
                          <span className="flex items-center gap-1">
                            {brl(m.amount)}
                            <ActionButton
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              aria-label="Excluir movimento"
                              confirm="Excluir este movimento?"
                              action={() => api(`/api/investment-moves/${m.id}`, "DELETE")}
                            >
                              <Trash2 className="size-3.5 text-muted-foreground" />
                            </ActionButton>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
