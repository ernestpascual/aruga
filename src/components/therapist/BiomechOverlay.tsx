"use client";
import React, { useMemo } from "react";

type MhrFrame = {
  frameIndex: number;
  timestampSeconds: number;
  angles: Record<string, any>;
  motionAnnotations?: Array<{ joint: string; motion: string; value: number; visible: boolean; anchor: string }>;
  rom?: Record<string, number>;
  biomechTelemetry?: any;
  sceneUnderstanding?: any;
  confidence?: { pose: number; angleErrorDeg: number };
  pred_keypoints_2d?: number[][];
  pred_keypoints_3d?: number[][];
  flags?: string[];
};

type MhrSummary = {
  peakAngles: Record<string, number>;
  rom: Record<string, number>;
  gait?: any;
  posturalAndDeformity?: any;
  sceneSummary?: any;
  risk?: string;
  confidenceOverall: number;
};

export type BiomechMaskStyle = {
  color: string;
  strokeWidth: number; // px mapped to 0.002-0.008 viewBox
  pointRadius: number; // 0.004-0.014
  opacity: number; // 0-1
  visible: boolean;
  showLabels: boolean;
};

export const DEFAULT_BIOMECH_MASK: Omit<BiomechMaskStyle, "color"> = {
  strokeWidth: 2.5,
  pointRadius: 0.009,
  opacity: 0.92,
  visible: true,
  showLabels: true,
};

export function findActiveFrame(frames: MhrFrame[], currentTime: number): MhrFrame | null {
  if (!frames.length) return null;
  let best = frames[0];
  let bestDiff = Math.abs((frames[0].timestampSeconds ?? frames[0].frameIndex / 30) - currentTime);
  for (const f of frames) {
    const ts = f.timestampSeconds ?? f.frameIndex / 30;
    const diff = Math.abs(ts - currentTime);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = f;
    }
  }
  return best;
}

