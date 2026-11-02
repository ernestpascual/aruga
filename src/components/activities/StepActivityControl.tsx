"use client";

import React, { useEffect, useState } from "react";
import { GenerateActivityAgentModal } from "./GenerateActivityAgentModal";
import { Button } from "@/components/ui/button";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Palette, Image as ImageIcon, Sparkles, Wand2, CheckCircle2, Pencil, RefreshCw, XCircle, Loader2, Clock } from "lucide-react";

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

type AgentDraft = {
  draftId: string;
  status: "pending_approval";
  title: string;
  instructions: string;
  ageBand: string;
  category: string;
  sparkSpec: Record<string, unknown>;
  base_image_url: string | null;
  reasoning: string;
  sources: string[];
  modelIds: { spark: string; image?: string | null };
  latencyMs: number;
};

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
  const [agentDraft, setAgentDraft] = useState<AgentDraft | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [ltg, setLtg] = useState<string[]>([]);
  const [stg, setStg] = useState<string[]>([]);
  const [selectedGoalKind, setSelectedGoalKind] = useState<"ltg" | "stg" | "">("");
  const [selectedGoalIndex, setSelectedGoalIndex] = useState<number>(-1);

  useEffect(() => {
    let cancelled = false;
    const hdr: Record<string, string> = {};
    // pass requester header best-effort so single-patient fetch passes ownsPatientCheck
    if (creatorId) hdr["x-requester-id"] = creatorId;
    fetch(`/api/therapist/clients?id=${patientId}`, { headers: hdr })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const row = d.client || d.clients?.[0] || null;
        const cat = row?.client_category || null;
        setAgeBand(mapClientCategoryToAgeBand(cat));
        const rawLtg = row?.long_term_goals;
        const rawStg = row?.short_term_goals;
        if (Array.isArray(rawLtg)) setLtg(rawLtg.filter((x: unknown) => typeof x === "string" && (x as string).trim()).map((x: string) => x.trim().slice(0, 500)));
        if (Array.isArray(rawStg)) setStg(rawStg.filter((x: unknown) => typeof x === "string" && (x as string).trim()).map((x: string) => x.trim().slice(0, 500)));
      })
      .catch(() => {
        if (!cancelled) setAgeBand("adult");
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, creatorId]);

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

  function selectedGoalText(): string | null {
    if (!selectedGoalKind || selectedGoalIndex < 0) return null;
    if (selectedGoalKind === "ltg") return ltg[selectedGoalIndex] || null;
    if (selectedGoalKind === "stg") return stg[selectedGoalIndex] || null;
    return null;
  }

  async function runAgent(feedback?: string) {
    if (!step.title.trim() && !step.instructions.trim()) return;
    if (!patientId) return;
    // Resolve creatorId: prop > browser session fallback (covers authContext loading window where cookie exists but user?.id is still null)
    let effectiveCreatorId = creatorId || null;
    if (!effectiveCreatorId) {
      try {
        const supabase = createSupabaseBrowserClient();
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          effectiveCreatorId = data.session?.user?.id || null;
          if (!effectiveCreatorId) {
            const { data: u } = await supabase.auth.getUser();
            effectiveCreatorId = u.user?.id || null;
          }
        }
      } catch {}
    }
    if (!effectiveCreatorId) {
      setAgentError("Signing in — please wait a moment and retry (requesterId required).");
      return;
    }
    const goalText = selectedGoalText();
    const goalKind = goalText ? selectedGoalKind : null;
    setAgentLoading(true);
    setAgentError(null);
    try {
      const res = await fetch("/api/agent/activity/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-requester-id": effectiveCreatorId,
        },
        body: JSON.stringify({
          patientId,
          creatorId: effectiveCreatorId,
          step: { title: step.title, instructions: step.instructions, position: step.position },
          action: feedback ? "regenerate" : "auto_draft",
          feedback,
          generateImage: true,
          targetGoalKind: goalKind,
          targetGoalText: goalText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent failed");
      setAgentDraft(data as AgentDraft);
    } catch (e: unknown) {
      setAgentError(e instanceof Error ? e.message : String(e));
    } finally {
      setAgentLoading(false);
    }
  }



  function handleApproveDraft() {
    if (!agentDraft) return;
    const copy = [...steps];
    copy[stepIndex] = {
      ...copy[stepIndex],
      generatedActivityId: agentDraft.draftId,
      generatedActivity: { id: agentDraft.draftId, title: agentDraft.title, base_image_url: agentDraft.base_image_url },
    };
    setSteps(copy);
    setAgentDraft(null);
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
    <div className="mt-2 space-y-2">
      {/* Pending approval draft card */}
      {agentDraft && (
        <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">Agent draft — pending approval</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">{agentDraft.ageBand} • {agentDraft.category}</span>
              </div>
              <p className="text-xs font-semibold text-zinc-100 mt-1 truncate">{agentDraft.title}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{agentDraft.instructions}</p>
              {agentDraft.reasoning && <p className="text-[11px] text-violet-300 mt-1">💡 {agentDraft.reasoning}</p>}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {agentDraft.sources.map((s) => (
                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">{s}</span>
                ))}
              </div>
            </div>
            {agentDraft.base_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agentDraft.base_image_url} alt={agentDraft.title} className="w-16 h-16 object-cover rounded-lg border border-zinc-700 bg-white shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-zinc-900 border border-zinc-800 grid place-items-center shrink-0">
                <ImageIcon className="w-5 h-5 text-zinc-600" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="button" size="sm" onClick={handleApproveDraft} className="h-7 gap-1.5 text-xs bg-teal-600 hover:bg-teal-500 text-white font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Attach
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAgentOpen(true)} className="h-7 gap-1.5 text-xs border-zinc-700 bg-zinc-900 text-zinc-200">
              <Pencil className="w-3 h-3" /> Edit
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => runAgent("make larger targets / clearer")} className="h-7 gap-1 text-xs border-zinc-700 bg-zinc-800 text-zinc-300">
              <RefreshCw className="w-3 h-3" /> Regenerate
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAgentDraft(null)} className="h-7 gap-1 text-xs text-zinc-500 hover:text-red-400">
              <XCircle className="w-3 h-3" /> Reject
            </Button>
            <span className="text-[11px] text-zinc-500 ml-auto hidden sm:inline">{agentDraft.latencyMs}ms • {agentDraft.modelIds.spark}</span>
          </div>
        </div>
      )}

      {agentLoading && (
        <div className="flex items-center gap-2 text-xs text-zinc-400 p-2 rounded-lg bg-zinc-950 border border-zinc-800">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" /> Agent drafting worksheet for this step… <Clock className="w-3 h-3 text-zinc-600" /> {ageBand || "adult"}
        </div>
      )}
      {agentError && (
        <div className="text-[11px] text-amber-300 bg-amber-950/20 border border-amber-800/30 rounded-lg p-2 flex items-center gap-2">
          <XCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {agentError}
          <Button type="button" variant="ghost" size="sm" onClick={() => runAgent()} className="h-6 text-xs ml-auto text-zinc-300">Retry</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(ltg.length > 0 || stg.length > 0) && (
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            Target goal
            <select
              value={selectedGoalKind ? `${selectedGoalKind}:${selectedGoalIndex}` : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  setSelectedGoalKind("");
                  setSelectedGoalIndex(-1);
                  return;
                }
                const [k, idx] = v.split(":");
                setSelectedGoalKind(k as "ltg" | "stg");
                setSelectedGoalIndex(parseInt(idx, 10));
              }}
              className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200 max-w-[22rem] truncate"
              title="Optional — targets this LTG/STG in the draft prompt"
            >
              <option value="">None (general)</option>
              {ltg.length > 0 && (
                <optgroup label={`Long-term goals (${ltg.length}/5)`}>
                  {ltg.map((g, i) => (
                    <option key={`ltg-${i}`} value={`ltg:${i}`}>
                      LTG {i + 1}: {g.slice(0, 60)}{g.length > 60 ? "…" : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {stg.length > 0 && (
                <optgroup label={`Short-term goals (${stg.length}/10)`}>
                  {stg.map((g, i) => (
                    <option key={`stg-${i}`} value={`stg:${i}`}>
                      STG {i + 1}: {g.slice(0, 60)}{g.length > 60 ? "…" : ""}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <span className="text-[10px] text-zinc-500 hidden sm:inline">optional</span>
          </label>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => runAgent()}
          disabled={agentLoading}
          className="h-8 gap-1.5 text-xs border-teal-500/40 text-teal-300 hover:bg-teal-950/30"
          title="Draft with Activity Agent (patient-aware) — per step, on-demand"
        >
          <Wand2 className="w-3.5 h-3.5" />
          {agentLoading ? "Drafting…" : "Draft with Agent"}
          <Sparkles className="w-3 h-3 opacity-60" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAgentOpen(true)}
          className="h-8 gap-1.5 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <Palette className="w-3.5 h-3.5" />
          Browse templates
        </Button>
        <span className="text-[11px] text-zinc-500 hidden sm:inline">Per-step on-demand — saves tokens. Approval required before attach.</span>
      </div>

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
