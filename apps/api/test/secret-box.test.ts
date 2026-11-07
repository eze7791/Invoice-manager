import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../src/lib/secret-box";

describe("secret-box", () => {
  it("cifra y descifra con el mismo secreto", async () => {
    const box = await encrypt("abcd efgh ijkl mnop", "secreto");
    expect(box).not.toContain("abcd");
    expect(await decrypt(box, "secreto")).toBe("abcd efgh ijkl mnop");
  });

  it("devuelve null con otro secreto o datos dañados", async () => {
    const box = await encrypt("x", "secreto");
    expect(await decrypt(box, "otro")).toBeNull();
    expect(await decrypt("basura", "secreto")).toBeNull();
  });
});
