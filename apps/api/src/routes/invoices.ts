import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
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
  recordSent,
  updateDraft,
} from "../services/invoices";
import { clientDisplayName, getInvoicePdf, invalidatePdf, issuerName, pdfFileName } from "../services/documents";
import { sendInvoiceEmail } from "../services/email";
import { formatEuroPlain } from "../services/money";
import type { AppEnv } from "../types";
import { invoiceDraftSchema, invoiceListQuery, paymentSchema } from "../validation";
import { validationHook } from "./validation-hook";

const idParam = zValidator("param", z.object({ id: z.uuid() }));

export const invoiceRoutes = new Hono<AppEnv>()
  .get("/", zValidator("query", invoiceListQuery), async (c) =>
    c.json(await listInvoices(c.var.db, c.var.issuer.id, c.req.valid("query"))),
  )

  .post("/", zValidator("json", invoiceDraftSchema, validationHook), async (c) => {
    const invoice = await createDraft(c.var.db, c.var.issuer.id, c.req.valid("json"));
    return c.json({ id: invoice.id }, 201);
  })

  .get("/:id", idParam, async (c) => c.json(await getInvoiceDetail(c.var.db, c.var.issuer.id, c.req.valid("param").id)))

  .put("/:id", idParam, zValidator("json", invoiceDraftSchema, validationHook), async (c) => {
    await updateDraft(c.var.db, c.var.issuer.id, c.req.valid("param").id, c.req.valid("json"));
    return c.json({ ok: true });
  })

  .delete("/:id", idParam, async (c) => {
    await deleteDraft(c.var.db, c.var.issuer.id, c.req.valid("param").id);
    return c.body(null, 204);
  })

  .post("/:id/issue", idParam, async (c) => {
    const invoice = await issueInvoice(c.var.db, c.var.issuer.id, c.req.valid("param").id);
    // El PDF definitivo se genera y guarda en segundo plano.
    c.executionCtx.waitUntil(getInvoicePdf(c.var.db, c.env.FILES, c.var.issuer.id, invoice.id).catch(console.error));
    return c.json({ id: invoice.id });
  })

  .post("/:id/pay", idParam, zValidator("json", paymentSchema, validationHook), async (c) => {
    const { id } = c.req.valid("param");
    await markPaid(c.var.db, c.var.issuer.id, id, c.req.valid("json"));
    await invalidatePdf(c.var.db, c.env.FILES, c.var.issuer.id, id);
    return c.json({ ok: true });
  })

  .post("/:id/unpay", idParam, async (c) => {
    const { id } = c.req.valid("param");
    await markUnpaid(c.var.db, c.var.issuer.id, id);
    await invalidatePdf(c.var.db, c.env.FILES, c.var.issuer.id, id);
    return c.json({ ok: true });
  })

  .get("/:id/pdf", idParam, zValidator("query", z.object({ download: z.string().optional() })), async (c) => {
    const { invoice, bytes } = await getInvoicePdf(c.var.db, c.env.FILES, c.var.issuer.id, c.req.valid("param").id);
    const disposition = c.req.valid("query").download ? "attachment" : "inline";
    return c.body(bytes as Uint8Array<ArrayBuffer>, 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${pdfFileName(invoice)}"`,
      "Cache-Control": "private, no-store",
    });
  })

  .post(
    "/:id/send",
    idParam,
    zValidator(
      "json",
      z.object({ to: z.email({ message: "Email no válido" }), message: z.string().trim().max(2000).optional() }),
      validationHook,
    ),
    async (c) => {
      const { id } = c.req.valid("param");
      const { to, message } = c.req.valid("json");
      const { invoice, bytes } = await getInvoicePdf(c.var.db, c.env.FILES, c.var.issuer.id, id);
      if (invoice.status !== "emitida") return c.json({ error: "Solo se pueden enviar facturas emitidas." }, 409);

      const issuer = invoice.issuer!;
      const from = issuerName(issuer);
      const greeting = invoice.client ? `Hola ${clientDisplayName(invoice.client)}:` : "Hola:";
      const due = invoice.dueDate ? ` con vencimiento el ${invoice.dueDate.split("-").reverse().join("/")}` : "";
      const body = [
        greeting,
        "",
        message ||
          `Te adjunto la factura ${invoice.number} por importe de ${formatEuroPlain(invoice.grandTotal)}${due}.`,
        invoice.paymentInstructions ? `\n${invoice.paymentInstructions}` : null,
        "",
        "Un saludo,",
        from,
      ]
        .filter((l) => l !== null)
        .join("\n");

      await sendInvoiceEmail(c.env, {
        to,
        fromName: from,
        replyTo: issuer.email,
        subject: `Factura ${invoice.number} - ${from}`,
        body,
        attachment: { filename: pdfFileName(invoice), bytes },
      });
      await recordSent(c.var.db, c.var.issuer.id, id, to);
      return c.json({ ok: true });
    },
  )

  .post("/:id/duplicate", idParam, async (c) => {
    const draft = await duplicateInvoice(c.var.db, c.var.issuer.id, c.req.valid("param").id);
    return c.json({ id: draft.id }, 201);
  })

  .post(
    "/:id/rectify",
    idParam,
    zValidator("json", z.object({ reason: z.string().trim().max(500).nullish() }), validationHook),
    async (c) => {
      const draft = await createRectification(
        c.var.db,
        c.var.issuer.id,
        c.req.valid("param").id,
        c.req.valid("json").reason || null,
      );
      return c.json({ id: draft.id }, 201);
    },
  );
