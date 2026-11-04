"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Play, Sparkles, Send, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ReplayViewer } from "@/components/demo/ReplayViewer";

const CLIPS = [
  { src: "/demo/cup_grasp_transfer.mp4", label: "Cup grasp transfer" },
  { src: "/demo/tabletop_exercise.mp4", label: "Tabletop exercise" },
  { src: "/demo/block_stacking.mp4", label: "Block stacking" },
  { src: "/demo/washcloth_supination.mp4", label: "Washcloth supination" },
] as const;

const FLOW = ["Create program", "Do program", "Submit", "Feedback", "Results & replay"] as const;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return fileToDataUrl(new File([blob], "clip.mp4", { type: blob.type || "video/mp4" }));
}

export default function DemoHomeProgramPage() {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("Tabletop Grasp & Release — Demo Program");
  const [step1Title, setStep1Title] = useState("Cylindrical Cup Lift — hold 3s");
  const [step1Instructions, setStep1Instructions] = useState("Lift 8oz cup to mouth height with cylindrical grasp, hold 3 seconds, avoid trunk lean. Lower slowly. Repeat 5 reps.");
  const [worksheetTheme, setWorksheetTheme] = useState("Trace the cup path and color each successful lift. Keep wrist neutral.");
  const [ageBand, setAgeBand] = useState("adult");
  const [worksheet, setWorksheet] = useState<{ imageUrl: string | null; title?: string; instructions?: string } | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [videoSrc, setVideoSrc] = useState<string>(CLIPS[0].src);
  const [clientComment, setClientComment] = useState("Felt smoother than last week. Wrist stayed neutral on most reps.");
  const [worksheetDone, setWorksheetDone] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [feedback, setFeedback] = useState("Great control on the cup lifts — wrist stayed neutral and trunk lean was minimal. Keep the 3-second hold; next week we add a slightly heavier cup.");
  const [published, setPublished] = useState(false);

  const [biomech, setBiomech] = useState<any | null>(null);
  const [bioBusy, setBioBusy] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  async function handleGenerateWorksheet() {
    setGenBusy(true);
    setGenError(null);
    try {
      const res = await fetch("/api/activities/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ageBand, theme: worksheetTheme, titleOverride: "Cup Lift Worksheet", generateImage: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed — check MODEL_API_KEY / AI_MODE=live, or continue without an image.");
      setWorksheet({ imageUrl: data.activity?.base_image_url || null, title: data.activity?.title, instructions: data.activity?.instructions });
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenBusy(false);
    }
  }

  async function handleRunBiomech() {
    setBioBusy(true);
    setBioError(null);
    try {
      const videoDataUrl = await urlToDataUrl(videoSrc);
      const res = await fetch("/api/tools/biomech/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prescribedTitle: step1Title,
          prescribedInstructions: step1Instructions,
          therapistNeed: clientComment,
          ageBand,
          videoDataUrl,
        }),
      });
      const data = await res.json().catch(async () => ({ error: (await res.text()).slice(0, 300) }));
      if (!res.ok) throw new Error(data.error || "Biomech run failed.");
      setBiomech(data);
    } catch (e) {
      setBioError(e instanceof Error ? e.message : String(e));
    } finally {
      setBioBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-10">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/login" className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100"><ArrowLeft className="w-3.5 h-3.5" /> Login</Link>
            <span className="hidden sm:block h-5 w-px bg-zinc-800" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight flex items-center gap-2">Guided Home Program Demo <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-950 border border-teal-500/30 text-teal-300">No login needed</span></h1>
              <p className="hidden sm:block text-[11px] text-zinc-500 mt-0.5">Create → do → submit → feedback → replay. Live Meta AI where a key is present; preloaded clips so it never dead-ends.</p>
            </div>
          </div>
          <Link href="/demo/insights" className="text-xs text-violet-300 hover:text-violet-200 shrink-0">Insights playground →</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {FLOW.map((s, i) => (
            <React.Fragment key={s}>
              <button type="button" onClick={() => setStep(i)} className={`px-2.5 py-1 rounded-full text-[11px] font-mono border transition-colors ${step === i ? "bg-teal-950 border-teal-500/40 text-teal-300 font-bold" : i < step ? "bg-emerald-950/40 border-emerald-800 text-emerald-300" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
                {i + 1} {s}{i < step ? " ✓" : ""}
              </button>
              {i < FLOW.length - 1 && <span className="text-zinc-700 text-[11px]">→</span>}
            </React.Fragment>
          ))}
        </div>

        {step === 0 && (
          <Card className="p-5 border-zinc-800 bg-zinc-900/70 space-y-4">
            <h2 className="text-sm font-bold text-zinc-100">1 — Create home program</h2>
            <div className="space-y-3">
              <div><label className="text-xs font-semibold text-zinc-300">Program title</label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 text-xs bg-zinc-950 border-zinc-800" /></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-zinc-300">Step 1 — video step title</label><Input value={step1Title} onChange={(e) => setStep1Title(e.target.value)} className="mt-1 text-xs bg-zinc-950 border-zinc-800" /></div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300">Client age band</label>
                  <select value={ageBand} onChange={(e) => setAgeBand(e.target.value)} className="mt-1 w-full h-9 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100">
                    <option value="pedia">Pedia (1–11)</option><option value="adolescent">Adolescent (12–17)</option><option value="adult">Adult (18–54)</option><option value="geriatric">Geriatric (55+)</option>
                  </select>
                </div>
              </div>
              <div><label className="text-xs font-semibold text-zinc-300">Step 1 — instructions given to client</label><Textarea value={step1Instructions} onChange={(e) => setStep1Instructions(e.target.value)} rows={3} className="mt-1 text-xs bg-zinc-950 border-zinc-800 resize-none" /></div>
              <div><label className="text-xs font-semibold text-zinc-300">Step 2 — worksheet brief</label><Textarea value={worksheetTheme} onChange={(e) => setWorksheetTheme(e.target.value)} rows={2} className="mt-1 text-xs bg-zinc-950 border-zinc-800 resize-none" /></div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleGenerateWorksheet} disabled={genBusy} className="h-9 gap-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold">
                  {genBusy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</> : <><Wand2 className="w-3.5 h-3.5" /> Generate worksheet with Meta AI</>}
                </Button>
                <span className="text-[11px] text-zinc-500">Spark writes it, Muse Image draws it. No key? Skip — the flow continues.</span>
              </div>
              {genError && <p className="text-xs text-amber-300">{genError}</p>}
              {worksheet?.imageUrl ? (
                <img src={worksheet.imageUrl} alt={worksheet.title || "Generated worksheet"} className="w-full max-w-md rounded-lg border border-zinc-700 bg-white" />
              ) : worksheet ? (
                <p className="text-xs text-zinc-400">Spec generated ({worksheet.title || "worksheet"}) — image unavailable, instructions will carry the step.</p>
              ) : null}
            </div>
            <Button onClick={() => setStep(1)} className="h-10 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold">Continue to do program →</Button>
          </Card>
        )}

        {step === 1 && (
          <Card className="p-5 border-zinc-800 bg-zinc-900/70 space-y-4">
            <h2 className="text-sm font-bold text-zinc-100">2 — Do home program <span className="text-zinc-500 font-normal">({title})</span></h2>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-300">Step 1 · {step1Title}</p>
              <p className="text-xs text-zinc-400 leading-relaxed">{step1Instructions}</p>
              <div className="flex flex-wrap gap-1.5">
                {CLIPS.map((c) => (
                  <button key={c.src} type="button" onClick={() => setVideoSrc(c.src)} className={`px-2.5 py-1 rounded-full text-[11px] font-mono border ${videoSrc === c.src ? "bg-teal-950 border-teal-500/40 text-teal-300 font-bold" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>{c.label}</button>
                ))}
              </div>
              <video src={videoSrc} controls playsInline className="w-full max-w-lg rounded-xl border border-zinc-800 bg-black" />
              <div><label className="text-xs font-semibold text-zinc-300">How it felt (client comment)</label><Textarea value={clientComment} onChange={(e) => setClientComment(e.target.value)} rows={2} className="mt-1 text-xs bg-zinc-950 border-zinc-800 resize-none" /></div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
              <p className="text-xs font-semibold text-zinc-300">Step 2 · Worksheet</p>
              {worksheet?.imageUrl ? <img src={worksheet.imageUrl} alt="Worksheet" className="w-full max-w-md rounded-lg border border-zinc-700 bg-white" /> : <p className="text-xs text-zinc-500">No generated sheet — go back to Step 1 to generate one with Meta AI, or just mark it done here.</p>}
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer"><input type="checkbox" checked={worksheetDone} onChange={(e) => setWorksheetDone(e.target.checked)} className="accent-teal-500" /> Worksheet completed</label>
            </div>
            <Button onClick={() => setStep(2)} className="h-10 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold">Continue to submit →</Button>
          </Card>
        )}

        {step === 2 && (
          <Card className="p-5 border-zinc-800 bg-zinc-900/70 space-y-4 text-center">
            <Send className="w-8 h-8 text-teal-400 mx-auto" />
            <h2 className="text-sm font-bold text-zinc-100">3 — Submit home program</h2>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">Video clip, comment, and worksheet status are bundled as one submission for the therapist. In this demo nothing leaves your browser except the Meta calls you trigger.</p>
            <div className="text-left max-w-md mx-auto rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-1 text-xs text-zinc-400">
              <p>· Clip: <span className="text-zinc-200 font-mono">{videoSrc.split("/").pop()}</span></p>
              <p>· Comment: “{clientComment.slice(0, 90)}”</p>
              <p>· Worksheet: {worksheetDone ? "completed" : "not marked done"}</p>
            </div>
            <Button
              onClick={() => { setSubmitted(true); setStep(3); }}
              className="h-10 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
            >
              {submitted ? "Submitted ✓ — continue" : "Submit to therapist"}
            </Button>
          </Card>
        )}

        {step === 3 && (
          <Card className="p-5 border-zinc-800 bg-zinc-900/70 space-y-4">
            <h2 className="text-sm font-bold text-zinc-100">4 — Therapist feedback</h2>
            <p className="text-xs text-zinc-400">Sample published feedback for this submission. Edit it, then publish to see it on the replay screen.</p>
            <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} className="text-xs bg-zinc-950 border-zinc-800" />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setPublished(true); setStep(4); }} className="h-10 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Publish feedback & view results
              </Button>
              <Button variant="outline" onClick={() => setStep(4)} className="h-10 text-xs">Skip to results</Button>
            </div>
            {published && <p className="text-xs text-emerald-300">Published — visible on the replay screen below.</p>}
          </Card>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <Card className="p-4 border-zinc-800 bg-zinc-900/70 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-zinc-100">5 — Results & replay</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Replay shows segmentation, skeleton, 3D, and insights without re-running. Run it live once with your Meta key (+ Modal) to populate this screen.</p>
              </div>
              <Button onClick={handleRunBiomech} disabled={bioBusy} className="h-10 gap-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shrink-0">
                {bioBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Agent analyzing..</> : <><Play className="w-4 h-4" /> Run Biomechanic Agent live</>}
              </Button>
            </Card>
            {bioError && <Card className="p-3 border-amber-800/40 bg-amber-950/20 text-xs text-amber-200">{bioError} — feedback still replays below; biomech needs MODEL_API_KEY + MODAL_MHR_URL.</Card>}
            <ReplayViewer videoUrl={videoSrc} result={biomech} feedback={published ? { overall: feedback } : null} />
            <div className="flex flex-wrap gap-2">
              <Link href="/demo/insights"><Button variant="outline" className="h-9 text-xs gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Try Goal + Highlights agents</Button></Link>
              <Button variant="outline" onClick={() => setStep(0)} className="h-9 text-xs">Restart flow</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
