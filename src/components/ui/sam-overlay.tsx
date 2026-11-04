"use client";

import React, { useRef, useState } from "react";
import { Eye, EyeOff, Layers, Sparkles, Activity, Settings2 } from "lucide-react";
import { BiomechLiveHud, BiomechSkeletonOverlay, BiomechInVideoHud, BiomechMaskControls, BiomechMaskStyle, DEFAULT_BIOMECH_MASK } from "@/components/therapist/BiomechOverlay";

interface SamBox {
  frame_index?: number;
  frameIndex?: number;
  timestamp_seconds?: number;
  timestampSeconds?: number;
  box: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1
  label: string;
  confidence?: number;
}

interface SamSvgPath {
  frame_index?: number;
  frameIndex?: number;
  path: string;
  label?: string;
  objectId?: string;
}

const SEG_PALETTE = ["#2dd4bf", "#f472b6", "#facc15", "#60a5fa", "#a78bfa", "#fb923c", "#34d399", "#fb7185"];
function segColor(label: string | undefined, labels: string[]): string {
  const i = Math.max(0, labels.indexOf(label || ""));
  return SEG_PALETTE[i % SEG_PALETTE.length];
}

interface SamOverlayProps {
  videoSrc: string;
  boxes?: SamBox[];
  svgPaths?: SamSvgPath[];
  objectConcept?: string;
  modelProvenance?: string;
  className?: string;
  mhr?: any | null;
  onTimeUpdateExternal?: (t: number) => void;
  /** Remove the skeleton layer + its toggles from this view entirely (segmentation-only view). */
  hideSkeleton?: boolean;
}

