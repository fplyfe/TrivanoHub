"use client";

import { ExternalLink, Mail, Pencil, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Empty } from "@/components/ui/misc";
import { DeleteButton, FormDialog } from "@/components/app/form-dialog";
import { api } from "@/lib/client";
import { SUPPLIER_STAGES, SupplierForm, supplierBody as body, type Supplier } from "@/components/app/supplier-form";

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
                {s.link && (
                  <a
                    href={s.link}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex min-w-0 items-center gap-2 text-primary hover:underline"
                    title={s.link}
                  >
                    <ExternalLink className="size-3.5 shrink-0" />
                    <span className="truncate">{s.link.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
                  </a>
                )}
                {s.notes && <p className="line-clamp-3 text-xs">{s.notes}</p>}
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge>{s._count.products} produto(s)</Badge>
                  {s.leadDays != null && <Badge>entrega em {s.leadDays} dias</Badge>}
                  {s.stage !== "APPROVED" && <Badge tone="primary">Funil: {SUPPLIER_STAGES.find((x) => x.key === s.stage)?.label}</Badge>}
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
