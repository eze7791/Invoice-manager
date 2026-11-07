import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Etiqueta + control + mensaje de error o ayuda. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-xl border bg-card p-4 sm:p-6">
      <div>
        <h2 className="font-medium">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
