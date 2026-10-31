"use client";

import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Upload,
  Play,
  Loader2,
  AlertTriangle,
  UploadCloud,
  CheckCircle2,
  Baby,
  GraduationCap,
  User,
  HeartPulse,
  Home,
  School,
  UtensilsCrossed,
  Sparkles,
  Info,
  Search,
  Check,
  RotateCcw,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronUp,
  Sliders,
  FileVideo,
  Activity,
  Layers,
  BookOpen,
  Clock,
  Timer,
  History,
  ArrowLeft,
  Beaker,
  Target,
  Film,
  Settings2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/supabase/auth-context";
import {
  SAM_ENGINES,
  SamEngineCategory,
  SamKeywordItem,
  SamEngineMetadata,
} from "@/lib/meta/sam-engines";

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
  processingTimeMs?: number;
  mode?: string;
}

interface TestRun {
  id: string;
  engineKey: SamEngineCategory | "custom";
  engineName: string;
  targetCount: number;
  detectedCount: number;
  latencyMs: number;
  timestamp: number;
  fileName: string;
  result: SamResultOut;
}

interface PastSessionRecord {
  id: string;
  user_id: string | null;
  prompt: string;
  file_name: string | null;
  duration_seconds: number | null;
  object_concepts: string[];
  tracks: Array<{ trackId: string; label: string; objectId?: string; frames: number[] }>;
  boxes: SamBoxOut[];
  svg_paths?: SamPathOut[];
  billed_requests: number;
  model_id: string | null;
  latency_ms: number | null;
  created_at: string;
}

const PALETTE = ["#2dd4bf", "#f472b6", "#facc15", "#60a5fa", "#a78bfa", "#fb923c", "#34d399", "#fb7185"];

interface MaskStyle {
  color: string;
  fillOpacity: number; // 0-1
  strokeWidth: number; // px for boxes
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

type EngineSelection = SamEngineCategory | "custom";

const ENGINE_CONFIGS: Record<
  SamEngineCategory,
  {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    subtext: string;
    ageRange: string;
    group: "demographic" | "environment";
    activeClass: string;
    badgeClass: string;
  }
> = {
  pedia: {
    icon: Baby,
    title: "Pediatric",
    subtext: "Milestones & Sensory",
    ageRange: "Ages 1–11",
    group: "demographic",
    activeClass: "bg-teal-950/60 border-teal-500 ring-1 ring-teal-500/40 text-teal-200 shadow-teal-950/50",
    badgeClass: "bg-teal-950 text-teal-300 border-teal-500/40",
  },
  adolescent: {
    icon: GraduationCap,
    title: "Adolescent",
    subtext: "School & Sports Agility",
    ageRange: "Ages 12–17",
    group: "demographic",
    activeClass: "bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500/40 text-indigo-200 shadow-indigo-950/50",
    badgeClass: "bg-indigo-950 text-indigo-300 border-indigo-500/40",
  },
  adult: {
    icon: User,
    title: "Adult",
    subtext: "Vocational & Rehab",
    ageRange: "Ages 18–54",
    group: "demographic",
    activeClass: "bg-sky-950/60 border-sky-500 ring-1 ring-sky-500/40 text-sky-200 shadow-sky-950/50",
    badgeClass: "bg-sky-950 text-sky-300 border-sky-500/40",
  },
  old_people: {
    icon: HeartPulse,
    title: "Geriatrics",
    subtext: "Geriatrics & Falls",
    ageRange: "Ages 55+",
    group: "demographic",
    activeClass: "bg-amber-950/60 border-amber-500 ring-1 ring-amber-500/40 text-amber-200 shadow-amber-950/50",
    badgeClass: "bg-amber-950 text-amber-300 border-amber-500/40",
  },
  home_objects: {
    icon: Home,
    title: "Everyday Home",
    subtext: "Domestic ADL & Safety",
    ageRange: "All Ages",
    group: "environment",
    activeClass: "bg-emerald-950/60 border-emerald-500 ring-1 ring-emerald-500/40 text-emerald-200 shadow-emerald-950/50",
    badgeClass: "bg-emerald-950 text-emerald-300 border-emerald-500/40",
  },
  school_objects: {
    icon: School,
    title: "Everyday School",
    subtext: "Classroom & Playground",
    ageRange: "Ages 3–21",
    group: "environment",
    activeClass: "bg-violet-950/60 border-violet-500 ring-1 ring-violet-500/40 text-violet-200 shadow-violet-950/50",
    badgeClass: "bg-violet-950 text-violet-300 border-violet-500/40",
  },
  kitchen_items: {
    icon: UtensilsCrossed,
    title: "Kitchen Items",
    subtext: "Culinary & Dysphagia",
    ageRange: "All Ages",
    group: "environment",
    activeClass: "bg-rose-950/60 border-rose-500 ring-1 ring-rose-500/40 text-rose-200 shadow-rose-950/50",
    badgeClass: "bg-rose-950 text-rose-300 border-rose-500/40",
  },
};

export default function SamTestPage() {
  const [selectedEngine, setSelectedEngine] = useState<EngineSelection>("pedia");
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(() => {
    return new Set(SAM_ENGINES.pedia.keywords);
  });
  const [prompt, setPrompt] = useState<string>(() => SAM_ENGINES.pedia.payload);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Inspector filters
  const [searchQuery, setSearchQuery] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState<
    "ALL" | "OT" | "PT" | "SLP" | "Interdisciplinary"
  >("ALL");
  const [isInspectorExpanded, setIsInspectorExpanded] = useState(true);
  const [inspectedItem, setInspectedItem] = useState<SamKeywordItem | null>(null);

  // Video State
  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoDataUrl, setVideoDataUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>(undefined);
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);
  const [maskStyles, setMaskStyles] = useState<Record<string, MaskStyle>>({});
  const [isolatedLabel, setIsolatedLabel] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SamResultOut | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [savedToDb, setSavedToDb] = useState(false);

