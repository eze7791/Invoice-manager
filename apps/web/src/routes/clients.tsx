import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Plus, Search, Trash2 } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { ClientForm, type ClientFormValues } from "@/components/client-form";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { clientName, initials, type Client } from "@/lib/types";
import { cn } from "@/lib/utils";

type Editing = { mode: "new" } | { mode: "edit"; client: Client } | null;

export function ClientsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const q = useDeferredValue(search);

  const { data: clients, isPending } = useQuery({
    queryKey: ["clients", { q, archived }],
    queryFn: () => api.get<Client[]>(`/clients?${new URLSearchParams({ q, archived: archived ? "1" : "0" })}`),
    placeholderData: (prev) => prev,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["clients"] });
  const close = () => setEditing(null);

  const save = async (values: ClientFormValues) => {
    if (editing?.mode === "edit") {
      await api.put(`/clients/${editing.client.id}`, values);
      toast.success("Cliente actualizado");
    } else {
      await api.post("/clients", values);
      toast.success("Cliente creado");
    }
    await refresh();
    close();
  };

  const archive = useMutation({
    mutationFn: (c: Client) => api.post(`/clients/${c.id}/${c.archivedAt ? "unarchive" : "archive"}`),
    onSuccess: (_, c) => {
      toast.success(c.archivedAt ? "Cliente recuperado" : "Cliente archivado");
      refresh();
      close();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (c: Client) => api.delete(`/clients/${c.id}`),
    onSuccess: () => {
      toast.success("Cliente eliminado");
      refresh();
      close();
    },
    onError: (e) => toast.error(e.message),
  });

  const current = editing?.mode === "edit" ? editing.client : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <Button className="hidden md:inline-flex" onClick={() => setEditing({ mode: "new" })}>
          <Plus /> Nuevo cliente
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nombre, NIF, email o teléfono"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant={archived ? "secondary" : "outline"}
          onClick={() => setArchived((v) => !v)}
          aria-pressed={archived}
          title="Ver archivados"
        >
          <Archive /> <span className="hidden sm:inline">Archivados</span>
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : clients?.length ? (
        <ul className="divide-y rounded-xl border">
          {clients.map((c) => {
            const name = clientName(c);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setEditing({ mode: "edit", client: c })}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {initials(name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{name}</span>
                      {c.type === "empresa" && <Badge variant="secondary">Empresa</Badge>}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[c.email, c.phone, c.nif].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          {search
            ? "No hay clientes que coincidan con la búsqueda."
            : archived
              ? "No hay clientes archivados."
              : "Todavía no tienes clientes. Crea el primero con el botón +."}
        </div>
      )}

      {/* Botón flotante en el móvil */}
      <Button
        size="icon"
        aria-label="Nuevo cliente"
        onClick={() => setEditing({ mode: "new" })}
        className={cn(
          "fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 size-14 rounded-full shadow-lg md:hidden",
        )}
      >
        <Plus className="size-6" />
      </Button>

      <ResponsiveSheet
        open={editing !== null}
        onOpenChange={(open) => !open && close()}
        title={editing?.mode === "edit" ? "Editar cliente" : "Nuevo cliente"}
      >
        {editing && (
          <ClientForm
            key={current?.id ?? "new"}
            client={current}
            onSubmit={save}
            footer={
              current && (
                <>
                  <Button type="button" variant="outline" onClick={() => archive.mutate(current)}>
                    {current.archivedAt ? <ArchiveRestore /> : <Archive />}
                    {current.archivedAt ? "Recuperar" : "Archivar"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="ghost" className="text-destructive">
                        <Trash2 /> Eliminar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar a {clientName(current)}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Si el cliente ya tiene facturas no se podrá eliminar;
                          en ese caso, archívalo.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={() => remove.mutate(current)}>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )
            }
          />
        )}
      </ResponsiveSheet>
    </div>
  );
}
