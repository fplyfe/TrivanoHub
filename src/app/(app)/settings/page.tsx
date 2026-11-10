import { redirect } from "next/navigation";
import { db, plain } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/biz";
import { SettingsView } from "./settings-view";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [settings, channels, accounts, categories] = await Promise.all([
    getSettings(),
    db.channel.findMany({ orderBy: { name: "asc" } }),
    db.account.findMany({ orderBy: { name: "asc" } }),
    db.category.findMany({ orderBy: [{ type: "asc" }, { group: "asc" }, { name: "asc" }] }),
  ]);
  return (
    <SettingsView
      settings={plain(settings)}
      channels={plain(channels)}
      accounts={plain(accounts)}
      categories={categories}
      me={{ name: session.name, email: session.email, role: session.role }}
    />
  );
}
