"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, PageHeader } from "@/components/ui/misc";
import { DeleteButton, FormDialog } from "@/components/app/form-dialog";
import { api } from "@/lib/client";
import { ML_FEE_TIERS, type FeeTier } from "@/lib/pricing";
import { ACCOUNT_TYPE_LABEL, brl, fmtPct, GROUP_LABEL, REGIME_LABEL } from "@/lib/utils";

type Settings = { companyName: string; regime: keyof typeof REGIME_LABEL; manualTaxRate: number; rbt12Override: number | null; minMargin: number; planTarget: number; planStart: string; planEnd: string };
type Channel = {
  id: string;
  name: string;
  commissionClassic: number;
  commissionPremium: number;
  fixedFee: number;
  fixedFeeThreshold: number;
  feeTiers: FeeTier[] | null;
  feeOwnShippingOnly: boolean;
  adsRate: number;
  releaseDays: number;
  accountId: string | null;
  active: boolean;
};
type Account = { id: string; name: string; type: keyof typeof ACCOUNT_TYPE_LABEL; initialBalance: number; active: boolean };
type Category = { id: string; name: string; type: "INCOME" | "EXPENSE"; group: keyof typeof GROUP_LABEL };
type Me = { name: string; email: string; role: "ADMIN" | "MEMBER" };

const bool = (fd: FormData, k: string) => (fd.get(k) !== null ? fd.get(k) === "on" : true);

