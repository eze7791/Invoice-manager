import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";
import type { InvoiceDraftInput, InvoiceListQuery, PaymentInput } from "../validation";
import { displayName } from "./clients";
import { DomainError } from "./errors";
import { computeTotals, lineTotal, toMoney } from "./money";

const { invoices, invoiceLines, invoiceEvents, invoiceSeries, issuers, clients } = schema;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Conn = Db | Tx;
type Invoice = typeof invoices.$inferSelect;
type EventType = (typeof schema.invoiceEventType.enumValues)[number];

/** Fecha de hoy en España (YYYY-MM-DD). */
export const todayInSpain = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

/** `2026-0001` para ordinarias, `R2026-0001` para rectificativas. */
export function formatInvoiceNumber(inv: Pick<Invoice, "seriesCode" | "seriesYear" | "number">) {
  if (inv.number == null || inv.seriesYear == null) return null;
  return `${inv.seriesCode ?? ""}${inv.seriesYear}-${String(inv.number).padStart(4, "0")}`;
}

const owned = (issuerId: string, id: string) => and(eq(invoices.id, id), eq(invoices.issuerId, issuerId));

async function findOwned(conn: Conn, issuerId: string, id: string, forUpdate = false) {
  const query = conn.select().from(invoices).where(owned(issuerId, id));
  const [invoice] = forUpdate ? await query.for("update") : await query;
  if (!invoice) throw new DomainError("Factura no encontrada", 404);
  return invoice;
}

async function addEvent(conn: Conn, invoiceId: string, type: EventType, data?: Record<string, unknown>) {
  await conn.insert(invoiceEvents).values({ invoiceId, type, data: data ?? null });
}

function assertDraft(invoice: Invoice) {
  if (invoice.status !== "borrador") {
    throw new DomainError("Una factura emitida no se puede modificar. Si hay un error, crea una rectificativa.");
  }
}

async function assertClientOwned(conn: Conn, issuerId: string, clientId: string | null) {
  if (!clientId) return;
  const [client] = await conn
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.issuerId, issuerId)));
  if (!client) throw new DomainError("Cliente no encontrado", 400, { clientId: "Cliente no encontrado" });
}

async function replaceLines(conn: Conn, invoiceId: string, lines: InvoiceDraftInput["lines"]) {
  await conn.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId));
  if (!lines.length) return;
  await conn.insert(invoiceLines).values(
    lines.map((l, position) => ({
      invoiceId,
      position,
      description: l.description,
      detail: l.detail,
      quantity: String(l.quantity),
      unitPrice: String(l.unitPrice),
      discount: String(l.discount),
      lineTotal: toMoney(lineTotal(l)),
    })),
  );
}

function draftValues(input: InvoiceDraftInput) {
  return {
    clientId: input.clientId,
    issueDate: input.issueDate,
    operationDate: input.operationDate,
    dueDate: input.dueDate,
    irpfRate: input.irpfRate.toFixed(2),
    paymentMethod: input.paymentMethod,
    notes: input.notes,
    paymentInstructions: input.paymentInstructions,
    rectificationReason: input.rectificationReason,
    // Los totales del borrador se guardan para mostrarlos en el listado; se recalculan al emitir.
    ...computeTotals(input.lines, input.irpfRate),
  };
}

// --- Borradores ---

export async function createDraft(db: Db, issuerId: string, input: InvoiceDraftInput) {
  return db.transaction(async (tx) => {
    await assertClientOwned(tx, issuerId, input.clientId);
    const [invoice] = await tx.insert(invoices).values({ issuerId, ...draftValues(input) }).returning();
    await replaceLines(tx, invoice!.id, input.lines);
    await addEvent(tx, invoice!.id, "creada");
    return invoice!;
  });
}

export async function updateDraft(db: Db, issuerId: string, id: string, input: InvoiceDraftInput) {
  return db.transaction(async (tx) => {
    const invoice = await findOwned(tx, issuerId, id, true);
    assertDraft(invoice);
    await assertClientOwned(tx, issuerId, input.clientId);
    const [updated] = await tx.update(invoices).set(draftValues(input)).where(eq(invoices.id, id)).returning();
    await replaceLines(tx, id, input.lines);
    return updated!;
  });
}

export async function deleteDraft(db: Db, issuerId: string, id: string) {
  const invoice = await findOwned(db, issuerId, id);
  assertDraft(invoice);
  await db.delete(invoices).where(eq(invoices.id, id));
}

// --- Emisión ---

