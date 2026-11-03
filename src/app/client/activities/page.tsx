"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/supabase/auth-context";
import { HomeProgram, Submission } from "@/types/database";
import { Layers, FileCheck, Clock, CheckCircle2, Edit3, ChevronRight, Calendar, Archive, Eye, AlertCircle, Video, Palette, Loader2 } from "lucide-react";

type Tab = "all" | "active" | "drafts" | "completed";

export default function ClientActivitiesPage() {
  const { user } = useAuth();
  const isDemo = false;
  const [programs, setPrograms] = useState<(HomeProgram & { submissions?: Submission[]; latest_submission?: Submission | null })[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activities, setActivities] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [activityTab, setActivityTab] = useState<"programs" | "worksheets">("programs");

  useEffect(() => {
    if (!user?.id) return;
    const p = new URLSearchParams();
    if (user.id) p.set("clientUserId", user.id);
    p.set("isDemo", "false");

    const s = new URLSearchParams();
    if (user.id) s.set("clientUserId", user.id);
    s.set("isDemo", "false");

    Promise.all([
      fetch(`/api/therapist/programs?${p.toString()}`).then(r => r.json()).then(d => setPrograms(d.programs || [])),
      fetch(`/api/client/submissions?${s.toString()}`).then(r => r.json()).then(d => setSubmissions(d.submissions || [])),
      fetch(`/api/activities?clientUserId=${user.id}`).then(r => r.json()).then(d => setActivities(d.activities || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [user?.id, isDemo]);

  if (loading) return <div className="p-8 flex flex-col items-center gap-3 text-xs text-zinc-400"><Loader2 className="w-6 h-6 animate-spin text-teal-400" /><p>Loading your home programs…</p></div>;

  // Helper: Supabase returns review as array (join) or object — normalize
  const getReviewObj = (sub: unknown) => {
    const r = (sub as { review?: unknown })?.review;
    if (!r) return null;
    if (Array.isArray(r)) return (r[0] as { status?: string; overall_feedback?: string } | undefined) || null;
    return r as { status?: string; overall_feedback?: string };
  };
  const hasReviewFor = (s: Submission) => {
    if (s.state === "reviewed") return true;
    const r = getReviewObj(s);
    return r?.status === "published" || Boolean(r?.overall_feedback);
  };

  // Derive per-program status from program.status + submissions
  function programStatus(p: HomeProgram & { submissions?: Submission[] }): { label: string; variant: "teal" | "amber" | "emerald" | "outline"; desc: string } {
    const subs = submissions.filter(s => s.program_id === p.id);
    const hasReviewed = subs.some(hasReviewFor);
    const hasSubmitted = subs.some(s => s.state === "submitted");
    const hasDraft = subs.some(s => s.state === "draft");
    if (hasReviewed) return { label: "Reviewed", variant: "emerald", desc: "Therapist feedback published" };
    if (hasSubmitted) return { label: "Awaiting Review", variant: "amber", desc: "Submitted — awaiting therapist" };
    if (hasDraft) return { label: "Draft", variant: "outline", desc: "Draft — continue where you left off" };
    if (p.status === "assigned") return { label: "Assigned", variant: "teal", desc: "Ready to start" };
    if (p.status === "draft") return { label: "Draft Program", variant: "outline", desc: "Therapist draft — not yet assigned" };
    if (p.status === "archived") return { label: "Archived", variant: "outline", desc: "Archived" };
    return { label: p.status || "Assigned", variant: "teal", desc: "" };
  }

  const filtered = programs.filter(p => {
    if (tab === "all") return p.status !== "archived";
    if (tab === "active") return p.status === "assigned" || p.status === "draft";
    if (tab === "drafts") {
      const subs = submissions.filter(s => s.program_id === p.id);
      return subs.some(s => s.state === "draft");
    }
    if (tab === "completed") {
      const subs = submissions.filter(s => s.program_id === p.id);
      return subs.some(s => s.state === "submitted" || s.state === "reviewed");
    }
    return true;
  });

  const totalReviewed = submissions.filter(hasReviewFor).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="border-b border-zinc-800 pb-4">
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2"><Layers className="w-5 h-5 text-teal-400" /> Home Programs</h1>
        <p className="text-xs text-zinc-400 mt-1">All home programs assigned to you, their status, drafts, and past feedback — one place to continue or review.</p>
        <div className="flex items-center gap-3 mt-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1"><FileCheck className="w-3 h-3 text-teal-400" />{programs.length} program{programs.length !== 1 ? "s" : ""}</span>
          <span>•</span><span>{submissions.length} submission{submissions.length !== 1 ? "s" : ""}</span>
          <span>•</span><span>{totalReviewed} reviewed</span>
        </div>
      </div>

      {/* Inner tab: Programs vs Worksheets (keep gallery accessible) */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button onClick={() => setActivityTab("programs")} className={`px-3.5 py-2 rounded-lg text-xs font-semibold ${activityTab === "programs" ? "bg-teal-500/10 text-teal-400 border border-teal-500/30" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"}`}>My Home Programs <span className="ml-1 px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono text-[10px]">{programs.length}</span></button>
        <button onClick={() => setActivityTab("worksheets")} className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${activityTab === "worksheets" ? "bg-teal-500/10 text-teal-400 border border-teal-500/30" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"}`}><Palette className="w-3.5 h-3.5" /> Worksheets <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono text-[10px]">{activities.length}</span></button>
      </div>

      {activityTab === "worksheets" ? (
        activities.length === 0 ? (
          <Card className="border-zinc-800 bg-zinc-900 p-8 text-center space-y-2">
            <p className="text-sm text-zinc-400">No worksheets yet.</p>
            <p className="text-xs text-zinc-500">Your therapist attaches generated worksheets to Home Program steps.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activities.map((a) => (
              <Card key={String(a.id)} className="border-zinc-800 bg-zinc-900/90 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-zinc-100">{String(a.title)}</h3>
                <p className="text-xs text-zinc-400 line-clamp-2">{String(a.instructions || "")}</p>
                {a.base_image_url ? <img src={String(a.base_image_url)} alt={String(a.title)} className="w-full rounded-lg border border-zinc-700 bg-white" /> : null}
                <Link href={`/client/activities/${String(a.id)}`}><Button size="sm" className="bg-teal-600 hover:bg-teal-500 text-white text-xs">Open & Draw</Button></Link>
              </Card>
            ))}
          </div>
        )
      ) : (
        <>
          {/* Status filter tabs */}
          <div className="flex items-center gap-1.5 border-b border-zinc-800/80 pb-2 overflow-x-auto flex-nowrap snap-x">
            {([{ id: "all", label: "All" }, { id: "active", label: "Active" }, { id: "drafts", label: "Drafts" }, { id: "completed", label: "Past & Feedback" }] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium ${tab === t.id ? "bg-zinc-800 text-teal-400 font-semibold" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"}`}>{t.label}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <Card className="border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-3">
              <Layers className="w-8 h-8 text-zinc-600 mx-auto" />
              <h3 className="text-sm font-bold text-zinc-200">No home programs in this view</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">Your therapist’s assigned home programs will appear here with their status, drafts, and feedback.</p>
              <Link href="/client"><Button size="sm" className="bg-teal-600 hover:bg-teal-500 text-white text-xs mt-2">Go to Dashboard</Button></Link>
            </Card>
          ) : (
            <div className="space-y-4">
              {filtered.map(p => {
                const st = programStatus(p);
                const subs = submissions.filter(s => s.program_id === p.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const draftSub = subs.find(s => s.state === "draft");
                const latestReviewed = subs.find(hasReviewFor);
                const isArchived = p.status === "archived";
                return (
                  <Card key={p.id} className="border-zinc-800 bg-zinc-900/90 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-zinc-100">{p.title}</h3>
                          <Badge variant={st.variant} statusText={st.label} icon={st.label === "Draft" ? <Edit3 className="w-3 h-3" /> : st.label === "Reviewed" ? <CheckCircle2 className="w-3 h-3" /> : st.label === "Awaiting Review" ? <Clock className="w-3 h-3" /> : st.label === "Archived" ? <Archive className="w-3 h-3" /> : undefined} />
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{p.main_instructions || "Follow your prescribed steps and record short clips."}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Created {new Date(p.created_at).toLocaleDateString()}</span>
                          {Array.isArray(p.scheduled_dates) && p.scheduled_dates.length > 0 && <span className="flex items-center gap-1"><Video className="w-3 h-3" />{p.scheduled_dates.length} scheduled date{p.scheduled_dates.length !== 1 ? "s" : ""}</span>}
                          <span>•</span><span>{p.steps?.length || 0} step{(p.steps?.length || 0) !== 1 ? "s" : ""}</span>
                          <span>•</span><span className="text-zinc-400">{st.desc}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {isArchived ? (
                          <Badge variant="outline" statusText="Archived" />
                        ) : draftSub ? (
                          <>
                            <Link href={`/client/programs/${p.id}${draftSub.scheduled_date ? `?date=${draftSub.scheduled_date}&edit=true` : "?edit=true"}`}><Button size="sm" className="h-8 px-3 text-xs gap-1.5 bg-amber-600 hover:bg-amber-500 text-white"><Edit3 className="w-3.5 h-3.5" /> Continue Draft</Button></Link>
                            <Link href={`/client/programs/${p.id}${draftSub.scheduled_date ? `?date=${draftSub.scheduled_date}` : ""}`}><Button variant="outline" size="sm" className="h-8 text-xs gap-1"><Eye className="w-3.5 h-3.5" /> View</Button></Link>
                          </>
                        ) : (
                          <Link href={`/client/programs/${p.id}`}><Button size="sm" className="h-8 px-4 text-xs gap-1.5 bg-teal-600 hover:bg-teal-500 text-white">{subs.length === 0 ? "Start" : "Open"} <ChevronRight className="w-3.5 h-3.5" /></Button></Link>
                        )}
                      </div>
                    </div>

                    {/* Past submissions + feedback preview per program */}
                    {subs.length > 0 && (
                      <div className="border-t border-zinc-800/60 pt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-300">Your submissions ({subs.length})</span>
                          <Link href="/client/history" className="text-[11px] text-teal-400 hover:text-teal-300">See full history →</Link>
                        </div>
                        <div className="grid gap-2">
                          {subs.slice(0, 3).map(s => {
                            const reviewed = hasReviewFor(s);
                            const awaiting = s.state === "submitted" && !reviewed;
                            const rObj = getReviewObj(s);
                            return (
                              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2 text-xs">
                                    {reviewed ? <Badge variant="emerald" statusText="Reviewed" /> : awaiting ? <Badge variant="amber" statusText="Awaiting Feedback" /> : <Badge variant="outline" statusText="Draft" />}
                                    <span className="text-zinc-500 font-mono text-[11px]">{s.scheduled_date || new Date(s.created_at).toLocaleDateString()}</span>
                                    <span className="text-zinc-600 text-[11px]">{s.step_submissions?.length || 0} steps</span>
                                  </div>
                                  {rObj?.overall_feedback && <p className="text-xs text-zinc-400 line-clamp-1">Feedback: “{rObj.overall_feedback.slice(0, 80)}…”</p>}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {reviewed ? (
                                    <Link href={`/client/programs/${p.id}?date=${s.scheduled_date || ""}&submissionId=${s.id}`}><Button size="sm" className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">View feedback</Button></Link>
                                  ) : (
                                    <Link href={`/client/programs/${p.id}${s.scheduled_date ? `?date=${s.scheduled_date}` : ""}`}><Button variant="outline" size="sm" className="h-7 text-xs px-2.5">View</Button></Link>
                                  )}
                                  {s.state === "draft" && <Link href={`/client/programs/${p.id}${s.scheduled_date ? `?date=${s.scheduled_date}&edit=true` : "?edit=true"}`}><Button size="sm" className="h-7 text-xs px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200">Edit Draft</Button></Link>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {subs.length > 3 && <p className="text-[11px] text-zinc-500">+{subs.length - 3} more — see History for full list.</p>}
                      </div>
                    )}

                    {subs.length === 0 && p.status === "assigned" && (
                      <div className="flex items-center gap-2 text-xs text-amber-300/80 bg-amber-950/20 border border-amber-800/30 rounded-lg p-2.5"><AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />No submission yet — start your program to create a draft.</div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
