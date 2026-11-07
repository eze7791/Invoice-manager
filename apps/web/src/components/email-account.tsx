import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { Profile } from "@/lib/types";

/** Conectar, cambiar o desconectar la cuenta de Gmail con la que se envían las facturas. */
export function EmailAccount({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(!profile.mailConnected);
  const [user, setUser] = useState(profile.smtpUser ?? profile.email ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const save = (updated: Profile) => queryClient.setQueryData(["profile"], (old: Profile | undefined) => ({ ...old, ...updated }));

  const connect = async () => {
    setBusy(true);
    setErrors({});
    try {
      save(await api.put<Profile>("/profile/email", { user, password }));
      toast.success("Cuenta conectada. Te enviamos un email de prueba.");
      setPassword("");
      setEditing(false);
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fields);
      toast.error(e instanceof Error ? e.message : "No se pudo conectar");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      save(await api.delete<Profile>("/profile/email"));
      toast.success("Cuenta desconectada");
      setEditing(true);
    } finally {
      setBusy(false);
    }
  };

  if (!editing && profile.mailConnected) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-5 text-emerald-600" />
          <span>
            Enviando desde <strong>{profile.smtpUser}</strong>
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            Cambiar
          </Button>
          <Button type="button" variant="ghost" className="text-destructive" disabled={busy} onClick={disconnect}>
            Desconectar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Activa la verificación en dos pasos en tu cuenta de Google.</li>
        <li>
          Crea una{" "}
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-foreground underline"
          >
            contraseña de aplicación <ExternalLink className="size-3" />
          </a>{" "}
          con el nombre «Facturación».
        </li>
        <li>Pega aquí tu Gmail y las 16 letras que te muestra Google.</li>
      </ol>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gmail" htmlFor="smtpUser" error={errors.user}>
          <Input
            id="smtpUser"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="Ej.: nombre@gmail.com"
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />
        </Field>
        <Field label="Contraseña de aplicación" htmlFor="smtpPassword" error={errors.password}>
          <Input
            id="smtpPassword"
            type="password"
            autoComplete="off"
            placeholder="Ej.: abcd efgh ijkl mnop"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        No es la contraseña normal de Gmail. Se guarda cifrada y solo se usa para enviar tus facturas. Puedes revocarla
        en Google cuando quieras.
      </p>
      <div className="flex justify-end gap-2">
        {profile.mailConnected && (
          <Button type="button" variant="outline" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        )}
        <Button type="button" disabled={busy || !user || !password} onClick={connect}>
          {busy ? "Comprobando…" : "Conectar y enviar prueba"}
        </Button>
      </div>
    </div>
  );
}
