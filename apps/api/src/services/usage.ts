// Topes diarios de uso. Son altos a propósito: no molestan en el uso normal, pero si alguien
// abusa de una sesión robada o hay un fallo, la app se bloquea antes de generar costes.
// R2 se mide para toda la app (un solo tope compartido); los emails, por cuenta de Gmail.
import { sql } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";
import { DomainError } from "./errors";
import { todayInSpain } from "./invoices";

export const DAILY_LIMITS = {
  r2_write: 30_000, // ×30 días = 900 000; gratis en R2: 1 000 000 al mes
  r2_read: 300_000, // ×30 días = 9 000 000; gratis en R2: 10 000 000 al mes
  email: 400, // por cuenta; Gmail permite unos 500 al día
} as const;

export type UsageKind = keyof typeof DAILY_LIMITS;

const GLOBAL: Record<UsageKind, boolean> = { r2_write: true, r2_read: true, email: false };

const messages: Record<UsageKind, string> = {
  r2_write: "Se alcanzó el límite diario de archivos guardados. Vuelve a intentarlo mañana.",
  r2_read: "Se alcanzó el límite diario de descargas. Vuelve a intentarlo mañana.",
  email: "Se alcanzó el límite diario de emails enviados. Vuelve a intentarlo mañana.",
};

/** Suma `amount` al contador del día y falla si se supera el tope. */
export async function consume(db: Db, issuerId: string, kind: UsageKind, amount = 1) {
  const { usageCounters: u } = schema;
  const scope = GLOBAL[kind] ? "global" : issuerId;
  const [row] = await db
    .insert(u)
    .values({ scope, day: todayInSpain(), kind, count: amount })
    .onConflictDoUpdate({ target: [u.scope, u.day, u.kind], set: { count: sql`${u.count} + ${amount}` } })
    .returning({ count: u.count });
  if (row!.count > DAILY_LIMITS[kind]) {
    console.warn(`Tope diario alcanzado: ${kind} (${row!.count}) en ${scope}`);
    throw new DomainError(messages[kind], 429);
  }
}

/** R2 que cuenta cada lectura y escritura antes de hacerla. */
export function meteredBucket(db: Db, issuerId: string, bucket: R2Bucket): R2Bucket {
  return {
    get: async (key: string) => {
      await consume(db, issuerId, "r2_read");
      return bucket.get(key);
    },
    put: async (key: string, value: Parameters<R2Bucket["put"]>[1], options?: R2PutOptions) => {
      await consume(db, issuerId, "r2_write");
      return bucket.put(key, value, options);
    },
    delete: async (keys: string | string[]) => {
      await consume(db, issuerId, "r2_write");
      return bucket.delete(keys);
    },
  } as unknown as R2Bucket;
}
