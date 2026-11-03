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
import { BiomechAnalysisModal } from "@/components/therapist/BiomechAnalysisModal";
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
  const [siblingSubs, setSiblingSubs] = useState<Array<{ id: string; state?: string; scheduled_date?: string | null; submitted_at?: string | null; review?: unknown }>>([]);
  // Biomechanic Agent modal — prefilled from step (assigned instructions + client comment + age band)
  const [biomechModal, setBiomechModal] = useState<{ step: ProgramStep; stepSub: StepSubmission; videoUrl: string; storagePath?: string | null } | null>(null);
  const [clientAgeBand, setClientAgeBand] = useState<string>("adult");
  // Saved biomechanic analyses per step — reference viewable after generation (cached in DB)
  const [savedBiomech, setSavedBiomech] = useState<Record<string, { updated_at?: string }>>({});
  const [savedBiomechLoading, setSavedBiomechLoading] = useState(false);

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

          {
            const rawRev = (data.submission as { review?: unknown }).review;
            const revObj = (Array.isArray(rawRev) ? rawRev[0] : rawRev) as { overall_feedback?: string; session_recording_url?: string; subjective?: string; objective?: string; assessment?: string; assessment_links?: unknown; plan?: string; client_summary?: string; step_reviews?: unknown } | undefined;
            if (revObj) {
            if (revObj.overall_feedback) {
              setOverallFeedback(revObj.overall_feedback);
            }
            if (revObj.session_recording_url) {
              setSoapRecordingUrl(revObj.session_recording_url);
            }
            if (revObj.subjective) setSoapSubjective(revObj.subjective);
            if (revObj.objective) setSoapObjective(revObj.objective);
            if (revObj.assessment) setSoapAssessment(revObj.assessment);
            if (Array.isArray(revObj.assessment_links)) {
              setSoapAssessmentLinks(revObj.assessment_links as SoapNoteAssessmentLink[]);
            }
            if (revObj.plan) setSoapPlan(revObj.plan);
            if (revObj.client_summary) {
              setClientSummary(revObj.client_summary);
            }

            if (Array.isArray(revObj.step_reviews)) {
              const notesMap: Record<string, string> = {};
              (revObj.step_reviews as Array<{ step_submission_id: string; therapist_note?: string }>).forEach((sr: { step_submission_id: string; therapist_note?: string }) => {
                notesMap[sr.step_submission_id] = sr.therapist_note || "";
              });
              setStepNotes(notesMap);
            }
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

  // Load sibling submissions for same program — all scheduled_date entries, not just this one
  useEffect(() => {
    const progId = (submission as unknown as { program_id?: string })?.program_id;
    if (!progId) return;
    let cancelled = false;
    const qReq = user?.id ? `&requesterId=${user.id}` : "";
    fetch(`/api/client/submissions?programId=${progId}${qReq}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (Array.isArray(d.submissions)) setSiblingSubs(d.submissions as Array<{ id: string; state?: string; scheduled_date?: string | null; submitted_at?: string | null; review?: unknown }>);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [(submission as unknown as { program_id?: string })?.program_id, user?.id]);

  // Auto-fill client age range for Biomechanic Agent modal (pedia/adolescent/adult/geriatric)
  useEffect(() => {
    const pid = (submission as unknown as { patient_id?: string })?.patient_id;
    if (!pid || !user?.id) return;
    let cancelled = false;
    fetch(`/api/therapist/clients?id=${pid}&requesterId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const age = (d.client as { age?: number } | undefined)?.age;
        if (typeof age === "number") {
          setClientAgeBand(age <= 11 ? "pedia" : age <= 17 ? "adolescent" : age >= 55 ? "geriatric" : "adult");
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [(submission as unknown as { patient_id?: string })?.patient_id, user?.id]);

  // Load saved biomechanic analyses for reference — after generation + save, viewable here instantly.
  // Re-runs when the popup closes so a fresh save flips Analyze → View without a page reload.
  const refreshSavedBiomech = React.useCallback(async () => {
    const videoSteps = stepSubmissions.filter((ss) => {
      const mm = (ss.media_meta as unknown as { mime?: string; mediaKind?: string } | undefined);
      const kind = mm?.mediaKind;
      const mime = mm?.mime || "";
      const vp = ss.video_path || "";
      const isPhoto = kind === "photo" || mime.startsWith("image/") || /\.(jpg|jpeg|png|webp|heic)$/i.test(vp);
      return !isPhoto && Boolean(vp);
    });
    if (videoSteps.length === 0) return;
    setSavedBiomechLoading(true);
    try {
      const rows = await Promise.all(
        videoSteps.map(async (ss) => {
          try {
            const r = await fetch(`/api/agent/biomech/save?stepSubmissionId=${ss.id}`);
            const d = await r.json();
            return { id: ss.id, saved: (d.saved as { updated_at?: string } | null) || null };
          } catch { return { id: ss.id, saved: null }; }
        })
      );
      const map: Record<string, { updated_at?: string }> = {};
      rows.forEach(({ id, saved }) => { if (saved) map[id] = { updated_at: saved.updated_at }; });
      setSavedBiomech(map);
    } finally {
      setSavedBiomechLoading(false);
    }
  }, [stepSubmissions]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await refreshSavedBiomech();
    })();
    return () => { cancelled = true; };
  }, [refreshSavedBiomech]);

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

  // Normalize review (Supabase join returns array) for status checks
  const reviewObj = Array.isArray((submission as unknown as { review?: unknown })?.review)
    ? (((submission as unknown as { review?: unknown }).review as unknown[])?.[0] as { status?: string; overall_feedback?: string } | undefined)
    : ((submission as unknown as { review?: { status?: string; overall_feedback?: string } })?.review as { status?: string; overall_feedback?: string } | undefined);
  // Determine if feedback is already published/reviewed
  const isAlreadyReviewed =
    submission?.state === "reviewed" ||
    reviewObj?.status === "published" ||
    Boolean(reviewObj?.overall_feedback);

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
        {(submission as unknown as { scheduled_date?: string | null })?.scheduled_date && (
          <p className="text-xs text-zinc-400 font-mono">Session date: {(submission as unknown as { scheduled_date?: string }).scheduled_date}</p>
        )}
      </div>

      {/* Sibling sessions — all dates for this program, not just this submission */}
      {siblingSubs.length > 1 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-teal-400" />
            All sessions for this program ({siblingSubs.length} dates)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {siblingSubs
              .slice()
              .sort((a, b) => String(a.scheduled_date || "").localeCompare(String(b.scheduled_date || "")))
              .map((s) => {
                const rawR = (s as { review?: unknown }).review;
                const r = Array.isArray(rawR) ? (rawR[0] as { status?: string; overall_feedback?: string } | undefined) : (rawR as { status?: string; overall_feedback?: string } | undefined);
                const reviewed = s.state === "reviewed" || r?.status === "published" || Boolean(r?.overall_feedback);
                const isCurrent = s.id === submissionId;
                return (
                  <Link key={s.id} href={`/therapist/submissions/${s.id}`}>
                    <Button
                      size="sm"
                      variant={isCurrent ? "default" : "outline"}
                      className={`h-7 text-xs font-mono px-2.5 ${isCurrent ? "bg-teal-600 hover:bg-teal-500 text-white font-bold" : reviewed ? "border-emerald-800 text-emerald-300 hover:bg-emerald-950/40" : s.state === "submitted" ? "border-amber-800 text-amber-300 hover:bg-amber-950/30" : "text-zinc-400"}`}
                      title={reviewed ? "Reviewed — open" : s.state === "submitted" ? "Submitted — review" : "Draft"}
                    >
                      {s.scheduled_date || s.id.slice(0, 8)}{reviewed ? " ✓" : s.state === "submitted" ? " •" : ""}
                    </Button>
                  </Link>
                );
              })}
          </div>
        </div>
      )}

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
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">{comp ? "Completed" : "Not yet completed"}</span>
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
                          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Client work</p>
                          {comp?.drawing_data_url ? (
                            <div className="rounded-lg overflow-hidden border border-zinc-800 bg-white">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={String(comp.drawing_data_url)} alt="Client worksheet submission" className="w-full h-auto object-contain" />
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

                  {/* Biomechanic Agent — full agent popup (assigned instructions + client comment + age band) */}
                  {(() => {
                    const mimeB = (stepSub.media_meta as unknown as { mime?: string; mediaKind?: string })?.mime || "";
                    const kindB = (stepSub.media_meta as unknown as { mediaKind?: string })?.mediaKind;
                    const isPhotoB = kindB === "photo" || mimeB.startsWith("image/") || /\.(jpg|jpeg|png|webp|heic)$/i.test(videoSource || "");
                    if (isPhotoB || !videoSource) return null;
                    const openModal = () => { if (!step) return; const mm = (stepSub.media_meta as unknown as { storagePath?: string; storage_path?: string } | undefined); const vp0 = stepSub.video_path || ""; const sp = mm?.storagePath || mm?.storage_path || null; const cleanSp = sp || (/^(submissions|playground)\//.test(vp0) ? vp0 : null); setBiomechModal({ step, stepSub, videoUrl: videoSource, storagePath: cleanSp }); };
                    const hasSaved = !!savedBiomech[stepSub.id];
                    return (
                      <div className="space-y-2">
                        {hasSaved ? (
                          <Button
                            type="button"
                            onClick={openModal}
                            className="w-full h-9 gap-2 bg-emerald-950/60 border border-emerald-800/50 text-emerald-200 hover:bg-emerald-950/40 text-xs font-semibold"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            View saved insights{savedBiomech[stepSub.id]?.updated_at ? ` • ${new Date(savedBiomech[stepSub.id].updated_at as string).toLocaleDateString()}` : ""}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            onClick={openModal}
                            className="w-full h-10 gap-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold"
                          >
                            <Activity className="w-4 h-4" />
                            Analyze with Biomechanic Agent
                          </Button>
                        )}
                      </div>
                    );
                  })()}


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
              Structured clinical SOAP documentation (Subjective, Objective, Assessment, Plan) with standardized test links.
            </p>
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
            <label className="text-xs font-bold text-teal-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-teal-950 border border-teal-500/40 text-[11px] flex items-center justify-center font-mono">
                O
              </span>
              Objective *
              <span className="text-[11px] text-zinc-500 font-normal">
                (Measurable clinical data, active ROM degrees, grip strength score, task repetitions)
              </span>
            </label>
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

            {/* Analyzed Biomechanics — viewable after generation + save (cached, no re-run) */}
            <div className="pt-2 border-t border-teal-950/60 space-y-2.5">
              <div>
                <label className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-teal-400" />
                  Analyzed Biomechanics
                </label>
                <p className="text-[11px] text-zinc-500">
                  Run Analyze with Biomechanic Agent on a step video above. After you review and save, the analysis is cached — reopen it here instantly without re-running.
                </p>
              </div>
              {savedBiomechLoading ? (
                <p className="text-[11px] text-zinc-500">Checking saved analyses…</p>
              ) : stepSubmissions.filter((ss) => {
                const mm = (ss.media_meta as unknown as { mime?: string; mediaKind?: string } | undefined);
                return mm?.mediaKind !== "photo" && !(mm?.mime || "").startsWith("image/") && Boolean(ss.video_path);
              }).length === 0 ? (
                <div className="text-[11px] text-zinc-500 italic bg-zinc-900/40 p-2.5 rounded-lg border border-dashed border-zinc-800">
                  No videos to analyze yet — analyses will be listed here once a step video is submitted.
                </div>
              ) : (
                <div className="space-y-2">
                  {stepSubmissions.filter((ss) => {
                    const mm = (ss.media_meta as unknown as { mime?: string; mediaKind?: string } | undefined);
                    return mm?.mediaKind !== "photo" && !(mm?.mime || "").startsWith("image/") && Boolean(ss.video_path);
                  }).map((ss) => {
                    const st = steps.find((s) => s.id === ss.program_step_id);
                    const saved = savedBiomech[ss.id];
                    return (
                      <div key={ss.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-200 truncate">{st?.title || `Step ${st?.position || ""}`}</p>
                          <p className="text-[11px] text-zinc-500">{saved ? `Analyzed${saved.updated_at ? ` • saved ${new Date(saved.updated_at).toLocaleString()}` : ""}` : "Not yet analyzed"}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!st) return;
                            const rawVp = ss.video_path || "";
                            const vp = rawVp.startsWith("http") || rawVp.startsWith("/") || rawVp.startsWith("blob:") ? rawVp : `/${rawVp}`;
                            setBiomechModal({ step: st, stepSub: ss, videoUrl: vp, storagePath: (() => { const mm2 = (ss.media_meta as unknown as { storagePath?: string; storage_path?: string } | undefined); const raw2 = ss.video_path || ""; return mm2?.storagePath || mm2?.storage_path || (/^(submissions|playground)\//.test(raw2) ? raw2 : null); })() });
                          }}
                          className="h-7 text-xs gap-1.5 border-teal-500/40 text-teal-300 hover:bg-teal-950/60 shrink-0"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          {saved ? "View" : "Analyze"}
                        </Button>
                      </div>
                    );
                  })}
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

      {/* Biomechanic Agent modal — prefilled from step, looks like /tools/biomech.
          Refreshes the saved list on close so a fresh save flips Analyze → View. */}
      <BiomechAnalysisModal
        open={biomechModal !== null}
        onClose={() => { setBiomechModal(null); refreshSavedBiomech(); }}
        submissionId={submissionId}
        stepSubmissionId={biomechModal?.stepSub?.id || ""}
        stepTitle={biomechModal?.step?.title || ""}
        stepInstructions={biomechModal?.step?.instructions || ""}
        clientComment={biomechModal?.stepSub?.client_comment || ""}
        clientSkipped={biomechModal?.stepSub?.skipped || false}
        skipReason={biomechModal?.stepSub?.skip_reason || null}
        ageBand={clientAgeBand}
        videoUrl={biomechModal?.videoUrl || null}
        videoStoragePath={biomechModal?.storagePath || null}
        scheduledDate={(submission as unknown as { scheduled_date?: string | null })?.scheduled_date || null}
        onInsertObjective={(txt) => setSoapObjective((prev) => (prev ? `${prev}\n\n${txt}` : txt))}
      />
    </div>
  );
}
