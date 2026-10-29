"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/supabase/auth-context";
import { isDemoUser } from "@/lib/supabase/demo-helpers";

type FilterTab = "all" | "awaiting" | "reviewed" | "archived";

export default function ClientHistoryPage() {
  const { user, profile } = useAuth();
  const isDemo = isDemoUser(user, profile);
  const [activeTab, setActiveTab] = useState<FilterTab>("reviewed");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    "prog-demo": true,
  });

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const demoPrograms = [
    {
      id: "prog-demo",
      title: "Tabletop Grasp & Precision Release Routine",
      status: "reviewed" as "awaiting" | "reviewed" | "archived",
      submittedDate: "Oct 27, 2026",
      reviewedDate: "Oct 27, 2026",
      overallFeedback:
        "Great effort on the tabletop transfer, Marcus. Your wrist alignment during the cup release is noticeably improved. Good decision to rest your shoulder on step 3—honoring fatigue prevents compensatory shoulder hiking.",
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
      status: "reviewed" as "awaiting" | "reviewed" | "archived",
      category: "pediatric" as const,
      clientName: "Leo Chen (Pediatric, 6y • Mom: Sarah)",
      submittedDate: "Oct 28, 2026",
      reviewedDate: "Oct 28, 2026",
      overallFeedback:
        "Fantastic progress, Leo! Sarah, his pincer grasp on the pegs showed wonderful isolated finger control with much less whole-hand raking. Great call on loosening the jar lid for step 3.",
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

  const programs = isDemo ? demoPrograms : [];

  const filtered = programs.filter((p) => {
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
          Program History & Clinician Reviews
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Review completed exercise sessions, clinician notes, and published overall feedback.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2">
        {(
          [
            { id: "all", label: "All Routines" },
            { id: "reviewed", label: "Reviewed by Therapist" },
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

      {/* History Items */}
      <div className="space-y-4">
        {filtered.map((item) => {
          const isExpanded = expandedCards[item.id] ?? false;

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
                    <Badge variant="emerald" statusText="Feedback Published" icon={<CheckCircle2 className="w-3 h-3" />} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      Submitted: {item.submittedDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                      Reviewed: {item.reviewedDate}
                    </span>
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
                  {/* Overall Published Feedback */}
                  <div className="rounded-xl border border-teal-500/40 bg-teal-950/20 p-4 space-y-2">
                    <span className="text-xs font-semibold text-teal-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <FileText className="w-4 h-4 text-teal-400" />
                      Dr. Elena Ramos Overall Feedback
                    </span>
                    <p className="text-xs text-zinc-200 leading-relaxed">
                      {item.overallFeedback}
                    </p>
                  </div>

                  {/* Step Specific Notes */}
                  <div className="space-y-3">
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

                          {/* Client submitted content */}
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

                          {/* Published Clinician Note */}
                          <div className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-3 text-xs text-teal-200 space-y-1">
                            <span className="text-[10px] font-semibold uppercase text-zinc-400 block">
                              Therapist Note:
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

        {filtered.length === 0 && (
          <Card className="border-dashed border-zinc-800 bg-zinc-900/60 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-950 border border-zinc-800 text-teal-400 mx-auto flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-100">No Routine History Yet</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                You haven&apos;t submitted any exercise routine sessions yet. Once you complete and submit a routine, your video recordings and clinician evaluations will be preserved here.
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
  );
}
