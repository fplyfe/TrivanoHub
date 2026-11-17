"use client";

import { useState, type ComponentProps } from "react";
import { ExternalLink, Mail, Pencil, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Badge, Empty } from "@/components/ui/misc";
import { DeleteButton, FormDialog } from "@/components/app/form-dialog";
import { api } from "@/lib/client";
import { normalizeCompanyName, normalizeEmail, normalizePhone, normalizeUrl } from "@/lib/contact-rules";

type Rule = (v: string) => { ok: true; value: string } | { ok: false; error: string };

/** Campo que valida ao sair (e ao enviar) com a mesma regra da API; formata o valor quando válido. */
function RuledInput({ rule, optional = true, ...props }: ComponentProps<typeof Input> & { rule: Rule; optional?: boolean }) {
  const [error, setError] = useState("");
  function check(el: HTMLInputElement, format: boolean) {
    const v = el.value;
    if (optional && v.trim() === "") {
      el.setCustomValidity("");
      setError("");
      return;
    }
    const r = rule(v);
    if (r.ok) {
      if (format) el.value = r.value;
      el.setCustomValidity("");
      setError("");
    } else {
      el.setCustomValidity(r.error);
      setError(r.error);
    }
  }
  return (
    <div className="grid gap-1">
      <Input
        {...props}
        aria-invalid={error ? true : undefined}
        className={error ? "border-destructive focus-visible:ring-destructive" : undefined}
        onBlur={(e) => check(e.currentTarget, true)}
        onChange={(e) => error && check(e.currentTarget, false)}
        onInvalid={(e) => check(e.currentTarget, false)}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  link: string | null;
  leadDays: number | null;
  notes: string | null;
  active: boolean;
  _count: { products: number };
};

const body = (fd: FormData) => ({
  name: fd.get("name"),
  phone: fd.get("phone"),
  email: fd.get("email"),
  link: fd.get("link"),
  notes: fd.get("notes"),
  active: fd.get("active") !== null ? fd.get("active") === "on" : true,
});

function SupplierForm({ s }: { s?: Supplier }) {
  return (
    <>
      <Field label="Nome / razão social">
        <RuledInput name="name" rule={normalizeCompanyName} optional={false} defaultValue={s?.name} required maxLength={80} autoFocus />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Telefone / WhatsApp">
          <RuledInput
            name="phone"
            rule={normalizePhone}
            optional={false}
            required
            defaultValue={s?.phone ?? ""}
            maxLength={25}
            inputMode="tel"
            placeholder="(11) 98765-4321 ou +86…"
          />
        </Field>
        <Field label="E-mail (opcional)">
          <RuledInput name="email" rule={normalizeEmail} type="email" defaultValue={s?.email ?? ""} maxLength={120} placeholder="vendas@fornecedor.com.br" />
        </Field>
      </div>
      <Field label="Link (opcional)">
        <RuledInput
          name="link"
          rule={normalizeUrl}
          defaultValue={s?.link ?? ""}
          maxLength={500}
          inputMode="url"
          autoComplete="url"
          placeholder="loja, site ou catálogo — ex.: fornecedor.com.br"
        />
      </Field>
      <Field label="Observações (opcional: pedido mínimo, pagamento, prazo…)">
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
