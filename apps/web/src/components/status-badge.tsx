import { Badge } from "@/components/ui/badge";
import type { PaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const styles: Record<PaymentStatus, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-muted text-muted-foreground" },
  impagada: { label: "Impagada", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  vencida: { label: "Vencida", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  pagada: { label: "Pagada", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
};

export function StatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  const s = styles[status];
  return (
    <Badge variant="secondary" className={cn("border-0", s.className, className)}>
      {s.label}
    </Badge>
  );
}
