import { cn } from "@/lib/utils";

/** Símbolo Trivano: três caminhos que se encontram (cores da identidade visual). */
export function TrivanoMark({ className, plain }: { className?: string; plain?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label="Trivano" className={cn("shrink-0", className)}>
      {!plain && <rect x="0" y="0" width="120" height="120" rx="28" fill="#1E4D44" />}
      <path d="M60 56 L60 26" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" />
      <path d="M60 56 L28 90" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" />
      <path d="M60 56 L92 90" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" />
      <circle cx="60" cy="22" r="9" fill="#F2B23E" />
      <circle cx="25" cy="93" r="9" fill="#F2B23E" />
      <circle cx="95" cy="93" r="9" fill="#F2B23E" />
      <circle cx="60" cy="56" r="11" fill="#FFFFFF" />
      <circle cx="60" cy="56" r="4.5" fill="#1E4D44" />
    </svg>
  );
}

/** Logotipo do app: símbolo + "trivano hub". */
export function TrivanoLogo({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span className={cn("flex items-center", lg ? "gap-3" : "gap-2")}>
      <TrivanoMark className={lg ? "size-14" : "size-8"} />
      <span className={cn("font-brand font-bold leading-none tracking-tight", lg ? "text-4xl" : "text-xl")}>
        <span className="text-primary dark:text-foreground">trivano</span>
        <span className="text-[#C98A12] dark:text-[#F2B23E]">hub</span>
      </span>
    </span>
  );
}
