import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/password";

describe("password", () => {
  it("verifica la contraseña correcta", async () => {
    const hash = await hashPassword("una-contraseña-larga");
    expect(hash).toMatch(/^pbkdf2\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(await verifyPassword({ hash, password: "una-contraseña-larga" })).toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const hash = await hashPassword("una-contraseña-larga");
    expect(await verifyPassword({ hash, password: "otra-contraseña" })).toBe(false);
  });

  it("usa una sal distinta en cada hash", async () => {
    expect(await hashPassword("igual-igual-igual")).not.toBe(await hashPassword("igual-igual-igual"));
  });

  it("rechaza hashes con formato desconocido", async () => {
    expect(await verifyPassword({ hash: "scrypt$abc", password: "x" })).toBe(false);
  });
});
