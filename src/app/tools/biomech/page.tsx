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
import { Motion3DDots } from "@/components/therapist/Motion3DDots";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

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
  const [prescribedTitle, setPrescribedTitle] = useState("Tendon Gliding Exercise");
  const [prescribedInstructions, setPrescribedInstructions] = useState(
    "1. Start with your hand open and fingers straight.\n2. Slowly bend your fingers into a hook position.\n3. Make a gentle fist.\n4. Straighten your fingers and relax.\n5. Repeat without forcing the movement."
  );
  const [ageBand, setAgeBand] = useState("adult");
  const [therapistNeed, setTherapistNeed] = useState("wrist");

  // Video
  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoDataUrl, setVideoDataUrl] = useState<string | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
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
  const [guideOpen, setGuideOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragCounter = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  // Handle video upload — keep File for direct Supabase upload bypassing Vercel λ limit
  async function handleVideo(file: File | null) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("video/")) { setError("Please choose a valid video file."); return; }
    if (file.size > 100 * 1024 * 1024) { setError("Video over 100 MB — use a shorter clip."); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setRawFile(file);
    setIsReading(true);
    try { setVideoDataUrl(await fileToDataUrl(file)); } catch { setError("Could not read video."); setVideoDataUrl(null); } finally { setIsReading(false); }
  }
  function handleDragEnter(e: React.DragEvent){ e.preventDefault(); e.stopPropagation(); if(e.dataTransfer.types.includes("Files")){dragCounter.current+=1; setIsDragging(true);} }
  function handleDragOver(e: React.DragEvent){ e.preventDefault(); e.stopPropagation(); }
  function handleDragLeave(e: React.DragEvent){ e.preventDefault(); e.stopPropagation(); dragCounter.current=Math.max(0,dragCounter.current-1); if(dragCounter.current===0) setIsDragging(false); }
  async function handleDrop(e: React.DragEvent){ e.preventDefault(); e.stopPropagation(); dragCounter.current=0; setIsDragging(false); if(isRunning||isReading) return; const f=e.dataTransfer.files?.[0]??null; if(f) await handleVideo(f); }

  // Run agentic loop — prefers Supabase Storage upload to bypass Vercel 4.5 MB λ limit
  async function handleRun() {
    if (!videoDataUrl && !rawFile) { setError("Upload a video first."); return; }
    if (!prescribedTitle.trim() && !prescribedInstructions.trim()) { setError("Describe the prescribed activity — AI uses this to decide what to track."); return; }
    setIsRunning(true); setError(null); setResult(null); setActiveStep(2);
    try {
      let payload: Record<string, unknown> = { prescribedTitle, prescribedInstructions, therapistNeed, ageBand, durationSeconds, mediaWidth: videoSize?.width, mediaHeight: videoSize?.height, previousMhr: previousRun?.mhr || null };
      let usedStorage = false;

      const isLocalhost = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local)$/.test(window.location.hostname);
      // Prefer Storage path on Vercel (bypasses 4.5 MB λ limit); skip on localhost (no limit, avoid quota)
      if (rawFile && !isLocalhost) {
        try {
          const supabase = createSupabaseBrowserClient();
          if (supabase) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.id) {
              const ext = (rawFile.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0,4) || "mp4";
              const storagePath = `playground/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
              const { error: upErr } = await supabase.storage.from("program-videos").upload(storagePath, rawFile, { contentType: rawFile.type || `video/${ext}`, upsert: false });
              if (!upErr) {
                payload.videoStoragePath = storagePath;
                usedStorage = true;
              } else {
                console.warn("[biomech] storage upload failed, fallback to data URL:", upErr.message);
              }
            }
          }
        } catch (e) { console.warn("[biomech] storage upload exception:", e); }
      }
      if (!usedStorage) {
        if (!videoDataUrl) throw new Error("Upload failed — no video data available.");
        const approxPayloadMb = (videoDataUrl.length * 0.75) / (1024 * 1024);
        // localhost has no Vercel 4.5 MB gate → allow up to 100 MB direct; Vercel direct caps at ~4.2 MB
        const directLimitMb = isLocalhost ? 98 : 4.2;
        if (approxPayloadMb > directLimitMb) {
          throw new Error(isLocalhost
            ? `Clip is ${approxPayloadMb.toFixed(1)} MB — over 100 MB direct limit. Trim to ≤30s / re-encode lower bitrate, or sign in to use Storage upload (also 100 MB).`
            : `Clip too large for direct upload (${approxPayloadMb.toFixed(1)} MB). Sign in and retry — signed-in users upload via Storage (up to 100 MB). Or use a shorter clip ≤15s / <3 MB, or run on localhost:3000 (allows 100 MB direct).`);
        }
        payload.videoDataUrl = videoDataUrl;
      }

      const res = await fetch("/api/tools/biomech/run", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload),
      });
      const ct = res.headers.get("content-type") || "";
      let data: any;
      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        const txt = await res.text();
        if (!res.ok) throw new Error(txt.slice(0, 800) || `Request failed (${res.status})`);
        try { data = JSON.parse(txt); } catch { throw new Error(txt.slice(0, 800)); }
      }
      if (!res.ok) throw new Error(data.error || "Biomech run failed.");
      setResult(data);
      setActiveStep(4);
      const init: Record<string, {color:string; visible:boolean}> = {};
      (data.concepts||[]).forEach((label:string,i:number)=> { init[label] = { color: PALETTE[i % PALETTE.length], visible: true }; });
      setMaskStyles(init);
      setTimeout(()=> videoRef.current?.play().catch(()=>{}), 300);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isLocalhost = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local)$/.test(window.location.hostname);
      if (/FUNCTION_INVOCATION_TIMEOUT|504|Gateway Timeout|timed out/i.test(msg)) {
        setError(isLocalhost
          ? "Biomech timed out on localhost — 30s clips on Modal CPU 2 cores take ~90-130s. Sampling 10 frames spaced across clip; wait a bit longer or check modal app logs for processingMs. For 10× speed redeploy Modal with GPU (see modal/app.py cpu→gpu)."
          : "Biomech timed out on Vercel (Hobby 10s limit; this flow needs ~20-35s: Spark → SAM 3.1 → Modal). Fix: upgrade to Vercel Pro (vercel.json maxDuration 60 now set) or run locally. Also use ≤15s clip to reduce SAM work.");
      } else setError(msg);
      setActiveStep(1);
    }
    finally { setIsRunning(false); }
  }

  // Overlay computations
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
  const analysis: { movementAnalysis?: string; targets?: Array<{ metric?: string; direction?: string; expectedRange?: string; why?: string }>; watchFor?: string[] } | null = (result as any)?.analysis ?? null;
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
                    <div className="relative w-full bg-black rounded-xl overflow-hidden">
                      <video ref={videoRef} src={previewUrl} playsInline controls={!isolatedLabel} className="block w-full h-auto bg-black max-h-[460px] mx-auto object-contain relative z-0"
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
                      {mhr?.frames?.length>0 && !isolatedLabel && showHud && (<BiomechInVideoHud mhr={mhr} currentTime={currentTime} />)}
                    </div>
                  </div>
                  {/* Playback + overlay toggles */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={toggleVideoPlay} className="h-7 gap-1.5 border-zinc-700 bg-zinc-800 text-zinc-200">{isVideoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}{isVideoPlaying?"Pause":"Play"}</Button>
                    <span className="text-xs font-mono text-zinc-500">{currentTime.toFixed(2)}s / {durationSeconds? durationSeconds.toFixed(1)+"s" : "—"}</span>
                    <div className="flex items-center gap-1 ml-auto">
                      <button onClick={()=> setShowSamBoxes(v=>!v)} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${showSamBoxes?"bg-teal-950 border-teal-500/30 text-teal-300":"bg-zinc-800 border-zinc-700 text-zinc-400"}`}>Boxes {showSamBoxes?"ON":"OFF"}</button>
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
            {/* Step 0 — what the agent understood (from the task-analysis call) */}
            <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-3">
              <h3 className="text-xs font-semibold tracking-wide uppercase text-zinc-300 flex items-center gap-2"><Brain className="w-3.5 h-3.5 text-violet-400" /> Step 0 — What the agent understood</h3>
              {analysis ? (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <p className="text-xs text-zinc-200 leading-relaxed">{analysis.movementAnalysis || "Functional movement analysis."}</p>
                  {Array.isArray(analysis.targets) && analysis.targets.length > 0 && (
                    <div className="grid gap-1.5">
                      {analysis.targets.map((t, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 text-xs">
                          <span className="font-semibold text-zinc-100">{t.metric || `Target ${i+1}`}</span>
                          <span className="text-right text-zinc-400">{t.direction || ""}{t.expectedRange ? ` • expect ${t.expectedRange}` : ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {Array.isArray(analysis.watchFor) && analysis.watchFor.length > 0 && (
                    <p className="text-[11px] text-amber-200/80">Watch for: {analysis.watchFor.join(" · ")}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">No task analysis for this run — concepts were picked directly from the activity text.</p>
              )}
            </Card>
            {/* Step 1 trace */}
            <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-3">
              <h3 className="text-xs font-semibold tracking-wide uppercase text-zinc-300 flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-violet-400" /> Step 1 — Determine <Badge variant="teal" className="text-[11px] font-mono ml-1">{plan?.source==="spark"?"Spark":"Heuristic"} {plan?.latencyMs ? `• ${plan.latencyMs}ms` : ""}</Badge></h3>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="text-xs text-zinc-500">Prescribed: <span className="text-zinc-200 font-medium">{prescribedTitle}</span> — <span className="text-zinc-400">{prescribedInstructions.slice(0,120)}</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {result.concepts.map((c:string,i:number)=> (<span key={c} className="px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5" style={{ backgroundColor:`${PALETTE[i%PALETTE.length]}18`, borderColor: `${PALETTE[i%PALETTE.length]}50`, color: PALETTE[i%PALETTE.length] }}><span className="w-2 h-2 rounded-full" style={{backgroundColor: PALETTE[i%PALETTE.length]}} />{c}</span>))}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed"><span className="font-semibold text-violet-300">Rationale:</span> {plan?.rationale}</p>
                {Array.isArray((plan as any)?.dropped) && (plan as any).dropped.length > 0 && (
                  <p className="text-[11px] text-zinc-500">Final review dropped: {(plan as any).dropped.map((d: any) => d.concept).join(", ")} — kept only what the measurement targets need.</p>
                )}
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
              <h3 className="text-xs font-semibold tracking-wide uppercase text-zinc-300 flex items-center gap-2"><ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" /> Step 3 — Compare <Badge variant="teal" className="text-[11px]">{adherence?.label} • {adherence?.pct}%</Badge>{trend && <Badge variant="amber" className="text-[11px]">{trend.direction}</Badge>}<button onClick={()=> setGuideOpen(true)} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[11px] font-medium text-zinc-300"><Info className="w-3 h-3" /> How to read this</button></h3>
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
                  <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs leading-relaxed space-y-1">
                    <div className="font-semibold text-zinc-200 flex items-center gap-1.5">Provenance <span className="px-1.5 py-0.5 rounded-full bg-teal-950 border border-teal-500/30 text-teal-300 text-[10px] font-mono">SAM 3D Body</span> <span className="text-zinc-500 font-normal">not Spark</span></div>
                    <p className="text-zinc-400">Trunk compensation = <code className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[11px]">angle(pelvis+verticalUp, pelvis, thorax)</code> from MHR 70 3D keypoints <span className="font-mono text-zinc-300">pelvis 0.5×(L_Hip+R_Hip) [9,10], thorax 0.5×(L_Sh+R_Sh) [5,6]</span> per-frame, One-Euro filtered. Spark only picks concepts; SAM 3.1 tracks boxes; Modal SAM3D infers the 3D pose — no LLM invents angles.</p>
                    <p className="text-zinc-500">If subject is truncated/out-of-frame, <code className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700">sceneUnderstanding.isTruncatedByFrameEdge</code> flags it and trunk value is still computed from visible joints but marked — check <span className="font-mono">mhr.frames[].sceneUnderstanding.subjectFrameCoveragePct</span> & flags <code className="px-1 py-0.5 rounded bg-amber-950/40 border border-amber-500/30 text-amber-200">scene_subject_partially_out_of_frame</code>.</p>
                  </div>
                  <div className="text-[11px] text-zinc-600">Deterministic thresholds from <code className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700">biomech-planner.ts deriveExpectation</code> + MHR ground truth. No hallucinated angles.</div>
                </div>
                <div className="space-y-3">
                  {mhr && <BiomechLiveHud mhr={mhr} currentTime={currentTime} />}
                  <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-2">
                    <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-teal-400" /> ROM Summary</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800"><div className="text-[11px] text-zinc-500">Shoulder</div><div className="text-sm font-bold text-zinc-100">{mhr?.summary?.peakAngles?.shoulderFlex_max ?? "—"}°</div></div>
                      <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800"><div className="text-[11px] text-zinc-500">Neck</div><div className="text-sm font-bold text-zinc-100">{mhr?.summary?.peakAngles?.neckFlex_max ?? "—"}°</div></div>
                      <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800"><div className="text-[11px] text-zinc-500">Wrist L</div><div className="text-sm font-bold text-violet-200">{mhr?.summary?.peakAngles?.wristFlex_L_max ?? mhr?.summary?.peakAngles?.wristFlex_R_max ?? "—"}°</div><div className="text-[10px] text-zinc-500">R {mhr?.summary?.peakAngles?.wristFlex_R_max ?? "—"}°</div></div>
                      <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800"><div className="text-[11px] text-zinc-500">Aperture</div><div className="text-sm font-bold text-cyan-200">{mhr?.summary?.rom?.fingerAperture_range_mm ?? mhr?.summary?.peakAngles?.fingerAperture_L_max_mm ?? "—"}mm</div><div className="text-[10px] text-zinc-500">thumb-index</div></div>
                      <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800"><div className="text-[11px] text-zinc-500">BoS</div><div className="text-sm font-bold text-zinc-100">{mhr?.summary?.posturalAndDeformity?.meanBosMarginMm ?? "—"}mm</div></div>
                      <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800"><div className="text-[11px] text-zinc-500">Sway</div><div className="text-sm font-bold text-zinc-100">{mhr?.summary?.gait?.comSwayVelocityMmPerSec ?? "—"} mm/s</div></div>
                    </div>
                    <div className="text-[11px] text-zinc-500">Clip ROM: Shoulder {mhr?.summary?.rom?.shoulderFlex_range ?? "—"}° • Neck {mhr?.summary?.rom?.neckFlex_range ?? "—"}° • Wrist {mhr?.summary?.rom?.wristFlex_L_range ?? mhr?.summary?.rom?.wristFlex_R_range ?? "—"}° • Aperture {mhr?.summary?.rom?.fingerAperture_range_mm ?? "—"}mm</div>
                  </div>
                </div>
              </div>
            </Card>
            {/* 3D dots — full width below analysis, scrubbable */}
            <Motion3DDots mhr={mhr} currentTime={currentTime} onSeek={(t)=>{ setCurrentTime(t); if(videoRef.current){ videoRef.current.currentTime=t; } }} />

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

        <Card className="p-4 border-zinc-800 bg-zinc-900/50">
          <div className="text-xs text-zinc-500"><span className="font-semibold text-zinc-300">Playground only</span> — isolated route <code className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[11px]">/tools/biomech</code>, no DB writes. Try presets + re-run, Save as previous to see trend.</div>
        </Card>
      </main>
      {guideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=> setGuideOpen(false)} />
          <div className="relative w-full max-w-3xl max-h-[85vh] overflow-auto rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl">
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><Info className="w-4 h-4 text-teal-400" /><h2 className="text-sm font-bold text-zinc-100">How to read Step 3</h2><span className="px-1.5 py-0.5 rounded-full bg-teal-950 border border-teal-500/30 text-teal-300 text-[11px] font-mono">1–2 sentence insights</span></div>
              <button onClick={()=> setGuideOpen(false)} className="px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs text-zinc-300">Close ✕</button>
            </div>
            <div className="p-4 space-y-4 text-xs leading-relaxed">
              <p className="text-zinc-400">All numbers are real measurements from your video — <b className="text-zinc-200">SAM 3.1</b> finds the person/boxes, <b className="text-zinc-200">SAM 3D Body (MHR)</b> on Modal infers 70 3D joints per frame, then we compute angles. No LLM invents angles.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-1"><div className="font-semibold text-zinc-100">Scoring</div><p className="text-zinc-400"><span className="px-1.5 py-0.5 rounded-full bg-teal-600 text-white text-[11px] font-bold">Good 90</span> inside target • <span className="px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[11px] font-bold">Watch 65</span> just outside • <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-bold">Needs support 35</span> clearly outside. Overall adherence = <span className="font-mono text-zinc-200">(Good + 0.6×Watch)/n</span> → <b className="text-zinc-200">≥80 Strong • ≥50 Partial • else Needs</b>.</p></div>
                <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-1"><div className="font-semibold text-zinc-100">Range of motion (ROM)</div><p className="text-zinc-400"><b className="text-zinc-200">Peak</b> = highest angle in clip (e.g. Shoulder 118°). <b className="text-zinc-200">ROM</b> = max−min (how much you moved). <b className="text-zinc-200">BoS</b> = how far your center of mass is from your feet (≤120 mm good). <b className="text-zinc-200">Sway</b> = how fast that center wobbles (mm/s).</p></div>
                <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-1"><div className="font-semibold text-zinc-100">Boxes & colors</div><p className="text-zinc-400"><b className="text-teal-300">Colored boxes</b> are SAM 3.1 detections (one per concept like shoulder/hand). Teal/violet/pink per label, shown for 0.75s around current time. Tap a chip to isolate one concept — black veil hides the rest.</p></div>
                <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-1"><div className="font-semibold text-zinc-100">Warnings (amber pills)</div><p className="text-zinc-400">Derived from real angles, e.g. <span className="font-mono text-zinc-300">trunk &gt;8° mild / &gt;14° moderate</span>, <span className="font-mono text-zinc-300">neck &gt;25° forward head</span>, <span className="font-mono text-zinc-300">BoS &gt;140mm sway</span>, <span className="font-mono text-zinc-300">wrist &gt;60° end-range</span>, <span className="font-mono text-zinc-300">aperture &lt;15mm fist</span>. Listed under “flags”.</p></div>
                <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-1"><div className="font-semibold text-zinc-100">Style & HUD</div><p className="text-zinc-400"><b className="text-zinc-200">Style</b> changes skeleton color/thickness/dots/opacity. <b className="text-zinc-200">HUD</b> is the bottom bar on the video with live numbers (shoulder/neck/wrist/aperture/BoS) and the right-side <b className="text-zinc-200">RangeBars + Sparklines</b> that show where you are inside the clip’s min–max.</p></div>
                <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-1"><div className="font-semibold text-zinc-100">Evidence</div><p className="text-zinc-400">Every insight shows <b className="text-zinc-200">Evidence: 1.2s at 118°</b> — the actual frames where it was most extreme, so you can scrub the video to that time and verify.</p></div>
              </div>
              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-2">
                <div className="font-semibold text-zinc-100">3D projection — how it’s made</div>
                <p className="text-zinc-400"><b className="text-zinc-200">Derived from</b> <span className="font-mono text-zinc-300">pred_keypoints_3d</span> 70×3 per frame (real MHR, no mock), centered at pelvis and auto-fit. No mesh hallucinated.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-2"><div className="font-semibold text-zinc-200">Dots</div><div className="text-zinc-400">~900 tiny squares sampled from the 70 joints into a volumetric human. Color by area: L violet / R pink / head amber / torso zinc. Far dots fade.</div></div>
                  <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-2"><div className="font-semibold text-zinc-200">Trail</div><div className="text-zinc-400">When on, draws the continuous path each wrist/hand took through all frames — see loops for tendon-gliding. Off by default.</div></div>
                  <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-2"><div className="font-semibold text-zinc-200">Axes & controls</div><div className="text-zinc-400"><span className="font-mono text-zinc-300">X→right</span> <span className="font-mono text-zinc-300">Y↑up</span> <span className="font-mono text-sky-300">Z→out</span> from pelvis. Drag to rotate, sliders for fine, <span className="font-mono text-zinc-200">↺ Reset</span> / double-click to neutral, frame slider scrubs pose.</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
