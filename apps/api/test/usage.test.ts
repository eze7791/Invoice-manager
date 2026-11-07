import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "../src/services/errors";
import { consume, DAILY_LIMITS, meteredBucket } from "../src/services/usage";
import { fakeR2 } from "./fake-r2";
import { createIssuer, db } from "./helpers";

const isLimit = (e: unknown) => e instanceof DomainError && e.status === 429;

beforeEach(async () => {
  await db.execute(sql`delete from usage_counters`);
});

describe("topes diarios", () => {
  it("los emails tienen tope por cuenta", async () => {
    const a = await createIssuer("usage-a");
    const b = await createIssuer("usage-b");
    await consume(db, a, "email", DAILY_LIMITS.email); // justo en el tope: se permite
    await expect(consume(db, a, "email")).rejects.toSatisfy(isLimit);
    await expect(consume(db, b, "email")).resolves.toBeUndefined();
  });

  it("R2 tiene un solo tope para toda la app, compartido entre cuentas", async () => {
    const a = await createIssuer("usage-r2-a");
    const b = await createIssuer("usage-r2-b");
    const r2 = fakeR2();
    await meteredBucket(db, a, r2.bucket).put("k", new Uint8Array([1]));
    await consume(db, b, "r2_write", DAILY_LIMITS.r2_write - 1); // entre las dos, en el tope

    await expect(meteredBucket(db, a, r2.bucket).put("k2", new Uint8Array([2]))).rejects.toSatisfy(isLimit);
    expect(r2.store.has("k2")).toBe(false); // no llegó a escribirse
  });
});
