import type { Context } from "hono";

/** Respuesta 400 con errores por campo: `{ error, fields: { campo: mensaje } }`. */
export function validationHook(
  result: { success: true } | { success: false; error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> } },
  c: Context,
) {
  if (result.success) return;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.map(String).join(".");
    fields[path] ??= issue.message;
  }
  return c.json({ error: "Revisa los datos", fields }, 400);
}
