import { createMiddleware } from "hono/factory";
import { getIssuerByUserId } from "../services/profile";
import { meteredBucket } from "../services/usage";
import type { AppEnv } from "../types";

/** Carga el perfil de emisor del usuario actual. Requiere `requireUser` antes. */
export const requireIssuer = createMiddleware<AppEnv>(async (c, next) => {
  const issuer = await getIssuerByUserId(c.var.db, c.var.user.id);
  c.set("issuer", issuer);
  c.set("files", meteredBucket(c.var.db, issuer.id, c.env.FILES));
  await next();
});
