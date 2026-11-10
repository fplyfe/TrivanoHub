"use client";

import { useState } from "react";
import { KeyRound, Pencil, Plus, ShieldCheck, UserRound, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, PageHeader } from "@/components/ui/misc";
import { DeleteButton, FormDialog } from "@/components/app/form-dialog";
import { api } from "@/lib/client";
import { cn, fmtDate } from "@/lib/utils";

type User = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

/** Campo de senha com botão "Gerar" (a senha gerada fica visível para ser repassada). */
function PasswordField({ label }: { label: string }) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <Input
          name="password"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          minLength={8}
          required
          autoComplete="new-password"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setValue(randomPassword());
            setShow(true);
          }}
        >
          <Wand2 /> Gerar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Mínimo 8 caracteres. Repasse a senha ao usuário; ele pode trocá-la em Configurações.</p>
    </Field>
  );
}

function RoleSelect({ value, disabled }: { value?: User["role"]; disabled?: boolean }) {
  return (
    <Field label="Perfil de acesso">
      <Select name="role" defaultValue={value ?? "MEMBER"} disabled={disabled}>
        <option value="MEMBER">Membro: usa o sistema normalmente</option>
        <option value="ADMIN">Administrador: também gerencia usuários</option>
      </Select>
    </Field>
  );
}

export function UsersView({ users, me, isAdmin }: { users: User[]; me: string; isAdmin: boolean }) {
  const active = users.filter((u) => u.active).length;
  return (
    <>
      <PageHeader title="Usuários" description={`${active} ativo(s) de ${users.length}. Todos compartilham as mesmas contas e lançamentos.`}>
        {isAdmin && (
          <FormDialog
            title="Novo usuário"
            description="O usuário entra com este e-mail e senha."
            onSubmit={(fd) => api("/api/users", "POST", Object.fromEntries(fd))}
            trigger={
              <Button>
                <Plus /> Novo usuário
              </Button>
            }
          >
            <Field label="Nome">
              <Input name="name" required maxLength={60} autoFocus />
            </Field>
            <Field label="E-mail (login)">
              <Input name="email" type="email" required maxLength={120} autoComplete="off" />
            </Field>
            <PasswordField label="Senha inicial" />
            <RoleSelect />
          </FormDialog>
        )}
      </PageHeader>

      {!isAdmin && (
        <p className="mb-4 rounded-lg bg-secondary px-4 py-3 text-sm text-muted-foreground">
          Apenas administradores podem cadastrar, editar ou desativar usuários.
        </p>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Usuário</th>
                <th className="p-3">Perfil</th>
                <th className="p-3">Status</th>
                <th className="hidden p-3 md:table-cell">Último acesso</th>
                {isAdmin && <th className="w-32 p-3" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => {
                const self = u.id === me;
                return (
                  <tr key={u.id} className={cn(!u.active && "opacity-60")}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-foreground">
                          {u.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {u.name} {self && <span className="text-xs text-muted-foreground">(você)</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      {u.role === "ADMIN" ? (
                        <Badge tone="primary" className="gap-1">
                          <ShieldCheck className="size-3" /> Administrador
                        </Badge>
                      ) : (
                        <Badge className="gap-1">
                          <UserRound className="size-3" /> Membro
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">{u.active ? <Badge tone="success">Ativo</Badge> : <Badge tone="danger">Desativado</Badge>}</td>
                    <td className="hidden p-3 text-muted-foreground md:table-cell">
                      {u.lastLoginAt ? fmtDate(u.lastLoginAt) : "Nunca acessou"}
                    </td>
                    {isAdmin && (
                      <td className="p-3">
                        <div className="flex justify-end">
                          <FormDialog
                            title={`Editar · ${u.name}`}
                            onSubmit={(fd) =>
                              api(`/api/users/${u.id}`, "PUT", {
                                name: fd.get("name"),
                                email: fd.get("email"),
                                role: self ? u.role : fd.get("role"),
                                active: self ? true : fd.get("active") === "on",
                              })
                            }
                            trigger={
                              <Button variant="ghost" size="icon" aria-label="Editar" title="Editar">
                                <Pencil />
                              </Button>
                            }
                          >
                            <Field label="Nome">
                              <Input name="name" defaultValue={u.name} required maxLength={60} />
                            </Field>
                            <Field label="E-mail (login)">
                              <Input name="email" type="email" defaultValue={u.email} required maxLength={120} />
                            </Field>
                            <RoleSelect value={u.role} disabled={self} />
                            <label className={cn("flex items-center gap-2 text-sm", self && "opacity-60")}>
                              <input type="checkbox" name="active" defaultChecked={u.active} disabled={self} className="size-4 accent-[hsl(var(--primary))]" />
                              Acesso ativo (desmarque para bloquear o login sem apagar o histórico)
                            </label>
                            {self && <p className="text-xs text-muted-foreground">Você não pode mudar seu próprio perfil nem se desativar.</p>}
                          </FormDialog>
                          {!self && (
                            <>
                              <FormDialog
                                title={`Redefinir senha · ${u.name}`}
                                description="As sessões abertas desse usuário serão encerradas."
                                submitLabel="Redefinir senha"
                                onSubmit={(fd) => api(`/api/users/${u.id}/password`, "POST", { password: fd.get("password") })}
                                trigger={
                                  <Button variant="ghost" size="icon" aria-label="Redefinir senha" title="Redefinir senha">
                                    <KeyRound />
                                  </Button>
                                }
                              >
                                <PasswordField label="Nova senha" />
                              </FormDialog>
                              <DeleteButton
                                confirm={`Excluir "${u.name}"? Só é possível se ele não tiver lançamentos; caso tenha, desative o acesso.`}
                                action={() => api(`/api/users/${u.id}`, "DELETE")}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