function CompanyCard({ s, isAdmin }: { s: Settings; isAdmin: boolean }) {
  const router = useRouter();
  const [regime, setRegime] = useState(s.regime);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Empresa e impostos</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            try {
              await api("/api/settings", "PUT", {
                companyName: fd.get("companyName"),
                regime: fd.get("regime"),
                manualTaxRate: fd.get("manualTaxRate") || 0,
                rbt12Override: fd.get("rbt12Override"),
                minMargin: fd.get("minMargin"),
                planTarget: fd.get("planTarget"),
                planStart: fd.get("planStart"),
                planEnd: fd.get("planEnd"),
              });
              setMsg({ ok: true, text: "Configurações salvas. Novas vendas já usam os valores atualizados." });
              router.refresh();
            } catch (err) {
              setMsg({ ok: false, text: err instanceof Error ? err.message : "Erro" });
            }
          }}
        >
          <fieldset disabled={!isAdmin} className="grid gap-3">
            <Field label="Nome da empresa">
              <Input name="companyName" defaultValue={s.companyName} required maxLength={80} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Regime tributário" className="col-span-2">
                <Select name="regime" value={regime} onChange={(e) => setRegime(e.target.value as Settings["regime"])}>
                  {Object.entries(REGIME_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              {regime === "MANUAL" && (
                <Field label="Alíquota sobre a venda (%)">
                  <Input name="manualTaxRate" type="number" step="0.01" min="0" max="100" defaultValue={s.manualTaxRate} />
                </Field>
              )}
              {regime === "SIMPLES" && (
                <Field label="RBT12 manual (opcional)">
                  <Input name="rbt12Override" type="number" step="0.01" min="0" defaultValue={s.rbt12Override ?? ""} placeholder="calculado pelas vendas" />
                </Field>
              )}
              <Field label="Margem mínima para alerta (%)">
                <Input name="minMargin" type="number" step="0.1" min="0" max="100" defaultValue={s.minMargin} />
              </Field>
              <Field label="Meta do plano (R$)">
                <Input name="planTarget" type="number" step="1" min="0" defaultValue={s.planTarget} />
              </Field>
              <Field label="Plano de (mês)">
                <Input name="planStart" type="month" defaultValue={s.planStart} />
              </Field>
              <Field label="até (mês)">
                <Input name="planEnd" type="month" defaultValue={s.planEnd} />
              </Field>
            </div>
            {regime === "SIMPLES" && (
              <p className="text-xs text-muted-foreground">
                Sem RBT12 manual, o sistema soma as vendas dos 12 meses anteriores (proporcionalizado se a loja tem menos de 12 meses). Informe o valor à mão se começou a usar o sistema agora.
              </p>
            )}
            {regime === "MEI" && <p className="text-xs text-muted-foreground">No MEI o DAS é fixo: lance-o no Caixa como despesa fixa mensal.</p>}
          </fieldset>
          {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>}
          {isAdmin && (
            <Button type="submit" className="justify-self-start">
              Salvar
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

const TIER_ROWS = 5;
type TierRow = { below: string; fee: string; half: boolean };
const toRows = (t: FeeTier[] | null | undefined): TierRow[] => {
  const rows = (t ?? []).map((x) => ({ below: String(x.below), fee: x.half ? "" : String(x.fee), half: !!x.half }));
  while (rows.length < TIER_ROWS) rows.push({ below: "", fee: "", half: false });
  return rows.slice(0, TIER_ROWS);
};

/** Faixas de tarifa por unidade: "abaixo de R$ X paga R$ Y" (ou metade do preço). */
function FeeTiersEditor({ c }: { c?: Channel }) {
  const [rows, setRows] = useState<TierRow[]>(toRows(c?.feeTiers));
  const [ownOnly, setOwnOnly] = useState(c?.feeOwnShippingOnly ?? false);
  const upd = (i: number, patch: Partial<TierRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <fieldset className="grid gap-2 rounded-lg border p-3">
      <legend className="px-1 text-xs font-medium text-muted-foreground">Tarifa por unidade por faixa de preço</legend>
      <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 text-xs text-muted-foreground">
        <span>Preço abaixo de (R$)</span>
        <span>Tarifa (R$/un.)</span>
        <span>½ preço</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <Input name={`tierBelow_${i}`} type="number" step="0.01" min="0" value={r.below} onChange={(e) => upd(i, { below: e.target.value })} aria-label={`Faixa ${i + 1}: preço abaixo de`} />
          <Input
            name={`tierFee_${i}`}
            type="number"
            step="0.01"
            min="0"
            value={r.fee}
            disabled={r.half}
            onChange={(e) => upd(i, { fee: e.target.value })}
            aria-label={`Faixa ${i + 1}: tarifa`}
          />
          <input type="checkbox" name={`tierHalf_${i}`} checked={r.half} onChange={(e) => upd(i, { half: e.target.checked })} className="justify-self-center" aria-label={`Faixa ${i + 1}: metade do preço`} />
        </div>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="feeOwnShippingOnly" checked={ownOnly} onChange={(e) => setOwnOnly(e.target.checked)} />
        Cobrar só no Flex/envio próprio (Full, Coleta e Agência não pagam)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setRows(toRows(ML_FEE_TIERS));
            setOwnOnly(true);
          }}
        >
          Usar tabela do Mercado Livre
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setRows(toRows([]))}>
          Limpar faixas
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Com faixas preenchidas, elas substituem a tarifa única acima. Confira os valores no simulador de custos do Mercado Livre: eles mudam de tempos em tempos.
      </p>
    </fieldset>
  );
}

function ChannelForm({ c, accounts }: { c?: Channel; accounts: Account[] }) {
  return (
    <>
      <Field label="Nome do canal">
        <Input name="name" defaultValue={c?.name} required maxLength={40} autoFocus={!c} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Comissão Clássico (%)">
          <Input name="commissionClassic" type="number" step="0.01" min="0" max="100" defaultValue={c?.commissionClassic ?? 12} required />
        </Field>
        <Field label="Comissão Premium (%)">
          <Input name="commissionPremium" type="number" step="0.01" min="0" max="100" defaultValue={c?.commissionPremium ?? 17} required />
        </Field>
        <Field label="Tarifa única por unidade (R$)">
          <Input name="fixedFee" type="number" step="0.01" min="0" defaultValue={c?.fixedFee ?? 0} required />
        </Field>
        <Field label="Cobrada abaixo de (R$)">
          <Input name="fixedFeeThreshold" type="number" step="0.01" min="0" defaultValue={c?.fixedFeeThreshold ?? 79} required />
        </Field>
      </div>
      <FeeTiersEditor c={c} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Anúncios pagos (% da venda)">
          <Input name="adsRate" type="number" step="0.01" min="0" max="100" defaultValue={c?.adsRate ?? 0} />
        </Field>
        <Field label="Dias até liberar o dinheiro">
          <Input name="releaseDays" type="number" min="0" max="120" defaultValue={c?.releaseDays ?? 0} required />
        </Field>
        <Field label="Conta que recebe" className="col-span-2">
          <Select name="accountId" defaultValue={c?.accountId ?? ""}>
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {c && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={c.active} /> Canal ativo
        </label>
      )}
      <p className="text-xs text-muted-foreground">
        A comissão padrão vale para produtos sem comissão própria (a da categoria fica no cadastro do produto). Mudanças valem só para vendas novas.
      </p>
    </>
  );
}

