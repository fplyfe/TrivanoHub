"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Diálogo com formulário: envia FormData, mostra erro, fecha e atualiza a página. */
export function FormDialog({
  trigger,
  title,
  description,
  submitLabel = "Salvar",
  onSubmit,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  submitLabel?: string;
  onSubmit: (fd: FormData) => Promise<unknown>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await onSubmit(fd);
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setError("");
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? "" : "sr-only"}>{description ?? title}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handle} className="grid gap-4">
          {children}
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Botão que executa uma ação (com confirmação opcional) e atualiza a página. */
export function ActionButton({
  action,
  confirm: confirmMsg,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick"> & { action: () => Promise<unknown>; confirm?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      {...props}
      disabled={busy || props.disabled}
      onClick={async () => {
        if (confirmMsg && !window.confirm(confirmMsg)) return;
        setBusy(true);
        try {
          await action();
          router.refresh();
        } catch (e) {
          window.alert(e instanceof Error ? e.message : "Erro inesperado");
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
    </Button>
  );
}

export function DeleteButton({ action, confirm }: { action: () => Promise<unknown>; confirm: string }) {
  return (
    <ActionButton action={action} confirm={confirm} variant="ghost" size="icon" title="Excluir" aria-label="Excluir">
      <Trash2 className="text-destructive" />
    </ActionButton>
  );
}
