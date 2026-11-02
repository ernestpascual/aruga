"use client";
import { Loader2 } from "lucide-react";

export function PageLoader({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
      </div>
      <p className="text-xs text-zinc-400">{message}</p>
    </div>
  );
}

export function InlineLoader({ message, size = "sm" }: { message?: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
      <Loader2 className={`${dim} animate-spin text-teal-400 shrink-0`} />
      {message && <span>{message}</span>}
    </span>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-zinc-900 border border-zinc-800/60" />
      ))}
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-8 rounded-lg bg-zinc-900 border border-zinc-800/60" />
      <div className="h-8 rounded-lg bg-zinc-900 border border-zinc-800/60" />
      <div className="h-8 rounded-lg bg-zinc-900 border border-zinc-800/60" />
    </div>
  );
}