const tiersFrom = (fd: FormData) => {
  const out: { below: string; fee: string; half: boolean }[] = [];
  for (let i = 0; i < TIER_ROWS; i++) {
    const below = String(fd.get(`tierBelow_${i}`) ?? "").trim();
    if (!below) continue;
    out.push({ below, fee: String(fd.get(`tierFee_${i}`) ?? "").trim() || "0", half: fd.get(`tierHalf_${i}`) === "on" });
  }
  return out;
};

const channelBody = (fd: FormData) => ({
  name: fd.get("name"),
  commissionClassic: fd.get("commissionClassic"),
  commissionPremium: fd.get("commissionPremium"),
  fixedFee: fd.get("fixedFee"),
  fixedFeeThreshold: fd.get("fixedFeeThreshold"),
  feeTiers: tiersFrom(fd),
  feeOwnShippingOnly: fd.get("feeOwnShippingOnly") === "on",
  adsRate: fd.get("adsRate") || 0,
  releaseDays: fd.get("releaseDays"),
  accountId: fd.get("accountId"),
  active: bool(fd, "active"),
});

function AccountForm({ a }: { a?: Account }) {
  return (
    <>
      <Field label="Nome">
        <Input name="name" defaultValue={a?.name} required maxLength={40} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <Select name="type" defaultValue={a?.type ?? "BANK"}>
            {Object.entries(ACCOUNT_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Saldo inicial (R$)">
          <Input name="initialBalance" type="number" step="0.01" defaultValue={a?.initialBalance ?? 0} />
        </Field>
      </div>
      {a && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={a.active} /> Conta ativa
        </label>
      )}
    </>
  );
}

const accountBody = (fd: FormData) => ({ name: fd.get("name"), type: fd.get("type"), initialBalance: fd.get("initialBalance") || 0, active: bool(fd, "active") });

function CategoryForm({ c }: { c?: Category }) {
  return (
    <>
      <Field label="Nome">
        <Input name="name" defaultValue={c?.name} required maxLength={40} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <Select name="type" defaultValue={c?.type ?? "EXPENSE"}>
            <option value="EXPENSE">Saída</option>
            <option value="INCOME">Entrada</option>
          </Select>
        </Field>
        <Field label="Entra no resultado como">
          <Select name="group" defaultValue={c?.group ?? "FIXED"}>
            {Object.entries(GROUP_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Só despesas fixas e variáveis reduzem o lucro do mês. Compras de mercadoria viram estoque; o imposto já é estimado em cada venda; retiradas aparecem à parte.
      </p>
    </>
  );
}

const categoryBody = (fd: FormData) => ({ name: fd.get("name"), type: fd.get("type"), group: fd.get("group") });

function ProfileCard({ me }: { me: { name: string; email: string; role: "ADMIN" | "MEMBER" } }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Meu perfil
          <Link href="/users" className="flex items-center gap-1 text-xs font-normal text-primary hover:underline">
            <Users className="size-3.5" /> Gerenciar usuários
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid max-w-md gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            try {
              await api("/api/auth/profile", "PUT", { name: fd.get("name"), email: fd.get("email") });
              setMsg({ ok: true, text: "Perfil atualizado." });
              router.refresh();
            } catch (err) {
              setMsg({ ok: false, text: err instanceof Error ? err.message : "Erro" });
            }
          }}
        >
          <Field label="Nome">
            <Input name="name" defaultValue={me.name} required maxLength={60} />
          </Field>
          <Field label="E-mail (login)">
            <Input name="email" type="email" defaultValue={me.email} required maxLength={120} />
          </Field>
          <p className="text-xs text-muted-foreground">Perfil de acesso: {me.role === "ADMIN" ? "Administrador" : "Membro"}</p>
          {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>}
          <Button type="submit" className="justify-self-start">
            Salvar perfil
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alterar minha senha</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid max-w-md gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            try {
              await api("/api/auth/password", "POST", { current: fd.get("current"), next: fd.get("next") });
              setMsg({ ok: true, text: "Senha alterada com sucesso." });
              form.reset();
            } catch (err) {
              setMsg({ ok: false, text: err instanceof Error ? err.message : "Erro" });
            }
          }}
        >
          <Field label="Senha atual">
            <Input name="current" type="password" autoComplete="current-password" required />
          </Field>
          <Field label="Nova senha (mín. 8 caracteres)">
            <Input name="next" type="password" autoComplete="new-password" minLength={8} required />
          </Field>
          {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>}
          <Button type="submit" className="justify-self-start">
            Alterar senha
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function SettingsView({
  settings,
  channels,
  accounts,
  categories,
  me,
}: {
  settings: Settings;
  channels: Channel[];
  accounts: Account[];
  categories: Category[];
  me: Me;
}) {
  const isAdmin = me.role === "ADMIN";
  const editBtn = (
    <Button variant="ghost" size="icon" aria-label="Editar">
      <Pencil />
    </Button>
  );
  return (
    <>
      <PageHeader title="Configurações" description={isAdmin ? "Empresa, canais, contas, categorias e seu perfil" : "Seu perfil e senha. Os demais itens só o administrador altera."} />

      <div className="grid gap-4 xl:grid-cols-2">
        <CompanyCard s={settings} isAdmin={isAdmin} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Canais de venda e tarifas
              {isAdmin && (
                <FormDialog
                  title="Novo canal"
                  onSubmit={(fd) => api("/api/channels", "POST", channelBody(fd))}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Plus /> Canal
                    </Button>
                  }
                >
                  <ChannelForm accounts={accounts} />
                </FormDialog>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {channels.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {c.name} {!c.active && <Badge tone="danger">Inativo</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Clássico {fmtPct(c.commissionClassic)} · Premium {fmtPct(c.commissionPremium)}
                    {c.feeTiers && c.feeTiers.length > 0
                      ? ` · tarifa por faixa (${c.feeTiers.map((t) => `<${brl(t.below)}: ${t.half ? "½ preço" : brl(t.fee)}`).join(", ")})${c.feeOwnShippingOnly ? " só no Flex/envio próprio" : ""}`
                      : c.fixedFee > 0 && ` · ${brl(c.fixedFee)}/un. abaixo de ${brl(c.fixedFeeThreshold)}`}
                    {c.adsRate > 0 && ` · ads ${fmtPct(c.adsRate)}`} · libera em {c.releaseDays} dias
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0">
                    <FormDialog title={`Editar · ${c.name}`} onSubmit={(fd) => api(`/api/channels/${c.id}`, "PUT", channelBody(fd))} trigger={editBtn}>
                      <ChannelForm c={c} accounts={accounts} />
                    </FormDialog>
                    <DeleteButton confirm={`Excluir ${c.name}? Canais com vendas não podem ser excluídos (desative-os).`} action={() => api(`/api/channels/${c.id}`, "DELETE")} />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Contas
              {isAdmin && (
                <FormDialog
                  title="Nova conta"
                  onSubmit={(fd) => api("/api/accounts", "POST", accountBody(fd))}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Plus /> Conta
                    </Button>
                  }
                >
                  <AccountForm />
                </FormDialog>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {a.name} <span className="text-xs text-muted-foreground">· {ACCOUNT_TYPE_LABEL[a.type]} · saldo inicial {brl(a.initialBalance)}</span>
                  {!a.active && <Badge tone="danger" className="ml-1">Inativa</Badge>}
                </span>
                {isAdmin && (
                  <div className="flex shrink-0">
                    <FormDialog title={`Editar · ${a.name}`} onSubmit={(fd) => api(`/api/accounts/${a.id}`, "PUT", accountBody(fd))} trigger={editBtn}>
                      <AccountForm a={a} />
                    </FormDialog>
                    <DeleteButton confirm={`Excluir a conta ${a.name}? Lançamentos ficarão sem conta.`} action={() => api(`/api/accounts/${a.id}`, "DELETE")} />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Categorias do caixa
              {isAdmin && (
                <FormDialog
                  title="Nova categoria"
                  onSubmit={(fd) => api("/api/categories", "POST", categoryBody(fd))}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Plus /> Categoria
                    </Button>
                  }
                >
                  <CategoryForm />
                </FormDialog>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {c.name} <span className="text-xs text-muted-foreground">· {c.type === "INCOME" ? "Entrada" : "Saída"} · {GROUP_LABEL[c.group]}</span>
                </span>
                {isAdmin && (
                  <div className="flex shrink-0">
                    <FormDialog title="Editar categoria" onSubmit={(fd) => api(`/api/categories/${c.id}`, "PUT", categoryBody(fd))} trigger={editBtn}>
                      <CategoryForm c={c} />
                    </FormDialog>
                    <DeleteButton confirm={`Excluir "${c.name}"? Os lançamentos ficarão sem categoria.`} action={() => api(`/api/categories/${c.id}`, "DELETE")} />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <ProfileCard me={me} />
        <PasswordCard />
      </div>
    </>
  );
}
