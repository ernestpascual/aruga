"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/lib/supabase/auth-context";
import { isDemoUser } from "@/lib/supabase/demo-helpers";
import { HomeProgram } from "@/types/database";
import { DEMO_PROGRAM_ID, DEMO_PEDIATRIC_PROGRAM_ID } from "@/lib/supabase/mock-store";

export default function ClientHomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading home program...</div>}>
      <ClientHomeContent />
    </Suspense>
  );
}

function ClientHomeContent() {
  const { user, profile } = useAuth();
  const isDemo = isDemoUser(user, profile);

  const searchParams = useSearchParams();
  const initialMode = searchParams.get("demoPatient") === "pediatric" ? "pediatric" : "adult";
  const [selectedPersona, setSelectedPersona] = useState<"adult" | "pediatric">(initialMode);
  const [programs, setPrograms] = useState<HomeProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [participationStats, setParticipationStats] = useState({ submitted: 0, reviewed: 0 });

  useEffect(() => {
    const param = searchParams.get("demoPatient");
    if (param === "pediatric" || param === "adult") {
      setSelectedPersona(param);
    }
  }, [searchParams]);

  const isPediatric = isDemo
    ? selectedPersona === "pediatric"
    : profile?.client_category === "pedia";

  useEffect(() => {
    const params = new URLSearchParams();
    if (user?.id) params.set("clientUserId", user.id);
    params.set("isDemo", isDemo ? "true" : "false");

    fetch(`/api/therapist/programs?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.programs) {
          setPrograms(data.programs);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    if (!isDemo && user?.id) {
      fetch(`/api/client/submissions?clientUserId=${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.submissions && Array.isArray(data.submissions)) {
            const subs = data.submissions;
            const revs = subs.filter((s: any) => s.state === "reviewed" || s.review);
            setParticipationStats({ submitted: subs.length, reviewed: revs.length });
          }
        })
        .catch(() => {});
    }
  }, [user?.id, isDemo]);

  const activeAssignedProgram = programs.length > 0 ? programs[0] : null;

  return (
    <div className="space-y-6">
      {/* Persona Toggle Bar (Demonstration Switcher - only in Demo Bypass mode) */}
      {isDemo && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">Demonstration Persona:</span>
            <span>Switch client portal mode between adult and pediatric care.</span>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-zinc-950/80 border border-zinc-800">
            <button
              type="button"
              onClick={() => setSelectedPersona("adult")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                !isPediatric
                  ? "bg-zinc-800 text-teal-300 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Marcus Vance (Adult, 58y)</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPersona("pediatric")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                isPediatric
                  ? "bg-sky-950 text-sky-300 border border-sky-500/50 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Baby className="w-3.5 h-3.5 text-sky-400" />
              <span>Leo Chen (Pediatric, 6y)</span>
            </button>
          </div>
        </div>
      )}

      {/* Welcome & Assigned Therapist Card */}
      <Card className="border-zinc-800 bg-zinc-900/90 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">
                {profile?.display_name
                  ? isPediatric
                    ? `Welcome back, ${profile.display_name}${profile?.caregiver_name ? ` & ${profile.caregiver_name}` : ""}`
                    : `Welcome back, ${profile.display_name}`
                  : isDemo
                  ? isPediatric
                    ? "Welcome back, Leo & Sarah"
                    : "Welcome back, Marcus"
                  : "Welcome to your Rehabilitation Routine"}
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
              {isDemo
                ? isPediatric
                  ? "Here is Leo's therapist-assigned play routine with caregiver guidance."
                  : "Here is your clinician-assigned tabletop exercise plan for today."
                : activeAssignedProgram
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
                {isDemo ? "Dr. Elena Ramos, OTR/L" : profile?.clinician_name || "Supervising Clinician"}
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
            {isPediatric ? "Today's Play Routine" : "Current Home Routine"}
          </h2>
          {(isDemo || activeAssignedProgram) && (
            <Badge variant="teal" statusText="Assigned for Practice" />
          )}
        </div>

        {isDemo ? (
          <Card className={`p-5 relative overflow-hidden group transition-colors ${
            isPediatric
              ? "border-sky-500/40 bg-zinc-900/90 hover:border-sky-500"
              : "border-teal-500/40 bg-zinc-900/90 hover:border-teal-500"
          }`}>
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none ${
              isPediatric ? "bg-sky-500/10" : "bg-teal-500/5"
            }`} />

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-zinc-100 group-hover:text-teal-300 transition-colors">
                  {isPediatric
                    ? "Playful Pincer Grasp & Bilateral Toy Routine"
                    : "Tabletop Grasp & Precision Release Routine"}
                </h3>
                <span className="text-xs text-zinc-400 font-mono">3 Steps • ~5 mins</span>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
                {isPediatric
                  ? "Complete these 3 playful tabletop activities together with a parent or caregiver once daily. Practice gentle pincer grasp and bilateral hand engagement with colorful toys, recording a 10-20s video clip of each game."
                  : "Perform these 3 coordinated tabletop exercises once daily in a seated position with good posture. Keep the forearm supported on the table and record a short 10-20 second clip of each activity."}
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80">
                <div className="flex items-center gap-4 text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                    {isPediatric ? "Peg stacking & Play-Doh completed" : "Step 1 & 2 recorded"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    {isPediatric ? "Jar lid skipped (loosening needed)" : "Step 3 skipped (fatigue noted)"}
                  </span>
                </div>

                {/* Action Button */}
                <Link href={`/client/programs/${isPediatric ? DEMO_PEDIATRIC_PROGRAM_ID : DEMO_PROGRAM_ID}`}>
                  <Button className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold px-5">
                    <span>{isPediatric ? "Start Play Routine" : "Continue Routine"}</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ) : activeAssignedProgram ? (
          <Card className="p-5 relative overflow-hidden group transition-colors border-teal-500/40 bg-zinc-900/90 hover:border-teal-500">
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
                    <span>Start Routine</span>
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
              <h3 className="text-base font-bold text-zinc-100">No Routine Assigned Yet</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
                Your occupational therapist has not assigned an active home exercise routine to your profile yet. Once prescribed, your routine steps, video practice guides, and submission tools will appear here.
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
                {isDemo ? 1 : participationStats.submitted}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">Routines Submitted</div>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
              <div className="text-2xl font-bold text-zinc-100">
                {isDemo ? 1 : participationStats.reviewed}
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
              {isDemo
                ? isPediatric
                  ? "Have questions about Leo's exercises or need toy adjustments? Send a message directly to Dr. Elena Ramos."
                  : "Have questions about your exercises or experiencing discomfort? Send a message directly to Dr. Ramos with an attached routine reference."
                : "Have questions about your therapy plan or experiencing fatigue? Send a message directly to your occupational therapist."}
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
