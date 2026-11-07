import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { mailAccountFor, sendMail, type MailEnv } from "../services/email";
import { schema } from "../db";
import { hashPassword, verifyPassword } from "./password";

export function createAuth(db: Db, env: MailEnv & { BETTER_AUTH_URL: string }) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // Sin registro público: la cuenta se crea con `npm run create-user`.
      disableSignUp: true,
      minPasswordLength: 10,
      password: { hash: hashPassword, verify: verifyPassword },
      revokeSessionsOnPasswordReset: true,
      // Recuperación: el enlace se envía con la cuenta de Gmail conectada en el perfil.
      // Si no hay ninguna, no se envía nada y la contraseña se restablece con `create-user`.
      sendResetPassword: async ({ user, url }) => {
        const [issuer] = await db.select().from(schema.issuers).where(eq(schema.issuers.userId, user.id));
        const account = issuer ? await mailAccountFor(env, issuer) : null;
        if (!account) {
          console.warn(`Sin cuenta de email para enviar el restablecimiento a ${user.email}`);
          return;
        }
        await sendMail(account, {
          to: user.email,
          fromName: "Facturación",
          subject: "Restablecer tu contraseña",
          body: `Hola ${user.name}:\n\nPara elegir una contraseña nueva, abre este enlace (caduca en 1 hora):\n${url}\n\nSi no lo pediste tú, ignora este mensaje.`,
        });
      },
    },
    session: {
      // Se cierra tras 60 minutos sin actividad. Mientras se usa, se renueva cada 5 minutos.
      expiresIn: 60 * 60,
      updateAge: 5 * 60,
    },
    rateLimit: { enabled: true, window: 60, max: 10 },
  });
}

export type Auth = ReturnType<typeof createAuth>;
