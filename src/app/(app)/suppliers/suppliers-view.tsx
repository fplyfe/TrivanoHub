"use client";

import { Mail, Pencil, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Badge, Empty } from "@/components/ui/misc";
import { DeleteButton, FormDialog } from "@/components/app/form-dialog";
import { api } from "@/lib/client";

type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  leadDays: number | null;
  notes: string | null;
  active: boolean;
  _count: { products: number };
};

const body = (fd: FormData) => ({
  name: fd.get("name"),
  contact: fd.get("contact"),
  phone: fd.get("phone"),
  email: fd.get("email"),
  leadDays: fd.get("leadDays"),
  notes: fd.get("notes"),
  active: fd.get("active") !== null ? fd.get("active") === "on" : true,
});

function SupplierForm({ s }: { s?: Supplier }) {
  return (
    <>
      <Field label="Nome / razão social">
        <Input name="name" defaultValue={s?.name} required maxLength={80} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contato">
          <Input name="contact" defaultValue={s?.contact ?? ""} maxLength={80} />
        </Field>
        <Field label="Telefone / WhatsApp">
          <Input name="phone" defaultValue={s?.phone ?? ""} maxLength={40} />
        </Field>
        <Field label="E-mail">
          <Input name="email" type="email" defaultValue={s?.email ?? ""} maxLength={120} />
        </Field>
        <Field label="Prazo de entrega (dias)">
          <Input name="leadDays" type="number" min="0" defaultValue={s?.leadDays ?? ""} />
        </Field>
      </div>
      <Field label="Observações (pedido mínimo, pagamento…)">
        <Textarea name="notes" defaultValue={s?.notes ?? ""} maxLength={500} />
      </Field>
      {s && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={s.active} /> Ativo
        </label>
      )}
    </>
  );
}

export function SuppliersView({ suppliers }: { suppliers: Supplier[] }) {
  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <FormDialog
          title="Novo fornecedor"
          onSubmit={(fd) => api("/api/suppliers", "POST", body(fd))}
          trigger={
            <Button>
              <Plus /> Novo fornecedor
            </Button>
          }
        >
          <SupplierForm />
        </FormDialog>
      </div>
      {suppliers.length === 0 ? (
        <Empty>Nenhum fornecedor cadastrado.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {suppliers.map((s) => (
            <Card key={s.id} className={s.active ? "" : "opacity-60"}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2">
                  <span className="leading-snug">{s.name}</span>
                  <div className="-mr-2 -mt-1 flex">
                    <FormDialog
                      title={`Editar · ${s.name}`}
                      onSubmit={(fd) => api(`/api/suppliers/${s.id}`, "PUT", body(fd))}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Editar">
                          <Pencil />
                        </Button>
                      }
                    >
                      <SupplierForm s={s} />
                    </FormDialog>
                    <DeleteButton confirm={`Excluir ${s.name}?`} action={() => api(`/api/suppliers/${s.id}`, "DELETE")} />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1.5 text-sm text-muted-foreground">
                {s.contact && <p className="text-foreground">{s.contact}</p>}
                {s.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="size-3.5" /> {s.phone}
                  </p>
                )}
                {s.email && (
                  <p className="flex items-center gap-2 truncate">
                    <Mail className="size-3.5" /> {s.email}
                  </p>
                )}
                {s.notes && <p className="line-clamp-3 text-xs">{s.notes}</p>}
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge>{s._count.products} produto(s)</Badge>
                  {s.leadDays != null && <Badge>entrega em {s.leadDays} dias</Badge>}
                  {!s.active && <Badge tone="danger">Inativo</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
