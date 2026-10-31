"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, X, ImagePlus, Trash2 } from "lucide-react";

export function ReferenceInputs({
  links,
  onLinksChange,
  images,
  onImagesChange,
}: {
  links: string[];
  onLinksChange: (v: string[]) => void;
  images: string[];
  onImagesChange: (v: string[]) => void;
}) {
  const [linkInput, setLinkInput] = useState("");

  function addLink() {
    const trimmed = linkInput.trim();
    if (!trimmed) return;
    if (links.includes(trimmed)) return;
    try { new URL(trimmed); } catch { return; }
    onLinksChange([...links, trimmed].slice(0, 6));
    setLinkInput("");
  }

  function handleImageFiles(files: FileList | null) {
    if (!files) return;
    const remaining = 4 - images.length;
    const toRead = Array.from(files).slice(0, remaining);
    toRead.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        if (dataUrl.startsWith("data:image/")) {
          onImagesChange([...images, dataUrl].slice(0, 4));
        }
      };
      reader.readAsDataURL(file);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-teal-400" /> Reference Links (Pinterest / Website) — optional
        </label>
        <p className="text-[11px] text-zinc-500">Paste up to 6 links to pegs, Pinterest boards, or photo pages. AI uses them as loose inspiration only.</p>
        <div className="flex gap-2">
          <Input value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="https://pinterest.com/pin/..." className="h-9 text-xs" />
          <Button type="button" variant="outline" size="sm" onClick={addLink} disabled={!linkInput.trim()} className="shrink-0 h-9">
            Add
          </Button>
        </div>
        {links.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {links.map((l, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-300 max-w-[280px] truncate">
                <Link2 className="w-3 h-3 text-teal-400 shrink-0" />
                <span className="truncate max-w-[180px]">{l}</span>
                <button type="button" onClick={() => onLinksChange(links.filter((_, idx) => idx !== i))} className="ml-1 text-zinc-500 hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
          <ImagePlus className="w-3.5 h-3.5 text-teal-400" /> Reference Photos — optional (up to 4)
        </label>
        <p className="text-[11px] text-zinc-500">Upload peg photos, handwriting samples, or inspiration images. Sent to Spark as visual context and brief for Muse Image.</p>
        <label className="flex items-center justify-center gap-2 w-full h-12 rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/60 hover:bg-zinc-900 hover:border-teal-500/40 cursor-pointer transition-colors">
          <ImagePlus className="w-4 h-4 text-zinc-500" />
          <span className="text-xs text-zinc-400">{images.length >= 4 ? "Limit reached (4)" : "Click to upload images"}</span>
          <input type="file" accept="image/*" multiple className="hidden" disabled={images.length >= 4} onChange={(e) => handleImageFiles(e.target.files)} />
        </label>
        {images.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {images.map((src, i) => (
              <div key={i} className="relative group rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`ref ${i + 1}`} className="w-full h-20 object-cover" />
                <button
                  type="button"
                  onClick={() => onImagesChange(images.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-zinc-200 hover:bg-red-600 hover:text-white"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
