import { FileText, Home, LogOut, User, Users } from "lucide-react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Inicio", icon: Home, end: true },
  { to: "/facturas", label: "Facturas", icon: FileText, end: false },
  { to: "/clientes", label: "Clientes", icon: Users, end: false },
  { to: "/perfil", label: "Perfil", icon: User, end: false },
];

/** Layout privado: barra superior en escritorio, barra inferior en móvil. */
export function AppLayout() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <div className="flex min-h-svh items-center justify-center text-muted-foreground">Cargando…</div>;
  }
  if (!session) return <Navigate to="/login" replace />;

  async function logout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-svh bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-10 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <span className="font-semibold">Facturación</span>
          <nav className="hidden gap-1 md:flex">
            {nav.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground",
                    isActive && "bg-muted font-medium text-foreground",
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={logout}>
            <LogOut /> <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-xs text-muted-foreground",
                isActive && "text-primary",
              )
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
