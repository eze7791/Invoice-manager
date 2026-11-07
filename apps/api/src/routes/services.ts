import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { archiveService, createService, listServices } from "../services/catalog";
import type { AppEnv } from "../types";
import { savedServiceSchema } from "../validation";
import { validationHook } from "./validation-hook";

export const serviceRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await listServices(c.var.db, c.var.issuer.id)))

  .post("/", zValidator("json", savedServiceSchema, validationHook), async (c) =>
    c.json(await createService(c.var.db, c.var.issuer.id, c.req.valid("json")), 201),
  )

  .delete("/:id", zValidator("param", z.object({ id: z.uuid() })), async (c) => {
    const service = await archiveService(c.var.db, c.var.issuer.id, c.req.valid("param").id);
    return service ? c.body(null, 204) : c.json({ error: "Servicio no encontrado" }, 404);
  });
