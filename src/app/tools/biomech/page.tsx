"use client";

import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Upload,
  Play,
  Pause,
  Loader2,
  AlertTriangle,
  UploadCloud,
  Sparkles,
  Brain,
  Target,
  Film,
  Eye,
  Activity,
  ShieldCheck,
  Timer,
  ArrowLeft,
  Beaker,
  RefreshCw,
  Copy,
  ChevronDown,
  Zap,
  ClipboardCheck,
  TrendingUp,
  Layers,
  Info,
  FileVideo,
  CheckCircle2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { BiomechSkeletonOverlay, BiomechInVideoHud, BiomechLiveHud, BiomechMaskControls, BiomechMaskStyle, DEFAULT_BIOMECH_MASK, findActiveFrame } from "@/components/therapist/BiomechOverlay";

interface SamBoxOut {
  frameIndex: number;
  timestampSeconds: number;
  box: [number, number, number, number];
  label: string;
  objectId?: string;
  confidence?: number;
}
interface SamPathOut { frameIndex: number; path: string; label?: string; objectId?: string; }

type PlannerResult = { concepts: string[]; rationale: string; source: "spark"|"heuristic"; latencyMs?: number };
type Insight = { id: string; label: string; value: number | null; unit: string; threshold: string; rating: "Good"|"Watch"|"Needs support"; score: number; evidenceRef: string; evidenceFrames: Array<{t:number;value:number}>; explanation: string; formula: string; };

const PALETTE = ["#2dd4bf", "#f472b6", "#facc15", "#60a5fa", "#a78bfa", "#fb923c", "#34d399", "#fb7185"];

