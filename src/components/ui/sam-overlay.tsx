"use client";

import React, { useRef, useState, useEffect } from "react";
import { Eye, EyeOff, Layers, Sparkles } from "lucide-react";
import { Button } from "./button";

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
}

export function SamOverlay({
  videoSrc,
  boxes = [],
  svgPaths = [],
  objectConcept,
  modelProvenance = "SAM 3.1: object segmentation",
  className = "",
}: SamOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [activeBox, setActiveBox] = useState<SamBox | null>(null);
  const [activeSvg, setActiveSvg] = useState<string | null>(null);

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
      setCurrentTime(videoRef.current.currentTime);
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
          {/* SVG Canvas for Masks and Boxes */}
          <svg className="w-full h-full absolute inset-0" viewBox="0 0 1 1" preserveAspectRatio="none">
            {/* Segmentation mask if available */}
            {activeSvg && (
              <path
                d={activeSvg}
                fill="rgba(20, 184, 166, 0.25)"
                stroke="#14b8a6"
                strokeWidth="0.003"
              />
            )}

            {/* Bounding Box: normalized [ymin, xmin, ymax, xmax] 0-1 */}
            {(() => {
              const [ymin, xmin, ymax, xmax] = activeBox.box;
              return (
                <rect
                  x={xmin}
                  y={ymin}
                  width={xmax - xmin}
                  height={ymax - ymin}
                  fill="rgba(20, 184, 166, 0.15)"
                  stroke="#2dd4bf"
                  strokeWidth="0.003"
                  className="transition-all duration-100"
                />
              );
            })()}
          </svg>

          {/* Bounding Box Label Tag */}
          {(() => {
            const [ymin, xmin] = activeBox.box;
            const top = `${ymin * 100}%`;
            const left = `${xmin * 100}%`;
            const confidencePct = activeBox.confidence
              ? Math.round(activeBox.confidence * 100)
              : 95;

            return (
              <div
                style={{ top, left }}
                className="absolute -translate-y-full transform bg-teal-950/90 border border-teal-500/80 text-teal-200 text-[11px] font-mono px-1.5 py-0.5 rounded shadow flex items-center gap-1 z-10"
              >
                <Layers className="w-3 h-3 text-teal-400" />
                <span>
                  {activeBox.label} ({confidencePct}%)
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {/* Control Bar Overlay for SAM */}
      {hasSamData && (
        <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setShowOverlay(!showOverlay)}
            className="h-8 bg-zinc-900/90 backdrop-blur-md border border-zinc-700/80 text-xs text-zinc-200 hover:bg-zinc-800 shadow"
          >
            {showOverlay ? (
              <>
                <Eye className="w-3.5 h-3.5 text-teal-400 mr-1.5" />
                SAM Tracking On
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-zinc-400 mr-1.5" />
                SAM Tracking Off
              </>
            )}
          </Button>
        </div>
      )}

      {/* Model Provenance Footer */}
      {hasSamData && (
        <div className="px-3 py-1.5 bg-zinc-900/90 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-teal-400" />
            <span className="font-mono text-zinc-300">{modelProvenance}</span>
            {objectConcept && (
              <span className="text-zinc-500">• Target: &quot;{objectConcept}&quot;</span>
            )}
          </div>
          <span className="text-zinc-500">{boxes.length} tracked frames</span>
        </div>
      )}
    </div>
  );
}
