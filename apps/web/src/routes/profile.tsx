import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Field, FormSection } from "@/components/field";
import { ImageField } from "@/components/image-field";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { applyApiError } from "@/lib/form-errors";
import type { PaymentMethod, Profile } from "@/lib/types";

type FileKind = "logo" | "signature";

type ProfileValues = Omit<Profile, "id" | "hasLogo" | "hasSignature" | "updatedAt" | "defaultIrpfRate"> & {
  defaultIrpfRate: number;
};

const toValues = (p: Profile): ProfileValues => ({
  firstName: p.firstName,
  lastName: p.lastName,
  tradeName: p.tradeName ?? "",
  nif: p.nif,
  street: p.street,
  postalCode: p.postalCode,
  city: p.city,
  province: p.province,
  country: p.country,
  email: p.email ?? "",
  phone: p.phone ?? "",
  bankHolder: p.bankHolder ?? "",
  bankName: p.bankName ?? "",
  iban: p.iban ?? "",
  bankAddress: p.bankAddress ?? "",
  defaultPaymentMethod: p.defaultPaymentMethod,
  defaultIrpfRate: Number(p.defaultIrpfRate),
  vatExemptionText: p.vatExemptionText,
  defaultDueDays: p.defaultDueDays,
  showSignature: p.showSignature,
  signatureText: p.signatureText ?? "",
});

export function ProfilePage() {
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => api.get<Profile>("/profile") });

  if (!profile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  return <ProfileForm profile={profile} />;
}