function RangeBar({ label, value, min, max, unit = "°" }: { label: string; value: number; min: number; max: number; unit?: string }) {
  const range = Math.max(1e-6, max - min);
  const pct = Math.max(0, Math.min(100, ((value - min) / range) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-medium text-zinc-400">{label}</span>
        <span className="font-mono text-zinc-200">{value?.toFixed?.(1) ?? value}{unit} <span className="text-zinc-500">[{min?.toFixed?.(0)}–{max?.toFixed?.(0)}{unit}]</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800 relative overflow-hidden">
        <div className="absolute inset-y-0 bg-teal-500/30" style={{ left: 0, right: 0 }} />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white border border-teal-400 shadow" style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}

function Sparkline({ values, height = 28, color = "#14b8a6", currentIdx = -1 }: { values: number[]; height?: number; color?: string; currentIdx?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = height;
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * stepX},${h - ((v - min) / range) * (h - 6) - 3}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth={1.2} points={pts} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
      {currentIdx >= 0 && currentIdx < values.length && (() => {
        const v = values[currentIdx];
        const x = currentIdx * stepX;
        const y = h - ((v - min) / range) * (h - 6) - 3;
        return <circle cx={x} cy={y} r={2.2} fill="white" stroke={color} strokeWidth={1} />;
      })()}
    </svg>
  );
}

const SKELETON_EDGES: [number, number][] = [
  [0, 5], [0, 6], [5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [11, 12], [5, 11], [6, 12], [11, 13], [13, 15], [12, 14], [14, 16],
];

const JOINT_ANCHOR_IDX: Record<string, number> = {
  shoulder: 5,
  shoulder_L: 5,
  shoulder_R: 6,
  neck: 0,
  neck_flex: 0,
  neck_lateral: 0,
  neck_rotation: 0,
  trunk: 5,
  hip: 11,
  hip_L: 11,
  hip_R: 12,
  knee: 13,
  knee_L: 13,
  knee_R: 14,
  elbow: 7,
  elbow_L: 7,
  elbow_R: 8,
};

function MotionTags({ kpts2d, mediaSize, annotations, style }: { kpts2d: number[][]; mediaSize?: [number, number] | null; annotations: Array<{ joint: string; motion: string; anchor?: string }>; style: BiomechMaskStyle }) {
  if (!style.showLabels || !annotations?.length || !kpts2d?.length) return null;
  const w = mediaSize?.[0] ?? 1280;
  const h = mediaSize?.[1] ?? 720;
  const norm = kpts2d.map(([x, y]) => {
    if (x == null || y == null) return [0, 0] as [number, number];
    const nx = x > 1.5 ? x / w : x;
    const ny = y > 1.5 ? y / h : y;
    return [nx, ny] as [number, number];
  });
  // only show visible motions, limit to 6 to avoid clutter — prioritize neck + shoulders
  const priority = ["neck_flex", "neck_lateral", "neck_rotation", "shoulder_L", "shoulder_R", "trunk", "hip_L", "hip_R", "elbow_R", "knee_L"];
  const sorted = [...annotations].sort((a, b) => priority.indexOf(a.joint) - priority.indexOf(b.joint));
  const show = sorted.filter((a) => !a.motion.startsWith("Neutral") || a.joint.startsWith("neck")).slice(0, 6);
  return (
    <>
      {show.map((a) => {
        const idx = JOINT_ANCHOR_IDX[a.anchor as string] ?? JOINT_ANCHOR_IDX[a.joint] ?? 0;
        const pt = norm[idx] ?? [0.5, 0.5];
        // offset a bit so tag doesn't cover joint
        const ox = pt[0] > 0.5 ? -1 : 1;
        const oy = -1;
        const isNeck = a.joint.startsWith("neck");
        return (
          <div
            key={a.joint}
            className={`absolute px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shadow border pointer-events-none ${isNeck ? "bg-amber-500 text-zinc-900 border-amber-400" : a.joint.includes("shoulder") ? "bg-teal-500 text-white border-teal-400" : "bg-zinc-900/90 text-zinc-100 border-white/20"}`}
            style={{ left: `${pt[0] * 100}%`, top: `${pt[1] * 100}%`, transform: `translate(${ox * 6}px, ${oy * 12}px) translate(-50%, -100%)` }}
          >
            {a.motion}
          </div>
        );
      })}
    </>
  );
}

function SkeletonSvg({ kpts2d, mediaSize, style, annotations }: { kpts2d: number[][]; mediaSize?: [number, number] | null; style: BiomechMaskStyle; annotations?: Array<{ joint: string; motion: string; anchor: string }> }) {
  if (!kpts2d || kpts2d.length < 1) return null;
  const w = mediaSize?.[0] ?? 1280;
  const h = mediaSize?.[1] ?? 720;
  const norm = kpts2d.map(([x, y]) => {
    if (x == null || y == null) return [0, 0] as [number, number];
    const nx = x > 1.5 ? x / w : x;
    const ny = y > 1.5 ? y / h : y;
    return [nx, ny] as [number, number];
  });
  if (norm.length < 17) {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
        {norm.slice(0, 5).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={style.pointRadius * 1.2} fill={style.color} fillOpacity={style.opacity} stroke="white" strokeWidth={0.002} />
        ))}
      </svg>
    );
  }
  const strokeW = (style.strokeWidth / 2.5) * 0.004;
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
      {SKELETON_EDGES.map(([a, b], idx) => {
        const pa = norm[a];
        const pb = norm[b];
        if (!pa || !pb) return null;
        return <line key={idx} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke={style.color} strokeWidth={strokeW} strokeLinecap="round" opacity={style.opacity} />;
      })}
      {norm.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={style.pointRadius * (i === 0 ? 1.1 : 1)} fill={i <= 1 ? "#f59e0b" : style.color} fillOpacity={style.opacity} stroke="white" strokeWidth={0.0015} />
      ))}
    </svg>
  );
}

