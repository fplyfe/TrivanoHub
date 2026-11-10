"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monthLabel, shiftMonth } from "@/lib/dates";

/** Navegação de mês via query string (?month=AAAA-MM), preservando os demais filtros. */
export function MonthNav({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const go = (m: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set("month", m);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
      <Button variant="ghost" size="icon" onClick={() => go(shiftMonth(month, -1))} aria-label="Mês anterior">
        <ChevronLeft />
      </Button>
      <span className="min-w-28 text-center text-sm font-medium capitalize">{monthLabel(month, true)}</span>
      <Button variant="ghost" size="icon" onClick={() => go(shiftMonth(month, 1))} aria-label="Próximo mês">
        <ChevronRight />
      </Button>
    </div>
  );
}
