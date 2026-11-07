import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Tag, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ClientPicker } from "@/components/client-picker";
import { Field, FormSection } from "@/components/field";
import { LineSheet } from "@/components/line-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api, ApiError } from "@/lib/api";
import { addDays, computeTotals, daysBetween, formatEuro, lineTotal, today } from "@/lib/format";
import { clientName, initials, type Client, type InvoiceDetail, type InvoiceLine, type PaymentMethod, type Profile } from "@/lib/types";

type Draft = {
  kind: "ordinaria" | "rectificativa";
  client: Pick<Client, "id" | "type" | "firstName" | "lastName" | "companyName" | "email"> | null;
  issueDate: string;
  dueDate: string | null;
  operationDate: string | null;
  applyIrpf: boolean;
  irpfRate: string;
  paymentMethod: PaymentMethod;
  notes: string;
  paymentInstructions: string;
  rectificationReason: string;
  lines: InvoiceLine[];
};

/** Crea (`/facturas/nueva`) o edita (`/facturas/:id/editar`) un borrador. */
export function InvoiceEditorPage() {
  const { id } = useParams();
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => api.get<Profile>("/profile") });
  const { data: invoice } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.get<InvoiceDetail>(`/invoices/${id}`),
    enabled: !!id,
  });

  if (!profile || (id && !invoice)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }
  return <Editor key={id ?? "new"} profile={profile} invoice={invoice} />;
}

function initialDraft(profile: Profile, invoice?: InvoiceDetail): Draft {
  if (invoice) {
    const rate = Number(invoice.irpfRate);
    return {
      kind: invoice.kind,
      client: invoice.clientId && invoice.client ? { ...invoice.client, id: invoice.clientId } as Draft["client"] : null,
      issueDate: invoice.issueDate ?? today(),
      dueDate: invoice.dueDate,
      operationDate: invoice.operationDate,
      applyIrpf: rate > 0,
      irpfRate: String(rate > 0 ? rate : Number(profile.defaultIrpfRate)),
      paymentMethod: invoice.paymentMethod ?? profile.defaultPaymentMethod,
      notes: invoice.notes ?? "",
      paymentInstructions: invoice.paymentInstructions ?? "",
      rectificationReason: invoice.rectificationReason ?? "",
      lines: invoice.lines,
    };
  }
  const issueDate = today();
  return {
    kind: "ordinaria",
    client: null,
    issueDate,
    dueDate: addDays(issueDate, profile.defaultDueDays),
    operationDate: null,
    applyIrpf: Number(profile.defaultIrpfRate) > 0,
    irpfRate: String(Number(profile.defaultIrpfRate)),
    paymentMethod: profile.defaultPaymentMethod,
    notes: "",
    paymentInstructions: profile.paymentInstructions ?? "",
    rectificationReason: "",
    lines: [],
  };
}

