"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Palette, Link2 } from "lucide-react";

type StepItemLocal = {
  id: string;
  position: number;
  title: string;
  instructions: string;
  generatedActivityId?: string | null;
  generatedActivity?: { id: string; title: string; base_image_url?: string | null } | null;
};

export function AttachActivityPanel({
  patientId,
  steps,
  setSteps,
}: {
  patientId: string;
  steps: StepItemLocal[];
  setSteps: (v: StepItemLocal[]) => void;
}) {
  const [activities, setActivities] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Therapist library: only activities they created (privacy) — can re-assign to this patient’s Home Program
    // If they attach it, client then sees it via patientId scope.
    const uid = typeof window !== "undefined" ? (()=>{ try{return JSON.parse(localStorage.getItem("aruga_user")||"null")?.id||""}catch{return ""}})() : "";
    const q = uid ? `/api/activities?creatorId=${uid}` : `/api/activities?patientId=${patientId}`;
    fetch(q).then(r=>r.json()).then(d=> setActivities(d.activities || [])).finally(()=> setLoading(false));
  }, [patientId]);

  function attach(activity: Record<string, unknown>, stepIndex: number) {
    const copy = [...steps];
    copy[stepIndex] = {
      ...copy[stepIndex],
      generatedActivityId: String(activity.id),
      generatedActivity: { id: String(activity.id), title: String(activity.title), base_image_url: activity.base_image_url as string | null },
    };
    setSteps(copy);
  }

  function detach(stepIndex: number) {
    const copy = [...steps];
    copy[stepIndex] = { ...copy[stepIndex], generatedActivityId: null, generatedActivity: null };
    setSteps(copy);
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/90 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4 text-teal-400" />
        <h3 className="text-sm font-semibold text-zinc-100">Attach Generated Activity to a Step</h3>
        <Badge variant="outline" statusText={`${activities.length} available`} />
      </div>
      <p className="text-xs text-zinc-400">Choose a worksheet from Activity Studio and attach it to any step. The client will draw on it in-app or print and upload a photo — it is saved with their submission.</p>
      {loading ? <p className="text-xs text-zinc-500">Loading activities...</p> : activities.length === 0 ? (
        <p className="text-xs text-zinc-500">No generated activities yet. <a href="/therapist/activities" className="text-teal-400 hover:underline">Generate one in Activity Studio</a>.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {activities.map((a) => (
              <div key={String(a.id)} className="flex gap-2 p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                {a.base_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={String(a.base_image_url)} alt={String(a.title)} className="w-14 h-14 object-cover rounded border border-zinc-700 bg-white shrink-0" />
                ) : <div className="w-14 h-14 rounded bg-zinc-800 border border-zinc-700 grid place-items-center text-[10px] text-zinc-500">No img</div>}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-200 truncate">{String(a.title)}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{String((a as { age_band?: string }).age_band || "")} • {String((a as { category?: string }).category || "")}</p>
                  <div className="flex gap-1 mt-1">
                    {steps.map((_, idx) => (
                      <Button key={idx} type="button" variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => attach(a, idx)}>
                        → Step {idx + 1}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {steps.map((s, idx) => s.generatedActivityId ? (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-950/40 border border-teal-500/30 text-xs">
                <Link2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span className="text-zinc-200">Step {s.position}: {s.title}</span>
                <span className="text-teal-300 font-semibold truncate">→ {s.generatedActivity?.title}</span>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs ml-auto text-red-400" onClick={() => detach(idx)}>Remove</Button>
              </div>
            ) : null)}
          </div>
        </div>
      )}
    </Card>
  );
}
