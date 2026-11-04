"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Download, Eraser, Loader2, Pencil, Play, Sparkles, Send, Trash2, Type, Undo2, Upload, Wand2 } from "lucide-react";
import { buildBiomechExport, downloadBiomechJson, biomechExportFilename, parseBiomechImport } from "@/lib/demo/biomech-payload";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ReplayViewer } from "@/components/demo/ReplayViewer";

const CLIPS = [
  { src: "/videos/tendon-gliding-example.mp4", label: "Tendon gliding example" },
] as const;

const FLOW = ["Create program", "Do program", "Submit", "Feedback", "Results & replay"] as const;

// ---- Writable worksheet: draw / write / type directly on the generated image ----
type WorksheetItem =
  | { kind: "stroke"; erase: boolean; color: string; width: number; points: Array<{ x: number; y: number }> }
  | { kind: "text"; text: string; x: number; y: number; color: string };

const PEN_COLORS = ["#18181b", "#0d9488", "#7c3aed", "#dc2626", "#d97706"] as const;

function WorksheetWriter({
  imageUrl,
  title,
  items,
  onItemsChange,
}: {
  imageUrl: string;
  title?: string;
  items: WorksheetItem[];
  onItemsChange: (items: WorksheetItem[]) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const drawingRef = React.useRef(false);
  const [tool, setTool] = useState<"pen" | "eraser" | "text">("pen");
  const [color, setColor] = useState<string>("#18181b");
  const [brush, setBrush] = useState(0.008);
  const [textValue, setTextValue] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    for (const item of items) {
      if (item.kind === "text") {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = item.color;
        ctx.font = `600 ${Math.max(14, w * 0.028)}px Inter, system-ui, sans-serif`;
        ctx.textBaseline = "top";
        ctx.fillText(item.text, item.x * w, item.y * h, w * 0.9);
      } else if (item.points.length) {
        ctx.globalCompositeOperation = item.erase ? "destination-out" : "source-over";
        ctx.strokeStyle = item.color;
        ctx.lineWidth = Math.max(1.5, item.width * w);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        item.points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x * w, pt.y * h);
          else ctx.lineTo(pt.x * w, pt.y * h);
        });
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }, [items]);

  // Size canvas to the displayed image and redraw (keeps writing aligned at any screen size)
  React.useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const sync = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      redraw();
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw, imageUrl]);

  function pointerPos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    const pos = pointerPos(e);
    if (tool === "text") {
      const text = textValue.trim();
      if (!text) return;
      onItemsChange([...items, { kind: "text", text, x: pos.x, y: pos.y, color }]);
      return;
    }
    drawingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onItemsChange([...items, { kind: "stroke", erase: tool === "eraser", color, width: brush, points: [pos] }]);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drawingRef.current || tool === "text") return;
    const pos = pointerPos(e);
    const next = [...items];
    const last = next[next.length - 1];
    if (last?.kind === "stroke") next[next.length - 1] = { ...last, points: [...last.points, pos] };
    onItemsChange(next);
  }

  function endStroke() {
    drawingRef.current = false;
  }

  async function handleDownload() {
    setExportError(null);
    try {
      const img = imgRef.current;
      if (!img) return;
      const out = document.createElement("canvas");
      out.width = img.naturalWidth || 1024;
      out.height = img.naturalHeight || 1024;
      const ctx = out.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(img, 0, 0, out.width, out.height);
      for (const item of items) {
        if (item.kind === "text") {
          ctx.fillStyle = item.color;
          ctx.font = `600 ${Math.max(14, out.width * 0.028)}px Inter, system-ui, sans-serif`;
          ctx.textBaseline = "top";
          ctx.fillText(item.text, item.x * out.width, item.y * out.height, out.width * 0.9);
        } else if (item.points.length) {
          ctx.globalCompositeOperation = item.erase ? "destination-out" : "source-over";
          ctx.strokeStyle = item.color;
          ctx.lineWidth = Math.max(1.5, item.width * out.width);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          item.points.forEach((pt, i) => {
            if (i === 0) ctx.moveTo(pt.x * out.width, pt.y * out.height);
            else ctx.lineTo(pt.x * out.width, pt.y * out.height);
          });
          ctx.stroke();
        }
      }
      const a = document.createElement("a");
      a.href = out.toDataURL("image/png");
      a.download = "worksheet-with-writing.png";
      a.click();
    } catch {
      setExportError("Could not export the image (the picture is hosted cross-origin). Your writing is still on screen — you can screenshot it, and it counts as completed when you submit.");
    }
  }

  const toolBtn = (active: boolean) =>
    `inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold border transition-colors ${active ? "bg-teal-600 border-teal-500 text-white" : "bg-zinc-950 border-zinc-700 text-zinc-300 hover:text-white"}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setTool("pen")} className={toolBtn(tool === "pen")}><Pencil className="w-3.5 h-3.5" /> Pen — write / draw</button>
        <button type="button" onClick={() => setTool("eraser")} className={toolBtn(tool === "eraser")}><Eraser className="w-3.5 h-3.5" /> Eraser</button>
        <button type="button" onClick={() => setTool("text")} className={toolBtn(tool === "text")}><Type className="w-3.5 h-3.5" /> Type text</button>
        <span className="flex items-center gap-1.5 ml-1">
          {PEN_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Pen colour ${c}`} onClick={() => { setColor(c); if (tool === "eraser") setTool("pen"); }} className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-white" : "border-zinc-700"}`} style={{ backgroundColor: c }} />
          ))}
        </span>
        <select value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="h-8 rounded-full border border-zinc-700 bg-zinc-950 px-2 text-[11px] text-zinc-200" aria-label="Pen thickness">
          <option value={0.004}>Thin</option>
          <option value={0.008}>Medium</option>
          <option value={0.015}>Thick</option>
        </select>
        <span className="flex items-center gap-1.5 ml-auto">
          <button type="button" onClick={() => onItemsChange(items.slice(0, -1))} disabled={!items.length} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-[11px] border border-zinc-700 text-zinc-300 disabled:opacity-40"><Undo2 className="w-3.5 h-3.5" /> Undo</button>
          <button type="button" onClick={() => onItemsChange([])} disabled={!items.length} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-[11px] border border-zinc-700 text-zinc-300 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /> Clear</button>
          <button type="button" onClick={handleDownload} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-[11px] font-semibold bg-zinc-800 border border-zinc-700 text-zinc-100"><Download className="w-3.5 h-3.5" /> Download</button>
        </span>
      </div>

      {tool === "text" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder="Type your answer, then click on the worksheet to place it" className="h-9 flex-1 min-w-[220px] text-xs bg-zinc-950 border-zinc-800" />
          <span className="text-[11px] text-zinc-500">Then click anywhere on the sheet to stamp the text there.</span>
        </div>
      )}
      {tool !== "text" && <p className="text-[11px] text-zinc-500">Write or draw directly on the worksheet with mouse, touch, or stylus.</p>}

      <div ref={wrapRef} className="relative w-full max-w-xl rounded-xl border border-zinc-700 bg-white overflow-hidden select-none">
        <img ref={imgRef} src={imageUrl} alt={title || "Generated worksheet — write on it"} className="block w-full h-auto" draggable={false} crossOrigin="anonymous" />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
        />
      </div>
      <p className="text-[11px] text-zinc-500">{items.length ? `${items.length} written mark${items.length === 1 ? "" : "s"} on this worksheet.` : "Nothing written yet."}</p>
      {exportError && <p className="text-xs text-amber-300">{exportError}</p>}
    </div>
  );
}

