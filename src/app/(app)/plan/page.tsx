import { db, n } from "@/lib/db";
import { getSettings, monthSummary, phasesStatus } from "@/lib/biz";
import { currentMonth, MONTHS, shiftMonth } from "@/lib/dates";
import { PageHeader } from "@/components/ui/misc";
import { PlanView } from "./plan-view";

export const metadata = { title: "Plano" };

export default async function PlanPage() {
  const s = await getSettings();
  const months: string[] = [];
  for (let m = s.planStart; m <= s.planEnd && months.length < 36; m = shiftMonth(m, 1)) months.push(m);
  const now = currentMonth();
  const [goals, phases, summaries] = await Promise.all([
    db.monthlyGoal.findMany({ where: { month: { in: months } } }),
    phasesStatus(),
    Promise.all(months.map((m) => (m <= now ? monthSummary(m) : null))),
  ]);

  let accGoal = 0;
  let accActual = 0;
  const schedule = months.map((m, i) => {
    const goal = n(goals.find((g) => g.month === m)?.revenue);
    const sum = summaries[i];
    accGoal += goal;
    if (sum) accActual += sum.gross;
    return {
      month: m,
      label: `${MONTHS[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`,
      goal,
      actual: sum ? sum.gross : null,
      profit: sum ? sum.result : null,
      accGoal,
      accActual: sum ? accActual : null,
    };
  });
  const goalToDate = schedule.filter((x) => x.month <= now).reduce((a, x) => a + x.goal, 0);

  return (
    <>
      <PageHeader title="Plano" description="Meta de faturamento, cronograma e fases. Cada fase só começa quando a meta da anterior foi batida." />
      <PlanView
        target={n(s.planTarget)}
        planStart={s.planStart}
        planEnd={s.planEnd}
        actual={accActual}
        goalToDate={goalToDate}
        schedule={schedule}
        phases={phases}
        currentMonth={now}
      />
    </>
  );
}
