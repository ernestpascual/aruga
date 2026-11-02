"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { GenerateActivityAgentModal } from "@/components/activities/GenerateActivityAgentModal";
import {
  Sparkles,
  ArrowLeft,
  User,
  Brain,
  CheckCircle2,
  Pencil,
  RefreshCw,
  XCircle,
  Clock,
  Eye,
  Wand2,
  Layers,
  FileText,
  Palette,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Timer,
} from "lucide-react";

// Mock patients — what the agent sees via tool.fetch_patient
const MOCK_PATIENTS = [
  {
    id: "mock-pedia-1",
    name: "Leo Chen",
    age: 6,
    client_category: "pedia",
    ageBand: "pedia" as const,
    condition: "Pediatric Bilateral Coordination Delay & Pincer Grasp Development",
    goals: "Improve pincer grasp, bilateral hand use for play",
    priorThemes: ["farm", "shapes"],
    avatar: "🧒",
    color: "teal",
  },
  {
    id: "mock-adolescent-1",
    name: "Maya Lin",
    age: 15,
    client_category: "adolescent",
    ageBand: "adolescent" as const,
    condition: "Dynamic Tripod Grasp Fatigue & Academic Handwriting Posture",
    goals: "Sustain tripod grasp for school writing, executive function",
    priorThemes: ["graffiti", "planning"],
    avatar: "👩‍🎓",
    color: "violet",
  },
  {
    id: "mock-adult-1",
    name: "Marcus Vance",
    age: 58,
    client_category: "adult",
    ageBand: "adult" as const,
    condition: "Right ischemic CVA with upper extremity hemiparesis",
    goals: "Return-to-work writing, kitchen ADL, precision grip",
    priorThemes: ["signature", "kitchen"],
    avatar: "👨‍💼",
    color: "sky",
  },
  {
    id: "mock-geriatric-1",
    name: "Eleanor Reyes",
    age: 72,
    client_category: "geriatric",
    ageBand: "geriatric" as const,
    condition: "Low vision + mild hand tremor, medication management",
    goals: "Large-print handwriting, medication adherence, reminiscence",
    priorThemes: ["garden", "greetings"],
    avatar: "👵",
    color: "amber",
  },
];

type Draft = {
  id: string;
  title: string;
  instructions: string;
  visualBrief: string;
  refinedImagePrompt: string;
  ageBand: string;
  category: string;
  reasoning: string;
  source: string;
  base_image_url: string | null;
  estimatedMinutes: number;
  difficulty: string;
};

