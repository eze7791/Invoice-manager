import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { buildExport } from "../services/export";
import type { AppEnv } from "../types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const exportRoutes = new Hono<AppEnv>().get(
  "/",
  zValidator("query", z.object({ from: isoDate, to: isoDate })),
  async (c) => {
    const { from, to } = c.req.valid("query");
    if (from > to) return c.json({ error: "La fecha inicial es posterior a la final" }, 400);
    const { zip } = await buildExport(c.var.db, c.env.FILES, c.var.issuer.id, from, to);
    return c.body(zip as Uint8Array<ArrayBuffer>, 200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="facturas_${from}_${to}.zip"`,
      "Cache-Control": "private, no-store",
    });
  },
);
