import { z } from "zod";
import { isValidNif, normalizeNif } from "./lib/nif";

/** Texto opcional: cadenas vacías se guardan como null. */
const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const requiredText = (max = 200) => z.string().trim().max(max);

const optionalNif = z
  .string()
  .nullish()
  .transform((v) => (v ? normalizeNif(v) : null))
  .refine((v) => v === null || isValidNif(v), { message: "NIF/NIE no válido" });

const optionalEmail = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v.toLowerCase() : null))
  .refine((v) => v === null || z.email().safeParse(v).success, { message: "Email no válido" });

const optionalIban = z
  .string()
  .nullish()
  .transform((v) => (v ? v.toUpperCase().replace(/\s/g, "") : null))
  .refine((v) => v === null || /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v), { message: "IBAN no válido" });

export const profileSchema = z.object({
  firstName: requiredText(),
  lastName: requiredText(),
  tradeName: optionalText(),
  nif: z
    .string()
    .transform((v) => normalizeNif(v))
    .refine((v) => v === "" || isValidNif(v), { message: "NIF/NIE no válido" }),
  street: requiredText(),
  street2: optionalText(),
  postalCode: requiredText(10),
  city: requiredText(),
  province: requiredText(),
  country: requiredText().default("España"),
  email: optionalEmail,
  phone: optionalText(30),
  bankHolder: optionalText(),
  bankName: optionalText(),
  iban: optionalIban,
  bankAddress: optionalText(),
  paymentInstructions: optionalText(500),
  defaultPaymentMethod: z.enum(["transferencia", "efectivo"]),
  defaultIrpfRate: z.coerce.number().min(0).max(100).transform((v) => v.toFixed(2)),
  vatExemptionText: requiredText(500),
  defaultDueDays: z.coerce.number().int().min(0).max(365),
  showSignature: z.boolean(),
  emailCopyToSelf: z.boolean().default(false),
  signatureText: optionalText(500),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const clientSchema = z
  .object({
    type: z.enum(["particular", "empresa"]),
    firstName: optionalText(),
    lastName: optionalText(),
    companyName: optionalText(),
    nif: optionalNif,
    email: optionalEmail,
    phone: optionalText(30),
    street: optionalText(),
    street2: optionalText(),
    postalCode: optionalText(10),
    city: optionalText(),
    province: optionalText(),
    country: optionalText(),
    notes: optionalText(2000),
  })
  .superRefine((c, ctx) => {
    if (c.type === "empresa" && !c.companyName) {
      ctx.addIssue({ code: "custom", path: ["companyName"], message: "Indica la razón social" });
    }
    if (c.type === "particular" && !c.firstName) {
      ctx.addIssue({ code: "custom", path: ["firstName"], message: "Indica el nombre" });
    }
  });

export type ClientInput = z.infer<typeof clientSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Fecha no válida" });
const amount = (max = 1_000_000) => z.coerce.number().min(0, { message: "No puede ser negativo" }).max(max);

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1, { message: "Indica el concepto" }).max(200),
  detail: optionalText(1000),
  quantity: z.coerce.number().gt(0, { message: "La cantidad debe ser mayor que 0" }).max(100_000),
  unitPrice: amount(),
  discount: amount().default(0),
});

export const invoiceDraftSchema = z.object({
  clientId: z.uuid().nullish().transform((v) => v ?? null),
  issueDate: isoDate.nullish().transform((v) => v ?? null),
  operationDate: isoDate.nullish().transform((v) => v || null),
  dueDate: isoDate.nullish().transform((v) => v || null),
  irpfRate: z.coerce.number().min(0).max(100),
  paymentMethod: z.enum(["transferencia", "efectivo"]),
  notes: optionalText(2000),
  paymentInstructions: optionalText(500),
  rectificationReason: optionalText(500),
  lines: z.array(invoiceLineSchema).max(100),
});

export type InvoiceDraftInput = z.infer<typeof invoiceDraftSchema>;

export const paymentSchema = z.object({
  method: z.enum(["transferencia", "efectivo"]),
  paidOn: isoDate.nullish().transform((v) => v ?? null),
  note: optionalText(500),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export const savedServiceSchema = z.object({
  name: z.string().trim().min(1, { message: "Indica el nombre" }).max(200),
  description: optionalText(1000),
  unitPrice: amount(),
});

export type SavedServiceInput = z.infer<typeof savedServiceSchema>;

export const invoiceListQuery = z.object({
  status: z.enum(["borrador", "impagada", "vencida", "pagada"]).optional(),
  clientId: z.uuid().optional(),
  q: z.string().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export type InvoiceListQuery = z.infer<typeof invoiceListQuery>;
