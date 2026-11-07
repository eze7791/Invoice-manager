import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { ClientForm, type ClientFormValues } from "@/components/client-form";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { clientName, initials, type Client } from "@/lib/types";

/** Selector de cliente con búsqueda y alta rápida. */
export function ClientPicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (client: Client) => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const q = useDeferredValue(search);

  const { data: clients } = useQuery({
    queryKey: ["clients", { q, archived: false }],
    queryFn: () => api.get<Client[]>(`/clients?${new URLSearchParams({ q, archived: "0" })}`),
    enabled: open,
    placeholderData: (prev) => prev,
  });

  const choose = (client: Client) => {
    onSelect(client);
    onOpenChange(false);
    setCreating(false);
    setSearch("");
  };

  const create = async (values: ClientFormValues) => {
    const client = await api.post<Client>("/clients", values);
    toast.success("Cliente creado");
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    choose(client);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setCreating(false);
      }}
      title={creating ? "Nuevo cliente" : "Elegir cliente"}
    >
      {creating ? (
        <ClientForm
          onSubmit={create}
          footer={
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Volver
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar cliente"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="button" variant="outline" onClick={() => setCreating(true)}>
            <Plus /> Nuevo cliente
          </Button>
          <ul className="max-h-[50svh] divide-y overflow-y-auto rounded-lg border">
            {clients?.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => choose(c)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {initials(clientName(c))}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{clientName(c)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.type === "empresa" ? "Empresa" : "Particular"}
                      {c.email ? ` · ${c.email}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {clients?.length === 0 && (
              <li className="p-4 text-center text-sm text-muted-foreground">No hay clientes que coincidan.</li>
            )}
          </ul>
        </div>
      )}
    </ResponsiveSheet>
  );
}
