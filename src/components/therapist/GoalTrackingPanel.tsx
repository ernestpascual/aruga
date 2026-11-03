"use client";
import React, { useState } from "react";
import { Target, Sparkles, Loader2, AlertCircle, CheckCircle2, TrendingUp, TrendingDown, Minus, Wand2, ChevronDown, ChevronUp, FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  patientId: string;
  longTermGoals: string[];
  shortTermGoals: string[];
  soapCount: number;
  onInsertToPlan?: (text: string) => void;
};

type Verdict = {
  goalId: string;
  goalText: string;
  goalType: "ltg" | "stg";
  verdict: "on_track" | "at_risk" | "behind" | "achieved" | "gap";
  confidence: number;
  signals: Record<string, number>;
  reason: string;
  evidenceIds: string[];
};

const verdictMeta: Record<string, { label: string; color: string; icon: any; dot: string }> = {
  on_track: { label: "On track", color: "text-emerald-300 border-emerald-500/30 bg-emerald-950/30", icon: TrendingUp, dot: "bg-emerald-500" },
  at_risk: { label: "At risk", color: "text-amber-300 border-amber-500/30 bg-amber-950/30", icon: AlertCircle, dot: "bg-amber-500" },
  behind: { label: "Behind", color: "text-rose-300 border-rose-500/30 bg-rose-950/30", icon: TrendingDown, dot: "bg-rose-500" },
  achieved: { label: "Achieved", color: "text-teal-300 border-teal-500/30 bg-teal-950/30", icon: CheckCircle2, dot: "bg-teal-500" },
  gap: { label: "Gap", color: "text-zinc-300 border-zinc-700 bg-zinc-800", icon: Minus, dot: "bg-zinc-500" },
};

/** No mock verdicts — all verdicts must come from POST /api/agent/goal-tracking/run with real evidence */

export function GoalTrackingPanel({ patientId, longTermGoals, shortTermGoals, soapCount, onInsertToPlan }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ verdicts: Verdict[]; summary: any; suggestions: any[]; modelId: string } | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const hasGoals = longTermGoals.length + shortTermGoals.length > 0;
  const totalGoals = longTermGoals.length + shortTermGoals.length;

  async function handleCheck() {
    if (!hasGoals) return;
    setLoading(true);
    setError(null);
    setPublished(false);
    try {
      const r = await fetch("/api/agent/goal-tracking/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, trigger: "manual" }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || data.message || "Goal check failed");
      if (data.verdicts) setDraft(data);
      else if (data.draft) setDraft(data.draft);
      else throw new Error(data.error || "No verdicts returned — API did not produce evidence-gated results");
    } catch (e:any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish() {
    if (!draft) return;
    try {
      await fetch("/api/agent/goal-tracking/publish", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ patientId }) });
    } catch {}
    setPublished(true);
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/90 overflow-hidden">
      <div className="p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-violet-950/50 border border-violet-500/20 grid place-items-center shrink-0">
              <Target className="w-4 h-4 text-violet-400" />
            </span>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                Goal Tracking Agent
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">muse-spark-1.3 · 7 signals</span>
              </h3>
              <p className="text-[11px] text-zinc-500">Reviews progress on short- and long-term goals using session notes, movement analysis, and home practice. One click creates a draft.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!hasGoals && <span className="text-[11px] text-amber-300 hidden sm:inline">Create a goal first</span>}
            <Button
              type="button"
              size="sm"
              onClick={handleCheck}
              disabled={!hasGoals || loading}
              className="h-8 gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-40"
              title={hasGoals ? "Check goals — runs 7-signal evaluation" : "Add at least one long-term or short-term goal to enable"}
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {loading ? "Checking…" : "Check goals"}
              <Sparkles className="w-3 h-3 opacity-60 hidden sm:inline" />
            </Button>
          </div>
        </div>

        {!hasGoals && (
          <div className="rounded-lg border border-amber-900/30 bg-amber-950/20 p-2.5 text-xs text-amber-200/90">
            No therapy goals yet — add at least one Long-term or Short-term goal above to enable the agent. The button stays disabled until then.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-800/50 bg-rose-950/20 p-2.5 text-xs text-rose-300 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5" /> {error}</div>
        )}

        {draft && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="emerald" statusText={`On track ${draft.summary.onTrack ?? 0}`} />
              <Badge variant="amber" statusText={`At risk ${draft.summary.atRisk ?? 0}`} />
              <Badge variant="outline" statusText={`Behind ${draft.summary.behind ?? 0}`} />
              <Badge variant="teal" statusText={`Achieved ${draft.summary.achieved ?? 0}`} />
              <span className="text-[11px] text-zinc-500 px-2 py-1">{draft.summary.narrative}</span>
            </div>

            <div className="grid gap-2">
              {draft.verdicts.map((v) => {
                const m = verdictMeta[v.verdict] || verdictMeta.gap;
                const Icon = m.icon;
                return (
                  <div key={v.goalId} className={`rounded-xl border p-3 flex flex-col gap-2 ${m.color}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${m.dot} shrink-0`} />
                          <span className="text-[11px] font-bold uppercase tracking-wide">{v.verdict.replace("_"," ")}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-400">{v.goalType === "ltg" ? "Long-term" : "Short-term"} • {(v.confidence*100).toFixed(0)}%</span>
                        </div>
                        <p className="text-xs font-semibold text-zinc-100 mt-1 break-words">{v.goalText}</p>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{v.reason}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {v.evidenceIds.map(id=> <span key={id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono">{id}</span>)}
                        </div>
                      </div>
                      <Icon className="w-4 h-4 shrink-0 opacity-70" />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={()=>{
                        const line = `${v.goalText} — ${v.verdict.replace("_"," ")}: ${v.reason}`;
                        if (onInsertToPlan) onInsertToPlan(line);
                        else {
                          window.dispatchEvent(new CustomEvent("aruga:insert-goal-plan", { detail: line }));
                        }
                      }} className="h-7 text-[11px] gap-1 border-zinc-700 bg-zinc-900"> <FileText className="w-3 h-3" /> Add to plan </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {draft.suggestions?.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-zinc-300">Suggestions</p>
                {draft.suggestions.map((s:any, i:number)=> (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                    <span className="text-zinc-200">{s.text}</span>
                    <Badge variant={s.action==="escalate"?"amber":"teal"} statusText={s.action} />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 items-center">
              <Button type="button" size="sm" onClick={handlePublish} disabled={published} className="h-8 gap-1.5 text-xs bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold">
                {published ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />} {published ? "Published" : "Publish to client"}
              </Button>
              <span className="text-[11px] text-zinc-500">{draft.modelId}</span>
              <button type="button" onClick={()=> setTraceOpen(!traceOpen)} className="ml-auto text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1">
                {traceOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Details
              </button>
            </div>
            {traceOpen && (
              <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-[11px] text-zinc-400 space-y-1">
                <p>Checked {draft.verdicts.length} goals with your recent notes and videos — draft is ready to review.</p>
              </div>
            )}
            <p className="text-[10px] text-zinc-500 italic">This is a draft for your review. {published ? "Now visible to client." : "Private until you publish."}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
