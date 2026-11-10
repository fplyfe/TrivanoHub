import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function Stat({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "good" | "bad";
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("mt-1 truncate text-xl font-bold sm:text-2xl", tone === "good" && "text-success", tone === "bad" && "text-destructive")}>
            {value}
          </p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground [&_svg]:size-4">{icon}</span>}
      </CardContent>
    </Card>
  );
}

/** Linha "rótulo .... valor" usada em resumos. */
export function Row({ label, value, strong, tone }: { label: React.ReactNode; value: string; strong?: boolean; tone?: "good" | "bad" }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1.5 text-sm", strong && "border-t pt-2 font-semibold")}>
      <span className={cn(!strong && "text-muted-foreground")}>{label}</span>
      <span className={cn("whitespace-nowrap", tone === "good" && "text-success", tone === "bad" && "text-destructive")}>{value}</span>
    </div>
  );
}
