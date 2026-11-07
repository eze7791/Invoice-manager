import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/hooks/use-me";
import { api, ApiError } from "@/lib/api";
import type { InvoiceDetail } from "@/lib/types";

export function SendEmailSheet({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoice: InvoiceDetail;
}) {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [to, setTo] = useState(invoice.client?.email ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await api.post(`/invoices/${invoice.id}/send`, { to, message: message || undefined });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoice", invoice.id] }),
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
      ]);
      toast.success(`Factura enviada a ${to}`);
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.fields.to) setError(e.fields.to);
      toast.error(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Enviar por email"
      description={`Se adjunta el PDF de la factura ${invoice.number}.`}
    >
      {me && !me.emailConfigured ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          El envío por email todavía no está configurado. Mientras tanto puedes descargar el PDF o compartirlo.
        </p>
      ) : (
        <div className="grid gap-4">
          <Field label="Para" htmlFor="to" error={error}>
            <Input id="to" type="email" inputMode="email" placeholder="cliente@correo.es" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Mensaje" htmlFor="message" hint="Opcional. Si lo dejas vacío se envía un texto estándar con el importe.">
            <Textarea
              id="message"
              rows={4}
              placeholder="Te adjunto la factura de las sesiones de noviembre."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={send} disabled={busy || !to}>
              {busy ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </div>
      )}
    </ResponsiveSheet>
  );
}
