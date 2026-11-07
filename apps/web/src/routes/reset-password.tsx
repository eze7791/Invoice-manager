import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { MIN_PASSWORD } from "@/components/change-password";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

/** Destino del enlace del email de recuperación: `/restablecer?token=…`. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") ? "El enlace no es válido o ha caducado." : null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(`Mínimo ${MIN_PASSWORD} caracteres`);
    if (password !== repeat) return setError("Las contraseñas no coinciden");
    setBusy(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! });
    setBusy(false);
    if (error) return setError("El enlace no es válido o ha caducado. Pide uno nuevo.");
    toast.success("Contraseña cambiada. Ya puedes entrar.");
    navigate("/login", { replace: true });
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Nueva contraseña</CardTitle>
          <CardDescription>Elige una contraseña nueva para entrar.</CardDescription>
        </CardHeader>
        <CardContent>
          {token && !params.get("error") ? (
            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="repeat">Repite la contraseña</Label>
                <Input id="repeat" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy}>
                {busy ? "Guardando…" : "Guardar contraseña"}
              </Button>
            </form>
          ) : (
            <div className="grid gap-4">
              <p className="text-sm text-destructive">{error ?? "Falta el enlace de recuperación."}</p>
              <Button asChild variant="outline">
                <Link to="/login">Volver al inicio de sesión</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
