import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import { ApiError } from "./api";

/** Muestra los errores de la API en sus campos, o un aviso general. */
export function applyApiError<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>) {
  if (error instanceof ApiError && Object.keys(error.fields).length) {
    for (const [field, message] of Object.entries(error.fields)) {
      setError(field as Path<T>, { message });
    }
    toast.error(error.message);
    return;
  }
  toast.error(error instanceof Error ? error.message : "Error inesperado");
}
