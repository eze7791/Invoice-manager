import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  createClient,
  deleteClient,
  getClient,
  listClients,
  setClientArchived,
  updateClient,
} from "../services/clients";
import type { AppEnv } from "../types";
import { clientSchema } from "../validation";
import { validationHook } from "./validation-hook";

const idParam = z.object({ id: z.uuid() });
const notFound = { error: "Cliente no encontrado" } as const;

export const clientRoutes = new Hono<AppEnv>()
  .get(
    "/",
    zValidator("query", z.object({ q: z.string().optional(), archived: z.enum(["1", "0"]).optional() })),
    async (c) => {
      const { q, archived } = c.req.valid("query");
      return c.json(await listClients(c.var.db, c.var.issuer.id, { q, archived: archived === "1" }));
    },
  )

  .post("/", zValidator("json", clientSchema, validationHook), async (c) => {
    const client = await createClient(c.var.db, c.var.issuer.id, c.req.valid("json"));
    return c.json(client, 201);
  })

  .get("/:id", zValidator("param", idParam), async (c) => {
    const client = await getClient(c.var.db, c.var.issuer.id, c.req.valid("param").id);
    return client ? c.json(client) : c.json(notFound, 404);
  })

  .put("/:id", zValidator("param", idParam), zValidator("json", clientSchema, validationHook), async (c) => {
    const client = await updateClient(c.var.db, c.var.issuer.id, c.req.valid("param").id, c.req.valid("json"));
    return client ? c.json(client) : c.json(notFound, 404);
  })

  .post("/:id/archive", zValidator("param", idParam), async (c) => {
    const client = await setClientArchived(c.var.db, c.var.issuer.id, c.req.valid("param").id, true);
    return client ? c.json(client) : c.json(notFound, 404);
  })

  .post("/:id/unarchive", zValidator("param", idParam), async (c) => {
    const client = await setClientArchived(c.var.db, c.var.issuer.id, c.req.valid("param").id, false);
    return client ? c.json(client) : c.json(notFound, 404);
  })

  .delete("/:id", zValidator("param", idParam), async (c) => {
    const result = await deleteClient(c.var.db, c.var.issuer.id, c.req.valid("param").id);
    if (result === "not_found") return c.json(notFound, 404);
    if (result === "has_invoices") {
      return c.json({ error: "El cliente tiene facturas. Puedes archivarlo en lugar de borrarlo." }, 409);
    }
    return c.body(null, 204);
  });
