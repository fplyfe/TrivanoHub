import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { userPublicSelect } from "@/lib/users";
import { userCreateSchema } from "@/lib/validators";

export const GET = route(async () => db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select: userPublicSelect }));

export const POST = route(
  async (req) => {
    const v = userCreateSchema.parse(await readJson(req));
    return db.user.create({
      data: { name: v.name, email: v.email, role: v.role, passwordHash: await bcrypt.hash(v.password, 12) },
      select: userPublicSelect,
    });
  },
  { admin: true },
);
