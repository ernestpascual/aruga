"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import {
  Stethoscope,
  Play,
  Clock,
  CheckCircle2,
  Calendar,
  MessageSquare,
  Award,
  ChevronRight,
  Sparkles,
  Baby,
  User,
  HeartHandshake,
  Edit3,
  FileCheck,
  Video,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/lib/supabase/auth-context";
import { HomeProgram, Submission } from "@/types/database";

export default function ClientHomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading home program...</div>}>
      <ClientHomeContent />
    </Suspense>
  );
}

function ClientHomeContent() {
  const { user, profile } = useAuth();

  const [programs, setPrograms] = useState<HomeProgram[]>([]);
  const [submittedPrograms, setSubmittedPrograms] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [participationStats, setParticipationStats] = useState({ submitted: 0, reviewed: 0 });

  const isPediatric = profile?.client_category === "pedia";

  useEffect(() => {
    const params = new URLSearchParams();
    if (user?.id) params.set("clientUserId", user.id);
    params.set("isDemo", "false");

    fetch(`/api/therapist/programs?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.programs) {
          setPrograms(data.programs);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch client's submissions — no mock fallback; requires real DB
    const subParams = new URLSearchParams();
    if (user?.id) {
      subParams.set("clientUserId", user.id);
    } else {
      // No authenticated user — cannot fetch, show error via empty state
      setLoading(false);
      return;
    }

    fetch(`/api/client/submissions?${subParams.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.submissions && Array.isArray(data.submissions)) {
          const subs: Submission[] = data.submissions;
          const completedSubs = subs.filter(
            (s) => s.state === "submitted" || s.state === "reviewed"
          );
          setSubmittedPrograms(completedSubs);
          const revs = completedSubs.filter((s) => s.state === "reviewed" || s.review);
          setParticipationStats({ submitted: completedSubs.length, reviewed: revs.length });
        }
      })
      .catch(() => {});
  }, [user?.id, isPediatric]);

  const activeAssignedProgram = programs.length > 0 ? programs[0] : null;

  return (
    <div className="space-y-6">
      {/* Welcome & Assigned Therapist Card */}
      <Card className="border-zinc-800 bg-zinc-900/90 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-zinc-100 break-words">
                {profile?.display_name
                  ? isPediatric
                    ? `Welcome back, ${profile.display_name}${profile?.caregiver_name ? ` & ${profile.caregiver_name}` : ""}`
                    : `Welcome back, ${profile.display_name}`
                  : "Welcome to your Home Program"}
              </h1>
              {isPediatric ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-950/80 border border-sky-500/40 text-sky-300 flex items-center gap-1">
                  <Baby className="w-3 h-3 text-sky-400" />
                  Pediatric Care
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 border border-zinc-700/60 text-zinc-300 flex items-center gap-1">
                  <User className="w-3 h-3 text-zinc-400" />
                  Adult Rehab
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              {activeAssignedProgram
                ? "Here is your clinician-assigned exercise plan for today."
                : "Your personalized occupational therapy home program will appear below."}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-zinc-950/80 border border-zinc-800 p-2.5 rounded-xl">
            <div className="w-9 h-9 rounded-lg bg-teal-950/80 border border-teal-500/40 text-teal-400 flex items-center justify-center">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <p className="font-semibold text-zinc-200">
                {profile?.clinician_name || "Supervising Clinician"}
              </p>
              <p className="text-[11px] text-zinc-500">
                {isPediatric ? "Pediatric Occupational Therapist" : "Occupational Therapist"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Primary Next Action: Active Home Program */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
            <Play className="w-4 h-4 text-teal-400" />
            {isPediatric ? "Today's Home Program" : "Current Home Program"}
          </h2>

        </div>

        {activeAssignedProgram ? (
          <Card className="p-4 sm:p-5 relative overflow-hidden group transition-colors border-teal-500/40 bg-zinc-900/90 hover:border-teal-500">
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-zinc-100 group-hover:text-teal-300 transition-colors">
                  {activeAssignedProgram.title}
                </h3>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
                {activeAssignedProgram.main_instructions ||
                  "Follow your prescribed therapeutic steps and record short video clips for your clinician to review."}
              </p>

              <div className="pt-2 flex items-center justify-end border-t border-zinc-800/80">
                <Link href={`/client/programs/${activeAssignedProgram.id}`}>
                  <Button className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold px-5">
                    <span>Start Home Program</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="border-dashed border-zinc-800 bg-zinc-900/60 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-950 border border-zinc-800 text-teal-400 mx-auto flex items-center justify-center">
              <Play className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">No Home Program Assigned Yet</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
                Your occupational therapist has not assigned an active home program to your profile yet. Once prescribed, your home program steps, video practice guides, and submission tools will appear here.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/client/messages">
                <Button variant="secondary" size="sm" className="gap-2 border-zinc-700 hover:border-teal-500/40 text-xs">
                  <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                  Message Therapist
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>

      {/* All Submitted Home Programs Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-teal-400" />
              All Submitted Home Programs
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Review and edit any of your submitted home programs or scheduled practice sessions. Each scheduled date represents one submission.
            </p>
          </div>
          <Badge
            variant="teal"
            statusText={`${submittedPrograms.length} Submitted`}
          />
        </div>

        {submittedPrograms.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {submittedPrograms.map((sub) => {
              const programTitle =
                sub.program?.title || "Home Program";

              const isReviewed = sub.state === "reviewed" || Boolean(sub.review);
              const stepCount = sub.step_submissions?.length || 3;
              const videosCount = sub.step_submissions?.filter((ss) => ss.video_path)?.length || 2;
              const skippedCount = sub.step_submissions?.filter((ss) => ss.skipped)?.length || 1;

              return (
                <Card
                  key={sub.id}
                  className="p-4 border-zinc-800 bg-zinc-900/90 hover:border-zinc-700 transition-colors space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-zinc-100">
                          {programTitle}
                        </h3>
                        {sub.scheduled_date && (
                          <span className="flex items-center gap-1 text-[11px] font-mono text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-500/30">
                            <Calendar className="w-3 h-3" />
                            {sub.scheduled_date}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                        {sub.submitted_at && (
                          <span>Submitted: {new Date(sub.submitted_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        )}
                        <span>•</span>
                        <span>{stepCount} Steps ({videosCount} recorded{skippedCount > 0 ? `, ${skippedCount} skipped` : ""})</span>
                      </div>
                    </div>

                    <Badge
                      variant={isReviewed ? "teal" : "amber"}
                      statusText={isReviewed ? "Reviewed by Therapist" : "Pending Review"}
                      icon={isReviewed ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    />
                  </div>

                  {/* Clinician Review Preview if present */}
                  {isReviewed && sub.review?.overall_feedback && (
                    <div className="p-3 rounded-lg bg-teal-950/30 border border-teal-500/30 text-xs text-zinc-200 space-y-1">
                      <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider block">
                        Clinician Feedback:
                      </span>
                      <p className="line-clamp-2 leading-relaxed text-zinc-300">
                        &quot;{sub.review.overall_feedback}&quot;
                      </p>
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-zinc-800/60">
                    <span className="text-[11px] text-zinc-500">
                      {isReviewed
                        ? "Feedback published by therapist • Submission finalized"
                        : "Awaiting clinician review • You can edit submission"}
                    </span>

                    <div className="flex flex-col sm:flex-row flex-wrap items-center gap-2">
                      {!isReviewed && (
                        <Link
                          href={`/client/programs/${sub.program_id}?edit=true${sub.scheduled_date ? `&date=${sub.scheduled_date}` : ""}`}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-4 text-xs gap-2 text-xs text-amber-300 border-amber-500/40 hover:bg-amber-950/40 hover:border-amber-500"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Submission
                          </Button>
                        </Link>
                      )}

                      <Link
                        href={`/client/programs/${sub.program_id}${sub.scheduled_date ? `?date=${sub.scheduled_date}` : ""}`}
                      >
                        <Button
                          size="sm"
                          className="h-9 px-4 text-xs gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold text-xs"
                        >
                          <span>{isReviewed ? "View Feedback" : "View Details"}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center space-y-2">
            <FileCheck className="w-8 h-8 text-zinc-600 mx-auto" />
            <h4 className="text-xs font-semibold text-zinc-300">No Home Programs Submitted Yet</h4>
            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
              Once you practice your exercises and submit them to your therapist, your submissions will appear here with review statuses and editing options.
            </p>
          </Card>
        )}
      </div>

      {/* Grid: Participation Stats & Published Feedback */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Participation Statistics */}
        <Card className="border-zinc-800 bg-zinc-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Award className="w-4 h-4 text-teal-400" />
              Practice Participation
            </h3>
            <span className="text-[11px] text-zinc-500 font-mono">Verified Activities</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
              <div className="text-2xl font-bold text-teal-400">
                {participationStats.submitted}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">Home Programs Submitted</div>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
              <div className="text-2xl font-bold text-zinc-100">
                {participationStats.reviewed}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">Reviews Received</div>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Participation metrics measure home exercise engagement. Clinical progress is evaluated directly by your therapist.
          </p>
        </Card>

        {/* Message Clinician Quick Access */}
        <Card className="border-zinc-800 bg-zinc-900/80 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-teal-400" />
                Clinician Message Thread
              </h3>
              <span className="text-[10px] text-teal-400 font-medium">Active</span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Have questions about your therapy plan or experiencing fatigue? Send a message directly to your occupational therapist.
            </p>
          </div>

          <Link href="/client/messages">
            <Button variant="outline" className="w-full gap-2 text-xs text-zinc-200">
              <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
              Open Message Thread
            </Button>
          </Link>
        </Card>
      </div>

      {/* Safety & Medical Disclaimer */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 text-xs text-zinc-400 space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-zinc-300">
          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          <span>Patient & Family Notice</span>
        </div>
        <p className="leading-relaxed">
          {siteConfig.disclaimer} If discomfort, fatigue, or frustration occurs during practice, pause the activity immediately and note the reason on the step.
        </p>
      </div>
    </div>
  );
}
