"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Calculator,
  ClipboardList,
  Filter,
  Flag,
  Map,
  Megaphone,
  Landmark,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Moon,
  Package,
  Percent,
  Settings,
  ShoppingCart,
  Sun,
  Truck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrivanoLogo } from "./logo";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/sales", label: "Vendas", icon: ShoppingCart },
  { href: "/plan", label: "Plano R$ 500 mil", icon: Map },
  { href: "/funnel", label: "Funil de produtos", icon: Filter },
  { href: "/ads", label: "Ads", icon: Megaphone },
  { href: "/calculator", label: "Calculadora", icon: Calculator },
  { href: "/products", label: "Produtos e estoque", icon: Package },
  { href: "/suppliers", label: "Fornecedores", icon: Truck },
  { href: "/quotes", label: "Cotações", icon: ClipboardList },
  { href: "/cash", label: "Caixa", icon: Landmark },
  { href: "/taxes", label: "Impostos", icon: Percent },
  { href: "/investments", label: "Investimentos", icon: LineChart },
  { href: "/goals", label: "Metas e escala", icon: Flag },
  { href: "/users", label: "Usuários", icon: Users },
  { href: "/settings", label: "Configurações", icon: Settings },
];

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Alternar tema"
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem("theme", next ? "dark" : "light");
        } catch {}
      }}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center px-3" aria-label="TrivanoHub">
      <TrivanoLogo />
    </Link>
  );
}

export function Sidebar({ userName, role }: { userName: string; role: "ADMIN" | "MEMBER" }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const footer = (
    <div className="flex items-center justify-between gap-2 border-t pt-3">
      <div className="min-w-0 px-3">
        <p className="truncate text-sm font-medium">{userName}</p>
        <p className="text-[11px] text-muted-foreground">{role === "ADMIN" ? "Administrador" : "Membro"}</p>
        <button onClick={logout} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <LogOut className="size-3" /> Sair
        </button>
      </div>
      <ThemeToggle />
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-6 border-r bg-card p-4 lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        {footer}
      </aside>

      {/* Mobile */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-card/90 px-4 py-2 backdrop-blur lg:hidden">
        <Brand />
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Menu">
          <Menu />
        </Button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col gap-6 bg-card p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
                <X />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
