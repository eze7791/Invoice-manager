import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export const MIN_PASSWORD = 10;

/** Cambio de contraseña: pide la actual y cierra las sesiones en otros dispositivos. */
export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(undefined);
    if (next.length < MIN_PASSWORD) return setError(`Mínimo ${MIN_PASSWORD} caracteres`);
    if (next !== repeat) return setError("Las contraseñas no coinciden");
    setBusy(true);
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setBusy(false);
    if (error) {
      setError(error.status === 400 || error.status === 401 ? "La contraseña actual no es correcta" : "No se pudo cambiar la contraseña");
      return;
    }
    setCurrent("");
    setNext("");
    setRepeat("");
    toast.success("Contraseña cambiada. Se cerraron las sesiones en otros dispositivos.");
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Contraseña actual" htmlFor="currentPassword">
          <Input id="currentPassword" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="Nueva contraseña" htmlFor="newPassword" hint={`Mínimo ${MIN_PASSWORD} caracteres`}>
          <Input id="newPassword" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Repite la nueva" htmlFor="repeatPassword">
          <Input id="repeatPassword" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </Field>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="button" disabled={busy || !current || !next || !repeat} onClick={submit}>
          {busy ? "Cambiando…" : "Cambiar contraseña"}
        </Button>
      </div>
    </div>
  );
}
