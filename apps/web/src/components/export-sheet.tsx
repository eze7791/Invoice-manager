import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { today } from "@/lib/format";

type Period = "mes" | "trimestre" | "año" | "rango";

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1-12

function range(period: Period, month: string, quarter: string, year: string): [string, string] {
  if (period === "mes") {
    const [y, m] = month.split("-").map(Number) as [number, number];
    return [`${month}-01`, `${month}-${pad(lastDay(y, m))}`];
  }
  if (period === "trimestre") {
    const [y, q] = quarter.split("-T").map(Number) as [number, number];
    const end = q * 3;
    return [`${y}-${pad(end - 2)}-01`, `${y}-${pad(end)}-${pad(lastDay(y, end))}`];
  }
  return [`${year}-01-01`, `${year}-12-31`];
}

/** Descarga un ZIP con los PDF del periodo y un CSV resumen para la gestoría. */
export function ExportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const now = today();
  const thisYear = Number(now.slice(0, 4));
  const thisQuarter = Math.ceil(Number(now.slice(5, 7)) / 3);
  const quarters = Array.from({ length: 6 }, (_, i) => {
    const idx = thisYear * 4 + thisQuarter - 1 - i;
    return `${Math.floor(idx / 4)}-T${(idx % 4) + 1}`;
  });

  const [period, setPeriod] = useState<Period>("trimestre");
  const [month, setMonth] = useState(now.slice(0, 7));
  const [quarter, setQuarter] = useState(quarters[0]!);
  const [year, setYear] = useState(String(thisYear));
  const [from, setFrom] = useState(`${now.slice(0, 7)}-01`);
  const [to, setTo] = useState(now);
  const [busy, setBusy] = useState(false);

  const [start, end] = period === "rango" ? [from, to] : range(period, month, quarter, year);

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/export?${new URLSearchParams({ from: start, to: end })}`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `facturas_${start}_${end}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Exportar para la gestoría"
      description="Un ZIP con los PDF de las facturas emitidas y un resumen en CSV que se abre con Excel."
    >
      <div className="grid gap-4">
        <ToggleGroup type="single" variant="outline" value={period} onValueChange={(v) => v && setPeriod(v as Period)} className="w-full">
          <ToggleGroupItem value="mes" className="flex-1">Mes</ToggleGroupItem>
          <ToggleGroupItem value="trimestre" className="flex-1">Trimestre</ToggleGroupItem>
          <ToggleGroupItem value="año" className="flex-1">Año</ToggleGroupItem>
          <ToggleGroupItem value="rango" className="flex-1">Fechas</ToggleGroupItem>
        </ToggleGroup>

        {period === "mes" && (
          <Field label="Mes" htmlFor="exportMonth">
            <Input id="exportMonth" type="month" value={month} max={now.slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </Field>
        )}
        {period === "trimestre" && (
          <ToggleGroup type="single" variant="outline" value={quarter} onValueChange={(v) => v && setQuarter(v)} className="grid w-full grid-cols-3">
            {quarters.map((q) => (
              <ToggleGroupItem key={q} value={q}>
                {q.replace("-", " ")}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        {period === "año" && (
          <Field label="Año" htmlFor="exportYear">
            <Input id="exportYear" type="number" inputMode="numeric" placeholder={String(thisYear)} value={year} onChange={(e) => setYear(e.target.value)} />
          </Field>
        )}
        {period === "rango" && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Desde" htmlFor="exportFrom">
              <Input id="exportFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Hasta" htmlFor="exportTo">
              <Input id="exportTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Del {start.split("-").reverse().join("/")} al {end.split("-").reverse().join("/")}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={download} disabled={busy}>
            {busy ? "Preparando…" : "Descargar ZIP"}
          </Button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
