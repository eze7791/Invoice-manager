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

const num = (v: string | number | null | undefined) => {
  try {
    return new Decimal(v === "" || v == null ? 0 : v);
  } catch {
    return new Decimal(0);
  }
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
