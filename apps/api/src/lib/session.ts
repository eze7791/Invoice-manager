import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

/**
 * Exige sesión válida y deja `user` y `session` en el contexto.
 * La sesión caduca tras 60 minutos sin uso: cada petición la renueva y aquí se reenvía
 * al navegador la cookie con la nueva caducidad.
 */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const { headers, response } = await c.var.auth.api.getSession({ headers: c.req.raw.headers, returnHeaders: true });
  if (!response) return c.json({ error: "No autenticado" }, 401);
  c.set("user", response.user);
  c.set("session", response.session);
  await next();
  // getSetCookie existe en Workers y Node, aunque los tipos de Workers no lo declaren.
  const cookies = (headers as Headers & { getSetCookie(): string[] }).getSetCookie();
  for (const cookie of cookies) c.res.headers.append("Set-Cookie", cookie);
});
