"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles, Target, TrendingUp, TrendingDown, Minus, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_GOALS_TEXT, DEMO_EVIDENCE_SUMMARY } from "@/lib/demo/dummy-insights";

const STEPS = ["Sample data", "Run agents", "Results"] as const;

export default function DemoInsightsPage() {
  const [goalsText, setGoalsText] = useState(DEMO_GOALS_TEXT);
  const [month, setMonth] = useState("2026-10");
  const [running, setRunning] = useState<"goals" | "highlights" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [goalResult, setGoalResult] = useState<any | null>(null);
  const [highlightResult, setHighlightResult] = useState<any | null>(null);

  async function run(mode: "goals" | "highlights") {
    setRunning(mode);
    setError(null);
    try {
      const res = await fetch("/api/demo/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, goalsText, month }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent call failed — check MODEL_API_KEY and AI_MODE=live.");
      if (mode === "goals") setGoalResult(data);
      else setHighlightResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  }

  const verdictColor = (v: string) =>
    v === "achieved" || v === "on_track" ? "emerald" : v === "at_risk" ? "amber" : v === "behind" ? "rose" : "outline";
  const arrowIcon = (a: string) => (a === "↑" ? TrendingUp : a === "↓" ? TrendingDown : Minus);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-10">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/login" className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100"><ArrowLeft className="w-3.5 h-3.5" /> Login</Link>
            <span className="hidden sm:block h-5 w-px bg-zinc-800" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight flex items-center gap-2">Insights Playground <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-950 border border-violet-500/30 text-violet-300">Demo · sample data</span></h1>
              <p className="hidden sm:block text-[11px] text-zinc-500 mt-0.5">Real Goal Tracking + Monthly Highlights agents on sample evidence — your Meta key, no Supabase.</p>
            </div>
          </div>
          <Link href="/demo/homeprogram" className="text-xs text-teal-400 hover:text-teal-300 shrink-0">Home program demo →</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {STEPS.map((s, i) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-[11px] font-mono">
              <span className={`px-2 py-1 rounded-full border ${i === 0 ? "bg-teal-950 border-teal-500/40 text-teal-300" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>{i + 1} {s}</span>
              {i < STEPS.length - 1 && <span className="text-zinc-700">→</span>}
            </span>
          ))}
          <span className="ml-auto text-[11px] text-zinc-500">Sample patient · {DEMO_EVIDENCE_SUMMARY.soapNotes} SOAP notes · {DEMO_EVIDENCE_SUMMARY.mhrClips} movement clips · {DEMO_EVIDENCE_SUMMARY.submissions} submissions · {DEMO_EVIDENCE_SUMMARY.adherence}</span>
        </div>

        <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-300 flex items-center gap-2"><Target className="w-3.5 h-3.5 text-teal-400" /> Goals (edit and re-run — one per line)</h2>
          <Textarea value={goalsText} onChange={(e) => setGoalsText(e.target.value)} rows={6} className="text-xs bg-zinc-950 border-zinc-800 font-mono" />
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400">Month</label>
              <input value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 w-28 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs font-mono" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => run("goals")} disabled={running !== null} className="h-9 gap-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold">
                {running === "goals" ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Agent analyzing..</> : <><Play className="w-3.5 h-3.5" /> Run Goal Tracking</>}
              </Button>
              <Button onClick={() => run("highlights")} disabled={running !== null} variant="outline" className="h-9 gap-2 text-xs border-violet-500/40 text-violet-300 hover:bg-violet-950/40">
                {running === "highlights" ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Agent analyzing..</> : <><Sparkles className="w-3.5 h-3.5" /> Run Monthly Highlights</>}
              </Button>
            </div>
            <p className="text-[11px] text-zinc-500">Uses your server Meta key (<span className="font-mono">MODEL_API_KEY</span>, <span className="font-mono">AI_MODE=live</span>). Sample data only — nothing is saved.</p>
          </div>
          {error && <p className="text-xs text-rose-300 bg-rose-950/30 border border-rose-800/40 rounded-lg p-2.5">{error}</p>}
        </Card>

        {goalResult?.result && (
          <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Goal Tracking — verdicts <span className="normal-case font-normal text-zinc-500">({goalResult.modelId} · {goalResult.latencyMs}ms)</span></h3>
            <p className="text-xs text-zinc-400 leading-relaxed">{goalResult.result.summary?.narrative}</p>
            <div className="grid gap-2">
              {(goalResult.result.verdicts || []).map((v: any) => (
                <div key={v.goalId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-100">{v.goalText}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{v.reason}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={(verdictColor(v.verdict) === "outline" ? "outline" : verdictColor(v.verdict)) as any} statusText={v.verdict.replace("_", " ")} />
                    <span className="text-[11px] font-mono text-zinc-500">{Math.round((v.confidence || 0) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
            {(goalResult.result.suggestions || []).length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-300">Suggestions</p>
                {goalResult.result.suggestions.map((s: any, i: number) => (
                  <p key={i} className="text-xs text-zinc-400"><span className="font-mono text-teal-300">{s.action}</span> — {s.text}</p>
                ))}
              </div>
            )}
          </Card>
        )}

        {highlightResult?.result && (
          <Card className="p-4 border-zinc-800 bg-zinc-900/70 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Monthly Highlights <span className="normal-case font-normal text-zinc-500">({highlightResult.modelId} · {highlightResult.latencyMs}ms)</span></h3>
            <p className="text-xs text-zinc-400">Trend: <span className="text-zinc-200 font-medium">{highlightResult.result.summary?.trend}</span> · Top driver: {highlightResult.result.summary?.topDriver}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(highlightResult.result.highlights || []).map((h: any) => {
                const Arrow = arrowIcon(h.arrow);
                return (
                  <div key={h.slot} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">{h.slotLabel}</span>
                      <Arrow className={`w-4 h-4 ${h.arrow === "↑" ? "text-emerald-400" : h.arrow === "↓" ? "text-rose-400" : "text-zinc-400"}`} />
                    </div>
                    <p className="text-xs font-semibold text-zinc-100 leading-snug">{h.title}</p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{h.story}</p>
                    <div className="flex flex-wrap gap-1 mt-auto">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-teal-300 font-mono">{h.delta?.quanti}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">{h.delta?.quali}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono">w {(h.weight ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-zinc-500">Only evidence-backed moments are shown (3–7, never forced to 7).</p>
          </Card>
        )}

        {!goalResult && !highlightResult && (
          <Card className="p-8 border-dashed border-zinc-700 bg-zinc-900/40 text-center space-y-2">
            <Sparkles className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-semibold text-zinc-300">Nothing run yet</p>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">Edit the goals if you like, then run either agent. Both reason over the sample SOAP notes, movement clips, and submissions above — with your Meta key.</p>
          </Card>
        )}
      </main>
    </div>
  );
}
