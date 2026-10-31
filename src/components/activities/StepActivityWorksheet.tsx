"use client";

import React, { useEffect, useState } from "react";
import { Palette, Download, CheckCircle2, AlertCircle, Loader2, Save, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ActivityCanvas } from "./ActivityCanvas";
import { PdfPrintButton } from "./PdfPrintButton";
import type { GeneratedActivity, ProgramStep } from "@/types/database";

type Props = {
  step: ProgramStep;
  activity: GeneratedActivity;
  patientId: string | null;
  clientId: string | null;
  stepSubmissionId: string | null;
  programId: string;
  scheduledDate?: string | null;
  readOnly?: boolean;
  onSaved?: (hasCompletion: boolean) => void;
};

export function StepActivityWorksheet({
  step,
  activity,
  patientId,
  clientId,
  stepSubmissionId,
  programId,
  scheduledDate,
  readOnly,
  onSaved,
}: Props) {
  const [mode, setMode] = useState<"draw" | "print">("draw");
  const [completion, setCompletion] = useState<Record<string, unknown> | null>(null);
  const [loadingCompletion, setLoadingCompletion] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const imageUrl = String(activity.base_image_url || "");
  const hasImage = Boolean(imageUrl);

  // Load existing completion for this step submission
  useEffect(() => {
    if (!stepSubmissionId || !activity.id) return;
    let cancelled = false;
    setLoadingCompletion(true);
    fetch(`/api/activity-completions?stepSubmissionId=${stepSubmissionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const found = d.completions?.[0] as Record<string, unknown> | undefined;
        if (found) setCompletion(found);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoadingCompletion(false));
    return () => { cancelled = true; };
  }, [stepSubmissionId, activity.id]);

  // Also try lookup by generatedActivityId+patient when no stepSubmission yet
  useEffect(() => {
    if (completion || !activity.id || !patientId || stepSubmissionId) return;
    fetch(`/api/activity-completions?generatedActivityId=${activity.id}&patientId=${patientId}`)
      .then((r) => r.json())
      .then((d) => {
        const list = (d.completions || []) as Record<string, unknown>[];
        const match = list.find((c) => !c.step_submission_id || c.step_submission_id === stepSubmissionId);
        if (match && !completion) setCompletion(match);
      })
      .catch(() => {});
  }, [activity.id, patientId, stepSubmissionId, completion]);

  // Notify parent when a saved completion exists (so step counts as done for Next/Submit validation)
  useEffect(() => {
    if (completion && (completion.drawing_data_url || completion.photo_upload_path || (Array.isArray(completion.drawing_strokes) && completion.drawing_strokes.length > 0))) {
      onSaved?.(true);
    }
  }, [completion]);

  const drawingStrokes = (completion?.drawing_strokes as { color: string; width: number; points: { x: number; y: number }[] }[] | undefined) || undefined;
  const hasSavedDrawing = Boolean(completion?.drawing_data_url || (Array.isArray(completion?.drawing_strokes) && (completion.drawing_strokes as unknown[]).length > 0));

  async function handleCanvasSave(dataUrl: string, strokes: unknown[]) {
    if (!patientId) {
      setErr("Patient record not resolved yet — please reload. Your drawing will be saved once linked.");
      return;
    }
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/activity-completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generatedActivityId: activity.id,
          stepSubmissionId: stepSubmissionId || undefined,
          patientId,
          clientId: clientId || undefined,
          drawingDataUrl: dataUrl,
          drawingStrokes: strokes,
          completionMethod: "canvas",
          programId,
          scheduledDate: scheduledDate || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save drawing");
      setCompletion(d.completion);
      setMsg("Drawing saved to your home program. Your therapist can now review it.");
      onSaved?.(true);
      setTimeout(() => setMsg(null), 4000);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload() {
    if (!photoFile || !patientId) {
      setErr(!patientId ? "Patient record not linked — ask your therapist to re-link." : "Choose a photo first.");
      return;
    }
    setErr(null);
    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(photoFile);
      });
      const res = await fetch("/api/activity-completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generatedActivityId: activity.id,
          stepSubmissionId: stepSubmissionId || undefined,
          patientId,
          clientId: clientId || undefined,
          // store preview dataUrl; server also records photo_upload_path for storage reference
          drawingDataUrl: dataUrl,
          drawingStrokes: [],
          photoUploadPath: `activity-assets/${activity.id}/${photoFile.name}`,
          completionMethod: "photo",
          programId,
          scheduledDate: scheduledDate || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save photo");
      setCompletion(d.completion);
      setMsg("Photo uploaded and saved to your home program.");
      onSaved?.(true);
      setTimeout(() => setMsg(null), 4000);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (!hasImage) {
    return (
      <Card className="border-amber-800/40 bg-amber-950/20 p-4 space-y-2">
        <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5"><Palette className="w-3.5 h-3.5"/> Activity worksheet</p>
        <p className="text-xs text-zinc-400">Worksheet image is generating. Please check back shortly — your therapist will be notified when ready.</p>
      </Card>
    );
  }

  return (
    <div className="rounded-xl border border-teal-500/20 bg-teal-950/10 overflow-hidden">
      {/* Header with title + actions */}
      <div className="p-3.5 sm:p-4 space-y-3 border-b border-teal-500/10 bg-zinc-950/40">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center text-white shrink-0"><Palette className="w-3.5 h-3.5"/></span>
              <h3 className="text-sm font-semibold text-zinc-100 truncate">{activity.title || step.title}</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">{activity.instructions || step.instructions}</p>
            {activity.age_band && <span className="inline-flex text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">{activity.age_band}{activity.spark_spec?.difficulty ? ` • ${activity.spark_spec.difficulty}` : ""}{activity.spark_spec?.estimatedMinutes ? ` • ~${activity.spark_spec.estimatedMinutes} min` : ""}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <PdfPrintButton imageUrl={imageUrl} title={activity.title || String(step.title)} instructions={activity.instructions || step.instructions} ageBand={activity.age_band} />
            {Boolean(completion?.drawing_data_url) && (
              <a href={String(completion?.drawing_data_url)} download={`${(activity.title || "worksheet").replace(/[^a-z0-9]/gi,"-")}-colored.png`} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md border border-zinc-700 bg-zinc-900 text-xs font-medium text-zinc-200 hover:bg-zinc-800">
                <Download className="w-3.5 h-3.5"/> My saved drawing
              </a>
            )}
          </div>
        </div>

        {/* Preview thumbnail */}
        <div className="rounded-lg overflow-hidden border border-zinc-800 bg-white max-h-[22rem] flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={activity.title || "Worksheet"} className="w-full h-auto max-h-[22rem] object-contain" />
        </div>
        <p className="text-[11px] text-zinc-500 text-center">Download or print to complete on paper, or color directly below — both count as completion for this step.</p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-2 bg-zinc-900/60 border-b border-zinc-800">
        <button type="button" onClick={()=> setMode("draw")} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 ${mode==="draw" ? "bg-teal-600 border-teal-500 text-white" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
          <Palette className="w-3.5 h-3.5"/> Color on screen
        </button>
        <button type="button" onClick={()=> setMode("print")} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 ${mode==="print" ? "bg-teal-600 border-teal-500 text-white" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
          <ImageIcon className="w-3.5 h-3.5"/> Print & upload photo
        </button>
        {hasSavedDrawing && <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-400 ml-2"><CheckCircle2 className="w-3.5 h-3.5"/> Saved</span>}
      </div>

      {/* Feedback banners */}
      {msg && <div className="mx-3 mt-3 rounded-lg bg-emerald-950/60 border border-emerald-800 p-2.5 text-xs text-emerald-200 flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"/>{msg}</div>}
      {err && <div className="mx-3 mt-3 rounded-lg bg-red-950/60 border border-red-800 p-2.5 text-xs text-red-200 flex gap-2"><AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5"/>{err}</div>}
      {loadingCompletion && <div className="mx-3 mt-3 text-xs text-zinc-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin"/> Loading saved progress...</div>}

      <div className="p-3 sm:p-4">
        {mode === "draw" ? (
          <div className="space-y-3">
            {readOnly ? (
              Boolean(completion?.drawing_data_url) ? (
                <div className="rounded-xl border border-zinc-800 overflow-hidden bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={String(completion?.drawing_data_url)} alt="Completed coloring" className="w-full h-auto" />
                </div>
              ) : (
                <p className="text-xs text-zinc-500 text-center py-6">No drawing saved yet.</p>
              )
            ) : (
              <ActivityCanvas imageUrl={imageUrl} initialStrokes={drawingStrokes as never} onSave={handleCanvasSave} />
            )}
            {saving && <p className="text-xs text-teal-400 flex items-center gap-2 justify-center"><Loader2 className="w-3.5 h-3.5 animate-spin"/> Saving to database...</p>}
            {hasSavedDrawing && !readOnly && Boolean(completion?.drawing_data_url) && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 space-y-2">
                <p className="text-[11px] font-semibold text-zinc-400">Last saved drawing preview:</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={String(completion?.drawing_data_url)} alt="Saved drawing" className="w-full max-w-md mx-auto rounded-lg border border-zinc-800 bg-white" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Card className="border-zinc-800 bg-zinc-900/80 p-4 space-y-3">
              <h4 className="text-xs font-semibold text-zinc-200">Print, complete on paper, then upload a photo</h4>
              <p className="text-[11px] text-zinc-500 leading-relaxed">Print via the button above (or Save image), color/trace/write on paper, then take a clear top-down photo and upload here. Your therapist will see it under this step.</p>
              {!readOnly && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input type="file" accept="image/*" onChange={(e)=> setPhotoFile(e.target.files?.[0] || null)} className="text-xs bg-zinc-950 border-zinc-800" disabled={readOnly} />
                  <Button type="button" onClick={handlePhotoUpload} disabled={!photoFile || uploadingPhoto} className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-9 gap-1.5 shrink-0">
                    {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Save className="w-3.5 h-3.5"/>} {uploadingPhoto ? "Saving..." : "Upload photo"}
                  </Button>
                </div>
              )}
              {photoFile && <p className="text-[11px] text-zinc-500">{photoFile.name} • {(photoFile.size/1024/1024).toFixed(2)} MB</p>}
              {Boolean(completion?.photo_upload_path) && <p className="text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/> Photo saved: {String(completion?.photo_upload_path).split("/").pop()}</p>}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