function issuerSnapshot(issuer: typeof issuers.$inferSelect) {
  return {
    firstName: issuer.firstName,
    lastName: issuer.lastName,
    tradeName: issuer.tradeName,
    nif: issuer.nif,
    street: issuer.street,
    street2: issuer.street2,
    postalCode: issuer.postalCode,
    city: issuer.city,
    province: issuer.province,
    country: issuer.country,
    email: issuer.email,
    phone: issuer.phone,
    logoKey: issuer.logoKey,
    bankHolder: issuer.bankHolder,
    bankName: issuer.bankName,
    iban: issuer.iban,
    bankAddress: issuer.bankAddress,
    showSignature: issuer.showSignature,
    signatureText: issuer.signatureText,
    signatureKey: issuer.signatureKey,
  };
}

function clientSnapshot(client: typeof clients.$inferSelect) {
  return {
    type: client.type,
    firstName: client.firstName,
    lastName: client.lastName,
    companyName: client.companyName,
    nif: client.nif,
    email: client.email,
    phone: client.phone,
    street: client.street,
    street2: client.street2,
    postalCode: client.postalCode,
    city: client.city,
    province: client.province,
    country: client.country,
  };
}

export type IssuerSnapshot = ReturnType<typeof issuerSnapshot>;
export type ClientSnapshot = ReturnType<typeof clientSnapshot>;

/** Datos mínimos que exige una factura española al emisor. */
function missingIssuerData(issuer: typeof issuers.$inferSelect) {
  const required: [keyof typeof issuer, string][] = [
    ["firstName", "nombre"],
    ["lastName", "apellidos"],
    ["nif", "NIF"],
    ["street", "dirección"],
    ["postalCode", "código postal"],
    ["city", "ciudad"],
  ];
  return required.filter(([key]) => !issuer[key]).map(([, label]) => label);
}

/**
 * Emite un borrador: le asigna el siguiente número de su serie y año, guarda copia de los datos
 * del emisor y del cliente y fija los totales. Todo en una transacción; la fila de la serie se
 * bloquea con FOR UPDATE para que dos emisiones simultáneas no reciban el mismo número.
 */
export async function issueInvoice(db: Db, issuerId: string, id: string) {
  return db.transaction(async (tx) => {
    const invoice = await findOwned(tx, issuerId, id, true);
    assertDraft(invoice);

    const [issuer] = await tx.select().from(issuers).where(eq(issuers.id, issuerId));
    const missing = missingIssuerData(issuer!);
    if (missing.length) {
      throw new DomainError(`Completa tu perfil antes de emitir: ${missing.join(", ")}.`, 400);
    }
    if (!invoice.clientId) throw new DomainError("Elige un cliente", 400, { clientId: "Elige un cliente" });
    const [client] = await tx.select().from(clients).where(eq(clients.id, invoice.clientId));
    const lines = await tx.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id));
    if (!lines.length) throw new DomainError("Añade al menos un concepto", 400, { lines: "Añade al menos un concepto" });
    if (invoice.kind === "rectificativa" && !invoice.rectificationReason) {
      throw new DomainError("Indica el motivo de la rectificación", 400, {
        rectificationReason: "Indica el motivo de la rectificación",
      });
    }

    const issueDate = invoice.issueDate ?? todayInSpain();
    const year = Number(issueDate.slice(0, 4));
    const code = invoice.kind === "rectificativa" ? "R" : "";

    await tx.insert(invoiceSeries).values({ issuerId, code, year }).onConflictDoNothing();
    const [series] = await tx
      .select()
      .from(invoiceSeries)
      .where(and(eq(invoiceSeries.issuerId, issuerId), eq(invoiceSeries.code, code), eq(invoiceSeries.year, year)))
      .for("update");
    await tx
      .update(invoiceSeries)
      .set({ nextNumber: series!.nextNumber + 1 })
      .where(eq(invoiceSeries.id, series!.id));

    const totals = computeTotals(lines, invoice.irpfRate, invoice.vatRate);
    const [issued] = await tx
      .update(invoices)
      .set({
        status: "emitida",
        seriesCode: code,
        seriesYear: year,
        number: series!.nextNumber,
        issueDate,
        issuedAt: new Date(),
        vatExemptionText: issuer!.vatExemptionText,
        issuerSnapshot: issuerSnapshot(issuer!),
        clientSnapshot: clientSnapshot(client!),
        ...totals,
      })
      .where(eq(invoices.id, id))
      .returning();

    await addEvent(tx, id, "emitida", { number: formatInvoiceNumber(issued!) });
    if (invoice.rectifiesId) {
      await addEvent(tx, invoice.rectifiesId, "rectificada", {
        by: issued!.id,
        number: formatInvoiceNumber(issued!),
      });
    }
    return issued!;
  });
}

