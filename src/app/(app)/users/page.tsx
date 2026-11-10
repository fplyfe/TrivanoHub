import { redirect } from "next/navigation";
import { db, plain } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { userPublicSelect } from "@/lib/users";
import { UsersView } from "./users-view";

export const metadata = { title: "Usuários" };

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const users = await db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select: userPublicSelect });
  return <UsersView users={plain(users)} me={session.userId} isAdmin={session.role === "ADMIN"} />;
}
