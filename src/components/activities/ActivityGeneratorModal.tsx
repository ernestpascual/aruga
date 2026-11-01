"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ActivityTemplate } from "@/types/database";
import { ReferenceInputs } from "./ReferenceInputs";
import { X, Sparkles, Save, Loader2, AlertCircle, Check, ImageIcon } from "lucide-react";

export function ActivityGeneratorModal({
  template,
  onClose,
  onGenerated,
  creatorId,
  patientId,
}: {
  template: ActivityTemplate;
  onClose: () => void;
  onGenerated: (activity: Record<string, unknown>) => void;
  creatorId?: string;
  patientId?: string;
}) {
  const [titleOverride, setTitleOverride] = useState(template.title);
  const [theme, setTheme] = useState((template.default_params?.theme as string) || "");
  const [difficulty, setDifficulty] = useState((template.default_params?.difficulty as string) || "guided");
  const [lineStyle, setLineStyle] = useState((template.default_params?.lineStyle as string) || "none");
  const [customSpark, setCustomSpark] = useState(template.spark_prompt);
  const [customImage, setCustomImage] = useState(template.image_prompt);
  const [referenceLinks, setReferenceLinks] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [generateImage, setGenerateImage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/activities/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleOverride: titleOverride.trim() || template.title,
          ageBand: template.age_band,
          category: template.category,
          theme: theme.trim() || undefined,
          difficulty,
          lineStyle,
          templateId: template.id,
          customSparkPrompt: customSpark,
          customImagePrompt: customImage,
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

  async function handleSaveMyPrompt() {
    setSavingTemplate(true);
    setSaveOk(false);
    setError(null);
    try {
      const res = await fetch("/api/activities/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapistId: creatorId,
          title: titleOverride.trim() ? `${titleOverride.trim()} — My Prompt` : `${template.title} — My Prompt`,
          description: theme ? `Theme: ${theme}` : "My saved prompt",
          ageBand: template.age_band,
          category: template.category,
          sparkPrompt: customSpark,
          imagePrompt: customImage,
          defaultParams: { ...template.default_params, theme, difficulty, lineStyle },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingTemplate(false);
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
            <Sparkles className="w-5 h-5 text-teal-400" /> Generate Activity — {template.title}
          </CardTitle>
          <p className="text-xs text-zinc-400">Tweak prompts, add peg links/photos, then generate with Muse Spark + Muse Image. Saved to database and usable as a program step.</p>
        </CardHeader>
        <CardContent className="overflow-y-auto flex-1 p-5 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-950/60 border border-red-800 p-3 text-xs text-red-200 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" /> <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Worksheet Title (editable)</label>
              <Input value={titleOverride} onChange={(e) => setTitleOverride(e.target.value)} className="text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Theme / Topic</label>
              <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. farm animals, dinosaurs, my town" className="text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="flex h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-100">
                <option value="easy">Easy — guided</option>
                <option value="guided">Guided</option>
                <option value="independent">Independent</option>
                <option value="challenging">Challenging</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Line guide (handwriting)</label>
              <select value={lineStyle} onChange={(e) => setLineStyle(e.target.value)} className="flex h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-100">
                <option value="none">None</option>
                <option value="double-line">HWT Double-line</option>
                <option value="triple-line">Triple-line</option>
                <option value="seyes">Seyes (French)</option>
                <option value="dotted">Dotted trace guides</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Spark prompt (pedagogy + visual brief instructions)</label>
            <Textarea value={customSpark} onChange={(e) => setCustomSpark(e.target.value)} rows={4} className="text-xs font-mono" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Image prompt (Muse Image — line art style)</label>
            <Textarea value={customImage} onChange={(e) => setCustomImage(e.target.value)} rows={4} className="text-xs font-mono" />
          </div>

          <ReferenceInputs links={referenceLinks} onLinksChange={setReferenceLinks} images={referenceImages} onImagesChange={setReferenceImages} />

          <label className="flex items-center gap-2 p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer">
            <input type="checkbox" checked={generateImage} onChange={(e) => setGenerateImage(e.target.checked)} className="accent-teal-500 rounded w-4 h-4" />
            <ImageIcon className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-medium text-zinc-200">Create image with Muse Image</span>
            <span className="text-[11px] text-zinc-500 ml-auto">{generateImage ? "Line-art illustration will be generated" : "Skip image — text-only worksheet"}</span>
          </label>

          <div className="flex items-center gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleSaveMyPrompt} isLoading={savingTemplate} className="gap-1.5 text-xs h-9">
              <Save className="w-3.5 h-3.5" /> Save as My Prompt
            </Button>
            {saveOk && <span className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved to My Prompts</span>}
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={onClose} className="h-9 text-xs">Cancel</Button>
              <Button type="button" onClick={handleGenerate} disabled={loading} className="h-9 gap-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? (generateImage ? "Generating (Spark + Image)..." : "Generating (Spark)...") : "Generate Worksheet"}
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 text-center">{generateImage ? "Generation may take 10–20s for Muse Image. A mock SVG is shown when no API key is configured." : "Text-only mode — Spark spec only, no image generation."} </p>
        </CardContent>
      </Card>
    </div>
  );
}
