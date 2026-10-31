"use client";

import React, { useEffect, useState } from "react";
import { ActivityTemplate } from "@/types/database";
import { ActivityGeneratorModal } from "./ActivityGeneratorModal";
import { Button } from "@/components/ui/button";
import { Palette, X, Sparkles, Loader2, Image as ImageIcon } from "lucide-react";

type StepItem = {
  id: string;
  position: number;
  title: string;
  instructions: string;
  generatedActivityId?: string | null;
  generatedActivity?: { id: string; title: string; base_image_url?: string | null } | null;
};

function mapClientCategoryToAgeBand(cat?: string | null): "pedia" | "adolescent" | "adult" | "geriatric" {
  switch (cat) {
    case "pedia":
      return "pedia";
    case "adolescent":
      return "adolescent";
    case "adult":
      return "adult";
    case "old_people":
    case "geriatric":
      return "geriatric";
    default:
      return "adult";
  }
}

function deriveTheme(step: StepItem): string {
  const raw = `${step.title || ""} ${step.instructions || ""}`.trim();
  if (!raw) return "";
  // keep short theme hint (first 80 chars, remove punctuation heavy)
  return raw.slice(0, 80).replace(/\s+/g, " ").trim();
}

export function StepActivityControl({
  patientId,
  step,
  stepIndex,
  steps,
  setSteps,
  creatorId,
}: {
  patientId: string;
  step: StepItem;
  stepIndex: number;
  steps: StepItem[];
  setSteps: (v: StepItem[]) => void;
  creatorId?: string;
}) {
  const [ageBand, setAgeBand] = useState<"pedia" | "adolescent" | "adult" | "geriatric" | null>(null);
  const [templates, setTemplates] = useState<ActivityTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ActivityTemplate | null>(null);
  const [pickerFilter, setPickerFilter] = useState("");

  // Derive ageBand from patient client_category
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/therapist/clients?id=${patientId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const cat = d.client?.client_category || d.clients?.[0]?.client_category || null;
        setAgeBand(mapClientCategoryToAgeBand(cat));
      })
      .catch(() => {
        if (!cancelled) setAgeBand("adult");
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  function openPicker() {
    setPickerOpen(true);
    if (templates.length === 0 && !templatesLoading) {
      setTemplatesLoading(true);
      fetch("/api/activities/templates")
        .then((r) => r.json())
        .then((d) => setTemplates(d.templates || []))
        .finally(() => setTemplatesLoading(false));
    }
  }

  function handleGenerated(activity: Record<string, unknown>) {
    const copy = [...steps];
    copy[stepIndex] = {
      ...copy[stepIndex],
      generatedActivityId: String(activity.id),
      generatedActivity: {
        id: String(activity.id),
        title: String(activity.title),
        base_image_url: (activity.base_image_url as string | null) || null,
      },
    };
    setSteps(copy);
    setSelectedTemplate(null);
    setPickerOpen(false);
  }

  function handleRemove() {
    const copy = [...steps];
    copy[stepIndex] = { ...copy[stepIndex], generatedActivityId: null, generatedActivity: null };
    setSteps(copy);
  }

  // Filter templates by ageBand + search
  const filtered = React.useMemo(() => {
    let list = templates;
    if (ageBand) {
      // Prefer matching ageBand but keep others visible if few
      const matched = list.filter((t) => t.age_band === ageBand);
      if (matched.length > 0) list = matched;
    }
    if (pickerFilter.trim()) {
      const q = pickerFilter.toLowerCase();
      list = list.filter((t) => `${t.title} ${t.description} ${t.category}`.toLowerCase().includes(q));
    }
    return list;
  }, [templates, ageBand, pickerFilter]);

  // Attached state
  if (step.generatedActivityId) {
    return (
      <div className="mt-2 flex items-center gap-3 p-2.5 rounded-xl bg-teal-950/40 border border-teal-500/30">
        {step.generatedActivity?.base_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={step.generatedActivity.base_image_url}
            alt={step.generatedActivity.title}
            className="w-14 h-14 object-cover rounded-lg border border-zinc-700 bg-white shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-zinc-800 border border-zinc-700 grid place-items-center shrink-0">
            <ImageIcon className="w-5 h-5 text-zinc-500" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-teal-200 truncate">{step.generatedActivity?.title || "Activity"}</p>
          <p className="text-[11px] text-teal-300/70">Attached to Step {step.position} — client will draw/print this with their submission</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={handleRemove} className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 shrink-0">
          Remove
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openPicker}
        className="h-8 gap-1.5 text-xs border-teal-500/40 text-teal-300 hover:bg-teal-950/30"
      >
        <Palette className="w-3.5 h-3.5" />
        Generate activity
      </Button>
      <span className="text-[11px] text-zinc-500">Theme auto-filled from step • {ageBand ? `${ageBand}` : "detecting age band…"}</span>

      {/* Template picker modal for this step */}
      {pickerOpen && !selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-teal-400" /> Generate Activity for Step {step.position}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Pick a template — theme is prefilled from &quot;{deriveTheme(step).slice(0, 60) || step.title || "this step"}&quot;. {ageBand ? `Age band: ${ageBand}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => setPickerOpen(false)} className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
              <input
                value={pickerFilter}
                onChange={(e) => setPickerFilter(e.target.value)}
                placeholder="Search templates (coloring, handwriting, maze…)"
                className="flex-1 h-9 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span className="text-[11px] text-zinc-500 whitespace-nowrap">
                {templatesLoading ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> loading</span> : `${filtered.length} templates`}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {templatesLoading ? (
                <div className="py-12 flex flex-col items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-400" /> Loading Activity Studio templates…
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-xs text-zinc-500 border border-dashed border-zinc-700 rounded-xl">
                  No templates for this filter. Clear search or generate from Activity Studio directly.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filtered.map((t) => (
                    <div key={t.id} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-2 hover:border-zinc-700 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-zinc-100 leading-tight">{t.title}</h4>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">{t.age_band}</span>
                      </div>
                      {t.description && <p className="text-[11px] text-zinc-500 line-clamp-2">{t.description}</p>}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">{t.category}</span>
                        {t.default_params?.theme ? <span className="text-[10px] text-zinc-600">{String(t.default_params.theme)}</span> : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setSelectedTemplate(t)}
                        className="h-8 text-xs gap-1 bg-teal-600 hover:bg-teal-500 text-white font-semibold mt-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Use this template
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-zinc-800 flex items-center justify-between gap-2 bg-zinc-900">
              <span className="text-[11px] text-zinc-500">You can also browse all templates in Activity Studio first.</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPickerOpen(false)} className="h-8 text-xs">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Generator modal prefilled from step */}
      {selectedTemplate && (
        <ActivityGeneratorModal
          template={{
            ...selectedTemplate,
            // Prefill theme from step if template has no theme yet
            default_params: {
              ...selectedTemplate.default_params,
              theme: selectedTemplate.default_params?.theme || deriveTheme(step),
            },
            title: step.title ? `${step.title} — Activity` : selectedTemplate.title,
          } as ActivityTemplate}
          creatorId={creatorId}
          patientId={patientId}
          onClose={() => setSelectedTemplate(null)}
          onGenerated={handleGenerated}
        />
      )}
    </div>
  );
}
