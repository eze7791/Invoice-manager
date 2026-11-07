// PDF de la factura con pdf-lib (JavaScript puro, funciona en Workers).
// Usa Helvetica estándar (codificación WinAnsi): cubre tildes, ñ, º/ª y €.
import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

export type PdfParty = {
  name: string;
  lines: string[]; // dirección, NIF, contacto…
};

export type PdfInvoice = {
  title: string; // "FACTURA" o "FACTURA RECTIFICATIVA"
  number: string | null; // null = borrador
  issueDate: string | null;
  dueDate: string | null;
  operationDate: string | null;
  rectifies: { number: string | null; reason: string | null } | null;
  issuer: PdfParty;
  client: PdfParty | null;
  lines: { description: string; detail: string | null; quantity: string; unitPrice: string; discount: string; lineTotal: string }[];
  taxableBase: string;
  irpfRate: string;
  irpfTotal: string;
  grandTotal: string;
  paidAt: Date | null;
  vatExemptionText: string | null;
  notes: string | null;
  bank: { label: string; value: string }[];
  paymentInstructions: string | null;
  signature: { text: string | null; name: string; date: string | null; image: Uint8Array | null } | null;
  logo: Uint8Array | null;
};

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const WIDTH = A4[0] - MARGIN * 2;

const ink = rgb(0.07, 0.09, 0.15);
const muted = rgb(0.42, 0.45, 0.5);
const line = rgb(0.88, 0.89, 0.91);
const band = rgb(0.95, 0.96, 0.97);

// --- Formato ---

const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
export const money = (v: string | number) => euro.format(Number(v));

export function dateEs(iso: string | null | undefined) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const qty = (v: string) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(Number(v));

/** Caracteres que Helvetica WinAnsi no puede dibujar se sustituyen. */
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function clean(text: string) {
  let out = "";
  for (const ch of text.replace(/\t/g, "  ").replace(/\r/g, "")) {
    const code = ch.codePointAt(0)!;
    if (ch === "\n" || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch)) out += ch;
    else out += "?";
  }
  return out;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of clean(text).split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) out.push(current);
      // Palabras más largas que la línea (p. ej. un IBAN sin espacios) se cortan.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
    out.push(current);
  }
  return out;
}

// --- Documento ---

class Layout {
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];

  constructor(
    readonly doc: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
  ) {
    this.addPage();
  }

  addPage() {
    this.page = this.doc.addPage(A4);
    this.pages.push(this.page);
    this.y = A4[1] - MARGIN;
  }

  /** Salta de página si no caben `height` puntos. */
  ensure(height: number) {
    if (this.y - height < MARGIN + 24) this.addPage();
  }

  text(text: string, x: number, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; align?: "left" | "right"; width?: number } = {}) {
    const { size = 9, font = this.regular, color = ink, align = "left", width = 0 } = opts;
    const t = clean(text);
    const dx = align === "right" ? width - font.widthOfTextAtSize(t, size) : 0;
    this.page.drawText(t, { x: x + dx, y: this.y - size, size, font, color });
  }

  /** Párrafo con salto de línea automático; avanza `y`. */
  paragraph(text: string, x: number, maxWidth: number, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; leading?: number } = {}) {
    const { size = 9, leading = 1.35 } = opts;
    for (const l of wrap(text, opts.font ?? this.regular, size, maxWidth)) {
      this.ensure(size * leading);
      this.text(l, x, opts);
      this.y -= size * leading;
    }
  }

  hr(y = this.y, color = line) {
    this.page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.75, color });
  }
}

