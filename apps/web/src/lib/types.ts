export type PaymentMethod = "transferencia" | "efectivo";

export type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  tradeName: string | null;
  nif: string;
  street: string;
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
  defaultPaymentMethod: PaymentMethod;
  defaultIrpfRate: string;
  vatExemptionText: string;
  defaultDueDays: number;
  showSignature: boolean;
  signatureText: string | null;
  hasLogo: boolean;
  hasSignature: boolean;
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
  postalCode: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  notes: string | null;
  archivedAt: string | null;
};

export function clientName(c: Pick<Client, "type" | "companyName" | "firstName" | "lastName">) {
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
