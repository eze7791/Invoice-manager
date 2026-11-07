// Validación de identificadores fiscales españoles: DNI, NIE y NIF de entidades (antes CIF).

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

export function normalizeNif(value: string): string {
  return value.toUpperCase().replace(/[\s.-]/g, "");
}

function isValidDni(nif: string): boolean {
  const m = /^(\d{8})([A-Z])$/.exec(nif);
  return !!m && DNI_LETTERS[Number(m[1]) % 23] === m[2];
}

function isValidNie(nif: string): boolean {
  const m = /^([XYZ])(\d{7})([A-Z])$/.exec(nif);
  if (!m) return false;
  const prefix = { X: "0", Y: "1", Z: "2" }[m[1] as "X" | "Y" | "Z"];
  return DNI_LETTERS[Number(prefix + m[2]) % 23] === m[3];
}

function isValidEntityNif(nif: string): boolean {
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(nif);
  if (!m) return false;
  const [, letter, digits, control] = m as unknown as [string, string, string, string];
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    let n = Number(digits[i]);
    if (i % 2 === 0) {
      n *= 2;
      n = Math.floor(n / 10) + (n % 10);
    }
    sum += n;
  }
  const check = (10 - (sum % 10)) % 10;
  const checkLetter = "JABCDEFGHI"[check];
  // Algunas entidades usan letra de control, otras dígito; el resto acepta ambos.
  if ("PQRSNW".includes(letter)) return control === checkLetter;
  if ("ABEH".includes(letter)) return control === String(check);
  return control === String(check) || control === checkLetter;
}

export type NifKind = "dni" | "nie" | "entidad";

/** Devuelve el tipo si el NIF es válido, o `null` si no lo es. */
export function nifKind(value: string): NifKind | null {
  const nif = normalizeNif(value);
  if (isValidDni(nif)) return "dni";
  if (isValidNie(nif)) return "nie";
  if (isValidEntityNif(nif)) return "entidad";
  return null;
}

export function isValidNif(value: string): boolean {
  return nifKind(value) !== null;
}
