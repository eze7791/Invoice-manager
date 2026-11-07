import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, Download, FileText, FilePen, History, Mail, Pencil, Share, Trash2, Undo2, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { SendEmailSheet } from "@/components/send-email-sheet";
import { StatusBadge } from "@/components/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { formatDate, formatDateTime, formatEuro, today } from "@/lib/format";
import { clientName, type InvoiceDetail, type InvoiceEventType, type PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

const eventLabels: Record<InvoiceEventType, string> = {
  creada: "Borrador creado",
  emitida: "Emitida",
  enviada: "Enviada al cliente",
  pagada: "Pago registrado",
  marcada_impagada: "Marcada como impagada",
  rectificada: "Rectificada",
};

const methodLabel: Record<PaymentMethod, string> = { transferencia: "Transferencia", efectivo: "Efectivo" };

export function InvoiceDetailPage() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [rectifying, setRectifying] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: inv, isError } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.get<InvoiceDetail>(`/invoices/${id}`),
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["invoice", id] }),
      queryClient.invalidateQueries({ queryKey: ["invoices"] }),
    ]);

  const action = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onError: (e) => toast.error(e.message),
  });

  if (isError) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">No se encontró la factura.</p>
        <Button asChild variant="outline">
          <Link to="/">Volver a facturas</Link>
        </Button>
      </div>
    );
  }
  if (!inv) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const isDraft = inv.status === "borrador";
  const name = inv.client ? clientName(inv.client) : "Sin cliente";
  const issuedEvent = inv.events.find((e) => e.type === "emitida");

  const duplicate = () =>
    action.mutate(async () => {
      const { id: newId } = await api.post<{ id: string }>(`/invoices/${inv.id}/duplicate`);
      await refresh();
      toast.success("Copia creada como borrador");
      navigate(`/facturas/${newId}/editar`);
    });

  const remove = () =>
    action.mutate(async () => {
      await api.delete(`/invoices/${inv.id}`);
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Borrador eliminado");
      navigate("/", { replace: true });
    });

  const pdfUrl = `/api/invoices/${inv.id}/pdf`;
  const fileName = `${inv.kind === "rectificativa" ? "Factura-rectificativa" : "Factura"}-${inv.number ?? "borrador"}.pdf`;

  /** Hoja de compartir nativa del móvil (WhatsApp, Mail…) con el PDF adjunto. */
  const share = () =>
    action.mutate(async () => {
      const blob = await fetch(pdfUrl, { credentials: "include" }).then((r) => r.blob());
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName }).catch(() => {});
      } else {
        window.open(pdfUrl, "_blank");
      }
    });

  const unpay = () =>
    action.mutate(async () => {
      await api.post(`/invoices/${inv.id}/unpay`);
      await refresh();
      toast.success("Marcada como impagada");
    });

  return (
    <div className="space-y-4 pb-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/">
          <ArrowLeft /> Facturas
        </Link>
      </Button>

      {/* Cabecera */}
      <section className="rounded-xl border p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tabular-nums">{inv.number ?? "Borrador"}</h1>
              <StatusBadge status={inv.paymentStatus} />
            </div>
            {inv.kind === "rectificativa" && (
              <p className="text-sm text-muted-foreground">
                Rectificativa de{" "}
                {inv.rectifies ? (
                  <Link className="underline" to={`/facturas/${inv.rectifies.id}`}>
                    {inv.rectifies.number}
                  </Link>
                ) : (
                  "—"
                )}
              </p>
            )}
            <p className="truncate text-muted-foreground">{name}</p>
            {inv.client?.email && <p className="truncate text-sm text-muted-foreground">{inv.client.email}</p>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">{formatEuro(inv.grandTotal)}</div>
            {inv.dueDate && !inv.paidAt && !isDraft && (
              <div className="mt-1 inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs">Vence el {formatDate(inv.dueDate)}</div>
            )}
          </div>
        </div>

        {!isDraft && (
          <ol className="mt-5 grid grid-cols-3 gap-2">
            <TimelineStep done label="Emitida" date={issuedEvent?.createdAt ?? inv.issuedAt} />
            <TimelineStep done={!!inv.sentAt} label="Enviada" date={inv.sentAt} />
            <TimelineStep done={!!inv.paidAt} label="Pagada" date={inv.paidAt} />
          </ol>
        )}

        {inv.rectifiedBy.length > 0 && (
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Esta factura tiene rectificativa:{" "}
            {inv.rectifiedBy.map((r, i) => (
              <span key={r.id}>
                {i > 0 && ", "}
                <Link className="underline" to={`/facturas/${r.id}`}>
                  {r.number ?? "borrador"}
                </Link>
              </span>
            ))}
          </p>
        )}
      </section>

      {/* Documento */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button asChild variant="secondary">
          <a href={pdfUrl} target="_blank" rel="noreferrer">
            <FileText /> {isDraft ? "Vista previa" : "Ver PDF"}
          </a>
        </Button>
        <Button asChild variant="secondary">
          <a href={`${pdfUrl}?download=1`} download={fileName}>
            <Download /> Descargar
          </a>
        </Button>
        {!isDraft && (
          <>
            <Button variant="secondary" onClick={share} disabled={action.isPending}>
              <Share /> Compartir
            </Button>
            <Button variant="secondary" onClick={() => setSending(true)}>
              <Mail /> {inv.sentAt ? "Reenviar" : "Enviar por email"}
            </Button>
          </>
        )}
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {isDraft ? (
          <>
            <Button asChild>
              <Link to={`/facturas/${inv.id}/editar`}>
                <Pencil /> Editar y emitir
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive">
                  <Trash2 /> Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar el borrador?</AlertDialogTitle>
                  <AlertDialogDescription>Los borradores no tienen número, así que no deja huecos en la numeración.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={remove}>
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : inv.paidAt ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <Undo2 /> Marcar impagada
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Marcar como impagada?</AlertDialogTitle>
                <AlertDialogDescription>Se borrará el registro de pago. Queda constancia en el historial.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={unpay}>Marcar impagada</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button onClick={() => setPaying(true)}>
            <Wallet /> Registrar pago
          </Button>
        )}
        <Button variant="outline" onClick={duplicate} disabled={action.isPending}>
          <Copy /> Duplicar
        </Button>
        {!isDraft && inv.kind === "ordinaria" && (
          <Button variant="outline" onClick={() => setRectifying(true)}>
            <FilePen /> Rectificar
          </Button>
        )}
        <Button variant="outline" onClick={() => setShowLog(true)}>
          <History /> Ver registro
        </Button>
      </div>

      {/* Datos */}
      <section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 sm:p-6">
        <Info label="Fecha de emisión" value={formatDate(inv.issueDate)} />
        <Info label="Vencimiento" value={inv.dueDate ? formatDate(inv.dueDate) : "Sin vencimiento"} />
        {inv.operationDate && <Info label="Fecha de operación" value={formatDate(inv.operationDate)} />}
        <Info label="Forma de pago" value={inv.paymentMethod ? methodLabel[inv.paymentMethod] : "—"} />
        {inv.paidAt && (
          <Info
            label="Pagada"
            value={`${formatDateTime(inv.paidAt)}${inv.paidMethod ? ` · ${methodLabel[inv.paidMethod]}` : ""}${inv.paymentNote ? ` · ${inv.paymentNote}` : ""}`}
          />
        )}
        {inv.rectificationReason && <Info label="Motivo de la rectificación" value={inv.rectificationReason} />}
      </section>

      {/* Conceptos y totales */}
      <section className="rounded-xl border">
        <div className="hidden grid-cols-[1fr_6rem_4rem_7rem] gap-2 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground uppercase sm:grid">
          <span>Concepto</span>
          <span className="text-right">Precio</span>
          <span className="text-right">Cant.</span>
          <span className="text-right">Importe</span>
        </div>
        <ul className="divide-y">
          {inv.lines.map((l) => (
            <li key={l.id} className="grid grid-cols-[1fr_auto] gap-x-2 px-4 py-3 sm:grid-cols-[1fr_6rem_4rem_7rem]">
              <div className="min-w-0">
                <div className="font-medium">{l.description}</div>
                {l.detail && <div className="text-sm text-muted-foreground">{l.detail}</div>}
                <div className="text-sm text-muted-foreground sm:hidden">
                  {Number(l.quantity)} × {formatEuro(l.unitPrice)}
                  {Number(l.discount) > 0 && ` − ${formatEuro(l.discount)}`}
                </div>
              </div>
              <span className="hidden text-right tabular-nums sm:block">{formatEuro(l.unitPrice)}</span>
              <span className="hidden text-right tabular-nums sm:block">{Number(l.quantity)}</span>
              <span className="text-right font-medium tabular-nums">{formatEuro(l.lineTotal ?? 0)}</span>
            </li>
          ))}
          {inv.lines.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Sin conceptos</li>}
        </ul>
        <dl className="ml-auto grid max-w-xs gap-1 border-t p-4 text-sm">
          <Row label="Base imponible" value={formatEuro(inv.taxableBase)} />
          {Number(inv.irpfRate) > 0 && (
            <Row label={`Retención IRPF (${Number(inv.irpfRate)} %)`} value={`−${formatEuro(inv.irpfTotal)}`} />
          )}
          <Row label="Total" value={formatEuro(inv.grandTotal)} strong />
        </dl>
        {inv.vatExemptionText && <p className="border-t px-4 py-3 text-xs text-muted-foreground">{inv.vatExemptionText}</p>}
        {inv.notes && <p className="border-t px-4 py-3 text-sm whitespace-pre-line">{inv.notes}</p>}
        {inv.paymentInstructions && (
          <div className="border-t px-4 py-3 text-sm">
            <div className="text-xs font-medium text-muted-foreground">Instrucciones de pago</div>
            <p className="whitespace-pre-line">{inv.paymentInstructions}</p>
          </div>
        )}
      </section>

      <PaymentSheet open={paying} onOpenChange={setPaying} invoice={inv} onDone={refresh} />
      <RectifySheet open={rectifying} onOpenChange={setRectifying} invoice={inv} />
      {!isDraft && <SendEmailSheet key={inv.id} open={sending} onOpenChange={setSending} invoice={inv} />}

      <ResponsiveSheet open={showLog} onOpenChange={setShowLog} title="Registro">
        <ol className="grid gap-3 pb-2">
          {inv.events.map((e) => (
            <li key={e.id} className="flex items-start gap-3">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
              <div>
                <div className="text-sm font-medium">
                  {eventLabels[e.type]}
                  {typeof e.data?.number === "string" && ` · ${e.data.number}`}
                </div>
                <div className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</div>
              </div>
            </li>
          ))}
        </ol>
      </ResponsiveSheet>
    </div>
  );
}

function TimelineStep({ done, label, date }: { done: boolean; label: string; date: string | null | undefined }) {
  return (
    <li className={cn("flex items-center gap-2 rounded-lg border p-2.5", done ? "border-emerald-200 dark:border-emerald-900" : "opacity-60")}>
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          done ? "bg-emerald-500 text-white" : "border-2 border-dashed",
        )}
      >
        {done && <Check className="size-3.5" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{done && date ? formatDateTime(date) : "Pendiente"}</span>
      </span>
    </li>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "border-t pt-2 text-base font-semibold")}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function PaymentSheet({
  open,
  onOpenChange,
  invoice,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoice: InvoiceDetail;
  onDone: () => Promise<unknown>;
}) {
  const [method, setMethod] = useState<PaymentMethod>(invoice.paymentMethod ?? "transferencia");
  const [paidOn, setPaidOn] = useState(today());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/invoices/${invoice.id}/pay`, { method, paidOn, note });
      await onDone();
      toast.success("Pago registrado");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Registrar pago" description={`Total ${formatEuro(invoice.grandTotal)}`}>
      <div className="grid gap-4">
        <Field label="Forma de pago" htmlFor="payMethod">
          <ToggleGroup
            id="payMethod"
            type="single"
            variant="outline"
            value={method}
            onValueChange={(v) => v && setMethod(v as PaymentMethod)}
            className="w-full"
          >
            <ToggleGroupItem value="transferencia" className="flex-1">Transferencia</ToggleGroupItem>
            <ToggleGroupItem value="efectivo" className="flex-1">Efectivo</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <Field label="Fecha de cobro" htmlFor="paidOn" hint="Hoy se guarda con la hora actual.">
          <Input id="paidOn" type="date" max={today()} value={paidOn} onChange={(e) => setPaidOn(e.target.value || today())} />
        </Field>
        <Field label="Nota" htmlFor="payNote" hint="Opcional">
          <Input id="payNote" placeholder="Pagado en consulta" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            Registrar pago
          </Button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}

function RectifySheet({ open, onOpenChange, invoice }: { open: boolean; onOpenChange: (o: boolean) => void; invoice: InvoiceDetail }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const { id } = await api.post<{ id: string }>(`/invoices/${invoice.id}/rectify`, { reason });
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      onOpenChange(false);
      navigate(`/facturas/${id}/editar`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Rectificar factura"
      description={`Se creará un borrador de factura rectificativa (serie R) que sustituye a la ${invoice.number}. Podrás corregir los conceptos antes de emitirla.`}
    >
      <div className="grid gap-4">
        <Field label="Motivo" htmlFor="reason">
          <Textarea
            id="reason"
            rows={3}
            placeholder="Error en el precio del servicio"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            Crear rectificativa
          </Button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
