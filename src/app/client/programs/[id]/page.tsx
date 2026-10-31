"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Send,
  Save,
  Sparkles,
  FileCheck,
  Layers,
  MessageSquare,
  RotateCcw,
  FileText,
  Check,
  Stethoscope,
  Edit3,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoRecorder } from "@/components/ui/video-recorder";
import { useAuth } from "@/lib/supabase/auth-context";
import { HomeProgram, ProgramStep, StepSubmission, Submission } from "@/types/database";
import { SoapSummaryCard } from "@/components/ui/soap-summary-card";

export default function ClientProgramRunnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading home program...</div>}>
      <ClientProgramRunnerContent params={params} />
    </React.Suspense>
  );
}

interface StepItemData {
  stepSubmissionId?: string;
  videoBlob?: Blob;
  videoPath?: string;
  comment: string;
  skipped: boolean;
  skipReason: string;
}

function ClientProgramRunnerContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const programId = resolvedParams.id;
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const initialEditParam = searchParams.get("edit") === "true";
  const initialDateParam = searchParams.get("date") || "";

  const [program, setProgram] = useState<HomeProgram | null>(null);
  const [steps, setSteps] = useState<ProgramStep[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [stepData, setStepData] = useState<Record<string, StepItemData>>({});
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string>(initialDateParam);
  const [isEditingMode, setIsEditingMode] = useState(initialEditParam);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSummaryView, setIsSummaryView] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [uploadingStepId, setUploadingStepId] = useState<string | null>(null);

  // Consents
  const [consentTherapist, setConsentTherapist] = useState(true);
  const [consentMetaAi, setConsentMetaAi] = useState(true);

  // Load Program & Submissions from database
  useEffect(() => {
    let isMounted = true;

    async function loadProgramAndSubmission() {
      try {
        setLoading(true);

        // 1. Fetch Program & Steps
        const progRes = await fetch(`/api/therapist/programs?id=${programId}`);
        const progData = await progRes.json();
        let loadedProg: HomeProgram | null = null;
        let loadedSteps: ProgramStep[] = [];

        if (progData.program) {
          loadedProg = progData.program;
          loadedSteps = progData.program.steps || [];
        }

        if (isMounted && loadedProg) {
          setProgram(loadedProg);
          setSteps(loadedSteps);
        }

        const effectiveDate =
          selectedDate ||
          (loadedProg?.scheduled_dates && loadedProg.scheduled_dates.length > 0
            ? loadedProg.scheduled_dates[0]
            : undefined);

        if (effectiveDate && !selectedDate && isMounted) {
          setSelectedDate(effectiveDate);
        }

        // 2. Fetch or create draft submission for this program & scheduled date
        const subRes = await fetch("/api/client/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "get_or_create",
            programId,
            scheduledDate: effectiveDate || undefined,
            clientUserId: user?.id,
          }),
        });

        const subData = await subRes.json();
        if (isMounted && subData.submission) {
          const currentSub: Submission = subData.submission;
          setSubmission(currentSub);
          const isFeedbackGiven =
            currentSub.state === "reviewed" ||
            currentSub.review?.status === "published" ||
            Boolean(currentSub.review?.overall_feedback);
          const isDone = currentSub.state === "submitted" || isFeedbackGiven;

          if (isFeedbackGiven) {
            // Therapist already gave feedback: client CANNOT edit anymore
            setIsEditingMode(false);
            setIsSubmitted(true);
            if (initialEditParam) {
              setErrorMsg(
                "Feedback has already been published by your therapist. This submission is finalized and cannot be modified."
              );
            }
          } else if (initialEditParam) {
            setIsEditingMode(true);
            setIsSubmitted(false);
          } else {
            setIsSubmitted(isDone);
          }

          if (typeof currentSub.consent_therapist === "boolean") {
            setConsentTherapist(currentSub.consent_therapist);
          }
          if (typeof currentSub.consent_meta_ai === "boolean") {
            setConsentMetaAi(currentSub.consent_meta_ai);
          }

          // Hydrate step responses
          const initialMap: Record<string, StepItemData> = {};
          if (Array.isArray(currentSub.step_submissions)) {
            currentSub.step_submissions.forEach((ss: StepSubmission) => {
              initialMap[ss.program_step_id] = {
                stepSubmissionId: ss.id,
                videoPath: ss.video_path || undefined,
                comment: ss.client_comment || "",
                skipped: Boolean(ss.skipped),
                skipReason: ss.skip_reason || "",
              };
            });
          }

          // Fill any missing step placeholders
          loadedSteps.forEach((st) => {
            if (!initialMap[st.id]) {
              initialMap[st.id] = {
                comment: "",
                skipped: false,
                skipReason: "",
              };
            }
          });

          setStepData(initialMap);
        }
      } catch (err) {
        console.warn("Could not load program:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProgramAndSubmission();

    return () => {
      isMounted = false;
    };
  }, [programId, user?.id, initialEditParam]);

  // Start Editing Submission
  const handleStartEdit = () => {
    const isFeedbackGiven =
      submission?.state === "reviewed" ||
      submission?.review?.status === "published" ||
      Boolean(submission?.review?.overall_feedback);
    if (isFeedbackGiven) {
      setErrorMsg(
        "Feedback has already been published by your therapist. This submission is finalized and cannot be modified."
      );
      return;
    }
    setIsEditingMode(true);
    setIsSubmitted(false);
    setIsSummaryView(false);
    setCurrentStepIndex(0);
    setErrorMsg(null);
  };

  // Switch Scheduled Practice Date (Each date is 1 submission)
  const handleSelectDate = async (newDate: string) => {
    if (newDate === selectedDate) return;
    setSelectedDate(newDate);
    setIsEditingMode(false);
    setIsSummaryView(false);
    setCurrentStepIndex(0);
    setErrorMsg(null);
    setSaveSuccessMsg(null);
    setLoading(true);

    try {
      const subRes = await fetch("/api/client/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_or_create",
          programId,
          scheduledDate: newDate,
          clientUserId: user?.id,
        }),
      });
      const subData = await subRes.json();
      if (subData.submission) {
        const cur: Submission = subData.submission;
        setSubmission(cur);
        setIsSubmitted(cur.state === "submitted" || cur.state === "reviewed");
        const initialMap: Record<string, StepItemData> = {};
        if (Array.isArray(cur.step_submissions)) {
          cur.step_submissions.forEach((ss: StepSubmission) => {
            initialMap[ss.program_step_id] = {
              stepSubmissionId: ss.id,
              videoPath: ss.video_path || undefined,
              comment: ss.client_comment || "",
              skipped: Boolean(ss.skipped),
              skipReason: ss.skip_reason || "",
            };
          });
        }
        steps.forEach((st) => {
          if (!initialMap[st.id]) {
            initialMap[st.id] = { comment: "", skipped: false, skipReason: "" };
          }
        });
        setStepData(initialMap);
      }
    } catch (err) {
      console.warn("Date switch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const activeStep = steps[currentStepIndex];
  const activeStepData = (activeStep && stepData[activeStep.id]) || {
    comment: "",
    skipped: false,
    skipReason: "",
  };

  const handleVideoReady = async (
    blob: Blob,
    meta: { mime: string; sizeBytes: number; durationSeconds: number; formatSupported: boolean }
  ) => {
    if (!activeStep) return;
    const currentStepId = activeStep.id;

    // Set local preview immediately
    const localUrl = URL.createObjectURL(blob);
    setStepData((prev) => ({
      ...prev,
      [currentStepId]: {
        ...prev[currentStepId],
        videoBlob: blob,
        videoPath: localUrl,
        skipped: false,
        skipReason: "",
      },
    }));

    // If submission exists, upload directly to cloud storage
    if (submission) {
      setUploadingStepId(currentStepId);
      setErrorMsg(null);
      try {
        const formData = new FormData();
        formData.append("file", blob, `step_${currentStepId}.webm`);
        formData.append("submissionId", submission.id);
        formData.append("stepId", currentStepId);
        formData.append("durationSeconds", String(meta.durationSeconds || 15));

        const res = await fetch("/api/client/submissions/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to upload video to secure storage.");
        }

        if (data.videoPath) {
          setStepData((prev) => ({
            ...prev,
            [currentStepId]: {
              ...prev[currentStepId],
              videoPath: data.videoPath,
            },
          }));
          setSaveSuccessMsg("Video saved directly to secure cloud storage.");
          setTimeout(() => setSaveSuccessMsg(null), 3500);
        }
      } catch (err: unknown) {
        console.warn("Storage upload notice:", err);
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setUploadingStepId(null);
      }
    }
  };

  const handleToggleSkip = (skipped: boolean) => {
    if (!activeStep) return;
    setStepData((prev) => ({
      ...prev,
      [activeStep.id]: {
        ...prev[activeStep.id],
        skipped,
        skipReason: skipped ? (prev[activeStep.id]?.skipReason || "") : "",
      },
    }));
  };

  // Save Step Draft to database
  const handleSaveProgress = async () => {
    if (!submission || !activeStep || savingDraft) return;
    setErrorMsg(null);
    setSavingDraft(true);

    try {
      const res = await fetch("/api/client/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_step_draft",
          submissionId: submission.id,
          stepId: activeStep.id,
          stepSubmissionId: activeStepData.stepSubmissionId,
          videoPath: activeStepData.videoPath || null,
          clientComment: activeStepData.comment,
          skipped: activeStepData.skipped,
          skipReason: activeStepData.skipReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save draft.");
      }

      if (data.stepSubmission?.id) {
        setStepData((prev) => ({
          ...prev,
          [activeStep.id]: {
            ...prev[activeStep.id],
            stepSubmissionId: data.stepSubmission.id,
          },
        }));
      }

      setSaveSuccessMsg("Draft progress saved.");
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingDraft(false);
    }
  };

  const handleResetStepVideo = async (stepId: string) => {
    if (uploadingStepId === stepId) {
      setErrorMsg("Video is currently uploading to cloud storage. Please wait for it to complete before resetting.");
      return;
    }
    const currentStepVideo = stepData[stepId]?.videoPath;
    if (currentStepVideo && currentStepVideo.startsWith("blob:")) {
      URL.revokeObjectURL(currentStepVideo);
    }

    setStepData((prev) => ({
      ...prev,
      [stepId]: {
        ...prev[stepId],
        videoBlob: undefined,
        videoPath: undefined,
      },
    }));

    if (submission) {
      try {
        await fetch("/api/client/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_step_draft",
            submissionId: submission.id,
            stepId,
            stepSubmissionId: stepData[stepId]?.stepSubmissionId,
            videoPath: null,
          }),
        });
      } catch (err: unknown) {
        console.warn("Reset step video draft sync error:", err);
      }
    }

    setSaveSuccessMsg("Video reset successfully. You can now record or upload a new video.");
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const handleNext = async () => {
    // 1. Guard against in-flight cloud video uploads
    if (uploadingStepId) {
      setErrorMsg("Please wait for your step video to finish uploading to cloud storage before proceeding to the next step.");
      return;
    }

    // 2. Validate skip status or video presence
    if (activeStepData.skipped) {
      if (!activeStepData.skipReason.trim()) {
        setErrorMsg("Please provide a brief reason for skipping this step before proceeding.");
        return;
      }
    } else {
      if (!activeStepData.videoPath && !activeStepData.videoBlob) {
        setErrorMsg("Please record or upload a video for this step before proceeding, or select 'I could not complete this step'.");
        return;
      }
    }

    setErrorMsg(null);

    // Auto-save draft on step navigation
    if (submission && activeStep) {
      fetch("/api/client/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_step_draft",
          submissionId: submission.id,
          stepId: activeStep.id,
          stepSubmissionId: activeStepData.stepSubmissionId,
          videoPath: activeStepData.videoPath || null,
          clientComment: activeStepData.comment,
          skipped: activeStepData.skipped,
          skipReason: activeStepData.skipReason,
        }),
      }).catch((err) => console.warn("Auto-save draft warning:", err));
    }

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
    if (submitting || isSubmitted || !submission) return;
    const isFeedbackGiven =
      submission.state === "reviewed" ||
      submission.review?.status === "published" ||
      Boolean(submission.review?.overall_feedback);
    if (isFeedbackGiven) {
      setErrorMsg(
        "Feedback has already been published by your therapist. This submission is finalized and cannot be modified."
      );
      return;
    }
    if (uploadingStepId) {
      setErrorMsg("A video is still uploading to cloud storage. Please wait for it to finish before submitting.");
      return;
    }
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
      // 1. Update consents
      await fetch("/api/client/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_consents",
          submissionId: submission.id,
          consentTherapist,
          consentMetaAi,
        }),
      });

      // 2. Submit to therapist
      const res = await fetch("/api/client/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          submissionId: submission.id,
          consentTherapist,
          consentMetaAi,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Submission failed.");
      }

      if (data.submission) {
        setSubmission(data.submission);
      }
      setIsEditingMode(false);
      setIsSubmitted(true);
      setSaveSuccessMsg(isEditingMode ? "Submission updated and re-sent to clinician!" : "Home program submitted successfully!");
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-zinc-400">Loading home program...</p>
      </div>
    );
  }

  if (isSubmitted) {
    const isReviewed =
      submission?.state === "reviewed" ||
      submission?.review?.status === "published" ||
      Boolean(submission?.review?.overall_feedback);
    const review = submission?.review;

    if (isReviewed) {
      return (
        <div className="space-y-6 max-w-3xl mx-auto pb-16">
          {/* Header */}
          <div>
            <Link
              href="/client"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </Link>
          </div>

          <div className="border-b border-zinc-800 pb-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-zinc-100">
                  {program?.title || "Home Program"} — Clinician Feedback
                </h1>
                <p className="text-xs text-zinc-400 mt-1">
                  Your occupational therapist has reviewed your home program. Review your clinician&apos;s step-by-step guidance below.
                </p>
              </div>
              <Badge variant="emerald" statusText="Reviewed & Finalized" icon={<Check className="w-3 h-3" />} />
            </div>
          </div>

          {/* Clinician Feedback finalized notice banner */}
          <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-3.5 text-xs text-teal-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
              <span>
                <strong>Submission Finalized:</strong> Your therapist has provided and published clinical feedback for this session. This submission is complete and cannot be edited.
              </span>
            </div>
            <Badge variant="teal" statusText="Submission Locked" />
          </div>

          {/* Clinical SOAP Evaluation and Simple Family Summary */}
          {review && (review.subjective || review.objective || review.assessment || review.plan) ? (
            <div className="space-y-4">
              {/* 4 SOAP Boxes Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                    <Stethoscope className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Clinician SOAP Evaluation
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Subjective Box */}
                  <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-950/10 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold font-mono flex items-center justify-center">
                        S
                      </span>
                      <span className="text-xs font-bold text-sky-300">
                        Subjective (Symptoms & Tolerance)
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {review.subjective || "No subjective notes recorded."}
                    </p>
                  </div>

                  {/* Objective Box */}
                  <div className="p-3.5 rounded-xl border border-teal-500/20 bg-teal-950/10 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded bg-teal-500/20 text-teal-300 text-[10px] font-bold font-mono flex items-center justify-center">
                        O
                      </span>
                      <span className="text-xs font-bold text-teal-300">
                        Objective (Performance & Metrics)
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {review.objective || "No objective metrics recorded."}
                    </p>
                  </div>

                  {/* Assessment Box */}
                  <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-950/10 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold font-mono flex items-center justify-center">
                        A
                      </span>
                      <span className="text-xs font-bold text-amber-300">
                        Assessment (Clinical Analysis)
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {review.assessment || "No clinical assessment recorded."}
                    </p>
                  </div>

                  {/* Plan Box */}
                  <div className="p-3.5 rounded-xl border border-violet-500/20 bg-violet-950/10 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded bg-violet-500/20 text-violet-300 text-[10px] font-bold font-mono flex items-center justify-center">
                        P
                      </span>
                      <span className="text-xs font-bold text-violet-300">
                        Plan (Next Steps & Adjustments)
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {review.plan || "No plan adjustments specified."}
                    </p>
                  </div>
                </div>
              </div>

              {/* PROMINENTLY BELOW THE SOAP NOTES: BUTTON TO SEE SUMMARY & CACHE IN DB */}
              <SoapSummaryCard
                targetType="submission_review"
                targetId={submission?.id}
                initialSummary={review.client_summary || null}
                subjective={review.subjective}
                objective={review.objective}
                assessment={review.assessment}
                plan={review.plan}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <Card className="border-teal-500/40 bg-teal-950/20 p-5 space-y-2.5 shadow-lg shadow-teal-950/30">
                <div className="flex items-center gap-2 text-teal-400 text-sm font-bold">
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  <span>Overall Clinician Session Feedback</span>
                </div>
                <p className="text-xs text-zinc-200 leading-relaxed italic bg-zinc-900/60 p-3.5 rounded-xl border border-teal-500/20">
                  &quot;{review?.overall_feedback || "Excellent dedication to your prescribed home program! Keep up the regular practice."}&quot;
                </p>
              </Card>

              {/* PROMINENTLY BELOW: BUTTON TO SEE SUMMARY & CACHE IN DB */}
              <SoapSummaryCard
                targetType="submission_review"
                targetId={submission?.id}
                initialSummary={review?.client_summary || null}
                subjective={review?.subjective}
                objective={review?.objective}
                assessment={review?.assessment}
                plan={review?.plan}
              />
            </div>
          )}

          {/* Step Reviews List */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-400" />
              Step-by-Step Exercise Feedback ({steps.length} Steps)
            </h2>

            {steps.map((st, idx) => {
              const data = stepData[st.id];
              const stepSub = submission?.step_submissions?.find((ss) => ss.program_step_id === st.id);
              const stepReview = review?.step_reviews?.find((sr) => sr.step_submission_id === stepSub?.id);

              return (
                <Card key={st.id} className="border-zinc-800 bg-zinc-900/90 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-teal-950 text-teal-400 border border-teal-500/40 text-xs font-bold flex items-center justify-center">
                        {st.position || idx + 1}
                      </span>
                      <h3 className="text-sm font-semibold text-zinc-100">
                        {st.title || `Step ${idx + 1}`}
                      </h3>
                    </div>
                    {data?.skipped || stepSub?.skipped ? (
                      <Badge variant="amber" statusText="Skipped by Client" />
                    ) : (
                      <Badge variant="emerald" statusText="Completed" icon={<CheckCircle2 className="w-3 h-3" />} />
                    )}
                  </div>

                  {/* Original Step Instructions */}
                  <div className="text-xs text-zinc-400 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-0.5">
                      Assigned Instructions:
                    </span>
                    <p className="text-zinc-300 leading-relaxed">{st.instructions}</p>
                  </div>

                  {/* Submitted video or skip reason */}
                  {data?.skipped || stepSub?.skipped ? (
                    <div className="text-xs text-amber-200/90 bg-amber-950/20 border border-amber-800/40 p-3 rounded-lg">
                      <span className="font-semibold text-amber-300">Your Skip Note: </span>
                      &quot;{data?.skipReason || stepSub?.skip_reason || "Fatigue precaution"}&quot;
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="aspect-video w-full max-w-md mx-auto rounded-lg overflow-hidden bg-black border border-zinc-800">
                        <video
                          src={data?.videoPath || stepSub?.video_path || "/demo/cup_grasp_transfer.mp4"}
                          controls
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {data?.comment && (
                        <p className="text-xs text-zinc-400 italic text-center">
                          Your note: &quot;{data.comment}&quot;
                        </p>
                      )}
                    </div>
                  )}

                  {/* Clinician Step Note */}
                  <div className="rounded-xl bg-teal-950/30 border border-teal-500/30 p-3.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Clinician Guidance for this Step:</span>
                    </div>
                    <p className="text-xs text-zinc-200 leading-relaxed">
                      {stepReview?.therapist_note ||
                        "Good active engagement observed. Continue practicing with attention to smooth finger release."}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800">
            <Link href="/client">
              <Button variant="outline" className="text-zinc-300 text-xs">
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex flex-row items-center gap-2 whitespace-nowrap">
              <span className="text-[11px] text-zinc-500 hidden sm:inline">
                Submission finalized • Locked from edits
              </span>
              <Link href="/client/messages">
                <Button className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold text-xs gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Message Clinician
                </Button>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    // Default waiting view for state === "submitted"
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-teal-950/80 border border-teal-500/60 text-teal-400 flex items-center justify-center mx-auto shadow-lg shadow-teal-950/50">
          <FileCheck className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Badge variant="teal" statusText="Submitted to Therapist" />
            {submission?.scheduled_date && (
              <Badge
                variant="outline"
                statusText={`Session Date: ${submission.scheduled_date}`}
                icon={<Calendar className="w-3 h-3 text-teal-400" />}
              />
            )}
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">
            Home Program Successfully Submitted!
          </h1>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            Your videos, comments, and notes have been securely uploaded for your therapist to review. Each prescribed date is one submission.
          </p>
          {submission?.submitted_at && (
            <p className="text-[11px] text-zinc-500 font-mono">
              Submitted on: {new Date(submission.submitted_at).toLocaleString()}
            </p>
          )}
        </div>

        {/* Date Session Switcher if program has scheduled dates */}
        {program?.scheduled_dates && program.scheduled_dates.length > 1 && (
          <div className="max-w-lg mx-auto p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-left space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-400" />
                Scheduled Dates ({program.scheduled_dates.length} sessions, 1 submission each):
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {program.scheduled_dates.map((dStr, idx) => {
                const isCurrent = (selectedDate || program.scheduled_dates?.[0]) === dStr;
                return (
                  <button
                    key={dStr}
                    type="button"
                    onClick={() => handleSelectDate(dStr)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                      isCurrent
                        ? "bg-teal-950 border-teal-500 text-teal-300 font-bold shadow-sm"
                        : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Date {idx + 1}: {dStr}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-4 flex flex-row items-center justify-center gap-3 whitespace-nowrap">
          <Link href="/client">
            <Button className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold text-xs">
              Return to Dashboard
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={handleStartEdit}
            className="text-xs text-amber-300 border-amber-500/40 hover:bg-amber-950/40 gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Submission
          </Button>
          <Link href="/client/messages">
            <Button variant="outline" className="text-zinc-200 text-xs">
              Message Clinician
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <Layers className="w-12 h-12 text-zinc-600 mx-auto" />
        <h2 className="text-lg font-bold text-zinc-200">No steps found for this home program</h2>
        <p className="text-xs text-zinc-500">
          Your therapist has not added exercise steps to this program yet.
        </p>
        <Link href="/client">
          <Button variant="outline" size="sm" className="text-xs">
            Back to Dashboard
          </Button>
        </Link>
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
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </div>

      {/* Editing Mode Alert Banner */}
      {isEditingMode && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Editing Mode:</strong> You are revising your previous submission{selectedDate ? ` for ${selectedDate}` : ""}. Replace videos with drag & drop or file upload, edit comments, or change skipped items. Click <em>Update & Re-Submit</em> when finished.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsEditingMode(false);
              setIsSubmitted(true);
            }}
            className="h-7 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-900/40 self-start sm:self-auto shrink-0"
          >
            Cancel Edit
          </Button>
        </div>
      )}

      {/* Scheduled Dates Session Switcher */}
      {program?.scheduled_dates && program.scheduled_dates.length > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800">
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="font-semibold text-zinc-200">Scheduled Sessions:</span>
            <span className="text-zinc-400">1 submission per date</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {program.scheduled_dates.map((dStr, idx) => {
              const isSelected = (selectedDate || program.scheduled_dates?.[0]) === dStr;
              return (
                <button
                  key={dStr}
                  type="button"
                  onClick={() => handleSelectDate(dStr)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono transition-colors border ${
                    isSelected
                      ? "bg-teal-950 border-teal-500 text-teal-300 font-bold shadow-sm"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <span>Date {idx + 1}: {dStr}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Program Header */}
      <div className="border-b border-zinc-800 pb-4 space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-zinc-100">
            {program?.title || "Home Program"}
          </h1>
          <span className="text-xs text-teal-400 font-mono font-medium">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {program?.main_instructions ||
            "Perform each activity at a steady pace. Record a short video or provide a reason if you need to rest."}
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
      {!isSummaryView && activeStep ? (
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
                Instructions from Clinician:
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
                  className="text-xs bg-zinc-950 border-zinc-800"
                />
                <p className="text-[11px] text-zinc-500">
                  Honoring fatigue is an important safety precaution that your clinician will review.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {uploadingStepId === activeStep.id && (
                  <div className="flex flex-row items-center gap-2 p-2.5 rounded-lg bg-teal-950/50 border border-teal-500/40 text-xs text-teal-300">
                    <div className="w-3.5 h-3.5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Uploading step video to cloud storage before you can proceed...</span>
                  </div>
                )}

                {activeStepData.videoPath && (
                  <div className="flex flex-row items-center justify-between text-[11px] text-zinc-400 bg-zinc-950/60 px-3 py-2 rounded-md border border-zinc-800 gap-2">
                    <span className="flex flex-row items-center gap-1.5 text-teal-400 whitespace-nowrap">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Video stored in cloud storage
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResetStepVideo(activeStep.id)}
                      disabled={uploadingStepId === activeStep.id}
                      className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 gap-1 px-2 whitespace-nowrap"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset Video
                    </Button>
                  </div>
                )}

                <VideoRecorder
                  key={`${activeStep.id}-${activeStepData.videoPath ? "has-video" : "no-video"}`}
                  onVideoReady={handleVideoReady}
                  existingVideoPath={activeStepData.videoPath}
                  onReset={() => handleResetStepVideo(activeStep.id)}
                  isUploading={uploadingStepId === activeStep.id}
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
                    className="text-xs bg-zinc-950 border-zinc-800"
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Navigation and Save Progress */}
          <div className="flex flex-row items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={currentStepIndex === 0}
              onClick={handlePrevious}
              className="gap-1.5 text-xs text-zinc-300 whitespace-nowrap"
            >
              <ChevronLeft className="w-4 h-4" /> Previous Step
            </Button>

            <div className="flex flex-row items-center gap-2 whitespace-nowrap">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSaveProgress}
                isLoading={savingDraft}
                className="gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" /> Save Draft
              </Button>

              <Button
                type="button"
                onClick={handleNext}
                disabled={Boolean(uploadingStepId)}
                className="gap-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold text-xs whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {uploadingStepId ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Uploading Video...</span>
                  </>
                ) : (
                  <>
                    <span>{currentStepIndex === steps.length - 1 ? "Review Summary" : "Next Step"}</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
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
                Home Program Completion Summary
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
                  I consent to sharing my uploaded videos and comments with my assigned rehabilitation therapist.
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
          <div className="flex flex-row items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              className="gap-1.5 text-xs text-zinc-300 whitespace-nowrap"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Steps
            </Button>

            <Button
              type="button"
              isLoading={submitting}
              disabled={Boolean(uploadingStepId)}
              onClick={handleSubmitToTherapist}
              className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold text-sm px-6 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {isEditingMode ? "Update & Re-Submit to Therapist" : "Submit to Therapist"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