async function embedImage(doc: PDFDocument, bytes: Uint8Array | null): Promise<PDFImage | null> {
  if (!bytes || bytes.length < 4) return null;
  try {
    // PNG empieza por 0x89 'P' 'N' 'G'; JPEG por 0xFF 0xD8.
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await doc.embedPng(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await doc.embedJpg(bytes);
  } catch {
    // Imagen dañada: se omite.
  }
  return null;
}

function fit(img: PDFImage, maxW: number, maxH: number) {
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  return { width: img.width * scale, height: img.height * scale };
}

export async function renderInvoicePdf(inv: PdfInvoice): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(inv.number ? `${inv.title} ${inv.number}` : `${inv.title} (borrador)`);
  doc.setAuthor(inv.issuer.name);
  doc.setCreator("Invoice Manager");
  doc.setLanguage("es-ES");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const L = new Layout(doc, regular, bold);
  const [logo, signatureImg] = await Promise.all([embedImage(doc, inv.logo), embedImage(doc, inv.signature?.image ?? null)]);

  // --- Cabecera: título y emisor a la izquierda, logo a la derecha ---
  const top = L.y;
  let logoBottom = top;
  if (logo) {
    const { width, height } = fit(logo, 150, 90);
    L.page.drawImage(logo, { x: A4[0] - MARGIN - width, y: top - height, width, height });
    logoBottom = top - height;
  }
  const leftWidth = logo ? WIDTH - 170 : WIDTH;
  L.text(inv.title, MARGIN, { size: 20, font: bold });
  L.y -= 34;
  L.paragraph(inv.issuer.name, MARGIN, leftWidth, { size: 12, font: bold });
  L.y -= 2;
  for (const l of inv.issuer.lines) L.paragraph(l, MARGIN, leftWidth, { color: muted });
  L.y = Math.min(L.y, logoBottom) - 18;

  // --- Recuadro: cliente a la izquierda, datos de la factura a la derecha ---
  const meta: [string, string][] = [
    ["Factura n.º", inv.number ?? "Borrador"],
    ["Fecha de emisión", dateEs(inv.issueDate)],
  ];
  if (inv.operationDate && inv.operationDate !== inv.issueDate) meta.push(["Fecha de operación", dateEs(inv.operationDate)]);
  if (inv.dueDate) meta.push(["Vencimiento", dateEs(inv.dueDate)]);
  if (inv.rectifies?.number) meta.push(["Rectifica a", inv.rectifies.number]);

  const boxTop = L.y;
  const colW = WIDTH / 2 - 16;
  const metaX = MARGIN + WIDTH / 2 + 8;
  L.y -= 12;
  L.text("FACTURAR A", MARGIN + 12, { size: 7.5, font: bold, color: muted });
  L.y -= 14;
  if (inv.client) {
    L.paragraph(inv.client.name, MARGIN + 12, colW, { size: 11, font: bold });
    L.y -= 1;
    for (const l of inv.client.lines) L.paragraph(l, MARGIN + 12, colW, { color: muted });
  } else {
    L.paragraph("Sin cliente", MARGIN + 12, colW, { color: muted });
  }
  const leftBottom = L.y;

  L.y = boxTop - 12;
  for (const [label, value] of meta) {
    L.text(label.toUpperCase(), metaX, { size: 7.5, font: bold, color: muted });
    L.text(value, metaX, { size: 9.5, align: "right", width: A4[0] - MARGIN - 12 - metaX });
    L.y -= 18;
  }
  L.y = Math.min(leftBottom, L.y) - 8;
  L.page.drawRectangle({
    x: MARGIN,
    y: L.y,
    width: WIDTH,
    height: boxTop - L.y,
    borderColor: line,
    borderWidth: 0.75,
  });
  L.y -= 22;

  // --- Tabla de conceptos ---
  const cols = { price: 300, qty: 385, amount: 440 }; // x relativos al margen
  const descWidth = cols.price - 24;
  const header = () => {
    L.page.drawRectangle({ x: MARGIN, y: L.y - 20, width: WIDTH, height: 20, color: band });
    L.y -= 6.5;
    L.text("CONCEPTO", MARGIN + 8, { size: 7.5, font: bold });
    L.text("PRECIO", MARGIN + cols.price, { size: 7.5, font: bold, align: "right", width: 70 });
    L.text("CANT.", MARGIN + cols.qty, { size: 7.5, font: bold, align: "right", width: 40 });
    L.text("IMPORTE", MARGIN + cols.amount, { size: 7.5, font: bold, align: "right", width: WIDTH - cols.amount - 8 });
    L.y -= 22;
  };
  header();

  for (const item of inv.lines) {
    const titleLines = wrap(item.description, bold, 9.5, descWidth);
    const detailLines = item.detail ? wrap(item.detail, regular, 8.5, descWidth) : [];
    const discount = Number(item.discount) > 0 ? [`Descuento -${money(item.discount)}`] : [];
    const height = titleLines.length * 13 + (detailLines.length + discount.length) * 11.5 + 10;
    if (L.y - height < MARGIN + 24) {
      L.addPage();
      header();
    }
    const rowTop = L.y;
    L.text(money(item.unitPrice), MARGIN + cols.price, { size: 9.5, align: "right", width: 70 });
    L.text(qty(item.quantity), MARGIN + cols.qty, { size: 9.5, align: "right", width: 40 });
    L.text(money(item.lineTotal), MARGIN + cols.amount, { size: 9.5, align: "right", width: WIDTH - cols.amount - 8 });
    for (const t of titleLines) {
      L.text(t, MARGIN + 8, { size: 9.5, font: bold });
      L.y -= 13;
    }
    for (const t of [...detailLines, ...discount]) {
      L.text(t, MARGIN + 8, { size: 8.5, color: muted });
      L.y -= 11.5;
    }
    L.y = Math.min(L.y, rowTop - 13) - 8;
    L.hr(L.y + 4);
  }
  L.y -= 10;

  // --- Resumen ---
  const sumX = MARGIN + WIDTH - 230;
  const sumW = 230;
  const rows: [string, string, boolean][] = [["Base imponible", money(inv.taxableBase), false]];
  if (Number(inv.irpfRate) > 0) {
    rows.push([`Retención IRPF (${qty(inv.irpfRate)} %)`, `-${money(inv.irpfTotal)}`, false]);
  }
  rows.push(["Total", money(inv.grandTotal), true]);
  L.ensure(rows.length * 20 + 60);
  for (const [label, value, strong] of rows) {
    if (strong) {
      L.page.drawLine({ start: { x: sumX, y: L.y + 2 }, end: { x: sumX + sumW, y: L.y + 2 }, thickness: 0.75, color: line });
      L.y -= 6;
    }
    const size = strong ? 12 : 9.5;
    const font = strong ? bold : regular;
    L.text(label, sumX + 8, { size, font });
    L.text(value, sumX, { size, font, align: "right", width: sumW - 8 });
    L.y -= strong ? 20 : 17;
  }
  if (inv.paidAt) {
    L.text(`Pagada el ${dateEs(inv.paidAt.toISOString())}`, sumX + 8, { size: 9, color: muted });
    L.text("Pendiente: " + money(0), sumX, { size: 9, color: muted, align: "right", width: sumW - 8 });
    L.y -= 17;
  }
  L.y -= 8;

  // --- Textos legales y observaciones ---
  if (inv.vatExemptionText) {
    L.paragraph(inv.vatExemptionText, MARGIN, WIDTH, { size: 8, color: muted });
    L.y -= 4;
  }
  if (inv.rectifies) {
    L.paragraph(
      `Factura rectificativa de la factura ${inv.rectifies.number ?? ""}.${inv.rectifies.reason ? ` Motivo: ${inv.rectifies.reason}` : ""}`,
      MARGIN,
      WIDTH,
      { size: 8, color: muted },
    );
    L.y -= 4;
  }
  if (inv.notes) {
    L.y -= 8;
    L.ensure(30);
    L.text("Observaciones", MARGIN, { size: 9.5, font: bold });
    L.y -= 15;
    L.paragraph(inv.notes, MARGIN, WIDTH);
  }

  // --- Datos de pago ---
  if (inv.bank.length || inv.paymentInstructions) {
    L.y -= 12;
    L.ensure(40);
    L.text("Instrucciones de pago", MARGIN, { size: 9.5, font: bold });
    L.y -= 15;
    for (const { label, value } of inv.bank) L.paragraph(`${label}: ${value}`, MARGIN, WIDTH);
    if (inv.paymentInstructions) {
      if (inv.bank.length) L.y -= 4;
      L.paragraph(inv.paymentInstructions, MARGIN, WIDTH);
    }
  }

  // --- Pie con firma (opcional) ---
  if (inv.signature) {
    L.y -= 12;
    L.ensure(105);
    L.hr();
    L.y -= 10;
    if (inv.signature.text) L.paragraph(inv.signature.text, MARGIN, WIDTH, { size: 8.5 });
    L.y -= 6;
    const blockW = 200;
    L.text(inv.signature.name, MARGIN + 20, { size: 9, font: bold, align: "right", width: blockW / 2 + 30 });
    L.y -= 14;
    if (signatureImg) {
      const { width, height } = fit(signatureImg, 160, 55);
      L.page.drawImage(signatureImg, { x: MARGIN + 20 + (blockW - width) / 2, y: L.y - height, width, height });
      L.y -= height + 2;
    } else {
      L.y -= 40;
    }
    L.page.drawLine({ start: { x: MARGIN + 20, y: L.y }, end: { x: MARGIN + 20 + blockW, y: L.y }, thickness: 0.75, color: muted });
    L.y -= 4;
    if (inv.signature.date) L.text(dateEs(inv.signature.date), MARGIN + 20, { size: 8.5, color: muted, align: "right", width: blockW / 2 + 22 });
  }

  // --- Numeración de páginas y marca de borrador ---
  const total = L.pages.length;
  L.pages.forEach((page, i) => {
    if (total > 1) {
      const label = `Página ${i + 1} de ${total}`;
      page.drawText(label, {
        x: A4[0] - MARGIN - regular.widthOfTextAtSize(label, 7.5),
        y: MARGIN - 20,
        size: 7.5,
        font: regular,
        color: muted,
      });
    }
    if (!inv.number) {
      page.drawText("BORRADOR", {
        x: 140,
        y: 330,
        size: 90,
        font: bold,
        color: rgb(0.85, 0.2, 0.2),
        opacity: 0.08,
        rotate: degrees(35),
      });
    }
  });

  return doc.save();
}
