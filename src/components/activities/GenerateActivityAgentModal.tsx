"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ActivityTemplate } from "@/types/database";
import { ReferenceInputs } from "./ReferenceInputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { X, Sparkles, Save, Loader2, AlertCircle, Check, ImageIcon, Palette, PenLine, Search, ArrowLeft, Layers, User, Wand2 } from "lucide-react";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

type Tab = "system" | "my" | "custom";

export function GenerateActivityAgentModal({
  onClose,
  onGenerated,
  creatorId,
  patientId,
  defaultAgeBand,
  defaultTitle,
  stepThemeHint,
}: {
  onClose: () => void;
  onGenerated: (activity: Record<string, unknown>) => void;
  creatorId?: string;
  patientId?: string;
  defaultAgeBand?: "pedia" | "adolescent" | "adult" | "geriatric";
  defaultTitle?: string;
  stepThemeHint?: string;
}) {
  const [tab, setTab] = useState<Tab>("system");
  const [templates, setTemplates] = useState<ActivityTemplate[]>([]);
  const [myTemplates, setMyTemplates] = useState<ActivityTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [ageFilter, setAgeFilter] = useState<string>(defaultAgeBand || "all");

  // Detail view when a template is selected (system or my)
  const [selected, setSelected] = useState<ActivityTemplate | null>(null);
  const [titleOverride, setTitleOverride] = useState("");
  const [theme, setTheme] = useState(stepThemeHint || "");
  const [difficulty, setDifficulty] = useState("guided");
  const [lineStyle, setLineStyle] = useState("none");
  const [customSpark, setCustomSpark] = useState("");
  const [customImage, setCustomImage] = useState("");
  const [referenceLinks, setReferenceLinks] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [generateImage, setGenerateImage] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Custom tab form
  const [cTitle, setCTitle] = useState(defaultTitle || "");
  const [cAgeBand, setCAgeBand] = useState<"pedia" | "adolescent" | "adult" | "geriatric">(defaultAgeBand || "adult");
  const [cCategory, setCCategory] = useState("visual_motor");
  const [cTheme, setCTheme] = useState(stepThemeHint || "");
  const [cDifficulty, setCDifficulty] = useState("guided");
  const [cLineStyle, setCLineStyle] = useState("none");
  const [cSpark, setCSpark] = useState("");
  const [cImage, setCImage] = useState("");
  const [cGenerateImage, setCGenerateImage] = useState(true);
  const [cRefLinks, setCRefLinks] = useState<string[]>([]);
  const [cRefImages, setCRefImages] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sysRes, myRes] = await Promise.all([
          fetch("/api/activities/templates?scope=system").then((r) => r.json()).catch(() => ({ templates: [] })),
          creatorId ? fetch(`/api/activities/templates?scope=therapist&therapistId=${creatorId}`).then((r) => r.json()).catch(() => ({ templates: [] })) : Promise.resolve({ templates: [] }),
        ]);
        if (cancelled) return;
        setTemplates(sysRes.templates || []);
        setMyTemplates(myRes.templates || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [creatorId]);

  function openTemplateDetail(t: ActivityTemplate) {
    setSelected(t);
    setTitleOverride(defaultTitle || t.title);
    setTheme(stepThemeHint || (t.default_params?.theme as string) || "");
    setDifficulty((t.default_params?.difficulty as string) || "guided");
    setLineStyle((t.default_params?.lineStyle as string) || "none");
    setCustomSpark(t.spark_prompt || "");
    setCustomImage(t.image_prompt || "");
    setReferenceLinks([]);
    setReferenceImages([]);
    setGenerateImage(true);
    setError(null);
    setSaveOk(false);
  }

  const filteredSystem = useMemo(() => {
    let list = templates;
    if (ageFilter !== "all") list = list.filter((t) => t.age_band === ageFilter);
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter((t) => `${t.title} ${t.description} ${t.category} ${t.age_band}`.toLowerCase().includes(q));
    }
    return list;
  }, [templates, filter, ageFilter]);

  const filteredMy = useMemo(() => {
    let list = myTemplates;
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter((t) => `${t.title} ${t.description} ${t.category}`.toLowerCase().includes(q));
    }
    if (ageFilter !== "all") list = list.filter((t) => t.age_band === ageFilter);
    return list;
  }, [myTemplates, filter, ageFilter]);

  async function resolveEffectiveCreatorId(): Promise<string | null> {
    if (creatorId) return creatorId;
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return null;
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) return data.session.user.id;
      const { data: u } = await supabase.auth.getUser();
      return u.user?.id || null;
    } catch { return null; }
  }

  async function uploadReferenceImagesToStorage(imgs: string[], effectiveCreatorId: string | null): Promise<{ paths?: string[]; images?: string[] }> {
    if (!imgs.length) return {};
    // Try direct browser → Supabase Storage to bypass Vercel 4.5 MB
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase && effectiveCreatorId) {
        const uploaded: string[] = [];
        for (let i = 0; i < imgs.length; i++) {
          const dataUrl = imgs[i]!;
          if (!dataUrl.startsWith("data:image/")) continue;
          const m = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i);
          if (!m) continue;
          const mime = m[1]!;
          const b64 = m[2]!;
          const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "jpg";
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const path = `references/${effectiveCreatorId}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
          const { error } = await supabase.storage.from("activity-assets").upload(path, bytes, { contentType: mime, upsert: false });
          if (!error) uploaded.push(path);
        }
        if (uploaded.length) return { paths: uploaded };
      }
    } catch {}
    // Fallback: send data URLs directly (small images only; Vercel will 413 if too large)
    return { images: imgs };
  }

  async function handleGenerateFromTemplate() {
    if (!selected) return;
    setGenLoading(true);
    setError(null);
    try {
      const effectiveCreatorId = await resolveEffectiveCreatorId();
      if (patientId && !effectiveCreatorId) throw new Error("Not authenticated — please wait for sign-in to finish and retry (requesterId required).");
      const refPayload = await uploadReferenceImagesToStorage(referenceImages, effectiveCreatorId);
      const res = await fetch("/api/activities/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(effectiveCreatorId ? { "x-requester-id": effectiveCreatorId } : {}) },
        body: JSON.stringify({
          titleOverride: titleOverride.trim() || selected.title,
          ageBand: selected.age_band,
          category: selected.category,
          theme: theme.trim() || undefined,
          difficulty,
          lineStyle,
          templateId: selected.id,
          customSparkPrompt: customSpark,
          customImagePrompt: customImage,
          generateImage,
          referenceLinks: referenceLinks.length ? referenceLinks : undefined,
          referenceImages: refPayload.images,
          referenceImagePaths: refPayload.paths,
          patientId,
          creatorId: effectiveCreatorId || creatorId,
        }),
      });
      const ct = res.headers.get("content-type") || "";
      let data: any;
      if (ct.includes("application/json")) data = await res.json();
      else { const txt = await res.text(); if (!res.ok) throw new Error(txt.slice(0, 500) || `Generation failed (${res.status})`); try { data = JSON.parse(txt); } catch { throw new Error(txt.slice(0, 500)); } }
      if (!res.ok) throw new Error(data.error || data.message || "Generation failed");
      onGenerated(data.activity);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenLoading(false);
    }
  }

  async function handleSaveMyPrompt() {
    if (!selected) return;
    setSavingTemplate(true);
    setSaveOk(false);
    setError(null);
    try {
      const res = await fetch("/api/activities/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapistId: creatorId,
          title: titleOverride.trim() ? `${titleOverride.trim()} — My Prompt` : `${selected.title} — My Prompt`,
          description: theme ? `Theme: ${theme}` : "My saved prompt",
          ageBand: selected.age_band,
          category: selected.category,
          sparkPrompt: customSpark,
          imagePrompt: customImage,
          defaultParams: { ...selected.default_params, theme, difficulty, lineStyle },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaveOk(true);
      // refresh my templates list
      if (data.template) setMyTemplates((prev) => [...prev, data.template as ActivityTemplate]);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleGenerateCustom() {
    if (!cTitle.trim() && !cSpark.trim()) {
      setError("Provide a title or a Spark prompt.");
      return;
    }
    setGenLoading(true);
    setError(null);
    try {
      const effectiveCreatorId = await resolveEffectiveCreatorId();
      if (patientId && !effectiveCreatorId) throw new Error("Not authenticated — please wait for sign-in to finish and retry (requesterId required).");
      const cRefPayload = await uploadReferenceImagesToStorage(cRefImages, effectiveCreatorId);
      const res = await fetch("/api/activities/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(effectiveCreatorId ? { "x-requester-id": effectiveCreatorId } : {}) },
        body: JSON.stringify({
          titleOverride: cTitle.trim() || undefined,
          ageBand: cAgeBand,
          category: cCategory,
          theme: cTheme.trim() || undefined,
          difficulty: cDifficulty,
          lineStyle: cLineStyle,
          customSparkPrompt: cSpark.trim() || `Create a printable ${cAgeBand} ${cCategory} worksheet${cTheme ? ` themed around ${cTheme}` : ""}. Title: ${cTitle.trim() || "Custom Activity"}.`,
          customImagePrompt: cGenerateImage ? (cImage.trim() || undefined) : undefined,
          generateImage: cGenerateImage,
          referenceLinks: cRefLinks.length ? cRefLinks : undefined,
          referenceImages: cRefPayload.images,
          referenceImagePaths: cRefPayload.paths,
          patientId,
          creatorId: effectiveCreatorId || creatorId,
        }),
      });
      const ct2 = res.headers.get("content-type") || "";
      let data: any;
      if (ct2.includes("application/json")) data = await res.json();
      else { const txt = await res.text(); if (!res.ok) throw new Error(txt.slice(0, 500) || `Generation failed (${res.status})`); try { data = JSON.parse(txt); } catch { throw new Error(txt.slice(0, 500)); } }
      if (!res.ok) throw new Error(data.error || data.message || "Generation failed");
      onGenerated(data.activity);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenLoading(false);
    }
  }

  // Detail view inside same modal (template selected)
  if (selected) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <Card className="w-full max-w-4xl border-zinc-800 bg-zinc-900 shadow-2xl relative max-h-[92vh] flex flex-col">
          <button type="button" onClick={() => setSelected(null)} className="absolute top-3 left-3 p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center gap-1 text-xs">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button type="button" onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
          <CardHeader className="pb-3 border-b border-zinc-800 pt-10">
            <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-teal-400" /> Generate — {selected.title}
            </CardTitle>
            <p className="text-xs text-zinc-400">Tweaked prompts are token-efficient (≤420ch Spark / ≤320ch image). {selected.age_band} • {selected.category} • {defaultTitle ? `for "${defaultTitle}"` : ""}</p>
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
                <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. farm animals, dinosaurs" className="text-xs" maxLength={100} />
                <span className="text-[10px] text-zinc-500">{theme.length}/100</span>
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
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300">Spark prompt (pedagogy + visual brief)</label>
                <span className="text-[10px] text-zinc-500">{customSpark.length}/500</span>
              </div>
              <Textarea value={customSpark} onChange={(e) => setCustomSpark(e.target.value.slice(0, 800))} rows={3} className="text-xs font-mono" placeholder="Short, token-efficient brief..." />
              <p className="text-[11px] text-zinc-500">Auto-truncated to 420 chars server-side for token budget. Keep instructions ≤350ch, visualBrief 70–90 words.</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300">Image prompt (Muse Image — line art)</label>
                <span className="text-[10px] text-zinc-500">{customImage.length}/320</span>
              </div>
              <Textarea value={customImage} onChange={(e) => setCustomImage(e.target.value.slice(0, 600))} rows={2} className="text-xs font-mono" />
            </div>
            <ReferenceInputs links={referenceLinks} onLinksChange={setReferenceLinks} images={referenceImages} onImagesChange={setReferenceImages} />
            <label className="flex items-center gap-2 p-3 rounded-xl border border-zinc-800 bg-zinc-950 cursor-pointer">
              <input type="checkbox" checked={generateImage} onChange={(e) => setGenerateImage(e.target.checked)} className="accent-teal-500 rounded w-4 h-4" />
              <ImageIcon className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-medium text-zinc-200">Generate image with Muse Image</span>
              <span className="text-[11px] text-zinc-500 ml-auto hidden sm:inline">{generateImage ? "Line-art will be generated (10–20s)" : "Text-only — faster, no illustration"}</span>
            </label>
            <div className="flex items-center gap-2 pt-2 flex-wrap">
              <Button type="button" variant="outline" onClick={handleSaveMyPrompt} isLoading={savingTemplate} className="gap-1.5 text-xs h-9">
                <Save className="w-3.5 h-3.5" /> Save as My Prompt
              </Button>
              {saveOk && <span className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>}
              <div className="ml-auto flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => setSelected(null)} className="h-9 text-xs">Back</Button>
                <Button type="button" onClick={handleGenerateFromTemplate} disabled={genLoading} className="h-9 gap-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold">
                  {genLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {genLoading ? (generateImage ? "Generating…" : "Generating text…") : "Generate Worksheet"}
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 text-center">Efficient prompts keep you safely under Muse Spark token limit for both template and custom flows.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-teal-600 grid place-items-center shrink-0"><Sparkles className="w-4 h-4 text-white" /></span>
                Generate Activity Agent
                <span className="hidden sm:inline text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-950 border border-teal-800 text-teal-300">Muse Spark 1.3 + Muse Image</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1.5">Pick from System presets, your saved prompts, or create a fully custom brief. One entry point, all flows. {defaultTitle ? `For: "${defaultTitle.slice(0, 60)}"` : ""}</p>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Tabs */}
          <div className="mt-4 flex gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800 w-fit">
            <button type="button" onClick={() => setTab("system")} className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${tab === "system" ? "bg-teal-600 text-white shadow" : "text-zinc-400 hover:text-zinc-100"}`}>
              <Layers className="w-3.5 h-3.5" /> System <span className="hidden sm:inline">Templates</span> <span className="text-[10px] opacity-70">({templates.length})</span>
            </button>
            <button type="button" onClick={() => setTab("my")} className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${tab === "my" ? "bg-teal-600 text-white shadow" : "text-zinc-400 hover:text-zinc-100"}`}>
              <User className="w-3.5 h-3.5" /> My <span className="hidden sm:inline">Templates</span> <span className="text-[10px] opacity-70">({myTemplates.length})</span>
            </button>
            <button type="button" onClick={() => setTab("custom")} className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${tab === "custom" ? "bg-teal-600 text-white shadow" : "text-zinc-400 hover:text-zinc-100"}`}>
              <PenLine className="w-3.5 h-3.5" /> Custom
            </button>
          </div>
          {/* Filters (system/my tabs) */}
          {tab !== "custom" && (
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search coloring, handwriting, maze, farm…" className="w-full h-9 pl-9 pr-3 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <select value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)} className="h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 sm:w-44">
                <option value="all">All ages</option>
                <option value="pedia">Pedia (2–12)</option>
                <option value="adolescent">Adolescent (13–17)</option>
                <option value="adult">Adult (18–64)</option>
                <option value="geriatric">Geriatric (65+)</option>
              </select>
              <span className="hidden sm:flex items-center text-[11px] text-zinc-500 whitespace-nowrap">{loading ? "loading…" : tab === "system" ? `${filteredSystem.length} templates` : `${filteredMy.length} prompts`}</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-zinc-950/40">
          {error && (
            <div className="mb-4 rounded-lg bg-red-950/60 border border-red-800 p-3 text-xs text-red-200 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" /> <span>{error}</span>
            </div>
          )}

          {tab === "system" && (
            <>
              {loading ? (
                <div className="py-12 flex flex-col items-center gap-2 text-xs text-zinc-500"><Loader2 className="w-6 h-6 animate-spin text-teal-400" /> Loading Activity Studio…</div>
              ) : filteredSystem.length === 0 ? (
                <div className="py-10 text-center text-xs text-zinc-500 border border-dashed border-zinc-700 rounded-xl">No templates for this filter. Try another age band or search, or create a Custom prompt.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredSystem.map((t) => (
                    <div key={t.id} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col gap-2 hover:border-zinc-700 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-zinc-100 leading-tight">{t.title}</h4>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">{t.age_band}</span>
                      </div>
                      {t.description && <p className="text-[11px] text-zinc-500 line-clamp-2">{t.description}</p>}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-500">{t.category}</span>
                      </div>
                      <Button type="button" size="sm" onClick={() => openTemplateDetail(t)} className="h-8 text-xs gap-1 bg-teal-600 hover:bg-teal-500 text-white font-semibold mt-1">
                        <Palette className="w-3.5 h-3.5" /> Use this template
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "my" && (
            <>
              {loading ? (
                <div className="py-12 flex flex-col items-center gap-2 text-xs text-zinc-500"><Loader2 className="w-6 h-6 animate-spin text-teal-400" /> Loading your prompts…</div>
              ) : filteredMy.length === 0 ? (
                <div className="py-8 text-center space-y-3 border border-dashed border-zinc-700 rounded-xl p-6 bg-zinc-900/60">
                  <p className="text-xs text-zinc-400">You haven&apos;t saved any custom prompts yet.</p>
                  <p className="text-[11px] text-zinc-500">Use a System template and &quot;Save as My Prompt&quot;, or create one from scratch in Custom.</p>
                  <Button type="button" size="sm" onClick={() => setTab("custom")} className="h-8 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700">Go to Custom →</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredMy.map((t) => (
                    <div key={t.id} className="p-3 rounded-xl bg-zinc-900 border border-teal-900/40 flex flex-col gap-2">
                      <h4 className="text-xs font-semibold text-zinc-100">{t.title}</h4>
                      {t.description && <p className="text-[11px] text-zinc-500 line-clamp-2">{t.description}</p>}
                      <div className="flex items-center gap-1.5"><span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-500">{t.category}</span><span className="text-[10px] text-zinc-600">{t.age_band}</span></div>
                      <Button type="button" size="sm" onClick={() => openTemplateDetail(t)} className="h-8 text-xs gap-1 bg-teal-600 hover:bg-teal-500 text-white font-semibold mt-1"><Sparkles className="w-3.5 h-3.5" /> Use this prompt</Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "custom" && (
            <div className="space-y-5">
              <div className="p-3 rounded-xl bg-teal-950/20 border border-teal-800/30 flex items-start gap-2">
                <PenLine className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-teal-200">Create from scratch — your own prompt</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">No template needed. Write a concise Spark brief (auto-capped for token budget). Choose image on/off. This also powers &quot;Breathing + Meds&quot; style custom activities reliably.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Worksheet Title *</label>
                  <Input value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="e.g. Farm Count & Color" className="text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Theme / Topic</label>
                  <Input value={cTheme} onChange={(e) => setCTheme(e.target.value)} placeholder="e.g. farm animals, dinosaurs" className="text-xs" maxLength={100} />
                  <span className="text-[10px] text-zinc-500">{cTheme.length}/100</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Age band</label>
                  <select value={cAgeBand} onChange={(e) => setCAgeBand(e.target.value as never)} className="flex h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-100">
                    <option value="pedia">Pedia (2–12)</option>
                    <option value="adolescent">Adolescent (13–17)</option>
                    <option value="adult">Adult (18–64)</option>
                    <option value="geriatric">Geriatric (65+)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Category</label>
                  <select value={cCategory} onChange={(e) => setCCategory(e.target.value)} className="flex h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-100">
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
                  <select value={cDifficulty} onChange={(e) => setCDifficulty(e.target.value)} className="flex h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-100">
                    <option value="easy">Easy — guided</option>
                    <option value="guided">Guided</option>
                    <option value="independent">Independent</option>
                    <option value="challenging">Challenging</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300">Spark prompt — pedagogy + visual brief (your brief to Muse Spark)</label>
                  <span className="text-[10px] text-zinc-500">{cSpark.length}/800</span>
                </div>
                <Textarea value={cSpark} onChange={(e) => setCSpark(e.target.value.slice(0, 800))} rows={4} placeholder="Describe the worksheet: goals, items to draw, layout, tone. e.g. '6 large apple outlines, bold stroke, trace APPLE below each'" className="text-xs font-mono" />
                <p className="text-[11px] text-zinc-500">Leave blank to auto-generate from title + theme + age band. Budget: server trims to 420ch, concise wording avoids finish_reason=length truncation.</p>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl border border-zinc-800 bg-zinc-900">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-200">
                  <input type="checkbox" checked={cGenerateImage} onChange={(e) => setCGenerateImage(e.target.checked)} className="accent-teal-500 rounded w-4 h-4" />
                  <ImageIcon className="w-4 h-4 text-teal-400" /> Generate image with Muse Image
                </label>
                <span className="text-[11px] text-zinc-500 hidden sm:inline">{cGenerateImage ? "Full worksheet with line-art (10–20s)" : "Text-only — faster, no illustration"}</span>
              </div>

              {cGenerateImage && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300">Image prompt — Muse Image override (optional)</label>
                    <span className="text-[10px] text-zinc-500">{cImage.length}/600</span>
                  </div>
                  <Textarea value={cImage} onChange={(e) => setCImage(e.target.value.slice(0, 600))} rows={2} placeholder="Black and white line art, thick outlines, A4 portrait, ..." className="text-xs font-mono" />
                  <p className="text-[11px] text-zinc-500">If blank, Spark crafts this. Capped to 320ch server-side for budget.</p>
                </div>
              )}

              {!cGenerateImage && (
                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-xs text-amber-300">Image is off — you&apos;ll get a text-only activity (instructions + layout spec, base_image_url null). Great for quick sheets.</div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Line guide (handwriting)</label>
                <select value={cLineStyle} onChange={(e) => setCLineStyle(e.target.value)} className="flex h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-100 max-w-xs">
                  <option value="none">None</option>
                  <option value="double-line">HWT Double-line</option>
                  <option value="triple-line">Triple-line</option>
                  <option value="seyes">Seyes (French)</option>
                  <option value="dotted">Dotted trace guides</option>
                </select>
              </div>

              <ReferenceInputs links={cRefLinks} onLinksChange={setCRefLinks} images={cRefImages} onImagesChange={setCRefImages} />

              <div className="flex items-center gap-2 pt-2">
                <div className="ml-auto flex items-center gap-2">
                  <Button type="button" variant="ghost" onClick={onClose} className="h-9 text-xs">Cancel</Button>
                  <Button type="button" onClick={handleGenerateCustom} disabled={genLoading} className="h-9 gap-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold">
                    {genLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {genLoading ? "Generating..." : cGenerateImage ? "Generate Worksheet" : "Generate Text-only"}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 text-center">Custom prompts go to Muse Spark 1.3{cGenerateImage ? " + Muse Image" : ""}. Efficient templates + concise custom both stay under token budget.</p>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-zinc-800 bg-zinc-900 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs ml-auto">Close</Button>
        </div>
      </div>
    </div>
  );
}
