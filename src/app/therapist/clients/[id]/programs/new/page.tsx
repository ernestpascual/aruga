"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DraftProgramOutput } from "@/types/meta";

interface StepItem {
  id: string;
  position: number;
  title: string;
  instructions: string;
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
  const resolvedParams = use(params);
  const patientId = resolvedParams.id;

  const [title, setTitle] = useState("");
  const [mainInstructions, setMainInstructions] = useState("");
  const [discipline, setDiscipline] = useState<"SLP" | "OT" | "PT">("OT");
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
          rawInstructions: rawText || "Tabletop grasp and transfer exercise routine",
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

  // Save Program (Draft or Assign)
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
      // 1. Create program
      const res = await fetch("/api/therapist/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          title,
          mainInstructions,
          steps: steps.map((s) => ({ title: s.title, instructions: s.instructions })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save program.");
      }

      const createdProgramId = data.program.id;

      // 2. If assigning immediately, trigger assign transition
      if (action === "assign") {
        const assignRes = await fetch("/api/therapist/programs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "assign",
            programId: createdProgramId,
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
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Back button */}
      <div>
        <Link
          href={`/therapist/clients/${patientId}`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Client Record
        </Link>
      </div>

      {/* Editor Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-400" />
            Create Home Program
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Build ordered exercise steps. Freeze upon assignment to publish instructions to your client.
          </p>
        </div>

        {/* Refine with Meta Action */}
        <Button
          type="button"
          variant="outline"
          onClick={handleRefineWithMeta}
          className="gap-2 border-teal-500/50 bg-teal-950/40 text-teal-300 hover:bg-teal-900/60 shadow-sm self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4 text-teal-400" />
          <span>Refine with Meta</span>
        </Button>
      </div>

      {pageError && (
        <div className="rounded-lg bg-red-950/60 border border-red-800 p-3 text-xs text-red-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{pageError}</span>
        </div>
      )}

      {/* Program Details Card */}
      <Card className="border-zinc-800 bg-zinc-900/90 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Program Title *</label>
            <Input
              required
              placeholder="e.g. Tabletop Grasp & Precision Release Routine"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
          <label className="text-xs font-semibold text-zinc-300">Main Instructions / Routine Overview *</label>
          <Textarea
            required
            rows={3}
            placeholder="Explain the routine context, posture recommendations, and repetition pacing..."
            value={mainInstructions}
            onChange={(e) => setMainInstructions(e.target.value)}
          />
        </div>
      </Card>

      {/* Steps List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            Ordered Routine Steps ({steps.length})
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
            <Card key={step.id} className="border-zinc-800 bg-zinc-900/80 p-4 relative space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-zinc-800 text-teal-400 text-xs font-bold flex items-center justify-center">
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
                    className="h-8 max-w-xs text-xs font-medium"
                  />
                </div>

                {/* Move & Remove Controls */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMoveUp(index)}
                    className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none"
                    title="Move up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === steps.length - 1}
                    onClick={() => handleMoveDown(index)}
                    className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none"
                    title="Move down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={steps.length <= 1}
                    onClick={() => handleRemoveStep(step.id)}
                    className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none ml-1"
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
            </Card>
          ))}
        </div>
      </div>

      {/* Footer Submission Actions */}
      <div className="pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] text-zinc-500">
          Assignment locks title and steps and creates a client video submission shell.
        </span>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            isLoading={submitting}
            onClick={() => handleSave("draft")}
            className="gap-2 text-zinc-200"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </Button>

          <Button
            type="button"
            isLoading={submitting}
            onClick={() => handleSave("assign")}
            className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold"
          >
            <Send className="w-4 h-4" />
            Assign to Client
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
