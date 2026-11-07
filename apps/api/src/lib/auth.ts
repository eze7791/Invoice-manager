import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Db } from "../db";
import { schema } from "../db";
import { hashPassword, verifyPassword } from "./password";

export function createAuth(db: Db, env: { BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string }) {
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
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 días
      updateAge: 60 * 60 * 24,
    },
    rateLimit: { enabled: true, window: 60, max: 10 },
  });
}

export type Auth = ReturnType<typeof createAuth>;
