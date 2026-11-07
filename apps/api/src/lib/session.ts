import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

/** Exige sesión válida y deja `user` y `session` en el contexto. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const result = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (!result) return c.json({ error: "No autenticado" }, 401);
  c.set("user", result.user);
  c.set("session", result.session);
  await next();
});
