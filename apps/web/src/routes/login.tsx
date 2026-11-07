import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, signIn, useSession } from "@/lib/auth-client";
import { ResponsiveSheet } from "@/components/responsive-sheet";

export function LoginPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isPending && session) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn.email({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.status === 429 ? "Demasiados intentos. Espera un minuto." : "Email o contraseña incorrectos.");
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Facturación</CardTitle>
          <CardDescription>Inicia sesión para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Entrando…" : "Entrar"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <ForgotPassword initialEmail={email} />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function ForgotPassword({ initialEmail }: { initialEmail: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/restablecer` });
    setBusy(false);
    setSent(true);
  };

  return (
    <>
      <button
        type="button"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => {
          setEmail(initialEmail);
          setSent(false);
          setOpen(true);
        }}
      >
        ¿Olvidaste tu contraseña?
      </button>
      <ResponsiveSheet open={open} onOpenChange={setOpen} title="Recuperar contraseña">
        {sent ? (
          <div className="grid gap-3 pb-2 text-sm">
            <p>
              Si el email corresponde a una cuenta con Gmail conectado, recibirás un enlace para elegir una contraseña
              nueva. Caduca en 1 hora.
            </p>
            <p className="text-muted-foreground">
              Si no te llega, pide a quien administra la app que te la restablezca.
            </p>
            <Button onClick={() => setOpen(false)}>Entendido</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4 pb-2">
            <div className="grid gap-2">
              <Label htmlFor="resetEmail">Email de tu cuenta</Label>
              <Input id="resetEmail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Enviando…" : "Enviarme un enlace"}
            </Button>
          </form>
        )}
      </ResponsiveSheet>
    </>
  );
}
