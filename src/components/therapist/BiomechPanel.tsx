"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, ShieldCheck } from "lucide-react";

type Props = {
  mhr: {
    submissionId: string;
    stepSubmissionId: string;
    modelId: string;
    processingMs: number;
    concepts: string[];
    frames: Array<{ frameIndex: number; timestampSeconds: number; angles: any; confidence: { pose:number; angleErrorDeg:number }; flags: string[] }>;
    summary: { peakAngles: Record<string, number>; rom: Record<string, number>; confidenceOverall: number; risk?: string; gait?: any };
    flags: string[];
  } | null;
  onInsertObjective?: (text: string) => void;
};

export function BiomechPanel({ mhr, onInsertObjective }: Props) {
  if (!mhr) return null;
  return (
    <Card className="border-teal-500/20 bg-zinc-950/60 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-teal-300 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Movement check — done</h4>
        <Badge variant="teal" statusText={`${mhr.concepts.join(", ")}`} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-2.5"><p className="text-[11px] text-zinc-500">Shoulder</p><p className="text-sm font-bold text-zinc-100">{mhr.summary.peakAngles?.shoulderFlex_max ?? "—"}°</p></div>
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-2.5"><p className="text-[11px] text-zinc-500">Neck</p><p className="text-sm font-bold text-zinc-100">{mhr.summary.peakAngles?.neckFlex_max ?? "—"}°</p></div>
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-2.5"><p className="text-[11px] text-zinc-500">Quality</p><p className="text-sm font-bold text-zinc-100">{(mhr.summary.confidenceOverall*100).toFixed(0)}%</p></div>
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-2.5"><p className="text-[11px] text-zinc-500">Risk</p><p className="text-sm font-bold text-zinc-100 flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-teal-400" />{mhr.summary.risk === "moderate_fall" ? "Watch" : mhr.summary.risk || "Low"}</p></div>
      </div>
      {mhr.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />{mhr.flags.map(f=> {
          const nice = f.replace(/_/g," ").replace("mild","— small").replace("forward head","leaning forward");
          return <span key={f} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-950/40 border border-amber-500/30 text-amber-200">{nice}</span>;
        })}</div>
      )}
      <p className="text-[11px] text-zinc-500">{mhr.frames.length} frames checked • Trust: {(mhr.summary.confidenceOverall*100).toFixed(0)}%</p>
      {onInsertObjective && (
        <Button size="sm" variant="outline" className="h-7 text-xs border-zinc-700" onClick={()=> onInsertObjective(`Movement check: shoulder ${mhr.summary.peakAngles?.shoulderFlex_max ?? "—"}°, neck ${mhr.summary.peakAngles?.neckFlex_max ?? "—"}° — ${mhr.flags.length ? mhr.flags.join(", ").replace(/_/g," ") : "looked steady"}`)}>Add to notes</Button>
      )}
      <p className="text-[10px] text-zinc-500 italic">Draft for your therapist to confirm.</p>
    </Card>
  );
}
