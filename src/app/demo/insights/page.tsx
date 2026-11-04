"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Minus,
  User,
  Lightbulb,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_GOALS_TEXT, DEMO_EVIDENCE_SUMMARY } from "@/lib/demo/dummy-insights";

type AgentMode = "goals" | "highlights";

export default function DemoInsightsPage() {
  const [goalsText, setGoalsText] = useState(DEMO_GOALS_TEXT);
  const [month, setMonth] = useState("2026-10");
  const [running, setRunning] = useState<AgentMode | "both" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [goalResult, setGoalResult] = useState<any | null>(null);
  const [highlightResult, setHighlightResult] = useState<any | null>(null);

  const goalCount = useMemo(
    () => goalsText.split("\n").map((l) => l.trim()).filter(Boolean).length,
    [goalsText]
  );

  async function callAgent(mode: AgentMode) {
    const res = await fetch("/api/demo/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, goalsText, month }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Agent call failed — check MODEL_API_KEY and AI_MODE=live.");
    return data;
  }

  async function run(mode: AgentMode | "both") {
    setRunning(mode);
    setError(null);
    try {
      if (mode === "goals") {
        setGoalResult(await callAgent("goals"));
      } else if (mode === "highlights") {
        setHighlightResult(await callAgent("highlights"));
      } else {
        const [g, h] = await Promise.all([callAgent("goals"), callAgent("highlights")]);
        setGoalResult(g);
        setHighlightResult(h);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  }

  const verdictBadge = (v: string) =>
    v === "achieved" || v === "on_track" ? "emerald" : v === "at_risk" ? "amber" : v === "behind" ? "rose" : "outline";
  const arrowIcon = (a: string) => (a === "↑" ? TrendingUp : a === "↓" ? TrendingDown : Minus);

  const goalSummary = goalResult?.result?.summary;
  const goalTotal = goalSummary
    ? (goalSummary.onTrack || 0) + (goalSummary.achieved || 0) + (goalSummary.atRisk || 0) + (goalSummary.behind || 0) + (goalSummary.gap || 0)
    : 0;
  const goalDonePct = goalTotal ? Math.round((((goalSummary.onTrack || 0) + (goalSummary.achieved || 0)) / goalTotal) * 100) : 0;

  // Bento tiles: progress (top-right of story) + evidence counts (bottom row)
  const progressTiles = [
    { label: "Pain while typing", value: "4/10 → 3/10", sub: "Lower is better — still hurts, just less", accent: "text-rose-300 border-rose-500/30 bg-rose-950/30" },
    { label: "Grip strength", value: "19 → 21 kg", sub: "Higher is stronger · target 24 kg", accent: "text-teal-300 border-teal-500/30 bg-teal-950/30" },
    { label: "Arm lift overhead", value: "135° → 142°", sub: "Higher = further overhead reach", accent: "text-sky-300 border-sky-500/30 bg-sky-950/30" },
    { label: "Practice completed", value: "86%", sub: "4 in a row · improving +12%", accent: "text-emerald-300 border-emerald-500/30 bg-emerald-950/30" },
  ];
  const countTiles = [
    { label: "Goals to assess", value: goalCount, sub: "what success looks like", icon: Target, accent: "text-teal-300 border-teal-500/30 bg-teal-950/40" },
    { label: "Therapist notes", value: DEMO_EVIDENCE_SUMMARY.soapNotes, sub: "visit notes · Oct 21 + 28", icon: FileText, accent: "text-sky-300 border-sky-500/30 bg-sky-950/40" },
    { label: "Movement checks", value: DEMO_EVIDENCE_SUMMARY.mhrClips, sub: "camera-measured motion", icon: Video, accent: "text-violet-300 border-violet-500/30 bg-violet-950/40" },
    { label: "Home practice logs", value: DEMO_EVIDENCE_SUMMARY.submissions, sub: "practice done at home", icon: ClipboardList, accent: "text-amber-300 border-amber-500/30 bg-amber-950/40" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-12">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/login" className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100">
              <ArrowLeft className="w-3.5 h-3.5" /> Login
            </Link>
            <span className="hidden sm:block h-5 w-px bg-zinc-800" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                Insights Dashboard
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-950 border border-violet-500/30 text-violet-300">Demo · Sample data</span>
              </h1>
              <p className="hidden sm:block text-[11px] text-zinc-500 mt-0.5">Two real Meta agents on sample evidence — no Supabase, nothing saved.</p>
            </div>
          </div>
          <Link href="/demo/homeprogram" className="inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 shrink-0">
            Home program demo <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-4">
        {/* How it works */}
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          <span className="px-2.5 py-1.5 rounded-full border font-medium bg-teal-950 border-teal-500/40 text-teal-300">1 · Meet the sample patient</span>
          <ArrowRight className="w-3.5 h-3.5 text-zinc-700" />
          <span className={`px-2.5 py-1.5 rounded-full border font-medium ${running ? "bg-violet-950 border-violet-500/40 text-violet-300" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>2 · Run the agents</span>
          <ArrowRight className="w-3.5 h-3.5 text-zinc-700" />
          <span className={`px-2.5 py-1.5 rounded-full border font-medium ${goalResult || highlightResult ? "bg-emerald-950 border-emerald-500/40 text-emerald-300" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>3 · Edit goals & evidence, read results</span>
          <span className="ml-auto hidden md:inline text-zinc-500">Runs on your <span className="font-mono text-zinc-400">MODEL_API_KEY</span> · <span className="font-mono text-zinc-400">AI_MODE=live</span></span>
        </div>

        {/* Bento — story (large) + progress tiles + evidence counts */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 [grid-auto-flow:dense]">
          <Card className="col-span-2 lg:row-span-2 p-4 rounded-2xl border-teal-500/25 bg-teal-950/15 flex flex-col gap-4 h-full">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-9 h-9 rounded-full border border-teal-500/40 bg-teal-950 flex items-center justify-center">
                <User className="w-4 h-4 text-teal-300" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-zinc-50 flex flex-wrap items-center gap-2">
                  Start here — the story behind the numbers
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 border border-zinc-700 text-zinc-400">Fictional sample patient</span>
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed mt-1.5">
                  An adult desk worker is recovering from a wrist and hand problem. Typing hurts, their grip is weak, and they
                  cannot yet work a full day comfortably. For about two weeks in October they came to therapy, practiced
                  exercises at home, and had their arm movement measured on camera. <span className="text-zinc-200 font-medium">The agents never meet this person — they read the records below and judge what the records prove.</span>
                </p>
              </div>
            </div>
            <div className="grid gap-4 text-xs mt-auto">
              <p className="rounded-xl border border-teal-500/25 bg-zinc-950/60 p-4 leading-relaxed text-zinc-400">
                <span className="font-semibold text-teal-300">Goal Tracking asks:</span> “For each goal we promised, does the evidence show we are getting there, falling behind, or already done?”
              </p>
              <p className="rounded-xl border border-violet-500/25 bg-zinc-950/60 p-4 leading-relaxed text-zinc-400">
                <span className="font-semibold text-violet-300">Monthly Highlights asks:</span> “What genuinely got better this month — the moments worth showing the patient, family, or a report?”
              </p>
            </div>
          </Card>

          {progressTiles.map((t) => (
            <Card key={t.label} className={`p-4 rounded-2xl border bg-zinc-900/70 flex flex-col ${t.accent.split(" ").find((c) => c.startsWith("border-")) || ""}`}>
              <p className="text-[11px] font-medium text-zinc-500">{t.label}</p>
              <p className="text-lg sm:text-xl font-bold tracking-tight text-zinc-50 mt-1.5 leading-none">{t.value}</p>
              <p className="text-[11px] text-zinc-500 mt-1.5 leading-snug">{t.sub}</p>
            </Card>
          ))}

          {countTiles.map((s) => (
            <Card key={s.label} className="p-4 rounded-2xl border-zinc-800 bg-zinc-900/70">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-zinc-500 truncate">{s.label}</p>
                  <p className="text-2xl font-bold tracking-tight text-zinc-50 mt-1 leading-none">{s.value}</p>
                  <p className="text-[11px] text-zinc-500 mt-1.5 leading-snug">{s.sub}</p>
                </div>
                <span className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${s.accent}`}>
                  <s.icon className="w-4 h-4" />
                </span>
              </div>
            </Card>
          ))}
        </div>

        {/* Agent launch — both buttons in the same row */}
        <Card className="p-4 rounded-2xl border-zinc-800 bg-zinc-900/70 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Run the agents</h2>
            <button
              type="button"
              onClick={() => run("both")}
              disabled={running !== null || goalCount === 0}
              className="text-[11px] font-medium text-zinc-400 hover:text-zinc-100 disabled:opacity-40"
            >
              {running === "both" ? "Running both…" : "Run both →"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 items-stretch">
            <button
              type="button"
              onClick={() => run("goals")}
              disabled={running !== null || goalCount === 0}
              className="group flex h-full flex-col text-left rounded-2xl border border-teal-500/40 bg-teal-950/30 hover:bg-teal-950/50 disabled:opacity-50 disabled:cursor-not-allowed p-4 transition-colors"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-teal-100">
                  {running === "goals" || running === "both" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Goal Tracking
                </span>
                {goalResult
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  : <span className="hidden sm:inline text-[10px] font-mono text-teal-400/70">not run</span>}
              </span>
              <span className="block text-[11px] text-teal-200/60 mt-1.5 mb-4 leading-relaxed">Per-goal verdicts: achieved, on track, at risk, behind — with confidence. Click the button to run this agent — it uses the goals and evidence shown below, so edit them first if you want a different result.</span>
              <span className="mt-auto self-start inline-flex items-center gap-1.5 rounded-full bg-teal-500 px-4 py-1.5 text-[11px] font-bold text-white shadow-sm transition-colors group-hover:bg-teal-400 group-disabled:bg-zinc-700">
                {running === "goals" || running === "both" ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Agent analyzing…</> : goalResult ? <><RotateCcw className="w-3.5 h-3.5" /> Re-run Goal Tracking</> : <><Play className="w-3.5 h-3.5" /> Run Goal Tracking</>}
              </span>
            </button>

            <button
              type="button"
              onClick={() => run("highlights")}
              disabled={running !== null}
              className="group flex h-full flex-col text-left rounded-2xl border border-violet-500/40 bg-violet-950/30 hover:bg-violet-950/50 disabled:opacity-50 disabled:cursor-not-allowed p-4 transition-colors"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-violet-100">
                  {running === "highlights" || running === "both" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Monthly Highlights
                </span>
                {highlightResult
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  : <span className="hidden sm:inline text-[10px] font-mono text-violet-400/70">not run</span>}
              </span>
              <span className="block text-[11px] text-violet-200/60 mt-1.5 mb-4 leading-relaxed">The month&apos;s evidence-backed wins — 3 to 7 moments, never padded. Click the button to run this agent — it uses the goals and evidence shown below, so edit them first if you want a different result.</span>
              <span className="mt-auto self-start inline-flex items-center gap-1.5 rounded-full bg-violet-500 px-4 py-1.5 text-[11px] font-bold text-white shadow-sm transition-colors group-hover:bg-violet-400 group-disabled:bg-zinc-700">
                {running === "highlights" || running === "both" ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Agent analyzing…</> : highlightResult ? <><RotateCcw className="w-3.5 h-3.5" /> Re-run Monthly Highlights</> : <><Sparkles className="w-3.5 h-3.5" /> Run Monthly Highlights</>}
              </span>
            </button>
          </div>

          {goalCount === 0 && <p className="text-xs text-amber-300">Add at least one goal below to run Goal Tracking.</p>}
          {error && <p className="text-xs text-rose-300 bg-rose-950/30 border border-rose-800/40 rounded-xl p-4" role="alert">{error}</p>}
          <p className="text-[11px] text-zinc-600">Each run is a fresh live Meta call. Sample data only — nothing is saved.</p>
        </Card>

        {/* Setup bento: goals (wide) + evidence (narrow) */}
        <div className="grid lg:grid-cols-12 gap-4 items-stretch">
          <Card className="lg:col-span-7 p-4 rounded-2xl border-zinc-800 bg-zinc-900/70 flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-300 flex items-center gap-2">
                <Target className="w-4 h-4 text-teal-400" /> Goals the agents will judge
              </h2>
              <span className="flex items-center gap-2">
                <Badge variant="teal" statusText={`${goalCount} goal${goalCount === 1 ? "" : "s"}`} />
                <button
                  type="button"
                  onClick={() => setGoalsText(DEMO_GOALS_TEXT)}
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </span>
            </div>
            <Textarea
              value={goalsText}
              onChange={(e) => setGoalsText(e.target.value)}
              rows={14}
              style={{ minHeight: 360, padding: 16 }}
              className="w-full flex-1 resize-y text-[13px] bg-zinc-950 border-zinc-800 font-mono leading-relaxed"
              aria-label="Goals, one per line"
            />
            <p className="text-[11px] text-zinc-500 leading-relaxed">One goal per line. <span className="font-mono text-zinc-400">LTG:</span> = long-term goal — the big outcome in 6–8 weeks (e.g. “work 4 hours without pain”). <span className="font-mono text-zinc-400">STG:</span> = short-term goal — a smaller stepping stone toward it (e.g. “less wrist pain this month”). Edit anything, then re-run. Up to 15 goals.</p>
            <div className="flex items-center gap-2">
              <label htmlFor="demo-month" className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                <CalendarDays className="w-3.5 h-3.5" /> Highlights month
              </label>
              <input
                id="demo-month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-8 w-28 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs font-mono text-zinc-100"
              />
              <span className="text-[11px] text-zinc-600">YYYY-MM</span>
            </div>
          </Card>

          <Card className="lg:col-span-5 p-4 rounded-2xl border-zinc-800 bg-zinc-900/70 flex flex-col gap-4 h-full">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">What data the agents read</h2>
            <ul className="flex flex-1 flex-col gap-4 text-xs">
              <li className="flex-1 rounded-xl bg-zinc-950/60 border border-zinc-800 p-4 space-y-1">
                <p className="flex items-center gap-2 text-zinc-100 font-semibold"><FileText className="w-4 h-4 text-sky-400 shrink-0" /> 2 therapist visit notes <span className="font-mono text-[10px] font-normal text-zinc-500">(called “SOAP notes”)</span></p>
                <p className="text-zinc-400 leading-relaxed">Notes from Oct 21 and Oct 28 visits: what the patient reported, what the therapist measured, their judgement, and the plan.</p>
                <p className="text-zinc-500 leading-relaxed"><span className="text-zinc-300 font-medium">Why it matters:</span> this is the main proof — pain 4/10 → 3/10, grip 19 → 21 kg, arm lift 135° → 142°.</p>
              </li>
              <li className="flex-1 rounded-xl bg-zinc-950/60 border border-zinc-800 p-4 space-y-1">
                <p className="flex items-center gap-2 text-zinc-100 font-semibold"><Video className="w-4 h-4 text-violet-400 shrink-0" /> 2 camera movement checks</p>
                <p className="text-zinc-400 leading-relaxed">Short exercise clips analysed by computer vision, which measured joint angles instead of a human eyeballing them.</p>
                <p className="text-zinc-500 leading-relaxed"><span className="text-zinc-300 font-medium">Why it matters:</span> objective numbers — arm range improved 128° → 142°, and a “head leaning forward” warning cleared.</p>
              </li>
              <li className="flex-1 rounded-xl bg-zinc-950/60 border border-zinc-800 p-4 space-y-1">
                <p className="flex items-center gap-2 text-zinc-100 font-semibold"><ClipboardList className="w-4 h-4 text-amber-400 shrink-0" /> 4 home practice logs</p>
                <p className="text-zinc-400 leading-relaxed">Records of the patient doing their prescribed exercises at home between visits (Oct 20–27).</p>
                <p className="text-zinc-500 leading-relaxed"><span className="text-zinc-300 font-medium">Why it matters:</span> shows follow-through — 86% of sessions completed, 4 in a row, improving over time (+12%).</p>
              </li>
            </ul>
            <p className="text-[11px] text-zinc-600 leading-relaxed">This evidence is fixed sample data so every run is comparable. Only the goals and month on the left are editable. In the real app, these records come from the patient&apos;s actual visits, videos, and home practice.</p>
          </Card>
        </div>

        {/* Plain-English glossary — bento tiles, first + last wide */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="sm:col-span-2 rounded-2xl border border-amber-500/25 bg-amber-950/15 p-4 flex flex-col justify-center">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-200 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" /> Plain-English guide
            </h2>
            <p className="text-zinc-400 leading-relaxed mt-1.5">No clinical background needed. For judges: this is the same data a real therapist brings to a case review — the agents turn it into two decisions, <span className="text-zinc-200">are the goals on track?</span> and <span className="text-zinc-200">what progress is worth reporting?</span>, citing evidence instead of inventing it.</p>
          </div>
          {[
            { term: "SOAP note", plain: "A therapist's structured visit note: what the patient says → what was measured → what it means → what to do next.", wide: false },
            { term: "LTG / STG", plain: "Long-Term Goal = the big outcome (6–8 weeks). Short-Term Goal = a smaller step toward it.", wide: false },
            { term: "Pain 3/10", plain: "Pain scored 0 (none) to 10 (worst). Lower is better — 3/10 is mild pain.", wide: false },
            { term: "Grip 21 kg", plain: "How hard the hand can squeeze. Higher is stronger. Goal here: 24 kg.", wide: false },
            { term: "142° arm lift", plain: "How far the arm can raise, in degrees. Higher means more overhead reach for daily tasks.", wide: false },
            { term: "86% · streak · trend", plain: "86% of home practice finished, 4 sessions in a row, and completion improving (+12%).", wide: true },
          ].map((g) => (
            <div key={g.term} className={`rounded-2xl bg-zinc-900/70 border border-zinc-800 p-4 ${g.wide ? "sm:col-span-2" : ""}`}>
              <p className="font-semibold text-zinc-100">{g.term}</p>
              <p className="text-zinc-400 leading-relaxed mt-1">{g.plain}</p>
            </div>
          ))}
        </div>

        {/* Results */}
        {!goalResult && !highlightResult ? (
          <Card className="p-4 border-dashed border-zinc-700 bg-zinc-900/40 text-center flex flex-col items-center gap-2">
            <Sparkles className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-semibold text-zinc-300">No results yet</p>
            <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">Run Goal Tracking, Monthly Highlights, or both. Verdicts and highlights appear here side by side so you can compare what each agent saw in the same evidence.</p>
          </Card>
        ) : (
          <div className={`grid gap-4 items-stretch ${goalResult && highlightResult ? "xl:grid-cols-2" : ""}`}>
            {goalResult?.result && (
              <Card className="p-4 rounded-2xl border-zinc-800 bg-zinc-900/70 flex flex-col gap-4 h-full min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300 flex items-center gap-2">
                    <Target className="w-4 h-4 text-teal-400" /> Goal Tracking
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-500">{goalResult.modelId} · {goalResult.latencyMs}ms</span>
                </div>

                {goalSummary && (
                  <>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      {[
                        { label: "Achieved", value: goalSummary.achieved || 0, cls: "text-emerald-300" },
                        { label: "On track", value: goalSummary.onTrack || 0, cls: "text-teal-300" },
                        { label: "At risk", value: goalSummary.atRisk || 0, cls: "text-amber-300" },
                        { label: "Behind", value: (goalSummary.behind || 0) + (goalSummary.gap || 0), cls: "text-rose-300" },
                      ].map((b) => (
                        <div key={b.label} className="rounded-xl bg-zinc-950/60 border border-zinc-800 p-4">
                          <div className={`text-lg font-bold leading-none ${b.cls}`}>{b.value}</div>
                          <div className="text-[10px] text-zinc-500 mt-1">{b.label}</div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div className="h-full bg-teal-500 transition-all" style={{ width: `${goalDonePct}%` }} />
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1">{goalDonePct}% achieved or on track</p>
                    </div>
                  </>
                )}

                {goalSummary?.narrative && <p className="text-xs text-zinc-400 leading-relaxed">{goalSummary.narrative}</p>}

                <div className="grid gap-4">
                  {(goalResult.result.verdicts || []).map((v: any) => (
                    <div key={v.goalId} className="flex items-start justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-100 leading-snug">{v.goalText}</p>
                        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{v.reason}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant={verdictBadge(v.verdict) as any} statusText={String(v.verdict).replace("_", " ")} />
                        <span className="text-[11px] font-mono text-zinc-500">{Math.round((v.confidence || 0) * 100)}% sure</span>
                      </div>
                    </div>
                  ))}
                </div>

                {(goalResult.result.suggestions || []).length > 0 && (
                  <div className="space-y-1.5 border-t border-zinc-800 pt-3">
                    <p className="text-xs font-semibold text-zinc-300">Suggested next actions</p>
                    {goalResult.result.suggestions.map((s: any, i: number) => (
                      <p key={i} className="text-xs text-zinc-400 leading-relaxed">
                        <span className="font-mono text-teal-300">{s.action}</span> — {s.text}
                      </p>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {highlightResult?.result && (
              <Card className="p-4 rounded-2xl border-zinc-800 bg-zinc-900/70 flex flex-col gap-4 h-full min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" /> Monthly Highlights · {month}
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-500">{highlightResult.modelId} · {highlightResult.latencyMs}ms</span>
                </div>

                {highlightResult.result.summary && (
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="px-2 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-300">Trend: <span className="font-semibold text-zinc-100">{highlightResult.result.summary.trend}</span></span>
                    <span className="px-2 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-300">Top driver: <span className="font-semibold text-zinc-100">{highlightResult.result.summary.topDriver}</span></span>
                    <span className="px-2 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-300">{(highlightResult.result.highlights || []).length} highlights</span>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  {(highlightResult.result.highlights || []).map((h: any, idx: number) => {
                    const Arrow = arrowIcon(h.arrow);
                    return (
                      <div key={h.slot} className={`rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 flex flex-col gap-2 ${idx === 0 ? "sm:col-span-2" : ""}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">{h.slotLabel}</span>
                          <Arrow className={`w-4 h-4 shrink-0 ${h.arrow === "↑" ? "text-emerald-400" : h.arrow === "↓" ? "text-rose-400" : "text-zinc-400"}`} />
                        </div>
                        <p className="text-xs font-semibold text-zinc-100 leading-snug">{h.title}</p>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">{h.story}</p>
                        <div className="flex flex-wrap gap-1 mt-auto pt-1">
                          {h.delta?.quanti && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-teal-300 font-mono">{h.delta.quanti}</span>}
                          {h.delta?.quali && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">{h.delta.quali}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-600">Only evidence-backed moments are shown (3–7, never forced to 7). Slot numbers are internal and hidden.</p>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
