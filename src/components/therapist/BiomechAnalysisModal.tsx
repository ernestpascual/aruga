"use client";

import React, { useEffect, useState } from "react";
import { X, Zap, Loader2, AlertTriangle, Activity, Sparkles, ClipboardCheck, Film, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BiomechPanel } from "@/components/therapist/BiomechPanel";
import { SamOverlay } from "@/components/ui/sam-overlay";
import { Motion3DDots } from "@/components/therapist/Motion3DDots";

interface BiomechAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  submissionId: string;
  stepSubmissionId: string;
  stepTitle: string;
  stepInstructions: string;
  clientComment: string;
  clientSkipped?: boolean;
  skipReason?: string | null;
  ageBand: string;
  videoUrl: string | null;
  videoStoragePath?: string | null;
  scheduledDate?: string | null;
  onInsertObjective?: (text: string) => void;
}

const PALETTE = ["#2dd4bf", "#f472b6", "#facc15", "#60a5fa", "#a78bfa", "#fb923c", "#34d399", "#fb7185"];

export function BiomechAnalysisModal({
  open,
  onClose,
  submissionId,
  stepSubmissionId,
  stepTitle,
  stepInstructions,
  clientComment,
  clientSkipped,
  skipReason,
  ageBand,
  videoUrl,
  videoStoragePath,
  scheduledDate,
  onInsertObjective,
}: BiomechAnalysisModalProps) {
  const [prescribedTitle, setPrescribedTitle] = useState(stepTitle);
  const [prescribedInstructions, setPrescribedInstructions] = useState(stepInstructions);
  const [therapistNeed, setTherapistNeed] = useState(clientComment);
  const [band, setBand] = useState(ageBand || "adult");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dotsTime, setDotsTime] = useState(0);
  const [artifactState, setArtifactState] = useState<"none" | "loading" | "ready" | "missing">("none");
  const [artifactWarn, setArtifactWarn] = useState<string | null>(null);
  const [checkingCache, setCheckingCache] = useState(false);
  const [cacheChecked, setCacheChecked] = useState(false);

  // Re-prefill every time the modal opens for a (possibly different) step
  useEffect(() => {
    if (open) {
      setPrescribedTitle(stepTitle);
      setPrescribedInstructions(stepInstructions);
      const extra = [
        clientComment?.trim() ? `Client comment: ${clientComment.trim()}` : "",
        clientSkipped ? `Client skipped this step${skipReason ? `: ${skipReason}` : ""}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      setTherapistNeed(extra);
      setBand(ageBand || "adult");
      setError(null);
      setSaveError(null);
      // keep previous result cleared per step open
      setResult(null);
      setIsSaved(false);
      setSavedAt(null);
      setCacheChecked(false);
      setDotsTime(0);
      setArtifactState("none");
      setArtifactWarn(null);
    }
  }, [open, stepTitle, stepInstructions, clientComment, clientSkipped, skipReason, ageBand]);

  // Check for a previously saved (therapist-reviewed) result — loads instantly, no re-run
  useEffect(() => {
    if (!open || !stepSubmissionId) return;
    let cancelled = false;
    setCheckingCache(true);
    fetch(`/api/agent/biomech/save?stepSubmissionId=${stepSubmissionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const saved = d.saved as { mhr_result?: unknown; updated_at?: string; artifactUrl?: string | null } | null | undefined;
        if (saved?.mhr_result && typeof saved.mhr_result === "object") {
          setResult(saved.mhr_result);
          setIsSaved(true);
          setSavedAt(saved.updated_at || null);
          setDotsTime(0);
          // Heavy replay blobs (full 3D frames + SAM masks) live in Storage — merge them back
          setArtifactWarn(null);
          if (saved.artifactUrl) {
            setArtifactState("loading");
            fetch(saved.artifactUrl)
              .then((ar) => ar.json())
              .then((art: any) => {
                if (cancelled) return;
                setResult((prev: any) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    sam: { ...(prev.sam || {}), boxes: art?.sam?.boxes ?? prev.sam?.boxes, svgPaths: art?.sam?.svgPaths ?? prev.sam?.svgPaths, tracks: art?.sam?.tracks ?? prev.sam?.tracks },
                    mhr: prev.mhr ? { ...prev.mhr, frames: art?.frames ?? prev.mhr?.frames } : prev.mhr,
                  };
                });
                setArtifactState("ready");
              })
              .catch(() => { if (!cancelled) setArtifactState("missing"); });
          }
        }
        setCacheChecked(true);
      })
      .catch(() => { setCacheChecked(true); })
      .finally(() => { if (!cancelled) setCheckingCache(false); });
    return () => { cancelled = true; };
  }, [open, stepSubmissionId]);

  // Lock body scroll + close on Escape (mirrors dialogs elsewhere)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleRun() {
    if (!videoUrl && !videoStoragePath) {
      setError("No video for this step — client has not uploaded video.");
      return;
    }
    if (!prescribedTitle.trim() && !prescribedInstructions.trim()) {
      setError("Describe the prescribed activity — AI uses this to decide what to track.");
      return;
    }
    setIsRunning(true);
    setError(null);
    setSaveError(null);
    setResult(null);
    try {
      // Prefer the storage path — the server signs a fresh link (600s), so an
      // expired 15-minute viewing URL can't break SAM's download.
      const body: Record<string, unknown> = {
        prescribedTitle,
        prescribedInstructions,
        therapistNeed,
        ageBand: band,
      };
      if (videoStoragePath && /^(submissions|playground)\//.test(videoStoragePath)) {
        body.videoStoragePath = videoStoragePath;
      } else if (videoUrl) {
        body.videoUrl = videoUrl;
      }
      const res = await fetch("/api/tools/biomech/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const ct = res.headers.get("content-type") || "";
      let data: any;
      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        const txt = await res.text();
        if (!res.ok) throw new Error(txt.slice(0, 800) || `Request failed (${res.status})`);
        try {
          data = JSON.parse(txt);
        } catch {
          throw new Error(txt.slice(0, 800));
        }
      }
      if (!res.ok) throw new Error(data.error || "Biomech run failed.");
      setResult(data);
      setDotsTime(0);
      setArtifactWarn(null);
      setArtifactState(data?.mhr?.frames?.[0]?.pred_keypoints_3d ? "ready" : "none");
      // Fresh run needs therapist review before it counts as saved
      setIsSaved(false);
      setSavedAt(null);
      setSaveError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/media_url_origin_error|origin returned HTTP|failed to download media/i.test(msg)) {
        setError("The video link expired before analysis started (viewing links last 15 minutes). Close and reopen this popup to refresh it, then run again — the playground works because it uploads a fresh copy each time.");
      } else if (/timed?\s*out|execution timed|cancellation signal|504/i.test(msg)) {
        setError("Agent analyzing timed out — the clip is likely too long or the server was cold starting. Use a clip under 15 seconds and run again (the retry is warm and much faster). Your video itself is fine.");
      } else {
        setError(msg);
      }
    } finally {
      setIsRunning(false);
    }
  }

  const plan = result?.plan ?? null;
  const analysis = (result as any)?.analysis ?? null;
  const insights: Array<{ id: string; label: string; value: number | null; unit: string; rating: string; score: number; explanation: string }> = result?.insights ?? [];
  const mhr = result?.mhr ?? null;
  const adherence = result?.adherence ?? null;
  const has3d = Array.isArray((mhr as any)?.frames?.[0]?.pred_keypoints_3d);

  async function handleSave() {
    if (!result) return;
    if (!submissionId || !stepSubmissionId) {
      setSaveError("Missing submission reference — cannot save.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/agent/biomech/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          stepSubmissionId,
          prescribedTitle,
          prescribedInstructions,
          therapistNeed,
          ageBand: band,
          result,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setIsSaved(true);
      setSavedAt(data.saved?.updated_at || new Date().toISOString());
      if (data.artifactSaved === false) {
        setArtifactWarn(data.artifactError ? `Summary saved, but the 3D replay was NOT stored: ${data.artifactError}. Segmentation overlays and the 3D view will be missing on reload.` : "Summary saved, but the 3D replay was NOT stored. Segmentation overlays and the 3D view will be missing on reload.");
      } else {
        setArtifactWarn(null);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  }

  function handleInsert() {
    if (!mhr && insights.length === 0) return;
    const top = insights.slice(0, 3).map((i) => `${i.label}: ${i.rating} — ${i.explanation}`).join("\n");
    const txt = `Biomech (${prescribedTitle}${scheduledDate ? ` • ${scheduledDate}` : ""}):\n${top || "See attached ROM summary."}`;
    onInsertObjective?.(txt);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-auto rounded-2xl bg-zinc-950 border border-zinc-700 shadow-2xl">
        {/* Header — mirrors /tools/biomech */}
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-400" />
              Biomechanic Agent
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-950 border border-teal-500/30 text-teal-300">Spark • SAM 3.1 • SAM 3D Body</span>
            </h2>
            <p className="text-[11px] text-zinc-500 mt-1">Already filled in from this step. Check it, then press Analyze.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 shrink-0" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* 1 — Prescribed Activity (same fields as /tools/biomech step 1) */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-widest uppercase text-zinc-400 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-800 grid place-items-center"><ClipboardCheck className="w-3.5 h-3.5 text-teal-400" /></span>
              1 — Prescribed Activity
            </h3>
            <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300">Activity Title</label>
                <Input value={prescribedTitle} onChange={(e) => setPrescribedTitle(e.target.value)} className="mt-1 text-xs bg-zinc-950 border-zinc-800" />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-300">Instructions given to client</label>
                <Textarea value={prescribedInstructions} onChange={(e) => setPrescribedInstructions(e.target.value)} rows={3} className="mt-1 text-xs bg-zinc-950 border-zinc-800 resize-none" />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-zinc-300">Age band (auto-filled)</label>
                  <select value={band} onChange={(e) => setBand(e.target.value)} className="mt-1 w-full h-9 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100">
                    <option value="pedia">Pedia (1–11)</option>
                    <option value="adolescent">Adolescent (12–17)</option>
                    <option value="adult">Adult (18–54)</option>
                    <option value="geriatric">Geriatric (55+)</option>
                  </select>
                </div>
                <div className="flex-[2]">
                  <label className="text-xs font-semibold text-zinc-300">Extra context (client comment prefilled)</label>
                  <Textarea value={therapistNeed} onChange={(e) => setTherapistNeed(e.target.value)} rows={2} placeholder="e.g. Client said wrist felt tight on rep 4…" className="mt-1 text-xs bg-zinc-950 border-zinc-800 resize-none" />
                </div>
              </div>
            </Card>
          </section>

          {/* 2 — Video (existing step video, no upload) */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-widest uppercase text-zinc-400 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-800 grid place-items-center"><Film className="w-3.5 h-3.5 text-teal-400" /></span>
              2 — Step video
            </h3>
            {videoUrl ? (
              <div className="rounded-xl overflow-hidden bg-black border border-zinc-800">
                <video src={videoUrl} controls playsInline className="block w-full h-auto max-h-[320px] mx-auto object-contain" />
              </div>
            ) : (
              <p className="text-xs text-amber-300">No video for this step.</p>
            )}
          </section>

          {/* Analyze — hidden once a reviewed save exists (view the saved result instead).
              Also hidden while checking the database so a run can't race the cached load. */}
          {!isSaved && !checkingCache && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <Button onClick={handleRun} disabled={!videoUrl || isRunning} className="h-10 gap-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold shrink-0">
                {isRunning ? (<><Loader2 className="w-4 h-4 animate-spin" /> Agent analyzing..</>) : (<><Zap className="w-4 h-4" /> Analyze Movement</>)}
              </Button>
              <p className="text-xs text-zinc-400">The agent watches the video and measures the movement for you.</p>
            </div>
          )}

          {error && (
            <Card className="p-3 border-red-900/50 bg-red-950/30 text-xs text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
            </Card>
          )}

          {/* Database loading state — shown while the saved analysis (+ full 3D) loads */}
          {!result && (checkingCache || artifactState === "loading") && (
            <Card className="p-4 border-zinc-800 bg-zinc-900/70 flex items-center gap-2.5 text-xs text-zinc-300">
              <Loader2 className="w-4 h-4 animate-spin text-teal-400 shrink-0" />
              <span>{checkingCache ? "Loading saved analysis from the database…" : "Loading full 3D replay from storage…"}</span>
            </Card>
          )}

          {/* Results — segmentation + 3D mirror of /tools/biomech steps 2–4.
              Segmentation (SAM boxes/masks) + skeleton + HUD render from the DB save too:
              the slim row carries boxes + angles, and the storage artifact restores
              full 3D frames + masks on load. */}
          {result && (
            <div className="space-y-4">
              {videoUrl ? (
                <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Segmentation + skeleton — same video, tracked overlays</h4>
                  {artifactState === "loading" && (
                    <p className="text-[11px] text-zinc-500 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Loading masks + full 3D from storage…</p>
                  )}
                  <SamOverlay
                    videoSrc={videoUrl}
                    boxes={(result.sam?.boxes as any[]) ?? []}
                    svgPaths={(result.sam?.svgPaths as any[]) ?? []}
                    mhr={mhr}
                    modelProvenance="SAM 3.1 + SAM 3D Body"
                  />
                </Card>
              ) : null}
              <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300 flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-violet-400" /> Step 0 — What the agent understood
                </h4>
                {analysis ? (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-300 leading-relaxed">{analysis.movementAnalysis || "Functional movement analysis."}</p>
                    {Array.isArray(analysis.targets) && analysis.targets.length > 0 && (
                      <div className="grid gap-1.5">
                        {analysis.targets.map((t: any, i: number) => (
                          <div key={i} className="flex items-start justify-between gap-2 rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs">
                            <span className="font-semibold text-zinc-100">{t.metric}</span>
                            <span className="text-right text-zinc-400">{t.direction}{t.expectedRange ? ` • expect ${t.expectedRange}` : ""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(analysis.watchFor) && analysis.watchFor.length > 0 && (
                      <p className="text-[11px] text-amber-200/80">Watch for: {analysis.watchFor.join(" · ")}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">No task analysis for this run — concepts were picked directly from the activity text (heuristic path).</p>
                )}
              </Card>
              <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" /> Step 1 — Determine
                  <Badge variant="teal" className="text-[11px] font-mono ml-1">{plan?.source === "spark" ? "Spark" : "Heuristic"}</Badge>
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {(result.concepts || []).map((c: string, i: number) => (
                    <span key={c} className="px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5" style={{ backgroundColor: `${PALETTE[i % PALETTE.length]}18`, borderColor: `${PALETTE[i % PALETTE.length]}50`, color: PALETTE[i % PALETTE.length] }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />{c}
                    </span>
                  ))}
                </div>
                {plan?.rationale && <p className="text-xs text-zinc-400"><span className="font-semibold text-violet-300">Rationale:</span> {plan.rationale}</p>}
                {Array.isArray((plan as any)?.dropped) && (plan as any).dropped.length > 0 && (
                  <p className="text-[11px] text-zinc-500">Final review dropped: {(plan as any).dropped.map((d: any) => d.concept).join(", ")} — kept only what the measurement targets need.</p>
                )}
              </Card>

              <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Step 2–3 — Segment, estimate & compare</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5"><div className="text-[11px] text-zinc-500">SAM latency</div><div className="text-sm font-bold text-zinc-100">{result.sam?.latencyMs ?? "—"} ms</div></div>
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5"><div className="text-[11px] text-zinc-500">Modal MHR</div><div className="text-sm font-bold text-zinc-100">{mhr?.processingMs ?? "—"} ms</div></div>
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5"><div className="text-[11px] text-zinc-500">Adherence</div><div className="text-sm font-bold text-zinc-100">{adherence?.pct ?? "—"}%</div><div className="text-[11px] text-zinc-500">{adherence?.label ?? ""}</div></div>
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5"><div className="text-[11px] text-zinc-500">Concepts</div><div className="text-sm font-bold text-zinc-100">{(result.concepts || []).length}</div></div>
                </div>
                <div className="space-y-2">
                  {insights.map((ins) => (
                    <div key={ins.id} className={`p-3 rounded-xl border text-xs ${ins.rating === "Good" ? "bg-teal-950/20 border-teal-800/40" : ins.rating === "Watch" ? "bg-amber-950/20 border-amber-800/40" : "bg-red-950/20 border-red-800/40"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-zinc-100">{ins.label}</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-800 border border-zinc-700 text-zinc-200">{ins.rating} • {ins.score}</span>
                      </div>
                      <p className="text-zinc-400 mt-1">{ins.explanation}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Step 4 — 3D motion projection</h4>
                {artifactState === "loading" ? (
                  <p className="text-xs text-zinc-500">Loading full 3D replay…</p>
                ) : has3d && mhr ? (
                  <Motion3DDots mhr={mhr} currentTime={dotsTime} onSeek={setDotsTime} />
                ) : (
                  <p className="text-xs text-amber-300">Full 3D replay is not stored for this analysis — press Analyze Movement again to regenerate it.</p>
                )}
              </Card>

              {mhr?.summary && (
                <BiomechPanel
                  mhr={{
                    submissionId: mhr.submissionId || "review",
                    stepSubmissionId: mhr.stepSubmissionId || "review-step",
                    modelId: mhr.modelId || "sam-3d-body",
                    processingMs: mhr.processingMs || result?.meta?.processingMs || 0,
                    concepts: result?.concepts || mhr.concepts || [],
                    frames: mhr.frames || [],
                    summary: mhr.summary,
                    flags: mhr.flags || [],
                  } as never}
                  onInsertObjective={(txt) => onInsertObjective?.(txt)}
                />
              )}

              {/* Review first, then save to database for instant reload */}
              {checkingCache ? (
                <p className="text-xs text-zinc-500">Checking for a saved analysis…</p>
              ) : isSaved ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-300">
                  <span className="font-semibold">Saved{savedAt ? ` • ${new Date(savedAt).toLocaleString()}` : ""} — reloads instantly, no re-analysis needed.</span>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
                  Review the results above first — then save so they load instantly next time without re-running the analysis.
                </div>
              )}
              {saveError && (
                <Card className="p-3 border-red-900/50 bg-red-950/30 text-xs text-red-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{saveError}</span>
                </Card>
              )}
              {artifactWarn && (
                <Card className="p-3 border-amber-800/50 bg-amber-950/30 text-xs text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="flex-1">{artifactWarn}</span>
                  <Button onClick={handleSave} disabled={isSaving} size="sm" className="h-7 text-xs shrink-0 bg-amber-600 hover:bg-amber-500 text-white font-semibold">
                    {isSaving ? (<><Loader2 className="w-3 h-3 animate-spin" /> Retrying…</>) : "Retry 3D upload"}
                  </Button>
                </Card>
              )}
              <div className="flex flex-wrap gap-2">
                {!isSaved && (
                  <Button onClick={handleSave} disabled={isSaving} className="h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
                    {isSaving ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>) : "Review done — Save to database"}
                  </Button>
                )}
                <Button onClick={handleInsert} disabled={!isSaved} title={isSaved ? "Insert into Objective" : "Save first, then insert"} className="h-9 text-xs gap-1.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold disabled:opacity-40">
                  Insert summary into Objective
                </Button>
                <Button variant="outline" onClick={onClose} className="h-9 text-xs">Close</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
