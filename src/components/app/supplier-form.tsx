"use client";

import { useState, type ComponentProps } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  normalizeCompanyName,
  normalizeEmail,
  normalizePhone,
  normalizeUrl,
} from "@/lib/contact-rules";

export type SupplierStage =
  | "PROSPECT"
  | "CONTACTED"
  | "CATALOG"
  | "PRICING"
  | "NEGOTIATING"
  | "APPROVED"
  | "DISCARDED";

/** Etapas do funil de fornecedores, na ordem das colunas. */
export const SUPPLIER_STAGES: {
  key: SupplierStage;
  label: string;
  hint: string;
}[] = [
  { key: "PROSPECT", label: "Encontrado", hint: "Achado, ainda sem contato" },
  {
    key: "CONTACTED",
    label: "Contato feito",
    hint: "Mensagem enviada, aguardando resposta",
  },
  {
    key: "CATALOG",
    label: "Catálogo recebido",
    hint: "Preços, pedido mínimo e prazos em mãos",
  },
  {
    key: "PRICING",
    label: "Precificando",
    hint: "Conferindo a margem na calculadora",
  },
  {
    key: "NEGOTIATING",
    label: "Negociando",
    hint: "Desconto, amostra e condições",
  },
  { key: "APPROVED", label: "Aprovado", hint: "Pronto para cotar e comprar" },
  {
    key: "DISCARDED",
    label: "Descartado",
    hint: "Não serve agora (anote o motivo)",
  },
];

/** Link do WhatsApp a partir do telefone salvo (celular BR ou internacional). */
export function whatsappLink(phone: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return d.length >= 8 ? `https://wa.me/${d}` : null;
  if (d.length === 11 && d[2] === "9") return `https://wa.me/55${d}`;
  return null;
}

type Rule = (
  v: string,
) => { ok: true; value: string } | { ok: false; error: string };

/** Campo que valida ao sair (e ao enviar) com a mesma regra da API; formata o valor quando válido. */
export function RuledInput({
  rule,
  optional = true,
  ...props
}: ComponentProps<typeof Input> & { rule: Rule; optional?: boolean }) {
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
        className={
          error
            ? "border-destructive focus-visible:ring-destructive"
            : undefined
        }
        onBlur={(e) => check(e.currentTarget, true)}
        onChange={(e) => error && check(e.currentTarget, false)}
        onInvalid={(e) => check(e.currentTarget, false)}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  link: string | null;
  leadDays: number | null;
  notes: string | null;
  active: boolean;
  stage: SupplierStage;
  stageAt: string;
  nextStep: string | null;
  followUpAt: string | null;
  _count: { products: number; offers?: number };
};

/** Corpo enviado à API. Campos que o formulário não mostra ficam de fora (a API mantém o que está salvo). */
export const supplierBody = (fd: FormData) => {
  const b: Record<string, FormDataEntryValue | boolean | null> = {
    name: fd.get("name"),
    phone: fd.get("phone"),
    email: fd.get("email"),
    link: fd.get("link"),
    notes: fd.get("notes"),
  };
  if (fd.has("activeShown")) b.active = fd.get("active") === "on";
  if (fd.has("stage")) b.stage = fd.get("stage");
  if (fd.has("nextStep")) b.nextStep = fd.get("nextStep");
  if (fd.has("followUpAt")) b.followUpAt = fd.get("followUpAt");
  return b;
};

export function SupplierForm({
  s,
  funnel = false,
  initialStage,
}: {
  s?: Supplier;
  funnel?: boolean;
  initialStage?: SupplierStage;
}) {
  return (
    <>
      <Field label="Nome / razão social">
        <RuledInput
          name="name"
          rule={normalizeCompanyName}
          optional={false}
          defaultValue={s?.name}
          required
          maxLength={80}
          autoFocus
        />
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
          <RuledInput
            name="email"
            rule={normalizeEmail}
            type="email"
            defaultValue={s?.email ?? ""}
            maxLength={120}
            placeholder="vendas@fornecedor.com.br"
          />
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
      {funnel && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Próximo passo (opcional)">
            <Input
              name="nextStep"
              defaultValue={s?.nextStep ?? ""}
              maxLength={120}
              placeholder="ex.: cobrar catálogo, pedir amostra"
            />
          </Field>
          <Field label="Até quando">
            <Input
              name="followUpAt"
              type="date"
              defaultValue={s?.followUpAt?.slice(0, 10) ?? ""}
            />
          </Field>
        </div>
      )}
      {funnel && !s && (
        <Field label="Etapa">
          <Select name="stage" defaultValue={initialStage ?? "PROSPECT"}>
            {SUPPLIER_STAGES.map((st) => (
              <option key={st.key} value={st.key}>
                {st.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {s && !funnel && (
        <label className="flex items-center gap-2 text-sm">
          <input type="hidden" name="activeShown" value="1" />
          <input type="checkbox" name="active" defaultChecked={s.active} />{" "}
          Ativo
        </label>
      )}
    </>
  );
}
