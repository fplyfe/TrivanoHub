"use client";

import { useRouter } from "next/navigation";
import { Check, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { FormDialog } from "@/components/app/form-dialog";
import { api } from "@/lib/client";
import type { Advice } from "@/lib/growth";
import { brl, cn, fmtDate, fmtPct } from "@/lib/utils";

type Stage = "CANDIDATE" | "TESTING" | "APPROVED" | "CHAMPION" | "PAUSED";

export type FunnelCard = {
  id: string;
  sku: string;
  name: string;
  stage: Stage;
  price: number;
  cost: number;
  packaging: number;
  shipping: number;
  weightG: number | null;
  needsCert: boolean;
  researchNotes: string | null;
  stock: number;
  minStock: number;
  supplierId: string | null;
  margin: number | null;
  breakEven: number | null;
  orders30: number;
  units30: number;
  checks: { label: string; ok: boolean; known: boolean }[];
  advice: (Advice & { suggest?: "APPROVED" | "PAUSED" }) | null;
  restock: { coverage: number | null; suggest: number; initial: number } | null;
  testStartedAt: string | null;
};

const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: "CANDIDATE", label: "Candidatos", hint: "Pesquisa: passe no filtro antes de comprar" },
  { key: "TESTING", label: "Em teste", hint: "20 a 50 unidades, Ads de R$ 10 a 20/dia" },
  { key: "APPROVED", label: "Aprovados", hint: "Repor 2 a 3× o lote inicial" },
  { key: "CHAMPION", label: "Campeões", hint: "Full, kits e mais Ads" },
  { key: "PAUSED", label: "Parados", hint: "Kit, promoção, liquidação ou troca" },
];

const toneCls = {
  good: "border-success/40 bg-success/10 text-success",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-border bg-secondary/50 text-muted-foreground",
};

function CandidateForm() {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Field label="SKU / código">
          <Input name="sku" required maxLength={40} autoFocus />
        </Field>
        <Field label="Produto" className="col-span-2">
          <Input name="name" required maxLength={120} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Preço de venda provável (R$)">
          <Input name="price" type="number" step="0.01" min="0" required />
        </Field>
        <Field label="Custo no fornecedor (R$)">
          <Input name="cost" type="number" step="0.01" min="0" required />
        </Field>
        <Field label="Frete estimado pago pela loja (R$)">
          <Input name="shipping" type="number" step="0.01" min="0" defaultValue={0} />
        </Field>
        <Field label="Peso com embalagem (g)">
          <Input name="weightG" type="number" min="0" />
        </Field>
        <Field label="Embalagem (R$)">
          <Input name="packaging" type="number" step="0.01" min="0" defaultValue={2} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="needsCert" /> Exige certificação (ANATEL, INMETRO, ANVISA) ou é marca de terceiros
      </label>
      <Field label="Anotações da pesquisa (concorrentes, vendas da categoria, fornecedor…)">
        <Textarea name="researchNotes" maxLength={500} />
      </Field>
    </>
  );
}

