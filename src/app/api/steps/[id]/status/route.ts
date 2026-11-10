import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";

const schema = z.object({ status: z.enum(["TODO", "DOING", "DONE"]) });

export const PATCH = route(async (req, { params }) =>
  db.growthStep.update({ where: { id: params.id }, data: schema.parse(await readJson(req)) }),
);
