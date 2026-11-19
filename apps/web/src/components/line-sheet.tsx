import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatEuro, lineTotal, parseDecimal, toDecimalInput } from "@/lib/format";
import type { InvoiceLine, SavedService } from "@/lib/types";

type LineValues = { description: string; detail: string; quantity: string; unitPrice: string; discount: string };

const toValues = (l?: InvoiceLine): LineValues => ({
  description: l?.description ?? "",
  detail: l?.detail ?? "",
  quantity: l ? toDecimalInput(l.quantity) : "1",
  unitPrice: l ? toDecimalInput(l.unitPrice) : "",
  discount: l && Number(l.discount) ? toDecimalInput(l.discount) : "",
});

/** Alta o edición de un concepto, con atajo a los servicios guardados. */
export function LineSheet({
  open,
  onOpenChange,
  line,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line?: InvoiceLine;
  onSave: (line: InvoiceLine) => void;
}) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={line ? "Editar concepto" : "Nuevo concepto"}>
      {open && <LineForm key={line?.id ?? "new"} line={line} onSave={onSave} onCancel={() => onOpenChange(false)} />}
    </ResponsiveSheet>
  );
}

function LineForm({ line, onSave, onCancel }: { line?: InvoiceLine; onSave: (l: InvoiceLine) => void; onCancel: () => void }) {
  const queryClient = useQueryClient();
  const [saveForLater, setSaveForLater] = useState(false);
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<LineValues>({
    defaultValues: toValues(line),
  });

  const { data: saved } = useQuery({ queryKey: ["services"], queryFn: () => api.get<SavedService[]>("/services") });

  const removeSaved = useMutation({
    mutationFn: (id: string) => api.delete(`/services/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });

  const values = watch();
  const total = lineTotal(values);

  const submit = handleSubmit(async (v) => {
    const result: InvoiceLine = {
      id: line?.id ?? crypto.randomUUID(),
      description: v.description.trim(),
      detail: v.detail.trim() || null,
      // Se guardan con punto decimal, que es lo que entiende la API.
      quantity: String(parseDecimal(v.quantity) || 1),
      unitPrice: String(parseDecimal(v.unitPrice)),
      discount: String(parseDecimal(v.discount) || 0),
    };
    if (saveForLater) {
      try {
        await api.post("/services", { name: result.description, description: result.detail, unitPrice: result.unitPrice });
        queryClient.invalidateQueries({ queryKey: ["services"] });
      } catch {
        toast.error("No se pudo guardar el servicio, pero el concepto se añadió.");
      }
    }
    onSave(result);
  });

  const positive = (v: string) => v === "" || parseDecimal(v) >= 0 || "Escribe un importe, p. ej. 5,50";

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      {!line && !!saved?.length && (
        <div className="grid gap-2">
          <span className="text-sm font-medium">Servicios guardados</span>
          <div className="flex flex-wrap gap-2">
            {saved.map((s) => (
              <span key={s.id} className="inline-flex items-center rounded-full border bg-muted/40 text-sm">
                <button
                  type="button"
                  className="py-1 pr-1 pl-3"
                  onClick={() =>
                    reset({ ...values, description: s.name, detail: s.description ?? "", unitPrice: toDecimalInput(s.unitPrice) })
                  }
                >
                  {s.name} · {formatEuro(s.unitPrice)}
                </button>
                <button
                  type="button"
                  aria-label={`Quitar ${s.name} de guardados`}
                  className="rounded-full p-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => removeSaved.mutate(s.id)}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <Field label="Concepto *" htmlFor="description" error={errors.description?.message}>
        <Input
          id="description"
          placeholder="Ej.: Sesión de fisioterapia"
          {...register("description", { validate: (v) => !!v.trim() || "Indica el concepto" })}
        />
      </Field>
      <Field label="Descripción" htmlFor="detail" hint="Opcional. Aparece debajo del concepto.">
        <Textarea id="detail" rows={2} placeholder="Ej.: Tratamiento de 60 minutos" {...register("detail")} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Precio (€)" htmlFor="unitPrice" error={errors.unitPrice?.message}>
          <Input
            id="unitPrice"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ej.: 60,00"
            {...register("unitPrice", { validate: (v) => parseDecimal(v) >= 0 || "Escribe el precio, p. ej. 60,50" })}
          />
        </Field>
        <Field label="Cantidad" htmlFor="quantity" error={errors.quantity?.message}>
          <Input
            id="quantity"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ej.: 1"
            {...register("quantity", { validate: (v) => v === "" || parseDecimal(v) > 0 || "Mayor que 0" })}
          />
        </Field>
        <Field label="Descuento (€)" htmlFor="discount" error={errors.discount?.message}>
          <Input id="discount" type="text" inputMode="decimal" autoComplete="off" placeholder="Ej.: 0" {...register("discount", { validate: positive })} />
        </Field>
      </div>

      {!line && (
        <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <span className="flex items-center gap-2 text-sm">
            <Bookmark className="size-4" /> Guardar para futuras facturas
          </span>
          <Switch checked={saveForLater} onCheckedChange={setSaveForLater} />
        </label>
      )}

      <div className="flex items-center justify-between gap-2 border-t pt-4">
        <span className="text-sm text-muted-foreground">
          Importe <span className="font-semibold text-foreground tabular-nums">{formatEuro(total)}</span>
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{line ? "Guardar" : "Añadir"}</Button>
        </div>
      </div>
    </form>
  );
}
