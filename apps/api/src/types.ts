import type { Db, schema } from "./db";
import type { Auth } from "./lib/auth";

export type Bindings = {
  HYPERDRIVE: Hyperdrive;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GMAIL_USER?: string;
  GMAIL_APP_PASSWORD?: string;
};

type SessionResult = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

export type Variables = {
  db: Db;
  auth: Auth;
  user: SessionResult["user"];
  session: SessionResult["session"];
  issuer: typeof schema.issuers.$inferSelect;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
