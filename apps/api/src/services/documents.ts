// Construye los datos del PDF a partir de una factura y guarda/lee el PDF en R2.
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";
import { renderInvoicePdf, type PdfInvoice } from "../pdf/invoice-pdf";
import { getInvoiceDetail, type ClientSnapshot, type IssuerSnapshot } from "./invoices";

type Detail = Awaited<ReturnType<typeof getInvoiceDetail>>;

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" ");

function addressLines(a: { street?: string | null; street2?: string | null; postalCode?: string | null; city?: string | null; province?: string | null; country?: string | null }) {
  const cityLine = join(a.postalCode, a.city);
  const region = a.province && a.province !== a.city ? a.province : null;
  return [
    a.street,
    a.street2,
    join(cityLine, region ? `(${region})` : null),
    a.country && a.country !== "España" ? a.country : null,
  ].filter((v): v is string => !!v);
}

export const issuerName = (i: Pick<IssuerSnapshot, "firstName" | "lastName" | "tradeName">) =>
  i.tradeName || join(i.firstName, i.lastName);

export const clientDisplayName = (c: Partial<ClientSnapshot> & Pick<ClientSnapshot, "type">) =>
  c.type === "empresa" ? (c.companyName ?? "") : join(c.firstName, c.lastName);

const formatIban = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

/** Datos del emisor: la copia guardada al emitir o, en borradores, el perfil actual. */
async function issuerFor(db: Db, issuerId: string, invoice: Detail): Promise<IssuerSnapshot> {
  if (invoice.issuer) return invoice.issuer;
  const [issuer] = await db.select().from(schema.issuers).where(eq(schema.issuers.id, issuerId));
  return issuer! as unknown as IssuerSnapshot;
}

export async function buildPdfData(db: Db, files: R2Bucket, issuerId: string, invoice: Detail): Promise<PdfInvoice> {
  const issuer = await issuerFor(db, issuerId, invoice);
  const [logo, signature] = await Promise.all([
    issuer.logoKey ? files.get(issuer.logoKey).then((o) => (o ? o.arrayBuffer() : null)) : null,
    issuer.showSignature && issuer.signatureKey
      ? files.get(issuer.signatureKey).then((o) => (o ? o.arrayBuffer() : null))
      : null,
  ]);

  const fullName = join(issuer.firstName, issuer.lastName);
  const client = invoice.client;

  return {
    title: invoice.kind === "rectificativa" ? "FACTURA RECTIFICATIVA" : "FACTURA",
    number: invoice.number,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    operationDate: invoice.operationDate,
    rectifies: invoice.kind === "rectificativa"
      ? { number: invoice.rectifies?.number ?? null, reason: invoice.rectificationReason }
      : null,
    issuer: {
      name: issuerName(issuer),
      lines: [
        issuer.tradeName ? fullName : null,
        ...addressLines(issuer),
        issuer.nif ? `NIF: ${issuer.nif}` : null,
        issuer.phone,
        issuer.email,
      ].filter((v): v is string => !!v),
    },
    client: client
      ? {
          name: clientDisplayName(client),
          lines: [
            ...addressLines(client),
            client.nif ? `${client.type === "empresa" ? "NIF" : "DNI/NIE"}: ${client.nif}` : null,
            client.email,
            client.phone,
          ].filter((v): v is string => !!v),
        }
      : null,
    lines: invoice.lines.map((l) => ({
      description: l.description,
      detail: l.detail,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discount,
      lineTotal: l.lineTotal,
    })),
    taxableBase: invoice.taxableBase,
    irpfRate: invoice.irpfRate,
    irpfTotal: invoice.irpfTotal,
    grandTotal: invoice.grandTotal,
    paidAt: invoice.paidAt,
    vatExemptionText: invoice.vatExemptionText ?? (invoice.status === "borrador" ? await currentExemption(db, issuerId) : null),
    notes: invoice.notes,
    bank: [
      issuer.bankHolder && { label: "Titular", value: issuer.bankHolder },
      issuer.bankName && { label: "Banco", value: issuer.bankName },
      issuer.iban && { label: "IBAN", value: formatIban(issuer.iban) },
      issuer.bankAddress && { label: "Dirección del banco", value: issuer.bankAddress },
    ].filter((v): v is { label: string; value: string } => !!v),
    paymentInstructions: invoice.paymentInstructions,
    signature: issuer.showSignature
      ? {
          text: issuer.signatureText,
          name: fullName,
          date: invoice.issueDate,
          image: signature ? new Uint8Array(signature) : null,
        }
      : null,
    logo: logo ? new Uint8Array(logo) : null,
  };
}

async function currentExemption(db: Db, issuerId: string) {
  const [issuer] = await db
    .select({ text: schema.issuers.vatExemptionText })
    .from(schema.issuers)
    .where(eq(schema.issuers.id, issuerId));
  return issuer?.text ?? null;
}

export const pdfFileName = (invoice: Pick<Detail, "number" | "kind">) =>
  `${invoice.kind === "rectificativa" ? "Factura-rectificativa" : "Factura"}-${invoice.number ?? "borrador"}.pdf`;

/**
 * Devuelve el PDF de la factura. Las emitidas se generan una vez y se guardan en R2
 * (son inmutables); los borradores se generan cada vez, con marca de agua.
 * Al cambiar el estado de pago se regenera para reflejar "Pagada el …".
 */
export async function getInvoicePdf(db: Db, files: R2Bucket, issuerId: string, id: string) {
  const invoice = await getInvoiceDetail(db, issuerId, id);
  const key = `issuers/${issuerId}/invoices/${id}.pdf`;

  if (invoice.status === "emitida" && invoice.pdfKey) {
    const stored = await files.get(invoice.pdfKey);
    if (stored) return { invoice, bytes: new Uint8Array(await stored.arrayBuffer()) };
  }

  const bytes = await renderInvoicePdf(await buildPdfData(db, files, issuerId, invoice));
  if (invoice.status === "emitida") {
    await files.put(key, bytes, { httpMetadata: { contentType: "application/pdf" } });
    await db.update(schema.invoices).set({ pdfKey: key }).where(eq(schema.invoices.id, id));
  }
  return { invoice, bytes };
}

/** Invalida el PDF guardado (p. ej. tras registrar un pago) para que se regenere. */
export async function invalidatePdf(db: Db, files: R2Bucket, issuerId: string, id: string) {
  await files.delete(`issuers/${issuerId}/invoices/${id}.pdf`);
  await db.update(schema.invoices).set({ pdfKey: null }).where(eq(schema.invoices.id, id));
}
