"use client";

import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, Database, Quote, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OverallFeedbackCardProps {
  targetType: "submission_review";
  targetId?: string;
  overallFeedback: string | null; // verbatim from therapist
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  stepReviews?: Array<{ stepTitle?: string; therapistNote?: string }>;
  biomechSummary?: string | null; // concise biomechanic insights if any
  clientName?: string | null;
  initialSummary?: string | null; // cached client_summary from DB
  onSummaryLoaded?: (s: string) => void;
  className?: string;
}

export function OverallFeedbackCard({
  targetId,
  overallFeedback,
  subjective,
  objective,
  assessment,
  plan,
  stepReviews,
  biomechSummary,
  clientName,
  initialSummary,
  onSummaryLoaded,
  className = "",
}: OverallFeedbackCardProps) {
  const [summary, setSummary] = useState<string | null>(initialSummary || null);
  const [isCached, setIsCached] = useState<boolean>(Boolean(initialSummary && initialSummary.trim().length > 0));
  const [revealed, setRevealed] = useState<boolean>(Boolean(initialSummary && initialSummary.trim().length > 0));
  const [loading, setLoading] = useState(false);
  const autoTriedRef = useRef<string | null>(null);

  useEffect(() => {
    setSummary(initialSummary || null);
    setIsCached(Boolean(initialSummary && initialSummary.trim().length > 0));
    setRevealed(Boolean(initialSummary && initialSummary.trim().length > 0));
    setLoading(false);
    autoTriedRef.current = null;
  }, [targetId, initialSummary]);

  // Auto-generate once on first view if no cached summary
  useEffect(() => {
    if (summary && summary.trim().length > 0) return;
    if (!targetId) return;
    if (autoTriedRef.current === targetId) return;
    // Need at least overallFeedback or SOAP to generate
    if (!overallFeedback && !subjective && !objective && !assessment && !plan) return;
    autoTriedRef.current = targetId;
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, overallFeedback, subjective, objective, assessment, plan, biomechSummary]);

  const handleGenerate = async () => {
    if (summary && summary.trim().length > 0) {
      setRevealed(true);
      return;
    }
    setLoading(true);
    try {
      const stepText = (stepReviews || [])
        .filter((s) => s.therapistNote?.trim())
        .map((s) => `${s.stepTitle || "Step"}: ${s.therapistNote}`)
        .join("\n")
        .slice(0, 2000);

      const res = await fetch("/api/ai/soap-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "submission_review",
          targetId,
          subjective: subjective || "",
          objective: objective || "",
          assessment: assessment || "",
          plan: plan || "",
          overallFeedback: overallFeedback || "",
          stepReviewsText: stepText,
          biomechSummary: biomechSummary || "",
          clientName: clientName || "",
          forceRegenerate: false,
          mode: "overall_feedback", // signals new prompt
        }),
      });
      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
        setIsCached(true);
        setRevealed(true);
        onSummaryLoaded?.(data.summary);
      }
    } catch (e) {
      console.warn("Overall feedback generation failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const hasSummary = Boolean(summary && summary.trim().length > 0);

  // Verbatim quote: always show therapist's own words
  const verbatim = overallFeedback?.trim() ? overallFeedback.trim() : null;

  if (!hasSummary && !revealed) {
    return (
      <div className={`rounded-xl border border-teal-500/30 bg-teal-950/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${className}`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold text-zinc-100">Overall Clinician Session Feedback</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            We’ll turn your therapist’s notes, step feedback and video analysis into a clear, encouraging summary — quoting your therapist verbatim. Generated once, saved for you.
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={loading} size="sm" className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold text-xs gap-1.5 shrink-0">
          {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</> : <><Sparkles className="w-3.5 h-3.5" /> Show my feedback</>}
        </Button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border-2 border-teal-500/40 bg-gradient-to-br from-teal-950/40 via-zinc-900 to-zinc-950 p-4 sm:p-5 space-y-3 shadow-lg shadow-teal-950/20 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-teal-300 flex items-center gap-2 tracking-wide">
          <Sparkles className="w-4 h-4 text-teal-400" />
          Overall Clinician Session Feedback
        </span>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />}
        </div>
      </div>

      {/* Easy-to-understand AI synthesis */}
      <div className="rounded-xl bg-zinc-950/70 border border-teal-500/20 p-3.5">
        <p className="text-xs sm:text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap">{summary}</p>
      </div>

      {/* Verbatim therapist quote — always visible */}
      {verbatim && (
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <Quote className="w-3 h-3 text-teal-400" /> Your therapist wrote (verbatim)
          </div>
          <p className="text-xs text-zinc-200 leading-relaxed italic border-l-2 border-teal-500/40 pl-3">
            “{verbatim}”
          </p>
        </div>
      )}

      <p className="text-[11px] text-zinc-500 flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 text-teal-400/70 shrink-0 mt-0.5" />
        <span>This summary was AI-generated from your SOAP notes, step-by-step guidance, verbatim therapist message and video movement analysis if available. Please consult your clinician if you have questions.</span>
      </p>
    </div>
  );
}
