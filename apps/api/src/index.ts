import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { createDb } from "./db";
import { createAuth } from "./lib/auth";
import { requireIssuer } from "./lib/issuer";
import { requireUser } from "./lib/session";
import { clientRoutes } from "./routes/clients";
import { exportRoutes } from "./routes/export";
import { invoiceRoutes } from "./routes/invoices";
import { serviceRoutes } from "./routes/services";
import { getDashboard } from "./services/dashboard";
import { DomainError } from "./services/errors";
import { profileRoutes } from "./routes/profile";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>().basePath("/api");

// Cabeceras de seguridad en las respuestas de la API (la web estática las recibe de public/_headers).
const baseHeaders = {
  strictTransportSecurity: "max-age=31536000; includeSubDomains",
  xFrameOptions: "DENY",
  referrerPolicy: "same-origin",
};
const withCsp = secureHeaders({ ...baseHeaders, contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } });
// Sin CSP en el PDF: con `default-src 'none'` algunos visores de PDF del navegador no lo muestran.
const withoutCsp = secureHeaders(baseHeaders);
app.use("*", (c, next) => (c.req.path.endsWith("/pdf") ? withoutCsp(c, next) : withCsp(c, next)));

// Una conexión y una instancia de Better Auth por petición (los bindings solo existen en la petición).
app.use("*", async (c, next) => {
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  c.set("db", db);
  c.set("auth", createAuth(db, c.env));
  await next();
});

app.on(["GET", "POST"], "/auth/*", (c) => c.var.auth.handler(c.req.raw));

app.get("/health", (c) => c.json({ ok: true }));

app.get("/me", requireUser, (c) => {
  const { id, name, email } = c.var.user;
  return c.json({ id, name, email });
});

// Todo lo que sigue exige sesión y opera sobre el emisor del usuario.
app.use("/profile/*", requireUser, requireIssuer);
app.use("/clients/*", requireUser, requireIssuer);
app.use("/invoices/*", requireUser, requireIssuer);
app.use("/services/*", requireUser, requireIssuer);
app.use("/export/*", requireUser, requireIssuer);
app.route("/profile", profileRoutes);
app.route("/clients", clientRoutes);
app.route("/invoices", invoiceRoutes);
app.route("/services", serviceRoutes);
app.route("/export", exportRoutes);

app.get("/dashboard", requireUser, requireIssuer, async (c) => c.json(await getDashboard(c.var.db, c.var.issuer.id)));

app.notFound((c) => c.json({ error: "No encontrado" }, 404));

app.onError((err, c) => {
  if (err instanceof DomainError) {
    return c.json({ error: err.message, fields: err.fields }, err.status);
  }
  console.error(err);
  return c.json({ error: "Error interno" }, 500);
});

export default app;
