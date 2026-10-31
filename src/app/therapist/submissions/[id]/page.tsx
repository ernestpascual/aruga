"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Save,
  Send,
  CheckSquare,
  Square,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SamOverlay } from "@/components/ui/sam-overlay";
import { Submission, StepSubmission, ProgramStep, AiAnalysisRecord } from "@/types/database";
import {
  DEMO_SUBMISSION_ID,
  DEMO_PEDIATRIC_SUBMISSION_ID,
} from "@/lib/supabase/mock-store";

export default function TherapistSubmissionReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading review...</div>}>
      <TherapistSubmissionReviewContent params={params} />
    </React.Suspense>
  );
}

function TherapistSubmissionReviewContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const submissionId = resolvedParams.id;
  const isDemo =
    submissionId === DEMO_SUBMISSION_ID ||
    submissionId === DEMO_PEDIATRIC_SUBMISSION_ID ||
    submissionId.includes("demo");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Submission data state
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [steps, setSteps] = useState<ProgramStep[]>([]);
  const [stepSubmissions, setStepSubmissions] = useState<StepSubmission[]>([]);

  // Therapist feedback state
  const [stepNotes, setStepNotes] = useState<Record<string, string>>({});
  const [overallFeedback, setOverallFeedback] = useState("");
  const [soapSubjective, setSoapSubjective] = useState("");
  const [soapObjective, setSoapObjective] = useState("");
  const [soapAssessment, setSoapAssessment] = useState("");
  const [soapPlan, setSoapPlan] = useState("");
  const [clientSummary, setClientSummary] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // AI Assistant state per step
  const [analyzingStepId, setAnalyzingStepId] = useState<string | null>(null);
  const [collapsedAssistants, setCollapsedAssistants] = useState<Record<string, boolean>>({});
  const [aiRecords, setAiRecords] = useState<Record<string, AiAnalysisRecord>>({});
  const [confirmedObs, setConfirmedObs] = useState<Record<string, string[]>>({});

  useEffect(() => {
    // Load submission data
    const fetchSubmission = async () => {
      try {
        setLoading(true);

        // Attempt live fetch from Supabase
        const res = await fetch(`/api/client/submissions?submissionId=${submissionId}`);
        const data = await res.json();

        if (data.submission) {
          setSubmission(data.submission);
          const loadedSteps = data.submission.program?.steps || [];
          const loadedStepSubs = data.submission.step_submissions || [];

          if (loadedSteps.length > 0) setSteps(loadedSteps);
          if (loadedStepSubs.length > 0) setStepSubmissions(loadedStepSubs);

          if (data.submission.review) {
            if (data.submission.review.overall_feedback) {
              setOverallFeedback(data.submission.review.overall_feedback);
            }
            if (data.submission.review.subjective) setSoapSubjective(data.submission.review.subjective);
            if (data.submission.review.objective) setSoapObjective(data.submission.review.objective);
            if (data.submission.review.assessment) setSoapAssessment(data.submission.review.assessment);
            if (data.submission.review.plan) setSoapPlan(data.submission.review.plan);
            if (data.submission.review.client_summary) setClientSummary(data.submission.review.client_summary);

            if (Array.isArray(data.submission.review.step_reviews)) {
              const notesMap: Record<string, string> = {};
              data.submission.review.step_reviews.forEach((sr: { step_submission_id: string; therapist_note?: string }) => {
                notesMap[sr.step_submission_id] = sr.therapist_note || "";
              });
              setStepNotes(notesMap);
            }
          }

          if (loadedSteps.length > 0) setSteps(loadedSteps);
          if (loadedStepSubs.length > 0) setStepSubmissions(loadedStepSubs);
          setLoading(false);
          return;
        }

        const isDemoSubmission = isDemo;

        if (!isDemoSubmission) {
          setStatusMessage({ type: "error", text: "Submission not found or has been archived." });
          setLoading(false);
          return;
        }

        const isPediatric = submissionId === DEMO_PEDIATRIC_SUBMISSION_ID || submissionId.includes("pediatric");
        const mockSteps: ProgramStep[] = isPediatric
          ? [
              {
                id: "77777774-7777-4777-8777-777777777774",
                program_id: "44444444-4444-4444-8444-444444444445",
                position: 1,
                title: "Colorful Peg Stacking Game",
                instructions:
                  "Have Leo use thumb and index finger (pincer grasp) to pick up 5 colorful pegs and place them into the board. Encourage keeping the helper hand steady on the table.",
                created_at: new Date().toISOString(),
              },
              {
                id: "77777775-7777-4777-8777-777777777775",
                program_id: "44444444-4444-4444-8444-444444444445",
                position: 2,
                title: "Play-Doh Bead Roll & Squash",
                instructions:
                  "Roll three small dough balls between palms or fingers, then have Leo squash each one flat with his pointer finger.",
                created_at: new Date().toISOString(),
              },
              {
                id: "77777776-7777-4777-8777-777777777776",
                program_id: "44444444-4444-4444-8444-444444444445",
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
                program_id: "44444444-4444-4444-8444-444444444444",
                position: 1,
                title: "Cylindrical Cup Lift and Transfer",
                instructions:
                  "Place a lightweight plastic cup 6 inches in front of you. Reach forward using full active extension, grasp with all digits, lift 3 inches vertically, hold for 2 seconds, and place back down gently without knocking it over.",
                created_at: new Date().toISOString(),
              },
              {
                id: "77777772-7777-4777-8777-777777777772",
                program_id: "44444444-4444-4444-8444-444444444444",
                position: 2,
                title: "Small Block Lateral Stacking",
                instructions:
                  "Pick up the wooden block using a three-jaw chuck (thumb, index, middle fingers). Move it across your midline to the target marker on your left, then release cleanly.",
                created_at: new Date().toISOString(),
              },
              {
                id: "77777773-7777-4777-8777-777777777773",
                program_id: "44444444-4444-4444-8444-444444444444",
                position: 3,
                title: "Forearm Supination with Washcloth",
                instructions:
                  "Hold the folded washcloth flat on the tabletop. Slowly rotate your forearm so your palm faces fully upward, pausing for 3 seconds before returning to neutral.",
                created_at: new Date().toISOString(),
              },
            ];

        const mockStepSubs: StepSubmission[] = isPediatric
          ? [
              {
                id: "88888884-8888-4888-8888-888888888884",
                submission_id: submissionId,
                program_step_id: mockSteps[0].id,
                video_path: "/demo/cup_grasp_transfer.mp4",
                media_meta: { mime: "video/mp4", durationSeconds: 15, formatSupported: true },
                client_comment: "Leo loved picking the green and yellow pegs today!",
                skipped: false,
                skip_reason: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                id: "88888885-8888-4888-8888-888888888885",
                submission_id: submissionId,
                program_step_id: mockSteps[1].id,
                video_path: "/demo/block_stacking.mp4",
                media_meta: { mime: "video/mp4", durationSeconds: 12, formatSupported: true },
                client_comment: "Used index finger to squash all 3 dough balls.",
                skipped: false,
                skip_reason: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                id: "88888886-8888-4888-8888-888888888886",
                submission_id: submissionId,
                program_step_id: mockSteps[2].id,
                video_path: null,
                media_meta: {},
                client_comment: null,
                skipped: true,
                skip_reason: "Jar lid was too tight for tiny hands; will practice with a looser lid tomorrow.",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ]
          : [
              {
                id: "88888881-8888-4888-8888-888888888881",
                submission_id: submissionId,
                program_step_id: mockSteps[0].id,
                video_path: "/demo/cup_grasp_transfer.mp4",
                media_meta: { mime: "video/mp4", durationSeconds: 15, formatSupported: true },
                client_comment: "Felt smoother than last week! Finger extension still feels stiff right before touching the cup.",
                skipped: false,
                skip_reason: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                id: "88888882-8888-4888-8888-888888888882",
                submission_id: submissionId,
                program_step_id: mockSteps[1].id,
                video_path: "/demo/block_stacking.mp4",
                media_meta: { mime: "video/mp4", durationSeconds: 12, formatSupported: true },
                client_comment: "Managed 4 repetitions with the small wooden block.",
                skipped: false,
                skip_reason: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                id: "88888883-8888-4888-8888-888888888883",
                submission_id: submissionId,
                program_step_id: mockSteps[2].id,
                video_path: null,
                media_meta: {},
                client_comment: null,
                skipped: true,
                skip_reason: "Shoulder felt tight and fatigued after step 2; rested per precautions.",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ];

        setSteps(mockSteps);
        setStepSubmissions(mockStepSubs);

        if (isPediatric) {
          setStepNotes({
            [mockStepSubs[0].id]: "Clear index-thumb opposition. Helper hand stabilized the board well.",
            [mockStepSubs[1].id]: "Good finger isolation when squashing the dough beads.",
            [mockStepSubs[2].id]: "Appropriate skip. Practice with a looser lid first.",
          });
          setOverallFeedback(
            "Fantastic progress, Leo! Sarah, his pincer grasp on the pegs showed wonderful isolated finger control with much less whole-hand raking. Great call on loosening the jar lid for step 3."
          );
          setSoapSubjective("Sarah reported Leo was enthusiastic with the colored pegs. Noted step 3 jar was too tight for independent opening.");
          setSoapObjective("Neat pincer grasp achieved on 5 peg placements. Helper hand spontaneously stabilized container rim.");
          setSoapAssessment("Bilateral coordination and thumb-index pad opposition show marked maturation from gross raking grasp.");
          setSoapPlan("Continue daily peg stacking and play-doh routines. Use pre-loosened plastic containers for bilateral twist-off practice.");
          setClientSummary("Leo did an incredible job using his 'pincer fingers' to place the colorful pegs! Sarah, having him hold the container with his helper hand made all the difference. For tomorrow, start with the jar lid already partly loosened so Leo can celebrate opening it all by himself!");
        } else {
          setStepNotes({
            [mockStepSubs[0].id]: "Smooth cylindrical grasp observed. Minimal trunk compensation. Keep focusing on slow finger release.",
            [mockStepSubs[1].id]: "Clean pinch grasp. Noticeable control when crossing midline.",
            [mockStepSubs[2].id]: "Appropriate skip. We will re-evaluate shoulder active range of motion during our next session.",
          });
          setOverallFeedback(
            "Great effort on the tabletop transfer routine. Wrist alignment during the cup release is noticeably improved. Good decision to rest the shoulder on step 3—honoring fatigue prevents compensatory shoulder hiking."
          );
          setSoapSubjective("Marcus reported feeling smoother during cup lifts, but noted residual morning finger stiffness. Made an appropriate clinical decision to rest shoulder on step 3.");
          setSoapObjective("Video review demonstrates active cylindrical grasp with 3-4 inch vertical cup lift. Trunk lateral flexion under 5°. Step 2 block stacking completed with 4 clean chuck releases.");
          setSoapAssessment("Right UE hemiparesis shows steady neuromuscular recovery. Tabletop grasp and release are functional; proximal shoulder girdle endurance is the remaining limiting factor.");
          setSoapPlan("Maintain current tabletop routine 1x daily. Introduce 30-second resting intervals between block sets. Re-check active shoulder flexion in next live session.");
          setClientSummary("You did an outstanding job lifting and releasing the cup smoothly without leaning your body. Listening to your shoulder and resting on step 3 was 100% the right call. Keep practicing the cup and block exercises once a day, and remember to take 30-second breathers whenever your shoulder feels tired!");
        }

        // Preload step 1 AI record from demo
        const mockAiRec: AiAnalysisRecord = {
          id: "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          step_submission_id: mockStepSubs[0].id,
          analysis_kind: "full_review",
          model_id: "muse-spark-1.3 + sam-3.1",
          idempotency_key: "spark-sam-demo-v1",
          prompt_version: "v1",
          processing_status: "completed",
          spark_results: {
            observations: [
              { id: "obs-1", description: "Subject reaches forward with right upper extremity toward a blue plastic cup.", approx_timestamp_seconds: 2.4, confirmed: true },
              { id: "obs-2", description: "Full active cylindrical grasp achieved around the midsection of the cup.", approx_timestamp_seconds: 5.1, confirmed: true },
              { id: "obs-3", description: "Cup lifted approximately 3-4 inches above table surface without tilting.", approx_timestamp_seconds: 7.8, confirmed: true },
              { id: "obs-4", description: "Controlled descent and release with minimal trunk lateral flexion.", approx_timestamp_seconds: 11.2, confirmed: false },
            ],
            limitations: [
              "Camera angle is slightly angled from the right side; partial wrist occlusion during initial contact.",
              "Video frame rate is approximately 30fps.",
            ],
            suggested_object_concept: "cup",
            clinical_note_draft: "Video reveals smooth cylindrical grasp and sustained vertical lift of the target cup with intact tabletop release.",
          },
          sam_results: {
            object_concept: "cup",
            detected_frames_count: 8,
            boxes: [
              { frame_index: 0, timestamp_seconds: 0.0, box: [0.42, 0.48, 0.72, 0.62], label: "cup", confidence: 0.94 },
              { frame_index: 1, timestamp_seconds: 2.0, box: [0.42, 0.48, 0.72, 0.62], label: "cup", confidence: 0.95 },
              { frame_index: 2, timestamp_seconds: 4.5, box: [0.41, 0.48, 0.71, 0.62], label: "cup", confidence: 0.96 },
              { frame_index: 3, timestamp_seconds: 6.0, box: [0.32, 0.48, 0.62, 0.62], label: "cup", confidence: 0.96 },
              { frame_index: 4, timestamp_seconds: 8.0, box: [0.30, 0.48, 0.60, 0.62], label: "cup", confidence: 0.97 },
              { frame_index: 5, timestamp_seconds: 10.0, box: [0.38, 0.48, 0.68, 0.62], label: "cup", confidence: 0.95 },
              { frame_index: 6, timestamp_seconds: 12.0, box: [0.42, 0.48, 0.72, 0.62], label: "cup", confidence: 0.94 },
              { frame_index: 7, timestamp_seconds: 14.0, box: [0.42, 0.48, 0.72, 0.62], label: "cup", confidence: 0.93 },
            ],
            svg_paths: [
              { frame_index: 3, path: "M0.48 0.32 L0.62 0.32 L0.61 0.62 L0.49 0.62 Z" },
              { frame_index: 4, path: "M0.48 0.30 L0.62 0.30 L0.61 0.60 L0.49 0.60 Z" },
            ],
            duration_analyzed_seconds: 14,
          },
          artifact_path: "ai-artifacts/sam-cup-demo.json",
          confirmed_observations: ["obs-1", "obs-2", "obs-3"],
          timing_ms: 1840,
          sanitized_error: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setAiRecords({ [mockStepSubs[0].id]: mockAiRec });
        setConfirmedObs({ [mockStepSubs[0].id]: ["obs-1", "obs-2", "obs-3"] });
      } catch {
        // error
      } finally {
        setLoading(false);
      }
    };

    fetchSubmission();
  }, [submissionId, isDemo]);

  // Toggle Assistant Collapse
  const toggleCollapse = (stepSubId: string) => {
    setCollapsedAssistants((prev) => ({
      ...prev,
      [stepSubId]: !prev[stepSubId],
    }));
  };

  const handleAnalyzeWithMeta = async (stepSub: StepSubmission, step: ProgramStep) => {
    if (!stepSub.video_path && !isDemo) {
      setStatusMessage({
        type: "error",
        text: "Cannot run Meta AI analysis: no video was uploaded by the client for this step.",
      });
      return;
    }

    setAnalyzingStepId(stepSub.id);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/meta/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepSubmissionId: stepSub.id,
          videoUrl: stepSub.video_path || (isDemo ? "/demo/tabletop_exercise.mp4" : ""),
          stepInstructions: step.instructions,
          stepTitle: step.title || `Step ${step.position}`,
          runSam: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Meta AI analysis failed.");
      }

      setAiRecords((prev) => ({ ...prev, [stepSub.id]: data.record }));
      setCollapsedAssistants((prev) => ({ ...prev, [stepSub.id]: false }));
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setAnalyzingStepId(null);
    }
  };

  // Toggle observation confirmation
  const handleToggleObservation = (stepSubId: string, obsId: string) => {
    const current = confirmedObs[stepSubId] || [];
    const updated = current.includes(obsId)
      ? current.filter((id) => id !== obsId)
      : [...current, obsId];

    setConfirmedObs((prev) => ({ ...prev, [stepSubId]: updated }));
  };

  // Draft feedback for a step using Meta
  const handleDraftFeedbackWithMeta = async (stepSub: StepSubmission, step: ProgramStep) => {
    try {
      const confirmed = confirmedObs[stepSub.id] || [];
      const aiRec = aiRecords[stepSub.id];
      const confirmedTexts = aiRec?.spark_results?.observations
        ?.filter((o) => confirmed.includes(o.id))
        .map((o) => o.description) || [];

      const res = await fetch("/api/meta/draft-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepInstructions: step.instructions,
          therapistNotes: stepNotes[stepSub.id] || "",
          confirmedObservations: confirmedTexts,
          clientComment: stepSub.client_comment || "",
          skipped: stepSub.skipped,
          skipReason: stepSub.skip_reason || "",
        }),
      });

      const data = await res.json();
      if (res.ok && data.draftStepNote) {
        setStepNotes((prev) => ({
          ...prev,
          [stepSub.id]: data.draftStepNote,
        }));
      }
    } catch {
      // Error
    }
  };

  // Save Draft Review or Publish Review
  const handleSaveReview = async (action: "save_draft" | "publish") => {
    if (submitting) return;
    setSubmitting(true);
    setStatusMessage(null);

    try {
      const stepReviewsPayload = stepSubmissions.map((ss) => ({
        stepSubmissionId: ss.id,
        note: stepNotes[ss.id] || "",
      }));

      const res = await fetch("/api/therapist/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          submissionId,
          stepReviews: stepReviewsPayload,
          overallFeedback,
          subjective: soapSubjective,
          objective: soapObjective,
          assessment: soapAssessment,
          plan: soapPlan,
          clientSummary,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update review.");
      }

      if (action === "publish") {
        setStatusMessage({
          type: "success",
          text: "Review atomically published! Client can now view your step notes and overall feedback.",
        });
        setTimeout(() => {
          router.push(`/therapist/clients/33333333-3333-4333-8333-333333333333`);
        }, 1800);
      } else {
        setStatusMessage({
          type: "success",
          text: "Draft review saved privately. Feedback remains hidden from client until published.",
        });
      }
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateAiSummary = async () => {
    setGeneratingSummary(true);
    try {
      const res = await fetch("/api/ai/soap-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "submission_review",
          targetId: submissionId,
          subjective: soapSubjective,
          objective: soapObjective,
          assessment: soapAssessment,
          plan: soapPlan,
          clientName: clientDisplayName,
          isDemo,
        }),
      });
      const data = await res.json();
      if (data.summary) {
        setClientSummary(data.summary);
      }
    } catch (err) {
      console.warn("Could not generate summary:", err);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const isPediatric = submissionId === DEMO_PEDIATRIC_SUBMISSION_ID || submissionId.includes("pediatric");

  if (loading) {
    return (
      <div className="py-16 text-center text-zinc-500 text-sm">
        Loading submission review...
      </div>
    );
  }

  const clientDisplayName =
    submission?.program?.patient?.name ||
    (submission && "patient" in submission && (submission as Record<string, unknown>).patient
      ? ((submission as Record<string, unknown>).patient as { name?: string }).name
      : null) ||
    "Client";
  const clientLink = submission?.patient_id
    ? `/therapist/clients/${submission.patient_id}`
    : "/therapist/clients";

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Back button */}
      <div>
        <Link
          href={clientLink}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to {clientDisplayName}
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              {isPediatric
                ? "Playful Pincer Grasp & Bilateral Toy Routine"
                : "Tabletop Grasp & Precision Release Routine"}
            </h1>
            <Badge variant="teal" statusText="Awaiting Review" />
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Client: <span className="text-zinc-200 font-medium">{clientDisplayName}</span> • Submitted Recently • {steps.length > 0 ? `${steps.length} Steps Total` : "Routine Submission"}
          </p>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`rounded-lg p-3 text-xs flex items-start gap-2 ${
            statusMessage.type === "success"
              ? "bg-emerald-950/70 border border-emerald-800 text-emerald-200"
              : "bg-red-950/70 border border-red-800 text-red-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Submitted Steps List */}
      <div className="space-y-6">
        {stepSubmissions.map((stepSub, idx) => {
          const step = steps.find((s) => s.id === stepSub.program_step_id) || steps[idx];
          const aiRec = aiRecords[stepSub.id];
          const isCollapsed = collapsedAssistants[stepSub.id] ?? false;
          const isAnalyzing = analyzingStepId === stepSub.id;
          const currentConfirmed = confirmedObs[stepSub.id] || [];

          return (
            <Card key={stepSub.id} className="border-zinc-800 bg-zinc-900/90 p-5 space-y-4">
              {/* Step Title & Skipped/Completed Badge */}
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-zinc-800 text-teal-400 text-xs font-bold flex items-center justify-center">
                    {step?.position || idx + 1}
                  </span>
                  <h2 className="text-sm font-semibold text-zinc-100">
                    {step?.title || `Step ${idx + 1}`}
                  </h2>
                </div>

                {stepSub.skipped ? (
                  <Badge variant="amber" statusText="Skipped by Client" />
                ) : (
                  <Badge variant="emerald" statusText="Video Submitted" icon={<Video className="w-3 h-3" />} />
                )}
              </div>

              {/* Original Instructions */}
              <div className="rounded-lg bg-zinc-950/70 border border-zinc-800/80 p-3 text-xs text-zinc-300 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Assigned Instructions:
                </span>
                <p className="leading-relaxed">{step?.instructions}</p>
              </div>

              {/* Video Player or Skipped Reason */}
              {stepSub.skipped ? (
                <div className="rounded-lg bg-amber-950/30 border border-amber-800/60 p-4 text-xs text-amber-200 space-y-1">
                  <span className="font-semibold text-amber-300">Client Skip Explanation:</span>
                  <p className="text-amber-200/90 italic leading-relaxed">
                    &quot;{stepSub.skip_reason}&quot;
                  </p>
                </div>
              ) : stepSub.video_path || isDemo ? (
                <div className="space-y-3">
                  {/* SAM Video Player with Live Tracking Overlays */}
                  <SamOverlay
                    videoSrc={stepSub.video_path || (isDemo ? "/demo/tabletop_exercise.mp4" : "")}
                    boxes={aiRec?.sam_results?.boxes}
                    svgPaths={aiRec?.sam_results?.svg_paths}
                    objectConcept={aiRec?.sam_results?.object_concept}
                    modelProvenance="SAM 3.1: object segmentation"
                  />

                  {stepSub.client_comment && (
                    <div className="text-xs text-zinc-400 bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800/60">
                      <span className="text-zinc-500 font-medium">Client Comment: </span>
                      &quot;{stepSub.client_comment}&quot;
                    </div>
                  )}

                  {/* Collapsible Meta Review Assistant */}
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
                    <div className="flex items-center justify-between p-3 border-b border-zinc-800/80 bg-zinc-900/50">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-teal-400" />
                        <span className="text-xs font-semibold text-zinc-200">
                          Meta Review Assistant
                        </span>
                        {aiRec && (
                          <span className="text-[10px] text-teal-400 font-mono">
                            • {aiRec.model_id}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!aiRec && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            isLoading={isAnalyzing}
                            onClick={() => handleAnalyzeWithMeta(stepSub, step!)}
                            className="h-7 text-xs gap-1.5 border-teal-500/40 text-teal-300 hover:bg-teal-950/60"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                            Analyze with Meta
                          </Button>
                        )}

                        {aiRec && (
                          <button
                            type="button"
                            onClick={() => toggleCollapse(stepSub.id)}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-200"
                          >
                            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Assistant Body */}
                    {aiRec && !isCollapsed && (
                      <div className="p-4 space-y-4 text-xs">
                        {/* Tentative Observations Checklist */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-300">
                              Tentative Observable Actions (Muse Spark 1.3):
                            </span>
                            <span className="text-[11px] text-zinc-500">
                              Check to confirm as clinical evidence
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {aiRec.spark_results?.observations.map((obs) => {
                              const isChecked = currentConfirmed.includes(obs.id);
                              return (
                                <button
                                  key={obs.id}
                                  type="button"
                                  onClick={() => handleToggleObservation(stepSub.id, obs.id)}
                                  className={`w-full text-left p-2 rounded-lg border transition-all flex items-start gap-2.5 ${
                                    isChecked
                                      ? "bg-teal-950/50 border-teal-500/50 text-teal-200"
                                      : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                                  }`}
                                >
                                  {isChecked ? (
                                    <CheckSquare className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                                  ) : (
                                    <Square className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                                  )}
                                  <div className="flex-1">
                                    <p className="leading-relaxed">{obs.description}</p>
                                    {obs.approx_timestamp_seconds !== null && (
                                      <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
                                        approx ~{obs.approx_timestamp_seconds}s
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Visual Limitations */}
                        {aiRec.spark_results?.limitations && aiRec.spark_results.limitations.length > 0 && (
                          <div className="text-[11px] text-zinc-500 space-y-0.5 bg-zinc-900/40 p-2 rounded border border-zinc-800/60">
                            <span className="font-semibold text-zinc-400">Capture Limitations:</span>
                            <ul className="list-disc list-inside">
                              {aiRec.spark_results.limitations.map((lim, i) => (
                                <li key={i}>{lim}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Helper button to draft note */}
                        <div className="pt-1 flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleDraftFeedbackWithMeta(stepSub, step!)}
                            className="h-7 text-xs gap-1.5 text-zinc-300"
                          >
                            <Sparkles className="w-3 h-3 text-teal-400" />
                            Draft Step Note with Confirmed Evidence
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-zinc-950/60 border border-zinc-800 p-4 text-xs text-zinc-400">
                  <p>No video recorded for this step.</p>
                </div>
              )}

              {/* Therapist Step Notes Input */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-zinc-300">
                  Therapist Step Note (Published to client upon review completion):
                </label>
                <Textarea
                  rows={2}
                  placeholder="Enter your clinical observations and specific guidance for this step..."
                  value={stepNotes[stepSub.id] || ""}
                  onChange={(e) =>
                    setStepNotes((prev) => ({
                      ...prev,
                      [stepSub.id]: e.target.value,
                    }))
                  }
                  className="text-xs"
                />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Overall Review & Clinical SOAP Notes Section */}
      <Card className="border-zinc-800 bg-zinc-900/90 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div>
            <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-400" />
              Home Program Clinical SOAP Documentation
            </CardTitle>
            <p className="text-xs text-zinc-400 mt-0.5">
              Divided into structured clinical SOAP boxes, followed by an easy-to-understand summary for the client.
            </p>
          </div>
          <span className="text-[11px] font-medium text-teal-400 bg-teal-950/70 border border-teal-500/30 px-2.5 py-1 rounded-md self-start sm:self-auto">
            SOAP Standard + Client Plain English
          </span>
        </div>

        {/* 4 Distinct SOAP Textarea Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* S - Subjective */}
          <div className="space-y-1.5 rounded-xl border border-sky-900/40 bg-zinc-950/60 p-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-sky-950 border border-sky-500/40 text-[10px] flex items-center justify-center font-mono">S</span>
                Subjective
              </label>
              <span className="text-[10px] text-zinc-500">Client comments & fatigue/pain</span>
            </div>
            <Textarea
              rows={3}
              placeholder="Record client-reported symptoms, pain scale, difficulty noted during routine, or skip explanations..."
              value={soapSubjective}
              onChange={(e) => setSoapSubjective(e.target.value)}
              className="text-xs leading-relaxed border-zinc-800 bg-zinc-900/80 focus-visible:ring-sky-500"
            />
          </div>

          {/* O - Objective */}
          <div className="space-y-1.5 rounded-xl border border-teal-900/40 bg-zinc-950/60 p-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-teal-950 border border-teal-500/40 text-[10px] flex items-center justify-center font-mono">O</span>
                Objective
              </label>
              <span className="text-[10px] text-zinc-500">Visual evidence & kinematics</span>
            </div>
            <Textarea
              rows={3}
              placeholder="Observable metrics, confirmed Spark/SAM kinematic detections, repetitions completed, grasp form..."
              value={soapObjective}
              onChange={(e) => setSoapObjective(e.target.value)}
              className="text-xs leading-relaxed border-zinc-800 bg-zinc-900/80 focus-visible:ring-teal-500"
            />
          </div>

          {/* A - Assessment */}
          <div className="space-y-1.5 rounded-xl border border-amber-900/40 bg-zinc-950/60 p-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-950 border border-amber-500/40 text-[10px] flex items-center justify-center font-mono">A</span>
                Assessment
              </label>
              <span className="text-[10px] text-zinc-500">Clinical synthesis & progress</span>
            </div>
            <Textarea
              rows={3}
              placeholder="Clinical analysis of functional progress, motor re-education, compensatory patterns, tolerance..."
              value={soapAssessment}
              onChange={(e) => setSoapAssessment(e.target.value)}
              className="text-xs leading-relaxed border-zinc-800 bg-zinc-900/80 focus-visible:ring-amber-500"
            />
          </div>

          {/* P - Plan */}
          <div className="space-y-1.5 rounded-xl border border-indigo-900/40 bg-zinc-950/60 p-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-indigo-950 border border-indigo-500/40 text-[10px] flex items-center justify-center font-mono">P</span>
                Plan
              </label>
              <span className="text-[10px] text-zinc-500">Target adjustments & homework</span>
            </div>
            <Textarea
              rows={3}
              placeholder="Modifications to sets/reps, program changes, instructions for next upload, tele-rehab target..."
              value={soapPlan}
              onChange={(e) => setSoapPlan(e.target.value)}
              className="text-xs leading-relaxed border-zinc-800 bg-zinc-900/80 focus-visible:ring-indigo-500"
            />
          </div>
        </div>

        {/* Client-Friendly Summary Box */}
        <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/20 p-4 space-y-2 mt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold text-emerald-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Summary for Client & Family (Easy to Understand • Plain English)
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateAiSummary}
              disabled={generatingSummary || (!soapSubjective && !soapObjective && !soapAssessment && !soapPlan)}
              className="h-6 text-[10px] px-2.5 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/60 hover:text-emerald-200 gap-1"
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              {generatingSummary ? "Generating..." : "AI Generate Summary"}
            </Button>
          </div>
          <p className="text-[11px] text-zinc-400 leading-snug">
            Write an encouraging, non-jargon summary that directly explains how the client did, praises their efforts, and provides simple guidance for home practice.
          </p>
          <Textarea
            rows={3}
            placeholder="e.g., You did an outstanding job lifting and releasing the cup smoothly today! Listening to your shoulder and resting was the right call. Keep practicing once daily..."
            value={clientSummary}
            onChange={(e) => setClientSummary(e.target.value)}
            className="text-xs leading-relaxed border-emerald-500/30 bg-zinc-950/80 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500"
          />
        </div>
      </Card>

      {/* Review Actions Bar */}
      <div className="pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-4">
        <div className="text-[11px] text-zinc-500 max-w-sm">
          Draft reviews remain private to you. &quot;Publish Feedback&quot; atomically unlocks published notes and overall feedback for the client.
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            isLoading={submitting}
            onClick={() => handleSaveReview("save_draft")}
            className="gap-2 text-zinc-200"
          >
            <Save className="w-4 h-4" />
            Save Draft Review
          </Button>

          <Button
            type="button"
            isLoading={submitting}
            onClick={() => handleSaveReview("publish")}
            className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold"
          >
            <Send className="w-4 h-4" />
            Publish Feedback
          </Button>
        </div>
      </div>
    </div>
  );
}