const MOCK_DRAFTS: Record<string, Draft> = {
  pedia: {
    id: "draft-pedia-1",
    title: "Peg Pick & Color Sort — Pedia",
    instructions: "Pick 5 colorful pegs with thumb+index pincer, match to slots. Say color aloud. Caregiver: praise big pinches!",
    visualBrief: "Pedia 2–12y worksheet: 5 large pegs (red/blue/yellow) in 2×3 grid, bold 4pt outlines, huge peg slots with color dots below. Minimal clutter, caregiver tips footer, A4 portrait.",
    refinedImagePrompt: "5 large pegs line art, 2×3 grid, thick bold outlines, color dots, no shading, A4 portrait, white bg, child-friendly vector style",
    ageBand: "pedia",
    category: "visual_motor",
    reasoning: "Picked Shape Sort & Trace template — large targets for Leo's pincer grasp; tailored for 6y bilateral delay, low clutter, 8mm spacing",
    source: "system:Shape Sort & Trace + patient:Leo 6y pedia",
    base_image_url: null,
    estimatedMinutes: 12,
    difficulty: "guided",
  },
  adolescent: {
    id: "draft-adolescent-1",
    title: "Campus Maze Challenge — Teen",
    instructions: "Find your way from Home to Classroom. Trace with steady pressure, pause at dead ends. Color-code paths afterward.",
    visualBrief: "Adolescent maze: campus Home→Classroom medium complexity, 3pt walls, start/end icons, winding paths, teen-friendly urban sketch, A4 portrait.",
    refinedImagePrompt: "Campus maze Home to Classroom, medium complexity, 3pt walls, start/end icons, black lines A4 portrait, puzzle design",
    ageBand: "adolescent",
    category: "visual_motor",
    reasoning: "Picked Maze Quest template — executive function + sustained grasp for Maya 15y; moderate detail, identity-relevant school theme",
    source: "system:Maze Quest: Campus Map + patient:Maya 15y adolescent",
    base_image_url: null,
    estimatedMinutes: 10,
    difficulty: "independent",
  },
  adult: {
    id: "draft-adult-1",
    title: "Signature Practice — Return to Work",
    instructions: "Practice signature on Seyes triple-lines: trace faded model, then write independently. Light grip, steady pace, 6 rows.",
    visualBrief: "Adult ADL handwriting: Seyes triple-line 6 rows, faded cursive exemplar left + dotted trace middle + blank right, professional tone, A4 portrait.",
    refinedImagePrompt: "Cursive signature triple-line paper, exemplar + trace + blank per row, 6 rows, professional handwriting, A4 portrait, clean formal",
    ageBand: "adult",
    category: "handwriting",
    reasoning: "Picked Cursive Connect template — RTW writing goal for Marcus 58y hemiparesis; triple-line guides support forearm stability",
    source: "system:Cursive Connect + patient:Marcus 58y adult CVA",
    base_image_url: null,
    estimatedMinutes: 15,
    difficulty: "guided",
  },
  geriatric: {
    id: "draft-geriatric-1",
    title: "Large-Print Greetings — Trace & Write",
    instructions: "Trace 'Happy Birthday' 36pt faded letters on triple-lines, then write independently. High contrast, generous whitespace.",
    visualBrief: "Geriatric 65y+: Happy Birthday/Thank You 36pt faded trace on triple-lines, wide spacing, 14pt instructions, warm off-white, low fatigue, A4 portrait.",
    refinedImagePrompt: "Large-print greetings 36pt trace triple-line, Happy Birthday/Thank You, wide spacing, faded+dotted+blank, high contrast A4 portrait, senior-friendly",
    ageBand: "geriatric",
    category: "handwriting",
    reasoning: "Picked Large-Print Greetings — 72y low vision + tremor: 36pt XL targets, high-contrast, low clutter, geriatric-safe",
    source: "system:Large-Print Greetings + patient:Eleanor 72y geriatric",
    base_image_url: null,
    estimatedMinutes: 15,
    difficulty: "guided",
  },
};

