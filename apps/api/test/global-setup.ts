// Crea (si hace falta) la base de pruebas y le aplica las migraciones.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://facturacion:facturacion@localhost:5432/facturacion_test";

export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const admin = postgres({ ...parse(url), database: "postgres", onnotice: () => {} });
  const [exists] = await admin`select 1 from pg_database where datname = ${dbName}`;
  if (!exists) await admin.unsafe(`create database "${dbName}"`);
  await admin.end();

  const client = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
}

function parse(url: URL) {
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}