export default function DemoHomeProgramPage() {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("Tabletop Grasp & Release — Demo Program");
  const [step1Title, setStep1Title] = useState("Perform Tendon Gliding Exercises");
  const [step1Instructions, setStep1Instructions] = useState("Start with your hand open and fingers straight. Slowly bend your fingers into a hook position. Make a gentle fist. Straighten your fingers and relax. Repeat without forcing the movement. Repetitions: 5–10 times");
  const [worksheetTheme, setWorksheetTheme] = useState("Trace the cup path and color each successful lift. Keep wrist neutral.");
  const [ageBand, setAgeBand] = useState("adult");
  const [worksheet, setWorksheet] = useState<{ imageUrl: string | null; title?: string; instructions?: string } | null>(null);
  const [worksheetItems, setWorksheetItems] = useState<WorksheetItem[]>([]);
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [videoSrc, setVideoSrc] = useState<string>(CLIPS[0].src);
  const [clientComment, setClientComment] = useState("2/10 in the middle of the movement");
  const [worksheetDone, setWorksheetDone] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [feedback, setFeedback] = useState("Great control on the cup lifts — wrist stayed neutral and trunk lean was minimal. Keep the 3-second hold; next week we add a slightly heavier cup.");
  const [published, setPublished] = useState(false);

  const [biomech, setBiomech] = useState<any | null>(null);
  const [bioBusy, setBioBusy] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);
  const [biomechSource, setBiomechSource] = useState<string | null>(null);
  const biomechFileRef = React.useRef<HTMLInputElement>(null);
  const seededTriedRef = React.useRef(false);

  // Seeded analyses sometimes carry SAM boxes in pixel space ([ymin,xmin,ymax,xmax]
  // at the source video size); the overlay needs normalized 0-1. Normalize only
  // when values clearly exceed 1, using the source frame size.
  function normalizeReplayBoxesIfPixels(boxes: any[], w = 1280, h = 720) {
    if (!Array.isArray(boxes) || boxes.length === 0) return boxes;
    const looksPixels = boxes.some(
      (b) => Array.isArray(b?.box) && b.box.some((v: unknown) => typeof v === "number" && v > 1.5)
    );
    if (!looksPixels) return boxes;
    return boxes.map((b) =>
      Array.isArray(b?.box) && b.box.length === 4
        ? { ...b, box: [b.box[0] / h, b.box[1] / w, b.box[2] / h, b.box[3] / w] }
        : b
    );
  }

  // Apply a loaded analysis: replay payload + matching activity context (title,
  // instructions, comment, age band) so the seeded result matches the video.
  // The full activity context rides on result.activity for replay exports.
  function applyLoadedAnalysis(data: unknown, sourceLabel: string) {
    const parsed = parseBiomechImport(data);
    const result = { ...(parsed.result as Record<string, unknown>) };
    const sam = (result.sam || {}) as Record<string, any>;
    if (Array.isArray(sam.boxes)) result.sam = { ...sam, boxes: normalizeReplayBoxesIfPixels(sam.boxes) };
    setBiomech(result);
    const ra = (result.activity || {}) as Record<string, any>;
    const title = (typeof ra.title === "string" && ra.title) || parsed.activity?.title;
    const instructions = (typeof ra.instructions === "string" && ra.instructions) || parsed.activity?.instructions;
    const need = typeof ra.therapistNeed === "string" ? ra.therapistNeed : "";
    if (title) setStep1Title(title);
    if (instructions) setStep1Instructions(instructions);
    if (need) setClientComment(need.replace(/^Client comment:\s*/i, ""));
    const band = (typeof ra.ageBand === "string" && ra.ageBand) || parsed.activity?.ageBand;
    if (band) setAgeBand(band);
    setBioError(null);
    setBiomechSource(sourceLabel);
  }

  // Seeded demo analysis: public/demo/analysis/latest.json (the tendon-gliding
  // analysis for /videos/tendon-gliding-example.mp4) replays with no live run,
  // no key, no Modal.
  React.useEffect(() => {
    if (step !== 4 || biomech || seededTriedRef.current) return;
    seededTriedRef.current = true;
    fetch("/demo/analysis/latest.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no seed"))))
      .then((data) => {
        applyLoadedAnalysis(data, "Seeded tendon-gliding analysis from /demo/analysis/latest.json — segmentation and insights replay with no live run.");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, biomech]);

  function handleDownloadBiomech() {
    if (!biomech) return;
    downloadBiomechJson(
      buildBiomechExport({
        result: biomech,
        activity: { title: step1Title, instructions: step1Instructions, therapistNeed: clientComment, ageBand },
      }),
      biomechExportFilename("demo")
    );
  }

  async function handleLoadBiomechFile(file: File) {
    try {
      applyLoadedAnalysis(JSON.parse(await file.text()), `Loaded from ${file.name} — no re-run. Save a copy as public/demo/analysis/latest.json to make it this demo's default.`);
    } catch (e) {
      setBioError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleGenerateWorksheet() {
    setGenBusy(true);
    setGenError(null);
    try {
      const res = await fetch("/api/activities/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ageBand, theme: worksheetTheme, titleOverride: "Cup Lift Worksheet", generateImage: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed — check MODEL_API_KEY / AI_MODE=live, or continue without an image.");
      setWorksheet({ imageUrl: data.activity?.base_image_url || null, title: data.activity?.title, instructions: data.activity?.instructions });
      setWorksheetItems([]);
      setWorksheetDone(false);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-10">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/login" className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100"><ArrowLeft className="w-3.5 h-3.5" /> Login</Link>
            <span className="hidden sm:block h-5 w-px bg-zinc-800" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight flex items-center gap-2">Guided Home Program Demo <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-950 border border-teal-500/30 text-teal-300">No login needed</span></h1>
              <p className="hidden sm:block text-[11px] text-zinc-500 mt-0.5">Create → do → submit → feedback → replay. Live Meta AI where a key is present; preloaded clips so it never dead-ends.</p>
            </div>
          </div>
          <Link href="/demo/insights" className="text-xs text-violet-300 hover:text-violet-200 shrink-0">Insights playground →</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {FLOW.map((s, i) => (
            <React.Fragment key={s}>
              <button type="button" onClick={() => setStep(i)} className={`px-2.5 py-1 rounded-full text-[11px] font-mono border transition-colors ${step === i ? "bg-teal-950 border-teal-500/40 text-teal-300 font-bold" : i < step ? "bg-emerald-950/40 border-emerald-800 text-emerald-300" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
                {i + 1} {s}{i < step ? " ✓" : ""}
              </button>
              {i < FLOW.length - 1 && <span className="text-zinc-700 text-[11px]">→</span>}
            </React.Fragment>
          ))}
        </div>

        {step === 0 && (
          <Card className="p-5 border-zinc-800 bg-zinc-900/70 space-y-4">
            <h2 className="text-sm font-bold text-zinc-100">1 — Create home program</h2>
            <div className="space-y-3">
              <div><label className="text-xs font-semibold text-zinc-300">Program title</label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 text-xs bg-zinc-950 border-zinc-800" /></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-zinc-300">Step 1 — video step title</label><Input value={step1Title} onChange={(e) => setStep1Title(e.target.value)} className="mt-1 text-xs bg-zinc-950 border-zinc-800" /></div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300">Client age band</label>
                  <select value={ageBand} onChange={(e) => setAgeBand(e.target.value)} className="mt-1 w-full h-9 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100">
                    <option value="pedia">Pedia (1–11)</option><option value="adolescent">Adolescent (12–17)</option><option value="adult">Adult (18–54)</option><option value="geriatric">Geriatric (55+)</option>
                  </select>
                </div>
              </div>
              <div><label className="text-xs font-semibold text-zinc-300">Step 1 — instructions given to client</label><Textarea value={step1Instructions} onChange={(e) => setStep1Instructions(e.target.value)} rows={3} className="mt-1 text-xs bg-zinc-950 border-zinc-800 resize-none" /></div>
              <div><label className="text-xs font-semibold text-zinc-300">Step 2 — worksheet brief</label><Textarea value={worksheetTheme} onChange={(e) => setWorksheetTheme(e.target.value)} rows={2} className="mt-1 text-xs bg-zinc-950 border-zinc-800 resize-none" /></div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleGenerateWorksheet} disabled={genBusy} className="h-9 gap-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold">
                  {genBusy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</> : <><Wand2 className="w-3.5 h-3.5" /> Generate worksheet with Meta AI</>}
                </Button>
                <span className="text-[11px] text-zinc-500">Spark writes it, Muse Image draws it. No key? Skip — the flow continues.</span>
              </div>
              {genError && <p className="text-xs text-amber-300">{genError}</p>}
              {worksheet?.imageUrl ? (
                <div className="space-y-1.5">
                  <img src={worksheet.imageUrl} alt={worksheet.title || "Generated worksheet"} className="w-full max-w-md rounded-lg border border-zinc-700 bg-white" />
                  <p className="text-[11px] text-zinc-500">Your client will be able to write on this sheet in the next step (Do program).</p>
                </div>
              ) : worksheet ? (
                <p className="text-xs text-zinc-400">Spec generated ({worksheet.title || "worksheet"}) — image unavailable, instructions will carry the step.</p>
              ) : null}
            </div>
            <Button onClick={() => setStep(1)} className="h-10 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold">Continue to do program →</Button>
          </Card>
        )}

        {step === 1 && (
          <Card className="p-5 border-zinc-800 bg-zinc-900/70 space-y-4">
            <h2 className="text-sm font-bold text-zinc-100">2 — Do home program <span className="text-zinc-500 font-normal">({title})</span></h2>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-300">Step 1 · {step1Title}</p>
              <p className="text-xs text-zinc-400 leading-relaxed">{step1Instructions}</p>
              <div className="flex flex-wrap gap-1.5">
                {CLIPS.map((c) => (
                  <button key={c.src} type="button" onClick={() => setVideoSrc(c.src)} className={`px-2.5 py-1 rounded-full text-[11px] font-mono border ${videoSrc === c.src ? "bg-teal-950 border-teal-500/40 text-teal-300 font-bold" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>{c.label}</button>
                ))}
              </div>
              <video src={videoSrc} controls playsInline className="w-full max-w-lg rounded-xl border border-zinc-800 bg-black" />
              <div><label className="text-xs font-semibold text-zinc-300">How it felt (client comment)</label><Textarea value={clientComment} onChange={(e) => setClientComment(e.target.value)} rows={2} className="mt-1 text-xs bg-zinc-950 border-zinc-800 resize-none" /></div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
              <p className="text-xs font-semibold text-zinc-300">Step 2 · Worksheet — write on it</p>
              {worksheet?.imageUrl ? (
                <WorksheetWriter
                  imageUrl={worksheet.imageUrl}
                  title={worksheet.title}
                  items={worksheetItems}
                  onItemsChange={(items) => { setWorksheetItems(items); if (items.length) setWorksheetDone(true); }}
                />
              ) : <p className="text-xs text-zinc-500">No generated sheet — go back to Step 1 to generate one with Meta AI, then you can write on it here. Or just mark it done below.</p>}
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer"><input type="checkbox" checked={worksheetDone} onChange={(e) => setWorksheetDone(e.target.checked)} className="accent-teal-500" /> Worksheet completed{worksheetItems.length ? ` (${worksheetItems.length} written mark${worksheetItems.length === 1 ? "" : "s"})` : ""}</label>
            </div>
            <Button onClick={() => setStep(2)} className="h-10 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold">Continue to submit →</Button>
          </Card>
        )}

        {step === 2 && (
          <Card className="p-5 border-zinc-800 bg-zinc-900/70 space-y-4 text-center">
            <Send className="w-8 h-8 text-teal-400 mx-auto" />
            <h2 className="text-sm font-bold text-zinc-100">3 — Submit home program</h2>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">Video clip, comment, and worksheet status are bundled as one submission for the therapist. In this demo nothing leaves your browser except the Meta calls you trigger.</p>
            <div className="text-left max-w-md mx-auto rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-1 text-xs text-zinc-400">
              <p>· Clip: <span className="text-zinc-200 font-mono">{videoSrc.split("/").pop()}</span></p>
              <p>· Comment: “{clientComment.slice(0, 90)}”</p>
              <p>· Worksheet: {worksheetDone ? `completed${worksheetItems.length ? ` — ${worksheetItems.length} written mark${worksheetItems.length === 1 ? "" : "s"} on the sheet` : ""}` : "not marked done"}</p>
            </div>
            <Button
              onClick={() => { setSubmitted(true); setStep(3); }}
              className="h-10 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
            >
              {submitted ? "Submitted ✓ — continue" : "Submit to therapist"}
            </Button>
          </Card>
        )}

        {step === 3 && (
          <Card className="p-5 border-zinc-800 bg-zinc-900/70 space-y-4">
            <h2 className="text-sm font-bold text-zinc-100">4 — Therapist feedback</h2>
            <p className="text-xs text-zinc-400">Sample published feedback for this submission. Edit it, then publish to see it on the replay screen.</p>
            <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} className="text-xs bg-zinc-950 border-zinc-800" />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setPublished(true); setStep(4); }} className="h-10 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Publish feedback & view results
              </Button>
              <Button variant="outline" onClick={() => setStep(4)} className="h-10 text-xs">Skip to results</Button>
            </div>
            {published && <p className="text-xs text-emerald-300">Published — visible on the replay screen below.</p>}
          </Card>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-zinc-100">5 — Results & replay</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">The latest seeded analysis loads automatically — no live run. Segmentation, 3D, and insights replay as saved. To refresh it, load a downloaded analysis JSON, or replace <span className="font-mono">public/demo/analysis/latest.json</span>.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <input ref={biomechFileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLoadBiomechFile(f); e.target.value = ""; }} />
                <Button onClick={() => biomechFileRef.current?.click()} variant="outline" className="h-9 gap-2 text-xs border-zinc-600">
                  <Upload className="w-3.5 h-3.5" /> Load analysis JSON
                </Button>
                <Button onClick={handleDownloadBiomech} disabled={!biomech} variant="outline" className="h-9 gap-2 text-xs border-teal-700 text-teal-300 disabled:opacity-40" title="Download everything (segmentation + 3D + insights) as one JSON you can load again or seed this demo with">
                  <Download className="w-3.5 h-3.5" /> Download JSON
                </Button>
                {biomechSource && <span className="text-[11px] text-zinc-500 self-center">{biomechSource}</span>}
              </div>
            </Card>
            {bioError && <Card className="p-3 border-amber-800/40 bg-amber-950/20 text-xs text-amber-200">{bioError} — feedback still replays below; biomech needs MODEL_API_KEY + MODAL_MHR_URL.</Card>}
            <ReplayViewer videoUrl={videoSrc} result={biomech} feedback={published ? { overall: feedback } : null} hideSkeleton />
            <div className="flex flex-wrap gap-2">
              <Link href="/demo/insights"><Button variant="outline" className="h-9 text-xs gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Try Goal + Highlights agents</Button></Link>
              <Button variant="outline" onClick={() => setStep(0)} className="h-9 text-xs">Restart flow</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
