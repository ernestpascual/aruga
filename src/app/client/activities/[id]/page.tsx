// @ts-nocheck
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";
import { ActivityCanvas } from "@/components/activities/ActivityCanvas";
import { PdfPrintButton } from "@/components/activities/PdfPrintButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, CheckCircle2, AlertCircle } from "lucide-react";

export default function ClientActivityPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [activity, setActivity] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!id) return;
    // Load activity scoped to this client's assigned programs for privacy
    const loadActivity = async () => {
      try {
        const q = user?.id ? `?id=${id}&clientUserId=${user.id}` : `?id=${id}`;
        const res = await fetch(`/api/activities${q}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Not assigned to your program");
        setActivity(d.activity || null);
      } catch { setActivity(null); }
      finally { setLoading(false); }
    };
    loadActivity();
    if (user?.id) {
      fetch(`/api/therapist/clients?clientUserId=${user.id}`).then(r=>r.json()).then(d=> {
        const p = d.patients?.[0] || d.patient || d.patients;
        if (Array.isArray(d.patients) && d.patients[0]) setPatientId(d.patients[0].id);
        else if (d.patient?.id) setPatientId(d.patient.id);
        else if (p?.id) setPatientId(p.id);
      }).catch(()=>{});
    }
  }, [id, user?.id]);

  async function handleUploadPhoto() {
    if (!photoFile || !patientId || !activity) return;
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", photoFile);
      // try upload to activity-assets via generic endpoint if exists, else just POST completion with filename
      // For now, upload via Supabase directly is server-only — stub: send photo name and use client-side dataURL as placeholder path
      const reader = new FileReader();
      const dataUrl: string = await new Promise((res, rej) => {
        reader.onload = () => res(String(reader.result));
        reader.onerror = rej;
        reader.readAsDataURL(photoFile);
      });
      const res = await fetch("/api/activity-completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generatedActivityId: activity.id,
          patientId,
          clientId: user?.id,
          photoUploadPath: `activity-assets/${activity.id}/${photoFile.name}`,
          completionMethod: "photo",
          // also store dataUrl as drawing_data_url for preview until storage signed URL exists
          drawingDataUrl: dataUrl,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save photo");
      setMsg("Photo submitted and saved to your home program!");
      setTimeout(()=> setMsg(null), 4000);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
  }

  async function handleCanvasSave(dataUrl: string, strokes: unknown[]) {
    if (!patientId || !activity) { setError("Client not linked to a patient record — ask your therapist to re-link."); return; }
    setError(null);
    try {
      const res = await fetch("/api/activity-completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generatedActivityId: activity.id,
          patientId,
          clientId: user?.id,
          drawingDataUrl: dataUrl,
          drawingStrokes: strokes,
          completionMethod: "canvas",
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save drawing");
      setMsg("Drawing saved to your home program!");
      setTimeout(()=> setMsg(null), 4000);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
  }

  if (loading) return <div className="p-8 text-center text-xs text-zinc-500">Loading activity...</div>;
  if (!activity) return <div className="p-8 text-center text-xs text-zinc-500">Activity not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <Link href="/client" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200"><ArrowLeft className="w-3.5 h-3.5"/> Back to Dashboard</Link>

      <div className="border-b border-zinc-800 pb-4 space-y-2">
        <h1 className="text-xl font-bold text-zinc-100">{String(activity.title)}</h1>
        <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-900 border border-zinc-800 rounded-lg p-3">{String(activity.instructions)}</p>
        <div className="flex flex-wrap gap-2">
          {activity.base_image_url && (
            <PdfPrintButton imageUrl={String(activity.base_image_url)} title={String(activity.title)} instructions={String(activity.instructions)} ageBand={String((activity as { age_band?: string }).age_band || "")} />
          )}
          <span className="text-[11px] text-zinc-500 self-center">Print → complete on paper → upload photo below, or draw directly here.</span>
        </div>
      </div>

      {msg && <div className="rounded-lg bg-emerald-950/60 border border-emerald-800 p-3 text-xs text-emerald-200 flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0"/> {msg}</div>}
      {error && <div className="rounded-lg bg-red-950/60 border border-red-800 p-3 text-xs text-red-200 flex gap-2"><AlertCircle className="w-4 h-4 text-red-400 shrink-0"/> {error}</div>}

      {activity.base_image_url && (
        <Card className="border-zinc-800 bg-zinc-900/80 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-100">Interactive worksheet — draw directly on the activity</h2>
          <ActivityCanvas imageUrl={String(activity.base_image_url)} onSave={handleCanvasSave} />
        </Card>
      )}

      <Card className="border-zinc-800 bg-zinc-900/80 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2"><Upload className="w-4 h-4 text-teal-400"/> Or print and upload a photo</h3>
        <p className="text-xs text-zinc-500">After printing and completing on paper, take a clear photo and upload it here. It will be saved to your home program submission for your therapist to review.</p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <Input type="file" accept="image/*" onChange={(e)=> setPhotoFile(e.target.files?.[0] || null)} className="text-xs" />
          <Button type="button" onClick={handleUploadPhoto} disabled={!photoFile} className="bg-teal-600 hover:bg-teal-500 text-white text-xs">Upload photo</Button>
        </div>
        {photoFile && <p className="text-[11px] text-zinc-500">Selected: {photoFile.name} • {(photoFile.size/1024/1024).toFixed(2)} MB</p>}
      </Card>

      {!patientId && <p className="text-[11px] text-amber-400">Note: We could not auto-detect your patient record. Your drawing will still require your therapist to have you linked — otherwise your therapist can link results manually by activity ID.</p>}
    </div>
  );
}
