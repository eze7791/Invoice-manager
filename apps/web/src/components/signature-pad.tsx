import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** Lienzo para dibujar la firma con el dedo o el ratón. Devuelve un PNG transparente. */
export function SignaturePad({ onSave, onCancel }: { onSave: (png: Blob) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d")!;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setEmpty(false);
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
  };

  const save = () => canvasRef.current!.toBlob((blob) => blob && onSave(blob), "image/png");

  return (
    <div className="grid gap-3">
      <canvas
        ref={canvasRef}
        className="h-48 w-full touch-none rounded-lg border bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => (drawing.current = false)}
        onPointerLeave={() => (drawing.current = false)}
      />
      <p className="text-center text-xs text-muted-foreground">Firma dentro del recuadro</p>
      <div className="flex justify-between gap-2">
        <Button type="button" variant="ghost" onClick={clear} disabled={empty}>
          Borrar
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={empty}>
            Guardar firma
          </Button>
        </div>
      </div>
    </div>
  );
}
