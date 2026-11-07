import { useForm } from "react-hook-form";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { applyApiError } from "@/lib/form-errors";
import type { Client, ClientType } from "@/lib/types";

export type ClientFormValues = {
  type: ClientType;
  firstName: string;
  lastName: string;
  companyName: string;
  nif: string;
  email: string;
  phone: string;
  street: string;
  street2: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
  notes: string;
};

const toValues = (c?: Client): ClientFormValues => ({
  type: c?.type ?? "particular",
  firstName: c?.firstName ?? "",
  lastName: c?.lastName ?? "",
  companyName: c?.companyName ?? "",
  nif: c?.nif ?? "",
  email: c?.email ?? "",
  phone: c?.phone ?? "",
  street: c?.street ?? "",
  street2: c?.street2 ?? "",
  postalCode: c?.postalCode ?? "",
  city: c?.city ?? "",
  province: c?.province ?? "",
  country: c?.country ?? "España",
  notes: c?.notes ?? "",
});

export function ClientForm({
  client,
  onSubmit,
  footer,
}: {
  client?: Client;
  onSubmit: (values: ClientFormValues) => Promise<unknown>;
  footer?: React.ReactNode;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({ defaultValues: toValues(client) });

  const type = watch("type");

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (e) {
      applyApiError(e, setError);
    }
  });

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <ToggleGroup
        type="single"
        variant="outline"
        value={type}
        onValueChange={(v) => v && setValue("type", v as ClientType)}
        className="w-full"
      >
        <ToggleGroupItem value="particular" className="flex-1">
          Particular
        </ToggleGroupItem>
        <ToggleGroupItem value="empresa" className="flex-1">
          Empresa
        </ToggleGroupItem>
      </ToggleGroup>

      {type === "particular" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *" htmlFor="firstName" error={errors.firstName?.message}>
            <Input id="firstName" placeholder="Lucía" autoComplete="off" {...register("firstName")} />
          </Field>
          <Field label="Apellidos" htmlFor="lastName" error={errors.lastName?.message}>
            <Input id="lastName" placeholder="Martín García" autoComplete="off" {...register("lastName")} />
          </Field>
        </div>
      ) : (
        <Field label="Razón social *" htmlFor="companyName" error={errors.companyName?.message}>
          <Input id="companyName" placeholder="Clínica Ejemplo SL" autoComplete="off" {...register("companyName")} />
        </Field>
      )}

      <Field
        label={type === "empresa" ? "NIF" : "DNI / NIE"}
        htmlFor="nif"
        error={errors.nif?.message}
        hint="Opcional. DNI: 8 números + letra. NIE: X, Y o Z + 7 números + letra."
      >
        <Input id="nif" placeholder="12345678Z · X1234567L · B12345674" autoComplete="off" className="uppercase" {...register("nif")} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" error={errors.email?.message} hint="Para enviarle la factura.">
          <Input id="email" placeholder="nombre@correo.es" type="email" inputMode="email" autoComplete="off" {...register("email")} />
        </Field>
        <Field label="Teléfono" htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" placeholder="612 345 678" type="tel" inputMode="tel" autoComplete="off" {...register("phone")} />
        </Field>
      </div>

      <Field label="Dirección" htmlFor="street" hint="Vía y número" error={errors.street?.message}>
        <Input id="street" placeholder="Calle Mayor 12" {...register("street")} />
      </Field>
      <Field label="Dirección 2" htmlFor="street2" hint="Opcional: piso, puerta, escalera, bloque o urbanización.">
        <Input id="street2" placeholder="3º 1ª, escalera B" {...register("street2")} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Código postal" htmlFor="postalCode" error={errors.postalCode?.message}>
          <Input id="postalCode" placeholder="08001" inputMode="numeric" {...register("postalCode")} />
        </Field>
        <Field label="Ciudad" htmlFor="city" error={errors.city?.message}>
          <Input id="city" placeholder="Barcelona" {...register("city")} />
        </Field>
        <Field label="Provincia" htmlFor="province" error={errors.province?.message}>
          <Input id="province" placeholder="Barcelona" {...register("province")} />
        </Field>
        <Field label="País" htmlFor="country" error={errors.country?.message}>
          <Input id="country" placeholder="España" {...register("country")} />
        </Field>
      </div>

      <Field label="Notas internas" htmlFor="notes" hint="Solo las ves tú. No salen en la factura.">
        <Textarea id="notes" rows={3} {...register("notes")} />
      </Field>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
        <div className="flex gap-2">{footer}</div>
        <Button type="submit" disabled={isSubmitting} className="sm:min-w-32">
          {isSubmitting ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
