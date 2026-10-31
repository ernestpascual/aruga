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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
    title: "Old People",
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

  const visibleActiveBoxes = activeBoxes.filter((b) => styleFor(b.label).visible);
  const activeFrames = new Set(visibleActiveBoxes.map((b) => b.frameIndex));
  const activePaths = (result?.svgPaths ?? []).filter(
    (p) =>
      activeFrames.has(p.frameIndex) &&
      styleFor(p.label ?? visibleActiveBoxes[0]?.label ?? "").visible
  );

  const activeTargetCount = prompt.trim()
    ? prompt.split(",").filter((s) => s.trim().length > 0).length
    : 0;

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100 relative pb-20"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-6">
          <div className="w-full max-w-lg rounded-2xl border-2 border-dashed border-teal-400 bg-zinc-900/95 p-10 text-center space-y-3 shadow-2xl">
            <div className="mx-auto w-12 h-12 rounded-xl bg-teal-950 border border-teal-500/50 text-teal-300 flex items-center justify-center">
              <UploadCloud className="w-6 h-6 animate-bounce" />
            </div>
            <p className="text-base font-bold text-zinc-100">Drop therapy video to load</p>
            <p className="text-xs text-zinc-400">
              Supports MP4 and WebM clips up to 100MB
            </p>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 sm:px-6 py-5 max-w-5xl space-y-6">
        {/* Top Navigation & Workspace Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/therapist/dashboard"
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Dashboard
              </Link>
              <span className="text-zinc-600">/</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-950/80 text-teal-300 border border-teal-500/40">
                SAM 3.1 Workspace
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-50 flex items-center gap-2">
              <span>Meta SAM 3.1 Testing Workspace</span>
              <span className="text-xs font-normal text-zinc-400 border border-zinc-800 px-2 py-0.5 rounded-md bg-zinc-900">
                7 Clinical Engines
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Switch between 100-keyword clinical engines across the lifespan (Pediatric, Adolescent, Adult, Old People) and everyday environments (Home, School, Kitchen).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchPastSessions}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors"
              title="Reload previous processed sessions from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPastSessions ? "animate-spin text-teal-400" : ""}`} />
              <span>Reload Sessions</span>
            </button>
            <Link
              href="/ask-ot"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-zinc-800 transition-colors"
            >
              Ask OT
            </Link>
            <a
              href="/docs/SAM_ENGINE_KEYWORDS.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-teal-400 bg-teal-950/40 border border-teal-500/30 hover:bg-teal-900/40 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Keywords Guide</span>
            </a>
          </div>
        </div>

        {/* 1. PRIMARY ENGINE SWITCHER TABS */}
        <div className="space-y-4">
          {/* Lifespan Demographic Care Engines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-teal-400" />
                <span>Lifespan Demographic Engines (100 Targets Each)</span>
              </label>
              <span className="text-[11px] text-zinc-500">
                Ages 1 to 55+
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(["pedia", "adolescent", "adult", "old_people"] as const).map((key) => {
                const conf = ENGINE_CONFIGS[key];
                const Icon = conf.icon;
                const isSelected = selectedEngine === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectEngine(key)}
                    className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? conf.activeClass
                        : "bg-zinc-900/60 border-zinc-800/90 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-zinc-100">
                        <Icon className="w-4 h-4 shrink-0 text-current" />
                        <span>{conf.title}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${conf.badgeClass}`}>
                        100
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 font-medium">{conf.ageRange}</div>
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                      {conf.subtext}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Environmental & Contextual Engines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Environmental & Contextual Engines (100 Targets Each)</span>
              </label>
              <span className="text-[11px] text-zinc-500">
                Home • School • Kitchen
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(["home_objects", "school_objects", "kitchen_items"] as const).map((key) => {
                const conf = ENGINE_CONFIGS[key];
                const Icon = conf.icon;
                const isSelected = selectedEngine === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectEngine(key)}
                    className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? conf.activeClass
                        : "bg-zinc-900/60 border-zinc-800/90 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-zinc-100">
                        <Icon className="w-4 h-4 shrink-0 text-current" />
                        <span>{conf.title}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${conf.badgeClass}`}>
                        100
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 font-medium">{conf.ageRange}</div>
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                      {conf.subtext}
                    </div>
                  </button>
                );
              })}

              {/* Custom Freeform Prompt Tab */}
              <button
                type="button"
                onClick={() => handleSelectEngine("custom")}
                className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  selectedEngine === "custom"
                    ? "bg-zinc-800/90 border-teal-400 ring-1 ring-teal-400/40 text-zinc-100 shadow-lg"
                    : "bg-zinc-900/60 border-zinc-800/90 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-zinc-200">
                    <Sliders className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>Custom</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-400">
                    Free
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 font-medium">Freeform</div>
                <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                  Manual Custom Targets
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* 2. ACTIVE ENGINE PROFILE & TARGET CONTROLS */}
        {currentEngineMeta && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4 shadow-sm">
            {/* Header info row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-3 border-b border-zinc-800/80">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-100">
                    {currentEngineMeta.name}
                  </span>
                  <span className="text-xs text-zinc-400">
                    ({currentEngineMeta.ageRange})
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-teal-950/70 text-teal-300 border border-teal-500/40">
                    {selectedKeywords.size} of {currentEngineMeta.targetCount} Targets Active
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 flex flex-wrap gap-x-3 gap-y-1">
                  <span>
                    <strong className="text-zinc-300">OT:</strong>{" "}
                    {currentEngineMeta.clinicalConditions.occupationalTherapy.slice(0, 3).join(", ")}
                  </span>
                  <span>•</span>
                  <span>
                    <strong className="text-zinc-300">PT:</strong>{" "}
                    {currentEngineMeta.clinicalConditions.physicalTherapy.slice(0, 3).join(", ")}
                  </span>
                  <span>•</span>
                  <span>
                    <strong className="text-zinc-300">SLP:</strong>{" "}
                    {currentEngineMeta.clinicalConditions.speechPathology.slice(0, 3).join(", ")}
                  </span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllEngineKeywords}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                >
                  All 100 Targets
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectDisciplineKeywords("OT")}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-teal-950/60 hover:bg-teal-900/80 text-teal-300 border border-teal-500/40 transition-colors"
                >
                  OT Only
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectDisciplineKeywords("PT")}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border border-sky-500/40 transition-colors"
                >
                  PT Only
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectDisciplineKeywords("SLP")}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-500/40 transition-colors"
                >
                  SLP Only
                </button>
                <button
                  type="button"
                  onClick={handleClearKeywords}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                  title="Clear all targets"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Keyword Inspector Filter Bar */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search ${currentEngineMeta.keywords.length} targets or clinical contexts...`}
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Discipline Filter Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  <span className="text-[11px] text-zinc-500 mr-1 hidden sm:inline">
                    Discipline:
                  </span>
                  {(["ALL", "OT", "PT", "SLP", "Interdisciplinary"] as const).map((disc) => (
                    <button
                      key={disc}
                      type="button"
                      onClick={() => setDisciplineFilter(disc)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        disciplineFilter === disc
                          ? "bg-zinc-800 text-teal-300 border border-teal-500/40"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                      }`}
                    >
                      {disc}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsInspectorExpanded(!isInspectorExpanded)}
                    className="ml-2 px-2 py-1 rounded-md text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-800/40 hover:bg-zinc-800 flex items-center gap-1 transition-colors"
                  >
                    <span>{isInspectorExpanded ? "Collapse" : "Expand"}</span>
                    {isInspectorExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* Collapsible Interactive Keyword Chip Gallery */}
              {isInspectorExpanded && (
                <div className="space-y-2">
                  <div className="max-h-48 overflow-y-auto p-2.5 rounded-xl border border-zinc-800/90 bg-zinc-950/70 flex flex-wrap gap-1.5 scrollbar-thin scrollbar-thumb-zinc-800">
                    {filteredEngineItems.map((item) => {
                      const isSelected = selectedKeywords.has(item.keyword);
                      const discBadgeColors = {
                        OT: "border-teal-500/40 text-teal-300 bg-teal-950/40",
                        PT: "border-sky-500/40 text-sky-300 bg-sky-950/40",
                        SLP: "border-purple-500/40 text-purple-300 bg-purple-950/40",
                        Interdisciplinary:
                          "border-emerald-500/40 text-emerald-300 bg-emerald-950/40",
                      }[item.discipline];

                      return (
                        <button
                          key={item.keyword}
                          type="button"
                          onClick={() => handleToggleKeyword(item.keyword)}
                          onMouseEnter={() => setInspectedItem(item)}
                          className={`group inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border transition-all ${
                            isSelected
                              ? `${discBadgeColors} font-semibold ring-1 ring-current/20`
                              : "border-zinc-800 text-zinc-500 bg-zinc-900/40 hover:border-zinc-700 hover:text-zinc-300"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? "bg-current" : "bg-zinc-700"
                            }`}
                          />
                          <span>{item.keyword}</span>
                          {isSelected && <Check className="w-2.5 h-2.5 ml-0.5 opacity-80" />}
                        </button>
                      );
                    })}
                    {filteredEngineItems.length === 0 && (
                      <div className="py-4 w-full text-center text-xs text-zinc-500">
                        No targets match &quot;{searchQuery}&quot; under {disciplineFilter} filter.
                      </div>
                    )}
                  </div>

                  {/* Active Inspected Chip Clinical Card */}
                  {inspectedItem && (
                    <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-teal-300">
                          {inspectedItem.keyword}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium">
                          {inspectedItem.discipline} • {inspectedItem.otpfCategory}
                        </span>
                      </div>
                      <span className="text-zinc-400 text-[11px]">
                        {inspectedItem.clinicalContext}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. VIDEO UPLOAD & PLAYBACK AREA */}
        <div className="space-y-3">
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

          {!previewUrl ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-800 hover:border-teal-500/60 bg-zinc-900/30 hover:bg-zinc-900/60 p-8 text-sm text-zinc-300 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-800/80 group-hover:bg-teal-950 border border-zinc-700 group-hover:border-teal-500/50 text-zinc-400 group-hover:text-teal-400 flex items-center justify-center transition-colors">
                {isReading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div className="text-center">
                <span className="font-semibold text-zinc-200">
                  {isReading ? "Reading video..." : "Select or Drop Therapy Video"}
                </span>
                <p className="text-xs text-zinc-500 mt-1">
                  Upload patient rehabilitation clip to test detection with active engine
                </p>
              </div>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                <div className="flex items-center gap-2">
                  <FileVideo className="w-4 h-4 text-teal-400" />
                  <span className="font-medium text-zinc-200 truncate max-w-xs sm:max-w-md">
                    {fileName}
                  </span>
                  {videoSize && (
                    <span className="text-zinc-500 text-[11px]">
                      ({videoSize.width}x{videoSize.height}
                      {durationSeconds ? ` • ${Math.round(durationSeconds)}s` : ""})
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-teal-400 hover:text-teal-300 hover:underline text-xs"
                >
                  Change Video
                </button>
              </div>

              {/* Video Player Container */}
              <div className="relative w-full overflow-hidden rounded-2xl bg-black border border-zinc-800 shadow-xl">
                <video
                  ref={videoRef}
                  src={previewUrl}
                  controls
                  playsInline
                  className="block w-full h-auto bg-black max-h-[520px] mx-auto object-contain"
                  onLoadedMetadata={(e) => {
                    setDurationSeconds(e.currentTarget.duration || undefined);
                    setVideoSize({
                      width: e.currentTarget.videoWidth || 0,
                      height: e.currentTarget.videoHeight || 0,
                    });
                  }}
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                />

                {/* Multi-Target Mask & Bounding Box Overlay */}
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
                            className="absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[11px] font-mono text-zinc-950 font-bold whitespace-nowrap shadow-sm"
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
            </div>
          )}
        </div>

        {/* 4. SAM TARGET PAYLOAD & TEST EXECUTION */}
        <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-200">
                Target Payload (Comma-Separated Single Noun Phrases):
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-teal-400 font-semibold border border-zinc-700">
                {activeTargetCount} Targets Ready
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyPayload}
                className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
                title="Copy payload to clipboard"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedPayload ? "Copied!" : "Copy"}</span>
              </button>
              {currentEngineMeta && (
                <button
                  type="button"
                  onClick={handleSelectAllEngineKeywords}
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
                  title="Reset to 100 engine defaults"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset 100</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                const items = e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                setSelectedKeywords(new Set(items));
              }}
              placeholder="e.g. cup, hand, fork, spoon (select an engine above to test all 100)"
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-teal-500 font-mono leading-relaxed"
            />

            <Button
              onClick={handleTrack}
              disabled={!videoDataUrl || activeTargetCount === 0 || isTracking || isReading}
              className="gap-2 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold shrink-0 self-end sm:self-stretch px-6 py-3 h-auto shadow-lg shadow-teal-950/40"
            >
              {isTracking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Tracking with SAM...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    Test with {selectedEngine === "custom" ? "Custom" : SAM_ENGINES[selectedEngine].name} (
                    {activeTargetCount})
                  </span>
                </>
              )}
            </Button>
          </div>

          {!videoDataUrl && (
            <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>Upload a therapy video above to run detection on these targets.</span>
            </p>
          )}
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
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-semibold text-zinc-200">
                  Current Video Runs ({testRuns.length})
                </span>
              </div>
              <span className="text-[11px] text-zinc-500">
                Click a run to switch overlay & compare detections
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {testRuns.map((run, idx) => {
                const isActive = activeRunId === run.id;
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => handleSelectRun(run)}
                    className={`px-3 py-2 rounded-xl text-left border shrink-0 transition-all flex flex-col gap-0.5 ${
                      isActive
                        ? "bg-zinc-800 border-teal-500 text-teal-200 ring-1 ring-teal-500/40"
                        : "bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <span>Run #{testRuns.length - idx}:</span>
                      <span>{run.engineName}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                      <span>{run.detectedCount} detected / {run.targetCount}</span>
                      <span>•</span>
                      <span className="font-mono text-teal-400">
                        {run.latencyMs ? `${(run.latencyMs / 1000).toFixed(2)}s` : ""}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. DETECTION RESULTS & ACCURATE PROCESSING TIME */}
        {result && (
          <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            {savedToDb && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950/60 border border-teal-500/40 text-teal-300 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>
                  Tracking session successfully saved to Supabase under your profile
                </span>
              </div>
            )}

            {/* Run Summary Meta with Processing Time */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-zinc-100">
                  Detections for &quot;
                  {selectedEngine === "custom"
                    ? "Custom"
                    : SAM_ENGINES[selectedEngine].name}
                  &quot;:
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-teal-950 border border-teal-500/40 text-teal-300">
                  {result.tracks.length} Concepts Tracked
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-800 text-zinc-400">
                  {result.boxes.length} Bounding Boxes
                </span>
              </div>

              {/* Exact processing time highlight */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-950/70 border border-teal-500/40 text-teal-300 text-xs font-mono font-medium">
                  <Timer className="w-3.5 h-3.5 text-teal-400" />
                  <span>
                    Processed in:{" "}
                    <strong>
                      {result.latencyMs ? `${(result.latencyMs / 1000).toFixed(2)}s` : "0s"}
                    </strong>{" "}
                    ({result.latencyMs || 0} ms)
                  </span>
                </div>

                <span className="text-[11px] text-zinc-500 hidden sm:inline">
                  {result.modelId} {result.mode ? `(${result.mode})` : ""} •{" "}
                  {result.billedRequests} billed req
                </span>
              </div>
            </div>

            {/* Tracked Concept Chips */}
            {result.tracks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.tracks.map((t) => (
                  <span
                    key={t.trackId}
                    className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-zinc-950 border flex items-center gap-1.5"
                    style={{
                      borderColor: colorFor(t.label),
                      color: colorFor(t.label),
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: colorFor(t.label) }}
                    />
                    <span>{t.label}</span>
                    <span className="text-[10px] opacity-75">
                      ({t.frames.length} frames)
                    </span>
                  </span>
                ))}
              </div>
            )}

            {/* Per-target mask customizers */}
            {result.objectConcepts.length > 0 && (
              <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-3">
                <span className="text-xs font-semibold text-zinc-300 block">
                  Interactive Mask Appearance (Per-Detected Target)
                </span>
                <div className="space-y-2 pt-1">
                  {result.objectConcepts.map((label) => {
                    const style = styleFor(label);
                    return (
                      <div
                        key={label}
                        className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-300 border-b border-zinc-900 pb-1.5 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center gap-2 w-36 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: style.color }}
                          />
                          <span className="font-mono font-semibold truncate">
                            {label}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 flex-wrap">
                          <input
                            type="color"
                            value={style.color}
                            onChange={(e) =>
                              updateStyle(label, { color: e.target.value })
                            }
                            className="w-6 h-6 bg-transparent cursor-pointer rounded"
                            title="Mask Color"
                          />

                          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                            <span>Fill</span>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={style.fillOpacity}
                              onChange={(e) =>
                                updateStyle(label, {
                                  fillOpacity: Number(e.target.value),
                                })
                              }
                              className="w-16 accent-teal-400"
                            />
                            <span className="font-mono w-7 text-right">
                              {Math.round(style.fillOpacity * 100)}%
                            </span>
                          </label>

                          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                            <span>Border</span>
                            <input
                              type="range"
                              min={0}
                              max={6}
                              step={0.5}
                              value={style.strokeWidth}
                              onChange={(e) =>
                                updateStyle(label, {
                                  strokeWidth: Number(e.target.value),
                                })
                              }
                              className="w-16 accent-teal-400"
                            />
                            <span className="font-mono w-6 text-right">
                              {style.strokeWidth}px
                            </span>
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                            <input
                              type="checkbox"
                              checked={style.visible}
                              onChange={(e) =>
                                updateStyle(label, { visible: e.target.checked })
                              }
                              className="accent-teal-400"
                            />
                            <span>Show</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
          </div>
        )}

        {/* 7. PREVIOUS PROCESSED SESSIONS WITH RELOAD BUTTON */}
        <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-semibold text-zinc-200">
                Previous Processed Sessions ({pastSessions.length})
              </span>
            </div>

            <button
              type="button"
              onClick={fetchPastSessions}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-teal-300 border border-zinc-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPastSessions ? "animate-spin" : ""}`} />
              <span>Reload Sessions</span>
            </button>
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
        </div>
      </main>
    </div>
  );
}