function Editor({ profile, invoice }: { profile: Profile; invoice?: InvoiceDetail }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(profile, invoice));
  const [pickingClient, setPickingClient] = useState(false);
  const [editingLine, setEditingLine] = useState<InvoiceLine | "new" | null>(null);
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendOnIssue, setSendOnIssue] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Id del borrador ya guardado (al crear uno nuevo, tras el primer guardado).
  const [savedId, setSavedId] = useState(invoice?.id);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const irpfRate = draft.applyIrpf ? draft.irpfRate : "0";
  const totals = computeTotals(draft.lines, irpfRate);
  const dueDays = draft.dueDate ? daysBetween(draft.issueDate, draft.dueDate) : null;

  const selectClient = (client: Client) => {
    // A particulares no se les practica retención; a empresas y profesionales sí.
    setDraft((d) => ({ ...d, client, applyIrpf: client.type === "empresa" && Number(profile.defaultIrpfRate) > 0 }));
    setErrors((e) => ({ ...e, clientId: "" }));
  };

  const saveLine = (line: InvoiceLine) => {
    setDraft((d) => {
      const exists = d.lines.some((l) => l.id === line.id);
      return { ...d, lines: exists ? d.lines.map((l) => (l.id === line.id ? line : l)) : [...d.lines, line] };
    });
    setErrors((e) => ({ ...e, lines: "" }));
    setEditingLine(null);
  };

  const changeQuantity = (line: InvoiceLine, delta: number) => {
    const quantity = Math.max(1, Number(line.quantity) + delta);
    saveLine({ ...line, quantity: String(quantity) });
  };

  const payload = () => ({
    clientId: draft.client?.id ?? null,
    issueDate: draft.issueDate,
    dueDate: draft.dueDate,
    operationDate: draft.operationDate,
    irpfRate: Number(irpfRate),
    paymentMethod: draft.paymentMethod,
    notes: draft.notes,
    paymentInstructions: draft.paymentInstructions,
    rectificationReason: draft.rectificationReason,
    lines: draft.lines.map((l) => ({
      description: l.description,
      detail: l.detail,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      discount: Number(l.discount || 0),
    })),
  });

  /** Guarda el borrador y devuelve su id. */
  const save = async () => {
    if (savedId) {
      await api.put(`/invoices/${savedId}`, payload());
      return savedId;
    }
    const { id } = await api.post<{ id: string }>("/invoices", payload());
    setSavedId(id);
    return id;
  };

  const run = async (action: "save" | "issue") => {
    setBusy(true);
    setErrors({});
    try {
      const id = await save();
      if (action === "issue") {
        await api.post(`/invoices/${id}/issue`);
        if (sendOnIssue && draft.client?.email) {
          // Si falla el envío, la factura ya está emitida: se avisa y se puede reenviar desde el detalle.
          await api
            .post(`/invoices/${id}/send`, { to: draft.client.email })
            .then(() => toast.success(`Enviada a ${draft.client!.email}`))
            .catch((e) => toast.error(`Emitida, pero no se pudo enviar: ${e.message}`));
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast.success(action === "issue" ? "Factura emitida" : "Borrador guardado");
      navigate(`/facturas/${id}`, { replace: true });
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields);
        toast.error(e.message);
      } else toast.error("Error inesperado");
      // Si el borrador se creó pero falló la emisión, el siguiente intento reutiliza `savedId`.
    } finally {
      setBusy(false);
      setConfirmIssue(false);
    }
  };

  const title = invoice
    ? draft.kind === "rectificativa"
      ? "Editar rectificativa"
      : "Editar borrador"
    : "Nueva factura";

  return (
    <div className="space-y-4 pb-36 md:pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={() => navigate(invoice ? `/facturas/${invoice.id}` : "/facturas")}>
          <X />
        </Button>
      </div>

      {draft.kind === "rectificativa" && (
        <FormSection title="Rectificación" description={`Sustituye a la factura ${invoice?.rectifies?.number ?? ""}.`}>
          <Field label="Motivo *" htmlFor="rectificationReason" error={errors.rectificationReason}>
            <Textarea
              id="rectificationReason"
              rows={2}
              placeholder="Ej.: Error en el precio del servicio"
              value={draft.rectificationReason}
              onChange={(e) => set("rectificationReason", e.target.value)}
            />
          </Field>
        </FormSection>
      )}

      <FormSection title="Fechas" description="El número de factura se asigna al emitir.">
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="Fecha de emisión" htmlFor="issueDate">
            <Input
              id="issueDate"
              type="date"
              value={draft.issueDate}
              onChange={(e) => {
                const issueDate = e.target.value || today();
                setDraft((d) => ({ ...d, issueDate, dueDate: dueDays != null ? addDays(issueDate, dueDays) : d.dueDate }));
              }}
            />
          </Field>
          <Field label="Vence en (días)" htmlFor="dueDays">
            <Input
              id="dueDays"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Ej.: 7"
              disabled={draft.dueDate === null}
              value={dueDays ?? ""}
              onChange={(e) => set("dueDate", addDays(draft.issueDate, Math.max(0, Number(e.target.value) || 0)))}
            />
          </Field>
          <Field label="Vencimiento" htmlFor="dueDate">
            <Input
              id="dueDate"
              type="date"
              disabled={draft.dueDate === null}
              value={draft.dueDate ?? ""}
              onChange={(e) => set("dueDate", e.target.value || null)}
            />
          </Field>
          <label className="flex items-center justify-between gap-2 text-sm sm:h-full sm:pt-6">
            Sin vencimiento
            <Switch
              checked={draft.dueDate === null}
              onCheckedChange={(off) => set("dueDate", off ? null : addDays(draft.issueDate, profile.defaultDueDays))}
            />
          </label>
        </div>
        <Field
          label="Fecha de operación"
          htmlFor="operationDate"
          hint="Opcional. Solo si el servicio se prestó en otra fecha."
        >
          <Input
            id="operationDate"
            type="date"
            value={draft.operationDate ?? ""}
            onChange={(e) => set("operationDate", e.target.value || null)}
          />
        </Field>
      </FormSection>

      <FormSection title="Cliente">
        {draft.client ? (
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {initials(clientName(draft.client))}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{clientName(draft.client)}</div>
              <div className="truncate text-sm text-muted-foreground">
                {draft.client.type === "empresa" ? "Empresa" : "Particular"}
                {draft.client.email ? ` · ${draft.client.email}` : ""}
              </div>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setPickingClient(true)}>
              Cambiar
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="h-14 border-dashed" onClick={() => setPickingClient(true)}>
            <Plus /> Elegir cliente
          </Button>
        )}
        {errors.clientId && <p className="text-sm text-destructive">{errors.clientId}</p>}
      </FormSection>

      <FormSection title="Conceptos">
        {draft.lines.length > 0 && (
          <ul className="grid gap-2">
            {draft.lines.map((line) => (
              <li key={line.id} className="flex items-center gap-3 rounded-lg border p-3">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEditingLine(line)}>
                  <span className="hidden size-10 shrink-0 items-center justify-center rounded-md bg-muted sm:flex">
                    <Tag className="size-4 text-muted-foreground" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{line.description}</span>
                    {line.detail && <span className="block truncate text-sm text-muted-foreground">{line.detail}</span>}
                    <span className="block text-sm tabular-nums">
                      {formatEuro(line.unitPrice)}
                      {Number(line.discount) > 0 && <span className="text-muted-foreground"> − {formatEuro(line.discount)}</span>}
                      <span className="text-muted-foreground"> · </span>
                      <span className="font-medium">{formatEuro(lineTotal(line))}</span>
                    </span>
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  {Number(line.quantity) <= 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Quitar concepto"
                      onClick={() => setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== line.id) }))}
                    >
                      <Trash2 />
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" size="icon" aria-label="Restar uno" onClick={() => changeQuantity(line, -1)}>
                      <Minus />
                    </Button>
                  )}
                  <span className="w-6 text-center tabular-nums">{Number(line.quantity)}</span>
                  <Button type="button" variant="ghost" size="icon" aria-label="Sumar uno" onClick={() => changeQuantity(line, 1)}>
                    <Plus />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="outline" onClick={() => setEditingLine("new")}>
          <Plus /> Añadir concepto
        </Button>
        {errors.lines && <p className="text-sm text-destructive">{errors.lines}</p>}
      </FormSection>

      <FormSection title="Retención e impuestos">
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm">
            Retención IRPF
            <span className="block text-xs text-muted-foreground">Normalmente solo a empresas y profesionales.</span>
          </span>
          <Switch checked={draft.applyIrpf} onCheckedChange={(v) => set("applyIrpf", v)} />
        </label>
        {draft.applyIrpf && (
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              value={["7", "15"].includes(draft.irpfRate) ? draft.irpfRate : ""}
              onValueChange={(v) => v && set("irpfRate", v)}
            >
              <ToggleGroupItem value="15" className="px-4">15 %</ToggleGroupItem>
              <ToggleGroupItem value="7" className="px-4">7 %</ToggleGroupItem>
            </ToggleGroup>
            <div className="relative w-28">
              <Input
                aria-label="Otro porcentaje de IRPF"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                max={100}
                value={draft.irpfRate}
                onChange={(e) => set("irpfRate", e.target.value)}
                className="pr-7"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
          </div>
        )}
        <p className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">{profile.vatExemptionText}</p>
      </FormSection>

      <FormSection title="Pago y observaciones">
        <ToggleGroup
          type="single"
          variant="outline"
          value={draft.paymentMethod}
          onValueChange={(v) => v && set("paymentMethod", v as PaymentMethod)}
          className="w-full sm:w-auto"
        >
          <ToggleGroupItem value="transferencia" className="flex-1">Transferencia</ToggleGroupItem>
          <ToggleGroupItem value="efectivo" className="flex-1">Efectivo</ToggleGroupItem>
        </ToggleGroup>
        <Field
          label="Instrucciones de pago"
          htmlFor="paymentInstructions"
          hint="Aparecen al pie de la factura, junto a tus datos bancarios."
        >
          <Textarea
            id="paymentInstructions"
            rows={3}
            placeholder="Ej.: Pago por transferencia indicando el número de factura."
            value={draft.paymentInstructions}
            onChange={(e) => set("paymentInstructions", e.target.value)}
          />
        </Field>
        <Field label="Observaciones" htmlFor="notes" hint="Aparecen en la factura.">
          <Textarea
            id="notes"
            rows={3}
            placeholder="Ej.: Gracias por su confianza."
            value={draft.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      </FormSection>

      {/* Barra fija con el total y las acciones */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t bg-background/95 p-3 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline justify-between gap-4 sm:justify-start">
            <span className="text-sm text-muted-foreground">
              Base {formatEuro(totals.base)}
              {draft.applyIrpf && Number(irpfRate) > 0 && <> · IRPF −{formatEuro(totals.irpf)}</>}
            </span>
            <span className="text-xl font-semibold tabular-nums">{formatEuro(totals.total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" disabled={busy} onClick={() => run("save")}>
              Guardar borrador
            </Button>
            <Button disabled={busy} onClick={() => setConfirmIssue(true)}>
              Emitir
            </Button>
          </div>
        </div>
      </div>

      <ClientPicker open={pickingClient} onOpenChange={setPickingClient} onSelect={selectClient} />
      <LineSheet
        open={editingLine !== null}
        onOpenChange={(o) => !o && setEditingLine(null)}
        line={editingLine === "new" ? undefined : (editingLine ?? undefined)}
        onSave={saveLine}
      />

      <AlertDialog open={confirmIssue} onOpenChange={setConfirmIssue}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Emitir la factura?</AlertDialogTitle>
            <AlertDialogDescription>
              Se le asignará el siguiente número y ya no se podrá modificar. Si después encuentras un error, tendrás que
              hacer una factura rectificativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {draft.client?.email && profile.mailConnected && (
            <label className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm">
              <span>
                Enviar por email al cliente
                <span className="block text-xs text-muted-foreground">{draft.client.email}</span>
              </span>
              <Switch checked={sendOnIssue} onCheckedChange={setSendOnIssue} />
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                run("issue");
              }}
            >
              Emitir por {formatEuro(totals.total)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