function ProfileForm({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const [drawing, setDrawing] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({ defaultValues: toValues(profile) });

  const submit = handleSubmit(async (values) => {
    try {
      const updated = await api.put<Profile>("/profile", values);
      queryClient.setQueryData(["profile"], updated);
      reset(toValues(updated));
      toast.success("Perfil guardado");
    } catch (e) {
      applyApiError(e, setError);
    }
  });

  // Las imágenes se sirven desde la API con la sesión; `updatedAt` evita la caché tras cambiarlas.
  const fileUrl = (kind: FileKind, has: boolean) => (has ? `/api/profile/files/${kind}?v=${profile.updatedAt}` : null);

  const upload = useMutation({
    mutationFn: async ({ kind, file }: { kind: FileKind; file: Blob }) => {
      const body = new FormData();
      body.append("file", file, kind === "signature" ? "firma.png" : (file as File).name);
      await api.put(`/profile/files/${kind}`, body);
    },
    onSuccess: async (_, { kind }) => {
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(kind === "logo" ? "Logo actualizado" : "Firma guardada");
      setDrawing(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const removeFile = useMutation({
    mutationFn: (kind: FileKind) => api.delete(`/profile/files/${kind}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
    onError: (e) => toast.error(e.message),
  });

  const showSignature = watch("showSignature");

  return (
    <form onSubmit={submit} className="space-y-4 pb-20" noValidate>
      <div>
        <h1 className="text-2xl font-semibold">Perfil</h1>
        <p className="text-muted-foreground">Estos datos aparecen en tus facturas.</p>
      </div>

      <FormSection title="Datos fiscales">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="firstName" error={errors.firstName?.message}>
            <Input id="firstName" placeholder="Lucía" autoComplete="given-name" {...register("firstName")} />
          </Field>
          <Field label="Apellidos" htmlFor="lastName" error={errors.lastName?.message}>
            <Input id="lastName" placeholder="Martín García" autoComplete="family-name" {...register("lastName")} />
          </Field>
          <Field label="NIF" htmlFor="nif" error={errors.nif?.message}>
            <Input id="nif" placeholder="12345678Z o X1234567L" className="uppercase" {...register("nif")} />
          </Field>
          <Field label="Nombre comercial" htmlFor="tradeName" hint="Opcional">
            <Input id="tradeName" placeholder="Fisioterapia Lucía" {...register("tradeName")} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Domicilio fiscal">
        <Field label="Dirección" htmlFor="street" error={errors.street?.message}>
          <Input id="street" placeholder="Calle Mayor 12, 3º 1ª" autoComplete="street-address" {...register("street")} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Código postal" htmlFor="postalCode" error={errors.postalCode?.message}>
            <Input id="postalCode" placeholder="08001" inputMode="numeric" autoComplete="postal-code" {...register("postalCode")} />
          </Field>
          <Field label="Ciudad" htmlFor="city" error={errors.city?.message}>
            <Input id="city" placeholder="Barcelona" autoComplete="address-level2" {...register("city")} />
          </Field>
          <Field label="Provincia" htmlFor="province" error={errors.province?.message}>
            <Input id="province" placeholder="Barcelona" autoComplete="address-level1" {...register("province")} />
          </Field>
          <Field label="País" htmlFor="country" error={errors.country?.message}>
            <Input id="country" placeholder="España" autoComplete="country-name" {...register("country")} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Contacto">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" placeholder="nombre@correo.es" type="email" inputMode="email" {...register("email")} />
          </Field>
          <Field label="Teléfono" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" placeholder="612 345 678" type="tel" inputMode="tel" {...register("phone")} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Logo" description="Aparece arriba a la derecha de la factura. PNG, JPG o WebP, máx. 2 MB.">
        <ImageField
          src={fileUrl("logo", profile.hasLogo)}
          alt="Logo"
          busy={upload.isPending || removeFile.isPending}
          onFile={(file) => upload.mutate({ kind: "logo", file })}
          onRemove={() => removeFile.mutate("logo")}
        />
      </FormSection>

      <FormSection title="Datos de pago" description="Se muestran al pie de cada factura.">
        <Field label="Forma de pago por defecto" htmlFor="defaultPaymentMethod">
          <Controller
            control={control}
            name="defaultPaymentMethod"
            render={({ field }) => (
              <ToggleGroup
                id="defaultPaymentMethod"
                type="single"
                variant="outline"
                value={field.value}
                onValueChange={(v) => v && field.onChange(v as PaymentMethod)}
                className="w-full sm:w-auto"
              >
                <ToggleGroupItem value="transferencia" className="flex-1">
                  Transferencia
                </ToggleGroupItem>
                <ToggleGroupItem value="efectivo" className="flex-1">
                  Efectivo
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titular de la cuenta" htmlFor="bankHolder">
            <Input id="bankHolder" placeholder="Lucía Martín García" {...register("bankHolder")} />
          </Field>
          <Field label="Banco" htmlFor="bankName">
            <Input id="bankName" placeholder="Banco Ejemplo" {...register("bankName")} />
          </Field>
          <Field label="IBAN" htmlFor="iban" error={errors.iban?.message} className="sm:col-span-2">
            <Input id="iban" className="uppercase" placeholder="ES00 0000 0000 0000 0000 0000" {...register("iban")} />
          </Field>
          <Field label="Dirección del banco" htmlFor="bankAddress" hint="Opcional" className="sm:col-span-2">
            <Input id="bankAddress" placeholder="Calle Mayor 1, Barcelona" {...register("bankAddress")} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Facturación" description="Valores por defecto para cada factura nueva. Se pueden cambiar en cada una.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Retención IRPF (%)"
            htmlFor="defaultIrpfRate"
            error={errors.defaultIrpfRate?.message}
            hint="A particulares se aplica 0 %."
          >
            <Input id="defaultIrpfRate" placeholder="15" type="number" inputMode="decimal" step="0.01" {...register("defaultIrpfRate")} />
          </Field>
          <Field label="Vencimiento (días)" htmlFor="defaultDueDays" error={errors.defaultDueDays?.message}>
            <Input id="defaultDueDays" placeholder="7" type="number" inputMode="numeric" {...register("defaultDueDays")} />
          </Field>
        </div>
        <Field
          label="Mención de exención de IVA"
          htmlFor="vatExemptionText"
          error={errors.vatExemptionText?.message}
          hint="Obligatoria en facturas exentas. Confírmala con tu gestoría."
        >
          <Textarea id="vatExemptionText" rows={2} {...register("vatExemptionText")} />
        </Field>
      </FormSection>

      <FormSection title="Firma" description="Opcional. Añade un pie con texto y tu firma al final de la factura.">
        <Controller
          control={control}
          name="showSignature"
          render={({ field }) => (
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm">Mostrar firma en el PDF</span>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
        {showSignature && (
          <>
            <Field label="Texto del pie" htmlFor="signatureText">
              <Textarea
                id="signatureText"
                rows={2}
                placeholder="Al firmar este documento, el cliente acepta los servicios y condiciones descritos."
                {...register("signatureText")}
              />
            </Field>
            <ImageField
              src={fileUrl("signature", profile.hasSignature)}
              alt="Firma"
              busy={upload.isPending || removeFile.isPending}
              onFile={(file) => upload.mutate({ kind: "signature", file })}
              onRemove={() => removeFile.mutate("signature")}
              extraActions={
                <Button type="button" variant="outline" onClick={() => setDrawing(true)}>
                  <PenLine /> Dibujar
                </Button>
              }
            />
          </>
        )}
      </FormSection>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t bg-background/95 p-3 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-5xl justify-end">
          <Button type="submit" disabled={isSubmitting || !isDirty} className="w-full sm:w-auto sm:min-w-40">
            {isSubmitting ? "Guardando…" : isDirty ? "Guardar cambios" : "Guardado"}
          </Button>
        </div>
      </div>

      <ResponsiveSheet open={drawing} onOpenChange={setDrawing} title="Dibujar firma">
        <SignaturePad
          onCancel={() => setDrawing(false)}
          onSave={(png) => upload.mutate({ kind: "signature", file: png })}
        />
      </ResponsiveSheet>
    </form>
  );
}
