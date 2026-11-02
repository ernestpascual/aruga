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
  ExternalLink,
  Plus,
  Trash2,
  Clock,
  Wand2,
  Stethoscope,
  Layers,
  Check,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SamOverlay } from "@/components/ui/sam-overlay";
import { BiomechPanel } from "@/components/therapist/BiomechPanel";
import { useAuth } from "@/lib/supabase/auth-context";
import { Submission, StepSubmission, ProgramStep, AiAnalysisRecord, SoapNoteAssessmentLink } from "@/types/database";

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
  const { user } = useAuth();
  const resolvedParams = use(params);
  const submissionId = resolvedParams.id;

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
  const [soapRecordingUrl, setSoapRecordingUrl] = useState("");
  const [soapSubjective, setSoapSubjective] = useState("");
  const [soapObjective, setSoapObjective] = useState("");
  const [soapAssessment, setSoapAssessment] = useState("");
  const [soapAssessmentLinks, setSoapAssessmentLinks] = useState<SoapNoteAssessmentLink[]>([]);
  const [soapPlan, setSoapPlan] = useState("");
  const [clientSummary, setClientSummary] = useState("");
  const [isAiSummarizing, setIsAiSummarizing] = useState(false);

  // AI Assistant state per step
  const [analyzingStepId, setAnalyzingStepId] = useState<string | null>(null);
  const [collapsedAssistants, setCollapsedAssistants] = useState<Record<string, boolean>>({});
  const [aiRecords, setAiRecords] = useState<Record<string, AiAnalysisRecord>>({});
  const [confirmedObs, setConfirmedObs] = useState<Record<string, string[]>>({});
  const [activityCompletions, setActivityCompletions] = useState<Record<string, Record<string, unknown>>>({});
  // Biomech Engine state per step (no mock fallback)
  const [biomechIntents, setBiomechIntents] = useState<Record<string, string>>({});
  const [biomechLoading, setBiomechLoading] = useState<string | null>(null);
  const [biomechResults, setBiomechResults] = useState<Record<string, any>>({});
  const [biomechError, setBiomechError] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load submission data
    const fetchSubmission = async () => {
      try {
        setLoading(true);

        // Attempt live fetch from database — include requesterId so ownership check passes (DB read blocker fix)
        const qReq = user?.id ? `&requesterId=${user.id}` : "";
        const res = await fetch(`/api/client/submissions?submissionId=${submissionId}${qReq}`);
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
            if (data.submission.review.session_recording_url) {
              setSoapRecordingUrl(data.submission.review.session_recording_url);
            }
            if (data.submission.review.subjective) setSoapSubjective(data.submission.review.subjective);
            if (data.submission.review.objective) setSoapObjective(data.submission.review.objective);
            if (data.submission.review.assessment) setSoapAssessment(data.submission.review.assessment);
            if (Array.isArray(data.submission.review.assessment_links)) {
              setSoapAssessmentLinks(data.submission.review.assessment_links);
            }
            if (data.submission.review.plan) setSoapPlan(data.submission.review.plan);
            if (data.submission.review.client_summary) {
              setClientSummary(data.submission.review.client_summary);
            }

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

        setStatusMessage({ type: "error", text: "Submission not found. Database record required — no mock data (configure Supabase and run migrations)." });
        setLoading(false);
        return;
      } catch {
        // error
      } finally {
        setLoading(false);
      }
    };

    fetchSubmission();
  }, [submissionId, user?.id]);

  // Load activity completions (private per patient — therapist must own patient)
  useEffect(() => {
    if (stepSubmissions.length === 0) return;
    let cancelled = false;
    // Prefer real auth session over localStorage fallback — fixes DB-read block when localStorage stale/missing
    const userId = user?.id || (()=> { try { return JSON.parse(localStorage.getItem("aruga_user")||"null")?.id || ""; } catch { return ""; } })();
    Promise.all(
      stepSubmissions.map(async (ss) => {
        try {
          const qs = userId ? `&requesterId=${userId}` : "";
          const r = await fetch(`/api/activity-completions?stepSubmissionId=${ss.id}${qs}`);
          const d = await r.json();
          const comp = d.completions?.[0] as Record<string, unknown> | undefined;
          return { id: ss.id, comp: comp || null };
        } catch { return { id: ss.id, comp: null }; }
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, Record<string, unknown>> = {};
      results.forEach(({ id, comp }) => { if (comp) map[id] = comp; });
      setActivityCompletions(map);
    });
    return () => { cancelled = true; };
  }, [stepSubmissions.map((s)=>s.id).join("|"), user?.id]);

  // Toggle Assistant Collapse
  const toggleCollapse = (stepSubId: string) => {
    setCollapsedAssistants((prev) => ({
      ...prev,
      [stepSubId]: !prev[stepSubId],
    }));
  };

  const handleAnalyzeWithMeta = async (stepSub: StepSubmission, step: ProgramStep) => {
    if (!stepSub.video_path) {
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
          videoUrl: stepSub.video_path || "",
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

  const handleAddAssessmentLink = () => {
    setSoapAssessmentLinks((prev) => [...prev, { title: "", url: "" }]);
  };

  const handleUpdateAssessmentLink = (index: number, field: "title" | "url", value: string) => {
    setSoapAssessmentLinks((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveAssessmentLink = (index: number) => {
    setSoapAssessmentLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApplyClinicalPreset = (preset: "pediatric" | "neuro" | "geriatric") => {
    if (preset === "pediatric") {
      setSoapSubjective("Caregiver reported high engagement with colorful object activities. Minor frustration when jar lid was over-tightened.");
      setSoapObjective("Neat pincer grasp achieved across 5 peg placements. Stabilizing tabletop contact maintained on container rim.");
      setSoapAssessment("Bilateral coordination and thumb-index pad opposition show marked maturation from baseline raking grasp.");
      setSoapPlan("Continue daily peg stacking and sensory dough bead squashing. Use pre-loosened plastic containers for twist-off practice.");
      setSoapAssessmentLinks([
        {
          title: "Peabody Developmental Motor Scales (PDMS-2) Fine Motor Report",
          url: "https://drive.google.com/file/d/leo-pdms2-scorecard/view",
        },
      ]);
    } else if (preset === "neuro") {
      setSoapSubjective("Patient reported feeling smoother during cup lifts, but noted residual morning finger stiffness. Made sound clinical decision to rest shoulder on step 3.");
      setSoapObjective("Video review demonstrates active cylindrical grasp with 3-4 inch vertical cup lift. Trunk lateral flexion under 5°. Step 2 block stacking completed with 4 clean chuck releases.");
      setSoapAssessment("Right UE hemiparesis shows steady neuromuscular re-education. Tabletop grasp and release are functional; proximal shoulder girdle endurance is the remaining limiting factor.");
      setSoapPlan("Maintain current tabletop home program 1x daily. Introduce 30-second resting intervals between block sets. Re-check active shoulder flexion in next live session.");
      setSoapAssessmentLinks([
        {
          title: "Fugl-Meyer UE Motor Assessment (Baseline)",
          url: "https://drive.google.com/file/d/marcus-fugl-meyer-baseline/view",
        },
        {
          title: "Box and Blocks Test Protocol",
          url: "https://drive.google.com/file/d/box-and-blocks-standardized/view",
        },
      ]);
    } else if (preset === "geriatric") {
      setSoapSubjective("Client reports feeling more confident reaching into overhead kitchen cabinets. Mild balance hesitation when turning 180 degrees in kitchen.");
      setSoapObjective("Timed Up and Go (TUG) observed at 11.2s. Functional reach forward 9.5 inches with steady plantar surface contact. 8 sit-to-stand repetitions with minimal armrest push.");
      setSoapAssessment("Dynamic balance and lower extremity functional power demonstrate noticeable improvement with consistent home compliance. Fall risk reduced from moderate to mild.");
      setSoapPlan("Advance dynamic balance program with tandem stance holding counter. Progress sit-to-stand to alternating chair heights 2x daily.");
      setSoapAssessmentLinks([
        {
          title: "Berg Balance Scale (BBS) 14-Item Score Sheet",
          url: "https://drive.google.com/file/d/geriatric-berg-balance-evaluation/view",
        },
        {
          title: "Timed Up and Go (TUG) Normative Mobility Chart",
          url: "https://drive.google.com/file/d/tug-mobility-geriatric-chart/view",
        },
      ]);
    }
  };

  const handleAutoFillFromAiObservations = () => {
    const observationTexts: string[] = [];
    Object.values(aiRecords).forEach((rec) => {
      if (rec.spark_results?.observations) {
        rec.spark_results.observations.forEach((obs) => {
          if (obs.confirmed || confirmedObs[rec.step_submission_id]?.includes(obs.id)) {
            observationTexts.push(`• ${obs.description}`);
          }
        });
      }
    });

    if (observationTexts.length === 0) {
      Object.values(aiRecords).forEach((rec) => {
        if (rec.spark_results?.observations) {
          rec.spark_results.observations.forEach((obs) => {
            observationTexts.push(`• ${obs.description}`);
          });
        }
      });
    }

    if (observationTexts.length > 0) {
      const formatted = `Video review confirms kinematic detections:\n${observationTexts.join("\n")}`;
      setSoapObjective((prev) => (prev ? `${prev}\n\n${formatted}` : formatted));
    }
  };

  const handleGenerateAiSummary = async () => {
    if (isAiSummarizing) return;
    setIsAiSummarizing(true);
    try {
      const clientName = submission?.client_id || "Client";
      const res = await fetch("/api/ai/soap-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "submission_review",
          targetId: submissionId,
          subjective: soapSubjective || "",
          objective: soapObjective || "",
          assessment: soapAssessment || "",
          plan: soapPlan || "",
          clientName,
          forceRegenerate: true,
          isDemo: false,
        }),
      });

      const data = await res.json();
      if (data.summary) {
        setClientSummary(data.summary);
      }
    } catch (err) {
      console.warn("Could not generate summary:", err);
    } finally {
      setIsAiSummarizing(false);
    }
  };

  // Determine if feedback is already published/reviewed
  const isAlreadyReviewed =
    submission?.state === "reviewed" ||
    submission?.review?.status === "published" ||
    Boolean(submission?.review?.overall_feedback);

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

      const validLinks = soapAssessmentLinks.filter(
        (l) => l.title.trim() && l.url.trim()
      );

      const res = await fetch("/api/therapist/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          submissionId,
          stepReviews: stepReviewsPayload,
          overallFeedback,
          sessionRecordingUrl: soapRecordingUrl.trim() || null,
          subjective: soapSubjective,
          objective: soapObjective,
          assessment: soapAssessment,
          assessmentLinks: validLinks,
          plan: soapPlan,
          clientSummary: clientSummary.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update review.");
      }

      if (action === "publish") {
        setStatusMessage({
          type: "success",
          text: isAlreadyReviewed
            ? "Feedback changes successfully updated and saved for the client!"
            : "Review atomically published! Client can now view your step notes and overall feedback.",
        });
        const targetPatientId = submission?.patient_id || "33333333-3333-4333-8333-333333333333";
        setTimeout(() => {
          router.push(`/therapist/clients/${targetPatientId}`);
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

  const isPediatric = false; // was DEMO check, now DB-driven

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
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto pb-16 px-0">

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
      <div className="flex flex-col gap-3 border-b border-zinc-800 pb-4">
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold tracking-tight text-zinc-100 leading-tight">
            {isPediatric
              ? "Playful Pincer Grasp & Bilateral Toy Home Program"
              : "Tabletop Grasp & Precision Release Home Program"}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {isAlreadyReviewed ? (
              <Badge variant="emerald" statusText="Feedback Published • Editable" icon={<CheckCircle2 className="w-3 h-3" />} />
            ) : (
              <Badge variant="teal" statusText="Awaiting Review" />
            )}
            <span className="text-[11px] text-zinc-500">•</span>
            <span className="text-xs text-zinc-400">
              Client: <span className="text-zinc-200 font-medium">{clientDisplayName}</span>
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {isAlreadyReviewed ? "Feedback Published — editable anytime" : "Submitted Recently"} • {steps.length > 0 ? `${steps.length} Steps Total` : "Home Program Submission"}
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
        {(steps.length > 0 ? steps : stepSubmissions.map((ss, i) => ({
          id: ss.program_step_id || `step-${i}`,
          program_id: "",
          position: i + 1,
          title: `Step ${i + 1}`,
          instructions: "",
          created_at: "",
        }))).map((step, idx) => {
          const stepSub =
            stepSubmissions.find((s) => s.program_step_id === step.id) ||
            stepSubmissions[idx] ||
            ({
              id: `step-sub-${step.id}`,
              submission_id: submissionId,
              program_step_id: step.id,
              video_path: null,
              skipped: false,
              skip_reason: null,
              media_meta: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as StepSubmission);

          const aiRec = aiRecords[stepSub.id];
          const isCollapsed = collapsedAssistants[stepSub.id] ?? false;
          const isAnalyzing = analyzingStepId === stepSub.id;
          const currentConfirmed = confirmedObs[stepSub.id] || [];

          // Resolve and normalize video URL with leading slash
          const rawVideoPath = stepSub.video_path;

          const videoSource = rawVideoPath
            ? rawVideoPath.startsWith("http") || rawVideoPath.startsWith("/") || rawVideoPath.startsWith("blob:")
              ? rawVideoPath
              : `/${rawVideoPath}`
            : null;

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

                {(() => {
                  const mime = (stepSub.media_meta as unknown as { mime?: string; mediaKind?: string })?.mime || "";
                  const kind = (stepSub.media_meta as unknown as { mediaKind?: string })?.mediaKind;
                  const isPhoto = kind === "photo" || mime.startsWith("image/");
                  return stepSub.skipped ? (
                    <Badge variant="amber" statusText="Skipped by Client" />
                  ) : (
                    <Badge variant="emerald" statusText={isPhoto ? "Photo Submitted" : "Video Submitted"} icon={<Video className="w-3 h-3" />} />
                  );
                })()}
              </div>

              {/* Original Instructions */}
              <div className="rounded-lg bg-zinc-950/70 border border-zinc-800/80 p-3 text-xs text-zinc-300 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Assigned Instructions:
                </span>
                <p className="leading-relaxed">{step?.instructions}</p>
              </div>

              {/* Coloring / worksheet activity: show assigned worksheet + client saved version */}
              {(() => {
                const ga = (step as unknown as { generated_activity?: { id: string; title: string; instructions: string; base_image_url: string | null; base_image_path?: string | null; age_band?: string } | null })?.generated_activity;
                if (!ga?.base_image_url) return null;
                const comp = activityCompletions[stepSub.id] as { drawing_data_url?: string | null; photo_upload_path?: string | null; completion_method?: string; drawing_strokes?: unknown[]; created_at?: string } | undefined;
                const hasDigital = Boolean(comp?.drawing_data_url && comp?.completion_method !== "photo");
                const hasPhoto = Boolean(comp?.completion_method === "photo" && comp?.drawing_data_url);
                return (
                  <div className="rounded-xl border border-teal-500/20 bg-teal-950/10 overflow-hidden">
                    <div className="px-3 py-2 bg-zinc-950/60 border-b border-teal-500/10 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">🎨 Worksheet: {ga.title || step?.title}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">{comp ? (hasPhoto ? "Photo upload" : hasDigital ? "Digital coloring" : "Viewed") : "Not yet completed"}</span>
                    </div>
                    <div className="p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Assigned worksheet</p>
                          <div className="rounded-lg overflow-hidden border border-zinc-800 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={String(ga.base_image_url)} alt={String(ga.title || "Worksheet")} className="w-full h-auto object-contain" />
                          </div>
                          <a href={String(ga.base_image_url)} target="_blank" rel="noreferrer" className="inline-flex text-[11px] text-teal-400 hover:text-teal-300 gap-1">Open original <ExternalLink className="w-3 h-3" /></a>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Client work — {hasPhoto ? "printed & photographed" : hasDigital ? "saved digital coloring" : "awaiting"}</p>
                          {comp?.drawing_data_url ? (
                            <div className="rounded-lg overflow-hidden border border-zinc-800 bg-white">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={String(comp.drawing_data_url)} alt={hasPhoto ? "Client uploaded photo of printed worksheet" : "Client digital coloring"} className="w-full h-auto object-contain" />
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-950/60 p-6 text-center text-xs text-zinc-500">No saved coloring/photo yet for this step. Client can draw on screen (crayons + eraser) or print & upload a photo.</div>
                          )}
                          {comp?.created_at && <p className="text-[10px] text-zinc-500 font-mono">Saved {new Date(String(comp.created_at)).toLocaleString()}</p>}
                          {hasDigital && Array.isArray(comp?.drawing_strokes) && <p className="text-[10px] text-zinc-500">{(comp!.drawing_strokes as unknown[]).length} strokes • includes crayon colors & eraser</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Client Skip Reason if skipped */}
              {stepSub.skipped && (
                <div className="rounded-lg bg-amber-950/30 border border-amber-800/60 p-4 text-xs text-amber-200 space-y-1">
                  <span className="font-semibold text-amber-300">Client Skip Explanation:</span>
                  <p className="text-amber-200/90 italic leading-relaxed">
                    &quot;{stepSub.skip_reason}&quot;
                  </p>
                </div>
              )}

              {/* Photo/Video Player — Supabase program-videos bucket */}
              {videoSource ? (
                <div className="space-y-3">
                  {(() => {
                    const mime = (stepSub.media_meta as unknown as { mime?: string; mediaKind?: string })?.mime || "";
                    const kind = (stepSub.media_meta as unknown as { mediaKind?: string })?.mediaKind;
                    const isPhoto = kind === "photo" || mime.startsWith("image/") || /\.(jpg|jpeg|png|webp|heic)$/i.test(videoSource);
                    return (
                      <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                        <span className="flex items-center gap-1.5 text-teal-400 font-medium">
                          <Video className="w-3.5 h-3.5" /> {isPhoto ? "Uploaded Photo" : "Uploaded Video"} for Step {step?.position || idx + 1} — Supabase
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {isPhoto ? "Supabase program-videos" : "SAM 3.1 & Vision AI Enabled"}
                        </span>
                      </div>
                    );
                  })()}

                  {(() => {
                    const mime = (stepSub.media_meta as unknown as { mime?: string; mediaKind?: string })?.mime || "";
                    const kind = (stepSub.media_meta as unknown as { mediaKind?: string })?.mediaKind;
                    const isPhoto = kind === "photo" || mime.startsWith("image/") || /\.(jpg|jpeg|png|webp|heic)$/i.test(videoSource);
                    return isPhoto ? (
                      <div className="rounded-lg overflow-hidden bg-black border border-zinc-800">
                        <img src={videoSource} alt={`Step ${step?.position} submission`} className="w-full h-auto max-h-[420px] object-contain mx-auto" />
                      </div>
                    ) : (
                      <SamOverlay
                        videoSrc={videoSource}
                        boxes={aiRec?.sam_results?.boxes}
                        svgPaths={aiRec?.sam_results?.svg_paths}
                        objectConcept={aiRec?.sam_results?.object_concept}
                        modelProvenance="SAM 3.1: object segmentation"
                        mhr={biomechResults[stepSub.id] ?? null}
                      />
                    );
                  })()}

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
                  {/* Biomech Engine (no mock fallback) — per-step SAM 3.1 → Modal MHR */}
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-teal-400" /> Movement check — what to look at</span>
                      <a href="/docs/AGENTS_GUIDE.md#5-agent-2--biomech-engine-sam-31--modal-mhr" target="_blank" className="text-[11px] text-teal-400 hover:underline">Guide</a>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={biomechIntents[stepSub.id] || "U1"}
                        onChange={(e)=> setBiomechIntents(prev=> ({...prev, [stepSub.id]: e.target.value}))}
                        className="h-8 rounded-md border border-zinc-700 bg-zinc-900 text-xs text-zinc-200 px-2.5 flex-1"
                      >
                        <option value="U1">Arm & shoulder — reach and lift</option>
                        <option value="U2">Hand — grip and pinch</option>
                        <option value="U3">Walking — steps and balance</option>
                        <option value="U4">Get up & go — stand, walk, turn</option>
                        <option value="U5">Posture — trunk and back</option>
                        <option value="U6">Sit to stand — getting up</option>
                        <option value="U7">Both hands — together</option>
                        <option value="U8">Homework — how often</option>
                        <option value="U9">Over time — progress trend</option>
                        <option value="U10">Write notes — help draft</option>
                        <option value="U11">Neck — head control</option>
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!videoSource || biomechLoading === stepSub.id}
                        onClick={async ()=>{
                          if (!videoSource) return;
                          const intent = biomechIntents[stepSub.id] || "U1";
                          setBiomechLoading(stepSub.id);
                          setBiomechError(prev=> ({...prev, [stepSub.id]: ""}));
                          try {
                            const res = await fetch("/api/agent/biomech/run", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ submissionId, stepSubmissionId: stepSub.id, intent }) });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || "Biomech failed");
                            setBiomechResults(prev=> ({...prev, [stepSub.id]: data}));
                          } catch (e:any) { setBiomechError(prev=> ({...prev, [stepSub.id]: e.message || String(e)})); } finally { setBiomechLoading(null); }
                        }}
                        className="h-8 text-xs gap-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold shrink-0"
                      >
                        {biomechLoading===stepSub.id ? <span className="w-3 h-3 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                        Check movement
                      </Button>
                    </div>
                    {!videoSource && <p className="text-[11px] text-amber-300">No video yet — add one to check movement.</p>}
                    {biomechError[stepSub.id] && <p className="text-xs text-rose-300 bg-rose-950/20 border border-rose-800/40 rounded p-2">{biomechError[stepSub.id]}</p>}
                    {biomechResults[stepSub.id] && (
                      <BiomechPanel mhr={biomechResults[stepSub.id]} onInsertObjective={(txt)=> setSoapObjective(prev=> prev ? `${prev}\n\n${txt}` : txt)} />
                    )}
                    {biomechResults[stepSub.id] && <p className="text-[10px] text-zinc-500">Changing dropdown re-filters cached MHR — no re-bill. 1 Modal inference serves U1+U5+U11 views.</p>}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-zinc-950/60 border border-zinc-800 p-4 text-xs text-zinc-400">
                  <p>No photo or video submitted for this step.</p>
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
      <Card className="border-zinc-800 bg-zinc-900/90 p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div>
            <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-400" />
              Home Program Clinical SOAP Documentation
            </CardTitle>
            <p className="text-xs text-zinc-400 mt-0.5">
              Full-width structured clinical SOAP documentation (Subjective, Objective, Assessment, Plan) with session video recording and standardized test links.
            </p>
          </div>
          <span className="text-[11px] font-medium text-teal-400 bg-teal-950/70 border border-teal-500/30 px-2.5 py-1 rounded-md self-start sm:self-auto flex items-center gap-1.5 shrink-0">
            <Clock className="w-3 h-3 text-teal-400" />
            Clinical S.O.A.P. Standard
          </span>
        </div>

        {/* Clinical Presets & Quick Fill Bar */}
        <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Wand2 className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-xs font-semibold text-zinc-300">Quick Clinical Presets:</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleApplyClinicalPreset("pediatric")}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-teal-300 transition-colors"
            >
              Pediatric Fine Motor
            </button>
            <button
              type="button"
              onClick={() => handleApplyClinicalPreset("neuro")}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-teal-300 transition-colors"
            >
              Adult Stroke / Neuro
            </button>
            <button
              type="button"
              onClick={() => handleApplyClinicalPreset("geriatric")}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-teal-300 transition-colors"
            >
              Geriatric Balance & TUG
            </button>
            <button
              type="button"
              onClick={handleAutoFillFromAiObservations}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-teal-950/60 hover:bg-teal-900/60 border border-teal-500/40 text-teal-300 hover:text-teal-200 flex items-center gap-1 transition-colors"
              title="Populate Objective section with confirmed kinematic detections from Spark and SAM"
            >
              <Sparkles className="w-3 h-3 text-teal-400" />
              Auto-Fill Objective from AI
            </button>
          </div>
        </div>

        {/* 1. SESSION VIDEO RECORDING URL (PLACED BEFORE ACTUAL SOAP NOTES) */}
        <div className="p-3.5 rounded-xl border border-teal-500/30 bg-teal-950/20 space-y-1.5">
          <label className="text-xs font-bold text-teal-300 flex items-center gap-2">
            <Video className="w-4 h-4 text-teal-400" />
            Session Video Recording URL (Placed Before SOAP Notes)
          </label>
          <p className="text-[11px] text-zinc-400">
            Add the cloud recording link for this synchronous telehealth or live evaluation session (e.g. Google Meet, Zoom, Vimeo, or Google Drive link).
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Input
              type="url"
              placeholder="https://meet.google.com/rec/session-id or https://drive.google.com/file/d/..."
              value={soapRecordingUrl}
              onChange={(e) => setSoapRecordingUrl(e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-xs text-zinc-200"
            />
            {soapRecordingUrl.trim() && (
              <a
                href={soapRecordingUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-md bg-teal-500/20 border border-teal-500/40 text-teal-300 hover:bg-teal-500/30 text-xs font-semibold flex items-center gap-1 shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Test Link
              </a>
            )}
          </div>
        </div>

        {/* 2. FULL-WIDTH SOAP DOCUMENTATION BOXES WITH LARGE TEXTAREAS */}
        <div className="space-y-4">
          {/* S: Subjective - FULL WIDTH */}
          <div className="space-y-1.5 rounded-xl border border-sky-900/40 bg-zinc-950/60 p-4">
            <label className="text-xs font-bold text-sky-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-sky-950 border border-sky-500/40 text-[11px] flex items-center justify-center font-mono">
                S
              </span>
              Subjective *
              <span className="text-[11px] text-zinc-500 font-normal">
                (Patient symptoms, pain scale, functional complaints, caregiver observations)
              </span>
            </label>
            <Textarea
              rows={6}
              placeholder="Patient's reported feelings, pain levels (0-10), feedback from family/caregiver, daily home program challenges..."
              value={soapSubjective}
              onChange={(e) => setSoapSubjective(e.target.value)}
              className="bg-zinc-900/80 border-zinc-800 text-xs leading-relaxed min-h-[150px] resize-y"
            />
          </div>

          {/* O: Objective - FULL WIDTH */}
          <div className="space-y-1.5 rounded-xl border border-teal-900/40 bg-zinc-950/60 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <label className="text-xs font-bold text-teal-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-950 border border-teal-500/40 text-[11px] flex items-center justify-center font-mono">
                  O
                </span>
                Objective *
                <span className="text-[11px] text-zinc-500 font-normal">
                  (Measurable clinical data, active ROM degrees, grip strength score, task repetitions)
                </span>
              </label>
              <button
                type="button"
                onClick={handleAutoFillFromAiObservations}
                className="text-[11px] text-teal-400 hover:text-teal-300 underline underline-offset-2 flex items-center gap-1 self-start sm:self-auto"
              >
                <Sparkles className="w-3 h-3" />
                Append AI Kinematic Detections
              </button>
            </div>
            <Textarea
              rows={6}
              placeholder="Measurable clinical metrics, active ROM degrees, grip strength readings, task trials/repetitions, postural alignment observations, confirmed Spark/SAM kinematic detections..."
              value={soapObjective}
              onChange={(e) => setSoapObjective(e.target.value)}
              className="bg-zinc-900/80 border-zinc-800 text-xs leading-relaxed min-h-[150px] resize-y"
            />
          </div>

          {/* A: Assessment - FULL WIDTH + MULTIPLE ASSESSMENT DOCUMENT LINKS */}
          <div className="space-y-3 rounded-xl border border-amber-900/40 bg-zinc-950/60 p-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-amber-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-950 border border-amber-500/40 text-[11px] flex items-center justify-center font-mono">
                  A
                </span>
                Assessment *
                <span className="text-[11px] text-zinc-500 font-normal">
                  (Clinical analysis, neuromuscular response, functional progression towards goals)
                </span>
              </label>
              <Textarea
                rows={7}
                placeholder="Clinical synthesis, motor control progress, neuromuscular adaptation, functional limitations, tolerance to therapeutic activities..."
                value={soapAssessment}
                onChange={(e) => setSoapAssessment(e.target.value)}
                className="bg-zinc-900/80 border-zinc-800 text-xs leading-relaxed min-h-[170px] resize-y"
              />
            </div>

            {/* Multiple Assessment Document Links Section */}
            <div className="pt-2 border-t border-amber-950/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    Assessment Documents & Standardized Test Reports
                  </label>
                  <p className="text-[11px] text-zinc-500">
                    Attach links to standardized assessment PDFs (e.g. PDMS-2, Fugl-Meyer, Sensory Profile, Goniometry sheets).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddAssessmentLink}
                  className="h-7 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-950/40 hover:text-amber-200 gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Document Link
                </Button>
              </div>

              {soapAssessmentLinks.length === 0 ? (
                <div className="text-[11px] text-zinc-500 italic bg-zinc-900/40 p-2.5 rounded-lg border border-dashed border-zinc-800">
                  No assessment documents linked yet. Click &quot;Add Document Link&quot; to attach test reports or scorecards.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {soapAssessmentLinks.map((link, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded bg-amber-950/80 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          Assessment Link #{idx + 1}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {link.url.trim() && (
                            <a
                              href={link.url.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-teal-300 hover:text-teal-200 transition-colors"
                              title="Open link in new tab"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Test Link</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveAssessmentLink(idx)}
                            className="p-1 rounded hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 transition-colors"
                            title="Remove document link"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                            Test Title
                          </label>
                          <Input
                            placeholder="e.g. PDMS-2 Scorecard PDF or Fugl-Meyer UE"
                            value={link.title}
                            onChange={(e) => handleUpdateAssessmentLink(idx, "title", e.target.value)}
                            className="bg-zinc-950 border-zinc-800 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                            Link (URL)
                          </label>
                          <Input
                            placeholder="https://drive.google.com/... or https://clinic.org/..."
                            value={link.url}
                            onChange={(e) => handleUpdateAssessmentLink(idx, "url", e.target.value)}
                            className="bg-zinc-950 border-zinc-800 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* P: Plan - FULL WIDTH */}
          <div className="space-y-1.5 rounded-xl border border-indigo-900/40 bg-zinc-950/60 p-4">
            <label className="text-xs font-bold text-indigo-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-950 border border-indigo-500/40 text-[11px] flex items-center justify-center font-mono">
                P
              </span>
              Plan *
              <span className="text-[11px] text-zinc-500 font-normal">
                (Home program adjustments, repetition targets, next telehealth visit cadence)
              </span>
            </label>
            <Textarea
              rows={6}
              placeholder="Continuum of care, modifications to home program, frequency and repetitions, precautions, next live appointment date..."
              value={soapPlan}
              onChange={(e) => setSoapPlan(e.target.value)}
              className="bg-zinc-900/80 border-zinc-800 text-xs leading-relaxed min-h-[150px] resize-y"
            />
          </div>

          {/* 3. PLAIN-ENGLISH CLIENT & CAREGIVER SUMMARY */}
          <div className="space-y-2 rounded-xl border border-emerald-900/40 bg-zinc-950/60 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Plain-English Client & Caregiver Takeaways
                <span className="text-[11px] text-zinc-500 font-normal">
                  (Simple summary delivered to client portal)
                </span>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateAiSummary}
                isLoading={isAiSummarizing}
                className="h-7 text-xs border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/40 hover:text-emerald-200 gap-1.5 self-start sm:self-auto"
              >
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Generate Summary with AI
              </Button>
            </div>
            <p className="text-[11px] text-zinc-400">
              Summarizes technical clinical SOAP terms into encouraging, accessible next steps for the client and family.
            </p>
            <Textarea
              rows={4}
              placeholder="Click 'Generate Summary with AI' or type personalized takeaways for the client..."
              value={clientSummary}
              onChange={(e) => setClientSummary(e.target.value)}
              className="bg-zinc-900/80 border-zinc-800 text-xs leading-relaxed min-h-[120px] resize-y"
            />
          </div>
        </div>
      </Card>

      {/* Review Actions Bar */}
      <div className="pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-4">
        <div className="text-[11px] text-zinc-500 max-w-sm">
          {isAlreadyReviewed
            ? "Feedback is published to the client. Editing feedback updates clinical notes and SOAP evaluation in real-time."
            : "Draft reviews remain private to you. \"Publish Feedback\" atomically unlocks published notes and overall feedback for the client."}
        </div>

        <div className="flex flex-row items-center gap-3 whitespace-nowrap">
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
            {isAlreadyReviewed ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-zinc-950" />
                Save Changes to Feedback
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Publish Feedback
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
