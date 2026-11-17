"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ExternalLink, GripVertical, Mail, MessageCircle, Pencil, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { DeleteButton, FormDialog } from "@/components/app/form-dialog";
import { SUPPLIER_STAGES, SupplierForm, supplierBody, whatsappLink, type Supplier, type SupplierStage } from "@/components/app/supplier-form";
import { api } from "@/lib/client";
import { today } from "@/lib/dates";
import { cn, fmtDate } from "@/lib/utils";

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86_400_000);

function FollowUp({ s }: { s: Supplier }) {
  if (!s.nextStep && !s.followUpAt) return null;
  const late = s.followUpAt ? daysBetween(today(), s.followUpAt) : null;
  const tone = late == null ? "muted" : late < 0 ? "danger" : late === 0 ? "warning" : "muted";
  const when = late == null ? "" : late < 0 ? `atrasado ${-late}d` : late === 0 ? "hoje" : late === 1 ? "amanhã" : fmtDate(s.followUpAt);
  return (
    <div className="flex items-start gap-1.5 text-xs">
      <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">{s.nextStep ?? "Retomar contato"}</span>
      {when && <Badge tone={tone}>{when}</Badge>}
    </div>
  );
}

export function SupplierFunnelView({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [items, setItems] = useState(suppliers);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<SupplierStage | null>(null);
  useEffect(() => setItems(suppliers), [suppliers]);

  async function move(id: string, stage: SupplierStage) {
    const before = items;
    const cur = items.find((x) => x.id === id);
    if (!cur || cur.stage === stage) return;
    setItems(items.map((x) => (x.id === id ? { ...x, stage, stageAt: new Date().toISOString(), active: stage !== "DISCARDED" } : x)));
    try {
      await api(`/api/suppliers/${id}/funnel`, "PATCH", { stage });
      router.refresh();
    } catch (e) {
      setItems(before);
      alert(e instanceof Error ? e.message : "Erro ao mover");
    }
  }

  const overdue = items.filter((s) => s.stage !== "DISCARDED" && s.followUpAt && daysBetween(today(), s.followUpAt) < 0).length;
  const dueToday = items.filter((s) => s.stage !== "DISCARDED" && s.followUpAt && daysBetween(today(), s.followUpAt) === 0).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 text-sm">
          {overdue > 0 && <Badge tone="danger">{overdue} com retorno atrasado</Badge>}
          {dueToday > 0 && <Badge tone="warning">{dueToday} para hoje</Badge>}
          {overdue === 0 && dueToday === 0 && <span className="text-muted-foreground">Nenhum retorno pendente para hoje.</span>}
        </div>
        <FormDialog
          title="Novo fornecedor no funil"
          onSubmit={(fd) => api("/api/suppliers", "POST", supplierBody(fd))}
          trigger={
            <Button>
              <Plus /> Fornecedor
            </Button>
          }
        >
          <SupplierForm funnel />
        </FormDialog>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="flex gap-3">
          {SUPPLIER_STAGES.map((st) => {
            const list = items.filter((s) => s.stage === st.key);
            return (
              <div
                key={st.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(st.key);
                }}
                onDragLeave={() => setOver((o) => (o === st.key ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = e.dataTransfer.getData("text/plain") || dragId;
                  if (id) move(id, st.key);
                }}
                className={cn(
                  "flex w-64 shrink-0 flex-col gap-2 rounded-xl bg-muted/40 p-2 transition-colors",
                  over === st.key && "bg-primary/10 ring-2 ring-primary/40",
                  st.key === "DISCARDED" && "opacity-80",
                )}
              >
                <div className="px-1 pt-1">
                  <p className="flex items-center justify-between text-sm font-semibold">
                    {st.label} <Badge tone={st.key === "APPROVED" ? "success" : "muted"}>{list.length}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">{st.hint}</p>
                </div>
                {list.length === 0 && <p className="rounded-lg border border-dashed px-1 py-6 text-center text-xs text-muted-foreground">Arraste para cá</p>}
                {list.map((s) => {
                  const wa = whatsappLink(s.phone);
                  const days = Math.max(0, daysBetween(s.stageAt, today()));
                  return (
                    <Card
                      key={s.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", s.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(s.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                      className={cn("cursor-grab shadow-none active:cursor-grabbing", dragId === s.id && "opacity-50")}
                    >
                      <CardContent className="grid gap-2 p-3">
                        <div className="flex items-start gap-1">
                          <GripVertical className="mt-0.5 hidden size-3.5 shrink-0 text-muted-foreground sm:block" />
                          <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{s.name}</p>
                          <FormDialog
                            title={`Editar · ${s.name}`}
                            onSubmit={(fd) => api(`/api/suppliers/${s.id}`, "PUT", supplierBody(fd))}
                            trigger={
                              <Button variant="ghost" size="icon" className="-mr-1 -mt-1 size-7" aria-label="Editar">
                                <Pencil className="size-3.5" />
                              </Button>
                            }
                          >
                            <SupplierForm s={s} funnel />
                          </FormDialog>
                        </div>

                        <div className="flex flex-wrap items-center gap-1">
                          {wa && (
                            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs hover:bg-accent" title={`WhatsApp ${s.phone}`}>
                              <MessageCircle className="size-3" /> WhatsApp
                            </a>
                          )}
                          {s.phone && !wa && (
                            <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs hover:bg-accent" title={s.phone}>
                              <Phone className="size-3" /> Ligar
                            </a>
                          )}
                          {s.email && (
                            <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs hover:bg-accent" title={s.email}>
                              <Mail className="size-3" /> E-mail
                            </a>
                          )}
                          {s.link && (
                            <a href={s.link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs hover:bg-accent" title={s.link}>
                              <ExternalLink className="size-3" /> Link
                            </a>
                          )}
                        </div>

                        <FollowUp s={s} />
                        {s.notes && <p className="line-clamp-2 text-xs text-muted-foreground">{s.notes}</p>}

                        <div className="flex flex-wrap gap-1">
                          <Badge>{days === 0 ? "entrou hoje" : `${days}d nesta etapa`}</Badge>
                          {(s._count.offers ?? 0) > 0 && <Badge tone="primary">{s._count.offers} proposta(s)</Badge>}
                          {s._count.products > 0 && <Badge>{s._count.products} produto(s)</Badge>}
                        </div>

                        <div className="flex items-center gap-1">
                          <Select className="h-7 flex-1 text-xs" value={s.stage} aria-label="Mover para" onChange={(e) => move(s.id, e.target.value as SupplierStage)}>
                            {SUPPLIER_STAGES.map((o) => (
                              <option key={o.key} value={o.key}>
                                {o.key === s.stage ? `Em: ${o.label}` : `Mover para ${o.label}`}
                              </option>
                            ))}
                          </Select>
                          {s.stage === "DISCARDED" && (
                            <DeleteButton confirm={`Excluir ${s.name} de vez?`} action={() => api(`/api/suppliers/${s.id}`, "DELETE")} />
                          )}
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
      <p className="text-xs text-muted-foreground">
        No celular, use &quot;Mover para&quot; em cada card. Fornecedores descartados ficam inativos e somem das cotações; voltar para outra etapa reativa.
      </p>
    </div>
  );
}
