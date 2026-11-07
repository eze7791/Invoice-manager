import { and, asc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";
import type { ClientInput } from "../validation";

const { clients, invoices } = schema;

// Todas las funciones reciben el issuerId del usuario actual: un registro de otro emisor
// se comporta como si no existiera.
const owned = (issuerId: string, id: string) => and(eq(clients.id, id), eq(clients.issuerId, issuerId));

/** Nombre a mostrar: razón social o nombre y apellidos. */
export const displayName = sql<string>`coalesce(
  nullif(${clients.companyName}, ''),
  trim(concat_ws(' ', ${clients.firstName}, ${clients.lastName}))
)`;

export async function listClients(
  db: Db,
  issuerId: string,
  opts: { q?: string; archived?: boolean } = {},
) {
  const filters = [
    eq(clients.issuerId, issuerId),
    opts.archived ? isNotNull(clients.archivedAt) : isNull(clients.archivedAt),
  ];
  const q = opts.q?.trim();
  if (q) {
    const like = `%${q}%`;
    filters.push(
      or(
        ilike(clients.firstName, like),
        ilike(clients.lastName, like),
        ilike(clients.companyName, like),
        ilike(clients.nif, like),
        ilike(clients.email, like),
        ilike(clients.phone, like),
        ilike(displayName, like),
      )!,
    );
  }
  return db
    .select()
    .from(clients)
    .where(and(...filters))
    .orderBy(asc(sql`lower(${displayName})`));
}

export async function getClient(db: Db, issuerId: string, id: string) {
  const [client] = await db.select().from(clients).where(owned(issuerId, id));
  return client ?? null;
}

/** Al cambiar de tipo se limpian los campos que no aplican. */
function normalize(input: ClientInput) {
  return input.type === "empresa"
    ? { ...input, firstName: null, lastName: null }
    : { ...input, companyName: null };
}

export async function createClient(db: Db, issuerId: string, input: ClientInput) {
  const [client] = await db
    .insert(clients)
    .values({ ...normalize(input), issuerId })
    .returning();
  return client!;
}

export async function updateClient(db: Db, issuerId: string, id: string, input: ClientInput) {
  const [client] = await db.update(clients).set(normalize(input)).where(owned(issuerId, id)).returning();
  return client ?? null;
}

export async function setClientArchived(db: Db, issuerId: string, id: string, archived: boolean) {
  const [client] = await db
    .update(clients)
    .set({ archivedAt: archived ? new Date() : null })
    .where(owned(issuerId, id))
    .returning();
  return client ?? null;
}

export type DeleteResult = "deleted" | "not_found" | "has_invoices";

/** Solo se borra un cliente sin facturas; si tiene, hay que archivarlo. */
export async function deleteClient(db: Db, issuerId: string, id: string): Promise<DeleteResult> {
  const client = await getClient(db, issuerId, id);
  if (!client) return "not_found";
  const [used] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.clientId, id)).limit(1);
  if (used) return "has_invoices";
  await db.delete(clients).where(owned(issuerId, id));
  return "deleted";
}
