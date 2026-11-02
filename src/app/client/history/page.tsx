"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  History,
  CheckCircle2,
  Clock,
  Archive,
  Calendar,
  FileText,
  Video,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Stethoscope,
  UserCheck,
  Activity,
  ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/supabase/auth-context";
import { SoapNote, SoapNoteAssessmentLink } from "@/types/database";
import { SoapSummaryCard } from "@/components/ui/soap-summary-card";

type PrimaryTab = "programs" | "live_sessions";
type FilterTab = "all" | "awaiting" | "reviewed" | "archived";

interface HomeProgramDisplayItem {
  id: string;
  title: string;
  status: "awaiting" | "reviewed" | "archived";
  submittedDate: string;
  reviewedDate: string | null;
  overallFeedback: string | null;
  sessionRecordingUrl?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  assessmentLinks?: SoapNoteAssessmentLink[];
  plan?: string | null;
  clientSummary?: string | null;
  therapistName?: string | null;
  category?: "pediatric" | "adult";
  clientName?: string;
  steps: Array<{
    position: number;
    title: string;
    videoPath?: string | null;
    comment?: string | null;
    therapistNote?: string | null;
    skipped?: boolean;
    skipReason?: string | null;
  }>;
}

export default function ClientHistoryPage() {
  const { user, profile } = useAuth();

  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>("programs");
  const [activeTab, setActiveTab] = useState<FilterTab>("reviewed");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const [soapNotes, setSoapNotes] = useState<SoapNote[]>([]);
  const [soapNotesLoading, setSoapNotesLoading] = useState(true);

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const [realPrograms, setRealPrograms] = useState<HomeProgramDisplayItem[]>([]);
  const [, setLoading] = useState(Boolean(user?.id));

  // Fetch Home Program Submissions & Reviews
  useEffect(() => {
    if (!user?.id) {
      return;
    }
    fetch(`/api/client/submissions?clientUserId=${user.id}&isDemo=false`)
      .then((res) => res.json())
      .then((data) => {
        if (data.submissions && Array.isArray(data.submissions)) {
          const mapped: HomeProgramDisplayItem[] = data.submissions.map((s: Record<string, unknown>) => {
            const program = s.program as { title?: string; steps?: Array<{ id: string; position?: number; title?: string; instructions?: string }> } | undefined;
            const review = s.review as {
              overall_feedback?: string;
              subjective?: string;
              objective?: string;
              assessment?: string;
              plan?: string;
              client_summary?: string;
              therapist_name?: string;
              step_reviews?: Array<{ step_submission_id: string; therapist_note?: string }>;
            } | undefined;
            const stepSubs = (s.step_submissions || []) as Array<{
              id: string;
              program_step_id: string;
              video_path?: string | null;
              client_comment?: string | null;
              skipped?: boolean;
              skip_reason?: string | null;
            }>;

            return {
              id: String(s.id),
              title: program?.title || "Home Program",
              status: s.state === "reviewed" ? "reviewed" : s.state === "submitted" ? "awaiting" : "archived",
              submittedDate: s.submitted_at ? new Date(String(s.submitted_at)).toLocaleDateString() : new Date(String(s.created_at)).toLocaleDateString(),
              reviewedDate: s.reviewed_at ? new Date(String(s.reviewed_at)).toLocaleDateString() : null,
              overallFeedback: review?.overall_feedback || null,
              sessionRecordingUrl: (review as { session_recording_url?: string | null })?.session_recording_url || null,
              subjective: review?.subjective || null,
              objective: review?.objective || null,
              assessment: review?.assessment || null,
              assessmentLinks: ((review as { assessment_links?: SoapNoteAssessmentLink[] })?.assessment_links) || [],
              plan: review?.plan || null,
              clientSummary: review?.client_summary || null,
              therapistName: review?.therapist_name || profile?.clinician_name || null,
              steps: stepSubs.map((ss, idx) => {
                const stepRef = program?.steps?.find((st) => st.id === ss.program_step_id);
                const stepReview = review?.step_reviews?.find((sr) => sr.step_submission_id === ss.id);
                return {
                  position: stepRef?.position || idx + 1,
                  title: stepRef?.title || stepRef?.instructions || `Exercise Step ${idx + 1}`,
                  videoPath: ss.video_path,
                  comment: ss.client_comment,
                  therapistNote: stepReview?.therapist_note || null,
                  skipped: ss.skipped,
                  skipReason: ss.skip_reason,
                };
              }),
            };
          });
          setRealPrograms(mapped);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id, profile?.clinician_name]);

  // Fetch Session Clinical Documentation
  useEffect(() => {
    const params = new URLSearchParams();
    if (user?.id) params.set("clientUserId", user.id);
    params.set("isDemo", "false");

    fetch(`/api/client/soap-notes?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.soapNotes && Array.isArray(data.soapNotes)) {
          setSoapNotes(data.soapNotes);
        }
      })
      .catch(() => {})
      .finally(() => setSoapNotesLoading(false));
  }, [user?.id]);

  const programs = realPrograms;

  const filteredPrograms = programs.filter((p) => {
    if (activeTab === "all") return true;
    if (activeTab === "reviewed") return p.status === "reviewed";
    if (activeTab === "awaiting") return p.status === "awaiting";
    if (activeTab === "archived") return p.status === "archived";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
          <History className="w-5 h-5 text-teal-400" />
          Clinical Care Notes & History
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Review your clinical SOAP evaluations from your therapist, complete with simple, easy-to-understand takeaways for you and your family.
        </p>
      </div>

      {/* Primary Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0 flex-nowrap">
        <button
          onClick={() => setPrimaryTab("programs")}
          className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            primaryTab === "programs"
              ? "bg-teal-500/10 text-teal-400 border border-teal-500/30 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <FileText className="w-4 h-4" />
          Home Program Feedback
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
            {programs.length}
          </span>
        </button>

        <button
          onClick={() => setPrimaryTab("live_sessions")}
          className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            primaryTab === "live_sessions"
              ? "bg-teal-500/10 text-teal-400 border border-teal-500/30 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <Stethoscope className="w-4 h-4 text-teal-400" />
          Session Clinical Documentation
          {soapNotes.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-mono font-bold">
              {soapNotes.length}
            </span>
          )}
        </button>
      </div>

      {/* ==================================================================== */}
      {/* SECTION A: HOME PROGRAM REVIEWS WITH SOAP & SIMPLE SUMMARY           */}
      {/* ==================================================================== */}
      {primaryTab === "programs" && (
        <div className="space-y-6">
          {/* Sub-Filter Tabs */}
          <div className="flex items-center gap-1.5 border-b border-zinc-800/80 pb-2 overflow-x-auto scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0 flex-nowrap snap-x">
            {(
              [
                { id: "reviewed", label: "Reviewed by Therapist" },
                { id: "all", label: "All Home Programs" },
                { id: "awaiting", label: "Awaiting Feedback" },
                { id: "archived", label: "Archived" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 whitespace-nowrap snap-start px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-zinc-800 text-teal-400 font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Home Program Cards List */}
          <div className="space-y-4">
            {filteredPrograms.map((item) => {
              const isExpanded = expandedCards[item.id] ?? false;
              const hasSoapNotes = Boolean(item.subjective || item.objective || item.assessment || item.plan);
              const friendlySummary = item.clientSummary || null;

              return (
                <Card key={item.id} className="border-zinc-800 bg-zinc-900/90 overflow-hidden">
                  <div
                    onClick={() => toggleExpand(item.id)}
                    className="p-4 sm:p-5 cursor-pointer hover:bg-zinc-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-base font-semibold text-zinc-100">
                          {item.title}
                        </h2>
                        {item.status === "reviewed" ? (
                          <Badge variant="emerald" statusText="Feedback Published" icon={<CheckCircle2 className="w-3 h-3" />} />
                        ) : item.status === "awaiting" ? (
                          <Badge variant="amber" statusText="Awaiting Feedback" icon={<Clock className="w-3 h-3" />} />
                        ) : (
                          <Badge variant="outline" statusText="Archived" icon={<Archive className="w-3 h-3" />} />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                          Submitted: {item.submittedDate}
                        </span>
                        {item.reviewedDate && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                            Reviewed: {item.reviewedDate}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto text-xs text-zinc-400 font-medium">
                      <span>{item.steps.length} Steps</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800 p-4 sm:p-5 space-y-6 bg-zinc-950/40">
                      {/* 1. THERAPIST SOAP NOTES (4 BOXES) */}
                      {hasSoapNotes && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                                <Stethoscope className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                                Clinician SOAP Evaluation
                              </span>
                            </div>
                            <span className="text-[11px] text-zinc-400">
                              {item.therapistName || "Occupational Therapist"}
                            </span>
                          </div>

                          {/* Pre-SOAP Session Recording Link */}
                          {item.sessionRecordingUrl && (
                            <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0">
                                  <Video className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-teal-300">Session Video Recording Attached</div>
                                  <div className="text-[11px] text-zinc-400 truncate max-w-sm sm:max-w-md">
                                    {item.sessionRecordingUrl}
                                  </div>
                                </div>
                              </div>
                              <a
                                href={item.sessionRecordingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-bold transition-colors shrink-0"
                              >
                                <Video className="w-3.5 h-3.5" />
                                Watch Recording
                                <ExternalLink className="w-3 h-3 ml-0.5" />
                              </a>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Subjective Box */}
                            <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-950/10 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold font-mono flex items-center justify-center">
                                  S
                                </span>
                                <span className="text-xs font-bold text-sky-300">
                                  Subjective
                                </span>
                              </div>
                              <p className="text-xs text-zinc-300 leading-relaxed">
                                {item.subjective || "No subjective notes recorded."}
                              </p>
                            </div>

                            {/* Objective Box */}
                            <div className="p-3.5 rounded-xl border border-teal-500/20 bg-teal-950/10 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded bg-teal-500/20 text-teal-300 text-[10px] font-bold font-mono flex items-center justify-center">
                                  O
                                </span>
                                <span className="text-xs font-bold text-teal-300">
                                  Objective
                                </span>
                              </div>
                              <p className="text-xs text-zinc-300 leading-relaxed">
                                {item.objective || "No objective metrics recorded."}
                              </p>
                            </div>

                            {/* Assessment Box */}
                            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-950/10 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold font-mono flex items-center justify-center">
                                  A
                                </span>
                                <span className="text-xs font-bold text-amber-300">
                                  Assessment (Clinical Evaluation)
                                </span>
                              </div>
                              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                {item.assessment || "No clinical assessment recorded."}
                              </p>

                              {/* Assessment documents links */}
                              {Array.isArray(item.assessmentLinks) && item.assessmentLinks.length > 0 && (
                                <div className="pt-2 border-t border-amber-500/20 space-y-1.5">
                                  <span className="text-[10px] uppercase font-bold text-amber-400 block">
                                    Attached Documents & Reports:
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.assessmentLinks.map((link, lIdx) => (
                                      <a
                                        key={lIdx}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-zinc-900 border border-amber-500/30 text-amber-200 hover:text-white hover:border-amber-400"
                                      >
                                        <FileText className="w-3 h-3 text-amber-400" />
                                        <span>{link.title || link.url}</span>
                                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Plan Box */}
                            <div className="p-3.5 rounded-xl border border-violet-500/20 bg-violet-950/10 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded bg-violet-500/20 text-violet-300 text-[10px] font-bold font-mono flex items-center justify-center">
                                  P
                                </span>
                                <span className="text-xs font-bold text-violet-300">
                                  Plan & Adjustments
                                </span>
                              </div>
                              <p className="text-xs text-zinc-300 leading-relaxed">
                                {item.plan || "No plan adjustments specified."}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2. PROMINENTLY BELOW SOAP: BUTTON TO SEE SUMMARY & CACHE IN DB */}
                      <SoapSummaryCard
                        targetType="submission_review"
                        targetId={item.id}
                        initialSummary={friendlySummary}
                        subjective={item.subjective}
                        objective={item.objective}
                        assessment={item.assessment}
                        plan={item.plan}
                        clientName={item.clientName}
                        isDemo={false}
                      />

                      {/* 3. STEP-BY-STEP PUBLISHED NOTES */}
                      <div className="space-y-3 pt-2">
                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                          Step-by-Step Published Notes
                        </span>

                        <div className="space-y-3">
                          {item.steps.map((st) => (
                            <div
                              key={st.position}
                              className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-zinc-200">
                                  Step {st.position}: {st.title}
                                </span>
                                {st.skipped ? (
                                  <Badge variant="amber" statusText="Skipped" />
                                ) : (
                                  <Badge variant="emerald" statusText="Video Reviewed" icon={<Video className="w-3 h-3" />} />
                                )}
                              </div>

                              {st.skipped ? (
                                <p className="text-xs text-zinc-400 italic">
                                  Client note: &quot;{st.skipReason}&quot;
                                </p>
                              ) : (
                                st.comment && (
                                  <p className="text-xs text-zinc-400">
                                    Client comment: &quot;{st.comment}&quot;
                                  </p>
                                )
                              )}

                              <div className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-3 text-xs text-teal-200 space-y-1">
                                <span className="text-[10px] font-semibold uppercase text-zinc-400 block">
                                  Therapist Step Note:
                                </span>
                                <p className="leading-relaxed">{st.therapistNote}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}

            {filteredPrograms.length === 0 && (
              <Card className="border-dashed border-zinc-800 bg-zinc-900/60 p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-zinc-950 border border-zinc-800 text-teal-400 mx-auto flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-zinc-100">No Home Program History in this Tab</h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Once you submit home program recordings, clinician evaluations and SOAP breakdowns will be displayed here.
                  </p>
                </div>
                <div className="pt-2">
                  <Link href="/client">
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold text-xs gap-1.5">
                      Go to Exercises
                    </Button>
                  </Link>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION B: SESSION CLINICAL DOCUMENTATION WITH SIMPLE SUMMARY               */}
      {/* ==================================================================== */}
      {primaryTab === "live_sessions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-teal-400" />
                Session Clinical Documentation
              </h2>
              <p className="text-xs text-zinc-400">
                Official clinical documentation from your sessions, accompanied by clear family takeaways.
              </p>
            </div>
          </div>

          {soapNotesLoading ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              Loading clinician session notes...
            </div>
          ) : soapNotes.length === 0 ? (
            <Card className="border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-zinc-950 border border-zinc-800 text-teal-400 mx-auto flex items-center justify-center">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-200">No Live Session Notes Recorded Yet</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  When your therapist documents your live in-person or tele-rehabilitation sessions, their full SOAP notes and your personalized summary will appear here.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-5">
              {soapNotes.map((note) => {
                const clinicianName =
                  note.therapist_profile?.display_name ||
                  profile?.clinician_name ||
                  "Occupational Therapist";

                return (
                  <Card
                    key={note.id}
                    className="border-zinc-800 bg-zinc-900/90 p-5 space-y-5 overflow-hidden"
                  >
                    {/* Note Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-base font-bold text-zinc-100">
                            {note.session_title}
                          </h3>
                          <Badge
                            variant="teal"
                            statusText="Live Session"
                            icon={<Activity className="w-3 h-3" />}
                          />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                            Session Date: {new Date(note.session_date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1 text-teal-400 font-medium">
                            <UserCheck className="w-3.5 h-3.5" />
                            Clinician: {clinicianName}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pre-SOAP Session Recording Link */}
                    {note.session_recording_url && (
                      <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0">
                            <Video className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-teal-300">Live Session Recording</div>
                            <div className="text-[11px] text-zinc-400 truncate max-w-sm sm:max-w-md">
                              {note.session_recording_url}
                            </div>
                          </div>
                        </div>
                        <a
                          href={note.session_recording_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-bold transition-colors shrink-0"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Watch Recording
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>
                      </div>
                    )}

                    {/* 4 SOAP Boxes Grid */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                        Clinical SOAP Breakdown
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Subjective Box */}
                        <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-950/10 space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold font-mono flex items-center justify-center">
                              S
                            </span>
                            <span className="text-xs font-bold text-sky-300">
                              Subjective (Your Symptoms & Reports)
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                            {note.subjective}
                          </p>
                        </div>

                        {/* Objective Box */}
                        <div className="p-3.5 rounded-xl border border-teal-500/20 bg-teal-950/10 space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-teal-500/20 text-teal-300 text-[10px] font-bold font-mono flex items-center justify-center">
                              O
                            </span>
                            <span className="text-xs font-bold text-teal-300">
                              Objective (Measurements & Performance)
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                            {note.objective}
                          </p>
                        </div>

                        {/* Assessment Box */}
                        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-950/10 space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold font-mono flex items-center justify-center">
                              A
                            </span>
                            <span className="text-xs font-bold text-amber-300">
                              Assessment (Clinical Evaluation)
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                            {note.assessment}
                          </p>

                          {/* Assessment documents links */}
                          {Array.isArray(note.assessment_links) && note.assessment_links.length > 0 && (
                            <div className="pt-2 border-t border-amber-500/20 space-y-1.5">
                              <span className="text-[10px] uppercase font-bold text-amber-400 block">
                                Attached Documents & Reports:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {note.assessment_links.map((link, lIdx) => (
                                  <a
                                    key={lIdx}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-zinc-900 border border-amber-500/30 text-amber-200 hover:text-white hover:border-amber-400"
                                  >
                                    <FileText className="w-3 h-3 text-amber-400" />
                                    <span>{link.title || link.url}</span>
                                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Plan Box */}
                        <div className="p-3.5 rounded-xl border border-violet-500/20 bg-violet-950/10 space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-violet-500/20 text-violet-300 text-[10px] font-bold font-mono flex items-center justify-center">
                              P
                            </span>
                            <span className="text-xs font-bold text-violet-300">
                              Plan (Next Steps & Home Program Goals)
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {note.plan}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* PROMINENTLY BELOW THE SOAP NOTES: BUTTON TO SEE SUMMARY & CACHE IN DB */}
                    <SoapSummaryCard
                      targetType="soap_note"
                      targetId={note.id}
                      initialSummary={note.client_summary}
                      subjective={note.subjective}
                      objective={note.objective}
                      assessment={note.assessment}
                      plan={note.plan}
                      clientName={profile?.display_name || user?.user_metadata?.name || "Client"}
                      isDemo={false}
                    />
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
