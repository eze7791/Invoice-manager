import { describe, expect, it } from "vitest";
import { isValidNif, nifKind, normalizeNif } from "../src/lib/nif";

describe("NIF", () => {
  it("valida DNI con la letra correcta", () => {
    expect(nifKind("12345678Z")).toBe("dni");
    expect(isValidNif("12345678A")).toBe(false);
  });

  it("valida NIE", () => {
    expect(nifKind("X1234567L")).toBe("nie");
    expect(nifKind("Y1234567X")).toBe("nie");
    expect(isValidNif("X1234567A")).toBe(false);
  });

  it("valida NIF de entidades (antes CIF)", () => {
    expect(nifKind("B12345674")).toBe("entidad");
    expect(nifKind("Q2826000H")).toBe("entidad");
    expect(isValidNif("B12345678")).toBe(false);
  });

  it("acepta espacios, puntos, guiones y minúsculas", () => {
    expect(normalizeNif(" 12.345.678-z ")).toBe("12345678Z");
    expect(isValidNif("12.345.678-z")).toBe(true);
  });

  it("rechaza formatos inválidos", () => {
    expect(isValidNif("")).toBe(false);
    expect(isValidNif("1234")).toBe(false);
    expect(isValidNif("12.12.12")).toBe(false);
  });
});
