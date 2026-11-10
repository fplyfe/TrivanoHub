"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, CircleDot, Flag, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Progress } from "@/components/ui/misc";
import { ActionButton } from "@/components/app/form-dialog";
import { PlanChart } from "@/components/app/charts";
import { api } from "@/lib/client";
import type { PhaseStatus } from "@/lib/biz";
import { brl, cn, fmtDate, fmtPct, pct } from "@/lib/utils";

type Row = { month: string; label: string; goal: number; actual: number | null; profit: number | null; accGoal: number; accActual: number | null };

const monthName = (m: string) => {
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`;
};

function gateText(p: PhaseStatus) {
  if (p.goalType === "TOTAL_ORDERS") return `${p.progress} de ${p.goalValue} vendas`;
  if (p.goalType === "MONTHLY_REVENUE") return `Melhor mês: ${brl(p.progress)} de ${brl(p.goalValue)}`;
  return "Concluir o checklist";
}

export function PlanView({
  target,
  planStart,
  planEnd,
  actual,
  goalToDate,
  schedule,
  phases,
  currentMonth,
}: {
  target: number;
  planStart: string;
  planEnd: string;
  actual: number;
  goalToDate: number;
  schedule: Row[];
  phases: PhaseStatus[];
  currentMonth: string;
}) {
  const router = useRouter();
  const ahead = actual - goalToDate;
  const current = phases.find((p) => p.state === "current");

  const toggleStep = async (id: string, status: string) => {
    await api(`/api/steps/${id}/status`, "PATCH", { status: status === "DONE" ? "TODO" : "DONE" });
    router.refresh();
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="size-4" /> {brl(target)} de faturamento de {monthName(planStart)} a {monthName(planEnd)}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <span className="text-3xl font-bold">{brl(actual)}</span>
              <span className="text-sm text-muted-foreground">{fmtPct(pct(actual, target))} da meta</span>
            </div>
            <Progress value={pct(actual, target)} />
            {currentMonth >= planStart ? (
              <p className={cn("text-sm", ahead >= 0 ? "text-success" : "text-destructive")}>
                {ahead >= 0 ? `${brl(ahead)} à frente do cronograma` : `${brl(-ahead)} atrás do cronograma`} (meta acumulada até este mês: {brl(goalToDate)}).
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">O cronograma começa em {monthName(planStart)}. Até lá: preparação e testes.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fase atual</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {current ? (
              <>
                <p className="text-lg font-semibold">{current.name}</p>
                <p className="text-sm text-muted-foreground">Portão: {gateText(current)}</p>
                {current.goalType !== "NONE" && <Progress value={pct(current.progress, current.goalValue)} />}
                {current.manualGate && (
                  <p className="text-sm text-muted-foreground">
                    {current.manualOk ? "✓" : "○"} {current.manualGate}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-success">Todas as fases concluídas.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {phases.map((p) => {
          const stepsDone = p.steps.filter((s) => s.status === "DONE").length;
          const canComplete = p.state === "current" && p.goalMet && (!p.manualGate || p.manualOk);
          return (
            <Card key={p.id} className={cn(p.state === "current" && "border-primary ring-1 ring-primary/30", p.state === "next" && "opacity-70")}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2">
                  <span className="leading-snug">{p.name}</span>
                  {p.state === "done" ? (
                    <Badge tone="success">Concluída</Badge>
                  ) : p.state === "current" ? (
                    <Badge tone="primary">Atual</Badge>
                  ) : (
                    <Lock className="size-4 text-muted-foreground" />
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {monthName(p.startMonth)}
                  {p.endMonth !== p.startMonth && ` a ${monthName(p.endMonth)}`}
                  {p.completedAt && ` · concluída em ${fmtDate(p.completedAt)}`}
                </p>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-1.5 rounded-lg bg-secondary/50 p-2.5">
                  <p className="text-xs font-medium">Meta para avançar</p>
                  <p className="text-sm">{gateText(p)}</p>
                  {p.goalType !== "NONE" && <Progress value={pct(p.progress, p.goalValue)} color={p.goalMet ? "hsl(var(--success))" : undefined} />}
                  {p.manualGate && (
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={p.manualOk}
                        disabled={p.state === "done"}
                        onChange={async () => {
                          await api(`/api/phases/${p.id}`, "PATCH", { action: "toggleManual" });
                          router.refresh();
                        }}
                      />
                      {p.manualGate}
                    </label>
                  )}
                </div>

                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground">
                    Checklist: {stepsDone} de {p.steps.length}
                  </p>
                  {p.steps.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="flex items-start gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-muted/60"
                      onClick={() => toggleStep(s.id, s.status)}
                    >
                      {s.status === "DONE" ? (
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                      ) : s.status === "DOING" ? (
                        <CircleDot className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      ) : (
                        <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className={cn(s.status === "DONE" && "text-muted-foreground line-through")}>{s.title}</span>
                    </button>
                  ))}
                </div>

                {p.state === "current" && (
                  <ActionButton
                    size="sm"
                    disabled={!canComplete}
                    title={canComplete ? "Concluir e liberar a próxima fase" : "Bata a meta da fase para avançar"}
                    action={() => api(`/api/phases/${p.id}`, "PATCH", { action: "complete" })}
                  >
                    {canComplete ? "Concluir fase" : "Meta ainda não batida"}
                  </ActionButton>
                )}
                {p.state === "done" && (
                  <ActionButton size="sm" variant="ghost" confirm="Reabrir esta fase?" action={() => api(`/api/phases/${p.id}`, "PATCH", { action: "reopen" })}>
                    Reabrir
                  </ActionButton>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cronograma de faturamento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <PlanChart data={schedule.map((r) => ({ label: r.label, goal: r.goal, actual: r.actual }))} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2">Mês</th>
                  <th className="py-2 text-right">Meta</th>
                  <th className="py-2 text-right">Realizado</th>
                  <th className="hidden py-2 text-right sm:table-cell">Lucro líquido</th>
                  <th className="hidden py-2 text-right md:table-cell">Acumulado meta</th>
                  <th className="py-2 text-right">Acumulado real</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {schedule.map((r) => (
                  <tr key={r.month} className={cn(r.month === currentMonth && "bg-accent/40 font-medium")}>
                    <td className="py-2">{r.label}</td>
                    <td className="py-2 text-right text-muted-foreground">{brl(r.goal)}</td>
                    <td className={cn("py-2 text-right", r.actual != null && r.actual >= r.goal && r.goal > 0 && "text-success")}>
                      {r.actual != null ? brl(r.actual) : "—"}
                    </td>
                    <td className={cn("hidden py-2 text-right sm:table-cell", r.profit != null && r.profit < 0 && "text-destructive")}>
                      {r.profit != null ? brl(r.profit) : "—"}
                    </td>
                    <td className="hidden py-2 text-right text-muted-foreground md:table-cell">{brl(r.accGoal)}</td>
                    <td className="py-2 text-right">{r.accActual != null ? brl(r.accActual) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            As metas mensais vêm de Metas e escala e podem ser ajustadas lá. A meta de lucro de cada mês do cronograma é 15% do faturamento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