export default function ActivityAgentPlaygroundPage() {
  const [patientIdx, setPatientIdx] = useState(0);
  const patient = MOCK_PATIENTS[patientIdx];
  const [stepTitle, setStepTitle] = useState("Peg Pick & Sort");
  const [stepInstructions, setStepInstructions] = useState("Practice pincer grasp: pick 5 small pegs one by one using thumb + index finger, place into matching slots.");
  const [autoPending, setAutoPending] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [traceOpen, setTraceOpen] = useState(true);
  const [agentOpen, setAgentOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "analyzing" | "pending" | "approved" | "rejected">("idle");
  const [elapsedMs, setElapsedMs] = useState(0);

  // Auto-trigger simulation when step changes (debounced)
  useEffect(() => {
    if (!stepTitle.trim() && !stepInstructions.trim()) return;
    setStatus("analyzing");
    setDraft(null);
    setAutoPending(true);
    setElapsedMs(0);
    const start = Date.now();
    const timer = setInterval(() => setElapsedMs(Date.now() - start), 100);
    const t = setTimeout(() => {
      clearInterval(timer);
      const d = MOCK_DRAFTS[patient.ageBand] || MOCK_DRAFTS.pedia;
      // Personalize draft with current step title
      setDraft({ ...d, title: `${stepTitle || "Custom Activity"} — ${patient.ageBand}`, instructions: d.instructions });
      setStatus("pending");
      setAutoPending(false);
    }, 1400);
    return () => {
      clearTimeout(t);
      clearInterval(timer);
    };
  }, [stepTitle, stepInstructions, patient.ageBand]);

  function handleApprove() {
    setStatus("approved");
  }
  function handleReject() {
    setStatus("rejected");
    setDraft(null);
  }
  function handleRegenerate() {
    setStatus("analyzing");
    setAutoPending(true);
    setElapsedMs(0);
    const start = Date.now();
    const timer = setInterval(() => setElapsedMs(Date.now() - start), 100);
    setTimeout(() => {
      clearInterval(timer);
      setDraft(MOCK_DRAFTS[patient.ageBand]);
      setStatus("pending");
      setAutoPending(false);
    }, 1000);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/therapist/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <span className="hidden sm:block h-5 w-px bg-zinc-800" />
            <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center text-white">
              <Wand2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                Activity Agent Playground <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950 border border-amber-800 text-amber-300">DEMO • isolated</span>
              </h1>
              <p className="hidden sm:block text-[11px] text-zinc-500">Auto-generate pending approval — patient-aware • System / My / Custom</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-[11px] text-zinc-500">Demo route: /activity-agent-playground (also /activiy-agent-playground)</span>
            <Badge variant="teal" className="text-[11px]">Isolated</Badge>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="sticky top-14 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-10 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {[
            { n: 1, label: "Pick patient", sub: patient.name },
            { n: 2, label: "Edit step", sub: stepTitle.slice(0, 18) || "—" },
            { n: 3, label: "Agent drafts", sub: status === "analyzing" ? "analyzing…" : status },
            { n: 4, label: "Approve", sub: status === "pending" ? "pending" : status === "approved" ? "attached" : "—" },
          ].map((s) => (
            <div key={s.n} className="inline-flex items-center gap-2 shrink-0">
              <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold ${s.n <= (status === "idle" ? 1 : status === "analyzing" ? 3 : 4) ? "bg-teal-600 text-white" : "bg-zinc-800 text-zinc-500 border border-zinc-700"}`}>{s.n}</span>
              <span className="text-xs font-semibold text-zinc-300">{s.label}</span>
              <span className="text-[11px] text-zinc-500 hidden sm:inline">• {s.sub}</span>
              {s.n < 4 && <ChevronRight className="w-3 h-3 text-zinc-700" />}
            </div>
          ))}
          <span className="ml-auto text-[11px] text-zinc-500 hidden lg:inline-flex items-center gap-1.5">
            <Timer className="w-3 h-3" /> Agent typically 1.2–1.8s (Spark 6000 tok) + 10s if image
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {/* Top: Patient picker + what agent sees */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Patient picker */}
          <Card className="lg:col-span-1 border-zinc-800 bg-zinc-900/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs tracking-widest uppercase text-zinc-400 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-teal-400" /> 1. Patient (agent reads)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {MOCK_PATIENTS.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setPatientIdx(i)}
                    className={`p-3 rounded-xl border text-left transition-all ${i === patientIdx ? "bg-zinc-900 border-teal-500/50 ring-1 ring-teal-500/30" : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"}`}
                  >
                    <div className="text-lg">{p.avatar}</div>
                    <div className="text-xs font-semibold text-zinc-100 mt-1">{p.name}</div>
                    <div className="text-[11px] text-zinc-500">{p.age}y • {p.ageBand}</div>
                    <div className="mt-1 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 border border-zinc-700 text-zinc-400 capitalize">{p.ageBand}</div>
                  </button>
                ))}
              </div>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  {patient.avatar} {patient.name} <Badge variant="teal" className="text-[10px]">{patient.ageBand}</Badge>
                </div>
                <div className="text-[11px] text-zinc-400 leading-relaxed">
                  <span className="font-semibold text-zinc-300">Condition:</span> {patient.condition}
                </div>
                <div className="text-[11px] text-zinc-400">
                  <span className="font-semibold text-zinc-300">Goals:</span> {patient.goals}
                </div>
                <div className="flex flex-wrap gap-1">
                  {patient.priorThemes.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-500">
                      prior: {t}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] text-zinc-600 pt-1 border-t border-zinc-800">Agent tool: fetch_patient → list_templates (ageBand={patient.ageBand}) → generate_activity</div>
              </div>
            </CardContent>
          </Card>

          {/* Step editor */}
          <Card className="lg:col-span-2 border-zinc-800 bg-zinc-900/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs tracking-widest uppercase text-zinc-400 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-teal-400" /> 2. Home Program Step — edit to trigger agent
              </CardTitle>
              <p className="text-[11px] text-zinc-500">Therapist types title/instructions; agent auto-drafts (debounced) pending your approval. No PHI sent beyond ageBand/condition.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Step Title</label>
                  <Input value={stepTitle} onChange={(e) => setStepTitle(e.target.value)} className="text-xs bg-zinc-950 border-zinc-800" placeholder="e.g. Peg Pick & Sort" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Patient</label>
                  <div className="h-9 px-3 rounded-lg border border-zinc-800 bg-zinc-950 flex items-center gap-2 text-xs text-zinc-400">
                    {patient.avatar} {patient.name} — {patient.ageBand}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Instructions (what step asks client to do)</label>
                <Textarea value={stepInstructions} onChange={(e) => setStepInstructions(e.target.value)} rows={3} className="text-xs bg-zinc-950 border-zinc-800" placeholder="Practice pincer grasp..." />
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <Clock className="w-3 h-3" /> Auto-generates on edit (1.4s demo) • Real: POST /api/agent/activity/run (therapist_owns_patient) → Spark 6000 tok, efficient seeds
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agent trace + draft */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Trace */}
          <Card className="lg:col-span-2 border-zinc-800 bg-zinc-900/70">
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-xs tracking-widest uppercase text-zinc-400 flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-violet-400" /> 3. Agent trace (reasoning)
              </CardTitle>
              <button onClick={() => setTraceOpen(!traceOpen)} className="p-1 rounded-md text-zinc-500 hover:text-zinc-200">
                {traceOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              {status === "analyzing" && (
                <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-800/40 flex items-center gap-2 text-xs text-violet-200">
                  <Timer className="w-4 h-4 animate-spin" /> Agent analyzing {elapsedMs}ms — fetch_patient → list_templates → generate_activity…
                </div>
              )}
              {traceOpen && (
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                    <div className="font-semibold text-zinc-200">Thought</div>
                    <div className="text-zinc-400 leading-relaxed">Patient {patient.name} {patient.age}y {patient.ageBand}, condition: &ldquo;{patient.condition.slice(0, 60)}&hellip;&rdquo; Step &ldquo;{stepTitle}&rdquo; needs {patient.ageBand === "pedia" ? "large targets, bold outlines, low clutter" : patient.ageBand === "geriatric" ? "XL high-contrast, low fatigue" : "functional ADL context"}. Prior themes {patient.priorThemes.join(", ")} — avoid repeat.</div>
                    <div className="text-[11px] text-zinc-600">tool.fetch_patient ✓ • tool.list_templates({patient.ageBand}) → 5 candidates</div>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                    <div className="font-semibold text-zinc-200">Action</div>
                    <div className="text-zinc-400 font-mono text-[11px]">generate_activity(ageBand={patient.ageBand}, category=visual_motor, title=&quot;{stepTitle}&quot;, customSparkPrompt ~80ch, budget ≤1800ch, generateImage=true)</div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                      <Layers className="w-3 h-3" /> spark_prompt ≤420ch • image_prompt ≤320ch • seeds efficient
                    </div>
                  </div>
                  {draft && (
                    <div className="p-3 rounded-xl bg-teal-950/20 border border-teal-800/30 space-y-1.5">
                      <div className="font-semibold text-teal-200">Observation</div>
                      <div className="text-zinc-300 leading-relaxed">&ldquo;{draft.reasoning}&rdquo;</div>
                      <div className="text-[11px] text-zinc-500">source: {draft.source} • {draft.estimatedMinutes}min • {draft.difficulty}</div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={status === "analyzing"} className="h-7 text-xs gap-1.5 border-zinc-700 bg-zinc-800 text-zinc-300">
                  <RefreshCw className={`w-3 h-3 ${status === "analyzing" ? "animate-spin" : ""}`} /> Regenerate
                </Button>
                <span className="text-[11px] text-zinc-500">Regenerate → new draft, same patient context</span>
              </div>
            </CardContent>
          </Card>

          {/* Draft approval */}
          <Card className={`lg:col-span-3 border-zinc-800 ${status === "approved" ? "bg-teal-950/20 border-teal-800/40" : status === "rejected" ? "bg-zinc-900/40 opacity-60" : "bg-zinc-900/70"}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs tracking-widest uppercase text-zinc-400 flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-teal-400" /> 4. Draft — pending human approval
                {status === "pending" && <Badge variant="amber" className="text-[11px] ml-1">PENDING</Badge>}
                {status === "approved" && <Badge variant="teal" className="text-[11px] ml-1">APPROVED ✓ Attached</Badge>}
                {status === "rejected" && <Badge variant="outline" className="text-[11px] ml-1">REJECTED</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!draft && status !== "analyzing" && (
                <div className="py-10 text-center text-xs text-zinc-500">Edit step title/instructions to see agent draft</div>
              )}
              {status === "analyzing" && (
                <div className="py-10 text-center space-y-2">
                  <div className="mx-auto w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 grid place-items-center">
                    <Sparkles className="w-5 h-5 text-teal-400 animate-pulse" />
                  </div>
                  <div className="text-xs text-zinc-400">Agent drafting worksheet for {patient.name}… {elapsedMs}ms</div>
                </div>
              )}
              {draft && status !== "analyzing" && (
                <div className="space-y-4">
                  {/* Preview */}
                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-zinc-100">{draft.title}</div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">{draft.ageBand} • {draft.category} • {draft.estimatedMinutes}min • {draft.difficulty}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-950 border border-teal-800 text-teal-300 capitalize">{draft.ageBand}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                      <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                        <FileText className="w-3 h-3" /> Instructions (≤350ch, client-facing)
                      </div>
                      <div className="text-xs text-zinc-200 mt-1 leading-relaxed">{draft.instructions}</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                        <div className="font-semibold text-zinc-400 uppercase tracking-wide">Visual Brief (70–90w)</div>
                        <div className="text-zinc-300 mt-1 leading-relaxed">{draft.visualBrief}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                        <div className="font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                          <Palette className="w-3 h-3" /> Image
                        </div>
                        <div className="mt-2 w-full h-24 rounded-lg bg-white border border-zinc-200 grid place-items-center text-[11px] text-zinc-500">Line-art preview (Muse Image) would render here<br />A4 portrait • print-ready</div>
                        <div className="text-[11px] text-zinc-500 mt-1 font-mono line-clamp-2">{draft.refinedImagePrompt}</div>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-violet-950/20 border border-violet-800/30 text-[11px] text-violet-200">💡 Reasoning: {draft.reasoning}</div>
                  </div>

                  {/* Actions */}
                  {status === "pending" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={handleApprove} className="h-9 gap-1.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold">
                        <CheckCircle2 className="w-4 h-4" /> Approve & Attach to Step
                      </Button>
                      <Button variant="outline" onClick={() => setAgentOpen(true)} className="h-9 gap-1.5 text-xs border-zinc-700 bg-zinc-900 text-zinc-200">
                        <Pencil className="w-3.5 h-3.5" /> Edit in Agent
                      </Button>
                      <Button variant="outline" onClick={handleRegenerate} className="h-9 gap-1.5 text-xs border-zinc-700 bg-zinc-800 text-zinc-300">
                        <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                      </Button>
                      <Button variant="ghost" onClick={handleReject} className="h-9 gap-1.5 text-xs text-zinc-500 hover:text-red-400">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </Button>
                    </div>
                  )}
                  {status === "approved" && (
                    <div className="p-3 rounded-xl bg-teal-950/40 border border-teal-500/30 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-teal-400" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-teal-200">Approved — attached to Step (program_steps.generated_activity_id)</div>
                        <div className="text-[11px] text-teal-300/70 truncate">{draft.title} • client will draw/print with submission</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleReject} className="h-7 text-xs text-zinc-400">
                        Undo
                      </Button>
                    </div>
                  )}
                  {status === "rejected" && (
                    <div className="p-3 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center gap-2 text-xs text-zinc-400">
                      <AlertTriangle className="w-4 h-4 text-amber-400" /> Rejected — try editing step or pick manually in Agent.
                      <Button size="sm" onClick={() => setAgentOpen(true)} className="ml-auto h-7 text-xs bg-zinc-800 border border-zinc-700">
                        Open Agent
                      </Button>
                    </div>
                  )}
                  <div className="text-[11px] text-zinc-500 flex items-center gap-2">
                    <Wand2 className="w-3 h-3" /> Real flow: POST /api/agent/activity/run → draft → therapist approves only; Edit opens full System/My/Custom agent (existing GenerateActivityAgentModal) with prefilled patient data.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer demo notes */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">Demo only</span> — isolated route, mock data, no DB writes. Try all 4 patients + edit step to see agent adapt.{" "}
              <span className="text-zinc-500">Real implementation: add `POST /api/agent/activity/run` + wire into `StepActivityControl`.</span>
            </div>
            <Button size="sm" onClick={() => setAgentOpen(true)} variant="outline" className="h-8 text-xs gap-1.5 border-teal-500/40 text-teal-300">
              <Layers className="w-3.5 h-3.5" /> Open full Agent modal
            </Button>
          </CardContent>
        </Card>
      </main>

      {agentOpen && (
        <GenerateActivityAgentModal
          onClose={() => setAgentOpen(false)}
          onGenerated={() => {
            setAgentOpen(false);
            setStatus("approved");
          }}
          creatorId="demo-therapist"
          patientId={patient.id}
          defaultAgeBand={patient.ageBand}
          defaultTitle={stepTitle || "Demo Activity"}
          stepThemeHint={stepTitle + " " + stepInstructions.slice(0, 40)}
        />
      )}
    </div>
  );
}
