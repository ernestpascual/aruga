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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/supabase/auth-context";
import { isDemoUser } from "@/lib/supabase/demo-helpers";
import { SoapNote } from "@/types/database";
import { SoapSummaryCard } from "@/components/ui/soap-summary-card";

type PrimaryTab = "programs" | "live_sessions";
type FilterTab = "all" | "awaiting" | "reviewed" | "archived";

interface RoutineDisplayItem {
  id: string;
  title: string;
  status: "awaiting" | "reviewed" | "archived";
  submittedDate: string;
  reviewedDate: string | null;
  overallFeedback: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
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
  const isDemo = isDemoUser(user, profile);

  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>("programs");
  const [activeTab, setActiveTab] = useState<FilterTab>("reviewed");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    "prog-demo": true,
  });

  const [soapNotes, setSoapNotes] = useState<SoapNote[]>([]);
  const [soapNotesLoading, setSoapNotesLoading] = useState(true);

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const demoPrograms: RoutineDisplayItem[] = [
    {
      id: "prog-demo",
      title: "Tabletop Grasp & Precision Release Routine",
      status: "reviewed",
      submittedDate: "Oct 27, 2026",
      reviewedDate: "Oct 27, 2026",
      overallFeedback:
        "Great effort on the tabletop transfer, Marcus. Your wrist alignment during the cup release is noticeably improved. Good decision to rest your shoulder on step 3—honoring fatigue prevents compensatory shoulder hiking.",
      subjective:
        "Client completed routine in dining room. Reported feeling confident with cylindrical grasp, rating fatigue at 3/10. Noted slight stiffness during step 3 before resting.",
      objective:
        "Full completion of steps 1 & 2. 10/10 cup transfers with stable wrist neutral alignment. Step 3 forearm supination paused appropriately due to muscular fatigue.",
      assessment:
        "Notable progression in distal grasp strength and release control. Self-monitoring fatigue demonstrates excellent compensatory safety awareness.",
      plan:
        "Continue daily tabletop transfers. Re-test active supination at Friday live tele-rehab session.",
      clientSummary:
        "Marcus, fantastic dedication to your tabletop grasp routine! Your wrist stability and cup control are visibly stronger. Taking a break on step 3 when your shoulder felt tired was the exact right move. Keep up the daily practice and we will check your progress on Friday!",
      therapistName: "Dr. Sarah Jenkins, OTR/L",
      steps: [
        {
          position: 1,
          title: "Cylindrical Cup Lift and Transfer",
          videoPath: "/demo/cup_grasp_transfer.mp4",
          comment: "Felt smoother than last week! Finger extension still feels stiff right before touching the cup.",
          therapistNote: "Smooth cylindrical grasp observed. Minimal trunk compensation. Keep focusing on slow finger release.",
          skipped: false,
        },
        {
          position: 2,
          title: "Small Block Lateral Stacking",
          videoPath: "/demo/block_stacking.mp4",
          comment: "Managed 4 repetitions with the small wooden block.",
          therapistNote: "Clean pinch grasp. Noticeable control when crossing midline.",
          skipped: false,
        },
        {
          position: 3,
          title: "Forearm Supination with Washcloth",
          videoPath: null,
          skipped: true,
          skipReason: "Shoulder felt tight and fatigued after step 2; rested per precautions.",
          therapistNote: "Appropriate skip. We will re-evaluate shoulder active range of motion during our next session.",
        },
      ],
    },
    {
      id: "prog-demo-pediatric",
      title: "Playful Pincer Grasp & Bilateral Toy Routine",
      status: "reviewed",
      category: "pediatric",
      clientName: "Leo Chen (Pediatric, 6y • Mom: Sarah)",
      submittedDate: "Oct 28, 2026",
      reviewedDate: "Oct 28, 2026",
      overallFeedback:
        "Fantastic progress, Leo! Sarah, his pincer grasp on the pegs showed wonderful isolated finger control with much less whole-hand raking. Great call on loosening the jar lid for step 3.",
      subjective:
        "Mom (Sarah) reports Leo was excited to play today. Notes he occasionally switches to a whole-hand fisted grasp when tired or rushing.",
      objective:
        "Completed 8/10 peg placements using neat pad-to-pad pincer grasp with right hand. Helper hand spontaneously stabilized the container edge on 6 trials without verbal prompting.",
      assessment:
        "Distal finger isolation and bilateral cooperative hand use show marked improvement. Hand dominance is consolidating on the right side.",
      plan:
        "Assigned Playful Pincer Grasp Routine. Encourage positive verbal cues when Leo uses his helper hand. Next playful check-in Wednesday.",
      clientSummary:
        "Sarah, Leo had such a fun and focused session today! His little fingers are getting much better at pinching small pegs one by one instead of grabbing with his whole fist. Remember to give him a high-five whenever he uses his 'helper hand' to hold the container steady. Keep up the playful practice at home!",
      therapistName: "Dr. Sarah Jenkins, OTR/L",
      steps: [
        {
          position: 1,
          title: "Colorful Peg Stacking Game",
          videoPath: "/demo/cup_grasp_transfer.mp4",
          comment: "Leo loved picking the green and yellow pegs today!",
          therapistNote: "Clear index-thumb opposition. Helper hand stabilized the board well.",
          skipped: false,
        },
        {
          position: 2,
          title: "Play-Doh Bead Roll & Squash",
          videoPath: "/demo/block_stacking.mp4",
          comment: "Used index finger to squash all 3 dough balls.",
          therapistNote: "Good finger isolation when squashing the dough beads.",
          skipped: false,
        },
        {
          position: 3,
          title: "Two-Handed Lid Unscrewing",
          videoPath: null,
          skipped: true,
          skipReason: "Jar lid was too tight for tiny hands; will practice with a looser lid tomorrow.",
          therapistNote: "Appropriate skip. Practice with a looser lid first.",
        },
      ],
    },
  ];

  const [realPrograms, setRealPrograms] = useState<RoutineDisplayItem[]>([]);
  const [, setLoading] = useState(!isDemo && Boolean(user?.id));

  // Fetch Home Program Submissions & Reviews
  useEffect(() => {
    if (isDemo || !user?.id) {
      return;
    }
    fetch(`/api/client/submissions?clientUserId=${user.id}&isDemo=false`)
      .then((res) => res.json())
      .then((data) => {
        if (data.submissions && Array.isArray(data.submissions)) {
          const mapped: RoutineDisplayItem[] = data.submissions.map((s: Record<string, unknown>) => {
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
              title: program?.title || "Home Rehabilitation Routine",
              status: s.state === "reviewed" ? "reviewed" : s.state === "submitted" ? "awaiting" : "archived",
              submittedDate: s.submitted_at ? new Date(String(s.submitted_at)).toLocaleDateString() : new Date(String(s.created_at)).toLocaleDateString(),
              reviewedDate: s.reviewed_at ? new Date(String(s.reviewed_at)).toLocaleDateString() : null,
              overallFeedback: review?.overall_feedback || null,
              subjective: review?.subjective || null,
              objective: review?.objective || null,
              assessment: review?.assessment || null,
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
  }, [user?.id, isDemo, profile?.clinician_name]);

  // Fetch Live Session SOAP Notes
  useEffect(() => {
    const params = new URLSearchParams();
    if (user?.id) params.set("clientUserId", user.id);
    params.set("isDemo", isDemo ? "true" : "false");

    fetch(`/api/client/soap-notes?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.soapNotes && Array.isArray(data.soapNotes)) {
          setSoapNotes(data.soapNotes);
        }
      })
      .catch(() => {})
      .finally(() => setSoapNotesLoading(false));
  }, [user?.id, isDemo]);

  const programs = isDemo ? demoPrograms : realPrograms;

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
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setPrimaryTab("programs")}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
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
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            primaryTab === "live_sessions"
              ? "bg-teal-500/10 text-teal-400 border border-teal-500/30 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <Stethoscope className="w-4 h-4 text-teal-400" />
          Live Session SOAP Notes
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
          <div className="flex items-center gap-1.5 border-b border-zinc-800/80 pb-2">
            {(
              [
                { id: "reviewed", label: "Reviewed by Therapist" },
                { id: "all", label: "All Routines" },
                { id: "awaiting", label: "Awaiting Feedback" },
                { id: "archived", label: "Archived" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-zinc-800 text-teal-400 font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Routine Cards List */}
          <div className="space-y-4">
            {filteredPrograms.map((item) => {
              const isExpanded = expandedCards[item.id] ?? false;
              const hasSoapNotes = Boolean(item.subjective || item.objective || item.assessment || item.plan);
              const friendlySummary = item.clientSummary || null;

              return (
                <Card key={item.id} className="border-zinc-800 bg-zinc-900/90 overflow-hidden">
                  <div
                    onClick={() => toggleExpand(item.id)}
                    className="p-5 cursor-pointer hover:bg-zinc-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
                    <div className="border-t border-zinc-800 p-5 space-y-6 bg-zinc-950/40">
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
                                  Assessment
                                </span>
                              </div>
                              <p className="text-xs text-zinc-300 leading-relaxed">
                                {item.assessment || "No clinical assessment recorded."}
                              </p>
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
                        isDemo={isDemo}
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
                  <h3 className="text-base font-bold text-zinc-100">No Routine History in this Tab</h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Once you submit exercise routine recordings, clinician evaluations and SOAP breakdowns will be displayed here.
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
      {/* SECTION B: LIVE SESSION SOAP NOTES WITH SIMPLE SUMMARY               */}
      {/* ==================================================================== */}
      {primaryTab === "live_sessions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-teal-400" />
                Live Session SOAP Notes from Your Clinician
              </h2>
              <p className="text-xs text-zinc-400">
                Official clinical documentation from your in-person or tele-rehab sessions, accompanied by clear family takeaways.
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
                          <p className="text-xs text-zinc-300 leading-relaxed">
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
                          <p className="text-xs text-zinc-300 leading-relaxed">
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
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {note.assessment}
                          </p>
                        </div>

                        {/* Plan Box */}
                        <div className="p-3.5 rounded-xl border border-violet-500/20 bg-violet-950/10 space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-violet-500/20 text-violet-300 text-[10px] font-bold font-mono flex items-center justify-center">
                              P
                            </span>
                            <span className="text-xs font-bold text-violet-300">
                              Plan (Next Steps & Routine Goals)
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
                      isDemo={isDemo}
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
