import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { schema } from "../src/db";
import { createClient } from "../src/services/clients";
import { DomainError } from "../src/services/errors";
import {
  createDraft,
  createRectification,
  deleteDraft,
  duplicateInvoice,
  getInvoiceDetail,
  issueInvoice,
  listInvoices,
  markPaid,
  markUnpaid,
  updateDraft,
} from "../src/services/invoices";
import { computeTotals } from "../src/services/money";
import { clientSchema, invoiceDraftSchema, type InvoiceDraftInput } from "../src/validation";
import { createIssuer, db } from "./helpers";

let issuerId: string;
let clientId: string;

async function completeProfile(id: string) {
  await db
    .update(schema.issuers)
    .set({ firstName: "Lucía", lastName: "Martín", nif: "12345678Z", street: "Calle Mayor 1", postalCode: "08001", city: "Barcelona" })
    .where(eq(schema.issuers.id, id));
}

const draft = (overrides: Partial<InvoiceDraftInput> = {}): InvoiceDraftInput =>
  invoiceDraftSchema.parse({
    clientId,
    issueDate: "2026-11-07",
    dueDate: "2026-11-14",
    irpfRate: 15,
    paymentMethod: "transferencia",
    lines: [{ description: "Sesión de fisioterapia", quantity: 1, unitPrice: 100 }],
    ...overrides,
  });

const issueNew = async (overrides: Partial<InvoiceDraftInput> = {}) =>
  issueInvoice(db, issuerId, (await createDraft(db, issuerId, draft(overrides))).id);

const rejects = (p: Promise<unknown>, message?: RegExp) =>
  expect(p).rejects.toSatisfy((e) => e instanceof DomainError && (!message || message.test(e.message)));

beforeEach(async () => {
  issuerId = await createIssuer("inv");
  await completeProfile(issuerId);
  clientId = (await createClient(db, issuerId, clientSchema.parse({ type: "empresa", companyName: "Clínica SL" }))).id;
});

describe("importes", () => {
  it("base 100 € con IRPF 15 % → total 85 €, sin IVA", () => {
    expect(computeTotals([{ quantity: 1, unitPrice: 100 }], 15)).toEqual({
      taxableBase: "100.00",
      vatTotal: "0.00",
      irpfTotal: "15.00",
      grandTotal: "85.00",
    });
  });

  it("particular sin retención → total igual a la base", () => {
    expect(computeTotals([{ quantity: 1, unitPrice: 100 }], 0).grandTotal).toBe("100.00");
  });

  it("aplica cantidades, descuentos y redondeo half-up", () => {
    const totals = computeTotals(
      [
        { quantity: 3, unitPrice: "33.335" }, // 100.005 → 100.01
        { quantity: 2, unitPrice: 50, discount: 10 }, // 90
      ],
      15,
    );
    expect(totals).toMatchObject({ taxableBase: "190.01", irpfTotal: "28.50", grandTotal: "161.51" });
  });
});

