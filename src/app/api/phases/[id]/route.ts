import { db } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/api";
import { phasesStatus } from "@/lib/biz";
import { toDate, today } from "@/lib/dates";
import { phaseActionSchema } from "@/lib/validators";

/** Marca o critério manual, conclui a fase (só com o portão batido) ou reabre. */
export const PATCH = route(async (req, { params }) => {
  const { action } = phaseActionSchema.parse(await readJson(req));
  const phase = await db.planPhase.findUniqueOrThrow({ where: { id: params.id } });
  if (action === "toggleManual") return db.planPhase.update({ where: { id: phase.id }, data: { manualOk: !phase.manualOk } });
  if (action === "reopen") return db.planPhase.update({ where: { id: phase.id }, data: { completedAt: null } });
  const st = (await phasesStatus()).find((p) => p.id === phase.id)!;
  if (st.state !== "current") throw new HttpError(400, "Conclua as fases anteriores primeiro");
  if (!st.goalMet) throw new HttpError(400, "A meta da fase ainda não foi batida");
  if (phase.manualGate && !phase.manualOk) throw new HttpError(400, `Confirme antes: ${phase.manualGate}`);
  return db.planPhase.update({ where: { id: phase.id }, data: { completedAt: toDate(today()) } });
});
