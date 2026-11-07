import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";
import type { SavedServiceInput } from "../validation";

const { services } = schema;

/** Servicios guardados para reutilizar al añadir conceptos a una factura. */
export function listServices(db: Db, issuerId: string) {
  return db
    .select()
    .from(services)
    .where(and(eq(services.issuerId, issuerId), isNull(services.archivedAt)))
    .orderBy(asc(services.name));
}

export async function createService(db: Db, issuerId: string, input: SavedServiceInput) {
  const [service] = await db
    .insert(services)
    .values({ issuerId, name: input.name, description: input.description, unitPrice: input.unitPrice.toFixed(2) })
    .returning();
  return service!;
}

/** Se archiva en vez de borrar: las facturas guardan su propia copia del concepto. */
export async function archiveService(db: Db, issuerId: string, id: string) {
  const [service] = await db
    .update(services)
    .set({ archivedAt: new Date() })
    .where(and(eq(services.id, id), eq(services.issuerId, issuerId)))
    .returning();
  return service ?? null;
}
