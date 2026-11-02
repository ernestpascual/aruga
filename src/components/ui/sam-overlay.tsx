"use client";

import React, { useRef, useState, useEffect } from "react";
import { Eye, EyeOff, Layers, Sparkles, Activity, Settings2 } from "lucide-react";
import { Button } from "./button";
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
}: SamOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [activeBox, setActiveBox] = useState<SamBox | null>(null);
  const [activeSvg, setActiveSvg] = useState<string | null>(null);
  const [showBiomech, setShowBiomech] = useState(true);
  const [biomechStyle, setBiomechStyle] = useState<BiomechMaskStyle>({ color: "#2dd4bf", ...DEFAULT_BIOMECH_MASK });
  const [showBiomechControls, setShowBiomechControls] = useState(false);

  // Sync bounding boxes and masks to video currentTime
  useEffect(() => {
    if (!boxes || boxes.length === 0 || !showOverlay) {
      setActiveBox(null);
      setActiveSvg(null);
      return;
    }

    // Find box closest to currentTime
    let closestBox: SamBox | null = null;
    let minDiff = 1.0; // 1 second window

    for (const b of boxes) {
      const ts = b.timestamp_seconds ?? b.timestampSeconds ?? (b.frame_index ?? b.frameIndex ?? 0) / 30;
      const diff = Math.abs(ts - currentTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestBox = b;
      }
    }

    setActiveBox(closestBox);

    // Find SVG path for closest frame if available
    if (closestBox && svgPaths.length > 0) {
      const targetFrame = closestBox.frame_index ?? closestBox.frameIndex ?? 0;
      const pathMatch = svgPaths.find(
        (p) => (p.frame_index ?? p.frameIndex) === targetFrame
      );
      setActiveSvg(pathMatch ? pathMatch.path : null);
    } else {
      setActiveSvg(null);
    }
  }, [currentTime, boxes, svgPaths, showOverlay]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setCurrentTime(t);
      onTimeUpdateExternal?.(t);
    }
  };

  const hasSamData = boxes.length > 0;

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-xl bg-zinc-950 border border-zinc-800 group ${className}`}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        controls
        playsInline
        onTimeUpdate={handleTimeUpdate}
        className="w-full h-auto max-h-[460px] object-contain bg-black mx-auto"
      />

      {/* SAM 3.1 Overlay Layer */}
      {showOverlay && activeBox && (
        <div className="absolute inset-0 pointer-events-none">
          <svg className="w-full h-full absolute inset-0" viewBox="0 0 1 1" preserveAspectRatio="none">
            {activeSvg && (
              <path d={activeSvg} fill="rgba(20, 184, 166, 0.25)" stroke="#14b8a6" strokeWidth="0.003" />
            )}
            {(() => {
              const [ymin, xmin, ymax, xmax] = activeBox.box;
              return <rect x={xmin} y={ymin} width={xmax - xmin} height={ymax - ymin} fill="rgba(20, 184, 166, 0.15)" stroke="#2dd4bf" strokeWidth="0.003" className="transition-all duration-100" />;
            })()}
          </svg>
          {(() => {
            const [ymin, xmin] = activeBox.box;
            const top = `${ymin * 100}%`;
            const left = `${xmin * 100}%`;
            const confidencePct = activeBox.confidence ? Math.round(activeBox.confidence * 100) : 95;
            return (
              <div style={{ top, left }} className="absolute -translate-y-full transform bg-teal-950/90 border border-teal-500/80 text-teal-200 text-[11px] font-mono px-1.5 py-0.5 rounded shadow flex items-center gap-1 z-10">
                <Layers className="w-3 h-3 text-teal-400" />
                <span>{activeBox.label} ({confidencePct}%)</span>
              </div>
            );
          })()}
        </div>
      )}

      {/* Biomech skeleton + in-video HUD — same clipping as SAM engine */}
      {mhr?.frames?.length > 0 && (
        <>
          <BiomechSkeletonOverlay mhr={mhr} currentTime={currentTime} mediaSize={mhr?.samPerson?.mediaSize ?? (mhr?.samPerson?.mediaSize as any)} style={biomechStyle} />
          {showBiomech && <BiomechInVideoHud mhr={mhr} currentTime={currentTime} />}
        </>
      )}

      {/* Top control bar: SAM + Biomech toggles */}
      {(hasSamData || mhr) && (
        <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
          {hasSamData && (
            <Button type="button" size="sm" variant="secondary" onClick={() => setShowOverlay(!showOverlay)} className="h-7 bg-zinc-900/90 backdrop-blur-md border border-zinc-700/80 text-xs text-zinc-200 hover:bg-zinc-800 shadow">
              {showOverlay ? <><Eye className="w-3.5 h-3.5 text-teal-400 mr-1.5" /> SAM On</> : <><EyeOff className="w-3.5 h-3.5 text-zinc-400 mr-1.5" /> SAM Off</>}
            </Button>
          )}
          {mhr?.frames?.length > 0 && (
            <>
              <Button type="button" size="sm" variant="secondary" onClick={() => setShowBiomech(!showBiomech)} className="h-7 bg-zinc-900/90 backdrop-blur-md border border-sky-700/40 text-xs text-sky-200 hover:bg-zinc-800 shadow">
                <Activity className="w-3.5 h-3.5 text-sky-400 mr-1.5" /> {showBiomech ? "Measures On" : "Measures Off"}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setShowBiomechControls(!showBiomechControls)} className="h-7 w-7 p-0 bg-zinc-900/90 backdrop-blur-md border border-zinc-700/80 text-zinc-400 hover:bg-zinc-800">
                <Settings2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      )}

      {/* Biomech mask adjustments — like SAM engine */}
      {mhr?.frames?.length > 0 && showBiomechControls && (
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
