import { beforeAll, describe, expect, it } from "vitest";
import { schema } from "../src/db";
import {
  createClient,
  deleteClient,
  getClient,
  listClients,
  setClientArchived,
  updateClient,
} from "../src/services/clients";
import { clientSchema } from "../src/validation";
import { createIssuer, db } from "./helpers";

const particular = (firstName: string, extra: Record<string, unknown> = {}) =>
  clientSchema.parse({ type: "particular", firstName, lastName: "Pérez", ...extra });

let mine: string;
let other: string;

beforeAll(async () => {
  mine = await createIssuer("mine");
  other = await createIssuer("other");
});

describe("aislamiento entre emisores", () => {
  it("un emisor no ve, edita, archiva ni borra clientes de otro", async () => {
    const foreign = await createClient(db, other, particular("Ajeno"));

    expect(await getClient(db, mine, foreign.id)).toBeNull();
    expect(await updateClient(db, mine, foreign.id, particular("Hackeado"))).toBeNull();
    expect(await setClientArchived(db, mine, foreign.id, true)).toBeNull();
    expect(await deleteClient(db, mine, foreign.id)).toBe("not_found");
    expect((await listClients(db, mine)).map((c) => c.id)).not.toContain(foreign.id);

    // El cliente ajeno sigue intacto
    const intact = await getClient(db, other, foreign.id);
    expect(intact?.firstName).toBe("Ajeno");
    expect(intact?.archivedAt).toBeNull();
  });
});

describe("clientes", () => {
  it("busca por nombre, NIF o email sin distinguir mayúsculas", async () => {
    const issuer = await createIssuer("search");
    await createClient(db, issuer, particular("Lucía", { nif: "12345678Z" }));
    await createClient(db, issuer, particular("Marcos", { email: "marcos@correo.es" }));
    await createClient(db, issuer, clientSchema.parse({ type: "empresa", companyName: "Clínica Sol SL" }));

    expect((await listClients(db, issuer, { q: "lucía" })).map((c) => c.firstName)).toEqual(["Lucía"]);
    expect((await listClients(db, issuer, { q: "12345678" })).map((c) => c.firstName)).toEqual(["Lucía"]);
    expect((await listClients(db, issuer, { q: "CORREO" })).map((c) => c.firstName)).toEqual(["Marcos"]);
    expect((await listClients(db, issuer, { q: "clínica" })).map((c) => c.companyName)).toEqual(["Clínica Sol SL"]);
    expect(await listClients(db, issuer)).toHaveLength(3);
  });

  it("los archivados salen de la lista normal y aparecen en la de archivados", async () => {
    const issuer = await createIssuer("archive");
    const client = await createClient(db, issuer, particular("Ana"));
    await setClientArchived(db, issuer, client.id, true);

    expect(await listClients(db, issuer)).toHaveLength(0);
    expect(await listClients(db, issuer, { archived: true })).toHaveLength(1);

    await setClientArchived(db, issuer, client.id, false);
    expect(await listClients(db, issuer)).toHaveLength(1);
  });

  it("no borra un cliente con facturas", async () => {
    const issuer = await createIssuer("delete");
    const used = await createClient(db, issuer, particular("Con factura"));
    const unused = await createClient(db, issuer, particular("Sin factura"));
    await db.insert(schema.invoices).values({ issuerId: issuer, clientId: used.id });

    expect(await deleteClient(db, issuer, used.id)).toBe("has_invoices");
    expect(await deleteClient(db, issuer, unused.id)).toBe("deleted");
    expect(await getClient(db, issuer, unused.id)).toBeNull();
  });

  it("al pasar a empresa se limpian nombre y apellidos", async () => {
    const issuer = await createIssuer("type");
    const client = await createClient(db, issuer, particular("Juan"));
    const updated = await updateClient(
      db,
      issuer,
      client.id,
      clientSchema.parse({ type: "empresa", companyName: "Juan SL", firstName: "Juan" }),
    );
    expect(updated).toMatchObject({ type: "empresa", companyName: "Juan SL", firstName: null, lastName: null });
  });
});

describe("validación de clientes", () => {
  it("exige nombre a particulares y razón social a empresas", () => {
    expect(clientSchema.safeParse({ type: "particular" }).success).toBe(false);
    expect(clientSchema.safeParse({ type: "empresa", firstName: "x" }).success).toBe(false);
  });

  it("normaliza NIF y email, y rechaza NIF inválido", () => {
    const parsed = particular("Eva", { nif: "12.345.678-z", email: "EVA@Correo.ES", phone: "" });
    expect(parsed).toMatchObject({ nif: "12345678Z", email: "eva@correo.es", phone: null });
    expect(clientSchema.safeParse({ type: "particular", firstName: "x", nif: "12.12.12" }).success).toBe(false);
  });
});
