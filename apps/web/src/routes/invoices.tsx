import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link, useNavigate } from "react-router";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { formatDate, formatEuro } from "@/lib/format";
import type { InvoiceListItem, PaymentStatus } from "@/lib/types";

const filters: { value: PaymentStatus | "todas"; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "borrador", label: "Borradores" },
  { value: "impagada", label: "Impagadas" },
  { value: "vencida", label: "Vencidas" },
  { value: "pagada", label: "Pagadas" },
];

export function InvoicesPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<PaymentStatus | "todas">("todas");
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search);

  const { data: invoices, isPending } = useQuery({
    queryKey: ["invoices", { status, q }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status !== "todas") params.set("status", status);
      if (q) params.set("q", q);
      return api.get<InvoiceListItem[]>(`/invoices?${params}`);
    },
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Facturas</h1>
        <Button className="hidden md:inline-flex" onClick={() => navigate("/facturas/nueva")}>
          <Plus /> Nueva factura
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar por cliente o número (2026-0001)"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={status}
          onValueChange={(v) => v && setStatus(v as typeof status)}
          className="w-max"
        >
          {filters.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value} className="px-3">
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : invoices?.length ? (
        <ul className="divide-y rounded-xl border">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link to={`/facturas/${inv.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/50">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">{inv.number ?? "Borrador"}</span>
                    {inv.kind === "rectificativa" && <span className="text-xs text-muted-foreground">Rectificativa</span>}
                  </div>
                  <StatusBadge status={inv.paymentStatus} />
                  <div className="text-sm text-muted-foreground">{formatDate(inv.issueDate)}</div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="truncate text-sm">{inv.clientName || "Sin cliente"}</div>
                  <div className="text-lg font-semibold tabular-nums">{formatEuro(inv.grandTotal)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          {search || status !== "todas"
            ? "No hay facturas con estos filtros."
            : "Todavía no tienes facturas. Crea la primera con el botón +."}
        </div>
      )}

      <Button
        size="icon"
        aria-label="Nueva factura"
        onClick={() => navigate("/facturas/nueva")}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 size-14 rounded-full shadow-lg md:hidden"
      >
        <Plus className="size-6" />
      </Button>
    </div>
  );
}
