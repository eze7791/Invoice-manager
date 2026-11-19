import Decimal from "decimal.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export const formatEuro = (value: string | number | Decimal) => euro.format(Number(value.toString()));

/** "2026-11-07" → "07/11/2026" */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

/** Hoy en formato YYYY-MM-DD según la hora local. */
export function today() {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

type Amounts = { quantity: string | number; unitPrice: string | number; discount?: string | number | null };

/**
 * Lee un importe escrito a la española ("60,50", "1.234,56") o con punto ("60.50").
 * Devuelve NaN si no es un número.
 */
export function parseDecimal(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  let s = (value ?? "").replace(/[\s€%]/g, "");
  if (s === "") return NaN;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", "."); // coma decimal: los puntos son de miles
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ""); // "1.500" en España son mil quinientos
  }
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

/** Número para mostrar en un campo editable, con coma decimal: 60.5 → "60,5". */
export const toDecimalInput = (value: string | number) => String(Number(value)).replace(".", ",");

const num = (v: string | number | null | undefined) => {
  const n = parseDecimal(v);
  return new Decimal(Number.isNaN(n) ? 0 : n);
};

/** Mismo cálculo que la API, para mostrar los totales mientras se edita. */
export function lineTotal(l: Amounts) {
  return num(l.quantity).times(num(l.unitPrice)).minus(num(l.discount)).toDecimalPlaces(2);
}

export function computeTotals(lines: Amounts[], irpfRate: string | number) {
  const base = lines.reduce((s, l) => s.plus(lineTotal(l)), new Decimal(0));
  const irpf = base.times(num(irpfRate)).dividedBy(100).toDecimalPlaces(2);
  return { base, irpf, total: base.minus(irpf) };
}
