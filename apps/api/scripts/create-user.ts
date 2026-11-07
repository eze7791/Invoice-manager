// Crea (o actualiza la contraseña de) el usuario de la app y su perfil de emisor.
// Uso: npm run create-user -- <email> <nombre> <contraseña>
import { eq } from "drizzle-orm";
import { createDb, schema } from "../src/db";
import { hashPassword } from "../src/lib/password";

const [email, name, password] = process.argv.slice(2);

if (!email || !name || !password) {
  console.error('Uso: npm run create-user -- <email> "<nombre>" <contraseña>');
  process.exit(1);
}
// Contraseñas cortas (p. ej. "admin") solo se permiten contra la base local.
const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");
if (password.length < 10 && !isLocalDb) {
  console.error("La contraseña debe tener al menos 10 caracteres.");
  process.exit(1);
}

const db = createDb(process.env.DATABASE_URL!);
const normalizedEmail = email.trim().toLowerCase();
const hash = await hashPassword(password);

await db.transaction(async (tx) => {
  const existing = await tx.query.user.findFirst({ where: eq(schema.user.email, normalizedEmail) });

  if (existing) {
    await tx
      .update(schema.account)
      .set({ password: hash })
      .where(eq(schema.account.userId, existing.id));
    console.log(`Contraseña actualizada para ${normalizedEmail}.`);
    return;
  }

  const userId = crypto.randomUUID();
  await tx.insert(schema.user).values({ id: userId, name, email: normalizedEmail, emailVerified: true });
  await tx.insert(schema.account).values({
    id: crypto.randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: hash,
  });
  await tx.insert(schema.issuers).values({ userId, email: normalizedEmail });
  console.log(`Usuario ${normalizedEmail} creado.`);
});

process.exit(0);
