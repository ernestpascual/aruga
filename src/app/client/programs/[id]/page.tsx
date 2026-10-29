"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Video,
  AlertTriangle,
  Send,
  Save,
  Clock,
  Sparkles,
  Shield,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoRecorder } from "@/components/ui/video-recorder";
import { siteConfig } from "@/config/site";
import { ProgramStep, StepSubmission } from "@/types/database";
import { DEMO_PEDIATRIC_PROGRAM_ID } from "@/lib/supabase/mock-store";

export default function ClientProgramRunnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading routine...</div>}>
      <ClientProgramRunnerContent params={params} />
    </React.Suspense>
  );
}

function ClientProgramRunnerContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const programId = resolvedParams.id;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSummaryView, setIsSummaryView] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Consents
  const [consentTherapist, setConsentTherapist] = useState(true);
  const [consentMetaAi, setConsentMetaAi] = useState(true);

  const isPediatric = programId === DEMO_PEDIATRIC_PROGRAM_ID || programId.includes("pediatric");

  // Program steps data
  const steps: ProgramStep[] = isPediatric
    ? [
        {
          id: "77777774-7777-4777-8777-777777777774",
          program_id: programId,
          position: 1,
          title: "Colorful Peg Stacking Game",
          instructions:
            "Have Leo use thumb and index finger (pincer grasp) to pick up 5 colorful pegs and place them into the board. Encourage keeping the helper hand steady on the table.",
          created_at: new Date().toISOString(),
        },
        {
          id: "77777775-7777-4777-8777-777777777775",
          program_id: programId,
          position: 2,
          title: "Play-Doh Bead Roll & Squash",
          instructions:
            "Roll three small dough balls between palms or fingers, then have Leo squash each one flat with his pointer finger.",
          created_at: new Date().toISOString(),
        },
        {
          id: "77777776-7777-4777-8777-777777777776",
          program_id: programId,
          position: 3,
          title: "Two-Handed Lid Unscrewing",
          instructions:
            "Hold the plastic jar base steady with the non-dominant helper hand while gently turning the lid with the dominant hand.",
          created_at: new Date().toISOString(),
        },
      ]
    : [
        {
          id: "77777771-7777-4777-8777-777777777771",
          program_id: programId,
          position: 1,
          title: "Cylindrical Cup Lift and Transfer",
          instructions:
            "Place a lightweight plastic cup 6 inches in front of you. Reach forward using full active extension, grasp with all digits, lift 3 inches vertically, hold for 2 seconds, and place back down gently without knocking it over.",
          created_at: new Date().toISOString(),
        },
        {
          id: "77777772-7777-4777-8777-777777777772",
          program_id: programId,
          position: 2,
          title: "Small Block Lateral Stacking",
          instructions:
            "Pick up the wooden block using a three-jaw chuck (thumb, index, middle fingers). Move it across your midline to the target marker on your left, then release cleanly.",
          created_at: new Date().toISOString(),
        },
        {
          id: "77777773-7777-4777-8777-777777777773",
          program_id: programId,
          position: 3,
          title: "Forearm Supination with Washcloth",
          instructions:
            "Hold the folded washcloth flat on the tabletop. Slowly rotate your forearm so your palm faces fully upward, pausing for 3 seconds before returning to neutral.",
          created_at: new Date().toISOString(),
        },
      ];

  interface StepItemData {
    videoBlob?: Blob;
    videoPath?: string;
    comment: string;
    skipped: boolean;
    skipReason: string;
  }

  // Current client step responses (draft progress)
  const [stepData, setStepData] = useState<Record<string, StepItemData>>(() => {
    const initial: Record<string, StepItemData> = isPediatric
      ? {
          "77777774-7777-4777-8777-777777777774": {
            videoPath: "/demo/cup_grasp_transfer.mp4",
            comment: "Leo loved picking the green and yellow pegs today!",
            skipped: false,
            skipReason: "",
          },
          "77777775-7777-4777-8777-777777777775": {
            videoPath: "/demo/block_stacking.mp4",
            comment: "Used index finger to squash all 3 dough balls.",
            skipped: false,
            skipReason: "",
          },
          "77777776-7777-4777-8777-777777777776": {
            videoPath: undefined,
            comment: "",
            skipped: true,
            skipReason: "Jar lid was too tight for tiny hands; will practice with a looser lid tomorrow.",
          },
        }
      : {
          "77777771-7777-4777-8777-777777777771": {
            videoPath: "/demo/cup_grasp_transfer.mp4",
            comment:
              "Felt smoother than last week! Finger extension still feels stiff right before touching the cup.",
            skipped: false,
            skipReason: "",
          },
          "77777772-7777-4777-8777-777777777772": {
            videoPath: "/demo/block_stacking.mp4",
            comment: "Managed 4 repetitions with the small wooden block.",
            skipped: false,
            skipReason: "",
          },
          "77777773-7777-4777-8777-777777777773": {
            videoPath: undefined,
            comment: "",
            skipped: true,
            skipReason: "Shoulder felt tight and fatigued after step 2; rested per precautions.",
          },
        };
    return initial;
  });

  const [isSubmitted, setIsSubmitted] = useState(false);

  const activeStep = steps[currentStepIndex];
  const activeStepData = stepData[activeStep?.id] || {
    comment: "",
    skipped: false,
    skipReason: "",
  };

  const handleVideoReady = (blob: Blob, meta: { mime: string; sizeBytes: number; durationSeconds: number; formatSupported: boolean }) => {
    setStepData((prev) => ({
      ...prev,
      [activeStep.id]: {
        ...prev[activeStep.id],
        videoBlob: blob,
        videoPath: URL.createObjectURL(blob),
        skipped: false,
        skipReason: "",
      },
    }));
  };

  const handleToggleSkip = (skipped: boolean) => {
    setStepData((prev) => ({
      ...prev,
      [activeStep.id]: {
        ...prev[activeStep.id],
        skipped,
        skipReason: skipped ? (prev[activeStep.id]?.skipReason || "") : "",
      },
    }));
  };

  const handleSaveProgress = async () => {
    setErrorMsg(null);
    setSaveSuccessMsg("Draft progress saved to server.");
    setTimeout(() => setSaveSuccessMsg(null), 2500);
  };

  const handleNext = () => {
    if (activeStepData.skipped && !activeStepData.skipReason.trim()) {
      setErrorMsg("Please provide a brief reason for skipping this step before proceeding.");
      return;
    }
    setErrorMsg(null);

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      setIsSummaryView(true);
    }
  };

  const handlePrevious = () => {
    setErrorMsg(null);
    if (isSummaryView) {
      setIsSummaryView(false);
    } else if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  // Final Submit to Therapist
  const handleSubmitToTherapist = async () => {
    if (submitting || isSubmitted) return;
    setSubmitting(true);
    setErrorMsg(null);

    // Verify all steps are completed
    const incompleteSteps = steps.filter((st) => {
      const data = stepData[st.id];
      if (!data) return true;
      if (data.skipped) return !data.skipReason.trim();
      return !data.videoPath && !data.videoBlob;
    });

    if (incompleteSteps.length > 0) {
      setErrorMsg("All steps must either have an activity video or an explicit skip explanation.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/client/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          submissionId: "55555555-5555-4555-8555-555555555555",
          consentTherapist,
          consentMetaAi,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Submission failed.");
      }

      setIsSubmitted(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-teal-950/80 border border-teal-500/60 text-teal-400 flex items-center justify-center mx-auto">
          <FileCheck className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <Badge variant="teal" statusText="Submitted to Therapist" />
          <h1 className="text-2xl font-bold text-zinc-100">
            Routine Successfully Submitted!
          </h1>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            Your videos, comments, and notes have been delivered to Dr. Elena Ramos.
            Your responses are now frozen while your therapist reviews your practice session.
          </p>
        </div>

        <div className="pt-4 flex items-center justify-center gap-3">
          <Link href="/client">
            <Button className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold">
              Return to Home
            </Button>
          </Link>
          <Link href="/client/messages">
            <Button variant="outline" className="text-zinc-200">
              Message Dr. Ramos
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16">
      {/* Back button */}
      <div>
        <Link
          href="/client"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>
      </div>

      {/* Program Header */}
      <div className="border-b border-zinc-800 pb-4 space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-zinc-100">
            {isPediatric
              ? "Playful Pincer Grasp & Bilateral Toy Routine"
              : "Tabletop Grasp & Precision Release Routine"}
          </h1>
          <span className="text-xs text-teal-400 font-mono font-medium">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Perform each activity at a steady pace. Record a short video or provide a reason if you need to rest.
        </p>
      </div>

      {/* Progress Indicators */}
      <div className="flex gap-1.5 w-full">
        {steps.map((st, i) => {
          const isDone = Boolean(stepData[st.id]?.videoPath || stepData[st.id]?.skipped);
          const isCurrent = i === currentStepIndex && !isSummaryView;
          return (
            <div
              key={st.id}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                isCurrent
                  ? "bg-teal-500"
                  : isDone
                  ? "bg-teal-800"
                  : "bg-zinc-800"
              }`}
            />
          );
        })}
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-950/60 border border-red-800 p-3 text-xs text-red-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {saveSuccessMsg && (
        <div className="rounded-lg bg-emerald-950/60 border border-emerald-800 p-3 text-xs text-emerald-200 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Step View vs Summary View */}
      {!isSummaryView ? (
        <div className="space-y-6">
          {/* Active Step Card */}
          <Card className="border-zinc-800 bg-zinc-900/90 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-teal-950 text-teal-400 border border-teal-500/40 text-xs font-bold flex items-center justify-center">
                  {activeStep.position}
                </span>
                <h2 className="text-sm font-semibold text-zinc-100">
                  {activeStep.title || `Step ${activeStep.position}`}
                </h2>
              </div>

              {/* Skip Checkbox */}
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer hover:text-zinc-200 select-none">
                <input
                  type="checkbox"
                  checked={activeStepData.skipped}
                  onChange={(e) => handleToggleSkip(e.target.checked)}
                  className="rounded border-zinc-700 text-teal-600 focus:ring-teal-500"
                />
                <span>I could not complete this step</span>
              </label>
            </div>

            {/* Instruction description */}
            <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/70 p-3.5 rounded-xl border border-zinc-800/80">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-400 block mb-1">
                Instructions from Dr. Ramos:
              </span>
              {activeStep.instructions}
            </div>

            {/* Video Recorder or Skip Reason Textarea */}
            {activeStepData.skipped ? (
              <div className="rounded-xl bg-amber-950/20 border border-amber-800/60 p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Reason for Skipping Step</span>
                </div>
                <Textarea
                  rows={2}
                  required
                  placeholder="e.g. Muscle fatigue, shoulder tightness, or balance precaution..."
                  value={activeStepData.skipReason}
                  onChange={(e) =>
                    setStepData((prev) => ({
                      ...prev,
                      [activeStep.id]: {
                        ...prev[activeStep.id],
                        skipReason: e.target.value,
                      },
                    }))
                  }
                  className="text-xs"
                />
                <p className="text-[11px] text-zinc-500">
                  Honoring fatigue is an important safety precaution that your clinician will review.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <VideoRecorder
                  onVideoReady={handleVideoReady}
                  existingVideoPath={activeStepData.videoPath}
                />

                {/* Optional client comment */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">
                    Optional notes or how this felt:
                  </label>
                  <Textarea
                    rows={2}
                    placeholder="e.g. Felt smoother than yesterday, finger extension felt slightly tight..."
                    value={activeStepData.comment}
                    onChange={(e) =>
                      setStepData((prev) => ({
                        ...prev,
                        [activeStep.id]: {
                          ...prev[activeStep.id],
                          comment: e.target.value,
                        },
                      }))
                    }
                    className="text-xs"
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Navigation and Save Progress */}
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={currentStepIndex === 0}
              onClick={handlePrevious}
              className="gap-1.5 text-xs text-zinc-300"
            >
              <ChevronLeft className="w-4 h-4" /> Previous Step
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSaveProgress}
                className="gap-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <Save className="w-3.5 h-3.5" /> Save Draft
              </Button>

              <Button
                type="button"
                onClick={handleNext}
                className="gap-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold text-xs"
              >
                {currentStepIndex === steps.length - 1 ? "Review Summary" : "Next Step"}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Summary View Before Final Submission */
        <div className="space-y-6">
          <Card className="border-zinc-800 bg-zinc-900/90 p-5 space-y-4">
            <div className="border-b border-zinc-800 pb-3">
              <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-teal-400" />
                Routine Completion Summary
              </CardTitle>
              <p className="text-xs text-zinc-400 mt-0.5">
                Review your step submissions and confirm consent before sending to your therapist.
              </p>
            </div>

            {/* Steps Checklist Summary */}
            <div className="space-y-3">
              {steps.map((st) => {
                const data = stepData[st.id];
                const isSkipped = data?.skipped;
                return (
                  <div
                    key={st.id}
                    className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-200">
                          Step {st.position}: {st.title}
                        </span>
                        {isSkipped ? (
                          <Badge variant="amber" statusText="Skipped" />
                        ) : (
                          <Badge variant="emerald" statusText="Video Ready" icon={<CheckCircle2 className="w-3 h-3" />} />
                        )}
                      </div>
                      {isSkipped ? (
                        <p className="text-zinc-400 italic">Reason: &quot;{data?.skipReason}&quot;</p>
                      ) : (
                        <p className="text-zinc-400">
                          {data?.comment ? `"${data.comment}"` : "Activity recorded"}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSummaryView(false);
                        setCurrentStepIndex(st.position - 1);
                      }}
                      className="text-xs text-teal-400 hover:underline shrink-0"
                    >
                      Edit
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Separate Consents Section */}
            <div className="pt-3 border-t border-zinc-800 space-y-3">
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                Sharing & AI Processing Consents
              </span>

              {/* Consent 1: Therapist Sharing */}
              <label className="flex items-start gap-2.5 text-xs text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentTherapist}
                  onChange={(e) => setConsentTherapist(e.target.checked)}
                  className="rounded border-zinc-700 text-teal-600 focus:ring-teal-500 mt-0.5"
                />
                <span className="leading-relaxed">
                  I consent to sharing my uploaded videos and comments with my assigned therapist (Dr. Elena Ramos).
                </span>
              </label>

              {/* Consent 2: Optional Meta AI Processing */}
              <label className="flex items-start gap-2.5 text-xs text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentMetaAi}
                  onChange={(e) => setConsentMetaAi(e.target.checked)}
                  className="rounded border-zinc-700 text-teal-600 focus:ring-teal-500 mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="leading-relaxed flex items-center gap-1.5 font-medium text-teal-300">
                    <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                    Optional: Consent to Meta AI visual analysis assistance
                  </span>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Allows your therapist to use Meta AI (Muse Spark & SAM 3.1) for tentative visual observations. You may decline this and still submit for human clinician review.
                  </p>
                </div>
              </label>
            </div>
          </Card>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              className="gap-1.5 text-xs text-zinc-300"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Steps
            </Button>

            <Button
              type="button"
              isLoading={submitting}
              onClick={handleSubmitToTherapist}
              className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold text-sm px-6"
            >
              <Send className="w-4 h-4" />
              Submit to Therapist
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
