// Cifrado simétrico (AES-GCM) para guardar secretos en la base, p. ej. la contraseña de Gmail.
// La clave se deriva de BETTER_AUTH_SECRET: si ese secreto cambia, hay que volver a introducirlos.

const encoder = new TextEncoder();
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key(secret: string) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(`smtp:${secret}`));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Devuelve `iv.ciphertext` en base64. */
export async function encrypt(plain: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(secret), encoder.encode(plain));
  return `${toB64(iv)}.${toB64(new Uint8Array(data))}`;
}

/** Devuelve null si no se puede descifrar (secreto cambiado o dato dañado). */
export async function decrypt(box: string, secret: string) {
  try {
    const [iv, data] = box.split(".");
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv!) }, await key(secret), fromB64(data!));
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
