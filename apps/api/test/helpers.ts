import { createDb, schema } from "../src/db";
import { TEST_DATABASE_URL } from "./global-setup";

export const db = createDb(TEST_DATABASE_URL);

/** Crea un usuario con su emisor y devuelve el id del emisor. */
export async function createIssuer(label: string) {
  const userId = crypto.randomUUID();
  await db.insert(schema.user).values({ id: userId, name: label, email: `${label}-${userId}@test.local` });
  const [issuer] = await db.insert(schema.issuers).values({ userId }).returning();
  return issuer!.id;
}
