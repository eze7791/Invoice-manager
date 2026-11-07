import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { connectMailAccount, disconnectMailAccount, mailAccountFor, requireAccount, sendMail } from "../services/email";
import { getIssuerByUserId, setIssuerFile, updateProfile, type FileKind } from "../services/profile";
import { z } from "zod";
import type { AppEnv } from "../types";
import { profileSchema } from "../validation";
import { validationHook } from "./validation-hook";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
// Solo PNG y JPG: son los formatos que se pueden incrustar en el PDF.
const IMAGE_TYPES = ["image/png", "image/jpeg"];

const isFileKind = (v: string): v is FileKind => v === "logo" || v === "signature";

/** Quita las claves internas de R2 y expone si hay logo o firma. */
function present(issuer: AppEnv["Variables"]["issuer"]) {
  const { logoKey, signatureKey, smtpPasswordEnc, userId: _userId, ...rest } = issuer;
  return { ...rest, hasLogo: !!logoKey, hasSignature: !!signatureKey, mailConnected: !!(rest.smtpUser && smtpPasswordEnc) };
}

export const profileRoutes = new Hono<AppEnv>()
  .get("/", (c) => c.json(present(c.var.issuer)))

  .put("/", zValidator("json", profileSchema, validationHook), async (c) => {
    const updated = await updateProfile(c.var.db, c.var.issuer.id, c.req.valid("json"));
    return c.json(present(updated));
  })

  // Cuenta de Gmail para enviar facturas: se guarda cifrada y se comprueba con un email de prueba.
  .put(
    "/email",
    zValidator(
      "json",
      z.object({
        user: z.email({ message: "Email no válido" }),
        password: z.string().regex(/^[a-zA-Z\s]{16,19}$/, {
          message: "La contraseña de aplicación tiene 16 letras (Google la muestra en 4 grupos)",
        }),
      }),
      validationHook,
    ),
    async (c) => {
      const { user, password } = c.req.valid("json");
      await connectMailAccount(c.var.db, c.env, c.var.issuer.id, user, password);
      const issuer = await getIssuerByUserId(c.var.db, c.var.user.id);
      try {
        await sendMail(requireAccount(await mailAccountFor(c.env, issuer)), {
          to: issuer.smtpUser!,
          fromName: "Facturación",
          subject: "Cuenta conectada",
          body: "Tu cuenta de Gmail quedó conectada. Desde ahora puedes enviar facturas por email desde la app.",
        });
      } catch (e) {
        await disconnectMailAccount(c.var.db, c.var.issuer.id);
        throw e;
      }
      return c.json(present(issuer));
    },
  )

  .delete("/email", async (c) => {
    await disconnectMailAccount(c.var.db, c.var.issuer.id);
    return c.json(present(await getIssuerByUserId(c.var.db, c.var.user.id)));
  })

  // Logo y firma: se guardan en R2 y solo se sirven al usuario autenticado.
  .get("/files/:kind", async (c) => {
    const kind = c.req.param("kind");
    if (!isFileKind(kind)) return c.json({ error: "No encontrado" }, 404);
    const key = kind === "logo" ? c.var.issuer.logoKey : c.var.issuer.signatureKey;
    const object = key ? await c.env.FILES.get(key) : null;
    if (!object) return c.json({ error: "No encontrado" }, 404);
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
        "Cache-Control": "private, no-cache",
        ETag: object.httpEtag,
      },
    });
  })

  .put("/files/:kind", async (c) => {
    const kind = c.req.param("kind");
    if (!isFileKind(kind)) return c.json({ error: "No encontrado" }, 404);
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) return c.json({ error: "Falta el archivo" }, 400);
    if (!IMAGE_TYPES.includes(file.type)) return c.json({ error: "Formato no admitido (PNG o JPG)" }, 400);
    if (file.size > MAX_IMAGE_BYTES) return c.json({ error: "La imagen supera los 2 MB" }, 400);

    const key = `issuers/${c.var.issuer.id}/${kind}`;
    await c.env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    await setIssuerFile(c.var.db, c.var.issuer.id, kind, key);
    return c.json({ ok: true });
  })

  .delete("/files/:kind", async (c) => {
    const kind = c.req.param("kind");
    if (!isFileKind(kind)) return c.json({ error: "No encontrado" }, 404);
    await c.env.FILES.delete(`issuers/${c.var.issuer.id}/${kind}`);
    await setIssuerFile(c.var.db, c.var.issuer.id, kind, null);
    return c.json({ ok: true });
  });
