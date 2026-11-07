import { createMiddleware } from "hono/factory";
import { getIssuerByUserId } from "../services/profile";
import type { AppEnv } from "../types";

/** Carga el perfil de emisor del usuario actual. Requiere `requireUser` antes. */
export const requireIssuer = createMiddleware<AppEnv>(async (c, next) => {
  c.set("issuer", await getIssuerByUserId(c.var.db, c.var.user.id));
  await next();
});
