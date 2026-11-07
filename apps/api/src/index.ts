import { Hono } from "hono";
import { createDb } from "./db";
import { createAuth } from "./lib/auth";
import { requireIssuer } from "./lib/issuer";
import { requireUser } from "./lib/session";
import { clientRoutes } from "./routes/clients";
import { profileRoutes } from "./routes/profile";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>().basePath("/api");

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
app.route("/profile", profileRoutes);
app.route("/clients", clientRoutes);

app.notFound((c) => c.json({ error: "No encontrado" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Error interno" }, 500);
});

export default app;
