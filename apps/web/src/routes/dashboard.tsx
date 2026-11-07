import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate, formatEuro } from "@/lib/format";
import type { InvoiceListItem, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

type Totals = { count: number; total: string; base: string; irpf: string };
type Dashboard = {
  today: string;
  month: Totals;
  year: Totals;
  unpaid: Totals;
  overdue: Totals;
  clientCount: number;
  recent: InvoiceListItem[];
  monthly: { month: string; base: string }[];
};

const monthName = (ym: string, style: "long" | "short" = "long") =>
  new Intl.DateTimeFormat("es-ES", { month: style, timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`));

export function DashboardPage() {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<Dashboard>("/dashboard") });
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => api.get<Profile>("/profile") });

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const profileIncomplete = profile && (!profile.nif || !profile.firstName || !profile.street);
  const year = data.today.slice(0, 4);
  // Barras de todos los meses del año hasta el actual.
  const months = Array.from({ length: Number(data.today.slice(5, 7)) }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const byMonth = new Map(data.monthly.map((m) => [m.month, Number(m.base)]));
  const max = Math.max(1, ...byMonth.values());

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Inicio</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {monthName(data.today.slice(0, 7))} de {year}
          </p>
        </div>
        <Button onClick={() => navigate("/facturas/nueva")}>
          <Plus /> Nueva factura
        </Button>
      </div>

      {profileIncomplete && (
        <Link
          to="/perfil"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          <AlertTriangle className="size-5 shrink-0" />
          <span className="flex-1">Completa tu perfil (nombre, NIF y dirección) para poder emitir facturas.</span>
          <ArrowRight className="size-4" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Facturado este mes" value={formatEuro(data.month.base)} hint={`${data.month.count} facturas · base imponible`} />
        <Stat label={`Facturado en ${year}`} value={formatEuro(data.year.base)} hint={`IRPF retenido ${formatEuro(data.year.irpf)}`} />
        <Stat
          label="Pendiente de cobro"
          value={formatEuro(data.unpaid.total)}
          hint={`${data.unpaid.count} impagadas`}
          to="/facturas?estado=impagada"
        />
        <Stat
          label="Vencido"
          value={formatEuro(data.overdue.total)}
          hint={`${data.overdue.count} vencidas`}
          to="/facturas?estado=vencida"
          alert={data.overdue.count > 0}
        />
      </div>

      <section className="rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-medium">Facturado por mes en {year}</h2>
        <div className="flex h-36 items-end gap-1.5">
          {months.map((m) => {
            const value = byMonth.get(m) ?? 0;
            return (
              <div key={m} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div
                  className={cn("w-full max-w-10 rounded-t bg-primary/80", value === 0 && "bg-muted")}
                  style={{ height: `${Math.max(2, (value / max) * 100)}%` }}
                  title={`${monthName(m)}: ${formatEuro(value)}`}
                />
                <span className="text-[10px] text-muted-foreground capitalize">{monthName(m, "short").replace(".", "")}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-medium">Últimas facturas</h2>
          <Link to="/facturas" className="text-sm text-muted-foreground hover:text-foreground">
            Ver todas
          </Link>
        </div>
        {data.recent.length ? (
          <ul className="divide-y">
            {data.recent.map((inv) => (
              <li key={inv.id}>
                <Link to={`/facturas/${inv.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium tabular-nums">{inv.number ?? "Borrador"}</span>
                      <StatusBadge status={inv.paymentStatus} />
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {inv.clientName || "Sin cliente"} · {formatDate(inv.issueDate)}
                    </div>
                  </div>
                  <span className="font-semibold tabular-nums">{formatEuro(inv.grandTotal)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">Todavía no hay facturas.</p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint, to, alert }: { label: string; value: string; hint: string; to?: string; alert?: boolean }) {
  const content = (
    <>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", alert && "text-red-600 dark:text-red-400")}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
    </>
  );
  const className = "rounded-xl border p-3 sm:p-4";
  return to ? (
    <Link to={to} className={cn(className, "hover:bg-muted/50")}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
