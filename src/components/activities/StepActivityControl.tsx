"use client";

import React, { useEffect, useState } from "react";
import { GenerateActivityAgentModal } from "./GenerateActivityAgentModal";
import { Button } from "@/components/ui/button";
import { Palette, Image as ImageIcon, Sparkles } from "lucide-react";

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
  const [agentOpen, setAgentOpen] = useState(false);

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
    setAgentOpen(false);
  }

  function handleRemove() {
    const copy = [...steps];
    copy[stepIndex] = { ...copy[stepIndex], generatedActivityId: null, generatedActivity: null };
    setSteps(copy);
  }

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
        onClick={() => setAgentOpen(true)}
        className="h-8 gap-1.5 text-xs border-teal-500/40 text-teal-300 hover:bg-teal-950/30"
      >
        <Palette className="w-3.5 h-3.5" />
        Generate activity
        <Sparkles className="w-3 h-3 opacity-60" />
      </Button>
      <span className="text-[11px] text-zinc-500">Agent picks: System • My Prompts • Custom — token-efficient for all flows • {ageBand ? `${ageBand}` : "detecting age band…"}</span>

      {agentOpen && (
        <GenerateActivityAgentModal
          onClose={() => setAgentOpen(false)}
          onGenerated={handleGenerated}
          creatorId={creatorId}
          patientId={patientId}
          defaultAgeBand={ageBand || "adult"}
          defaultTitle={step.title ? `${step.title} — Activity` : deriveTheme(step) || `Step ${step.position} Activity`}
          stepThemeHint={deriveTheme(step)}
        />
      )}
    </div>
  );
}
