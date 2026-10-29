"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { Upload, Play, Loader2, AlertTriangle, UploadCloud, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/supabase/auth-context";

interface SamBoxOut {
  frameIndex: number;
  timestampSeconds: number;
  box: [number, number, number, number];
  label: string;
  objectId?: string;
  confidence?: number;
}

interface SamPathOut {
  frameIndex: number;
  path: string;
  label?: string;
  objectId?: string;
}

interface SamResultOut {
  objectConcepts: string[];
  tracks: Array<{ trackId: string; label: string; objectId?: string; frames: number[] }>;
  boxes: SamBoxOut[];
  svgPaths?: SamPathOut[];
  failures: Array<{ concept: string; code: string; message: string }>;
  billedRequests: number;
  modelId: string;
  latencyMs: number;
  mode?: string;
}

const PALETTE = ["#2dd4bf", "#f472b6", "#facc15", "#60a5fa", "#a78bfa", "#fb923c"];

interface MaskStyle {
  color: string;
  fillOpacity: number; // 0-1
  strokeWidth: number; // px for boxes, scaled for mask paths
  visible: boolean;
}

const DEFAULT_MASK_STYLE: Omit<MaskStyle, "color"> = {
  fillOpacity: 0.35,
  strokeWidth: 2,
  visible: true,
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

export default function SamTestPage() {
  const [prompt, setPrompt] = useState("");
  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoDataUrl, setVideoDataUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>(undefined);
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);
  const [maskStyles, setMaskStyles] = useState<Record<string, MaskStyle>>({});
  const [isReading, setIsReading] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SamResultOut | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragCounter = useRef(0);

  async function handleVideo(file: File | null) {
    if (!file) return;
    setError(null);
    setResult(null);
    if (!file.type.startsWith("video/")) {
      setError("Please choose a video file.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError("Video is over 100 MB. Use a shorter clip.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setIsReading(true);
    try {
      setVideoDataUrl(await fileToDataUrl(file));
    } catch {
      setError("Could not read that video.");
      setVideoDataUrl(null);
    } finally {
      setIsReading(false);
    }
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      dragCounter.current += 1;
      setIsDragging(true);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDragging(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (isTracking || isReading) return;
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) await handleVideo(file);
  }

  const { user } = useAuth();
  const [savedToDb, setSavedToDb] = useState(false);

  async function handleTrack() {
    if (!videoDataUrl || !prompt.trim() || isTracking || isReading) return;
    setError(null);
    setIsTracking(true);
    setResult(null);
    setSavedToDb(false);
    try {
      const res = await fetch("/api/sam-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptText: prompt,
          videoDataUrl,
          durationSeconds,
          mediaWidth: videoSize?.width,
          mediaHeight: videoSize?.height,
          fileName: fileName || "clip.mp4",
          userId: user?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tracking failed.");
      setResult(data as SamResultOut);
      if (user?.id) {
        setSavedToDb(true);
      }
      videoRef.current?.play().catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tracking failed.");
    } finally {
      setIsTracking(false);
    }
  }

  function colorFor(label: string) {
    const idx = result?.objectConcepts.indexOf(label) ?? -1;
    return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
  }

  function styleFor(label: string): MaskStyle {
    return (
      maskStyles[label] ?? { color: colorFor(label), ...DEFAULT_MASK_STYLE }
    );
  }

  function updateStyle(label: string, patch: Partial<MaskStyle>) {
    setMaskStyles((prev) => ({
      ...prev,
      [label]: { ...(prev[label] ?? { color: colorFor(label), ...DEFAULT_MASK_STYLE }), ...patch },
    }));
  }

  // One active box per tracked object (label + objectId) nearest the playhead.
  const activeBoxes: SamBoxOut[] = (() => {
    if (!result) return [];
    const groups = new Map<string, SamBoxOut[]>();
    for (const b of result.boxes) {
      const key = `${b.label}:${b.objectId ?? ""}`;
      const list = groups.get(key) ?? [];
      list.push(b);
      groups.set(key, list);
    }
    const active: SamBoxOut[] = [];
    for (const list of groups.values()) {
      let best: SamBoxOut | null = null;
      let bestDiff = 0.75;
      for (const b of list) {
        const diff = Math.abs((b.timestampSeconds ?? b.frameIndex / 30) - currentTime);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = b;
        }
      }
      if (best) active.push(best);
    }
    return active;
  })();

  const visibleActiveBoxes = activeBoxes.filter((b) => styleFor(b.label).visible);
  const activeFrames = new Set(visibleActiveBoxes.map((b) => b.frameIndex));
  const activePaths = (result?.svgPaths ?? []).filter(
    (p) =>
      activeFrames.has(p.frameIndex) &&
      styleFor(p.label ?? visibleActiveBoxes[0]?.label ?? "").visible
  );

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100 relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm p-6">
          <div className="w-full max-w-lg rounded-2xl border-2 border-dashed border-teal-400 bg-zinc-900/95 p-10 text-center space-y-3 shadow-2xl">
            <div className="mx-auto w-12 h-12 rounded-xl bg-teal-950 border border-teal-500/50 text-teal-300 flex items-center justify-center">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-base font-bold text-zinc-100">Drop video to upload</p>
          </div>
        </div>
      )}
      <main className="container mx-auto px-4 sm:px-6 py-5 max-w-4xl space-y-4">
        {/* Temporary tabs beside Ask OT */}
        <div className="flex items-center gap-2">
          <Link
            href="/ask-ot"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent"
          >
            Ask OT
          </Link>
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 text-teal-300 border border-zinc-700">
            SAM 3.1 Test (temporary)
          </span>
        </div>

        <h1 className="text-base font-bold">SAM 3.1 Test</h1>

        {/* Element 1: video upload */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              handleVideo(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-700 hover:border-teal-500/60 px-4 py-6 text-sm text-zinc-300 transition-colors"
          >
            {isReading ? (
              <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
            ) : (
              <Upload className="w-4 h-4 text-teal-400" />
            )}
            <span className="truncate">{fileName || "Upload video"}</span>
          </button>
        </div>

        {/* Video + multi-target mask/box overlay. No max-h/object-contain
            letterboxing: the wrapper is exactly the displayed video size, so
            normalized 0-1 coords map 1:1 onto it. */}
        {previewUrl && (
          <div className="relative w-full overflow-hidden rounded-xl bg-black border border-zinc-800">
            <video
              ref={videoRef}
              src={previewUrl}
              controls
              playsInline
              className="block w-full h-auto bg-black"
              onLoadedMetadata={(e) => {
                setDurationSeconds(e.currentTarget.duration || undefined);
                setVideoSize({
                  width: e.currentTarget.videoWidth || 0,
                  height: e.currentTarget.videoHeight || 0,
                });
              }}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            />
            {visibleActiveBoxes.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                >
                  {activePaths.map((p, i) => {
                    const style = styleFor(p.label ?? visibleActiveBoxes[0]?.label ?? "");
                    return (
                      <path
                        key={`${p.frameIndex}-${i}`}
                        d={p.path}
                        fill={style.color}
                        fillOpacity={style.fillOpacity}
                        stroke={style.color}
                        strokeWidth={Math.max(0.0005, style.strokeWidth * 0.001)}
                      />
                    );
                  })}
                </svg>
                {visibleActiveBoxes.map((b) => {
                  const [ymin, xmin, ymax, xmax] = b.box;
                  const style = styleFor(b.label);
                  return (
                    <div
                      key={`${b.label}-${b.objectId ?? ""}-${b.frameIndex}`}
                      className="absolute rounded"
                      style={{
                        top: `${ymin * 100}%`,
                        left: `${xmin * 100}%`,
                        width: `${(xmax - xmin) * 100}%`,
                        height: `${(ymax - ymin) * 100}%`,
                        border: `${style.strokeWidth}px solid ${style.color}`,
                        backgroundColor: "transparent",
                      }}
                    >
                      <span
                        className="absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[11px] font-mono text-zinc-950 font-semibold whitespace-nowrap"
                        style={{ backgroundColor: style.color }}
                      >
                        {b.label}
                        {b.confidence ? ` ${Math.round(b.confidence * 100)}%` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Element 2: one textbox (comma = separate targets) */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTrack();
            }}
            placeholder="cup, hand, block"
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-teal-500"
          />
          <Button
            onClick={handleTrack}
            disabled={!videoDataUrl || !prompt.trim() || isTracking || isReading}
            className="gap-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold shrink-0"
          >
            {isTracking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Track
          </Button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-800/60 bg-red-950/30 px-4 py-2.5 text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            {savedToDb && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950/60 border border-teal-500/40 text-teal-300 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>Processed tracking data saved to Supabase under your user profile</span>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {result.tracks.map((t) => (
                <span
                  key={t.trackId}
                  className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-900 border"
                  style={{ borderColor: colorFor(t.label), color: colorFor(t.label) }}
                >
                  {t.label} · {t.frames.length} frames
                </span>
              ))}
              <span className="px-2 py-0.5 rounded-full text-[11px] text-zinc-500 bg-zinc-900 border border-zinc-800">
                {result.modelId}
                {result.mode ? ` (${result.mode})` : ""} · {result.billedRequests} req ·{" "}
                {Math.round(result.latencyMs)}ms
              </span>
            </div>
            {/* Per-target mask properties (applied to every detected frame) */}
            {result.objectConcepts.length > 0 && (
              <div className="space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                {result.objectConcepts.map((label) => {
                  const style = styleFor(label);
                  return (
                    <div key={label} className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-300">
                      <span className="w-24 truncate font-mono font-semibold">{label}</span>
                      <input
                        type="color"
                        value={style.color}
                        onChange={(e) => updateStyle(label, { color: e.target.value })}
                        className="w-7 h-6 bg-transparent cursor-pointer"
                        aria-label={`${label} mask color`}
                      />
                      <label className="flex items-center gap-1.5">
                        Fill
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={style.fillOpacity}
                          onChange={(e) => updateStyle(label, { fillOpacity: Number(e.target.value) })}
                          className="w-20 accent-teal-400"
                        />
                        {Math.round(style.fillOpacity * 100)}%
                      </label>
                      <label className="flex items-center gap-1.5">
                        Outline
                        <input
                          type="range"
                          min={0}
                          max={6}
                          step={0.5}
                          value={style.strokeWidth}
                          onChange={(e) => updateStyle(label, { strokeWidth: Number(e.target.value) })}
                          className="w-20 accent-teal-400"
                        />
                        {style.strokeWidth}px
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={style.visible}
                          onChange={(e) => updateStyle(label, { visible: e.target.checked })}
                          className="accent-teal-400"
                        />
                        Show
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
            {result.failures.map((f) => (
              <p key={f.concept} className="text-xs text-red-300">
                {f.concept}: {f.message}
              </p>
            ))}
            {result.boxes.length === 0 && result.failures.length === 0 && (
              <p className="text-xs text-zinc-500">No targets found in this video.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
