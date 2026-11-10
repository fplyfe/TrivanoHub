"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Circle, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Empty } from "@/components/ui/misc";
import { ActionButton, DeleteButton, FormDialog } from "@/components/app/form-dialog";
import { api } from "@/lib/client";
import { today } from "@/lib/dates";
import { ACCOUNT_TYPE_LABEL, brl, cn, fmtDate } from "@/lib/utils";

type Entry = {
  id: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  amount: number;
  date: string;
  paid: boolean;
  accountId: string | null;
  categoryId: string | null;
  supplierId: string | null;
  saleId: string | null;
  note: string | null;
  account: { name: string } | null;
  category: { name: string } | null;
  supplier: { name: string } | null;
};
type Balance = { id: string; name: string; type: keyof typeof ACCOUNT_TYPE_LABEL; balance: number };
type Category = { id: string; name: string; type: "INCOME" | "EXPENSE" };
type Opt = { id: string; name: string };

const body = (fd: FormData, type: string) => ({
  type,
  description: fd.get("description"),
  amount: fd.get("amount"),
  date: fd.get("date"),
  paid: fd.get("paid") === "on",
  accountId: fd.get("accountId"),
  categoryId: fd.get("categoryId"),
  supplierId: fd.get("supplierId"),
  note: fd.get("note"),
  repeat: fd.get("repeat") ?? 1,
});

