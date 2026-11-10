"use client";

import { Pencil, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge, Empty, Progress } from "@/components/ui/misc";
import { DeleteButton, FormDialog } from "@/components/app/form-dialog";
import { Row } from "@/components/app/stat";
import { api } from "@/lib/client";
import { monthLabel, shiftMonth } from "@/lib/dates";
import { brl, cn, fmtDate, fmtPct, pct, STEP_LABEL } from "@/lib/utils";
import { useRouter } from "next/navigation";

type Hist = {
  month: string;
  goalId: string | null;
  goalProfit: number | null;
  goalRevenue: number | null;
  goalOrders: number | null;
  profit: number;
  revenue: number;
  orders: number;
  margin: number;
  ticket: number;
};
type Step = {
  id: string;
  channel: string;
  position: number;
  title: string;
  description: string | null;
  status: "TODO" | "DOING" | "DONE";
  owner: string | null;
  dueDate: string | null;
};

function GoalForm({ month, profit, revenue, orders }: { month: string; profit?: number | null; revenue?: number | null; orders?: number | null }) {
  return (
    <>
      <Field label="Mês">
        <Input name="month" type="month" defaultValue={month} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Meta de lucro líquido (R$)" className="col-span-2">
          <Input name="profit" type="number" step="0.01" min="0" defaultValue={profit ?? ""} required autoFocus />
        </Field>
        <Field label="Meta de faturamento (R$)">
          <Input name="revenue" type="number" step="0.01" min="0" defaultValue={revenue ?? ""} />
        </Field>
        <Field label="Meta de pedidos">
          <Input name="orders" type="number" min="0" defaultValue={orders ?? ""} />
        </Field>
      </div>
    </>
  );
}

const goalBody = (fd: FormData) => ({ month: fd.get("month"), profit: fd.get("profit"), revenue: fd.get("revenue") || 0, orders: fd.get("orders") || 0 });

function StepForm({ s, channels }: { s?: Step; channels: string[] }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Canal">
          <Input name="channel" list="step-channels" defaultValue={s?.channel ?? channels[0] ?? "Mercado Livre"} required maxLength={40} />
          <datalist id="step-channels">
            {channels.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Situação">
          <Select name="status" defaultValue={s?.status ?? "TODO"}>
            <option value="TODO">A fazer</option>
            <option value="DOING">Em andamento</option>
            <option value="DONE">Concluído</option>
          </Select>
        </Field>
      </div>
      <Field label="Passo">
        <Input name="title" defaultValue={s?.title} required maxLength={120} />
      </Field>
      <Field label="Como fazer / critério de pronto">
        <Textarea name="description" defaultValue={s?.description ?? ""} maxLength={500} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Responsável">
          <Input name="owner" defaultValue={s?.owner ?? ""} maxLength={60} />
        </Field>
        <Field label="Prazo">
          <Input name="dueDate" type="date" defaultValue={s?.dueDate?.slice(0, 10) ?? ""} />
        </Field>
      </div>
    </>
  );
}

const stepBody = (fd: FormData) => ({
  channel: fd.get("channel"),
  title: fd.get("title"),
  description: fd.get("description"),
  status: fd.get("status"),
  owner: fd.get("owner"),
  dueDate: fd.get("dueDate"),
});

