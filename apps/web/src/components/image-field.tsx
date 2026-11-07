import { ImageIcon, Trash2, Upload } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Vista previa de una imagen guardada (logo o firma) con botones para cambiarla o quitarla. */
export function ImageField({
  src,
  alt,
  busy,
  onFile,
  onRemove,
  extraActions,
}: {
  src: string | null;
  alt: string;
  busy?: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
  extraActions?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/40 sm:w-44">
        {src ? (
          <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
        ) : (
          <ImageIcon className="size-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          <Upload /> {src ? "Cambiar" : "Subir imagen"}
        </Button>
        {extraActions}
        {src && (
          <Button type="button" variant="ghost" className="text-destructive" disabled={busy} onClick={onRemove}>
            <Trash2 /> Quitar
          </Button>
        )}
      </div>
    </div>
  );
}
