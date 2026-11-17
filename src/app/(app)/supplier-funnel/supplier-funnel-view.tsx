"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ExternalLink,
  GripVertical,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { DeleteButton, FormDialog } from "@/components/app/form-dialog";
import {
  SUPPLIER_STAGES,
  SupplierForm,
  supplierBody,
  whatsappLink,
  type Supplier,
  type SupplierStage,
} from "@/components/app/supplier-form";
import { api } from "@/lib/client";
import { today } from "@/lib/dates";
import { cn, fmtDate } from "@/lib/utils";

const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86_400_000,
  );

function FollowUp({ s }: { s: Supplier }) {
  if (!s.nextStep && !s.followUpAt) return null;
  const late = s.followUpAt ? daysBetween(today(), s.followUpAt) : null;
  const tone =
    late == null
      ? "muted"
      : late < 0
        ? "danger"
        : late === 0
          ? "warning"
          : "muted";
  const when =
    late == null
      ? ""
      : late < 0
        ? `atrasado ${-late}d`
        : late === 0
          ? "hoje"
          : late === 1
            ? "amanhã"
            : fmtDate(s.followUpAt);
  return (
    <div className="flex items-start gap-1.5 text-xs">
      <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">{s.nextStep ?? "Retomar contato"}</span>
      {when && <Badge tone={tone}>{when}</Badge>}
    </div>
  );
}

