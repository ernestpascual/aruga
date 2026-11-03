"use client";

import React, { useState, use, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Save,
  Send,
  AlertCircle,
  CheckCircle2,
  X,
  Layers,
  HelpCircle,
  Calendar,
  Palette,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StepActivityControl } from "@/components/activities/StepActivityControl";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DraftProgramOutput } from "@/types/meta";
import { useAuth } from "@/lib/supabase/auth-context";

interface StepItem {
  id: string;
  position: number;
  title: string;
  instructions: string;
  generatedActivityId?: string | null;
  generatedActivity?: { id: string; title: string; base_image_url?: string | null } | null;
}

export default function NewHomeProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading program editor...</div>}>
      <NewHomeProgramContent params={params} />
    </React.Suspense>
  );
}

function NewHomeProgramContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  const patientId = resolvedParams.id;
  const editingProgramId = searchParams.get("edit") || searchParams.get("programId");
  const isEditing = Boolean(editingProgramId);
  const { user } = useAuth();
  const [loadingProgram, setLoadingProgram] = useState(false);
  const [editLoaded, setEditLoaded] = useState(false);

  const [title, setTitle] = useState("");
  const [mainInstructions, setMainInstructions] = useState("");
  const [discipline, setDiscipline] = useState<"SLP" | "OT" | "PT">("OT");
  const [scheduledDates, setScheduledDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState("");

  // Schedule builder — sessions + frequency + calendar pick
  const [sessionsCount, setSessionsCount] = useState<number>(3);
  const [frequency, setFrequency] = useState<"everyday" | "everyOtherDay" | "custom" | "pick">("everyday");
  const [customInterval, setCustomInterval] = useState<number>(3);
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [calendarCursor, setCalendarCursor] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const toISO = (d: Date) => d.toISOString().split("T")[0];
  const addDaysISO = (iso: string, days: number) => {
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + days);
    return toISO(d);
  };
  const buildDatesFromSchedule = (start: string, count: number, intervalDays: number) => {
    const out: string[] = [];
    for (let i = 0; i < count; i++) out.push(addDaysISO(start, i * intervalDays));
    return out;
  };
  const intervalForFrequency = () => {
    if (frequency === "everyday") return 1;
    if (frequency === "everyOtherDay") return 2;
    if (frequency === "custom") return Math.max(1, Math.min(30, customInterval || 1));
    return 1;
  };
  const handleGenerateSchedule = () => {
    const count = Math.max(1, Math.min(10, sessionsCount || 1));
    const interval = intervalForFrequency();
    if (!startDate) return;
    const generated = buildDatesFromSchedule(startDate, count, interval);
    setScheduledDates(generated);
  };
  const toggleCalendarDate = (iso: string) => {
    setScheduledDates((prev) => {
      if (prev.includes(iso)) return prev.filter((d) => d !== iso).sort();
      const limit = Math.max(1, Math.min(10, sessionsCount || 10));
      if (prev.length >= limit) return prev; // at cap — don't add
      return [...prev, iso].sort();
    });
  };
  const [steps, setSteps] = useState<StepItem[]>([
    {
      id: "step-1",
      position: 1,
      title: "Preparation & Alignment",
      instructions: "Sit upright at the table with forearms supported. Relax your shoulders.",
    },
    {
      id: "step-2",
      position: 2,
      title: "Active Target Grasp",
      instructions: "Reach forward toward the target object and secure a controlled cylindrical grasp.",
    },
  ]);

  // Load existing program when editing — uses same full-page UI as create
  useEffect(() => {
    if (!editingProgramId || editLoaded) return;
    let cancelled = false;
    setLoadingProgram(true);
    const load = async () => {
      try {
        const qs = user?.id ? `&requesterId=${user.id}` : "";
        const res = await fetch(`/api/therapist/programs?programId=${editingProgramId}${qs}`);
        const data = await res.json();
        const prog = data.program || data.programs?.find((p: { id: string }) => p.id === editingProgramId);
        if (!prog || cancelled) return;
        setTitle(prog.title || "");
        setMainInstructions(prog.main_instructions || "");
        if (prog.discipline) setDiscipline(prog.discipline as never);
        setScheduledDates(prog.scheduled_dates ? [...prog.scheduled_dates].sort() : []);
        if (Array.isArray(prog.steps) && prog.steps.length) {
          setSteps(
            prog.steps
              .slice()
              .sort((a: StepItem, b: StepItem) => (a.position || 0) - (b.position || 0))
              .map((s: StepItem) => ({
                id: s.id,
                position: s.position,
                title: s.title || `Step ${s.position}`,
                instructions: s.instructions || "",
                generatedActivityId: (s as unknown as { generated_activity_id?: string | null }).generated_activity_id || null,
                generatedActivity: (s as unknown as { generated_activity?: { id: string; title: string; base_image_url?: string | null } | null }).generated_activity || null,
              }))
          );
        }
        setEditLoaded(true);
      } catch (e) {
        console.warn("Failed to load program for edit:", e);
      } finally {
        if (!cancelled) setLoadingProgram(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [editingProgramId, user?.id, editLoaded]);

  // Refine with Meta modal state
  const [isRefineModalOpen, setIsRefineModalOpen] = useState(false);
  const [refineLoading, setRefineLoading] = useState(false);
  const [refineProposal, setRefineProposal] = useState<DraftProgramOutput | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Add Step
  const handleAddStep = () => {
    const nextPos = steps.length + 1;
    setSteps([
      ...steps,
      {
        id: `step-${Date.now()}`,
        position: nextPos,
        title: `Step ${nextPos}`,
        instructions: "",
      },
    ]);
  };

  // Remove Step
  const handleRemoveStep = (id: string) => {
    if (steps.length <= 1) return;
    const filtered = steps.filter((s) => s.id !== id);
    const reindexed = filtered.map((s, idx) => ({ ...s, position: idx + 1 }));
    setSteps(reindexed);
  };

  // Move Step Up
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const copy = [...steps];
    const temp = copy[index - 1];
    copy[index - 1] = copy[index];
    copy[index] = temp;
    setSteps(copy.map((s, idx) => ({ ...s, position: idx + 1 })));
  };

  // Move Step Down
  const handleMoveDown = (index: number) => {
    if (index === steps.length - 1) return;
    const copy = [...steps];
    const temp = copy[index + 1];
    copy[index + 1] = copy[index];
    copy[index] = temp;
    setSteps(copy.map((s, idx) => ({ ...s, position: idx + 1 })));
  };

  // Refine with Meta Muse Spark 1.3
  const handleRefineWithMeta = async () => {
    setRefineError(null);
    setRefineLoading(true);
    setIsRefineModalOpen(true);

    try {
      const rawText = `Title: ${title}\nOverview: ${mainInstructions}\n` +
        steps.map((s) => `Step ${s.position}: ${s.instructions}`).join("\n");

      const res = await fetch("/api/meta/draft-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInstructions: rawText || "Tabletop grasp and transfer home program",
          discipline,
          currentTitle: title,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to refine with Meta AI");
      }

      setRefineProposal(data);
    } catch (err: unknown) {
      setRefineError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefineLoading(false);
    }
  };

  // Explicitly Accept Proposed Changes
  const handleAcceptProposal = () => {
    if (!refineProposal) return;
    setTitle(refineProposal.title);
    setMainInstructions(refineProposal.mainInstructions);
    setSteps(
      refineProposal.steps.map((s, idx) => ({
        id: `step-${Date.now()}-${idx}`,
        position: s.position,
        title: s.title,
        instructions: s.instructions,
      }))
    );
    setIsRefineModalOpen(false);
    setRefineProposal(null);
  };

  const handleAddDate = (dateToAdd?: string) => {
    const val = (dateToAdd || newDateInput).trim();
    if (!val) return;
    if (scheduledDates.includes(val)) return;
    if (scheduledDates.length >= 10) return;
    setScheduledDates([...scheduledDates, val].sort());
    setNewDateInput("");
  };

  const handleRemoveDate = (dateToRemove: string) => {
    setScheduledDates(scheduledDates.filter((d) => d !== dateToRemove));
  };

  // Save Program (Draft or Assign) — supports both create and edit (draft with agent)
  const handleSave = async (action: "draft" | "assign") => {
    if (submitting) return;
    setPageError(null);

    if (!title.trim()) {
      setPageError("Program title is required.");
      return;
    }

    if (!mainInstructions.trim()) {
      setPageError("Main instructions overview is required.");
      return;
    }

    const invalidStep = steps.find((s) => !s.instructions.trim());
    if (invalidStep) {
      setPageError(`Step ${invalidStep.position} instructions cannot be empty.`);
      return;
    }

    setSubmitting(true);
    try {
      let requesterId: string | null = user?.id || null;
      if (!requesterId) {
        try {
          const { createClient: createSupabaseBrowserClient } = await import("@/lib/supabase/client");
          const supabase = createSupabaseBrowserClient();
          if (supabase) {
            const { data } = await supabase.auth.getSession();
            requesterId = data.session?.user?.id || null;
            if (!requesterId) {
              const { data: u } = await supabase.auth.getUser();
              requesterId = u.user?.id || null;
            }
          }
        } catch {}
      }
      if (!requesterId) {
        throw new Error("Not authenticated — please wait for sign-in to finish and retry (requesterId required).");
      }

      // Edit mode: update existing program via PATCH, keep draft-with-agent workflow
      if (isEditing && editingProgramId) {
        const patchRes = await fetch("/api/therapist/programs", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-requester-id": requesterId,
          },
          body: JSON.stringify({
            programId: editingProgramId,
            title: title.trim(),
            mainInstructions: mainInstructions.trim(),
            scheduledDates,
            steps: steps.map((s, idx) => ({
              id: s.id && !s.id.startsWith("step-") ? s.id : undefined,
              position: idx + 1,
              title: s.title.trim() || `Step ${idx + 1}`,
              instructions: s.instructions.trim(),
              generated_activity_id: s.generatedActivityId || undefined,
              generatedActivityId: s.generatedActivityId || undefined,
            })),
          }),
        });
        const patchData = await patchRes.json();
        if (!patchRes.ok) throw new Error(patchData.error || "Failed to update program.");

        if (action === "assign") {
          const assignRes = await fetch("/api/therapist/programs", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-requester-id": requesterId,
            },
            body: JSON.stringify({
              action: "assign",
              programId: editingProgramId,
              requesterId,
              creatorId: requesterId,
              therapistId: requesterId,
            }),
          });
          if (!assignRes.ok) {
            const ad = await assignRes.json();
            throw new Error(ad.error || "Failed to assign program.");
          }
        }
        router.push(`/therapist/clients/${patientId}`);
        return;
      }

      // Create mode (original)
      const res = await fetch("/api/therapist/programs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-requester-id": requesterId,
        },
        body: JSON.stringify({
          patientId,
          title,
          mainInstructions,
          scheduledDates,
          steps: steps.map((s) => ({ title: s.title, instructions: s.instructions, generated_activity_id: s.generatedActivityId || undefined, generatedActivityId: s.generatedActivityId || undefined })),
          requesterId,
          creatorId: requesterId,
          therapistId: requesterId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save program.");

      const createdProgramId = data.program.id;

      if (action === "assign") {
        const assignRes = await fetch("/api/therapist/programs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-requester-id": requesterId,
          },
          body: JSON.stringify({
            action: "assign",
            programId: createdProgramId,
            requesterId,
            creatorId: requesterId,
            therapistId: requesterId,
          }),
        });
        if (!assignRes.ok) {
          const assignData = await assignRes.json();
          throw new Error(assignData.error || "Failed to assign program.");
        }
      }

      router.push(`/therapist/clients/${patientId}`);
    } catch (err: unknown) {
      setPageError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl mx-auto pb-12 px-0">
      {/* Back button */}
      <div>
        <Link
          href={`/therapist/clients/${patientId}`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Client Record
        </Link>
      </div>

      {/* Editor Header — same full-page UI for create & edit, draft with agent allowed in both */}
      <div className="flex flex-col gap-3 border-b border-zinc-800 pb-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-teal-950/40 border border-teal-500/20 grid place-items-center shrink-0">
              <Layers className="w-5 h-5 text-teal-400" />
            </span>
            {isEditing ? "Edit Home Program" : "Create Home Program"}
            {isEditing && <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">Draft • Agent available</span>}
          </h1>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            {isEditing
              ? "Update title, instructions, schedule or steps. Save as draft to keep editing with the agent, or re-assign when ready. Draft keeps agent refine available."
              : "Build ordered exercise steps. Freeze upon assignment to publish instructions."}
          </p>
          {loadingProgram && <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-zinc-600 border-t-teal-500 rounded-full animate-spin" /> Loading program for edit…</p>}
        </div>


      </div>

      {pageError && (
        <div className="rounded-lg bg-red-950/60 border border-red-800 p-3 text-xs text-red-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{pageError}</span>
        </div>
      )}

      {/* Program Details Card */}
      <Card className="border-zinc-800 bg-zinc-900/90 p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Program Title *</label>
            <Input
              required
              placeholder="e.g. Tabletop Grasp & Precision Release Home Program"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Discipline</label>
            <select
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value as "SLP" | "OT" | "PT")}
              className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <option value="OT">Occupational Therapy (OT)</option>
              <option value="PT">Physical Therapy (PT)</option>
              <option value="SLP">Speech-Language Pathology (SLP)</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300">Main Instructions / Home Program Overview *</label>
          <Textarea
            required
            rows={3}
            placeholder="Explain the home program context, posture recommendations, and repetition pacing..."
            value={mainInstructions}
            onChange={(e) => setMainInstructions(e.target.value)}
            className="text-sm"
          />
        </div>
      </Card>

      {/* Practice Schedule — sessions + frequency + calendar pick */}
      <Card className="border-zinc-800 bg-zinc-900/90 p-4 sm:p-5 space-y-4 overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-zinc-800/80 pb-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-400" />
              Practice Schedule
            </h3>
            <Badge
              variant={scheduledDates.length >= sessionsCount ? "amber" : "teal"}
              statusText={`${scheduledDates.length}/${Math.max(1, Math.min(10, sessionsCount || 1))} sessions`}
            />
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Choose how many sessions and how they recur, then auto-fill dates or tap the calendar to pick. Each date = 1 submission (max 10).
          </p>
        </div>

        {/* Builder controls: sessions + frequency + start */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:p-3.5 space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-3 space-y-1.5">
              <label className="text-[11px] font-semibold tracking-wide uppercase text-zinc-400 flex items-center gap-1">
                <Clock3 className="w-3 h-3 text-zinc-500" /> How many sessions?
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSessionsCount((v) => Math.max(1, (v || 1) - 1))}
                  className="w-9 h-9 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 grid place-items-center shrink-0"
                  aria-label="Decrease sessions"
                >
                  −
                </button>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={sessionsCount}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setSessionsCount(Number.isFinite(n) ? Math.max(1, Math.min(10, n)) : 1);
                  }}
                  className="text-center font-mono text-sm h-9 bg-zinc-900 border-zinc-800"
                />
                <button
                  type="button"
                  onClick={() => setSessionsCount((v) => Math.min(10, (v || 1) + 1))}
                  className="w-9 h-9 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 grid place-items-center shrink-0"
                  aria-label="Increase sessions"
                >
                  +
                </button>
              </div>
              <p className="text-[10px] text-zinc-500">1–10 sessions.</p>
            </div>

            <div className="lg:col-span-5 space-y-1.5">
              <label className="text-[11px] font-semibold tracking-wide uppercase text-zinc-400">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as never)}
                className="flex h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <option value="everyday">Every day</option>
                <option value="everyOtherDay">Every other day</option>
                <option value="custom">Every X days (custom)</option>
                <option value="pick">Pick on calendar</option>
              </select>
              {frequency === "custom" && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-zinc-400">Every</span>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={customInterval}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setCustomInterval(Number.isFinite(n) ? Math.max(1, Math.min(30, n)) : 1);
                    }}
                    className="w-20 h-8 text-center font-mono text-sm bg-zinc-900 border-zinc-800"
                  />
                  <span className="text-xs text-zinc-400">day(s)</span>
                </div>
              )}
            </div>

            <div className="lg:col-span-4 space-y-1.5">
              <label className="text-[11px] font-semibold tracking-wide uppercase text-zinc-400">Start date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-xs h-9 text-zinc-200"
              />
              {frequency !== "pick" ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleGenerateSchedule}
                  className="w-full gap-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold h-9 text-xs"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Generate {Math.max(1, Math.min(10, sessionsCount))} dates ({frequency === "everyday" ? "daily" : frequency === "everyOtherDay" ? "every 2 days" : `every ${Math.max(1, Math.min(30, customInterval))} days`})
                </Button>
              ) : (
                <p className="text-[11px] text-zinc-500 pt-1 leading-relaxed">Tap dates on the calendar below — it stops at {sessionsCount} picks.</p>
              )}
            </div>
          </div>

          {/* Quick manual add + quick presets retained */}
          <div className="flex gap-2">
            <Input
              type="date"
              value={newDateInput}
              onChange={(e) => setNewDateInput(e.target.value)}
              className="flex-1 bg-zinc-950 border-zinc-800 text-xs h-10 sm:h-9 text-zinc-200"
              disabled={scheduledDates.length >= Math.max(1, Math.min(10, sessionsCount || 10))}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddDate()}
              disabled={!newDateInput || scheduledDates.length >= Math.max(1, Math.min(10, sessionsCount || 10))}
              className="shrink-0 h-10 sm:h-9 gap-1 text-xs border-teal-500/40 text-teal-300 hover:bg-teal-950/30 px-4"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none snap-x -mx-1 px-1 pb-1">
            <span className="text-[11px] text-zinc-500 shrink-0 mr-1">Quick:</span>
            {[
              { label: "Today", days: 0 },
              { label: "+1 Day", days: 1 },
              { label: "+2 Days", days: 2 },
              { label: "+3 Days", days: 3 },
              { label: "+1 Wk", days: 7 },
            ].map((preset) => {
              const d = new Date();
              d.setDate(d.getDate() + preset.days);
              const dateStr = d.toISOString().split("T")[0];
              const alreadyAdded = scheduledDates.includes(dateStr);
              const atCap = scheduledDates.length >= Math.max(1, Math.min(10, sessionsCount || 10));
              return (
                <button
                  key={preset.label}
                  type="button"
                  disabled={alreadyAdded || atCap}
                  onClick={() => handleAddDate(dateStr)}
                  className={`snap-start shrink-0 px-2.5 py-2 sm:py-1.5 rounded-lg text-[11px] font-mono border transition-colors whitespace-nowrap ${
                    alreadyAdded ? "opacity-40 border-zinc-800 text-zinc-600 cursor-not-allowed" : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-teal-500/50 hover:text-teal-300"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Calendar — click to select exactly sessionsCount dates */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCalendarCursor((d) => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}
                className="w-7 h-7 grid place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-zinc-100 min-w-[140px] text-center">
                {calendarCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <button
                type="button"
                onClick={() => setCalendarCursor((d) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}
                className="w-7 h-7 grid place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-zinc-400"><span className="w-3 h-3 rounded bg-teal-500/30 border border-teal-500/50 inline-block" /> Selected</span>
              <button
                type="button"
                onClick={() => setScheduledDates([])}
                disabled={scheduledDates.length === 0}
                className="px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 text-xs"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Two-month grid on desktop, single on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((offset) => {
              const base = new Date(calendarCursor);
              base.setMonth(base.getMonth() + offset);
              const year = base.getFullYear();
              const month = base.getMonth();
              const firstDow = new Date(year, month, 1).getDay(); // 0 Sun
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const todayISO = new Date().toISOString().split("T")[0];
              const cells: Array<number | null> = [];
              for (let i = 0; i < firstDow; i++) cells.push(null);
              for (let d = 1; d <= daysInMonth; d++) cells.push(d);
              // pad to 6 rows for stable height
              while (cells.length < 42) cells.push(null);
              // hide second month on very small screens via CSS — we handle with grid md:grid-cols-2, mobile will stack
              return (
                <div key={`${year}-${month}`} className={offset === 1 ? "hidden md:block" : "block"}>
                  <div className="text-[11px] font-semibold text-zinc-300 text-center mb-2">
                    {base.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-[11px] text-zinc-500 text-center mb-1">
                    {["S","M","T","W","T","F","S"].map((w, i) => <div key={`${w}-${i}-${offset}`} className="py-1 font-medium">{w}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((dayNum, idx) => {
                      if (dayNum === null) return <div key={`e-${offset}-${idx}`} className="h-8 sm:h-7" />;
                      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                      const isSelected = scheduledDates.includes(iso);
                      const isToday = iso === todayISO;
                      const atCap = scheduledDates.length >= Math.max(1, Math.min(10, sessionsCount || 10));
                      const disabled = !isSelected && atCap;
                      return (
                        <button
                          key={iso}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleCalendarDate(iso)}
                          className={`h-8 sm:h-7 rounded-lg text-xs font-mono border flex items-center justify-center transition-colors
                            ${isSelected ? "bg-teal-500 text-zinc-950 border-teal-400 font-semibold shadow-[0_0_0_1px_rgba(20,184,166,0.5)]" : `bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-teal-500/40 hover:text-teal-200 ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
                            ${isToday && !isSelected ? "ring-1 ring-teal-500/40 border-teal-500/20" : ""}`}
                          title={iso}
                        >
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-zinc-500 text-center sm:hidden">Showing 1 month on mobile — use arrows to browse. Second month visible on tablet/desktop.</p>
        </div>

        {/* Selected Dates Badges */}
        {scheduledDates.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {scheduledDates.map((dateStr, idx) => (
              <div key={dateStr} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-teal-500/30 text-xs text-zinc-200">
                <span className="font-semibold text-teal-400">Date {idx + 1}:</span>
                <span className="font-mono">{dateStr}</span>
                <span className="text-[10px] text-zinc-500">(1 submission)</span>
                <button type="button" onClick={() => handleRemoveDate(dateStr)} className="text-zinc-500 hover:text-red-400 transition-colors ml-1"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 italic pt-1">No dates selected yet. Generate from frequency above or tap the calendar — empty schedule means 1 submission for the whole program.</p>
        )}
      </Card>

      {/* Steps List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            Ordered Home Program Steps ({steps.length})
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddStep}
            className="gap-1.5 text-xs text-zinc-200"
          >
            <Plus className="w-3.5 h-3.5 text-teal-400" />
            Add Step
          </Button>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <Card key={step.id} className="border-zinc-800 bg-zinc-900/80 p-3 sm:p-4 relative space-y-3 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-zinc-800 text-teal-400 text-xs font-bold flex items-center justify-center shrink-0">
                    {step.position}
                  </span>
                  <Input
                    placeholder={`Step ${step.position} Title (optional)`}
                    value={step.title}
                    onChange={(e) => {
                      const updated = [...steps];
                      updated[index].title = e.target.value;
                      setSteps(updated);
                    }}
                    className="h-9 sm:h-8 flex-1 min-w-0 text-sm sm:text-xs font-medium"
                  />
                </div>

                {/* Move & Remove Controls */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMoveUp(index)}
                    className="w-8 h-8 sm:w-7 sm:h-7 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none"
                    title="Move up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === steps.length - 1}
                    onClick={() => handleMoveDown(index)}
                    className="w-8 h-8 sm:w-7 sm:h-7 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none"
                    title="Move down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={steps.length <= 1}
                    onClick={() => handleRemoveStep(step.id)}
                    className="w-8 h-8 sm:w-7 sm:h-7 grid place-items-center rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none ml-1"
                    title="Remove step"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <Textarea
                  required
                  rows={2}
                  placeholder={`Write clear, specific instructions for Step ${step.position}...`}
                  value={step.instructions}
                  onChange={(e) => {
                    const updated = [...steps];
                    updated[index].instructions = e.target.value;
                    setSteps(updated);
                  }}
                  className="text-xs"
                />
              </div>
              <StepActivityControl
                patientId={patientId}
                step={step}
                stepIndex={index}
                steps={steps}
                setSteps={setSteps}
                creatorId={user?.id}
              />
            </Card>
          ))}
        </div>
      </div>

      {/* Footer Submission Actions */}
      <div className="pt-4 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-[11px] text-zinc-500 order-2 sm:order-1 text-center sm:text-left">
          Assignment locks title and steps and creates a client submission.
        </span>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3 order-1 sm:order-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            isLoading={submitting}
            disabled={loadingProgram}
            onClick={() => handleSave("draft")}
            className="gap-2 text-zinc-200 h-10 sm:h-9 text-xs justify-center"
          >
            <Save className="w-4 h-4" />
            {isEditing ? "Update Draft" : "Save Draft"}
          </Button>

          <Button
            type="button"
            isLoading={submitting}
            disabled={loadingProgram}
            onClick={() => handleSave("assign")}
            className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold h-10 sm:h-9 text-xs justify-center"
          >
            <Send className="w-4 h-4" />
            {isEditing ? "Update & Re-Assign" : "Assign to Client"}
          </Button>
        </div>
      </div>

      {/* Refine with Meta Modal */}
      {isRefineModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl border-zinc-800 bg-zinc-900 shadow-2xl relative max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <button
              onClick={() => setIsRefineModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100 p-1 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>

            <CardHeader className="pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-teal-400" />
                <CardTitle className="text-base text-zinc-100">
                  Refine with Meta Muse Spark 1.3
                </CardTitle>
              </div>
              <p className="text-xs text-zinc-400">
                Restructures your rough notes into patient-accessible steps. Review and explicitly accept before replacing.
              </p>
            </CardHeader>

            <CardContent className="overflow-y-auto flex-1 p-5 space-y-4">
              {refineLoading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                  <p className="text-xs text-zinc-400">Processing instructions with Muse Spark 1.3...</p>
                </div>
              ) : refineError ? (
                <div className="rounded-lg bg-red-950/60 border border-red-800 p-4 text-xs text-red-200">
                  <p className="font-semibold mb-1">Refinement Failed</p>
                  <p>{refineError}</p>
                </div>
              ) : refineProposal ? (
                <div className="space-y-4">
                  {/* Model warnings if any */}
                  {refineProposal.warnings.length > 0 && (
                    <div className="rounded-lg bg-amber-950/40 border border-amber-800/80 p-3 text-xs text-amber-200 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Clinical Notes & Ambiguities Flagged:</span>
                      </div>
                      <ul className="list-disc list-inside text-[11px] text-amber-300/90 pl-1">
                        {refineProposal.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Proposed Title */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase">Proposed Title</span>
                    <p className="text-sm font-semibold text-zinc-100 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                      {refineProposal.title}
                    </p>
                  </div>

                  {/* Proposed Main Instructions */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase">Proposed Main Instructions</span>
                    <p className="text-xs text-zinc-300 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 leading-relaxed">
                      {refineProposal.mainInstructions}
                    </p>
                  </div>

                  {/* Proposed Steps */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase">
                      Proposed Steps ({refineProposal.steps.length})
                    </span>
                    <div className="space-y-2">
                      {refineProposal.steps.map((st) => (
                        <div key={st.position} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                          <span className="text-xs font-semibold text-teal-400">
                            Step {st.position}: {st.title}
                          </span>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {st.instructions}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>

            <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                Existing instructions will not be replaced until you click accept.
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsRefineModalOpen(false)}
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  disabled={!refineProposal || refineLoading}
                  onClick={handleAcceptProposal}
                  className="gap-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Accept Proposed Changes
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
