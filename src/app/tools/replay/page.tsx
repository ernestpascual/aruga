"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Download, Loader2, PlayCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReplayViewer } from "@/components/demo/ReplayViewer";
import { useAuth } from "@/lib/supabase/auth-context";

type Job = {
  id: string;
  submissionId: string;
  stepSubmissionId: string;
  intent?: string;
  concepts?: string[];
  timingMs?: number | null;
  createdAt?: string;
  updatedAt?: string;
  activityTitle: string;
  stepTitle?: string | null;
  videoUrl: string | null;
  artifactUrl: string | null;
  result: any;
};

export default function ToolsReplayPage() {
  const { user, loading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [merged, setMerged] = useState<Record<string, any>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetch("/api/tools/replay")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (Array.isArray(d.jobs)) {
          setJobs(d.jobs);
          if (d.jobs[0]) setSelectedId(d.jobs[0].id);
        } else if (d.error) setError(d.error);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, authLoading]);

  const selected = useMemo(() => jobs.find((j) => j.id === selectedId) || null, [jobs, selectedId]);
  const selectedResult = selected ? (merged[selected.id] || selected.result) : null;

  // Merge heavy artifact (full 3D + masks) over the slim row, like the review modal
  useEffect(() => {
    if (!selected?.artifactUrl || merged[selected.id]) return;
    let cancelled = false;
    fetch(selected.artifactUrl)
      .then((r) => r.json())
      .then((art: any) => {
        if (cancelled) return;
        setMerged((prev) => ({
          ...prev,
          [selected.id]: {
            ...selected.result,
            sam: { ...(selected.result?.sam || {}), boxes: art?.sam?.boxes ?? selected.result?.sam?.boxes, svgPaths: art?.sam?.svgPaths ?? selected.result?.sam?.svgPaths, tracks: art?.sam?.tracks ?? selected.result?.sam?.tracks },
            mhr: selected.result?.mhr ? { ...selected.result.mhr, frames: art?.frames ?? selected.result.mhr?.frames } : selected.result?.mhr,
          },
        }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selected?.id, selected?.artifactUrl]);

  function payloadForExport() {
    if (!selected) return "";
    return JSON.stringify(
      {
        exportedFrom: "aruga-tools-replay",
        exportedAt: new Date().toISOString(),
        jobId: selected.id,
        submissionId: selected.submissionId,
        stepSubmissionId: selected.stepSubmissionId,
        activityTitle: selected.activityTitle,
        result: selectedResult,
      },
      null,
      2
    );
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(payloadForExport());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  function handleDownload() {
    const blob = new Blob([payloadForExport()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `biomech-replay-${selected?.stepSubmissionId?.slice(0, 8) || "analysis"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authLoading && !user?.id) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-lg mx-auto text-center space-y-4 py-16">
          <PlayCircle className="w-10 h-10 text-zinc-600 mx-auto" />
          <h1 className="text-lg font-bold">Sign in to open Replay</h1>
          <p className="text-xs text-zinc-400">Replay reads your saved biomech analyses from the database, so it lives behind login (Tools menu). For a no-login trial, use the guided demo.</p>
          <div className="flex justify-center gap-2">
            <Link href="/login"><Button className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold">Sign in</Button></Link>
            <Link href="/demo/homeprogram"><Button variant="outline" className="text-xs">Guided demo</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-10">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/therapist/dashboard" className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100"><ArrowLeft className="w-3.5 h-3.5" /> Dashboard</Link>
            <span className="hidden sm:block h-5 w-px bg-zinc-800" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight flex items-center gap-2">Biomech Replay <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-950 border border-teal-500/30 text-teal-300">Tools</span></h1>
              <p className="hidden sm:block text-[11px] text-zinc-500 mt-0.5">Saved analyses from the database — replay without re-running, export payload for the codebase.</p>
            </div>
          </div>
          {selected && (
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={handleCopy} className="h-8 text-xs gap-1.5 border-zinc-700">
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy payload"}
              </Button>
              <Button size="sm" onClick={handleDownload} className="h-8 text-xs gap-1.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold"><Download className="w-3.5 h-3.5" /> Download JSON</Button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        {loading ? (
          <Card className="p-6 flex items-center gap-2 text-xs text-zinc-400"><Loader2 className="w-4 h-4 animate-spin text-teal-400" /> Loading saved analyses from the database…</Card>
        ) : error ? (
          <Card className="p-4 border-red-900/50 bg-red-950/30 text-xs text-red-300">{error}</Card>
        ) : jobs.length === 0 ? (
          <Card className="p-8 border-dashed border-zinc-700 bg-zinc-900/40 text-center space-y-2">
            <PlayCircle className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-semibold text-zinc-300">No saved analyses yet</p>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">Open a submission review, run Analyze with Biomechanic Agent on a video step, review it, then Save to database. It will appear here for replay and export.</p>
            <Link href="/tools/biomech"><Button size="sm" className="mt-2 bg-teal-600 hover:bg-teal-500 text-white text-xs">Open Biomechanic Agent</Button></Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">
            <Card className="p-3 border-zinc-800 bg-zinc-900/70 space-y-1.5 lg:sticky lg:top-20">
              <p className="text-xs font-semibold text-zinc-300 px-1">Saved ({jobs.length})</p>
              {jobs.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setSelectedId(j.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${selectedId === j.id ? "bg-teal-950/60 border-teal-500/40" : "bg-zinc-950/60 border-zinc-800 hover:border-zinc-700"}`}
                >
                  <div className="text-xs font-semibold text-zinc-100 truncate">{j.activityTitle}</div>
                  <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="font-mono">{j.updatedAt ? new Date(j.updatedAt).toLocaleDateString() : ""}</span>
                    <Badge variant="teal" className="text-[10px]">{(j.concepts || []).length} concepts</Badge>
                  </div>
                </button>
              ))}
              <p className="text-[11px] text-zinc-600 px-1 pt-1">Export copies the full payload (slim result + activity) as JSON — save it under <span className="font-mono">public/demo/analysis/</span> to seed the judge demo.</p>
            </Card>
            <div className="min-w-0">
              <ReplayViewer videoUrl={selected?.videoUrl || null} result={selectedResult} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
