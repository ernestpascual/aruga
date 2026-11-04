"use client";

import React, { useState } from "react";
import { Activity, Brain, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SamOverlay } from "@/components/ui/sam-overlay";
import { Motion3DDots } from "@/components/therapist/Motion3DDots";
import { BiomechPanel } from "@/components/therapist/BiomechPanel";

const PALETTE = ["#2dd4bf", "#f472b6", "#facc15", "#60a5fa", "#a78bfa", "#fb923c", "#34d399", "#fb7185"];

/**
 * ReplayViewer — renders a finished biomech analysis without re-running
 * inference. Accepts either a live tools/biomech/run result or a saved
 * biomech_jobs mhr_result (slim row, optionally artifact-merged).
 */
export function ReplayViewer({
  videoUrl,
  result,
  feedback,
}: {
  videoUrl: string | null;
  result: any | null;
  feedback?: { overall?: string; subjective?: string; objective?: string; assessment?: string; plan?: string } | null;
}) {
  const [dotsTime, setDotsTime] = useState(0);
  if (!result) {
    return (
      <Card className="p-6 border-dashed border-zinc-700 bg-zinc-900/40 text-center space-y-2">
        <Activity className="w-8 h-8 text-zinc-600 mx-auto" />
        <p className="text-sm font-semibold text-zinc-300">No analysis loaded yet</p>
        <p className="text-xs text-zinc-500 max-w-md mx-auto">Run the Biomechanic Agent on a clip, or open a saved analysis — segmentation, skeleton, 3D, and insights will replay here without re-running.</p>
      </Card>
    );
  }

  const plan = result.plan ?? null;
  const analysis = result.analysis ?? null;
  const insights: Array<{ id: string; label: string; rating: string; score: number; explanation: string }> = result.insights ?? [];
  const mhr = result.mhr ?? null;
  const adherence = result.adherence ?? null;
  const has3d = Array.isArray(mhr?.frames?.[0]?.pred_keypoints_3d);

  return (
    <div className="space-y-4">
      {videoUrl ? (
        <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Segmentation + skeleton — tracked overlays</h4>
          <p className="text-[11px] text-zinc-500">Segmentation (SAM 3.1 masks, one colour per concept) is the main overlay — switch it and the skeleton on or off above the video.</p>
          <SamOverlay videoSrc={videoUrl} boxes={result.sam?.boxes ?? []} svgPaths={result.sam?.svgPaths ?? []} mhr={mhr} modelProvenance="SAM 3.1 + SAM 3D Body" />
        </Card>
      ) : null}

      <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300 flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-violet-400" /> What the agent understood
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
          <p className="text-xs text-zinc-500">No task analysis stored for this run — concepts were picked directly from the activity text.</p>
        )}
      </Card>

      <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" /> Final SAM prompt
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
      </Card>

      <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Insights</h4>
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
          {insights.length === 0 && <p className="text-xs text-zinc-500">No insight rows stored for this analysis.</p>}
        </div>
      </Card>

      <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">3D motion projection</h4>
        {has3d && mhr ? (
          <Motion3DDots mhr={mhr} currentTime={dotsTime} onSeek={setDotsTime} />
        ) : (
          <p className="text-xs text-amber-300">Full 3D replay is not stored for this analysis — re-run and save again to regenerate it.</p>
        )}
      </Card>

      {mhr?.summary && (
        <BiomechPanel
          mhr={{
            submissionId: mhr.submissionId || "replay",
            stepSubmissionId: mhr.stepSubmissionId || "replay-step",
            modelId: mhr.modelId || "sam-3d-body",
            processingMs: mhr.processingMs || result?.meta?.processingMs || 0,
            concepts: result?.concepts || mhr.concepts || [],
            frames: mhr.frames || [],
            summary: mhr.summary,
            flags: mhr.flags || [],
          } as never}
        />
      )}

      {feedback && (feedback.overall || feedback.subjective || feedback.objective || feedback.assessment || feedback.plan) && (
        <Card className="p-4 border-teal-500/20 bg-teal-950/10 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-teal-300">Therapist feedback</h4>
          {feedback.overall && <p className="text-xs text-zinc-200 leading-relaxed italic">“{feedback.overall}”</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {feedback.subjective && <div className="rounded-lg bg-zinc-950/60 border border-zinc-800 p-2.5"><span className="font-bold text-sky-300">S — </span><span className="text-zinc-300">{feedback.subjective}</span></div>}
            {feedback.objective && <div className="rounded-lg bg-zinc-950/60 border border-zinc-800 p-2.5"><span className="font-bold text-teal-300">O — </span><span className="text-zinc-300">{feedback.objective}</span></div>}
            {feedback.assessment && <div className="rounded-lg bg-zinc-950/60 border border-zinc-800 p-2.5"><span className="font-bold text-amber-300">A — </span><span className="text-zinc-300">{feedback.assessment}</span></div>}
            {feedback.plan && <div className="rounded-lg bg-zinc-950/60 border border-zinc-800 p-2.5"><span className="font-bold text-violet-300">P — </span><span className="text-zinc-300">{feedback.plan}</span></div>}
          </div>
        </Card>
      )}
    </div>
  );
}