export function BiomechInVideoHud({
  mhr,
  currentTime,
}: {
  mhr: { frames: MhrFrame[]; summary: MhrSummary; modelId?: string };
  currentTime: number;
}) {
  const frame = useMemo(() => findActiveFrame(mhr.frames ?? [], currentTime), [mhr.frames, currentTime]);
  if (!frame) return null;
  // prefer motion-annotated labels from Modal (ROM as motions: flexion/extension/rotation)
  const ma = frame.motionAnnotations ?? [];
  const getMotion = (joint: string) => ma.find((a) => a.joint === joint)?.motion ?? null;
  const vals = {
    shoulderL: getMotion("shoulder_L") ?? frame.angles?.shoulderFlex_L_motion ?? `${frame.angles?.shoulderFlex_L ?? 0}°`,
    shoulderR: getMotion("shoulder_R") ?? frame.angles?.shoulderFlex_R_motion ?? `${frame.angles?.shoulderFlex_R ?? 0}°`,
    neckFlex: getMotion("neck_flex") ?? frame.angles?.neckAngles?.flexExt_motion ?? `${frame.angles?.neckAngles?.flexExt ?? 0}°`,
    neckLat: getMotion("neck_lateral") ?? frame.angles?.neckAngles?.lateralFlex_motion,
    neckRot: getMotion("neck_rotation") ?? frame.angles?.neckAngles?.rotation_motion,
    elbowR: frame.angles?.elbowFlex_R_motion ?? `${frame.angles?.elbowFlex_R ?? 0}°`,
    kneeL: frame.angles?.kneeFlex_L_motion ?? `${frame.angles?.kneeFlex_L ?? 0}°`,
    trunk: frame.angles?.trunkLean_motion ?? `${frame.angles?.trunkLean ?? 0}°`,
    bosMargin: frame.biomechTelemetry?.bosMarginMm ?? null,
  };
  const frameFlags = frame.flags ?? [];
  return (
    <div className="absolute bottom-0 inset-x-0 pointer-events-none z-[5]">
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
      <div className="relative px-2.5 py-2 space-y-1.5">
        <div className="flex flex-wrap gap-1 text-[10px] font-mono leading-none">
          <span className="px-1.5 py-1 rounded bg-teal-500 text-white font-bold">{vals.shoulderL}</span>
          <span className="px-1.5 py-1 rounded bg-sky-500 text-white font-bold">{vals.shoulderR}</span>
          <span className="px-1.5 py-1 rounded bg-zinc-800/90 text-zinc-100 border border-white/10">{vals.elbowR}</span>
          <span className="px-1.5 py-1 rounded bg-zinc-800/90 text-zinc-100 border border-white/10">{vals.kneeL}</span>
          <span className="px-1.5 py-1 rounded bg-zinc-800/90 text-zinc-200 border border-white/10">{vals.trunk}</span>
          <span className="px-1.5 py-1 rounded bg-amber-600 text-white border border-white/20">{vals.neckFlex}</span>
          {vals.neckLat && <span className="px-1.5 py-1 rounded bg-violet-600 text-white">{vals.neckLat}</span>}
          {vals.neckRot && !vals.neckRot.startsWith("Neutral") && <span className="px-1.5 py-1 rounded bg-fuchsia-600 text-white">{vals.neckRot}</span>}
          {vals.bosMargin !== null && <span className="px-1.5 py-1 rounded bg-amber-500 text-zinc-900 font-bold">BoS {vals.bosMargin}mm</span>}
          <span className="ml-auto px-1.5 py-1 rounded bg-black/60 text-white/80 border border-white/10">{frame.timestampSeconds.toFixed(2)}s</span>
        </div>
        {frameFlags.length > 0 && (
          <div className="flex flex-wrap gap-1 text-[10px]">
            {frameFlags.slice(0, 3).map((f) => (
              <span key={f} className="px-1.5 py-0.5 rounded-full bg-amber-500/90 text-zinc-900 font-medium">{f.replace(/_/g, " ")}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function BiomechLiveHud({
  mhr,
  currentTime,
}: {
  mhr: { frames: MhrFrame[]; summary: MhrSummary; modelId?: string };
  currentTime: number;
  mediaSize?: [number, number] | null;
}) {
  const frame = useMemo(() => findActiveFrame(mhr.frames ?? [], currentTime), [mhr.frames, currentTime]);
  if (!frame) return null;
  const idx = mhr.frames.indexOf(frame);
  const summary = mhr.summary;
  const peak = summary.peakAngles ?? {};
  const rom = summary.rom ?? {};
  function rangeFor(keyPeak: string, keyRange: string, fallbackMax?: number) {
    const max = (peak as any)[keyPeak] ?? (frame as any)?.rom?.[keyRange.replace("_range", "_max")] ?? fallbackMax ?? 0;
    const range = (rom as any)[keyRange] ?? ((frame as any)?.rom ? ((frame as any).rom[keyRange.replace("_range", "_max")] !== undefined ? Math.abs(((frame as any).rom[keyRange.replace("_range", "_max")] as number) - ((frame as any).rom[keyRange.replace("_range", "_min")] as number)) : undefined) : undefined) ?? 10;
    const min = max - (range ?? 10);
    return { min, max };
  }
  const shoulderRange = rangeFor("shoulderFlex_max", "shoulderFlex_range", 180);
  const shoulderRRange = rangeFor("shoulderFlex_max", "shoulderFlex_R_range", 180);
  const neckRange = rangeFor("neckFlex_max", "neckFlex_range", 60);
  const kneeRange = rangeFor("kneeFlex_L_max", "kneeFlex_L_range", 120);
  const vals = {
    shoulderL: frame.angles?.shoulderFlex_L ?? 0,
    shoulderR: frame.angles?.shoulderFlex_R ?? 0,
    elbowR: frame.angles?.elbowFlex_R ?? frame.angles?.elbowFlex_L ?? 0,
    kneeL: frame.angles?.kneeFlex_L ?? 0,
    trunkLean: frame.angles?.trunkLean ?? 0,
    neck: frame.angles?.neckAngles?.flexExt ?? 0,
    bosMargin: frame.biomechTelemetry?.bosMarginMm ?? null,
    pelvicObliq: frame.angles?.pelvicObliquityDeg ?? 0,
  };
  const shoulderSeries = mhr.frames.map((f) => f.angles?.shoulderFlex_L ?? 0);
  const neckSeries = mhr.frames.map((f) => f.angles?.neckAngles?.flexExt ?? 0);
  const kneeSeries = mhr.frames.map((f) => f.angles?.kneeFlex_L ?? 0);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
        <span className="px-2 py-1 rounded-full bg-zinc-900/90 border border-teal-500/30 text-teal-200">Sh L <b className="text-white">{vals.shoulderL.toFixed(1)}°</b></span>
        <span className="px-2 py-1 rounded-full bg-zinc-900/90 border border-sky-500/30 text-sky-200">Sh R <b className="text-white">{vals.shoulderR.toFixed(1)}°</b></span>
        <span className="px-2 py-1 rounded-full bg-zinc-900/90 border border-zinc-700 text-zinc-200">Elbow <b className="text-white">{typeof vals.elbowR === "number" ? vals.elbowR.toFixed(1) : vals.elbowR}°</b></span>
        <span className="px-2 py-1 rounded-full bg-zinc-900/90 border border-zinc-700 text-zinc-200">Knee L <b className="text-white">{vals.kneeL.toFixed(1)}°</b></span>
        <span className="px-2 py-1 rounded-full bg-zinc-900/90 border border-zinc-700 text-zinc-300">Trunk {vals.trunkLean.toFixed(1)}°</span>
        <span className="px-2 py-1 rounded-full bg-zinc-900/90 border border-zinc-700 text-zinc-300">Neck {typeof vals.neck === "number" ? vals.neck.toFixed(1) : vals.neck}°</span>
        {vals.bosMargin !== null && <span className="px-2 py-1 rounded-full bg-amber-950/40 border border-amber-500/30 text-amber-200">BoS {vals.bosMargin}mm</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 rounded-lg bg-zinc-900/70 border border-zinc-800">
        <RangeBar label="Shoulder L" value={vals.shoulderL} min={shoulderRange.min} max={shoulderRange.max} />
        <RangeBar label="Neck flex" value={typeof vals.neck === "number" ? vals.neck : 0} min={neckRange.min} max={neckRange.max} />
        <RangeBar label="Shoulder R" value={vals.shoulderR} min={shoulderRRange.min} max={shoulderRRange.max} />
        <RangeBar label="Knee L" value={vals.kneeL} min={kneeRange.min} max={kneeRange.max} />
      </div>
      <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-2 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
          <span>Shoulder L across clip</span>
          <span className="font-mono">{mhr.frames.length} frames • {summary.confidenceOverall ? `${Math.round(summary.confidenceOverall * 100)}%` : ""} • {frame.timestampSeconds.toFixed(2)}s</span>
        </div>
        <Sparkline values={shoulderSeries} currentIdx={idx} color="#14b8a6" height={32} />
        <div className="grid grid-cols-3 gap-2">
          <div><div className="text-[10px] text-zinc-500">Neck</div><Sparkline values={neckSeries} currentIdx={idx} color="#f59e0b" height={22} /></div>
          <div><div className="text-[10px] text-zinc-500">Knee L</div><Sparkline values={kneeSeries} currentIdx={idx} color="#60a5fa" height={22} /></div>
          <div><div className="text-[10px] text-zinc-500">BoS margin</div><Sparkline values={mhr.frames.map(f=> f.biomechTelemetry?.bosMarginMm ?? 0)} currentIdx={idx} color="#a78bfa" height={22} /></div>
        </div>
        <div className="flex gap-px h-2">
          {mhr.frames.map((f, i) => {
            const isActive = i === idx;
            const hasFlag = (f.flags?.length ?? 0) > 0;
            return <div key={i} className={`flex-1 rounded-sm ${isActive ? "bg-teal-400" : hasFlag ? "bg-amber-500/60" : "bg-zinc-700"}`} title={`f${f.frameIndex} ${f.timestampSeconds.toFixed(2)}s`} />;
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] text-zinc-600 font-mono">
          <span>0.00s</span>
          <span>{mhr.frames[mhr.frames.length-1]?.timestampSeconds.toFixed(1) ?? ""}s</span>
        </div>
      </div>
    </div>
  );
}

export function BiomechSkeletonOverlay({ mhr, currentTime, mediaSize, style }: { mhr: { frames: MhrFrame[] }; currentTime: number; mediaSize?: [number, number] | null; style: BiomechMaskStyle }) {
  const frame = useMemo(() => findActiveFrame(mhr.frames ?? [], currentTime), [mhr.frames, currentTime]);
  if (!style.visible || !frame?.pred_keypoints_2d?.length) return null;
  const hasValid = frame.pred_keypoints_2d.some(([x,y]) => typeof x === "number" && typeof y === "number" && !isNaN(x) && !isNaN(y));
  if (!hasValid) return null;
  return (
    <>
      <SkeletonSvg kpts2d={frame.pred_keypoints_2d as number[][]} mediaSize={mediaSize as any} style={style} annotations={frame.motionAnnotations as any} />
      <MotionTags kpts2d={frame.pred_keypoints_2d as number[][]} mediaSize={mediaSize as any} annotations={(frame.motionAnnotations ?? []) as any} style={style} />
    </>
  );
}

export function BiomechMaskControls({ value, onChange }: { value: BiomechMaskStyle; onChange: (v: BiomechMaskStyle) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <input type="color" value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })} className="w-7 h-7 rounded-lg bg-transparent cursor-pointer" title="Skeleton color" />
      <label className="flex items-center gap-1.5 text-zinc-400">Opacity <input type="range" min={0} max={1} step={0.05} value={value.opacity} onChange={(e) => onChange({ ...value, opacity: Number(e.target.value) })} className="w-16 accent-teal-500" /><span className="font-mono w-7 text-right">{Math.round(value.opacity*100)}%</span></label>
      <label className="flex items-center gap-1.5 text-zinc-400">Thick <input type="range" min={0} max={6} step={0.5} value={value.strokeWidth} onChange={(e) => onChange({ ...value, strokeWidth: Number(e.target.value) })} className="w-16 accent-teal-500" /><span className="font-mono w-7 text-right">{value.strokeWidth}px</span></label>
      <label className="flex items-center gap-1.5 text-zinc-400">Dots <input type="range" min={0.004} max={0.016} step={0.001} value={value.pointRadius} onChange={(e) => onChange({ ...value, pointRadius: Number(e.target.value) })} className="w-16 accent-teal-500" /></label>
      <label className="flex items-center gap-1.5 text-zinc-400 cursor-pointer"><input type="checkbox" checked={value.visible} onChange={(e) => onChange({ ...value, visible: e.target.checked })} className="accent-teal-500" /> Show</label>
      <label className="flex items-center gap-1.5 text-zinc-400 cursor-pointer"><input type="checkbox" checked={value.showLabels} onChange={(e) => onChange({ ...value, showLabels: e.target.checked })} className="accent-sky-500" /> Labels</label>
    </div>
  );
}
