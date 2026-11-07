// Genera un PDF de ejemplo con datos ficticios para revisar el diseño.
// Uso: npx tsx scripts/sample-pdf.ts <salida.pdf>
import { writeFileSync } from "node:fs";
import { renderInvoicePdf } from "../src/pdf/invoice-pdf";

const out = process.argv[2] ?? "factura-ejemplo.pdf";
const bytes = await renderInvoicePdf({
  title: "FACTURA",
  number: "2026-0001",
  issueDate: "2026-11-07",
  dueDate: "2026-11-14",
  operationDate: null,
  rectifies: null,
  issuer: {
    name: "Lucía Martín García",
    lines: ["Calle Mayor 12", "3º 1ª", "08001 Barcelona", "NIF: 12345678Z", "612 345 678", "lucia@ejemplo.es"],
  },
  client: {
    name: "Clínica Sol SL",
    lines: ["Avenida Diagonal 100", "Local 2", "08019 Barcelona", "NIF: B12345674", "admin@clinicasol.es"],
  },
  lines: [
    { description: "Sesión de fisioterapia", detail: "Tratamiento de 60 minutos", quantity: "4", unitPrice: "60", discount: "0", lineTotal: "240.00" },
    { description: "Valoración inicial", detail: null, quantity: "1", unitPrice: "45", discount: "5", lineTotal: "40.00" },
  ],
  taxableBase: "280.00",
  irpfRate: "15.00",
  irpfTotal: "42.00",
  grandTotal: "238.00",
  paidAt: new Date("2026-11-10T10:00:00Z"),
  vatExemptionText: "Operación exenta de IVA conforme al artículo 20.Uno.3º de la Ley 37/1992",
  notes: "Gracias por su confianza.",
  bank: [
    { label: "Titular", value: "Lucía Martín García" },
    { label: "Banco", value: "Banco Ejemplo" },
    { label: "IBAN", value: "ES91 2100 0418 4502 0005 1332" },
  ],
  paymentInstructions: "Indique el número de factura en el concepto de la transferencia.",
  signature: { text: "Al firmar este documento, el cliente acepta los servicios y condiciones descritos.", name: "Lucía Martín García", date: "2026-11-07", image: null },
  logo: null,
});
writeFileSync(out, bytes);
console.log(`PDF generado: ${out} (${bytes.length} bytes)`);
