import { eq } from "drizzle-orm";
import { strFromU8, unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it } from "vitest";
import { schema } from "../src/db";
import { createClient } from "../src/services/clients";
import { getInvoicePdf, invalidatePdf } from "../src/services/documents";
import { buildExport } from "../src/services/export";
import { createDraft, createRectification, issueInvoice, markPaid } from "../src/services/invoices";
import { clientSchema, invoiceDraftSchema } from "../src/validation";
import { fakeR2 } from "./fake-r2";
import { createIssuer, db } from "./helpers";

let issuerId: string;
let clientId: string;
let r2: ReturnType<typeof fakeR2>;

const draft = (issueDate = "2026-11-07") =>
  invoiceDraftSchema.parse({
    clientId,
    issueDate,
    irpfRate: 15,
    paymentMethod: "transferencia",
    paymentInstructions: "Bizum al 612 345 678 ≥ emoji 🎉",
    lines: [{ description: "Sesión de fisioterapia", detail: "60 minutos", quantity: 2, unitPrice: 50 }],
  });

beforeEach(async () => {
  r2 = fakeR2();
  issuerId = await createIssuer("pdf");
  await db
    .update(schema.issuers)
    .set({ firstName: "Lucía", lastName: "Martín", nif: "12345678Z", street: "Calle Mayor 1", street2: "3º 1ª", postalCode: "08001", city: "Barcelona", iban: "ES9121000418450200051332", showSignature: true, signatureText: "Gracias" })
    .where(eq(schema.issuers.id, issuerId));
  clientId = (await createClient(db, issuerId, clientSchema.parse({ type: "empresa", companyName: "Clínica Ñandú SL", nif: "B12345674" }))).id;
});

describe("PDF", () => {
  it("genera un PDF válido incluso con caracteres que la fuente no admite", async () => {
    const d = await createDraft(db, issuerId, draft());
    const { bytes } = await getInvoicePdf(db, r2.bucket, issuerId, d.id);
    expect(strFromU8(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("FACTURA (borrador)");
    expect(r2.store.size).toBe(0); // los borradores no se guardan
  });

  it("guarda el PDF de una factura emitida y lo reutiliza; se regenera al invalidarlo", async () => {
    const issued = await issueInvoice(db, issuerId, (await createDraft(db, issuerId, draft())).id);
    const first = await getInvoicePdf(db, r2.bucket, issuerId, issued.id);
    expect((await PDFDocument.load(first.bytes)).getTitle()).toBe("FACTURA 2026-0001");
    expect(r2.store.size).toBe(1);

    const [row] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, issued.id));
    expect(row!.pdfKey).toBe(`issuers/${issuerId}/invoices/${issued.id}.pdf`);

    await invalidatePdf(db, r2.bucket, issuerId, issued.id);
    expect(r2.store.size).toBe(0);
    await getInvoicePdf(db, r2.bucket, issuerId, issued.id);
    expect(r2.store.size).toBe(1);
  });
});

describe("exportación", () => {
  it("incluye solo las emitidas del periodo, con PDFs y un CSV para Excel", async () => {
    const a = await issueInvoice(db, issuerId, (await createDraft(db, issuerId, draft("2026-11-03"))).id);
    await markPaid(db, issuerId, a.id, { method: "efectivo", paidOn: "2026-11-05", note: null });
    const rect = await createRectification(db, issuerId, a.id, "Precio incorrecto");
    await issueInvoice(db, issuerId, rect.id);
    await createDraft(db, issuerId, draft("2026-11-10")); // borrador: fuera
    await issueInvoice(db, issuerId, (await createDraft(db, issuerId, draft("2026-12-01"))).id); // otro mes: fuera

    const { zip, count } = await buildExport(db, r2.bucket, issuerId, "2026-11-01", "2026-11-30");
    expect(count).toBe(2);

    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual([
      "facturas/Factura-2026-0001.pdf",
      "facturas/Factura-rectificativa-R2026-0001.pdf",
      "resumen_2026-11-01_2026-11-30.csv",
    ]);

    const csvBytes = files["resumen_2026-11-01_2026-11-30.csv"]!;
    expect([...csvBytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8 para Excel
    const [header, first, second] = strFromU8(csvBytes.slice(3)).trim().split("\r\n");
    expect(header).toMatch(/^Número;Tipo;Fecha;/);
    expect(first).toBe(
      "2026-0001;Ordinaria;03/11/2026;;Clínica Ñandú SL;B12345674;100,00;0,00;15,00;15,00;85,00;Pagada;05/11/2026;efectivo;",
    );
    expect(second).toMatch(/^R2026-0001;Rectificativa;.*;Impagada;;;2026-0001$/);
  });
});
