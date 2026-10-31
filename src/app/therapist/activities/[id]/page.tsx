// @ts-nocheck
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PdfPrintButton } from "@/components/activities/PdfPrintButton";
import { ArrowLeft } from "lucide-react";

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activity, setActivity] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/activities?id=${id}`).then(r=>r.json()).then(d=> setActivity(d.activity || null)).finally(()=> setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-xs text-zinc-500">Loading activity...</div>;
  if (!activity) return <div className="p-8 text-center text-xs text-zinc-500">Activity not found. Run migrations 05/06.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <Link href="/therapist/activities" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200"><ArrowLeft className="w-3.5 h-3.5"/> Back to Activities</Link>
      <div className="border-b border-zinc-800 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">{String(activity.title)}</h1>
          <p className="text-xs text-zinc-400 mt-1">{String(activity.instructions)}</p>
        </div>
        {activity.base_image_url && (
          <PdfPrintButton imageUrl={String(activity.base_image_url)} title={String(activity.title)} instructions={String(activity.instructions)} ageBand={String((activity as { age_band?: string }).age_band || "")} />
        )}
      </div>
      {activity.base_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={String(activity.base_image_url)} alt={String(activity.title)} className="w-full rounded-xl border border-zinc-700 bg-white shadow-lg" />
      ) : (
        <Card className="border-zinc-800 bg-zinc-900 p-6 text-center text-xs text-zinc-500">No base image — generation may be pending.</Card>
      )}
      <Card className="border-zinc-800 bg-zinc-950 p-4 space-y-2">
        <h3 className="text-xs font-semibold text-zinc-300">Spark spec</h3>
        <pre className="text-[11px] text-zinc-500 font-mono whitespace-pre-wrap break-words bg-zinc-900 border border-zinc-800 rounded-lg p-3">{JSON.stringify(activity.spark_spec, null, 2)}</pre>
      </Card>
      <div className="flex gap-2">
        <Link href="/therapist/clients"><Button variant="outline" size="sm" className="text-xs">Back to Clients</Button></Link>
      </div>
    </div>
  );
}