  // Multi-Run Test Comparison History
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Past Processed Sessions from DB
  const [pastSessions, setPastSessions] = useState<PastSessionRecord[]>([]);
  const [isLoadingPastSessions, setIsLoadingPastSessions] = useState(false);
  const [reloadedSessionNotice, setReloadedSessionNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragCounter = useRef(0);
  const { user } = useAuth();

  // Fetch past processed sessions from API
  const fetchPastSessions = useCallback(async () => {
    setIsLoadingPastSessions(true);
    try {
      const url = user?.id ? `/api/sam-test?userId=${user.id}` : "/api/sam-test";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.sessions)) {
          setPastSessions(data.sessions as PastSessionRecord[]);
        }
      }
    } catch (e) {
      console.warn("[sam-test] Failed to load past sessions:", e);
    } finally {
      setIsLoadingPastSessions(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPastSessions();
  }, [fetchPastSessions]);

  // Active engine metadata (or null if custom)
  const currentEngineMeta: SamEngineMetadata | null =
    selectedEngine !== "custom" ? SAM_ENGINES[selectedEngine] : null;

  // Switch between engines
  function handleSelectEngine(cat: EngineSelection) {
    setSelectedEngine(cat);
    setSearchQuery("");
    setDisciplineFilter("ALL");
    setInspectedItem(null);

    if (cat === "custom") {
      return;
    }

    const engine = SAM_ENGINES[cat];
    const initialSet = new Set(engine.keywords);
    setSelectedKeywords(initialSet);
    setPrompt(engine.payload);
  }

