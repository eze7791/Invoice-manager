// Hash de contraseñas con PBKDF2-SHA256 vía Web Crypto.
// Se usa en lugar del scrypt por defecto de Better Auth porque scrypt en JS
// supera el límite de CPU del plan gratuito de Cloudflare Workers.
// Funciona igual en Workers y en Node (scripts).

const ITERATIONS = 100_000; // máximo que admite Workers
const KEY_LENGTH = 32;

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string) =>
  new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    KEY_LENGTH * 8,
  );
  return new Uint8Array(bits);
}

/** Devuelve `pbkdf2$<iteraciones>$<salt hex>$<hash hex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  const [scheme, iterations, saltHex, hashHex] = hash.split("$");
  if (scheme !== "pbkdf2" || !iterations || !saltHex || !hashHex) return false;
  const expected = fromHex(hashHex);
  const actual = await derive(password, fromHex(saltHex), Number(iterations));
  if (actual.length !== expected.length) return false;
  // Comparación en tiempo constante
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}
