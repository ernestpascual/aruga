"use client";

import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Pen, RotateCcw, Undo2 } from "lucide-react";

type StrokePoint = { x: number; y: number };
type Stroke = { color: string; width: number; points: StrokePoint[] };

export function ActivityCanvas({
  imageUrl,
  initialStrokes,
  onSave,
}: {
  imageUrl: string;
  initialStrokes?: Stroke[];
  onSave: (dataUrl: string, strokes: Stroke[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const strokesRef = useRef<Stroke[]>(initialStrokes ? [...initialStrokes] : []);
  const isDrawingRef = useRef(false);

  const [color, setColor] = useState("#111827");
  const [brushWidth, setBrushWidth] = useState(3);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [canSave, setCanSave] = useState(false);

  const COLORS = [
    "#111827", // black - for writing
    "#dc2626", // red
    "#ea580c", // orange
    "#eab308", // yellow
    "#16a34a", // green
    "#06b6d4", // cyan
    "#2563eb", // blue
    "#9333ea", // purple
    "#ec4899", // pink
    "#a16207", // brown
    "#f97316", // tangerine
    "#84cc16", // lime
  ];
  const COLOR_NAMES: Record<string,string> = {
    "#111827":"Black (write)", "#dc2626":"Red", "#ea580c":"Orange", "#eab308":"Yellow", "#16a34a":"Green", "#06b6d4":"Cyan",
    "#2563eb":"Blue", "#9333ea":"Purple", "#ec4899":"Pink", "#a16207":"Brown", "#f97316":"Tangerine", "#84cc16":"Lime",
  };

  function getCanvasPoint(e: React.PointerEvent | React.TouchEvent | MouseEvent | TouchEvent): StrokePoint | null {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      const t = (e as unknown as TouchEvent).touches[0] || (e as unknown as PointerEvent & { touches?: TouchList })?.touches?.[0];
      if (!t) return null;
      clientX = t.clientX; clientY = t.clientY;
    } else if ("clientX" in e) {
      clientX = (e as PointerEvent).clientX; clientY = (e as PointerEvent).clientY;
    } else return null;
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  }

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // bg
    if (bgImgRef.current && bgImgRef.current.complete && bgImgRef.current.naturalWidth) {
      ctx.drawImage(bgImgRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // strokes
    for (const stroke of strokesRef.current) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = stroke.color === "__eraser__" ? "destination-out" : "source-over";
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function setupImage() {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      bgImgRef.current = img;
      redraw();
    };
    img.onerror = () => { bgImgRef.current = null; redraw(); };
    img.src = imageUrl;
  }

  useEffect(() => { setupImage(); }, [imageUrl]);

  useEffect(() => {
    if (initialStrokes && initialStrokes.length) { strokesRef.current = [...initialStrokes]; redraw(); }
  }, [JSON.stringify(initialStrokes)]);

  // auto redraw loop on mount for initial load
  useEffect(() => { redraw(); }, []);

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const pt = getCanvasPoint(e as unknown as PointerEvent);
    if (!pt) return;
    isDrawingRef.current = true;
    const col = tool === "eraser" ? "__eraser__" : color;
    const w = tool === "eraser" ? Math.max(brushWidth * 6, 12) : brushWidth;
    strokesRef.current.push({ color: col, width: w, points: [pt] });
    setCanSave(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDrawingRef.current) return;
    const pt = getCanvasPoint(e as unknown as PointerEvent);
    if (!pt) return;
    const cur = strokesRef.current[strokesRef.current.length - 1];
    if (cur) cur.points.push(pt);
    redraw();
  }

  function handlePointerUp() {
    isDrawingRef.current = false;
  }

  function undo() {
    strokesRef.current.pop();
    redraw();
    setCanSave(strokesRef.current.length > 0);
  }

  function clearAll() {
    strokesRef.current = [];
    redraw();
    setCanSave(false);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // ensure bg baked then export
    const dataUrl = canvas.toDataURL("image/png");
    // map eraser sentinel back to white for storage preview? keep sentinel but export uses erasing so dataUrl is correct
    onSave(dataUrl, strokesRef.current.map(s => ({ ...s, color: s.color === "__eraser__" ? "#ffffff" : s.color })));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 p-1">
          <button
            type="button"
            onClick={() => setTool("pen")}
            className={`p-2 rounded-md flex items-center gap-1 text-xs font-medium ${tool === "pen" ? "bg-teal-600 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
          >
            <Pen className="w-4 h-4" /> Pen
          </button>
          <button
            type="button"
            onClick={() => setTool("eraser")}
            className={`p-2 rounded-md flex items-center gap-1 text-xs font-medium ${tool === "eraser" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
          >
            <Eraser className="w-4 h-4" /> Eraser
          </button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mr-1">Crayons:</span>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setColor(c); setTool("pen"); }}
              title={COLOR_NAMES[c] || c}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${color === c && tool === "pen" ? "border-teal-400 scale-110 shadow-md" : "border-zinc-600"} transition-all hover:scale-105`}
              style={{ background: c }}
              aria-label={`color ${c}`}
            >
              {color === c && tool === "pen" && <span className="w-2 h-2 rounded-full bg-white/90 shadow" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-500">Brush</span>
          <input type="range" min={1} max={12} value={brushWidth} onChange={(e) => setBrushWidth(parseInt(e.target.value))} className="w-20 accent-teal-500" />
          <span className="text-xs text-zinc-400 font-mono w-4">{brushWidth}px</span>
          <span className="text-[10px] text-zinc-500 hidden sm:inline">thin=write • thick=color</span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Button type="button" variant="ghost" size="sm" onClick={undo} className="h-8 gap-1 text-xs">
            <Undo2 className="w-3.5 h-3.5" /> Undo
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="h-8 gap-1 text-xs text-red-400">
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl border border-zinc-800 bg-white shadow-lg">
        <canvas
          ref={canvasRef}
          width={1024}
          height={1448}
          className="w-full h-auto touch-none select-none block bg-white"
          style={{ aspectRatio: "1024 / 1448" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {!imageUrl && (
          <div className="absolute inset-0 grid place-items-center bg-white/60 pointer-events-none text-xs text-zinc-500">
            Loading worksheet image...
          </div>
        )}
      </div>

      <div className="flex items-center justify-end">
        <Button type="button" onClick={save} disabled={strokesRef.current.length === 0 && !canSave} className="bg-teal-600 hover:bg-teal-500 text-white font-semibold">
          Save progress
        </Button>
      </div>
      <p className="text-[11px] text-zinc-500 text-center">
        Tip: Use a stylus on tablet for best results. Draw directly on the worksheet — it is saved to your home program submission.
      </p>
    </div>
  );
}