describe("numeración", () => {
  it("asigna números correlativos por año al emitir, no al crear el borrador", async () => {
    const a = await createDraft(db, issuerId, draft());
    const b = await createDraft(db, issuerId, draft());
    expect(a.number).toBeNull();

    // Se emite primero el segundo borrador: recibe el 1.
    expect((await issueInvoice(db, issuerId, b.id)).number).toBe(1);
    expect((await issueInvoice(db, issuerId, a.id)).number).toBe(2);
    expect((await issueNew({ issueDate: "2027-01-02" })).number).toBe(1);

    const list = await listInvoices(db, issuerId);
    expect(list.map((i) => i.number).sort()).toEqual(["2026-0001", "2026-0002", "2027-0001"]);
  });

  it("no repite ni salta números con emisiones simultáneas", async () => {
    const drafts = await Promise.all(Array.from({ length: 8 }, () => createDraft(db, issuerId, draft())));
    const issued = await Promise.all(drafts.map((d) => issueInvoice(db, issuerId, d.id)));
    expect(issued.map((i) => i.number).sort((x, y) => x! - y!)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("cada emisor tiene su propia numeración", async () => {
    await issueNew();
    const other = await createIssuer("other");
    await completeProfile(other);
    const otherClient = await createClient(db, other, clientSchema.parse({ type: "particular", firstName: "Ana" }));
    const d = await createDraft(db, other, draft({ clientId: otherClient.id }));
    expect((await issueInvoice(db, other, d.id)).number).toBe(1);
  });
});

describe("emisión", () => {
  it("exige perfil completo, cliente y al menos un concepto", async () => {
    const incomplete = await createIssuer("incomplete");
    const c = await createClient(db, incomplete, clientSchema.parse({ type: "particular", firstName: "Ana" }));
    const d1 = await createDraft(db, incomplete, draft({ clientId: c.id }));
    await rejects(issueInvoice(db, incomplete, d1.id), /Completa tu perfil/);

    await rejects(issueNew({ clientId: null }), /cliente/);
    await rejects(issueNew({ lines: [] }), /concepto/);
  });

  it("guarda copia de los datos: cambiar el cliente después no altera la factura", async () => {
    const issued = await issueNew();
    await db.update(schema.clients).set({ companyName: "Otro nombre SL" }).where(eq(schema.clients.id, clientId));
    const detail = await getInvoiceDetail(db, issuerId, issued.id);
    expect(detail.client).toMatchObject({ companyName: "Clínica SL" });
    expect(detail.issuer).toMatchObject({ nif: "12345678Z" });
    expect(detail).toMatchObject({ taxableBase: "100.00", irpfTotal: "15.00", grandTotal: "85.00" });
  });

  it("una factura emitida no se edita, no se borra ni se vuelve a emitir", async () => {
    const issued = await issueNew();
    await rejects(updateDraft(db, issuerId, issued.id, draft()), /no se puede modificar/);
    await rejects(deleteDraft(db, issuerId, issued.id), /no se puede modificar/);
    await rejects(issueInvoice(db, issuerId, issued.id), /no se puede modificar/);
  });

  it("un borrador se puede editar y borrar", async () => {
    const d = await createDraft(db, issuerId, draft());
    await updateDraft(db, issuerId, d.id, draft({ lines: [{ description: "Otra", quantity: 2, unitPrice: 40, discount: 0, detail: null }] }));
    expect((await getInvoiceDetail(db, issuerId, d.id)).grandTotal).toBe("68.00");
    await deleteDraft(db, issuerId, d.id);
    await rejects(getInvoiceDetail(db, issuerId, d.id), /no encontrada/);
  });
});

describe("rectificativas", () => {
  it("crean un borrador en la serie R que referencia a la original", async () => {
    const original = await issueNew();
    const rect = await createRectification(db, issuerId, original.id, "Precio incorrecto");
    expect(rect).toMatchObject({ kind: "rectificativa", rectifiesId: original.id, status: "borrador" });

    const issued = await issueInvoice(db, issuerId, rect.id);
    expect(issued).toMatchObject({ seriesCode: "R", number: 1 });

    const detail = await getInvoiceDetail(db, issuerId, original.id);
    expect(detail.rectifiedBy.map((r) => r.number)).toEqual(["R2026-0001"]);
    expect(detail.events.map((e) => e.type)).toContain("rectificada");
  });

  it("exigen motivo y solo se hacen sobre facturas emitidas", async () => {
    const original = await issueNew();
    const rect = await createRectification(db, issuerId, original.id, null);
    await rejects(issueInvoice(db, issuerId, rect.id), /motivo/);

    const d = await createDraft(db, issuerId, draft());
    await rejects(createRectification(db, issuerId, d.id, "x"), /emitidas/);
  });
});

describe("pagos", () => {
  it("se marca como pagada con fecha y forma de pago, y se puede deshacer", async () => {
    const issued = await issueNew();
    expect((await listInvoices(db, issuerId, { status: "impagada" })).map((i) => i.id)).toContain(issued.id);

    await markPaid(db, issuerId, issued.id, { method: "efectivo", paidOn: null, note: "En consulta" });
    const paid = await getInvoiceDetail(db, issuerId, issued.id);
    expect(paid).toMatchObject({ paymentStatus: "pagada", paidMethod: "efectivo", paymentNote: "En consulta" });
    expect(paid.paidAt).toBeInstanceOf(Date);
    await rejects(markPaid(db, issuerId, issued.id, { method: "efectivo", paidOn: null, note: null }), /ya está pagada/);

    await markUnpaid(db, issuerId, issued.id);
    expect((await getInvoiceDetail(db, issuerId, issued.id)).paymentStatus).toBe("impagada");
    expect(paid.events.map((e) => e.type)).toEqual(["creada", "emitida", "pagada"]);
  });

  it("un borrador no se puede cobrar", async () => {
    const d = await createDraft(db, issuerId, draft());
    await rejects(markPaid(db, issuerId, d.id, { method: "efectivo", paidOn: null, note: null }), /emitidas/);
  });

  it("vencida = impagada con vencimiento pasado", async () => {
    const overdue = await issueNew({ issueDate: "2026-01-01", dueDate: "2026-01-08" });
    const status = await listInvoices(db, issuerId, { status: "vencida" });
    expect(status.map((i) => i.id)).toEqual([overdue.id]);
  });
});

describe("duplicar", () => {
  it("crea un borrador con el mismo cliente y conceptos, fechado hoy", async () => {
    const issued = await issueNew({ lines: [{ description: "Consulta", quantity: 2, unitPrice: 60, discount: 0, detail: null }] });
    const copy = await duplicateInvoice(db, issuerId, issued.id);
    const detail = await getInvoiceDetail(db, issuerId, copy.id);
    expect(detail).toMatchObject({ status: "borrador", clientId, number: null, kind: "ordinaria" });
    expect(detail.lines.map((l) => [l.description, l.quantity])).toEqual([["Consulta", "2.00"]]);
  });
});

describe("aislamiento", () => {
  it("un emisor no puede ver ni operar facturas de otro", async () => {
    const issued = await issueNew();
    const other = await createIssuer("intruder");
    await completeProfile(other);

    await rejects(getInvoiceDetail(db, other, issued.id), /no encontrada/);
    await rejects(markPaid(db, other, issued.id, { method: "efectivo", paidOn: null, note: null }), /no encontrada/);
    await rejects(createRectification(db, other, issued.id, "x"), /no encontrada/);
    await rejects(duplicateInvoice(db, other, issued.id), /no encontrada/);
    expect(await listInvoices(db, other)).toEqual([]);
  });

  it("no se puede crear un borrador con un cliente de otro emisor", async () => {
    const other = await createIssuer("other2");
    await rejects(createDraft(db, other, draft()), /Cliente no encontrado/);
  });
});