export function SamOverlay({
  videoSrc,
  boxes = [],
  svgPaths = [],
  objectConcept,
  modelProvenance = "SAM 3.1: object segmentation",
  className = "",
  mhr = null,
  onTimeUpdateExternal,
  hideSkeleton = false,
}: SamOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  // Segmentation is the primary overlay (on by default, primary toggle);
  // skeleton is secondary and toggled independently.
  const [showSegmentation, setShowSegmentation] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showBiomech, setShowBiomech] = useState(true);
  const [biomechStyle, setBiomechStyle] = useState<BiomechMaskStyle>({ color: "#2dd4bf", ...DEFAULT_BIOMECH_MASK });
  const [showBiomechControls, setShowBiomechControls] = useState(false);
  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null);

  // All segments active at the current video time: every concept tracked on
  // the nearest frame (person, hand, finger...), not just one closest box —
  // segmentation is the main thing the viewer should see.
  const { activeBoxes, activePaths, segLabels } = React.useMemo(() => {
    const tsOf = (b: SamBox) => b.timestamp_seconds ?? b.timestampSeconds ?? (b.frame_index ?? b.frameIndex ?? 0) / 30;
    const labels = [...new Set((boxes || []).map((b) => b.label).filter(Boolean))];
    if (!boxes?.length) return { activeBoxes: [] as SamBox[], activePaths: [] as SamSvgPath[], segLabels: labels };
    let nearestTs = tsOf(boxes[0]);
    let minDiff = Infinity;
    for (const b of boxes) {
      const d = Math.abs(tsOf(b) - currentTime);
      if (d < minDiff) { minDiff = d; nearestTs = tsOf(b); }
    }
    if (minDiff > 0.75) return { activeBoxes: [] as SamBox[], activePaths: [] as SamSvgPath[], segLabels: labels };
    const inFrame = boxes.filter((b) => Math.abs(tsOf(b) - nearestTs) < 0.05).slice(0, 12);
    const frameIdx = new Set(inFrame.map((b) => b.frame_index ?? b.frameIndex));
    const paths = (svgPaths || []).filter((p) => frameIdx.has(p.frame_index ?? p.frameIndex)).slice(0, 12);
    return { activeBoxes: inFrame, activePaths: paths, segLabels: labels };
  }, [currentTime, boxes, svgPaths]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setCurrentTime(t);
      onTimeUpdateExternal?.(t);
    }
  };

  const hasSamData = boxes.length > 0;

  // Overlay stage must be EXACTLY the rendered video frame — not the outer
  // card (which also contains the live-HUD strip + provenance footer below).
  // If overlays span the whole card, normalized SAM boxes and the skeleton
  // SVG are scaled/centered against HUD+footer height and land far from the
  // person. So: stage sized to the video's intrinsic aspect ratio, capped at
  // 460px tall, centered — video fills it, every absolute layer aligns to it.
  const stageAspect = videoSize ? videoSize.w / videoSize.h : 16 / 9;
  const stageStyle: React.CSSProperties = {
    aspectRatio: `${stageAspect}`,
    maxWidth: `min(100%, ${Math.round(460 * stageAspect)}px)`,
  };
  const skeletonMediaSize: [number, number] | null =
    (mhr?.samPerson?.mediaSize as [number, number] | undefined) ??
    (videoSize ? [videoSize.w, videoSize.h] : null);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-xl bg-zinc-950 border border-zinc-800 group ${className}`}
    >
      {/* Overlay toggles — Segmentation is primary, Skeleton secondary */}
      {(hasSamData || mhr?.frames?.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-zinc-900/95 border-b border-zinc-800">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mr-1">Overlays</span>
          {hasSamData && (
            <button
              type="button"
              aria-pressed={showSegmentation}
              onClick={() => setShowSegmentation((v) => !v)}
              className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-bold border transition-colors ${showSegmentation ? "bg-teal-500 border-teal-400 text-white shadow" : "bg-zinc-950 border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
              title="Show or hide SAM 3.1 segmentation masks + boxes on the video"
            >
              {showSegmentation ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              Segmentation {showSegmentation ? "On" : "Off"}
            </button>
          )}
          {mhr?.frames?.length > 0 && (
            <>
              {!hideSkeleton && (
                <button
                  type="button"
                  aria-pressed={showSkeleton}
                  onClick={() => setShowSkeleton((v) => !v)}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${showSkeleton ? "bg-sky-950 border-sky-500/50 text-sky-200" : "bg-zinc-950 border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
                  title="Show or hide the SAM 3D Body skeleton on the video"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Skeleton {showSkeleton ? "On" : "Off"}
                </button>
              )}
              <button
                type="button"
                aria-pressed={showBiomech}
                onClick={() => setShowBiomech((v) => !v)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${showBiomech ? "bg-zinc-800 border-zinc-600 text-zinc-100" : "bg-zinc-950 border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
              >
                Measures {showBiomech ? "On" : "Off"}
              </button>
              {!hideSkeleton && (
                <button type="button" onClick={() => setShowBiomechControls((v) => !v)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200" title="Skeleton appearance">
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
          <span className="ml-auto text-[11px] font-mono text-zinc-500">
            {showSegmentation && activeBoxes.length ? `${activeBoxes.length} segment${activeBoxes.length === 1 ? "" : "s"} @ ${currentTime.toFixed(1)}s` : hasSamData ? `${boxes.length} tracked frames` : ""}
          </span>
        </div>
      )}

      {/* Stage — only the video + its overlays live in here */}
      <div className="relative mx-auto w-full bg-black overflow-hidden" style={stageStyle}>
        <video
          ref={videoRef}
          src={videoSrc}
          controls
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth > 0 && v.videoHeight > 0) setVideoSize({ w: v.videoWidth, h: v.videoHeight });
          }}
          className="absolute inset-0 h-full w-full object-contain bg-black"
        />

        {/* SAM 3.1 segmentation — PRIMARY overlay: every concept tracked on
            this frame (masks + boxes, one colour per concept).
            Defensive: runs saved without mediaSize can carry pixel-space
            boxes/paths; detect that (>1.5) and normalize against the actual
            video dimensions instead of drawing off-frame. */}
        {showSegmentation && activeBoxes.length > 0 && (() => {
          const normBox = (raw: [number, number, number, number]): [number, number, number, number] =>
            Math.max(...raw.map(Math.abs)) > 1.5 && videoSize
              ? [raw[0] / videoSize.h, raw[1] / videoSize.w, raw[2] / videoSize.h, raw[3] / videoSize.w]
              : raw;
          const firstPathNums = activePaths[0] ? (activePaths[0].path.match(/-?\d+\.?\d*/g) || []).map(Number) : [];
          const pathIsPixel = firstPathNums.length > 0 && Math.max(...firstPathNums.map(Math.abs)) > 1.5 && !!videoSize;
          return (
            <div className="absolute inset-0 pointer-events-none z-[4]">
              {/* Masks */}
              {activePaths.length > 0 && (
                <svg className="w-full h-full absolute inset-0" viewBox={pathIsPixel ? `0 0 ${videoSize!.w} ${videoSize!.h}` : "0 0 1 1"} preserveAspectRatio="none">
                  {activePaths.map((p, i) => {
                    const c = segColor(p.label, segLabels);
                    return <path key={i} d={p.path} fill={c} fillOpacity={0.38} stroke={c} strokeWidth={pathIsPixel ? Math.max(1, videoSize!.w * 0.0025) : "0.0025"} />;
                  })}
                </svg>
              )}
              {/* Boxes */}
              <svg className="w-full h-full absolute inset-0" viewBox="0 0 1 1" preserveAspectRatio="none">
                {activeBoxes.map((b, i) => {
                  const [ymin, xmin, ymax, xmax] = normBox(b.box);
                  const c = segColor(b.label, segLabels);
                  return <rect key={i} x={xmin} y={ymin} width={xmax - xmin} height={ymax - ymin} fill={c} fillOpacity={0.10} stroke={c} strokeWidth="0.0035" className="transition-all duration-100" />;
                })}
              </svg>
              {/* Labels */}
              {activeBoxes.map((b, i) => {
                const [ymin, xmin] = normBox(b.box);
                const c = segColor(b.label, segLabels);
                return (
                  <div key={i} style={{ top: `${ymin * 100}%`, left: `${xmin * 100}%`, backgroundColor: `${c}E6`, borderColor: c }} className="absolute -translate-y-full transform border text-zinc-950 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 z-10">
                    <Layers className="w-3 h-3" />
                    <span>{b.label}{b.confidence ? ` ${Math.round(b.confidence * 100)}%` : ""}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Biomech skeleton + in-video HUD — inside the stage so their
            absolute inset-0 / bottom-0 anchor to the video, not the card */}
        {mhr?.frames?.length > 0 && (
          <>
            {!hideSkeleton && showSkeleton && <BiomechSkeletonOverlay mhr={mhr} currentTime={currentTime} mediaSize={skeletonMediaSize} style={biomechStyle} />}
            {showBiomech && <BiomechInVideoHud mhr={mhr} currentTime={currentTime} />}
          </>
        )}
      </div>

      {/* Biomech mask adjustments — like SAM engine */}
      {!hideSkeleton && mhr?.frames?.length > 0 && showBiomechControls && (
        <div className="px-3 py-2 bg-zinc-900/95 border-t border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-sky-300 flex items-center gap-1"><Settings2 className="w-3 h-3" /> Biomech mask appearance</span>
            <span className="text-[10px] text-zinc-500">{mhr.frames.length} frames • t={currentTime.toFixed(2)}s</span>
          </div>
          <BiomechMaskControls value={biomechStyle} onChange={setBiomechStyle} />
          <p className="text-[10px] text-zinc-500">Skeleton follows SAM segments in video — adjust color/opacity/thickness like SAM engine.</p>
        </div>
      )}

      {/* Biomech live HUD + ranges — updates as segments move (below video, detailed) */}
      {mhr?.frames?.length > 0 && (
        <div className="px-3 py-2 bg-zinc-950/95 border-t border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-sky-300 flex items-center gap-1"><Activity className="w-3 h-3" /> Live ranges — moves with video</span>
            <span className="text-[10px] font-mono text-zinc-500">{mhr.modelId ?? "MHR"} • {mhr.frames.length} frames • t={currentTime.toFixed(2)}s</span>
          </div>
          <BiomechLiveHud mhr={mhr} currentTime={currentTime} />
        </div>
      )}

      {/* Model Provenance Footer */}
      {hasSamData && (
        <div className="px-3 py-1.5 bg-zinc-900/90 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-teal-400" />
            <span className="font-mono text-zinc-300">{modelProvenance}</span>
            {objectConcept && <span className="text-zinc-500">• Target: &quot;{objectConcept}&quot;</span>}
          </div>
          <span className="text-zinc-500">{boxes.length} tracked frames</span>
        </div>
      )}
    </div>
  );
}