function SupplierCard({
  s,
  dragging,
  onDragStart,
  onDragEnd,
  move,
}: {
  s: Supplier;
  dragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  move: (id: string, stage: SupplierStage) => void;
}) {
  const wa = whatsappLink(s.phone);
  const days = Math.max(0, daysBetween(s.stageAt, today()));
  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", s.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(s.id);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "cursor-grab shadow-none active:cursor-grabbing",
        dragging && "opacity-50",
      )}
    >
      <CardContent className="grid gap-2 p-3">
        <div className="flex items-start gap-1">
          <GripVertical className="mt-0.5 hidden size-3.5 shrink-0 text-muted-foreground sm:block" />
          <p className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">
            {s.name}
          </p>
          <FormDialog
            title={`Editar · ${s.name}`}
            onSubmit={(fd) =>
              api(`/api/suppliers/${s.id}`, "PUT", supplierBody(fd))
            }
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="-mr-1 -mt-1 size-7"
                aria-label="Editar"
              >
                <Pencil className="size-3.5" />
              </Button>
            }
          >
            <SupplierForm s={s} funnel />
          </FormDialog>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs hover:bg-accent"
              title={`WhatsApp ${s.phone}`}
            >
              <MessageCircle className="size-3" /> WhatsApp
            </a>
          )}
          {s.phone && !wa && (
            <a
              href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}
              className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs hover:bg-accent"
              title={s.phone}
            >
              <Phone className="size-3" /> Ligar
            </a>
          )}
          {s.email && (
            <a
              href={`mailto:${s.email}`}
              className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs hover:bg-accent"
              title={s.email}
            >
              <Mail className="size-3" /> E-mail
            </a>
          )}
          {s.link && (
            <a
              href={s.link}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs hover:bg-accent"
              title={s.link}
            >
              <ExternalLink className="size-3" /> Link
            </a>
          )}
        </div>

        <FollowUp s={s} />
        {s.notes && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {s.notes}
          </p>
        )}

        <div className="flex flex-wrap gap-1">
          <Badge>{days === 0 ? "entrou hoje" : `${days}d nesta etapa`}</Badge>
          {(s._count.offers ?? 0) > 0 && (
            <Badge tone="primary">{s._count.offers} proposta(s)</Badge>
          )}
          {s._count.products > 0 && (
            <Badge>{s._count.products} produto(s)</Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Select
            className="h-7 flex-1 text-xs"
            value={s.stage}
            aria-label="Mover para"
            onChange={(e) => move(s.id, e.target.value as SupplierStage)}
          >
            {SUPPLIER_STAGES.map((o) => (
              <option key={o.key} value={o.key}>
                {o.key === s.stage ? `Em: ${o.label}` : `Mover para ${o.label}`}
              </option>
            ))}
          </Select>
          {s.stage === "DISCARDED" && (
            <DeleteButton
              confirm={`Excluir ${s.name} de vez?`}
              action={() => api(`/api/suppliers/${s.id}`, "DELETE")}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const BOARD = SUPPLIER_STAGES.filter((st) => st.key !== "DISCARDED");

export function SupplierFunnelView({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [items, setItems] = useState(suppliers);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<SupplierStage | null>(null);
  const [showDiscarded, setShowDiscarded] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  useEffect(() => setItems(suppliers), [suppliers]);

  const endDrag = () => {
    setDragId(null);
    setOver(null);
  };

  async function move(id: string, stage: SupplierStage) {
    const before = items;
    const cur = items.find((x) => x.id === id);
    if (!cur || cur.stage === stage) return;
    setItems(
      items.map((x) =>
        x.id === id
          ? {
              ...x,
              stage,
              stageAt: new Date().toISOString(),
              active: stage !== "DISCARDED",
            }
          : x,
      ),
    );
    try {
      await api(`/api/suppliers/${id}/funnel`, "PATCH", { stage });
      router.refresh();
    } catch (e) {
      setItems(before);
      alert(e instanceof Error ? e.message : "Erro ao mover");
    }
  }

  /** Props de uma área que recebe cards arrastados. */
  const dropZone = (stage: SupplierStage) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(stage);
    },
    onDragLeave: () => setOver((o) => (o === stage ? null : o)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain") || dragId;
      endDrag();
      if (id) move(id, stage);
    },
  });

  const active = items.filter((s) => s.stage !== "DISCARDED");
  const discarded = items.filter((s) => s.stage === "DISCARDED");
  const overdue = active.filter(
    (s) => s.followUpAt && daysBetween(today(), s.followUpAt) < 0,
  ).length;
  const dueToday = active.filter(
    (s) => s.followUpAt && daysBetween(today(), s.followUpAt) === 0,
  ).length;

  const jumpTo = (key: SupplierStage) =>
    boardRef.current
      ?.querySelector<HTMLElement>(`[data-stage="${key}"]`)
      ?.scrollIntoView({
        behavior: "smooth",
        inline: "start",
        block: "nearest",
      });

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 text-sm">
          {overdue > 0 && (
            <Badge tone="danger">{overdue} com retorno atrasado</Badge>
          )}
          {dueToday > 0 && <Badge tone="warning">{dueToday} para hoje</Badge>}
          {overdue === 0 && dueToday === 0 && (
            <span className="text-muted-foreground">
              Nenhum retorno pendente para hoje.
            </span>
          )}
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

      {/* Atalhos das etapas (celular e telas onde o quadro não cabe inteiro) */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 2xl:hidden">
        {BOARD.map((st) => (
          <button
            key={st.key}
            type="button"
            onClick={() => jumpTo(st.key)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium hover:bg-accent"
          >
            {st.label}
            <span className="text-muted-foreground">
              {active.filter((s) => s.stage === st.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* Quadro: as colunas dividem a largura; se não couberem (celular/tela menor), rola para o lado */}
      <div
        ref={boardRef}
        className="-mx-4 snap-x snap-mandatory overflow-x-auto px-4 pb-2 sm:mx-0 sm:snap-none sm:px-0"
      >
        <div className="grid grid-cols-[repeat(6,minmax(82vw,1fr))] gap-3 sm:grid-cols-[repeat(6,minmax(15rem,1fr))] 2xl:grid-cols-[repeat(6,minmax(11rem,1fr))]">
          {BOARD.map((st) => {
            const list = items.filter((s) => s.stage === st.key);
            return (
              <section
                key={st.key}
                data-stage={st.key}
                {...dropZone(st.key)}
                className={cn(
                  "flex min-w-0 snap-start flex-col rounded-xl bg-muted/40 transition-colors",
                  over === st.key && "bg-primary/10 ring-2 ring-primary/40",
                )}
              >
                <header className="px-3 pb-2 pt-3">
                  <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                    <span className="truncate">{st.label}</span>
                    <Badge tone={st.key === "APPROVED" ? "success" : "muted"}>
                      {list.length}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">{st.hint}</p>
                </header>
                {/* No computador a coluna tem a altura da tela e rola por dentro */}
                <div className="flex flex-col gap-2 px-2 pb-2 lg:max-h-[calc(100dvh-15rem)] lg:min-h-[12rem] lg:overflow-y-auto">
                  {list.length === 0 && (
                    <p className="rounded-lg border border-dashed px-1 py-6 text-center text-xs text-muted-foreground">
                      Arraste para cá
                    </p>
                  )}
                  {list.map((s) => (
                    <SupplierCard
                      key={s.id}
                      s={s}
                      dragging={dragId === s.id}
                      onDragStart={setDragId}
                      onDragEnd={endDrag}
                      move={move}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Descartados: fora do quadro; ao arrastar aparece a área para descartar */}
      <div
        {...dropZone("DISCARDED")}
        className={cn(
          "rounded-xl border border-dashed p-3 transition-colors",
          dragId ? "border-destructive/60 bg-destructive/5" : "border-border",
          over === "DISCARDED" &&
            "bg-destructive/10 ring-2 ring-destructive/40",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            {dragId ? (
              <b className="text-destructive">Solte aqui para descartar</b>
            ) : (
              <>
                <b>Descartados</b>{" "}
                <span className="text-muted-foreground">
                  ({discarded.length}) · ficam inativos e somem das cotações
                </span>
              </>
            )}
          </p>
          {discarded.length > 0 && !dragId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDiscarded((v) => !v)}
            >
              {showDiscarded ? "Esconder" : "Ver descartados"}
            </Button>
          )}
        </div>
        {showDiscarded && !dragId && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {discarded.map((s) => (
              <SupplierCard
                key={s.id}
                s={s}
                dragging={dragId === s.id}
                onDragStart={setDragId}
                onDragEnd={endDrag}
                move={move}
              />
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        No celular, deslize para o lado ou toque numa etapa acima; use
        &quot;Mover para&quot; em cada card.
      </p>
    </div>
  );
}
