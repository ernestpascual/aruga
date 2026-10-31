"use client";

import React, { useMemo, useState } from "react";
import { ActivityTemplate } from "@/types/database";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Sparkles, BookmarkPlus, Search } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  coloring: "Coloring",
  handwriting: "Handwriting",
  tracing: "Tracing",
  maze: "Maze",
  matching: "Matching",
  cognitive: "Cognitive",
  adl_sim: "ADL",
  visual_motor: "Visual Motor",
  other: "Other",
};

const AGE_TABS = [
  { key: "all", label: "All" },
  { key: "pedia", label: "Pedia (2–12)" },
  { key: "adolescent", label: "Adolescent (13–17)" },
  { key: "adult", label: "Adult (18–64)" },
  { key: "geriatric", label: "Geriatric (65+)" },
] as const;

export function ActivityGallery({
  templates,
  onUse,
  onPreview,
}: {
  templates: ActivityTemplate[];
  onUse: (t: ActivityTemplate) => void;
  onPreview: (t: ActivityTemplate) => void;
}) {
  const [ageBand, setAgeBand] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (ageBand !== "all" && t.age_band !== ageBand) return false;
      if (catFilter !== "all" && t.category !== catFilter) return false;
      if (q.trim() && !`${t.title} ${t.description} ${t.category}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [templates, ageBand, catFilter, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {AGE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setAgeBand(tab.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${ageBand === tab.key ? "bg-teal-600 border-teal-500 text-white" : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {["all", "coloring", "handwriting", "tracing", "maze", "matching", "cognitive", "adl_sim", "visual_motor"].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCatFilter(c)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${catFilter === c ? "bg-zinc-800 border-zinc-600 text-zinc-100" : "bg-zinc-950 border-zinc-800 text-zinc-500"}`}
            >
              {c === "all" ? "All types" : CATEGORY_LABELS[c] || c}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates..." className="h-8 pl-8 w-56 text-xs" />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-xs text-zinc-500 border border-dashed border-zinc-700 rounded-xl">No templates match. Try another filter or create a custom prompt.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <Card key={t.id} className="border-zinc-800 bg-zinc-900/80 p-4 flex flex-col gap-3 hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-100 leading-tight">{t.title}</h3>
                {t.is_featured && <Badge variant="teal" statusText="Featured" />}
              </div>
              {t.description && <p className="text-xs text-zinc-400 line-clamp-2">{t.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" statusText={CATEGORY_LABELS[t.category] || t.category} />
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">{t.age_band}</span>
                {t.default_params?.lineStyle && t.default_params.lineStyle !== "none" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-950/60 text-teal-400 border border-teal-500/30">{String(t.default_params.lineStyle)}</span>
                )}
                {t.default_params?.estimatedMinutes && (
                  <span className="text-[11px] text-zinc-500">{String(t.default_params.estimatedMinutes)} min</span>
                )}
              </div>
              <div className="flex items-center gap-2 pt-2 mt-auto">
                <Button type="button" variant="ghost" size="sm" onClick={() => onPreview(t)} className="h-8 text-xs gap-1">
                  <Eye className="w-3.5 h-3.5" /> Preview
                </Button>
                <Button type="button" size="sm" onClick={() => onUse(t)} className="h-8 text-xs gap-1 bg-teal-600 hover:bg-teal-500 text-white font-semibold ml-auto">
                  <Sparkles className="w-3.5 h-3.5" /> Use template
                </Button>
              </div>
              {t.owner_scope === "therapist" && <span className="text-[10px] text-amber-400/80 flex items-center gap-1"><BookmarkPlus className="w-3 h-3" /> My saved prompt</span>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
