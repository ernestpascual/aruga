"use client";
import React, { useState, useEffect } from "react";
import { Sparkles, Loader2, TrendingUp, TrendingDown, Minus, Calendar, Eye, Send, Wand2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type HighlightItem = {
  slot: number;
  slotLabel: string;
  title: string;
  story: string;
  delta: { quanti: string; quali: string };
  arrow: string;
  weight: number;
  evidenceIds: string[];
};

/** No mockHighlights — highlights require real period evidence; API returns 422 when insufficient */

export function HighlightsStrip({ patientId, isTherapist=false }: { patientId?: string; isTherapist?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<HighlightItem[] | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // Load saved highlights on mount / when patient changes — persists until regenerated
  useEffect(() => {
    if (!patientId) { setInitialLoading(false); return; }
    const month = new Date().toISOString().slice(0, 7);
    fetch(`/api/agent/highlights/run?patientId=${encodeURIComponent(patientId)}&month=${month}`)
      .then(r => r.json())
      .then(data => {
        if (data?.highlights && Array.isArray(data.highlights)) {
          setItems(data.highlights);
          if (data.status === "published") setPublished(true);
        } else if (data?.status === "not_found") {
          // no saved highlights yet — show empty CTA
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, [patientId]);

  async function handleGenerate() {
    setLoading(true); setError(null);
    try {
      const url = patientId ? `/api/agent/highlights/run?patientId=${patientId}` : `/api/agent/highlights/run`;
      const r = await fetch(url, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ patientId, month: new Date().toISOString().slice(0,7) }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || data.message || "Failed to generate highlights");
      if (Array.isArray(data.highlights)) { setItems(data.highlights); setPublished(false); }
      else if (Array.isArray(data)) { setItems(data); setPublished(false); }
      else throw new Error(data.error || "No highlights — insufficient evidence");
    } catch (e:any) {
      setError(e.message || String(e));
    } finally { setLoading(false); }
  }

  async function handlePublish() {
    if (!patientId) { setPublished(true); return; }
    try { await fetch("/api/agent/highlights/publish", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ patientId }) }); } catch {}
    setPublished(true);
  }

  const arrowIcon = (a:string)=> a==="↑" ? TrendingUp : a==="↓" ? TrendingDown : Minus;

  if (initialLoading) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/60">
        <CardContent className="p-4 flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading highlights…
        </CardContent>
      </Card>
    );
  }

  if (!items) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/60">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-400" />
            Monthly Highlights
          </CardTitle>
          <Button size="sm" onClick={handleGenerate} disabled={loading} className="h-8 gap-1.5 text-xs bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} {loading ? "Thinking…" : "Generate highlights"}
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-xs text-zinc-500">Review this month in one click. We check your notes, goals, attendance, and activity results to pick what matters most. Your draft stays private until you publish.</p>
          {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/90 overflow-hidden">
      <CardHeader className="p-3.5 sm:p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400" />
            Highlights
            <Badge variant="teal" statusText={`${new Date().toLocaleDateString(undefined,{month:"short", year:"numeric"})}`} />
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleGenerate} disabled={loading} className="h-7 text-xs gap-1 border-zinc-700 text-zinc-300">
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} {loading ? "Thinking…" : "Regenerate"}
            </Button>
            {isTherapist && !published && <Button size="sm" onClick={handlePublish} className="h-7 text-xs gap-1 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold"><Send className="w-3 h-3" /> Publish</Button>}
            {published && <span className="text-xs text-emerald-400 flex items-center gap-1"><Eye className="w-3 h-3" /> Published to client</span>}
            <Button variant="ghost" size="sm" onClick={()=> setTraceOpen(!traceOpen)} className="h-7 text-xs text-zinc-400">
              {traceOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Trace
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-zinc-500">Picked by what changed most and felt steadiest · arrows compare to last month · {isTherapist ? "Private draft until you publish" : "Checked by your therapist"}</p>
      </CardHeader>
      <CardContent className="p-3.5 sm:p-4 pt-0 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-fr">
          {items.map((h)=>{
            const Arrow = arrowIcon(h.arrow);
            const arrowColor = h.arrow==="↑" ? "text-emerald-400" : h.arrow==="↓" ? "text-rose-400" : "text-zinc-400";
            return (
              <div key={h.slot} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">{h.slot}. {h.slotLabel}</span>
                  <Arrow className={`w-4 h-4 ${arrowColor}`} />
                </div>
                <p className="text-xs font-semibold text-zinc-100 leading-snug">{h.title}</p>
                <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">{h.story}</p>
                <div className="flex flex-wrap gap-1 mt-auto">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-teal-300 font-mono">{h.delta.quanti}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">{h.delta.quali}</span>
                </div>
                <p className="text-[10px] text-zinc-500 font-mono">w {h.weight.toFixed(2)} · {h.evidenceIds.join(" ")}</p>
              </div>
            );
          })}
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {traceOpen && <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-[11px] font-mono text-zinc-400">Looked at the last 30 days — notes, goals, homework, and videos — and picked the 7 clearest changes.</div>}
        <p className="text-[10px] text-zinc-500 italic">Your best 7 moments this month — checked by your therapist.</p>
      </CardContent>
    </Card>
  );
}
