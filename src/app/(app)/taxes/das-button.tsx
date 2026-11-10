"use client";

import { ActionButton } from "@/components/app/form-dialog";
import { api } from "@/lib/client";

export function ActionButtonClient({ month }: { month: string }) {
  return (
    <ActionButton size="sm" variant="outline" action={() => api("/api/taxes/das", "POST", { month })}>
      Gerar conta
    </ActionButton>
  );
}