  // Toggle individual keyword
  function handleToggleKeyword(keyword: string) {
    setSelectedKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) {
        next.delete(keyword);
      } else {
        next.add(keyword);
      }
      setPrompt(Array.from(next).join(", "));
      return next;
    });
  }

  // Preset filters for active engine
  function handleSelectAllEngineKeywords() {
    if (!currentEngineMeta) return;
    const all = new Set(currentEngineMeta.keywords);
    setSelectedKeywords(all);
    setPrompt(currentEngineMeta.payload);
  }

  function handleSelectDisciplineKeywords(disc: "OT" | "PT" | "SLP" | "Interdisciplinary") {
    if (!currentEngineMeta) return;
    const filtered = currentEngineMeta.items
      .filter((i) => i.discipline === disc)
      .map((i) => i.keyword);
    const set = new Set(filtered);
    setSelectedKeywords(set);
    setPrompt(filtered.join(", "));
  }

  function handleClearKeywords() {
    setSelectedKeywords(new Set());
    setPrompt("");
  }

  function handleCopyPayload() {
    if (!prompt.trim()) return;
    navigator.clipboard.writeText(prompt);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  }

  // Filter items in active engine for inspector view
  const filteredEngineItems = useMemo(() => {
    if (!currentEngineMeta) return [];
    return currentEngineMeta.items.filter((item) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        item.keyword.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.clinicalContext.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.otpfCategory.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDiscipline =
        disciplineFilter === "ALL" || item.discipline === disciplineFilter;

      return matchesSearch && matchesDiscipline;
    });
  }, [currentEngineMeta, searchQuery, disciplineFilter]);

  // Handle Video Upload
  async function handleVideo(file: File | null) {
    if (!file) return;
    setError(null);
    setResult(null);
    setActiveRunId(null);
    setIsolatedLabel(null);
    if (!file.type.startsWith("video/")) {
      setError("Please choose a valid video file.");
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

  // Handle Tracking Execution
  async function handleTrack() {
    if (!videoDataUrl || !prompt.trim() || isTracking || isReading) return;
    setError(null);
    setIsTracking(true);
    setSavedToDb(false);
    setReloadedSessionNotice(null);

    const activeConcepts = prompt
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

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

      const resultData = data as SamResultOut;
      setResult(resultData);

      // Create a test run entry for side-by-side comparison
      const engineTitle =
        selectedEngine === "custom"
          ? "Custom Payload"
          : SAM_ENGINES[selectedEngine].name;

      const newRun: TestRun = {
        id: `run-${Date.now()}`,
        engineKey: selectedEngine,
        engineName: engineTitle,
        targetCount: activeConcepts.length,
        detectedCount: resultData.tracks.length,
        latencyMs: resultData.latencyMs,
        timestamp: Date.now(),
        fileName: fileName || "clip.mp4",
        result: resultData,
      };

      setTestRuns((prev) => [newRun, ...prev]);
      setActiveRunId(newRun.id);

      if (user?.id) {
        setSavedToDb(true);
      }
      videoRef.current?.play().catch(() => {});
      // Refresh past sessions list so the new session appears
      fetchPastSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tracking failed.");
    } finally {
      setIsTracking(false);
    }
  }

  function handleSelectRun(run: TestRun) {
    setActiveRunId(run.id);
    setResult(run.result);
    if (run.engineKey !== "custom") {
      setSelectedEngine(run.engineKey);
    }
  }

  // Reload an old processed session from DB
  function handleReloadSession(session: PastSessionRecord) {
    setPrompt(session.prompt);
    const parsedConcepts = session.prompt
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setSelectedKeywords(new Set(parsedConcepts));

    // Detect if prompt matches any standard engine
    let matchedEngine: EngineSelection = "custom";
    for (const [key, engine] of Object.entries(SAM_ENGINES)) {
      if (engine.payload === session.prompt || parsedConcepts.length === engine.targetCount) {
        matchedEngine = key as SamEngineCategory;
        break;
      }
    }
    setSelectedEngine(matchedEngine);

    if (session.file_name && !fileName) {
      setFileName(session.file_name);
    }

    const restoredResult: SamResultOut = {
      objectConcepts: session.object_concepts || parsedConcepts,
      tracks: session.tracks || [],
      boxes: session.boxes || [],
      svgPaths: session.svg_paths || [],
      failures: [],
      billedRequests: session.billed_requests || 1,
      modelId: session.model_id || "sam-3.1",
      latencyMs: session.latency_ms || 0,
      mode: "persisted",
    };

    setResult(restoredResult);
    setActiveRunId(session.id);
    setReloadedSessionNotice(
      `Reloaded session from ${new Date(session.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • Processed in ${session.latency_ms ? `${(session.latency_ms / 1000).toFixed(2)}s (${session.latency_ms}ms)` : "N/A"}`
    );
  }

  function colorFor(label: string) {
    const idx = result?.objectConcepts.indexOf(label) ?? -1;
    return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
  }

  function styleFor(label: string): MaskStyle {
    return maskStyles[label] ?? { color: colorFor(label), ...DEFAULT_MASK_STYLE };
  }

  function updateStyle(label: string, patch: Partial<MaskStyle>) {
    setMaskStyles((prev) => ({
      ...prev,
      [label]: {
        ...(prev[label] ?? { color: colorFor(label), ...DEFAULT_MASK_STYLE }),
        ...patch,
      },
    }));
  }

  // Active bounding boxes nearest playhead
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

  // Isolate logic: when isolatedLabel set, only that label is visible + black bg highlight
  const effectiveVisibleBoxes = isolatedLabel
    ? activeBoxes.filter((b) => b.label === isolatedLabel)
    : activeBoxes.filter((b) => styleFor(b.label).visible);
  const visibleActiveBoxes = effectiveVisibleBoxes;
  const activeFrames = new Set(visibleActiveBoxes.map((b) => b.frameIndex));
  const activePaths = (result?.svgPaths ?? []).filter((p) => {
    if (isolatedLabel) return p.label === isolatedLabel && activeFrames.has(p.frameIndex);
    return activeFrames.has(p.frameIndex) && styleFor(p.label ?? visibleActiveBoxes[0]?.label ?? "").visible;
  });

  const activeTargetCount = prompt.trim()
    ? prompt.split(",").filter((s) => s.trim().length > 0).length
    : 0;

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const snapshotCanvasRef = useRef<HTMLCanvasElement>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  const isolatedOverlayD = useMemo(() => {
    if (!isolatedLabel) return null;
    if (activePaths.length > 0) return activePaths.map((p) => p.path).join(" ");
    if (visibleActiveBoxes.length > 0) {
      return visibleActiveBoxes
        .map((b) => {
          const [ymin, xmin, ymax, xmax] = b.box;
          return `M${xmin} ${ymin} H${xmax} V${ymax} H${xmin} Z`;
        })
        .join(" ");
    }
    return null;
  }, [isolatedLabel, activePaths, visibleActiveBoxes]);

  function toggleVideoPlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }

  function handleSnapshot() {
    const v = videoRef.current;
    const c = snapshotCanvasRef.current;
    if (!v || !c) return;
    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    const url = c.toDataURL("image/jpeg", 0.92);
    setSnapshotUrl(url);
  }

  function downloadSnapshot() {
    if (!snapshotUrl) return;
    const a = document.createElement("a");
    a.href = snapshotUrl;
    a.download = `isolated-${isolatedLabel ?? "frame"}-${Date.now()}.jpg`;
    a.click();
  }

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100 relative pb-10"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-6">
          <div className="w-full max-w-lg rounded-2xl border-2 border-dashed border-teal-400 bg-zinc-900 p-10 text-center space-y-3 shadow-2xl">
            <div className="mx-auto w-12 h-12 rounded-xl bg-teal-950 border border-teal-500/40 text-teal-300 flex items-center justify-center">
              <UploadCloud className="w-6 h-6 animate-bounce" />
            </div>
            <p className="text-sm font-semibold text-zinc-100">Drop therapy video to load</p>
            <p className="text-xs text-zinc-400">MP4 / WebM up to 100 MB</p>
          </div>
        </div>
      )}

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/therapist/dashboard" className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors shrink-0">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <span className="hidden sm:block h-5 w-px bg-zinc-800 shrink-0" aria-hidden />
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
              <Beaker className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight text-zinc-100 leading-none flex items-center gap-2">
                SAM 3.1 Workspace
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-950 border border-teal-500/30 text-teal-300">7 Engines • 100 targets</span>
              </h1>
              <p className="hidden sm:block text-[11px] text-zinc-500 leading-none mt-1 truncate">Pediatric → Geriatrics • Home • School • Kitchen</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={fetchPastSessions} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white hover:border-zinc-700 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPastSessions ? "animate-spin text-teal-400" : "text-zinc-500"}`} /> <span className="hidden sm:inline">Reload</span>
            </button>
            <Link href="/aruga-guide" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors">
              <Sparkles className="w-3.5 h-3.5" /> Guide
            </Link>
            <a href="/docs/SAM_ENGINE_KEYWORDS.md" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium bg-teal-950/60 border border-teal-500/30 text-teal-300 hover:bg-teal-900/60 transition-colors">
              <BookOpen className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Keywords</span>
            </a>
          </div>
        </div>
      </header>

      {/* Stepper Nav */}
      <div className="sticky top-14 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-11 flex items-center gap-1 overflow-x-auto scrollbar-none">
          {[
            { id: "engines", label: "Engine", icon: Layers, sub: selectedEngine === "custom" ? "Custom" : SAM_ENGINES[selectedEngine as SamEngineCategory]?.name ?? "Custom" },
            { id: "video", label: "Video", icon: Film, sub: previewUrl ? fileName.slice(0,18) : "Upload" },
            { id: "payload", label: "Payload", icon: Target, sub: `${activeTargetCount} targets` },
            { id: "results", label: "Results", icon: Eye, sub: result ? `${result.tracks.length} found` : "—" },
          ].map((s) => (
            <a key={s.id} href={`#${s.id}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors shrink-0">
              <s.icon className="w-3.5 h-3.5 text-zinc-500" />
              <span className="font-semibold">{s.label}</span>
              <span className="hidden sm:inline text-zinc-600">•</span>
              <span className="hidden sm:inline text-zinc-500 truncate max-w-[120px]">{s.sub}</span>
            </a>
          ))}
          <span className="ml-auto hidden lg:inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Timer className="w-3 h-3" /> {result ? `${(result.latencyMs/1000).toFixed(2)}s` : "No run yet"}
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">

        {/* 1. ENGINE SELECTOR — sleek grouped cards */}
        <section id="engines" className="scroll-mt-28 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-widest uppercase text-zinc-400 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center"><Activity className="w-3.5 h-3.5 text-teal-400" /></span>
              Choose Engine
            </h2>
            <span className="text-xs text-zinc-500">8 options • 100 targets each</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tracking-wide uppercase text-zinc-500">Lifespan</span>
              <span className="h-px flex-1 bg-zinc-800" />
              <span className="text-[11px] text-zinc-600">1 → 55+</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(["pedia", "adolescent", "adult", "old_people"] as const).map((key) => {
                const conf = ENGINE_CONFIGS[key];
                const Icon = conf.icon;
                const isSelected = selectedEngine === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectEngine(key)}
                    className={`group relative p-4 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? "bg-zinc-900 border-teal-500/50 ring-1 ring-teal-500/30 shadow-md"
                        : "bg-zinc-900/60 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${isSelected ? "bg-teal-950 border-teal-500/30 text-teal-300" : "bg-zinc-800 border-zinc-700 text-zinc-400 group-hover:text-zinc-200"}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${isSelected ? "bg-teal-950 text-teal-300 border-teal-500/30" : "bg-zinc-800 text-zinc-500 border-zinc-700"}`}>100</span>
                    </div>
                    <div className={`mt-3 text-sm font-semibold ${isSelected ? "text-zinc-100" : "text-zinc-200"}`}>{conf.title}</div>
                    <div className="text-xs text-zinc-500">{conf.subtext}</div>
                    <div className="mt-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 border border-zinc-700 text-zinc-400">{conf.ageRange}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-semibold tracking-wide uppercase text-zinc-500">Environment</span>
              <span className="h-px flex-1 bg-zinc-800" />
              <span className="text-[11px] text-zinc-600">Home • School • Kitchen</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(["home_objects", "school_objects", "kitchen_items"] as const).map((key) => {
                const conf = ENGINE_CONFIGS[key];
                const Icon = conf.icon;
                const isSelected = selectedEngine === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectEngine(key)}
                    className={`group relative p-4 rounded-2xl border text-left transition-all ${
                      isSelected ? "bg-zinc-900 border-teal-500/50 ring-1 ring-teal-500/30 shadow-md" : "bg-zinc-900/60 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${isSelected ? "bg-teal-950 border-teal-500/30 text-teal-300" : "bg-zinc-800 border-zinc-700 text-zinc-400 group-hover:text-zinc-200"}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${isSelected ? "bg-teal-950 text-teal-300 border-teal-500/30" : "bg-zinc-800 text-zinc-500 border-zinc-700"}`}>100</span>
                    </div>
                    <div className={`mt-3 text-sm font-semibold ${isSelected ? "text-zinc-100" : "text-zinc-200"}`}>{conf.title}</div>
                    <div className="text-xs text-zinc-500">{conf.subtext}</div>
                    <div className="mt-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 border border-zinc-700 text-zinc-400">{conf.ageRange}</div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => handleSelectEngine("custom")}
                className={`group relative p-4 rounded-2xl border text-left transition-all ${
                  selectedEngine === "custom" ? "bg-zinc-900 border-teal-500/50 ring-1 ring-teal-500/30 shadow-md" : "bg-zinc-900/60 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${selectedEngine === "custom" ? "bg-teal-950 border-teal-500/30 text-teal-300" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>
                    <Sliders className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-zinc-800 text-zinc-500 border border-zinc-700">Free</span>
                </div>
                <div className="mt-3 text-sm font-semibold text-zinc-200">Custom</div>
                <div className="text-xs text-zinc-500">Manual targets</div>
                <div className="mt-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 border border-zinc-700 text-zinc-400">Freeform</div>
              </button>
            </div>
          </div>
        </section>

        {/* 2. ACTIVE ENGINE PROFILE & TARGET CONTROLS */}
        {currentEngineMeta && (
          <Card className="p-5 space-y-4 border-zinc-800 bg-zinc-900/70">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-100">{currentEngineMeta.name}</span>
                  <span className="text-xs text-zinc-500">• {currentEngineMeta.ageRange}</span>
                  <Badge variant="teal" className="font-mono text-[11px]">{selectedKeywords.size} / {currentEngineMeta.targetCount} active</Badge>
                </div>
                <div className="text-xs text-zinc-500 flex flex-wrap gap-x-2 gap-y-1 leading-relaxed">
                  <span><span className="font-semibold text-zinc-400">OT:</span> {currentEngineMeta.clinicalConditions.occupationalTherapy.slice(0, 3).join(", ")}</span>
                  <span className="text-zinc-700">•</span>
                  <span><span className="font-semibold text-zinc-400">PT:</span> {currentEngineMeta.clinicalConditions.physicalTherapy.slice(0, 3).join(", ")}</span>
                  <span className="text-zinc-700">•</span>
                  <span><span className="font-semibold text-zinc-400">SLP:</span> {currentEngineMeta.clinicalConditions.speechPathology.slice(0, 3).join(", ")}</span>
                </div>
              </div>
              <div className="flex items-center flex-wrap gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={handleSelectAllEngineKeywords} className="h-8 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200">All 100</Button>
                <Button variant="outline" size="sm" onClick={() => handleSelectDisciplineKeywords("OT")} className="h-8 text-xs border-teal-500/30 bg-teal-950/50 hover:bg-teal-900/50 text-teal-300">OT</Button>
                <Button variant="outline" size="sm" onClick={() => handleSelectDisciplineKeywords("PT")} className="h-8 text-xs border-sky-500/30 bg-sky-950/50 hover:bg-sky-900/50 text-sky-300">PT</Button>
                <Button variant="outline" size="sm" onClick={() => handleSelectDisciplineKeywords("SLP")} className="h-8 text-xs border-violet-500/30 bg-violet-950/50 hover:bg-violet-900/50 text-violet-300">SLP</Button>
                <Button variant="ghost" size="sm" onClick={handleClearKeywords} className="h-8 text-xs text-zinc-400 hover:text-zinc-100">Clear</Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search targets or clinical context…" className="w-full h-9 pl-9 pr-8 rounded-xl text-sm bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20" />
                  {searchQuery && <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center text-xs">✕</button>}
                </div>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800 shrink-0 overflow-x-auto">
                  {(["ALL", "OT", "PT", "SLP", "Interdisciplinary"] as const).map((disc) => (
                    <button key={disc} type="button" onClick={() => setDisciplineFilter(disc)} className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${disciplineFilter === disc ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}>{disc}</button>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsInspectorExpanded(!isInspectorExpanded)} className="h-9 gap-1.5 border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100 shrink-0">
                  {isInspectorExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} {isInspectorExpanded ? "Hide" : "Show"}
                </Button>
              </div>
              {isInspectorExpanded && (
                <div className="space-y-3">
                  <div className="max-h-52 overflow-y-auto p-3 rounded-xl border border-zinc-800 bg-zinc-950 flex flex-wrap gap-2">
                    {filteredEngineItems.map((item) => {
                      const isSelected = selectedKeywords.has(item.keyword);
                      const discStyle = { OT: "border-teal-500/30 text-teal-300 bg-teal-950/30", PT: "border-sky-500/30 text-sky-300 bg-sky-950/30", SLP: "border-violet-500/30 text-violet-300 bg-violet-950/30", Interdisciplinary: "border-emerald-500/30 text-emerald-300 bg-emerald-950/30" }[item.discipline];
                      return (
                        <button key={item.keyword} type="button" onClick={() => handleToggleKeyword(item.keyword)} onMouseEnter={() => setInspectedItem(item)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${isSelected ? `${discStyle} shadow-sm` : "border-zinc-800 text-zinc-500 bg-zinc-900 hover:border-zinc-700 hover:text-zinc-300"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-current" : "bg-zinc-600"}`} />
                          {item.keyword}
                          {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                        </button>
                      );
                    })}
                    {filteredEngineItems.length === 0 && <div className="w-full py-6 text-center text-xs text-zinc-500">No matches for “{searchQuery}”</div>}
                  </div>
                  {inspectedItem && (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-teal-300">{inspectedItem.keyword}</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 border border-zinc-700 text-zinc-300">{inspectedItem.discipline} • {inspectedItem.otpfCategory}</span>
                      </div>
                      <span className="text-zinc-400 max-w-md text-right">{inspectedItem.clinicalContext}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* 3 + 4 — VIDEO & PAYLOAD in two-column sleek layout */}
        <div id="video" className="scroll-mt-28 grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="lg:col-span-3 p-0 overflow-hidden border-zinc-800 bg-zinc-900/70">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wide uppercase text-zinc-300 flex items-center gap-2"><Film className="w-3.5 h-3.5 text-teal-400" /> Video</h3>
              {previewUrl && <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-7 text-xs border-zinc-700 bg-zinc-800 text-zinc-300">Change</Button>}
            </div>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { handleVideo(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <div className="p-4">
              {!previewUrl ? (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-teal-500/50 bg-zinc-950 hover:bg-zinc-900 p-10 transition-colors group">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-800 group-hover:bg-teal-950 border border-zinc-700 group-hover:border-teal-500/30 text-zinc-500 group-hover:text-teal-400 flex items-center justify-center transition-colors">
                    {isReading ? <Loader2 className="w-6 h-6 animate-spin text-teal-400" /> : <Upload className="w-6 h-6" />}
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-sm font-semibold text-zinc-100">{isReading ? "Reading video…" : "Drop or select therapy video"}</div>
                    <div className="text-xs text-zinc-500">MP4 / WebM • max 100 MB • drag & drop supported</div>
                  </div>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs">
                    <FileVideo className="w-4 h-4 text-teal-400 shrink-0" />
                    <span className="font-medium text-zinc-200 truncate">{fileName}</span>
                    {videoSize && <span className="text-zinc-500">• {videoSize.width}×{videoSize.height}{durationSeconds ? ` • ${Math.round(durationSeconds)}s` : ""}</span>}
                  </div>
                  <div className="relative overflow-hidden rounded-2xl bg-black border border-zinc-800">
                    <div className="relative w-full bg-black">
                      <video
                        ref={videoRef}
                        src={previewUrl}
                        playsInline
                        controls={!isolatedLabel}
                        className="block w-full h-auto bg-black max-h-[420px] mx-auto object-contain"
                        onLoadedMetadata={(e) => {
                          setDurationSeconds(e.currentTarget.duration || undefined);
                          setVideoSize({ width: e.currentTarget.videoWidth || 0, height: e.currentTarget.videoHeight || 0 });
                        }}
                        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                        onPlay={() => setIsVideoPlaying(true)}
                        onPause={() => setIsVideoPlaying(false)}
                        onEnded={() => setIsVideoPlaying(false)}
                      />
                      {/* Normal overlay: masks + boxes */}
                      {visibleActiveBoxes.length > 0 && !isolatedLabel && (
                        <div className="absolute inset-0 pointer-events-none">
                          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1 1" preserveAspectRatio="none">
                            {activePaths.map((p, i) => { const style = styleFor(p.label ?? visibleActiveBoxes[0]?.label ?? ""); return (<path key={`${p.frameIndex}-${i}`} d={p.path} fill={style.color} fillOpacity={style.fillOpacity} stroke={style.color} strokeWidth={Math.max(0.0005, style.strokeWidth * 0.001)} />); })}
                          </svg>
                          {visibleActiveBoxes.map((b) => { const [ymin, xmin, ymax, xmax] = b.box; const style = styleFor(b.label); return (<div key={`${b.label}-${b.objectId ?? ""}-${b.frameIndex}`} className="absolute rounded" style={{ top: `${ymin * 100}%`, left: `${xmin * 100}%`, width: `${(xmax - xmin) * 100}%`, height: `${(ymax - ymin) * 100}%`, border: `${style.strokeWidth}px solid ${style.color}` }}><span className="absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[11px] font-mono text-white font-bold whitespace-nowrap shadow" style={{ backgroundColor: style.color }}>{b.label}{b.confidence ? ` ${Math.round(b.confidence * 100)}%` : ""}</span></div>); })}
                        </div>
                      )}
                      {/* Isolate overlay: black backdrop with hole — only segment visible */}
                      {isolatedLabel && isolatedOverlayD && (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
                          <path d={`M0 0 H1 V1 H0 Z ${isolatedOverlayD}`} fill="black" fillOpacity={0.97} fillRule="evenodd" />
                        </svg>
                      )}
                      {isolatedLabel && visibleActiveBoxes.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-none">
                          <span className="text-xs text-zinc-400">No active frame for {isolatedLabel} at this time</span>
                        </div>
                      )}
                      {isolatedLabel && (
                        <div className="absolute bottom-2 left-2 z-10 px-2.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-700 text-xs font-medium text-zinc-100 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: styleFor(isolatedLabel).color }} /> Isolated: {isolatedLabel}
                          <button type="button" onClick={() => setIsolatedLabel(null)} className="ml-1 px-2 py-0.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px]">Clear</button>
                        </div>
                      )}
                    </div>
                    {/* Isolate custom controls — outside overlay so always clickable */}
                    {isolatedLabel && previewUrl && (
                      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-zinc-900 border-t border-zinc-800">
                        <Button variant="outline" size="sm" onClick={toggleVideoPlay} className="h-7 text-xs gap-1.5 border-zinc-700 bg-zinc-800 text-zinc-100">
                          {isVideoPlaying ? <span className="w-3 h-3 flex items-center justify-center">❚❚</span> : <Play className="w-3 h-3 fill-current" />} {isVideoPlaying ? "Pause" : "Play"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { const v = videoRef.current; if (v) { v.currentTime = 0; v.play(); } }} className="h-7 text-xs border-zinc-700 bg-zinc-800 text-zinc-300">Replay</Button>
                        <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                          <span className="text-[11px] font-mono text-zinc-500">{Math.floor(currentTime)}s</span>
                          <input
                            type="range"
                            min={0}
                            max={durationSeconds ?? 100}
                            step={0.1}
                            value={currentTime}
                            onChange={(e) => { const v = videoRef.current; if (v) v.currentTime = Number(e.target.value); }}
                            className="flex-1 accent-teal-500 h-1"
                          />
                          <span className="text-[11px] font-mono text-zinc-500">{durationSeconds ? `${Math.round(durationSeconds)}s` : "--"}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleSnapshot} className="h-7 text-xs gap-1.5 border-teal-500/30 bg-teal-950/40 text-teal-300">Snapshot photo</Button>
                        {snapshotUrl && <Button variant="outline" size="sm" onClick={downloadSnapshot} className="h-7 text-xs border-zinc-700 bg-zinc-900 text-zinc-300">Download</Button>}
                      </div>
                    )}
                    {/* Hidden canvas for snapshots */}
                    <canvas ref={snapshotCanvasRef} className="hidden" />
                    {snapshotUrl && (
                      <div className="p-3 bg-zinc-900 border-t border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-zinc-300">Snapshot</span>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={downloadSnapshot} className="h-7 text-xs border-zinc-700 bg-zinc-800 text-zinc-300">Download JPG</Button>
                            <button type="button" onClick={() => setSnapshotUrl(null)} className="text-xs text-zinc-500 hover:text-zinc-300">Clear</button>
                          </div>
                        </div>
                        <img src={snapshotUrl} alt="Snapshot" className="w-full rounded-xl border border-zinc-800 bg-black object-contain max-h-56" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card id="payload" className="lg:col-span-2 p-0 overflow-hidden border-zinc-800 bg-zinc-900/70 flex flex-col scroll-mt-28">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold tracking-wide uppercase text-zinc-300 flex items-center gap-2"><Target className="w-3.5 h-3.5 text-teal-400" /> Payload</h3>
              <Badge variant="teal" className="font-mono text-[11px]">{activeTargetCount} targets</Badge>
            </div>
            <div className="p-4 space-y-3 flex-1 flex flex-col">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyPayload} className="h-7 text-xs gap-1.5 border-zinc-700 bg-zinc-800 text-zinc-300"><Copy className="w-3 h-3" />{copiedPayload ? "Copied!" : "Copy"}</Button>
                {currentEngineMeta && <Button variant="ghost" size="sm" onClick={handleSelectAllEngineKeywords} className="h-7 text-xs gap-1.5 text-zinc-400"><RotateCcw className="w-3 h-3" />Reset 100</Button>}
              </div>
              <textarea rows={6} value={prompt} onChange={(e) => { setPrompt(e.target.value); const items = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); setSelectedKeywords(new Set(items)); }} placeholder="cup, hand, fork, spoon…" className="flex-1 min-h-[120px] rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 font-mono leading-relaxed resize-none" />
              <Button onClick={handleTrack} disabled={!videoDataUrl || activeTargetCount === 0 || isTracking || isReading} className="w-full h-11 gap-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-sm">
                {isTracking ? <><Loader2 className="w-4 h-4 animate-spin" /> Tracking…</> : <><Play className="w-4 h-4 fill-current" /> Test {selectedEngine === "custom" ? "Custom" : SAM_ENGINES[selectedEngine as SamEngineCategory]?.name} ({activeTargetCount})</>}
              </Button>
              {!videoDataUrl && <p className="text-xs text-zinc-500 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Upload video to enable tracking</p>}
            </div>
          </Card>
        </div>

        {/* Reloaded Session Toast Notice */}
        {reloadedSessionNotice && (
          <div className="rounded-xl border border-teal-500/50 bg-teal-950/40 px-4 py-2.5 text-xs text-teal-300 flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-400" />
              <span>{reloadedSessionNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setReloadedSessionNotice(null)}
              className="text-teal-400 hover:text-teal-200 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="rounded-xl border border-red-800/60 bg-red-950/30 p-3.5 text-xs text-red-300 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 5. MULTI-ENGINE TEST RUNS COMPARISON SWITCHER */}
        {testRuns.length > 0 && (
          <Card className="p-4 space-y-3 border-zinc-800 bg-zinc-900/60">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wide uppercase text-zinc-300 flex items-center gap-2"><Layers className="w-3.5 h-3.5 text-teal-400" /> Runs ({testRuns.length})</h3>
              <span className="text-xs text-zinc-500 hidden sm:inline">Click to compare overlays</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {testRuns.map((run, idx) => {
                const isActive = activeRunId === run.id;
                return (
                  <button key={run.id} type="button" onClick={() => handleSelectRun(run)} className={`px-4 py-2.5 rounded-xl text-left border shrink-0 transition-all ${isActive ? "bg-zinc-800 border-teal-500/50 text-zinc-100 shadow-sm" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"}`}>
                    <div className="text-xs font-semibold">Run #{testRuns.length - idx} • {run.engineName}</div>
                    <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2"><span>{run.detectedCount}/{run.targetCount} found</span><span className="text-zinc-600">•</span><span className="font-mono text-teal-400">{run.latencyMs ? `${(run.latencyMs / 1000).toFixed(2)}s` : ""}</span></div>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* 6. DETECTION RESULTS */}
        {result && (
          <Card id="results" className="p-5 space-y-4 border-zinc-800 bg-zinc-900/70 scroll-mt-28">
            {savedToDb && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950/60 border border-teal-500/40 text-teal-300 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>
                  Tracking session successfully saved to database under your profile
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-100">Detections — {selectedEngine === "custom" ? "Custom" : SAM_ENGINES[selectedEngine as SamEngineCategory]?.name}</h3>
                <Badge variant="teal" className="font-mono text-xs">{result.tracks.length} tracked</Badge>
                <Badge variant="outline" className="font-mono text-xs border-zinc-700 text-zinc-400">{result.boxes.length} boxes</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-950/60 border border-teal-500/30 text-teal-300 text-xs font-mono font-medium"><Timer className="w-3.5 h-3.5" /> {(result.latencyMs / 1000).toFixed(2)}s • {result.latencyMs} ms</span>
                <span className="hidden sm:inline text-xs text-zinc-500">{result.modelId} • {result.billedRequests} req</span>
              </div>
            </div>

            {result.tracks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.tracks.map((t) => (
                  <span key={t.trackId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-950 border font-mono" style={{ borderColor: colorFor(t.label), color: colorFor(t.label) }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorFor(t.label) }} /> {t.label} <span className="opacity-60 text-[11px]">• {t.frames.length} fr</span>
                  </span>
                ))}
              </div>
            )}

            {result.objectConcepts.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300"><Settings2 className="w-3.5 h-3.5 text-zinc-500" /> Mask Appearance</div>
                  {isolatedLabel && <button type="button" onClick={() => setIsolatedLabel(null)} className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-300">Clear isolate</button>}
                </div>
                <div className="divide-y divide-zinc-800">
                  {result.objectConcepts.map((label) => {
                    const style = styleFor(label);
                    const isIsolated = isolatedLabel === label;
                    return (
                      <div key={label} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${isIsolated ? "bg-teal-950/20 -mx-2 px-2 rounded-lg border border-teal-500/20" : ""}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: style.color }} />
                          <span className="text-sm font-medium text-zinc-200 font-mono truncate">{label}</span>
                          {isIsolated && <span className="px-1.5 py-0.5 rounded-full bg-teal-950 border border-teal-500/30 text-teal-300 text-[10px] font-semibold">ISOLATED</span>}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button variant={isIsolated ? "default" : "outline"} size="sm" onClick={() => setIsolatedLabel(isIsolated ? null : label)} className={`h-7 text-xs gap-1 ${isIsolated ? "bg-teal-600 hover:bg-teal-500 text-white" : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}><Eye className="w-3 h-3" /> {isIsolated ? "Isolating" : "Isolate"}</Button>
                          <Button variant="outline" size="sm" disabled className="h-7 text-xs border-zinc-800 text-zinc-500 cursor-not-allowed" title="Render coming soon">Download MP4</Button>
                          <input type="color" value={style.color} onChange={(e) => updateStyle(label, { color: e.target.value })} className="w-7 h-7 rounded-lg bg-transparent cursor-pointer" />
                          <label className="flex items-center gap-2 text-xs text-zinc-400">Fill <input type="range" min={0} max={1} step={0.05} value={style.fillOpacity} onChange={(e) => updateStyle(label, { fillOpacity: Number(e.target.value) })} className="w-20 accent-teal-500" /><span className="font-mono w-8 text-right">{Math.round(style.fillOpacity * 100)}%</span></label>
                          <label className="flex items-center gap-2 text-xs text-zinc-400">Border <input type="range" min={0} max={6} step={0.5} value={style.strokeWidth} onChange={(e) => updateStyle(label, { strokeWidth: Number(e.target.value) })} className="w-20 accent-teal-500" /><span className="font-mono w-7 text-right">{style.strokeWidth}px</span></label>
                          <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer"><input type="checkbox" checked={style.visible} onChange={(e) => updateStyle(label, { visible: e.target.checked })} className="accent-teal-500 rounded" /> Show</label>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {isolatedLabel && <p className="text-xs text-zinc-500 flex items-center gap-1.5"><Info className="w-3 h-3" /> Black background isolate is dynamic (no re-render). Use Download when render service is enabled.</p>}
              </div>
            )}

            {/* Zero detection or failures */}
            {result.failures.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="text-xs font-semibold text-red-400">
                  Concept Tracking Warnings:
                </span>
                {result.failures.map((f) => (
                  <p key={f.concept} className="text-xs text-red-300">
                    • <strong>{f.concept}:</strong> {f.message}
                  </p>
                ))}
              </div>
            )}

            {result.boxes.length === 0 && result.failures.length === 0 && (
              <div className="text-center py-6 text-xs text-zinc-500">
                No target objects from the active payload were located in this video.
                Try selecting a different engine or checking a video featuring therapy equipment.
              </div>
            )}
          </Card>
        )}

        {/* 7. PREVIOUS PROCESSED SESSIONS */}
        <Card className="p-5 space-y-4 border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-zinc-800">
            <h3 className="text-xs font-semibold tracking-wide uppercase text-zinc-300 flex items-center gap-2"><History className="w-4 h-4 text-teal-400" /> History • {pastSessions.length} sessions</h3>
            <Button variant="outline" size="sm" onClick={fetchPastSessions} className="h-8 text-xs gap-1.5 border-zinc-700 bg-zinc-800 text-zinc-300"><RefreshCw className={`w-3.5 h-3.5 ${isLoadingPastSessions ? "animate-spin" : ""}`} /> Reload</Button>
          </div>

          {isLoadingPastSessions && pastSessions.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
              <span>Loading saved tracking sessions...</span>
            </div>
          ) : pastSessions.length === 0 ? (
            <div className="text-center py-6 text-xs text-zinc-500">
              No previous processed sessions found yet. Run a tracking test above to record your first session.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
              {pastSessions.map((sess) => {
                const date = new Date(sess.created_at);
                const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
                const detectedCount = sess.tracks?.length || 0;
                const conceptCount = sess.prompt.split(",").filter((s) => s.trim().length > 0).length;

                return (
                  <div
                    key={sess.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-zinc-800/90 bg-zinc-950/70 hover:border-zinc-700 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-zinc-200">
                          {sess.file_name || "video.mp4"}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {dateStr} at {timeStr}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-teal-950/80 text-teal-300 border border-teal-500/30">
                          {detectedCount} detected / {conceptCount} targets
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-mono truncate max-w-xl">
                        {sess.prompt}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-500 block">Processing Time</span>
                        <span className="text-xs font-mono font-medium text-teal-300">
                          {sess.latency_ms ? `${(sess.latency_ms / 1000).toFixed(2)}s` : "N/A"}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleReloadSession(sess)}
                        className="gap-1.5 bg-zinc-800 hover:bg-teal-600 hover:text-zinc-950 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reload</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
