// @ts-nocheck
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ActivityGallery } from "@/components/activities/ActivityGallery";
import { ActivityGeneratorModal } from "@/components/activities/ActivityGeneratorModal";
import { useAuth } from "@/lib/supabase/auth-context";
import { ActivityTemplate } from "@/types/database";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Palette, Sparkles, BookOpen, Library } from "lucide-react";

export default function TherapistActivitiesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ActivityTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ActivityTemplate | null>(null);
  const [preview, setPreview] = useState<ActivityTemplate | null>(null);
  const [generated, setGenerated] = useState<Record<string, unknown> | null>(null);
  const [recentActivities, setRecentActivities] = useState<Record<string, unknown>[]>([]);
  const [tab, setTab] = useState<"browse" | "mine" | "recent">("browse");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/activities/templates");
      const data = await res.json();
      if (data.templates) setTemplates(data.templates);
      const res2 = await fetch(`/api/activities?creatorId=${user?.id || ""}`);
      const d2 = await res2.json();
      if (d2.activities) setRecentActivities(d2.activities);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user?.id]);

  const systemTemplates = useMemo(() => templates.filter(t => t.owner_scope === "system"), [templates]);
  const myTemplates = useMemo(() => templates.filter(t => t.owner_scope === "therapist" && t.therapist_id === user?.id), [templates, user?.id]);
  const myPromptCount = myTemplates.length;

  if (loading) return <div className="p-8 text-center text-zinc-500 text-xs">Loading activities library...</div>;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col gap-3 border-b border-zinc-800 pb-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-teal-950/40 border border-teal-500/20 grid place-items-center shrink-0"><Palette className="w-4 h-4 text-teal-400" /></span>
            Activity Studio
          </h1>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">Generate printable + interactive worksheets with Muse Spark + Muse Image.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="teal" statusText={`${templates.length} templates`} icon={<Library className="w-3 h-3" />} />
          <Badge variant="amber" statusText={`${recentActivities.length} generated`} />
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none snap-x -mx-3 px-3 sm:mx-0 sm:px-0 pb-1">
        <button type="button" onClick={() => setTab("browse")} className={`snap-start shrink-0 px-4 py-2 sm:py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap ${tab === "browse" ? "bg-teal-600 border-teal-500 text-white" : "bg-zinc-900 border-zinc-700 text-zinc-400"}`}>
          Browse Library
        </button>
        <button type="button" onClick={() => setTab("mine")} className={`snap-start shrink-0 px-4 py-2 sm:py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap ${tab === "mine" ? "bg-teal-600 border-teal-500 text-white" : "bg-zinc-900 border-zinc-700 text-zinc-400"}`}>
          My Prompts ({myPromptCount})
        </button>
        <button type="button" onClick={() => setTab("recent")} className={`snap-start shrink-0 px-4 py-2 sm:py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap ${tab === "recent" ? "bg-teal-600 border-teal-500 text-white" : "bg-zinc-900 border-zinc-700 text-zinc-400"}`}>
          Recent Generated
        </button>
      </div>

      {tab === "browse" && (
        <ActivityGallery templates={systemTemplates} onUse={(t) => setSelected(t)} onPreview={(t) => setPreview(t)} />
      )}

      {tab === "mine" && (
        <>
          {myTemplates.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-zinc-700 rounded-xl space-y-2">
              <BookOpen className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-500">No saved prompts yet. Generate an activity and click &quot;Save as My Prompt&quot;.</p>
            </div>
          ) : (
            <ActivityGallery templates={myTemplates} onUse={(t) => setSelected(t)} onPreview={(t) => setPreview(t)} />
          )}
        </>
      )}

      {tab === "recent" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recentActivities.length === 0 ? (
            <div className="col-span-full py-12 text-center text-xs text-zinc-500 border border-dashed border-zinc-700 rounded-xl">No generated activities yet. Start from Browse Library.</div>
          ) : recentActivities.map((a: Record<string, unknown>) => (
            <Card key={String(a.id)} className="border-zinc-800 bg-zinc-900/80 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-zinc-100">{String(a.title)}</h3>
              <p className="text-xs text-zinc-400 line-clamp-2">{String(a.instructions || "")}</p>
              {a.base_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={String(a.base_image_url)} alt={String(a.title)} className="w-full rounded-lg border border-zinc-700 bg-white" />
              )}
              <p className="text-[11px] text-zinc-500 font-mono">{new Date(String(a.created_at)).toLocaleString()}</p>
              <div className="flex gap-2">
                <Link href={`/therapist/activities/${String(a.id)}`} className="text-xs text-teal-400 hover:underline">Open</Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl border-zinc-800 bg-zinc-900 p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-zinc-100">{preview.title}</h3>
                <p className="text-xs text-zinc-400">{preview.description}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setPreview(null)}>Close</Button>
            </div>
            <div className="space-y-2 text-xs">
              <div><span className="font-semibold text-zinc-300">Spark prompt:</span><p className="text-zinc-400 font-mono bg-zinc-950 border border-zinc-800 rounded-lg p-3 mt-1 whitespace-pre-wrap">{preview.spark_prompt}</p></div>
              <div><span className="font-semibold text-zinc-300">Image prompt:</span><p className="text-zinc-400 font-mono bg-zinc-950 border border-zinc-800 rounded-lg p-3 mt-1 whitespace-pre-wrap">{preview.image_prompt}</p></div>
            </div>
            <Button onClick={() => { setPreview(null); setSelected(preview); }} className="bg-teal-600 hover:bg-teal-500 text-white w-full gap-2">
              <Sparkles className="w-4 h-4" /> Use this template
            </Button>
          </Card>
        </div>
      )}

      {selected && (
        <ActivityGeneratorModal
          template={selected}
          creatorId={user?.id}
          onClose={() => setSelected(null)}
          onGenerated={(activity) => {
            setSelected(null);
            setGenerated(activity);
            load();
          }}
        />
      )}

      {generated && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-3xl border-zinc-800 bg-zinc-900 p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" /> Generated — {String(generated.title)}
              </h3>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setGenerated(null)}>Close</Button>
            </div>
            <p className="text-xs text-zinc-300 bg-zinc-950 border border-zinc-800 rounded-lg p-3">{String(generated.instructions)}</p>
            {generated.base_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={String(generated.base_image_url)} alt="generated" className="w-full rounded-xl border border-zinc-700 bg-white" />
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setGenerated(null)} variant="outline" className="text-xs">Back to library</Button>
              <Link href="/therapist/clients" className="ml-auto">
                <Button className="bg-teal-600 hover:bg-teal-500 text-white text-xs">Attach to Home Program →</Button>
              </Link>
            </div>
            <p className="text-[11px] text-zinc-500 text-center">This activity is saved. Add it as a step when creating or editing a Home Program (see Clients → select patient → Create Program → Attach Activity).</p>
          </Card>
        </div>
      )}
    </div>
  );
}
