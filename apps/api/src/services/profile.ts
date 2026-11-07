import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";
import type { ProfileInput } from "../validation";

export async function getIssuerByUserId(db: Db, userId: string) {
  const issuer = await db.query.issuers.findFirst({ where: eq(schema.issuers.userId, userId) });
  if (issuer) return issuer;
  // Por si el usuario se creó sin perfil.
  const [created] = await db.insert(schema.issuers).values({ userId }).returning();
  return created!;
}

export async function updateProfile(db: Db, issuerId: string, input: ProfileInput) {
  const [updated] = await db
    .update(schema.issuers)
    .set(input)
    .where(eq(schema.issuers.id, issuerId))
    .returning();
  return updated!;
}

export type FileKind = "logo" | "signature";

const fileColumn = { logo: "logoKey", signature: "signatureKey" } as const;

export async function setIssuerFile(db: Db, issuerId: string, kind: FileKind, key: string | null) {
  await db
    .update(schema.issuers)
    .set({ [fileColumn[kind]]: key })
    .where(eq(schema.issuers.id, issuerId));
}
