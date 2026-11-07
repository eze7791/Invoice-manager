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
  updateDraft,
} from "../services/invoices";
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
    return c.json({ id: invoice.id });
  })

  .post("/:id/pay", idParam, zValidator("json", paymentSchema, validationHook), async (c) => {
    await markPaid(c.var.db, c.var.issuer.id, c.req.valid("param").id, c.req.valid("json"));
    return c.json({ ok: true });
  })

  .post("/:id/unpay", idParam, async (c) => {
    await markUnpaid(c.var.db, c.var.issuer.id, c.req.valid("param").id);
    return c.json({ ok: true });
  })

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
