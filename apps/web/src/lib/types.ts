export type PaymentMethod = "transferencia" | "efectivo";

export type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  tradeName: string | null;
  nif: string;
  street: string;
  street2: string | null;
  postalCode: string;
  city: string;
  province: string;
  country: string;
  email: string | null;
  phone: string | null;
  bankHolder: string | null;
  bankName: string | null;
  iban: string | null;
  bankAddress: string | null;
  paymentInstructions: string | null;
  defaultPaymentMethod: PaymentMethod;
  defaultIrpfRate: string;
  vatExemptionText: string;
  defaultDueDays: number;
  showSignature: boolean;
  signatureText: string | null;
  hasLogo: boolean;
  hasSignature: boolean;
  mailConnected: boolean;
  smtpUser: string | null;
  emailCopyToSelf: boolean;
  updatedAt: string;
};

export type ClientType = "particular" | "empresa";

export type Client = {
  id: string;
  type: ClientType;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  nif: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  street2: string | null;
  postalCode: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  notes: string | null;
  archivedAt: string | null;
};

export function clientName(c: Pick<Client, "type"> & Partial<Pick<Client, "companyName" | "firstName" | "lastName">>) {
  return c.type === "empresa"
    ? (c.companyName ?? "")
    : [c.firstName, c.lastName].filter(Boolean).join(" ");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export type InvoiceStatus = "borrador" | "emitida";
export type PaymentStatus = "borrador" | "impagada" | "vencida" | "pagada";

export type InvoiceListItem = {
  id: string;
  kind: "ordinaria" | "rectificativa";
  status: InvoiceStatus;
  number: string | null;
  issueDate: string | null;
  dueDate: string | null;
  grandTotal: string;
  paidAt: string | null;
  clientName: string | null;
  paymentStatus: PaymentStatus;
};

export type InvoiceLine = {
  id?: string;
  description: string;
  detail: string | null;
  quantity: string;
  unitPrice: string;
  discount: string;
  lineTotal?: string;
};

export type InvoiceEventType = "creada" | "emitida" | "enviada" | "pagada" | "marcada_impagada" | "rectificada";

export type InvoiceDetail = {
  id: string;
  kind: "ordinaria" | "rectificativa";
  status: InvoiceStatus;
  number: string | null;
  paymentStatus: PaymentStatus;
  clientId: string | null;
  issueDate: string | null;
  operationDate: string | null;
  dueDate: string | null;
  issuedAt: string | null;
  irpfRate: string;
  vatExemptionText: string | null;
  taxableBase: string;
  irpfTotal: string;
  grandTotal: string;
  notes: string | null;
  paymentInstructions: string | null;
  paymentMethod: PaymentMethod | null;
  paidAt: string | null;
  paidMethod: PaymentMethod | null;
  paymentNote: string | null;
  sentAt: string | null;
  rectificationReason: string | null;
  client: (Partial<Client> & Pick<Client, "type">) | null;
  lines: InvoiceLine[];
  events: { id: string; type: InvoiceEventType; data: Record<string, unknown> | null; createdAt: string }[];
  rectifies: { id: string; number: string | null } | null;
  rectifiedBy: { id: string; number: string | null; status: InvoiceStatus }[];
};

export type SavedService = { id: string; name: string; description: string | null; unitPrice: string };
