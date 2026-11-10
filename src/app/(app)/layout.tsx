import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/app/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <Sidebar userName={session.name} role={session.role} />
      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-[1920px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 2xl:px-12">{children}</div>
      </main>
    </div>
  );
}