function EntryForm({ e, type, balances, categories, suppliers }: { e?: Entry; type: "INCOME" | "EXPENSE"; balances: Balance[]; categories: Category[]; suppliers: Opt[] }) {
  return (
    <>
      <Field label="Descrição">
        <Input name="description" defaultValue={e?.description} required maxLength={120} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor (R$)">
          <Input name="amount" type="number" step="0.01" min="0.01" defaultValue={e?.amount} required />
        </Field>
        <Field label="Vencimento">
          <Input name="date" type="date" defaultValue={e?.date.slice(0, 10) ?? today()} required />
        </Field>
        <Field label="Categoria">
          <Select name="categoryId" defaultValue={e?.categoryId ?? ""}>
            <option value="">—</option>
            {categories
              .filter((c) => c.type === type)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Conta">
          <Select name="accountId" defaultValue={e?.accountId ?? ""}>
            <option value="">—</option>
            {balances.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        {type === "EXPENSE" && (
          <Field label="Fornecedor">
            <Select name="supplierId" defaultValue={e?.supplierId ?? ""}>
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {!e && (
          <Field label="Repetir por (meses)">
            <Input name="repeat" type="number" min="1" max="36" defaultValue={1} />
          </Field>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="paid" defaultChecked={e?.paid ?? false} /> Já {type === "INCOME" ? "recebido" : "pago"}
      </label>
    </>
  );
}

export function CashView({
  entries,
  balances,
  categories,
  suppliers,
  filters,
  overduePrev,
}: {
  entries: Entry[];
  balances: Balance[];
  categories: Category[];
  suppliers: Opt[];
  filters: { type: string; status: string };
  overduePrev: { count: number; amount: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const setFilter = (k: string, v: string) => {
    const next = new URLSearchParams(sp.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    router.push(`${pathname}?${next.toString()}`);
  };
  const sum = (t: string, p?: boolean) => entries.filter((e) => e.type === t && (p === undefined || e.paid === p)).reduce((a, e) => a + e.amount, 0);
  const now = today();
  const total = balances.reduce((a, b) => a + b.balance, 0);

  const newButton = (type: "INCOME" | "EXPENSE") => (
    <FormDialog
      title={type === "INCOME" ? "Nova entrada" : "Nova saída"}
      onSubmit={(fd) => api("/api/entries", "POST", body(fd, type))}
      trigger={
        <Button variant={type === "INCOME" ? "outline" : "default"}>
          <Plus /> {type === "INCOME" ? "Entrada" : "Saída"}
        </Button>
      }
    >
      <EntryForm type={type} balances={balances} categories={categories} suppliers={suppliers} />
    </FormDialog>
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <Card className="bg-accent/50">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Saldo total</p>
            <p className={cn("text-xl font-bold", total < 0 && "text-destructive")}>{brl(total)}</p>
          </CardContent>
        </Card>
        {balances.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {b.name} · {ACCOUNT_TYPE_LABEL[b.type]}
              </p>
              <p className={cn("text-xl font-bold", b.balance < 0 && "text-destructive")}>{brl(b.balance)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {overduePrev.count > 0 && (
        <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {overduePrev.count} conta(s) de meses anteriores ainda em aberto, somando {brl(overduePrev.amount)}.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select className="w-[calc(50%-0.25rem)] sm:w-auto" value={filters.type} onChange={(e) => setFilter("type", e.target.value)} aria-label="Tipo">
          <option value="">Entradas e saídas</option>
          <option value="INCOME">Só entradas</option>
          <option value="EXPENSE">Só saídas</option>
        </Select>
        <Select className="w-[calc(50%-0.25rem)] sm:w-auto" value={filters.status} onChange={(e) => setFilter("status", e.target.value)} aria-label="Situação">
          <option value="">Qualquer situação</option>
          <option value="open">Em aberto</option>
          <option value="paid">Pagos / recebidos</option>
        </Select>
        <div className="flex-1" />
        {newButton("INCOME")}
        {newButton("EXPENSE")}
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          Entradas: <b className="text-success">{brl(sum("INCOME"))}</b> ({brl(sum("INCOME", false))} a receber)
        </span>
        <span>
          Saídas: <b className="text-destructive">{brl(sum("EXPENSE"))}</b> ({brl(sum("EXPENSE", false))} a pagar)
        </span>
      </div>

      {entries.length === 0 ? (
        <Empty>Nenhum lançamento neste mês.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 p-3" />
                  <th className="p-3">Venc.</th>
                  <th className="p-3">Descrição</th>
                  <th className="hidden p-3 md:table-cell">Categoria</th>
                  <th className="hidden p-3 sm:table-cell">Conta</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="w-20 p-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((e) => {
                  const overdue = !e.paid && e.date.slice(0, 10) < now;
                  return (
                    <tr key={e.id} className="hover:bg-muted/30">
                      <td className="p-3">
                        <ActionButton
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          title={e.paid ? "Marcar como em aberto" : e.type === "INCOME" ? "Marcar como recebido" : "Marcar como pago"}
                          action={() => api(`/api/entries/${e.id}`, "PATCH")}
                        >
                          {e.paid ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-muted-foreground" />}
                        </ActionButton>
                      </td>
                      <td className={cn("whitespace-nowrap p-3", overdue && "font-medium text-destructive")}>{fmtDate(e.date).slice(0, 5)}</td>
                      <td className="p-3">
                        <div className="font-medium">{e.description}</div>
                        {e.supplier && <div className="text-xs text-muted-foreground">{e.supplier.name}</div>}
                      </td>
                      <td className="hidden p-3 text-muted-foreground md:table-cell">{e.category?.name ?? "—"}</td>
                      <td className="hidden p-3 text-muted-foreground sm:table-cell">{e.account?.name ?? "—"}</td>
                      <td className={cn("whitespace-nowrap p-3 text-right font-medium", e.type === "INCOME" ? "text-success" : "text-destructive")}>
                        {e.type === "INCOME" ? "+" : "−"} {brl(e.amount)}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end">
                          {!e.saleId && (
                            <FormDialog
                              title="Editar lançamento"
                              onSubmit={(fd) => api(`/api/entries/${e.id}`, "PUT", body(fd, e.type))}
                              trigger={
                                <Button variant="ghost" size="icon" aria-label="Editar">
                                  <Pencil />
                                </Button>
                              }
                            >
                              <EntryForm e={e} type={e.type} balances={balances} categories={categories} suppliers={suppliers} />
                            </FormDialog>
                          )}
                          <DeleteButton confirm="Excluir este lançamento?" action={() => api(`/api/entries/${e.id}`, "DELETE")} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
