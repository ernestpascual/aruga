// @ts-nocheck
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Palette } from "lucide-react";
import { useAuth } from "@/lib/supabase/auth-context";

export default function ClientActivitiesGalleryPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/activities?clientUserId=${user.id}`).then(r=>r.json()).then(d=> setActivities(d.activities || [])).finally(()=> setLoading(false));
  }, [user?.id]);

  if (loading) return <div className="p-8 text-center text-xs text-zinc-500">Loading activities...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="border-b border-zinc-800 pb-4">
        <h1 className="text-xl font-bold text-zinc-100 flex flex-wrap items-center gap-2"><Palette className="w-5 h-5 text-teal-400"/> My Activities</h1>
        <p className="text-xs text-zinc-400 mt-1">Worksheets your therapist created for you. Draw directly on them or print and upload a photo.</p>
      </div>
      {activities.length === 0 ? (
        <Card className="border-zinc-800 bg-zinc-900 p-8 text-center space-y-2">
          <p className="text-sm text-zinc-400">No activities yet.</p>
          <p className="text-xs text-zinc-500">Your therapist will attach generated worksheets to your Home Program. Check Home Program for assigned steps.</p>
          <Link href="/client"><Button size="sm" className="mt-2 bg-teal-600 hover:bg-teal-500 text-white text-xs">Go to Home Program</Button></Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activities.map((a) => (
            <Card key={String(a.id)} className="border-zinc-800 bg-zinc-900/90 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-100">{String(a.title)}</h3>
              <p className="text-xs text-zinc-400 line-clamp-2">{String(a.instructions)}</p>
              {a.base_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={String(a.base_image_url)} alt={String(a.title)} className="w-full rounded-lg border border-zinc-700 bg-white" />
              )}
              <div className="flex flex-wrap gap-2">
                <Link href={`/client/activities/${String(a.id)}`}><Button size="sm" className="bg-teal-600 hover:bg-teal-500 text-white text-xs">Open & Draw</Button></Link>
                <Badge variant="outline" statusText={String((a as { age_band?: string }).age_band || "")} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
