import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient, useSession } from "@/lib/auth-client";
import { formatDateTime } from "@/lib/format";

/** "iPhone · Safari", "Mac · Chrome"… a partir del user agent. */
function describe(ua: string | null | undefined) {
  if (!ua) return { label: "Dispositivo desconocido", mobile: false };
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "Otro";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /CriOS|Chrome\//.test(ua)
      ? "Chrome"
      : /FxiOS|Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : /iPhone|iPad/.test(ua)
            ? "app instalada"
            : "navegador";
  return { label: `${device} · ${browser}`, mobile: /iPhone|Android|iPad/.test(ua) };
}

/** Dispositivos con sesión abierta y opción de cerrarlas. */
export function ActiveSessions() {
  const queryClient = useQueryClient();
  const { data: current } = useSession();
  const [busy, setBusy] = useState(false);
  const { data: sessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => (await authClient.listSessions()).data ?? [],
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sessions"] });

  const revoke = async (token: string) => {
    await authClient.revokeSession({ token });
    toast.success("Sesión cerrada");
    refresh();
  };

  const revokeOthers = async () => {
    setBusy(true);
    await authClient.revokeOtherSessions();
    setBusy(false);
    toast.success("Se cerraron las demás sesiones");
    refresh();
  };

  const sorted = [...(sessions ?? [])].sort((a, b) =>
    a.id === current?.session.id ? -1 : b.id === current?.session.id ? 1 : +new Date(b.updatedAt) - +new Date(a.updatedAt),
  );
  const others = sorted.filter((s) => s.id !== current?.session.id).length;

  return (
    <div className="grid gap-3">
      <ul className="divide-y rounded-lg border">
        {sorted.map((s) => {
          const isCurrent = s.id === current?.session.id;
          const { label, mobile } = describe(s.userAgent);
          const Icon = mobile ? Smartphone : Laptop;
          return (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
              <Icon className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {label}
                  {isCurrent && <span className="ml-2 text-xs font-normal text-emerald-600">Este dispositivo</span>}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  Última actividad {formatDateTime(String(s.updatedAt))}
                  {s.ipAddress ? ` · IP ${s.ipAddress}` : ""}
                </div>
              </div>
              {!isCurrent && (
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => revoke(s.token)}>
                  Cerrar
                </Button>
              )}
            </li>
          );
        })}
        {sessions?.length === 0 && <li className="p-3 text-sm text-muted-foreground">Sin sesiones.</li>}
      </ul>
      <p className="text-xs text-muted-foreground">
        Las sesiones se cierran solas tras 60 minutos sin actividad. Si ves un dispositivo que no reconoces, ciérralo y
        cambia la contraseña.
      </p>
      {others > 0 && (
        <Button type="button" variant="outline" className="justify-self-start" disabled={busy} onClick={revokeOthers}>
          Cerrar las demás sesiones ({others})
        </Button>
      )}
    </div>
  );
}
