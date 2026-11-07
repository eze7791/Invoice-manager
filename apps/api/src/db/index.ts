import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(connectionString: string) {
  // En Workers cada petición abre su propia conexión (Hyperdrive hace el pooling).
  const client = postgres(connectionString, { max: 5, fetch_types: false, prepare: false });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
export { schema };