// --- Pagos ---

export async function markPaid(db: Db, issuerId: string, id: string, input: PaymentInput) {
  return db.transaction(async (tx) => {
    const invoice = await findOwned(tx, issuerId, id, true);
    if (invoice.status !== "emitida") throw new DomainError("Solo se pueden cobrar facturas emitidas.");
    if (invoice.paidAt) throw new DomainError("La factura ya está pagada.");

    // Si se indica otro día, se guarda ese día con la hora actual.
    const now = new Date();
    const paidAt = input.paidOn && input.paidOn !== todayInSpain() ? new Date(`${input.paidOn}T12:00:00Z`) : now;
    const [updated] = await tx
      .update(invoices)
      .set({ paidAt, paidMethod: input.method, paymentNote: input.note })
      .where(eq(invoices.id, id))
      .returning();
    await addEvent(tx, id, "pagada", { method: input.method, note: input.note });
    return updated!;
  });
}

export async function markUnpaid(db: Db, issuerId: string, id: string) {
  return db.transaction(async (tx) => {
    const invoice = await findOwned(tx, issuerId, id, true);
    if (!invoice.paidAt) throw new DomainError("La factura no está pagada.");
    const [updated] = await tx
      .update(invoices)
      .set({ paidAt: null, paidMethod: null, paymentNote: null })
      .where(eq(invoices.id, id))
      .returning();
    await addEvent(tx, id, "marcada_impagada");
    return updated!;
  });
}

// --- Duplicar y rectificar ---

async function copyAsDraft(
  tx: Tx,
  issuerId: string,
  source: Invoice,
  extra: Partial<typeof invoices.$inferInsert> = {},
) {
  const lines = await tx
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, source.id))
    .orderBy(asc(invoiceLines.position));
  const issuer = (await tx.select().from(issuers).where(eq(issuers.id, issuerId)))[0]!;
  const today = todayInSpain();
  const dueDate = new Date(`${today}T00:00:00Z`);
  dueDate.setUTCDate(dueDate.getUTCDate() + issuer.defaultDueDays);

  const [draft] = await tx
    .insert(invoices)
    .values({
      issuerId,
      clientId: source.clientId,
      irpfRate: source.irpfRate,
      paymentMethod: source.paymentMethod,
      notes: source.notes,
      paymentInstructions: source.paymentInstructions,
      issueDate: today,
      dueDate: dueDate.toISOString().slice(0, 10),
      taxableBase: source.taxableBase,
      irpfTotal: source.irpfTotal,
      vatTotal: source.vatTotal,
      grandTotal: source.grandTotal,
      ...extra,
    })
    .returning();
  if (lines.length) {
    await tx.insert(invoiceLines).values(
      lines.map(({ id: _id, invoiceId: _inv, ...l }) => ({ ...l, invoiceId: draft!.id })),
    );
  }
  await addEvent(tx, draft!.id, "creada", { from: source.id });
  return draft!;
}

export async function duplicateInvoice(db: Db, issuerId: string, id: string) {
  return db.transaction(async (tx) => {
    const source = await findOwned(tx, issuerId, id);
    return copyAsDraft(tx, issuerId, source);
  });
}

/** Crea un borrador de factura rectificativa (serie R) que sustituye a una factura emitida. */
export async function createRectification(db: Db, issuerId: string, id: string, reason: string | null) {
  return db.transaction(async (tx) => {
    const source = await findOwned(tx, issuerId, id);
    if (source.status !== "emitida") throw new DomainError("Solo se rectifican facturas emitidas.");
    if (source.kind === "rectificativa") throw new DomainError("Rectifica la factura original, no la rectificativa.");
    return copyAsDraft(tx, issuerId, source, {
      kind: "rectificativa",
      rectifiesId: source.id,
      rectificationReason: reason,
    });
  });
}

// --- Consultas ---

const clientLabel = sql<string>`coalesce(
  nullif(${invoices.clientSnapshot}->>'companyName', ''),
  nullif(trim(concat_ws(' ', ${invoices.clientSnapshot}->>'firstName', ${invoices.clientSnapshot}->>'lastName')), ''),
  ${displayName}
)`;

const numberLabel = sql<string>`${invoices.seriesCode} || ${invoices.seriesYear} || '-' || lpad(${invoices.number}::text, 4, '0')`;