export function FunnelView({ cards, channelName }: { cards: FunnelCard[]; channelName: string | null }) {
  const router = useRouter();
  const move = async (id: string, stage: Stage) => {
    try {
      await api(`/api/products/${id}/stage`, "PATCH", { stage });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Margens estimadas no {channelName ?? "canal principal"} Clássico, já com o Ads configurado no canal. Ao mover para &quot;Em teste&quot;, começa a contagem
          de dias.
        </p>
        <FormDialog
          title="Novo produto candidato"
          description="Só pesquisa: o produto entra com estoque zero. Compre depois de passar no filtro."
          onSubmit={(fd) =>
            api("/api/products", "POST", {
              sku: fd.get("sku"),
              name: fd.get("name"),
              price: fd.get("price"),
              cost: fd.get("cost"),
              shipping: fd.get("shipping"),
              packaging: fd.get("packaging"),
              weightG: fd.get("weightG"),
              needsCert: fd.get("needsCert") === "on",
              researchNotes: fd.get("researchNotes"),
              stage: "CANDIDATE",
            })
          }
          trigger={
            <Button>
              <Plus /> Candidato
            </Button>
          }
        >
          <CandidateForm />
        </FormDialog>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1100px] grid-cols-5 gap-3 xl:min-w-0">
          {STAGES.map((st) => {
            const list = cards.filter((c) => c.stage === st.key);
            return (
              <div key={st.key} className="flex flex-col gap-2 rounded-xl bg-muted/40 p-2">
                <div className="px-1 pt-1">
                  <p className="flex items-center justify-between text-sm font-semibold">
                    {st.label} <Badge>{list.length}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">{st.hint}</p>
                </div>
                {list.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">—</p>}
                {list.map((c) => {
                  const passed = c.checks.filter((x) => x.ok).length;
                  return (
                    <Card key={c.id} className="shadow-none">
                      <CardContent className="grid gap-2 p-3">
                        <div>
                          <p className="text-sm font-medium leading-snug">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.sku} · {c.price ? brl(c.price) : "sem preço"} · custo {brl(c.cost)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {c.margin != null && (
                            <Badge tone={c.margin < 0 ? "danger" : c.margin < 15 ? "warning" : "success"}>margem {fmtPct(c.margin)}</Badge>
                          )}
                          {c.stage !== "CANDIDATE" && <Badge tone={c.stock <= c.minStock ? "warning" : "muted"}>{c.stock} em estoque</Badge>}
                          {c.stage !== "CANDIDATE" && <Badge>{c.orders30} vendas/30d</Badge>}
                        </div>

                        {c.stage === "CANDIDATE" && (
                          <div className="grid gap-0.5 text-xs">
                            {c.checks.map((x) => (
                              <span key={x.label} className={cn("flex items-center gap-1", !x.known ? "text-muted-foreground" : x.ok ? "text-success" : "text-destructive")}>
                                {!x.known ? <Minus className="size-3" /> : x.ok ? <Check className="size-3" /> : <X className="size-3" />}
                                {x.label}
                              </span>
                            ))}
                            <span className="mt-1 font-medium">
                              {passed} de {c.checks.length} critérios
                            </span>
                            {c.researchNotes && <span className="mt-1 text-muted-foreground">{c.researchNotes}</span>}
                          </div>
                        )}

                        {c.advice && (
                          <div className={cn("rounded-md border px-2 py-1.5 text-xs", toneCls[c.advice.tone])}>
                            <p className="font-semibold">{c.advice.title}</p>
                            <p>{c.advice.detail}</p>
                            {c.testStartedAt && <p className="mt-0.5 opacity-80">Teste desde {fmtDate(c.testStartedAt)}</p>}
                          </div>
                        )}

                        {c.restock && (
                          <div className="rounded-md border bg-secondary/50 px-2 py-1.5 text-xs text-muted-foreground">
                            {c.restock.coverage != null ? <>Estoque para ~{c.restock.coverage} dias. </> : <>Sem vendas nos últimos 30 dias. </>}
                            {c.restock.suggest > 0 ? (
                              <b className="text-foreground">Repor {c.restock.suggest} un.</b>
                            ) : (
                              <>Estoque suficiente.</>
                            )}
                            {c.breakEven != null && <> · ACOS de empate {fmtPct(c.breakEven)}</>}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          {c.advice?.suggest && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => move(c.id, c.advice!.suggest!)}>
                              {c.advice.suggest === "APPROVED" ? "Aprovar" : "Marcar parado"}
                            </Button>
                          )}
                          <Select className="h-7 flex-1 text-xs" value={c.stage} aria-label="Mover para" onChange={(e) => move(c.id, e.target.value as Stage)}>
                            {STAGES.map((s) => (
                              <option key={s.key} value={s.key}>
                                {s.key === c.stage ? `Em: ${s.label}` : `Mover para ${s.label}`}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
