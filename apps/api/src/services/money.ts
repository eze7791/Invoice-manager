import Decimal from "decimal.js";

// Importes con 2 decimales y redondeo comercial (0,005 → 0,01).
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export type LineAmounts = { quantity: string | number; unitPrice: string | number; discount?: string | number | null };

const round2 = (d: Decimal) => d.toDecimalPlaces(2);

/** Importe de una línea: cantidad × precio − descuento. */
export function lineTotal(line: LineAmounts): Decimal {
  return round2(new Decimal(line.quantity).times(line.unitPrice).minus(line.discount || 0));
}

/**
 * Totales de la factura. La actividad está exenta de IVA, así que la base es la suma de líneas,
 * la retención de IRPF se calcula sobre la base y el total a cobrar es base − IRPF.
 */
export function computeTotals(lines: LineAmounts[], irpfRate: string | number, vatRate: string | number = 0) {
  const base = lines.reduce((sum, l) => sum.plus(lineTotal(l)), new Decimal(0));
  const vat = round2(base.times(vatRate).dividedBy(100));
  const irpf = round2(base.times(irpfRate).dividedBy(100));
  const total = base.plus(vat).minus(irpf);
  return {
    taxableBase: base.toFixed(2),
    vatTotal: vat.toFixed(2),
    irpfTotal: irpf.toFixed(2),
    grandTotal: total.toFixed(2),
  };
}

export const toMoney = (d: Decimal) => d.toFixed(2);