export async function listInvoices(db: Db, issuerId: string, query: InvoiceListQuery = {}) {
  const today = todayInSpain();
  const filters: SQL[] = [eq(invoices.issuerId, issuerId)];

  switch (query.status) {
    case "borrador":
      filters.push(eq(invoices.status, "borrador"));
      break;
    case "pagada":
      filters.push(isNotNull(invoices.paidAt));
      break;
    case "impagada":
      filters.push(eq(invoices.status, "emitida"), isNull(invoices.paidAt));
      break;
    case "vencida":
      filters.push(eq(invoices.status, "emitida"), isNull(invoices.paidAt), lt(invoices.dueDate, today));
      break;
  }
  if (query.clientId) filters.push(eq(invoices.clientId, query.clientId));
  if (query.from) filters.push(gte(invoices.issueDate, query.from));
  if (query.to) filters.push(lte(invoices.issueDate, query.to));
  const q = query.q?.trim();
  if (q) filters.push(or(ilike(clientLabel, `%${q}%`), ilike(numberLabel, `%${q}%`))!);

  const rows = await db
    .select({
      id: invoices.id,
      kind: invoices.kind,
      status: invoices.status,
      seriesCode: invoices.seriesCode,
      seriesYear: invoices.seriesYear,
      number: invoices.number,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      grandTotal: invoices.grandTotal,
      paidAt: invoices.paidAt,
      clientName: clientLabel,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .leftJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(...filters))
    .orderBy(
      // Borradores primero, luego por fecha y número descendentes.
      sql`case when ${invoices.status} = 'borrador' then 0 else 1 end`,
      desc(invoices.issueDate),
      desc(invoices.number),
      desc(invoices.createdAt),
    );

  return rows.map(({ seriesCode, seriesYear, number, ...r }) => ({
    ...r,
    number: formatInvoiceNumber({ seriesCode, seriesYear, number }),
    paymentStatus: paymentStatus(r.status, r.paidAt, r.dueDate, today),
  }));
}

export type PaymentStatus = "borrador" | "pagada" | "vencida" | "impagada";

function paymentStatus(status: Invoice["status"], paidAt: Date | null, dueDate: string | null, today: string): PaymentStatus {
  if (status === "borrador") return "borrador";
  if (paidAt) return "pagada";
  if (dueDate && dueDate < today) return "vencida";
  return "impagada";
}

export async function getInvoiceDetail(db: Db, issuerId: string, id: string) {
  const invoice = await findOwned(db, issuerId, id);
  const [lines, events, client] = await Promise.all([
    db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id)).orderBy(asc(invoiceLines.position)),
    db.select().from(invoiceEvents).where(eq(invoiceEvents.invoiceId, id)).orderBy(asc(invoiceEvents.createdAt)),
    invoice.clientId ? db.query.clients.findFirst({ where: eq(clients.id, invoice.clientId) }) : null,
  ]);

  const relatedIds = [invoice.rectifiesId].filter((v): v is string => !!v);
  const related = await db
    .select({ id: invoices.id, seriesCode: invoices.seriesCode, seriesYear: invoices.seriesYear, number: invoices.number, status: invoices.status })
    .from(invoices)
    .where(
      and(
        eq(invoices.issuerId, issuerId),
        relatedIds.length ? or(inArray(invoices.id, relatedIds), eq(invoices.rectifiesId, id)) : eq(invoices.rectifiesId, id),
      ),
    );
  const label = (r: (typeof related)[number]) => ({ id: r.id, number: formatInvoiceNumber(r), status: r.status });

  const { issuerSnapshot: issuerSnap, clientSnapshot: clientSnap, ...rest } = invoice;
  return {
    ...rest,
    number: formatInvoiceNumber(invoice),
    paymentStatus: paymentStatus(invoice.status, invoice.paidAt, invoice.dueDate, todayInSpain()),
    client: (clientSnap as ClientSnapshot | null) ?? client ?? null,
    issuer: issuerSnap as IssuerSnapshot | null,
    lines,
    events,
    rectifies: related.filter((r) => r.id === invoice.rectifiesId).map(label)[0] ?? null,
    rectifiedBy: related.filter((r) => r.id !== invoice.rectifiesId).map(label),
  };
}

/** Registra que la factura se envió al cliente. */
export async function recordSent(db: Db, issuerId: string, id: string, to: string) {
  const invoice = await findOwned(db, issuerId, id);
  if (invoice.status !== "emitida") throw new DomainError("Solo se pueden enviar facturas emitidas.");
  await db.update(invoices).set({ sentAt: new Date() }).where(eq(invoices.id, id));
  await addEvent(db, id, "enviada", { to });
}
