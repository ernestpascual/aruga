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
import { MediaUploader } from "@/components/ui/media-uploader";
import { useAuth } from "@/lib/supabase/auth-context";
import { HomeProgram, ProgramStep, StepSubmission, Submission } from "@/types/database";
import { OverallFeedbackCard } from "@/components/ui/overall-feedback-card";
import { StepActivityWorksheet } from "@/components/activities/StepActivityWorksheet";

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
  videoPath?: string; // generic media URL (photo OR video) — kept for backward compat
  mediaMime?: string;
  mediaKind?: "photo" | "video";
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
  const initialSubmissionIdParam = searchParams.get("submissionId") || "";

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
  const [activityDoneMap, setActivityDoneMap] = useState<Record<string, boolean>>({});
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [biomechSummary, setBiomechSummary] = useState<string | null>(null);
  const [feedbackCompletions, setFeedbackCompletions] = useState<Record<string, Record<string, unknown>>>({});

  // Load worksheet completions for feedback view
  useEffect(() => {
    const stepSubs = (submission as unknown as { step_submissions?: StepSubmission[] })?.step_submissions;
    if (!submission?.id || !stepSubs?.length || !user?.id) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        stepSubs.map(async (ss) => {
          try {
            const r = await fetch(`/api/activity-completions?stepSubmissionId=${ss.id}&requesterId=${user.id}`);
            const d = await r.json();
            const comp = d.completions?.[0] as Record<string, unknown> | undefined;
            return comp ? ([ss.id, comp] as const) : null;
          } catch { return null; }
        })
      );
      if (cancelled) return;
      const map: Record<string, Record<string, unknown>> = {};
      for (const e of entries) if (e) map[e[0]] = e[1];
      setFeedbackCompletions(map);
    })();
    return () => { cancelled = true; };
  }, [submission?.id, user?.id]);

  // Worksheet summary for AI (so Overall Feedback mentions coloring work)
  const worksheetAiSummary = React.useMemo(() => {
    if (!steps.length || !submission) return null;
    const wsSteps = steps.filter((s) => (s as unknown as { generated_activity?: { base_image_url?: string | null } })?.generated_activity?.base_image_url);
    if (!wsSteps.length) return null;
    const stepSubs = (submission as unknown as { step_submissions?: Array<{ id: string; program_step_id: string }> })?.step_submissions || [];
    const doneEntries = Object.entries(feedbackCompletions) as Array<[string, Record<string, unknown>]>;
    if (!doneEntries.length) return `Worksheet: ${wsSteps.length} coloring worksheet(s) assigned, completed via photo/video instead.`;
    const parts = doneEntries.map(([sid, c]) => {
      const ss = stepSubs.find((x) => x.id === sid);
      const st = steps.find((s) => s.id === ss?.program_step_id);
      const method = (c as { completion_method?: string })?.completion_method;
      return `${st?.title || "Step"}: completed`;
    });
    return `Worksheet: ${doneEntries.length}/${wsSteps.length} coloring worksheet(s) completed — ${parts.join("; ").slice(0, 400)}`;
  }, [steps, feedbackCompletions, submission]);

  // Load biomechanic summaries for AI Overall Feedback (if any video was analyzed)
  useEffect(() => {
    const stepSubs = (submission as unknown as { step_submissions?: StepSubmission[] })?.step_submissions;
    if (!submission?.id || !stepSubs?.length) { setBiomechSummary(null); return; }
    let cancelled = false;
    (async () => {
      const parts: string[] = [];
      for (const ss of stepSubs) {
        try {
          const r = await fetch(`/api/agent/biomech/save?stepSubmissionId=${ss.id}`);
          const d = await r.json();
          const saved = d.saved as { mhr_result?: { insights?: Array<{ label: string; rating: string; value: number | null; unit: string; threshold?: string }>; mhr?: { summary?: { peakAngles?: Record<string, number>; posturalAndDeformity?: { meanBosMarginMm?: number }; gait?: { comSwayVelocityMmPerSec?: number } } } } } | null;
          const insights = saved?.mhr_result?.insights;
          if (insights?.length) {
            const stepTitle = steps.find((s) => s.id === ss.program_step_id)?.title || `Step ${(ss as unknown as { position?: number }).position || ""}`.trim() || ss.id.slice(0, 4);
            const txt = insights.slice(0, 3).map((ins) => `${ins.label} ${ins.rating} ${ins.value ?? "?"}${ins.unit} (${ins.threshold ?? ""})`).join("; ");
            parts.push(`${stepTitle}: ${txt}`);
          } else if (saved?.mhr_result?.mhr?.summary) {
            const s = saved.mhr_result.mhr.summary as { peakAngles?: Record<string, number> };
            parts.push(`${ss.id.slice(0, 4)}: shoulder ${s.peakAngles?.["shoulderFlex_max"] ?? "?"}°`);
          }
        } catch {}
      }
      if (!cancelled) setBiomechSummary(parts.length ? parts.slice(0, 4).join(" | ").slice(0, 900) : null);
    })();
    return () => { cancelled = true; };
  }, [submission?.id, steps.length]);

  // Consents
  const [consentTherapist, setConsentTherapist] = useState(true);
  const [consentMetaAi, setConsentMetaAi] = useState(true);

  // Helper: submissions API returns review as array (Supabase join) or object — normalize
  const getReviewObj = (sub: unknown) => {
    const r = (sub as { review?: unknown })?.review;
    if (!r) return null as unknown as { status?: string; overall_feedback?: string; subjective?: string; objective?: string; assessment?: string; plan?: string; client_summary?: string; step_reviews?: Array<{ step_submission_id: string; therapist_note?: string }> } | null;
    if (Array.isArray(r)) return (r[0] as unknown) as { status?: string; overall_feedback?: string; subjective?: string; objective?: string; assessment?: string; plan?: string; client_summary?: string; step_reviews?: Array<{ step_submission_id: string; therapist_note?: string }> } | null;
    return r as { status?: string; overall_feedback?: string; subjective?: string; objective?: string; assessment?: string; plan?: string; client_summary?: string; step_reviews?: Array<{ step_submission_id: string; therapist_note?: string }> };
  };

  // Load Program & Submissions from database
  useEffect(() => {
    let isMounted = true;

    async function loadProgramAndSubmission() {
      try {
        setLoading(true);

        // 1. Fetch Program & Steps — include requester proof so DB ownership gate passes
        const progQs = user?.id ? `?id=${programId}&requesterId=${user.id}` : `?id=${programId}`;
        const progRes = await fetch(`/api/therapist/programs${progQs}`);
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

        // 1b. Fetch all submissions for this program so client can see per-date feedback even while ongoing
        if (isMounted && loadedProg) {
          try {
            const allRes = await fetch(
              `/api/client/submissions?programId=${programId}&clientUserId=${user?.id || ""}&requesterId=${user?.id || ""}`
            );
            const allData = await allRes.json();
            if (isMounted && Array.isArray(allData.submissions)) {
              setAllSubmissions(allData.submissions as Submission[]);
            }
          } catch {}
        }

        // 2. If ?submissionId= present (deep link from Activities reviewed row), load that exact submission — bypasses date matching so feedback always opens
        if (initialSubmissionIdParam && isMounted) {
          try {
            const directRes = await fetch(
              `/api/client/submissions?submissionId=${initialSubmissionIdParam}&clientUserId=${user?.id || ""}&requesterId=${user?.id || ""}`
            );
            const directData = await directRes.json();
            const directSub = (directData.submission || directData.submissions?.[0]) as Submission | undefined;
            if (directSub) {
              if (directSub.scheduled_date) setSelectedDate(directSub.scheduled_date);
              setSubmission(directSub);
              const rD = getReviewObj(directSub);
              const isFeedbackGivenD =
                directSub.state === "reviewed" ||
                rD?.status === "published" ||
                Boolean(rD?.overall_feedback);
              setIsEditingMode(false);
              setIsSubmitted(true);
              if (typeof directSub.consent_therapist === "boolean") setConsentTherapist(directSub.consent_therapist);
              if (typeof directSub.consent_meta_ai === "boolean") setConsentMetaAi(directSub.consent_meta_ai);
              const directMap: Record<string, StepItemData> = {};
              if (Array.isArray(directSub.step_submissions)) {
                directSub.step_submissions.forEach((ss: StepSubmission) => {
                  directMap[ss.program_step_id] = {
                    stepSubmissionId: ss.id,
                    videoPath: ss.video_path || undefined,
                    mediaMime: ss.media_meta?.mime,
                    mediaKind: ss.media_meta?.mediaKind,
                    comment: ss.client_comment || "",
                    skipped: Boolean(ss.skipped),
                    skipReason: ss.skip_reason || "",
                  };
                });
              }
              loadedSteps.forEach((st) => {
                if (!directMap[st.id]) directMap[st.id] = { comment: "", skipped: false, skipReason: "" };
              });
              setStepData(directMap);
              if (isMounted) setLoading(false);
              return;
            }
          } catch {}
        }

        // 2b. Fetch or create draft submission for this program & scheduled date
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
          const r0 = getReviewObj(currentSub);
          const isFeedbackGiven =
            currentSub.state === "reviewed" ||
            r0?.status === "published" ||
            Boolean(r0?.overall_feedback);
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

          // Hydrate step responses (video_path holds photo OR video URL; type via media_meta)
          const initialMap: Record<string, StepItemData> = {};
          if (Array.isArray(currentSub.step_submissions)) {
            currentSub.step_submissions.forEach((ss: StepSubmission) => {
              initialMap[ss.program_step_id] = {
                stepSubmissionId: ss.id,
                videoPath: ss.video_path || undefined,
                mediaMime: ss.media_meta?.mime,
                mediaKind: ss.media_meta?.mediaKind,
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
    const rEdit = getReviewObj(submission);
    const isFeedbackGiven =
      submission?.state === "reviewed" ||
      rEdit?.status === "published" ||
      Boolean(rEdit?.overall_feedback);
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

  // Apply a submission object to UI state (shared by cache-instant + network paths)
  const applySubmissionForDate = (newDate: string, cur: Submission) => {
    setSelectedDate(newDate);
    setSubmission(cur);
    const rCur = getReviewObj(cur);
    const reviewedForDate =
      cur.state === "reviewed" ||
      rCur?.status === "published" ||
      Boolean(rCur?.overall_feedback);
    const submittedForDate = cur.state === "submitted" || (cur as unknown as { state?: string }).state === "reviewed" || reviewedForDate;
    setIsSubmitted(reviewedForDate ? true : submittedForDate);
    setIsEditingMode(false);
    setIsSummaryView(false);
    setCurrentStepIndex(0);
    setErrorMsg(null);
    setSaveSuccessMsg(null);
    const initialMap: Record<string, StepItemData> = {};
    if (Array.isArray(cur.step_submissions)) {
      cur.step_submissions.forEach((ss: StepSubmission) => {
        initialMap[ss.program_step_id] = {
          stepSubmissionId: ss.id,
          videoPath: ss.video_path || undefined,
          mediaMime: ss.media_meta?.mime,
          mediaKind: ss.media_meta?.mediaKind,
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
  };

  // Instant "View feedback" — uses already-fetched allSubmissions cache, no POST round-trip.
  // Falls back to network only if date not in cache.
  const handleViewFeedback = async (newDate: string) => {
    const cached = allSubmissions.find((s) => s.scheduled_date === newDate);
    if (cached) {
      applySubmissionForDate(newDate, cached);
      // Background refresh full review (step_reviews) via GET by id — never blocks UI
      try {
        const r = await fetch(
          `/api/client/submissions?submissionId=${cached.id}&clientUserId=${user?.id || ""}&requesterId=${user?.id || ""}`
        );
        const d = await r.json();
        const fresh = (d.submission || d.submissions?.[0]) as Submission | undefined;
        if (fresh && fresh.id === cached.id) {
          setSubmission(fresh);
          setAllSubmissions((prev) => prev.map((s) => (s.id === fresh.id ? fresh : s)));
        }
      } catch {}
      return;
    }
    // Not in cache — fall back to network fetch
    await handleSelectDate(newDate);
  };

  // Switch Scheduled Practice Date (Each date is 1 submission)
  const handleSelectDate = async (newDate: string) => {
    if (newDate === selectedDate) return;
    // Instant path: if we already have this date's submission cached, apply immediately
    const cached = allSubmissions.find((s) => s.scheduled_date === newDate);
    if (cached) {
      applySubmissionForDate(newDate, cached);
      // Refresh badges in background
      try {
        const allRes = await fetch(
          `/api/client/submissions?programId=${programId}&clientUserId=${user?.id || ""}&requesterId=${user?.id || ""}`
        );
        const allData = await allRes.json();
        if (Array.isArray(allData.submissions)) setAllSubmissions(allData.submissions as Submission[]);
      } catch {}
      return;
    }
    setSelectedDate(newDate);
    setIsEditingMode(false);
    setIsSummaryView(false);
    setCurrentStepIndex(0);
    setErrorMsg(null);
    setSaveSuccessMsg(null);
    // Use lightweight savingDraft flag instead of full page loading — keeps per-date feedback visible
    setSavingDraft(true);

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
        // Show feedback view for this date if it is reviewed, even while other dates are ongoing
        const rCur = getReviewObj(cur);
        const reviewedForDate =
          cur.state === "reviewed" ||
          rCur?.status === "published" ||
          Boolean(rCur?.overall_feedback);
        setIsSubmitted(reviewedForDate ? true : cur.state === "submitted" || cur.state === "reviewed");
        if (reviewedForDate) setIsEditingMode(false);
        const initialMap: Record<string, StepItemData> = {};
        if (Array.isArray(cur.step_submissions)) {
          cur.step_submissions.forEach((ss: StepSubmission) => {
            initialMap[ss.program_step_id] = {
              stepSubmissionId: ss.id,
              videoPath: ss.video_path || undefined,
              mediaMime: ss.media_meta?.mime,
              mediaKind: ss.media_meta?.mediaKind,
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
      // refresh per-date feedback badges after switch
      try {
        const allRes = await fetch(
          `/api/client/submissions?programId=${programId}&clientUserId=${user?.id || ""}&requesterId=${user?.id || ""}`
        );
        const allData = await allRes.json();
        if (Array.isArray(allData.submissions)) setAllSubmissions(allData.submissions as Submission[]);
      } catch {}
    } catch (err) {
      console.warn("Date switch error:", err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingDraft(false);
    }
  };

  const activeStep = steps[currentStepIndex];
  const activeStepData = (activeStep && stepData[activeStep.id]) || {
    comment: "",
    skipped: false,
    skipReason: "",
  };

  const handleMediaReady = async (
    blob: Blob,
    meta: { mime: string; sizeBytes: number; durationSeconds?: number; formatSupported: boolean; mediaKind: "photo" | "video" }
  ) => {
    if (!activeStep) return;
    const currentStepId = activeStep.id;

    // Set local preview immediately — video_path now generic media path (photo OR video)
    const localUrl = URL.createObjectURL(blob);
    setStepData((prev) => ({
      ...prev,
      [currentStepId]: {
        ...prev[currentStepId],
        videoBlob: blob,
        videoPath: localUrl,
        mediaMime: meta.mime,
        mediaKind: meta.mediaKind,
        skipped: false,
        skipReason: "",
      },
    }));

    // If submission exists, upload directly to Supabase storage (program-videos bucket hosts both)
    if (submission) {
      setUploadingStepId(currentStepId);
      setErrorMsg(null);
      try {
        const ext = meta.mediaKind === "photo" ? (meta.mime.includes("png") ? "png" : meta.mime.includes("webp") ? "webp" : "jpg") : "webm";
        const formData = new FormData();
        formData.append("file", blob, `step_${currentStepId}.${ext}`);
        formData.append("submissionId", submission.id);
        formData.append("stepId", currentStepId);
        if (meta.durationSeconds) formData.append("durationSeconds", String(meta.durationSeconds));

        const res = await fetch("/api/client/submissions/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Failed to upload ${meta.mediaKind} to Supabase.`);
        }

        if (data.videoPath || data.mediaPath) {
          setStepData((prev) => ({
            ...prev,
            [currentStepId]: {
              ...prev[currentStepId],
              videoPath: data.videoPath || data.mediaPath,
              mediaMime: data.mime || meta.mime,
              mediaKind: data.mediaKind || meta.mediaKind,
            },
          }));
          setSaveSuccessMsg(`${meta.mediaKind === "photo" ? "Photo" : "Video"} saved to Supabase cloud storage.`);
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
  // Backward compat alias
  const handleVideoReady = handleMediaReady;

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

  const handleResetStepMedia = async (stepId: string) => {
    if (uploadingStepId === stepId) {
      setErrorMsg("Media is currently uploading to Supabase. Please wait before resetting.");
      return;
    }
    const curMedia = stepData[stepId]?.videoPath;
    if (curMedia && curMedia.startsWith("blob:")) {
      URL.revokeObjectURL(curMedia);
    }

    setStepData((prev) => ({
      ...prev,
      [stepId]: {
        ...prev[stepId],
        videoBlob: undefined,
        videoPath: undefined,
        mediaMime: undefined,
        mediaKind: undefined,
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
        console.warn("Reset step media draft sync error:", err);
      }
    }

    setSaveSuccessMsg("Media reset. You can now take a photo or record a video.");
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };
  const handleResetStepVideo = handleResetStepMedia;

  const handleNext = async () => {
    // 1. Guard against in-flight Supabase media uploads
    if (uploadingStepId) {
      setErrorMsg("Please wait for your photo/video to finish uploading to Supabase before proceeding.");
      return;
    }

    // 2. Validate skip status or media presence (photo/video OR coloring worksheet completion)
    if (activeStepData.skipped) {
      if (!activeStepData.skipReason.trim()) {
        setErrorMsg("Please provide a brief reason for skipping this step before proceeding.");
        return;
      }
    } else {
      const hasWorksheetDone = Boolean(activityDoneMap[activeStep.id]);
      const hasMedia = Boolean(activeStepData.videoPath || activeStepData.videoBlob);
      if (!hasMedia && !hasWorksheetDone) {
        // If step has a generated coloring worksheet attached, drawing/photo-upload counts
        const hasWorksheet = Boolean((activeStep as unknown as { generated_activity?: { base_image_url?: string | null } | null })?.generated_activity?.base_image_url);
        if (hasWorksheet) {
          setErrorMsg("Please color on the worksheet (Save progress) or upload a photo of your printed sheet, or record/upload photo/video, or mark skipped.");
        } else {
          setErrorMsg("Please take a photo or record/upload a video for this step, or select 'I could not complete this step'.");
        }
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
    const rSub = getReviewObj(submission);
    const isFeedbackGiven =
      submission.state === "reviewed" ||
      rSub?.status === "published" ||
      Boolean(rSub?.overall_feedback);
    if (isFeedbackGiven) {
      setErrorMsg(
        "Feedback has already been published by your therapist. This submission is finalized and cannot be modified."
      );
      return;
    }
    if (uploadingStepId) {
      setErrorMsg("A photo/video is still uploading to Supabase. Please wait before submitting.");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);

    // Verify all steps are completed — each needs photo/video OR worksheet coloring/photo OR skip with reason
    const incompleteSteps = steps.filter((st) => {
      const data = stepData[st.id];
      if (!data) return true;
      if (data.skipped) return !data.skipReason.trim();
      const hasMedia = Boolean(data.videoPath || data.videoBlob);
      const hasWorksheetDone = Boolean(activityDoneMap[st.id]);
      return !hasMedia && !hasWorksheetDone;
    });

    if (incompleteSteps.length > 0) {
      setErrorMsg("All steps must have a photo/video, or a saved worksheet coloring/photo, or an explicit skip explanation.");
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
      // refresh per-date list so badges update even while program ongoing
      try {
        const allRes = await fetch(`/api/client/submissions?programId=${programId}&clientUserId=${user?.id || ""}&requesterId=${user?.id || ""}`);
        const allData = await allRes.json();
        if (Array.isArray(allData.submissions)) setAllSubmissions(allData.submissions as Submission[]);
      } catch {}
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
    const reviewObj = getReviewObj(submission);
    const isReviewed =
      submission?.state === "reviewed" ||
      reviewObj?.status === "published" ||
      Boolean(reviewObj?.overall_feedback);
    const review = reviewObj;

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

          {/* Date switcher — also in feedback view so client can navigate between reviewed dates */}
          {program?.scheduled_dates && program.scheduled_dates.length > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800">
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="font-semibold text-zinc-200">Scheduled Sessions:</span>
                <span className="text-zinc-400">tap a date</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {program.scheduled_dates.map((dStr, idx) => {
                  const isSelected = (selectedDate || program.scheduled_dates?.[0]) === dStr;
                  const subForDate = allSubmissions.find((s) => s.scheduled_date === dStr) as unknown as { state?: string; review?: unknown } | undefined;
                  const rawR = (subForDate as unknown as { review?: unknown })?.review;
                  const r = Array.isArray(rawR) ? (rawR[0] as { status?: string; overall_feedback?: string } | undefined) : (rawR as { status?: string; overall_feedback?: string } | undefined);
                  const hasReview = subForDate?.state === "reviewed" || r?.status === "published" || Boolean(r?.overall_feedback);
                  const isSubmittedDate = subForDate?.state === "submitted" || hasReview;
                  return (
                    <button
                      key={dStr}
                      type="button"
                      onClick={() => handleViewFeedback(dStr)}
                      title={hasReview ? "Feedback available" : isSubmittedDate ? "Submitted" : "Not yet submitted"}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono transition-colors border ${
                        isSelected
                          ? "bg-teal-950 border-teal-500 text-teal-300 font-bold shadow-sm"
                          : hasReview
                            ? "bg-emerald-950/40 border-emerald-800 text-emerald-300 hover:bg-emerald-950/60"
                            : isSubmittedDate
                              ? "bg-amber-950/30 border-amber-800 text-amber-300 hover:bg-amber-950/50"
                              : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span>Date {idx + 1}: {dStr}{hasReview ? " ✓" : isSubmittedDate ? " •" : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Clinician Feedback finalized notice banner */}
          <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-3.5 text-xs text-teal-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span>
              <strong>Submission Finalized:</strong> Your therapist has provided and published clinical feedback for this session. This submission is complete and cannot be edited.
            </span>
          </div>

          {/* Overall Clinician Session Feedback — AI-generated, easy to understand, saved once */}
          <OverallFeedbackCard
            targetType="submission_review"
            targetId={submission?.id}
            overallFeedback={review?.overall_feedback || null}
            subjective={review?.subjective}
            objective={review?.objective}
            assessment={review?.assessment}
            plan={review?.plan}
            stepReviews={(review?.step_reviews || []).map((sr: { step_submission_id: string; therapist_note?: string }) => {
              const ss = (submission as unknown as { step_submissions?: Array<{ id: string; program_step_id: string }> })?.step_submissions?.find((s) => s.id === sr.step_submission_id);
              const st = steps.find((s) => s.id === ss?.program_step_id);
              return { stepTitle: st?.title || st?.instructions?.slice(0, 40) || "Step", therapistNote: sr.therapist_note || "" };
            })}
            biomechSummary={[biomechSummary, worksheetAiSummary].filter(Boolean).join(" | ") || null}
            initialSummary={review?.client_summary || null}
          />

          {/* Clinical SOAP details — reference, below the easy summary */}
          {review && (review.subjective || review.objective || review.assessment || review.plan) && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
                  <Stethoscope className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Clinical Details (SOAP) — Reference</h2>
                <span className="text-[11px] text-zinc-500">Full notes your therapist wrote</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-950/10 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold font-mono flex items-center justify-center">S</span>
                    <span className="text-xs font-bold text-sky-300">Subjective (Symptoms & Tolerance)</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{review.subjective || "No subjective notes recorded."}</p>
                </div>
                <div className="p-3.5 rounded-xl border border-teal-500/20 bg-teal-950/10 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-teal-500/20 text-teal-300 text-[10px] font-bold font-mono flex items-center justify-center">O</span>
                    <span className="text-xs font-bold text-teal-300">Objective (Performance & Metrics)</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{review.objective || "No objective metrics recorded."}</p>
                </div>
                <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-950/10 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold font-mono flex items-center justify-center">A</span>
                    <span className="text-xs font-bold text-amber-300">Assessment (Clinical Analysis)</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{review.assessment || "No clinical assessment recorded."}</p>
                </div>
                <div className="p-3.5 rounded-xl border border-violet-500/20 bg-violet-950/10 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-violet-500/20 text-violet-300 text-[10px] font-bold font-mono flex items-center justify-center">P</span>
                    <span className="text-xs font-bold text-violet-300">Plan (Next Steps & Adjustments)</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{review.plan || "No plan adjustments specified."}</p>
                </div>
              </div>
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

                  {/* Worksheet if answered — shows assigned vs your work; otherwise photo/video; also handles plain photo */}
                  {(() => {
                    const ga = (st as unknown as { generated_activity?: { id: string; title: string; instructions: string; base_image_url: string | null } | null })?.generated_activity;
                    const comp = stepSub ? (feedbackCompletions[stepSub.id] as { drawing_data_url?: string | null; photo_upload_path?: string | null; completion_method?: string; created_at?: string; drawing_strokes?: unknown[] } | undefined) : undefined;
                    const hasWorksheet = Boolean(ga?.base_image_url);
                    const hasComp = Boolean(comp?.drawing_data_url);
                    if (data?.skipped || stepSub?.skipped) {
                      return (
                        <div className="text-xs text-amber-200/90 bg-amber-950/20 border border-amber-800/40 p-3 rounded-lg">
                          <span className="font-semibold text-amber-300">Your Skip Note: </span>
                          &quot;{data?.skipReason || stepSub?.skip_reason || "Fatigue precaution"}&quot;
                        </div>
                      );
                    }
                    if (hasWorksheet) {
                      const isPhotoMethod = comp?.completion_method === "photo";
                      return (
                        <div className="space-y-2">
                          <div className="rounded-xl border border-teal-500/20 bg-teal-950/10 overflow-hidden">
                            <div className="px-3 py-2 bg-zinc-950/60 border-b border-teal-500/10 flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">🎨 Worksheet: {ga!.title || st.title}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">{hasComp ? "Completed" : "Worksheet assigned"}</span>
                            </div>
                            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Assigned worksheet</p>
                                <div className="rounded-lg overflow-hidden border border-zinc-800 bg-white">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={String(ga!.base_image_url)} alt={String(ga!.title || "Worksheet")} className="w-full h-auto object-contain" />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Your work</p>
                                {hasComp && comp!.drawing_data_url ? (
                                  <div className="rounded-lg overflow-hidden border border-zinc-800 bg-white">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={String(comp!.drawing_data_url)} alt="Your worksheet submission" className="w-full h-auto object-contain" />
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-950/60 p-6 text-center text-xs text-zinc-500">No worksheet answer saved for this step — you used photo/video instead.</div>
                                )}
                                {hasComp && comp!.created_at && <p className="text-[10px] text-zinc-500 font-mono">Saved {new Date(String(comp!.created_at)).toLocaleString()}</p>}
                              </div>
                            </div>
                          </div>
                          {/* Also show any separate photo/video you uploaded alongside the worksheet */}
                          {(() => {
                            const src = data?.videoPath || stepSub?.video_path;
                            if (!src || src === comp?.drawing_data_url) return null;
                            const mime = data?.mediaMime || stepSub?.media_meta?.mime || "";
                            const isPhoto = data?.mediaKind === "photo" || stepSub?.media_meta?.mediaKind === "photo" || mime.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(src);
                            // Only show if it's not the same as worksheet photo
                            const isWorksheetPhoto = isPhotoMethod && src === comp?.drawing_data_url;
                            if (isWorksheetPhoto) return null;
                            return (
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Additional {isPhoto ? "photo" : "video"} you uploaded</p>
                                <div className="aspect-video w-full max-w-md mx-auto rounded-lg overflow-hidden bg-black border border-zinc-800">
                                  {isPhoto ? <img src={src} alt="Uploaded photo" className="w-full h-full object-contain" /> : <video src={src} controls className="w-full h-full object-cover" />}
                                </div>
                              </div>
                            );
                          })()}
                          {data?.comment && <p className="text-xs text-zinc-400 italic text-center">Your note: &quot;{data.comment}&quot;</p>}
                        </div>
                      );
                    }
                    const src = data?.videoPath || stepSub?.video_path || "";
                    if (!src) return <div className="rounded-lg bg-zinc-950/60 border border-zinc-800 p-4 text-xs text-zinc-400">No photo or video submitted for this step.</div>;
                    const mime = data?.mediaMime || stepSub?.media_meta?.mime || "";
                    const isPhoto = data?.mediaKind === "photo" || stepSub?.media_meta?.mediaKind === "photo" || mime.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(src);
                    return (
                      <div className="space-y-2">
                        <div className="aspect-video w-full max-w-md mx-auto rounded-lg overflow-hidden bg-black border border-zinc-800">
                          {isPhoto ? <img src={src} alt="Submitted photo" className="w-full h-full object-contain" /> : <video src={src} controls className="w-full h-full object-cover" />}
                        </div>
                        {data?.comment && <p className="text-xs text-zinc-400 italic text-center">Your note: &quot;{data.comment}&quot;</p>}
                      </div>
                    );
                  })()}

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
          <div className="pt-4 flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3 border-t border-zinc-800">
            <Link href="/client">
              <Button variant="outline" className="text-zinc-300 text-xs">
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex flex-wrap items-center gap-2">
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

        {/* Date Session Switcher if program has scheduled dates — per-date feedback visible even while program ongoing */}
        {program?.scheduled_dates && program.scheduled_dates.length > 1 && (
          <div className="max-w-lg mx-auto p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-left space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-400" />
                Scheduled Dates ({program.scheduled_dates.length} sessions, 1 submission each):
              </span>
              <span className="text-[10px] text-zinc-500 font-normal">Tap a date to see its feedback</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {program.scheduled_dates.map((dStr, idx) => {
                const isCurrent = (selectedDate || program.scheduled_dates?.[0]) === dStr;
                const subForDate = allSubmissions.find((s) => s.scheduled_date === dStr) as unknown as { state?: string; review?: unknown } | undefined;
                const rawR = (subForDate as unknown as { review?: unknown })?.review;
                const r = Array.isArray(rawR) ? (rawR[0] as { status?: string; overall_feedback?: string } | undefined) : (rawR as { status?: string; overall_feedback?: string } | undefined);
                const hasReview = subForDate?.state === "reviewed" || r?.status === "published" || Boolean(r?.overall_feedback);
                const isSubmittedDate = subForDate?.state === "submitted" || hasReview;
                return (
                  <button
                    key={dStr}
                    type="button"
                    onClick={() => handleViewFeedback(dStr)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors flex items-center gap-1.5 ${
                      isCurrent
                        ? "bg-teal-950 border-teal-500 text-teal-300 font-bold shadow-sm"
                        : hasReview
                          ? "bg-emerald-950/40 border-emerald-800 text-emerald-300 hover:bg-emerald-950/60"
                          : isSubmittedDate
                            ? "bg-amber-950/30 border-amber-800 text-amber-300 hover:bg-amber-950/50"
                            : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                    title={hasReview ? "Feedback available — tap to view" : isSubmittedDate ? "Submitted — awaiting feedback" : "Not yet submitted"}
                  >
                    Date {idx + 1}: {dStr} {hasReview ? "✓ feedback" : isSubmittedDate ? "• submitted" : ""}
                  </button>
                );
              })}
            </div>
            {allSubmissions.some((s) => { const st=(s as unknown as { state?: string }).state; const raw=(s as unknown as { review?: unknown }).review; const ro=Array.isArray(raw) ? (raw[0] as { status?: string }) : (raw as { status?: string } | undefined); return st==="reviewed" || ro?.status==="published"; }) && (
              <p className="text-[11px] text-emerald-400/80 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Feedback is available per date below — program can stay ongoing.</p>
            )}
          </div>
        )}

        {/* View feedback buttons for any reviewed date — even while current date is waiting */}
        {program?.scheduled_dates && program.scheduled_dates.length > 1 && allSubmissions.some((s) => { const st=(s as unknown as { state?: string }).state; const raw=(s as unknown as { review?: unknown }).review; const ro=Array.isArray(raw) ? (raw[0] as { status?: string }) : (raw as { status?: string } | undefined); return st==="reviewed" || ro?.status==="published"; }) && (
          <div className="max-w-lg mx-auto rounded-xl border border-emerald-900/50 bg-emerald-950/10 p-3 space-y-2 text-left">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Feedback per date
            </div>
            <div className="grid gap-1.5">
              {program.scheduled_dates.map((dStr) => {
                const subForDate = allSubmissions.find((s) => s.scheduled_date === dStr) as unknown as { state?: string; review?: unknown } | undefined;
                const rawR = (subForDate as unknown as { review?: unknown })?.review;
                const r = Array.isArray(rawR) ? (rawR[0] as { status?: string; overall_feedback?: string } | undefined) : (rawR as { status?: string; overall_feedback?: string } | undefined);
                const hasReview = subForDate?.state === "reviewed" || r?.status === "published" || Boolean(r?.overall_feedback);
                if (!hasReview) return null;
                const isCurrent = (selectedDate || program.scheduled_dates?.[0]) === dStr;
                if (isCurrent) return null;
                return (
                  <div key={dStr} className="w-full flex items-center justify-between gap-2 rounded-lg border border-emerald-800/40 bg-zinc-950/60 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-emerald-300">{dStr}</div>
                      <div className="text-xs text-zinc-400 truncate max-w-[200px]">{r?.overall_feedback?.slice(0, 70) || "Clinician feedback published"}</div>
                    </div>
                    <Button type="button" size="sm" onClick={() => handleViewFeedback(dStr)} className="h-7 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 cursor-pointer">View feedback</Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-4 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
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

      {/* Scheduled Dates Session Switcher — per-date feedback badges even while ongoing */}
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
              const subForDate = allSubmissions.find((s) => s.scheduled_date === dStr) as unknown as { state?: string; review?: unknown } | undefined;
              const rawR2 = (subForDate as unknown as { review?: unknown })?.review;
              const r2 = Array.isArray(rawR2) ? (rawR2[0] as { status?: string; overall_feedback?: string } | undefined) : (rawR2 as { status?: string; overall_feedback?: string } | undefined);
              const hasReview = subForDate?.state === "reviewed" || r2?.status === "published" || Boolean(r2?.overall_feedback);
              const isSubmittedDate = subForDate?.state === "submitted" || hasReview;
              return (
                <button
                  key={dStr}
                  type="button"
                  onClick={() => handleViewFeedback(dStr)}
                  title={hasReview ? "Feedback available" : isSubmittedDate ? "Submitted" : "Not yet submitted"}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono transition-colors border ${
                    isSelected
                      ? "bg-teal-950 border-teal-500 text-teal-300 font-bold shadow-sm"
                      : hasReview
                        ? "bg-emerald-950/40 border-emerald-800 text-emerald-300 hover:bg-emerald-950/60"
                        : isSubmittedDate
                          ? "bg-amber-950/30 border-amber-800 text-amber-300 hover:bg-amber-950/50"
                          : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <span>Date {idx + 1}: {dStr}{hasReview ? " ✓" : isSubmittedDate ? " •" : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-date feedback history — visible even while program ongoing and current date is not reviewed */}
      {program?.scheduled_dates && program.scheduled_dates.length > 1 && allSubmissions.some((s) => { const st=(s as unknown as { state?: string }).state; const raw=(s as unknown as { review?: unknown }).review; const ro=Array.isArray(raw) ? (raw[0] as { status?: string }) : (raw as { status?: string } | undefined); return st==="reviewed" || ro?.status==="published"; }) && (
        <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/10 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Feedback per date — available even while program is ongoing
          </div>
          <div className="grid gap-1.5">
            {program.scheduled_dates.map((dStr) => {
              const subForDate = allSubmissions.find((s) => s.scheduled_date === dStr) as unknown as { id: string; state?: string; review?: unknown } | undefined;
              const rawR3 = (subForDate as unknown as { review?: unknown })?.review;
              const r3 = Array.isArray(rawR3) ? (rawR3[0] as { status?: string; overall_feedback?: string } | undefined) : (rawR3 as { status?: string; overall_feedback?: string } | undefined);
              const hasReview = subForDate?.state === "reviewed" || r3?.status === "published" || Boolean(r3?.overall_feedback);
              if (!hasReview || dStr === selectedDate) return null;
              return (
                <div
                  key={dStr}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border border-emerald-800/40 bg-zinc-950/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-emerald-300 flex items-center gap-2">
                      {dStr} <span className="text-[10px] bg-emerald-900/50 px-1.5 py-0.5 rounded">feedback ready</span>
                    </div>
                    <div className="text-xs text-zinc-400 truncate max-w-[280px]">{r3?.overall_feedback?.slice(0, 80) || "Clinician feedback published"}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleViewFeedback(dStr)}
                    className="h-7 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 cursor-pointer"
                  >
                    View feedback
                  </Button>
                </div>
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
            "Perform each activity at a steady pace. Take a photo or record a short video, or note if you need to rest."}
        </p>
      </div>

      {/* Progress Indicators */}
      <div className="flex gap-1.5 w-full">
        {steps.map((st, i) => {
          const isDone = Boolean(stepData[st.id]?.videoPath || stepData[st.id]?.skipped || activityDoneMap[st.id]);
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

            {/* Linked coloring / image generation activity — download, color on screen, or print+photo */}
            {(activeStep as unknown as { generated_activity?: { id: string; title: string; instructions: string; base_image_url: string | null; age_band?: string; spark_spec?: { difficulty?: string; estimatedMinutes?: number } } | null; generated_activity_id?: string | null }).generated_activity?.base_image_url && (
              <StepActivityWorksheet
                key={`${activeStep.id}-${(activeStep as unknown as { generated_activity?: { id: string } }).generated_activity?.id || ""}`}
                step={activeStep}
                activity={(activeStep as unknown as { generated_activity: never }).generated_activity}
                patientId={(program as unknown as { patient_id?: string; patient?: { id: string } })?.patient_id || (program as unknown as { patient?: { id: string } })?.patient?.id || (submission as unknown as { patient_id?: string })?.patient_id || null}
                clientId={user?.id || null}
                stepSubmissionId={activeStepData.stepSubmissionId || null}
                programId={programId}
                scheduledDate={selectedDate || submission?.scheduled_date || null}
                onSaved={() => setActivityDoneMap((prev) => ({ ...prev, [activeStep.id]: true }))}
              />
            )}

            {/* Media Uploader (Photo or Video) or Skip Reason */}
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
                    <span>Uploading to Supabase (program-videos) — please wait…</span>
                  </div>
                )}

                {activeStepData.videoPath && (
                  <div className="flex flex-row items-center justify-between text-[11px] text-zinc-400 bg-zinc-950/60 px-3 py-2 rounded-md border border-zinc-800 gap-2">
                    <span className="flex flex-row items-center gap-1.5 text-teal-400 whitespace-nowrap">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {activeStepData.mediaKind === "photo" ? "Photo" : activeStepData.mediaKind === "video" ? "Video" : "Media"} in Supabase
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResetStepMedia(activeStep.id)}
                      disabled={uploadingStepId === activeStep.id}
                      className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 gap-1 px-2 whitespace-nowrap"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset
                    </Button>
                  </div>
                )}

                <MediaUploader
                  key={`${activeStep.id}-${activeStepData.videoPath ? "has-media" : "no-media"}`}
                  onMediaReady={handleMediaReady}
                  existingMediaPath={activeStepData.videoPath}
                  existingMediaMeta={activeStepData.mediaKind || activeStepData.mediaMime ? { mime: activeStepData.mediaMime, mediaKind: activeStepData.mediaKind } : null}
                  onReset={() => handleResetStepMedia(activeStep.id)}
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
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
                          <Badge variant="emerald" statusText={data?.mediaKind === "photo" ? "Photo Ready" : data?.mediaKind === "video" ? "Video Ready" : "Media Ready"} icon={<CheckCircle2 className="w-3 h-3" />} />
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

              {/* Consent 2: Optional AI Processing (therapist-assisted) */}
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
                    Optional: Allow your therapist to use AI assistance
                  </span>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Allows your therapist to use AI to help review your videos and notes for tentative observations. You may decline this and still submit for human clinician review.
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
