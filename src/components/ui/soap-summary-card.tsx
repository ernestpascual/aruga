"use client";

import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Eye, EyeOff, Database, HeartHandshake, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SoapSummaryCardProps {
  targetType: "soap_note" | "submission_review";
  targetId?: string;
  initialSummary?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  clientName?: string | null;
  isDemo?: boolean;
  onSummaryLoaded?: (summary: string) => void;
  className?: string;
}

export function SoapSummaryCard({
  targetType,
  targetId,
  initialSummary,
  subjective,
  objective,
  assessment,
  plan,
  clientName,
  isDemo = false,
  onSummaryLoaded,
  className = "",
}: SoapSummaryCardProps) {
  const [summary, setSummary] = useState<string | null>(initialSummary || null);
  const [isCached, setIsCached] = useState<boolean>(Boolean(initialSummary && initialSummary.trim().length > 0));
  const [revealed, setRevealed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const autoTriedRef = useRef<string | null>(null);

  // Reset + auto-generate when the target changes (e.g. switching feedback dates).
  // If no cached summary exists, generate automatically on view and store in DB via POST.
  useEffect(() => {
    setSummary(initialSummary || null);
    setIsCached(Boolean(initialSummary && initialSummary.trim().length > 0));
    setRevealed(false);
    setLoading(false);
    autoTriedRef.current = null;
  }, [targetId, targetType]);

  useEffect(() => {
    if (summary && summary.trim().length > 0) return;
    if (!targetId) return;
    if (autoTriedRef.current === targetId) return;
    autoTriedRef.current = targetId;
    handleSeeSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, targetType, summary]);

  const handleSeeSummary = async () => {
    // If we already have the summary loaded in state, simply toggle reveal
    if (summary && summary.trim().length > 0) {
      setRevealed(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ai/soap-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          subjective: subjective || "",
          objective: objective || "",
          assessment: assessment || "",
          plan: plan || "",
          clientName: clientName || "",
          forceRegenerate: false,
          isDemo,
        }),
      });

      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
        setIsCached(true);
        setRevealed(true);
        if (onSummaryLoaded) onSummaryLoaded(data.summary);
      }
    } catch (err) {
      console.warn("Could not fetch or generate summary:", err);
    } finally {
      setLoading(false);
    }
  };

  const hasExistingSummary = Boolean(isCached || (summary && summary.trim().length > 0));

  if (!revealed) {
    return (
      <div
        className={`rounded-xl border border-teal-500/30 bg-teal-950/10 p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm ${className}`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold text-zinc-100">
              Summary for You & Your Family (Simple & Easy to Understand)
            </span>
            {hasExistingSummary && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Cached in Database
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            {hasExistingSummary
              ? "Session summary is ready. Click to view with zero AI credits used."
              : "Click to create a plain-English summary of your session from your therapist's clinical SOAP notes."}
          </p>
        </div>

        <Button
          onClick={handleSeeSummary}
          disabled={loading}
          size="sm"
          className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold text-xs gap-1.5 shrink-0 shadow-sm"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Creating Summary...
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              See Summary
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border-2 border-teal-500/40 bg-gradient-to-br from-teal-950/40 via-teal-950/20 to-zinc-950 p-4 sm:p-5 space-y-2.5 shadow-lg shadow-teal-950/30 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-teal-300 flex items-center gap-2 tracking-wide">
          <Sparkles className="w-4 h-4 text-teal-400" />
          Summary for You & Your Family (Simple & Easy to Understand)
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <Database className="w-3 h-3" />
            Cached in Database (Zero AI Credits)
          </span>
          <button
            onClick={() => setRevealed(false)}
            className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors ml-1"
          >
            <EyeOff className="w-3 h-3" />
            Hide
          </button>
        </div>
      </div>

      <p className="text-xs sm:text-sm text-zinc-100 leading-relaxed bg-zinc-950/60 p-3.5 rounded-lg border border-teal-500/20 font-medium">
        {summary}
      </p>

      <p className="text-[11px] text-teal-400/80 italic flex items-center gap-1">
        <HeartHandshake className="w-3.5 h-3.5 shrink-0" />
        Created directly from your therapist's clinical SOAP notes into simple, encouraging takeaways for you and your family.
      </p>
    </div>
  );
}
