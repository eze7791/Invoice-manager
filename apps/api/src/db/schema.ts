import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

const money = (name: string) => numeric(name, { precision: 12, scale: 2 });
const rate = (name: string) => numeric(name, { precision: 5, scale: 2 });

// --- Better Auth (nombres de tabla y columnas que espera el adaptador) ---

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

// --- Dominio ---

export const clientType = pgEnum("client_type", ["particular", "empresa"]);
export const invoiceStatus = pgEnum("invoice_status", ["borrador", "emitida"]);
export const invoiceKind = pgEnum("invoice_kind", ["ordinaria", "rectificativa"]);
export const paymentMethod = pgEnum("payment_method", ["transferencia", "efectivo"]);
export const invoiceEventType = pgEnum("invoice_event_type", [
  "creada",
  "emitida",
  "enviada",
  "pagada",
  "marcada_impagada",
  "rectificada",
]);

/** Perfil del autónomo que emite las facturas. Uno por usuario. */
export const issuers = pgTable("issuers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  tradeName: text("trade_name"),
  nif: text("nif").notNull().default(""),
  street: text("street").notNull().default(""),
  street2: text("street2"),
  postalCode: text("postal_code").notNull().default(""),
  city: text("city").notNull().default(""),
  province: text("province").notNull().default(""),
  country: text("country").notNull().default("España"),
  email: text("email"),
  phone: text("phone"),
  logoKey: text("logo_key"),
  // Datos de pago
  bankHolder: text("bank_holder"),
  bankName: text("bank_name"),
  iban: text("iban"),
  bankAddress: text("bank_address"),
  paymentInstructions: text("payment_instructions"),
  defaultPaymentMethod: paymentMethod("default_payment_method").notNull().default("transferencia"),
  // Fiscal
  defaultIrpfRate: rate("default_irpf_rate").notNull().default("15.00"),
  vatExemptionText: text("vat_exemption_text")
    .notNull()
    .default("Operación exenta de IVA conforme al artículo 20.Uno.3º de la Ley 37/1992"),
  defaultDueDays: integer("default_due_days").notNull().default(7),
  // Pie con firma (opcional)
  showSignature: boolean("show_signature").notNull().default(false),
  signatureText: text("signature_text"),
  signatureKey: text("signature_key"),
  ...timestamps,
});

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issuerId: uuid("issuer_id")
      .notNull()
      .references(() => issuers.id, { onDelete: "cascade" }),
    type: clientType("type").notNull().default("particular"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    companyName: text("company_name"),
    nif: text("nif"),
    email: text("email"),
    phone: text("phone"),
    street: text("street"),
    street2: text("street2"),
    postalCode: text("postal_code"),
    city: text("city"),
    province: text("province"),
    country: text("country").default("España"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("clients_issuer_id_idx").on(t.issuerId)],
);

/** Servicios guardados para reutilizar en futuras facturas. */
export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issuerId: uuid("issuer_id")
      .notNull()
      .references(() => issuers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    unitPrice: money("unit_price").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("services_issuer_id_idx").on(t.issuerId)],
);

/** Contador por serie y año. Se bloquea con FOR UPDATE al emitir para numerar sin huecos. */
export const invoiceSeries = pgTable(
  "invoice_series",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issuerId: uuid("issuer_id")
      .notNull()
      .references(() => issuers.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // "" para ordinarias, "R" para rectificativas
    year: integer("year").notNull(),
    nextNumber: integer("next_number").notNull().default(1),
  },
  (t) => [uniqueIndex("invoice_series_unique").on(t.issuerId, t.code, t.year)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issuerId: uuid("issuer_id")
      .notNull()
      .references(() => issuers.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "restrict" }),
    kind: invoiceKind("kind").notNull().default("ordinaria"),
    status: invoiceStatus("status").notNull().default("borrador"),
    // Numeración (null mientras es borrador)
    seriesCode: text("series_code"),
    seriesYear: integer("series_year"),
    number: integer("number"),
    // Rectificativa: factura que corrige
    rectifiesId: uuid("rectifies_id").references((): AnyPgColumn => invoices.id),
    rectificationReason: text("rectification_reason"),
    // Fechas
    issueDate: date("issue_date"),
    operationDate: date("operation_date"),
    dueDate: date("due_date"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    // Fiscal
    irpfRate: rate("irpf_rate").notNull().default("15.00"),
    vatRate: rate("vat_rate").notNull().default("0.00"),
    vatExemptionText: text("vat_exemption_text"),
    // Totales (fijos al emitir)
    taxableBase: money("taxable_base").notNull().default("0.00"),
    vatTotal: money("vat_total").notNull().default("0.00"),
    irpfTotal: money("irpf_total").notNull().default("0.00"),
    grandTotal: money("grand_total").notNull().default("0.00"),
    // Copia de los datos al emitir
    issuerSnapshot: jsonb("issuer_snapshot"),
    clientSnapshot: jsonb("client_snapshot"),
    notes: text("notes"),
    paymentMethod: paymentMethod("payment_method"),
    paymentInstructions: text("payment_instructions"),
    // Pago
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidMethod: paymentMethod("paid_method"),
    paymentNote: text("payment_note"),
    // Envío y PDF
    sentAt: timestamp("sent_at", { withTimezone: true }),
    pdfKey: text("pdf_key"),
    ...timestamps,
  },
  (t) => [
    index("invoices_issuer_id_idx").on(t.issuerId),
    index("invoices_client_id_idx").on(t.clientId),
    uniqueIndex("invoices_number_unique")
      .on(t.issuerId, t.seriesCode, t.seriesYear, t.number)
      .where(sql`${t.number} is not null`),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    detail: text("detail"),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    unitPrice: money("unit_price").notNull(),
    discount: money("discount").notNull().default("0.00"),
    lineTotal: money("line_total").notNull(),
  },
  (t) => [index("invoice_lines_invoice_id_idx").on(t.invoiceId)],
);

export const invoiceEvents = pgTable(
  "invoice_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    type: invoiceEventType("type").notNull(),
    data: jsonb("data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invoice_events_invoice_id_idx").on(t.invoiceId)],
);

// --- Relaciones ---

export const issuersRelations = relations(issuers, ({ one, many }) => ({
  user: one(user, { fields: [issuers.userId], references: [user.id] }),
  clients: many(clients),
  services: many(services),
  invoices: many(invoices),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  issuer: one(issuers, { fields: [clients.issuerId], references: [issuers.id] }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  issuer: one(issuers, { fields: [invoices.issuerId], references: [issuers.id] }),
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  lines: many(invoiceLines),
  events: many(invoiceEvents),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLines.invoiceId], references: [invoices.id] }),
}));

export const invoiceEventsRelations = relations(invoiceEvents, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceEvents.invoiceId], references: [invoices.id] }),
}));
