"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ReferenceInputs } from "./ReferenceInputs";
import { X, Sparkles, Loader2, AlertCircle, ImageIcon } from "lucide-react";

export function CustomActivityCreatorModal({
  onClose,
  onGenerated,
  creatorId,
  patientId,
  defaultAgeBand,
  defaultTitle,
}: {
  onClose: () => void;
  onGenerated: (activity: Record<string, unknown>) => void;
  creatorId?: string;
  patientId?: string;
  defaultAgeBand?: "pedia" | "adolescent" | "adult" | "geriatric";
  defaultTitle?: string;
}) {
  const [title, setTitle] = useState(defaultTitle || "");
  const [ageBand, setAgeBand] = useState<"pedia" | "adolescent" | "adult" | "geriatric">(defaultAgeBand || "adult");
  const [category, setCategory] = useState("visual_motor");
  const [theme, setTheme] = useState("");
  const [difficulty, setDifficulty] = useState("guided");
  const [lineStyle, setLineStyle] = useState("none");
  const [customSpark, setCustomSpark] = useState("");
  const [customImage, setCustomImage] = useState("");
  const [generateImage, setGenerateImage] = useState(true);
  const [referenceLinks, setReferenceLinks] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    if (!title.trim() && !customSpark.trim()) {
      setError("Provide a title or a Spark prompt so we can generate the worksheet.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/activities/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleOverride: title.trim() || undefined,
          ageBand,
          category,
          theme: theme.trim() || undefined,
          difficulty,
          lineStyle,
          customSparkPrompt: customSpark.trim() || `Create a printable ${ageBand} ${category} worksheet${theme ? ` themed around ${theme}` : ""}. Title: ${title.trim() || "Custom Activity"}.`,
          customImagePrompt: generateImage ? (customImage.trim() || undefined) : undefined,
          generateImage,
          referenceLinks: referenceLinks.length ? referenceLinks : undefined,
          referenceImages: referenceImages.length ? referenceImages : undefined,
          patientId,
          creatorId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      onGenerated(data.activity);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-4xl border-zinc-800 bg-zinc-900 shadow-2xl relative max-h-[92vh] flex flex-col">
        <button type="button" onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
          <X className="w-5 h-5" />
        </button>
        <CardHeader className="pb-3 border-b border-zinc-800">
          <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-400" /> Create Custom Activity — Your Own Prompt
          </CardTitle>
          <p className="text-xs text-zinc-400">No template needed. Write your own Spark brief; optionally skip the illustration with the checklist below. Saves to the same library and attaches to a program step.</p>
        </CardHeader>
        <CardContent className="overflow-y-auto flex-1 p-5 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-950/60 border border-red-800 p-3 text-xs text-red-200 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" /> <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Worksheet Title *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Farm Count &amp; Color" className="text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Theme / Topic</label>
              <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. farm animals, dinosaurs, my town" className="text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Age band</label>
              <select value={ageBand} onChange={(e) => setAgeBand(e.target.value as never)} className="flex h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-100">
                <option value="pedia">Pedia (2–12)</option>
                <option value="adolescent">Adolescent (13–17)</option>
                <option value="adult">Adult (18–64)</option>
                <option value="geriatric">Geriatric (65+)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-100">
                <option value="coloring">Coloring</option>
                <option value="visual_motor">Visual Motor</option>
                <option value="fine_motor">Fine Motor</option>
                <option value="handwriting">Handwriting</option>
                <option value="tracing">Tracing</option>
                <option value="maze">Maze</option>
                <option value="matching">Matching</option>
                <option value="cognitive">Cognitive</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="flex h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-100">
                <option value="easy">Easy — guided</option>
                <option value="guided">Guided</option>
                <option value="independent">Independent</option>
                <option value="challenging">Challenging</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Spark prompt — pedagogy + visual brief (your instructions to Muse Spark)</label>
            <Textarea value={customSpark} onChange={(e) => setCustomSpark(e.target.value)} rows={4} placeholder="Describe the worksheet you want: goals, items to draw, layout, number of prompts, tone..." className="text-xs font-mono" />
            <p className="text-[11px] text-zinc-500">Leave blank to auto-generate from title + theme + age band. Be specific: &quot;6 large apple outlines, bold stroke, trace the word APPLE below each&quot;.</p>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-200">
              <input type="checkbox" checked={generateImage} onChange={(e) => setGenerateImage(e.target.checked)} className="accent-teal-500 rounded w-4 h-4" />
              <ImageIcon className="w-4 h-4 text-teal-400" /> Generate image with Muse Image
            </label>
            <span className="text-[11px] text-zinc-500">{generateImage ? "Full worksheet with line-art illustration (10–20s)" : "Text-only worksheet — Spark spec only, faster, no illustration"}</span>
          </div>

          {generateImage && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Image prompt — Muse Image line-art brief (optional override)</label>
              <Textarea value={customImage} onChange={(e) => setCustomImage(e.target.value)} rows={3} placeholder="Black and white line art, thick outlines, A4 portrait, ..." className="text-xs font-mono" />
              <p className="text-[11px] text-zinc-500">If blank, Spark crafts this from your brief above.</p>
            </div>
          )}

          {!generateImage && (
            <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-xs text-amber-300">Image generation is off — you&apos;ll get a text-only activity (instructions + layout spec, base_image_url will be null). Great for quick tracing/handwriting sheets.</div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Line guide (handwriting)</label>
            <select value={lineStyle} onChange={(e) => setLineStyle(e.target.value)} className="flex h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-100 max-w-xs">
              <option value="none">None</option>
              <option value="double-line">HWT Double-line</option>
              <option value="triple-line">Triple-line</option>
              <option value="seyes">Seyes (French)</option>
              <option value="dotted">Dotted trace guides</option>
            </select>
          </div>

          <ReferenceInputs links={referenceLinks} onLinksChange={setReferenceLinks} images={referenceImages} onImagesChange={setReferenceImages} />

          <div className="flex items-center gap-2 pt-2">
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={onClose} className="h-9 text-xs">Cancel</Button>
              <Button type="button" onClick={handleGenerate} disabled={loading} className="h-9 gap-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? "Generating..." : generateImage ? "Generate Worksheet" : "Generate Text-only Worksheet"}
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 text-center">Custom prompts are sent to Muse Spark 1.3{generateImage ? " + Muse Image" : ""}. Saved and attachable to any Home Program step.</p>
        </CardContent>
      </Card>
    </div>
  );
}
