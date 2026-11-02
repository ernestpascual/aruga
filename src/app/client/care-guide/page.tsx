"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { HeartPulse, ArrowLeft, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/supabase/auth-context";

export default function ClientCareGuidePage() {
  const { user } = useAuth();
  const [careGuide, setCareGuide] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGuide = async () => {
      try {
        const params = new URLSearchParams();
        if (user?.id) params.set("clientUserId", user.id);
        const res = await fetch(`/api/client/care-guide?${params.toString()}`);
        const data = await res.json();
        if (data.careGuide !== undefined) setCareGuide(data.careGuide);
        else setCareGuide("");
      } catch {
        setCareGuide("");
      } finally {
        setLoading(false);
      }
    };
    fetchGuide();
  }, [user?.id]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link href="/client" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Home Program
      </Link>

      <Card className="border-zinc-800 bg-zinc-900/90 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-teal-950/60 border border-teal-500/30 grid place-items-center">
            <HeartPulse className="w-5 h-5 text-teal-400" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">Care Guide</h1>
            <p className="text-xs text-zinc-400">General care guidelines from your therapist — read-only.</p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-500">Loading care guide…</div>
        ) : !careGuide || careGuide.trim().length === 0 ? (
          <div className="py-10 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/40 space-y-2">
            <FileText className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-semibold text-zinc-300">No care guide yet</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">Your therapist hasn&apos;t published general care guidelines for you yet. Check back after your next session.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200 font-sans">{careGuide}</pre>
          </div>
        )}
      </Card>
    </div>
  );
}
