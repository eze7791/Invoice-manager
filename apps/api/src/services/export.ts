// Exportación para la gestoría: ZIP con los PDFs del periodo y un CSV con el resumen.
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { strToU8, zipSync, type Zippable } from "fflate";
import type { Db } from "../db";
import { schema } from "../db";
import { clientDisplayName, getInvoicePdf, pdfFileName } from "./documents";
import { formatInvoiceNumber, type ClientSnapshot } from "./invoices";

const { invoices } = schema;

/** Números con coma decimal y fechas DD/MM/AAAA: lo que espera Excel en español. */
const num = (v: string | null) => (v == null ? "" : Number(v).toFixed(2).replace(".", ","));
const date = (iso: string | Date | null) => {
  if (!iso) return "";
  const s = iso instanceof Date ? iso.toISOString() : iso;
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const cell = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export async function buildExport(db: Db, files: R2Bucket, issuerId: string, from: string, to: string) {
  const rows = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.issuerId, issuerId),
        eq(invoices.status, "emitida"),
        gte(invoices.issueDate, from),
        lte(invoices.issueDate, to),
      ),
    )
    .orderBy(asc(invoices.seriesCode), asc(invoices.seriesYear), asc(invoices.number));

  const numberById = new Map(rows.map((r) => [r.id, formatInvoiceNumber(r)]));
  const header = [
    "Número", "Tipo", "Fecha", "Vencimiento", "Cliente", "NIF cliente", "Base imponible", "IVA",
    "Retención IRPF %", "Retención IRPF", "Total", "Estado de pago", "Fecha de pago", "Forma de pago", "Rectifica a",
  ];
  const lines = [header.join(";")];
  const zip: Zippable = {};

  for (const r of rows) {
    const client = r.clientSnapshot as ClientSnapshot | null;
    lines.push(
      [
        formatInvoiceNumber(r) ?? "",
        r.kind === "rectificativa" ? "Rectificativa" : "Ordinaria",
        date(r.issueDate),
        date(r.dueDate),
        client ? clientDisplayName(client) : "",
        client?.nif ?? "",
        num(r.taxableBase),
        num(r.vatTotal),
        num(r.irpfRate),
        num(r.irpfTotal),
        num(r.grandTotal),
        r.paidAt ? "Pagada" : "Impagada",
        date(r.paidAt),
        r.paidMethod ?? "",
        r.rectifiesId ? (numberById.get(r.rectifiesId) ?? "") : "",
      ]
        .map(cell)
        .join(";"),
    );
    const { invoice, bytes } = await getInvoicePdf(db, files, issuerId, r.id);
    // Los PDF ya están comprimidos: se guardan sin volver a comprimir (menos CPU).
    zip[`facturas/${pdfFileName(invoice)}`] = [bytes, { level: 0 }];
  }

  // BOM para que Excel detecte UTF-8 (tildes y ñ).
  zip[`resumen_${from}_${to}.csv`] = strToU8(`﻿${lines.join("\r\n")}\r\n`);
  return { zip: zipSync(zip), count: rows.length };
}