const PRESETS = [
  { title: "Cylindrical Cup Lift — 90° hold 3s", instructions: "Lift 8oz cup to mouth height with cylindrical grasp, hold 3 seconds, avoid trunk lean. Lower slowly. Repeat 5 reps.", ageBand: "adult" },
  { title: "Sit-to-Stand Transfer", instructions: "Stand from chair without arm support, hold upright 2s, sit with control. Keep trunk upright, feet flat.", ageBand: "geriatric" },
  { title: "Pincer Grasp — Peg Pick", instructions: "Pick 5 small pegs one by one using thumb + index pincer, place into matching slots. Keep wrist neutral.", ageBand: "pedia" },
  { title: "Forward Head Check — Neck Flexion", instructions: "Sit upright, perform chin tuck hold 5s, return to neutral. Repeat 5 reps. Avoid shoulder hike.", ageBand: "adult" },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

export default function BiomechPlaygroundPage() {
  // Step 1 — Prescribed activity (AI decides concepts from this, no word bank)
  const [prescribedTitle, setPrescribedTitle] = useState("Cylindrical Cup Lift — 90° hold 3s");
  const [prescribedInstructions, setPrescribedInstructions] = useState("Lift 8oz cup to mouth height with cylindrical grasp, hold 3 seconds, avoid trunk lean. Lower slowly. Repeat 5 reps.");
  const [ageBand, setAgeBand] = useState("adult");
  const [therapistNeed, setTherapistNeed] = useState("");

  // Video
  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoDataUrl, setVideoDataUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>(undefined);
  const [videoSize, setVideoSize] = useState<{width:number;height:number}|null>(null);
  const [isReading, setIsReading] = useState(false);

  // Agent run
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [activeStep, setActiveStep] = useState<1|2|3|4>(1);

  // Video playback overlay state
  const [currentTime, setCurrentTime] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showSamBoxes, setShowSamBoxes] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showHud, setShowHud] = useState(true);
  const [biomechStyle, setBiomechStyle] = useState<BiomechMaskStyle>({ color: "#2dd4bf", ...DEFAULT_BIOMECH_MASK });
  const [showBiomechControls, setShowBiomechControls] = useState(false);
  const [maskStyles, setMaskStyles] = useState<Record<string, { color: string; visible: boolean }>>({});
  const [isolatedLabel, setIsolatedLabel] = useState<string | null>(null);
  const [previousRun, setPreviousRun] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragCounter = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  // Handle video upload
  async function handleVideo(file: File | null) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("video/")) { setError("Please choose a valid video file."); return; }
    if (file.size > 100 * 1024 * 1024) { setError("Video over 100 MB — use a shorter clip."); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setIsReading(true);
    try { setVideoDataUrl(await fileToDataUrl(file)); } catch { setError("Could not read video."); setVideoDataUrl(null); } finally { setIsReading(false); }
  }
  function handleDragEnter(e: React.DragEvent){ e.preventDefault(); e.stopPropagation(); if(e.dataTransfer.types.includes("Files")){dragCounter.current+=1; setIsDragging(true);} }
  function handleDragOver(e: React.DragEvent){ e.preventDefault(); e.stopPropagation(); }
  function handleDragLeave(e: React.DragEvent){ e.preventDefault(); e.stopPropagation(); dragCounter.current=Math.max(0,dragCounter.current-1); if(dragCounter.current===0) setIsDragging(false); }
  async function handleDrop(e: React.DragEvent){ e.preventDefault(); e.stopPropagation(); dragCounter.current=0; setIsDragging(false); if(isRunning||isReading) return; const f=e.dataTransfer.files?.[0]??null; if(f) await handleVideo(f); }

  // Run agentic loop
  async function handleRun() {
    if (!videoDataUrl) { setError("Upload a video first."); return; }
    if (!prescribedTitle.trim() && !prescribedInstructions.trim()) { setError("Describe the prescribed activity — AI uses this to decide what to track."); return; }
    setIsRunning(true); setError(null); setResult(null); setActiveStep(2);
    try {
      const res = await fetch("/api/tools/biomech/run", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ prescribedTitle, prescribedInstructions, therapistNeed, ageBand, videoDataUrl, durationSeconds, mediaWidth: videoSize?.width, mediaHeight: videoSize?.height, previousMhr: previousRun?.mhr || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Biomech run failed.");
      setResult(data);
      setActiveStep(4);
      // init mask styles from concepts
      const init: Record<string, {color:string; visible:boolean}> = {};
      (data.concepts||[]).forEach((label:string,i:number)=> { init[label] = { color: PALETTE[i % PALETTE.length], visible: true }; });
      setMaskStyles(init);
      setTimeout(()=> videoRef.current?.play().catch(()=>{}), 300);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setActiveStep(1); }
    finally { setIsRunning(false); }
  }

  // Overlay computations — parity with sam-test/page.tsx
  const overlayBoxes: SamBoxOut[] = result?.sam?.boxes ?? [];
  const overlayPaths: SamPathOut[] = result?.sam?.svgPaths ?? [];
  const overlayConcepts: string[] = result?.concepts ?? [];

  function colorFor(label: string) {
    const idx = overlayConcepts.indexOf(label);
    if (idx>=0) return PALETTE[idx % PALETTE.length];
    return maskStyles[label]?.color ?? PALETTE[Math.abs(label.split("").reduce((a,c)=>a+c.charCodeAt(0),0)) % PALETTE.length];
  }
  function styleFor(label: string) {
    const base = maskStyles[label];
    return base ?? { color: colorFor(label), visible: true };
  }

  const activeBoxes: SamBoxOut[] = useMemo(()=> {
    if (overlayBoxes.length===0) return [];
    const groups = new Map<string, SamBoxOut[]>();
    for (const b of overlayBoxes) {
      const key = `${b.label}:${b.objectId??""}`;
      const list = groups.get(key) ?? []; list.push(b); groups.set(key, list);
    }
    const active: SamBoxOut[] = [];
    for (const list of groups.values()) {
      let best: SamBoxOut|null=null; let bestDiff=0.75;
      for (const b of list){ const diff=Math.abs((b.timestampSeconds??b.frameIndex/30)-currentTime); if(diff<bestDiff){bestDiff=diff; best=b;} }
      if(best) active.push(best);
    }
    return active;
  }, [overlayBoxes, currentTime]);

  const effectiveVisibleBoxes = isolatedLabel ? activeBoxes.filter(b=> b.label===isolatedLabel) : activeBoxes.filter(b=> styleFor(b.label).visible);
  const visibleActiveBoxes = showSamBoxes ? effectiveVisibleBoxes : [];
  const activeFrames = new Set(visibleActiveBoxes.map(b=> b.frameIndex));
  const activePaths = overlayPaths.filter(p=> {
    if(!showSamBoxes) return false;
    if(isolatedLabel) return p.label===isolatedLabel && activeFrames.has(p.frameIndex);
    return activeFrames.has(p.frameIndex) && styleFor(p.label?? visibleActiveBoxes[0]?.label??"").visible;
  });

  const isolatedOverlayD = useMemo(()=> {
    if(!isolatedLabel) return null;
    if(activePaths.length>0) return activePaths.map(p=> p.path).join(" ");
    if(visibleActiveBoxes.length>0) return visibleActiveBoxes.map(b=>{ const [ymin,xmin,ymax,xmax]=b.box; return `M${xmin} ${ymin} H${xmax} V${ymax} H${xmin} Z`; }).join(" ");
    return null;
  }, [isolatedLabel, activePaths, visibleActiveBoxes]);

  function toggleVideoPlay(){ const v=videoRef.current; if(!v) return; if(v.paused) v.play(); else v.pause(); }

  // Save current as previous for comparison
  function saveAsPrevious(){ if(result?.mhr) { setPreviousRun(result); setError(null); } }

  const plan: PlannerResult | null = result?.plan ?? null;
  const insights: Insight[] = result?.insights ?? [];
  const mhr = result?.mhr ?? null;
  const trend = result?.trend ?? null;
  const adherence = result?.adherence ?? null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-10" onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-6">
          <div className="w-full max-w-lg rounded-2xl border-2 border-dashed border-teal-400 bg-zinc-900 p-10 text-center space-y-3 shadow-2xl">
            <div className="mx-auto w-12 h-12 rounded-xl bg-teal-950 border border-teal-500/40 text-teal-300 flex items-center justify-center"><UploadCloud className="w-6 h-6 animate-bounce" /></div>
            <p className="text-sm font-semibold text-zinc-100">Drop therapy video to load</p>
            <p className="text-xs text-zinc-400">MP4 / WebM up to 100 MB</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/therapist/dashboard" className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100"><ArrowLeft className="w-3.5 h-3.5" /> Dashboard</Link>
            <span className="hidden sm:block h-5 w-px bg-zinc-800" />
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0"><Beaker className="w-4 h-4" /></div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight text-zinc-100 leading-none flex items-center gap-2">
                Biomechanic Agent <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-950 border border-teal-500/30 text-teal-300">Spark • SAM 3.1 • SAM 3D Body</span>
                <span className="hidden lg:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-950 border border-violet-500/30 text-violet-300">Tools / Biomech</span>
              </h1>
              <p className="hidden sm:block text-[11px] text-zinc-500 leading-none mt-1">Prescribed activity → AI decides what to track → moving boxes + ROM • No word bank</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/sam-test" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100"><Eye className="w-3.5 h-3.5" /> SAM Test</Link>
            <a href="/docs/BIOMECHANICAL_DATAPOINTS.md" target="_blank" className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100"><Info className="w-3.5 h-3.5" /> Datapoints</a>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="sticky top-14 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-11 flex items-center gap-1 overflow-x-auto scrollbar-none">
          {[
            { id:1, label:"1 Prescribe", icon: ClipboardCheck, sub: prescribedTitle.slice(0,18)||"Activity" },
            { id:2, label:"2 Analyze", icon: Zap, sub: isRunning ? "running…" : result ? `${result.sam?.billedRequests??0} SAM • ${mhr?.frames?.length??0} frames` : "AI decides" },
            { id:3, label:"3 Compare", icon: TrendingUp, sub: adherence ? `${adherence.pct}% adherence` : "ROM vs history" },
            { id:4, label:"4 Visualize", icon: Eye, sub: result ? "boxes + skeleton + HUD" : "video overlay" },
          ].map(s=> (
            <button key={s.id} onClick={()=> setActiveStep(s.id as any)} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors ${activeStep===s.id ? "bg-zinc-900 text-zinc-100 border border-zinc-800" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"}`}>
              <s.icon className={`w-3.5 h-3.5 ${activeStep===s.id ? "text-teal-400" : "text-zinc-500"}`} />
              <span className="font-semibold">{s.label}</span>
              <span className="hidden sm:inline text-zinc-600">•</span>
              <span className="hidden sm:inline text-zinc-500 truncate max-w-[160px]">{s.sub}</span>
            </button>
          ))}
          <span className="ml-auto hidden lg:inline-flex items-center gap-1.5 text-[11px] text-zinc-500"><Timer className="w-3 h-3" /> {result?.meta?.processingMs ? `${(result.meta.processingMs/1000).toFixed(1)}s` : "No run yet"}</span>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">

        {/* Step 1: Prescribed Activity — AI decides, no word bank */}
        <section className="scroll-mt-28 space-y-3">
          <h2 className="text-xs font-semibold tracking-widest uppercase text-zinc-400 flex items-center gap-2"><span className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-800 grid place-items-center"><ClipboardCheck className="w-3.5 h-3.5 text-teal-400" /></span> 1 — Prescribed Activity <span className="text-[11px] font-normal normal-case tracking-normal text-zinc-500">AI decides what to track from this</span></h2>
          <Card className="p-5 border-zinc-800 bg-zinc-900/70 space-y-4">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p=> (
                <button key={p.title} onClick={()=> { setPrescribedTitle(p.title); setPrescribedInstructions(p.instructions); setAgeBand(p.ageBand); }} className="px-2.5 py-1 rounded-full text-xs font-medium border bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-teal-500/30 hover:text-zinc-200">{p.title.split("—")[0].trim()}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2 space-y-3">
                <div><label className="text-xs font-semibold text-zinc-300">Activity Title</label><Input value={prescribedTitle} onChange={e=> setPrescribedTitle(e.target.value)} placeholder="e.g. Cylindrical Cup Lift — 90° hold 3s" className="mt-1 text-xs bg-zinc-950 border-zinc-800" /></div>
                <div><label className="text-xs font-semibold text-zinc-300">Instructions given to client</label><Textarea value={prescribedInstructions} onChange={e=> setPrescribedInstructions(e.target.value)} rows={3} placeholder="Lift 8oz cup to mouth height, hold 3s, avoid trunk lean…" className="mt-1 text-xs bg-zinc-950 border-zinc-800 resize-none" /></div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1"><label className="text-xs font-semibold text-zinc-300">Age band</label><select value={ageBand} onChange={e=> setAgeBand(e.target.value)} className="mt-1 w-full h-9 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100"><option value="pedia">Pedia (1–11)</option><option value="adolescent">Adolescent (12–17)</option><option value="adult">Adult (18–54)</option><option value="geriatric">Geriatric (55+)</option></select></div>
                  <div className="flex-[2]"><label className="text-xs font-semibold text-zinc-300">Therapist focus (optional)</label><Input value={therapistNeed} onChange={e=> setTherapistNeed(e.target.value)} placeholder="e.g. focus on trunk stability" className="mt-1 text-xs bg-zinc-950 border-zinc-800" /></div>
                </div>
                <p className="text-[11px] text-zinc-500 flex items-center gap-1.5"><Wand2 className="w-3 h-3 text-violet-400" /> No 16-word bank shown — Spark planner reads activity + picks 2–8 concepts from <code className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px]">BIOMECH_KEYWORDS 16</code> only. Guard enforces 16.</p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5"><Brain className="w-3.5 h-3.5 text-violet-400" /> What AI will do</div>
                <ol className="text-[11px] text-zinc-400 leading-relaxed list-decimal pl-4 space-y-1">
                  <li><b className="text-zinc-300">Determine</b> — Spark picks joints (e.g. person, shoulder, trunk) from activity</li>
                  <li><b className="text-zinc-300">Segment</b> — SAM 3.1 tracks those concepts</li>
                  <li><b className="text-zinc-300">Estimate</b> — Modal SAM 3D Body @3 FPS → ROM/kinematics</li>
                  <li><b className="text-zinc-300">Compare</b> — adherence vs prescribed + vs previous run</li>
                  <li><b className="text-zinc-300">Show</b> — moving boxes + skeleton + HUD below</li>
                </ol>
                <div className="text-[11px] text-zinc-600 pt-2 border-t border-zinc-800">Cost: ~$0.009 SAM + $0.002 Modal per clip. Planner tokens &lt;$0.001.</div>
              </div>
            </div>
          </Card>
        </section>

        {/* Video */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold tracking-widest uppercase text-zinc-400 flex items-center gap-2"><span className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-800 grid place-items-center"><Film className="w-3.5 h-3.5 text-teal-400" /></span> 2 — Video</h2>
          <Card className="p-0 overflow-hidden border-zinc-800 bg-zinc-900/70">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide uppercase text-zinc-300 flex items-center gap-2"><FileVideo className="w-3.5 h-3.5 text-teal-400" /> Clip</span>
              {previewUrl && <Button variant="outline" size="sm" onClick={()=> fileInputRef.current?.click()} className="h-7 text-xs border-zinc-700 bg-zinc-800">Change</Button>}
            </div>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={e=> { handleVideo(e.target.files?.[0]??null); e.target.value=""; }} />
            <div className="p-4">
              {!previewUrl ? (
                <button type="button" onClick={()=> fileInputRef.current?.click()} className="w-full flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-teal-500/50 bg-zinc-950 hover:bg-zinc-900 p-10 transition-colors group">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-800 group-hover:bg-teal-950 border border-zinc-700 group-hover:border-teal-500/30 text-zinc-500 group-hover:text-teal-400 grid place-items-center">{isReading ? <Loader2 className="w-6 h-6 animate-spin text-teal-400" /> : <Upload className="w-6 h-6" />}</div>
                  <div className="text-center"><div className="text-sm font-semibold text-zinc-100">{isReading?"Reading video…":"Drop or select therapy video"}</div><div className="text-xs text-zinc-500">MP4/WebM • max 100 MB • drag & drop</div></div>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs"><FileVideo className="w-4 h-4 text-teal-400 shrink-0" /><span className="font-medium text-zinc-200 truncate">{fileName}</span>{videoSize && <span className="text-zinc-500">• {videoSize.width}×{videoSize.height}{durationSeconds?` • ${Math.round(durationSeconds)}s`:""}</span>}</div>
                  <div className="relative overflow-hidden rounded-2xl bg-black border border-zinc-800">
                    <div className="relative w-full bg-black">
                      <video ref={videoRef} src={previewUrl} playsInline controls={!isolatedLabel} className="block w-full h-auto bg-black max-h-[460px] mx-auto object-contain"
                        onLoadedMetadata={e=> { setDurationSeconds(e.currentTarget.duration||undefined); setVideoSize({width:e.currentTarget.videoWidth||0, height:e.currentTarget.videoHeight||0}); }}
                        onTimeUpdate={e=> setCurrentTime(e.currentTarget.currentTime)}
                        onPlay={()=> setIsVideoPlaying(true)} onPause={()=> setIsVideoPlaying(false)} onEnded={()=> setIsVideoPlaying(false)}
                      />
                      {/* SAM boxes + masks */}
                      {visibleActiveBoxes.length>0 && !isolatedLabel && (
                        <div className="absolute inset-0 pointer-events-none">
                          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1 1" preserveAspectRatio="none">
                            {activePaths.map((p,i)=> { const c = styleFor(p.label?? visibleActiveBoxes[0]?.label??"").color; return (<path key={`${p.frameIndex}-${i}`} d={p.path} fill={c} fillOpacity={0.35} stroke={c} strokeWidth={0.0015} />); })}
                          </svg>
                          {visibleActiveBoxes.map(b=> {
                            const [ymin,xmin,ymax,xmax]=b.box; const c = styleFor(b.label).color;
                            return (<div key={`${b.label}-${b.objectId??""}-${b.frameIndex}`} className="absolute rounded" style={{ top:`${ymin*100}%`, left:`${xmin*100}%`, width:`${(xmax-xmin)*100}%`, height:`${(ymax-ymin)*100}%`, border:`2px solid ${c}` }}><span className="absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[11px] font-mono text-white font-bold whitespace-nowrap shadow" style={{backgroundColor:c}}>{b.label}{b.confidence?` ${Math.round(b.confidence*100)}%`:""}</span></div>);
                          })}
                        </div>
                      )}
                      {isolatedLabel && isolatedOverlayD && (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none"><path d={`M0 0 H1 V1 H0 Z ${isolatedOverlayD}`} fill="black" fillOpacity={0.97} fillRule="evenodd" /></svg>
                      )}
                      {isolatedLabel && visibleActiveBoxes.length===0 && (<div className="absolute inset-0 grid place-items-center bg-black/80 pointer-events-none"><span className="text-xs text-zinc-400">No active frame for {isolatedLabel} at this time</span></div>)}
                      {isolatedLabel && (<div className="absolute bottom-2 left-2 z-10 px-2.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-700 text-xs font-medium text-zinc-100 flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{backgroundColor: styleFor(isolatedLabel).color}} /> Isolated: {isolatedLabel}<button type="button" onClick={()=> setIsolatedLabel(null)} className="ml-1 px-2 py-0.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px]">Clear</button></div>)}
                      {mhr?.frames?.length>0 && !isolatedLabel && showSkeleton && (<BiomechSkeletonOverlay mhr={mhr} currentTime={currentTime} mediaSize={videoSize ? [videoSize.width, videoSize.height] : null} style={biomechStyle} />)}
                      {mhr?.frames?.length>0 && !isolatedLabel && showHud && (<BiomechInVideoHud mhr={mhr} currentTime={currentTime} />)}
                    </div>
                  </div>
                  {/* Playback + overlay toggles */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={toggleVideoPlay} className="h-7 gap-1.5 border-zinc-700 bg-zinc-800 text-zinc-200">{isVideoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}{isVideoPlaying?"Pause":"Play"}</Button>
                    <span className="text-xs font-mono text-zinc-500">{currentTime.toFixed(2)}s / {durationSeconds? durationSeconds.toFixed(1)+"s" : "—"}</span>
                    <div className="flex items-center gap-1 ml-auto">
                      <button onClick={()=> setShowSamBoxes(v=>!v)} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${showSamBoxes?"bg-teal-950 border-teal-500/30 text-teal-300":"bg-zinc-800 border-zinc-700 text-zinc-400"}`}>Boxes {showSamBoxes?"ON":"OFF"}</button>
                      <button onClick={()=> setShowSkeleton(v=>!v)} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${showSkeleton?"bg-teal-950 border-teal-500/30 text-teal-300":"bg-zinc-800 border-zinc-700 text-zinc-400"}`}>Skeleton</button>
                      <button onClick={()=> setShowHud(v=>!v)} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${showHud?"bg-amber-950 border-amber-500/30 text-amber-300":"bg-zinc-800 border-zinc-700 text-zinc-400"}`}>HUD</button>
                      <button onClick={()=> setShowBiomechControls(v=>!v)} className="px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-400">Style <ChevronDown className={`w-3 h-3 inline ${showBiomechControls?"rotate-180":""}`} /></button>
                    </div>
                  </div>
                  {showBiomechControls && (<div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><BiomechMaskControls value={biomechStyle} onChange={setBiomechStyle} /></div>)}
                  {result?.concepts?.length>0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {result.concepts.map((label:string)=> {
                        const st = styleFor(label);
                        const isActive = visibleActiveBoxes.some(b=> b.label===label);
                        return (
                          <button key={label} onClick={()=> setIsolatedLabel(prev=> prev===label? null : label)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${isolatedLabel===label?"bg-zinc-100 text-zinc-900 border-zinc-200": isActive?"text-white border-white/20":"bg-zinc-900 text-zinc-400 border-zinc-800"}`} style={isolatedLabel!==label ? { backgroundColor: isActive? `${st.color}30` : undefined, borderColor: isActive? st.color : undefined } : undefined}>
                            <span className="w-2 h-2 rounded-full" style={{backgroundColor: st.color}} />{label}{isActive ? " • tracking" : ""}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </section>

        {/* Analyze button */}
        <Card className="p-4 border-zinc-800 bg-zinc-900/70 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Button onClick={handleRun} disabled={!videoDataUrl || isRunning || isReading} className="h-11 gap-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-sm shrink-0">
            {isRunning ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing — Spark → SAM 3.1 → Modal…</> : <><Zap className="w-4 h-4" /> Analyze Movement</>}
          </Button>
          <div className="text-xs text-zinc-400 leading-relaxed">
            <span className="font-semibold text-zinc-300">4-step agent:</span> 1 Spark decides joints from activity → 2 SAM 3.1 segments → 3 Modal SAM 3D Body → 4 adherence + moving overlays. {!videoDataUrl && <><br /><span className="text-amber-300">Upload video to enable.</span></>}
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {previousRun && <span className="text-[11px] text-zinc-500">Previous run saved • will compare</span>}
            {result && <Button variant="outline" size="sm" onClick={saveAsPrevious} className="h-8 text-xs border-zinc-700 bg-zinc-800 text-zinc-300 gap-1.5"><Copy className="w-3 h-3" /> Save as previous</Button>}
          </div>
        </Card>

        {error && (<Card className="p-3 border-red-900/50 bg-red-950/30 text-xs text-red-300 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span></Card>)}

        {/* Results — 4 steps */}
        {result && (
          <div className="space-y-4">
            {/* Step 1 trace */}
            <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-3">
              <h3 className="text-xs font-semibold tracking-wide uppercase text-zinc-300 flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-violet-400" /> Step 1 — Determine <Badge variant="teal" className="text-[11px] font-mono ml-1">{plan?.source==="spark"?"Spark":"Heuristic"} {plan?.latencyMs ? `• ${plan.latencyMs}ms` : ""}</Badge></h3>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="text-xs text-zinc-500">Prescribed: <span className="text-zinc-200 font-medium">{prescribedTitle}</span> — <span className="text-zinc-400">{prescribedInstructions.slice(0,120)}</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {result.concepts.map((c:string,i:number)=> (<span key={c} className="px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5" style={{ backgroundColor:`${PALETTE[i%PALETTE.length]}18`, borderColor: `${PALETTE[i%PALETTE.length]}50`, color: PALETTE[i%PALETTE.length] }}><span className="w-2 h-2 rounded-full" style={{backgroundColor: PALETTE[i%PALETTE.length]}} />{c}</span>))}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed"><span className="font-semibold text-violet-300">Rationale:</span> {plan?.rationale}</p>
                <p className="text-[11px] text-zinc-600">Locked to <code className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700">BIOMECH_KEYWORDS 16</code> — concepts validated via <code className="text-[11px]">biomech-prompt.ts:5</code>. No 700 word bank.</p>
              </div>
            </Card>

            {/* Step 2 */}
            <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-3">
              <h3 className="text-xs font-semibold tracking-wide uppercase text-zinc-300 flex items-center gap-2"><Target className="w-3.5 h-3.5 text-teal-400" /> Step 2 — Segment &amp; Estimate <Badge variant="teal" className="text-[11px] font-mono">{result.sam?.billedRequests} SAM req • {mhr?.frames?.length??0} frames @3 FPS</Badge></h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5"><div className="text-[11px] text-zinc-500">SAM 3.1 latency</div><div className="text-sm font-bold text-zinc-100">{result.sam?.latencyMs ?? "—"} ms</div><div className="text-[11px] text-zinc-600">{result.sam?.boxes?.length??0} boxes • {result.sam?.tracks?.length??0} tracks</div></div>
                <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5"><div className="text-[11px] text-zinc-500">Modal MHR</div><div className="text-sm font-bold text-zinc-100">{mhr?.processingMs ?? "—"} ms</div><div className="text-[11px] text-zinc-600">{mhr?.modelId ?? "sam-3d-body"}</div></div>
                <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5"><div className="text-[11px] text-zinc-500">Confidence</div><div className="text-sm font-bold text-zinc-100">{mhr?.summary?.confidenceOverall ? `${Math.round(mhr.summary.confidenceOverall*100)}%` : "—"}</div><div className="text-[11px] text-zinc-600">pose ±2–3° large ROM</div></div>
                <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5"><div className="text-[11px] text-zinc-500">Risk</div><div className="text-sm font-bold text-zinc-100 capitalize">{mhr?.summary?.risk === "moderate_fall" ? "Watch" : mhr?.summary?.risk || "Low"}</div><div className="text-[11px] text-zinc-600">{mhr?.flags?.length??0} flags</div></div>
              </div>
              {mhr?.flags?.length>0 && (<div className="flex flex-wrap gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />{mhr.flags.map((f:string)=> <span key={f} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-950/40 border border-amber-500/30 text-amber-200">{f.replace(/_/g," ")}</span>)}</div>)}
            </Card>

            {/* Step 3 */}
            <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-3">
              <h3 className="text-xs font-semibold tracking-wide uppercase text-zinc-300 flex items-center gap-2"><ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" /> Step 3 — Compare <Badge variant="teal" className="text-[11px]">{adherence?.label} • {adherence?.pct}%</Badge>{trend && <Badge variant="amber" className="text-[11px]">{trend.direction}</Badge>}</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2 space-y-2">
                  {insights.map((ins: Insight)=> (
                    <div key={ins.id} className={`p-3 rounded-xl border flex flex-col gap-1 ${ins.rating==="Good"?"bg-teal-950/20 border-teal-800/40": ins.rating==="Watch"?"bg-amber-950/20 border-amber-800/40":"bg-red-950/20 border-red-800/40"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-zinc-100">{ins.label}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${ins.rating==="Good"?"bg-teal-600 text-white border-teal-500": ins.rating==="Watch"?"bg-amber-600 text-white border-amber-500":"bg-red-600 text-white border-red-500"}`}>{ins.rating} • {ins.score}</span>
                      </div>
                      <div className="text-xs font-mono text-zinc-300">{ins.value!=null ? `${ins.value}${ins.unit}` : "—"} <span className="text-zinc-500">• {ins.threshold}</span> <span className="text-zinc-600">• {ins.formula}</span></div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{ins.explanation}</p>
                      <div className="text-[11px] text-zinc-500 font-mono">Evidence: {ins.evidenceRef} {ins.evidenceFrames?.length? `• ${ins.evidenceFrames.map(f=> `${f.t.toFixed(1)}s ${f.value}${ins.unit}`).join(", ")}`:""}</div>
                    </div>
                  ))}
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 leading-relaxed"><span className="font-semibold text-zinc-300">Adherence</span> — {adherence?.explanation} <span className="font-mono text-teal-300">{adherence?.pct}%</span> • {adherence?.label}</div>
                  {trend && (<div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400"><span className="font-semibold text-zinc-300">Trend vs previous:</span> {trend.summary}</div>)}
                  <div className="text-[11px] text-zinc-600">Deterministic thresholds from <code className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700">biomech-planner.ts deriveExpectation</code> + MHR ground truth. No hallucinated angles.</div>
                </div>
                <div className="space-y-3">
                  {mhr && <BiomechLiveHud mhr={mhr} currentTime={currentTime} />}
                  <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-2">
                    <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-teal-400" /> ROM Summary</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800"><div className="text-[11px] text-zinc-500">Shoulder</div><div className="text-sm font-bold text-zinc-100">{mhr?.summary?.peakAngles?.shoulderFlex_max ?? "—"}°</div></div>
                      <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800"><div className="text-[11px] text-zinc-500">Neck</div><div className="text-sm font-bold text-zinc-100">{mhr?.summary?.peakAngles?.neckFlex_max ?? "—"}°</div></div>
                      <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800"><div className="text-[11px] text-zinc-500">BoS</div><div className="text-sm font-bold text-zinc-100">{mhr?.summary?.posturalAndDeformity?.meanBosMarginMm ?? "—"}mm</div></div>
                      <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800"><div className="text-[11px] text-zinc-500">Sway</div><div className="text-sm font-bold text-zinc-100">{mhr?.summary?.gait?.comSwayVelocityMmPerSec ?? "—"} mm/s</div></div>
                    </div>
                    <div className="text-[11px] text-zinc-500">Clip ROM: Shoulder {mhr?.summary?.rom?.shoulderFlex_range ?? "—"}° • Neck {mhr?.summary?.rom?.neckFlex_range ?? "—"}°</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Step 4 already visualized above — recap */}
            <Card className="p-4 border-zinc-800 bg-zinc-900/70">
              <h3 className="text-xs font-semibold tracking-wide uppercase text-zinc-300 flex items-center gap-2"><Eye className="w-3.5 h-3.5 text-teal-400" /> Step 4 — Moving Segmentation + Measurements</h3>
              <p className="text-xs text-zinc-400 mt-1">Video above shows <b className="text-zinc-300">SAM 3.1 boxes</b> (0.75s window) + <b className="text-zinc-300">SAM 3D Body skeleton</b> + <b className="text-zinc-300">HUD</b> scrubbed to <span className="font-mono text-teal-300">{currentTime.toFixed(2)}s</span>. Use Play/Pause, tap chips to isolate, Boxes/Skeleton/HUD toggles. Same scrub model as SAM Test.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="teal" className="text-[11px] font-mono">SAM boxes: {result.sam?.boxes?.length} total • {visibleActiveBoxes.length} active @ {currentTime.toFixed(2)}s</Badge>
                <Badge variant="amber" className="text-[11px] font-mono">MHR frames: {mhr?.frames?.length} • {result.sam?.billedRequests} billed</Badge>
                <Badge variant="outline" className="text-[11px] font-mono">Latency {result.meta?.processingMs} ms</Badge>
              </div>
            </Card>
          </div>
        )}

        {/* Empty state */}
        {!result && !isRunning && (
          <Card className="p-8 border-dashed border-zinc-700 bg-zinc-900/40 text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 grid place-items-center"><Activity className="w-5 h-5 text-zinc-500" /></div>
            <div className="text-sm font-semibold text-zinc-300">No analysis yet</div>
            <div className="text-xs text-zinc-500 max-w-lg mx-auto">Describe the prescribed activity, upload a clip, then hit <b className="text-zinc-400">Analyze Movement</b>. Spark will think of what joints to watch — no word bank needed.</div>
          </Card>
        )}

        <Card className="p-4 border-zinc-800 bg-zinc-900/50 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="text-xs text-zinc-500"><span className="font-semibold text-zinc-300">Playground only</span> — isolated route <code className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[11px]">/tools/biomech</code>, no DB writes. Try presets + re-run, Save as previous to see trend.</div>
          <Link href="/sam-test" className="text-xs font-medium text-teal-400 hover:text-teal-300 inline-flex items-center gap-1">Go to SAM Test <ArrowLeft className="w-3 h-3 rotate-180" /></Link>
        </Card>
      </main>
    </div>
  );
}
