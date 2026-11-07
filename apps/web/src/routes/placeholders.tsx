// Pantallas provisionales de la fase 1. Se reemplazan en las fases 2 y 3.
import { useSession } from "@/lib/auth-client";

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{text}</p>
    </section>
  );
}

export function InvoicesPage() {
  const { data } = useSession();
  return <Placeholder title="Facturas" text={`Hola, ${data?.user.name ?? ""}. Aquí verás tus facturas.`} />;
}
