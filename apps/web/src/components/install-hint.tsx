import { Share, SquarePlus, X } from "lucide-react";
import { useState } from "react";

const KEY = "install-hint-dismissed";

function shouldShow() {
  try {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    return ios && !standalone && localStorage.getItem(KEY) !== "1";
  } catch {
    return false;
  }
}

/** En el iPhone (Safari) explica cómo añadir la app a la pantalla de inicio. */
export function InstallHint() {
  const [visible, setVisible] = useState(shouldShow);
  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // sin almacenamiento: solo se oculta en esta visita
    }
    setVisible(false);
  };

  return (
    <div className="relative rounded-xl border bg-primary/5 p-4 pr-10 text-sm">
      <button type="button" aria-label="Cerrar" onClick={dismiss} className="absolute top-3 right-3 text-muted-foreground">
        <X className="size-4" />
      </button>
      <p className="font-medium">Instala la app en tu iPhone</p>
      <p className="mt-1 text-muted-foreground">
        Toca <Share className="inline size-4 align-text-bottom" /> <strong>Compartir</strong> en Safari y luego{" "}
        <SquarePlus className="inline size-4 align-text-bottom" /> <strong>Añadir a pantalla de inicio</strong>. Se abrirá
        como una app, sin barra del navegador.
      </p>
    </div>
  );
}
