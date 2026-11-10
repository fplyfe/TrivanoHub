import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  ...p
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "muted" | "success" | "warning" | "danger" | "primary" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    danger: "bg-destructive/15 text-destructive",
    primary: "bg-accent text-accent-foreground",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone], className)} {...p} />
  );
}

export function Progress({ value, color, className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  );
}

export function Dot({ color, className }: { color?: string | null; className?: string }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ background: color ?? "#94a3b8" }} />;
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed p-6 text-center sm:p-10 text-sm text-muted-foreground">{children}</div>;
}