export function GoalsView({
  history,
  future,
  steps,
  day,
  daysInMonth,
}: {
  history: Hist[];
  future: { month: string; id: string; profit: number; revenue: number; orders: number }[];
  steps: Step[];
  day: number;
  daysInMonth: number;
}) {
  const router = useRouter();
  const cur = history[0];
  const prev = history[1];
  const projection = day > 0 ? (cur.profit / day) * daysInMonth : cur.profit;
  const left = daysInMonth - day;
  const perDay = cur.goalProfit != null && left > 0 ? Math.max(0, cur.goalProfit - cur.profit) / left : 0;
  const profitPerOrder = cur.orders > 0 ? cur.profit / cur.orders : prev.orders > 0 ? prev.profit / prev.orders : 0;
  const hit = history.filter((h) => h.goalProfit != null && h.month !== cur.month);
  const hits = hit.filter((h) => h.profit >= (h.goalProfit ?? 0)).length;
  const channels = Array.from(new Set(steps.map((s) => s.channel)));
  const nextMonth = shiftMonth(cur.month, 1);

  return (
    <div className="grid gap-6">
      {/* Meta do mês corrente */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 capitalize">
                <Target className="size-4" /> Meta de {monthLabel(cur.month, true)}
              </span>
              <FormDialog
                title="Meta do mês"
                description="O lucro líquido considera tarifas, frete, imposto, custo dos produtos e as despesas do mês."
                onSubmit={(fd) => api("/api/goals", "POST", goalBody(fd))}
                trigger={
                  <Button size="sm" variant={cur.goalProfit != null ? "outline" : "default"}>
                    {cur.goalProfit != null ? <Pencil /> : <Plus />} {cur.goalProfit != null ? "Editar meta" : "Definir meta"}
                  </Button>
                }
              >
                <GoalForm month={cur.month} profit={cur.goalProfit} revenue={cur.goalRevenue} orders={cur.goalOrders} />
              </FormDialog>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cur.goalProfit == null ? (
              <Empty>Defina a meta de lucro deste mês para acompanhar o progresso.</Empty>
            ) : (
              <div className="grid gap-5 sm:grid-cols-3">
                {[
                  { label: "Lucro líquido", value: cur.profit, goal: cur.goalProfit, fmt: brl },
                  { label: "Faturamento", value: cur.revenue, goal: cur.goalRevenue ?? 0, fmt: brl },
                  { label: "Pedidos", value: cur.orders, goal: cur.goalOrders ?? 0, fmt: (v: number) => String(v) },
                ].map((k) => (
                  <div key={k.label} className="grid gap-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                    <p className="text-xl font-bold">{k.fmt(k.value)}</p>
                    {k.goal > 0 ? (
                      <>
                        <Progress value={pct(k.value, k.goal)} color={k.value >= k.goal ? "hsl(var(--success))" : undefined} />
                        <p className="text-xs text-muted-foreground">
                          {fmtPct(pct(k.value, k.goal), 0)} de {k.fmt(k.goal)}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">sem meta</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ritmo</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label={`Dia ${day} de ${daysInMonth}`} value={fmtPct((day / daysInMonth) * 100, 0)} />
            <Row label="Projeção de lucro no fim do mês" value={brl(projection)} tone={cur.goalProfit != null && projection >= cur.goalProfit ? "good" : undefined} />
            {cur.goalProfit != null && (
              <>
                <Row label="Lucro necessário por dia" value={brl(perDay)} />
                {profitPerOrder > 0 && perDay > 0 && <Row label="≈ vendas por dia (lucro médio por venda)" value={String(Math.ceil(perDay / profitPerOrder))} />}
              </>
            )}
            <Row label="Margem de contribuição" value={fmtPct(cur.margin)} />
            <Row label="Ticket médio" value={brl(cur.ticket)} />
            {hit.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Metas batidas: {hits} de {hit.length} meses.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            Meta × realizado (12 meses)
            <FormDialog
              title="Meta de outro mês"
              onSubmit={(fd) => api("/api/goals", "POST", goalBody(fd))}
              trigger={
                <Button size="sm" variant="outline">
                  <Plus /> Meta futura
                </Button>
              }
            >
              <GoalForm month={nextMonth} profit={cur.goalProfit != null ? Math.round(cur.goalProfit * 1.1) : null} />
              <p className="text-xs text-muted-foreground">Sugestão: meta do mês atual + 10%.</p>
            </FormDialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {future.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {future.map((f) => (
                <Badge key={f.id} tone="primary" className="gap-1 capitalize">
                  {monthLabel(f.month)}: {brl(f.profit)}
                  <button className="ml-1 opacity-60 hover:opacity-100" title="Excluir meta" onClick={async () => {
                    if (!window.confirm("Excluir esta meta?")) return;
                    await api(`/api/goals/${f.id}`, "DELETE");
                    router.refresh();
                  }}>
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2">Mês</th>
                  <th className="py-2 text-right">Meta de lucro</th>
                  <th className="py-2 text-right">Lucro líquido</th>
                  <th className="hidden py-2 text-right sm:table-cell">Faturamento</th>
                  <th className="hidden py-2 text-right md:table-cell">Pedidos</th>
                  <th className="py-2 text-right">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((h) => {
                  const ok = h.goalProfit != null && h.profit >= h.goalProfit;
                  return (
                    <tr key={h.month}>
                      <td className="py-2 capitalize">{monthLabel(h.month)}</td>
                      <td className="py-2 text-right text-muted-foreground">{h.goalProfit != null ? brl(h.goalProfit) : "—"}</td>
                      <td className={cn("py-2 text-right font-medium", h.profit < 0 && "text-destructive")}>{brl(h.profit)}</td>
                      <td className="hidden py-2 text-right sm:table-cell">{brl(h.revenue)}</td>
                      <td className="hidden py-2 text-right md:table-cell">{h.orders}</td>
                      <td className="py-2 text-right">
                        {h.goalProfit == null ? (
                          <span className="text-xs text-muted-foreground">sem meta</span>
                        ) : h.month === cur.month ? (
                          <Badge tone="primary">{fmtPct(pct(h.profit, h.goalProfit), 0)}</Badge>
                        ) : (
                          <Badge tone={ok ? "success" : "danger"}>{ok ? "Batida" : `${fmtPct(pct(h.profit, h.goalProfit), 0)}`}</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Plano de escala */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Plano de escala</h2>
            <p className="text-sm text-muted-foreground">Passos para crescer em cada canal. Edite, reordene pelo prazo e marque o que já foi feito.</p>
          </div>
          <FormDialog
            title="Novo passo"
            onSubmit={(fd) => api("/api/steps", "POST", { ...stepBody(fd), position: steps.length })}
            trigger={
              <Button size="sm">
                <Plus /> Passo
              </Button>
            }
          >
            <StepForm channels={channels} />
          </FormDialog>
        </div>
        {steps.length === 0 ? (
          <Empty>Nenhum passo cadastrado.</Empty>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {channels.map((c) => {
              const list = steps.filter((s) => s.channel === c);
              const done = list.filter((s) => s.status === "DONE").length;
              return (
                <Card key={c}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {c}
                      <span className="text-xs font-normal text-muted-foreground">
                        {done} de {list.length} concluídos
                      </span>
                    </CardTitle>
                    <Progress value={pct(done, list.length)} className="mt-2" />
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    {list.map((s, i) => (
                      <div key={s.id} className={cn("flex items-start gap-3 rounded-lg border p-3", s.status === "DONE" && "bg-success/5")}>
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-medium", s.status === "DONE" && "text-muted-foreground line-through")}>{s.title}</p>
                          {s.description && <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>}
                          {(s.owner || s.dueDate) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {s.owner && `Responsável: ${s.owner}`}
                              {s.owner && s.dueDate && " · "}
                              {s.dueDate && `Prazo: ${fmtDate(s.dueDate)}`}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                          <Select
                            className="h-8 w-36 text-xs"
                            value={s.status}
                            aria-label="Situação"
                            onChange={async (e) => {
                              await api(`/api/steps/${s.id}/status`, "PATCH", { status: e.target.value });
                              router.refresh();
                            }}
                          >
                            {(["TODO", "DOING", "DONE"] as const).map((st) => (
                              <option key={st} value={st}>
                                {STEP_LABEL[st]}
                              </option>
                            ))}
                          </Select>
                          <div className="flex">
                            <FormDialog
                              title="Editar passo"
                              onSubmit={(fd) => api(`/api/steps/${s.id}`, "PUT", { ...stepBody(fd), position: s.position })}
                              trigger={
                                <Button variant="ghost" size="icon" aria-label="Editar">
                                  <Pencil />
                                </Button>
                              }
                            >
                              <StepForm s={s} channels={channels} />
                            </FormDialog>
                            <DeleteButton confirm="Excluir este passo?" action={() => api(`/api/steps/${s.id}`, "DELETE")} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
