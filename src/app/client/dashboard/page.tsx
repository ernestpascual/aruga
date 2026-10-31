"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Play,
  CheckCircle2,
  Clock,
  Sparkles,
  Bot,
  Scan,
  MessageSquare,
  ArrowRight,
  Baby,
  GraduationCap,
  HeartPulse,
  User,
  Star,
  Award,
  Calendar,
  Flame,
  HeartHandshake,
  ShieldCheck,
  ChevronRight,
  UserPlus,
  AlertCircle,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/supabase/auth-context";
import { isDemoUser } from "@/lib/supabase/demo-helpers";
import { HomeProgram } from "@/types/database";

interface TherapistLinkData {
  linked: boolean;
  invitation_status: "pending" | "accepted" | "declined" | "unlinked";
  invitation_initiated_by?: "therapist" | "client";
  therapist: {
    id: string;
    display_name?: string;
    name?: string;
    discipline?: string;
    facility_name?: string;
    email?: string;
  } | null;
  patient?: any;
}

export default function ClientDashboardPage() {
  const { user, profile } = useAuth();
  const [activeProgram, setActiveProgram] = useState<HomeProgram | null>(null);
  const [loading, setLoading] = useState(true);

  // Clinician linking state
  const [linkData, setLinkData] = useState<TherapistLinkData | null>(null);
  const [respondingLink, setRespondingLink] = useState(false);
  const [inputTherapistEmail, setInputTherapistEmail] = useState("");
  const [clientStats, setClientStats] = useState({ streak: 0, stepsCompleted: 0, reviewsCount: 0, submissionsCount: 0 });
  const [requestingLink, setRequestingLink] = useState(false);
  const [cancellingLink, setCancellingLink] = useState(false);
  const [linkMessage, setLinkMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isDemo = isDemoUser(user, profile);
  const category = profile?.client_category || "adult";
  const isPedia = category === "pedia";
  const isAdolescent = category === "adolescent";
  const isOldPeople = category === "old_people";

  const fetchTherapistLink = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/client/therapist-link?clientUserId=${user.id}`);
      const data = await res.json();
      setLinkData(data);
    } catch (err) {
      console.warn("Failed to fetch therapist link:", err);
    }
  };

  useEffect(() => {
    fetchTherapistLink();

    if (user?.id && !isDemo) {
      fetch(`/api/client/submissions?clientUserId=${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.submissions && Array.isArray(data.submissions)) {
            const subs = data.submissions;
            const reviews = subs.filter((s: any) => s.state === "reviewed" || s.review);
            const totalSteps = subs.reduce(
              (acc: number, s: any) => acc + (Array.isArray(s.step_submissions) ? s.step_submissions.length : 0),
              0
            );
            setClientStats({
              streak: subs.length > 0 ? Math.min(subs.length, 7) : 0,
              stepsCompleted: totalSteps,
              reviewsCount: reviews.length,
              submissionsCount: subs.length,
            });
          }
        })
        .catch(() => {});
    }

    const handleRefresh = () => {
      fetchTherapistLink();
      if (user?.id && !isDemo) {
        fetch(`/api/client/submissions?clientUserId=${user.id}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.submissions && Array.isArray(data.submissions)) {
              const subs = data.submissions;
              const reviews = subs.filter((s: any) => s.state === "reviewed" || s.review);
              const totalSteps = subs.reduce(
                (acc: number, s: any) => acc + (Array.isArray(s.step_submissions) ? s.step_submissions.length : 0),
                0
              );
              setClientStats({
                streak: subs.length > 0 ? Math.min(subs.length, 7) : 0,
                stepsCompleted: totalSteps,
                reviewsCount: reviews.length,
                submissionsCount: subs.length,
              });
            }
          })
          .catch(() => {});
      }
    };
    window.addEventListener("aruga:notification-action", handleRefresh);
    return () => {
      window.removeEventListener("aruga:notification-action", handleRefresh);
    };
  }, [user?.id, isDemo]);

  const handleRespondInvitation = async (action: "accept" | "decline") => {
    if (!user?.id || respondingLink) return;
    setRespondingLink(true);
    setLinkMessage(null);
    try {
      const res = await fetch("/api/client/therapist-link", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientUserId: user.id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update connection.");
      setLinkMessage({ type: "success", text: data.message });
      window.dispatchEvent(new Event("aruga:notification-action"));
      await fetchTherapistLink();
    } catch (err: unknown) {
      setLinkMessage({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setRespondingLink(false);
    }
  };

  const handleRequestTherapistLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !inputTherapistEmail.trim() || requestingLink) return;
    setRequestingLink(true);
    setLinkMessage(null);
    try {
      const res = await fetch("/api/client/therapist-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientUserId: user.id, therapistEmail: inputTherapistEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send link request.");
      setLinkMessage({ type: "success", text: data.message });
      setInputTherapistEmail("");
      window.dispatchEvent(new Event("aruga:notification-action"));
      await fetchTherapistLink();
    } catch (err: unknown) {
      setLinkMessage({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setRequestingLink(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!user?.id || cancellingLink) return;
    setCancellingLink(true);
    setLinkMessage(null);
    try {
      const res = await fetch(`/api/client/therapist-link?clientUserId=${user.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel link request.");
      setLinkMessage({ type: "success", text: data.message || "Connection request canceled." });
      window.dispatchEvent(new Event("aruga:notification-action"));
      await fetchTherapistLink();
    } catch (err: unknown) {
      setLinkMessage({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setCancellingLink(false);
    }
  };

  useEffect(() => {
    // In live or demo mode, load client program
    const params = new URLSearchParams();
    if (user?.id) params.set("clientUserId", user.id);
    params.set("isDemo", isDemo ? "true" : "false");

    fetch(`/api/therapist/programs?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.programs && data.programs.length > 0) {
          const matched = isPedia
            ? data.programs.find((p: HomeProgram) => p.title.toLowerCase().includes("playful") || p.title.toLowerCase().includes("pincer")) || data.programs[0]
            : data.programs[0];
          setActiveProgram(matched);
        } else if (isDemo) {
          // Demo fallback
          setActiveProgram({
            id: isPedia ? "44444444-4444-4444-8444-444444444445" : "44444444-4444-4444-8444-444444444444",
            patient_id: isPedia ? "33333333-3333-4333-8333-333333333334" : "33333333-3333-4333-8333-333333333333",
            title: isPedia ? "Playful Pincer Grasp & Bilateral Toy Routine" : "Tabletop Grasp & Precision Release Routine",
            main_instructions: isPedia
              ? "Engage in 3 fun play exercises using dough, pegs, and containers to strengthen finger dexterity."
              : "Perform 3 structured tabletop repetitions focusing on smooth finger extension and controlled release.",
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as unknown as HomeProgram);
        } else {
          setActiveProgram(null);
        }
      })
      .catch(() => {
        if (!isDemo) setActiveProgram(null);
      })
      .finally(() => setLoading(false));
  }, [user?.id, isDemo, isPedia]);

  // Ensure any temporary credentials provided by therapist are purged upon client session
  useEffect(() => {
    if (user?.id && user?.email) {
      fetch("/api/auth/clear-temp-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          reason: "first_login",
        }),
      }).catch((err) => console.warn("Failed to clear temp credentials on dashboard:", err));
    }
  }, [user?.id, user?.email]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
      {/* Clinician Connection Status Banners */}
      {linkData?.invitation_status === "pending" && linkData?.invitation_initiated_by === "therapist" && (
        <div className="p-5 rounded-2xl border border-teal-500/40 bg-teal-950/30 backdrop-blur-sm shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-100">
                  Care Connection Invitation
                </h2>
                <Badge variant="amber" statusText="Action Required" icon={<Clock className="w-3 h-3" />} />
              </div>
              <p className="text-xs sm:text-sm text-zinc-300 mt-1">
                <strong>{linkData.therapist?.display_name || "Your Clinician"}</strong> ({linkData.therapist?.discipline || "OT"}) has invited you to link with their rehabilitation caseload. Accept to view your assigned exercises and submit video feedback.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
            <Button
              onClick={() => handleRespondInvitation("accept")}
              disabled={respondingLink}
              className="bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold gap-1.5 shadow-sm text-xs h-9"
            >
              <CheckCircle2 className="w-4 h-4" />
              Accept & Connect
            </Button>
            <Button
              variant="outline"
              onClick={() => handleRespondInvitation("decline")}
              disabled={respondingLink}
              className="border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs h-9"
            >
              Decline
            </Button>
          </div>
        </div>
      )}

      {linkData?.invitation_status === "pending" && linkData?.invitation_initiated_by === "client" && (
        <div className="p-5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-zinc-900 to-zinc-950 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-semibold text-zinc-100">
                  Care Connection Request Pending
                </h3>
                <Badge variant="amber" statusText="Awaiting Clinician Confirmation" icon={<Clock className="w-3 h-3" />} />
              </div>
              <p className="text-xs sm:text-sm text-zinc-300">
                Connection request sent to <strong>{linkData.therapist?.display_name || linkData.therapist?.name || "Occupational Therapist"}</strong>
                {linkData.therapist?.email || (linkData as any).pending_therapist_email ? (
                  <span className="text-amber-300/90 font-medium"> ({linkData.therapist?.email || (linkData as any).pending_therapist_email})</span>
                ) : null}
                . Once your clinician confirms in their caseload, your personalized home routines and video feedback will be activated.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelRequest}
              disabled={cancellingLink}
              className="border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs h-8"
            >
              {cancellingLink ? "Canceling..." : "Cancel Request"}
            </Button>
          </div>
        </div>
      )}

      {linkMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            linkMessage.type === "success"
              ? "bg-teal-950/40 border-teal-500/40 text-teal-200"
              : "bg-rose-950/40 border-rose-500/40 text-rose-200"
          }`}
        >
          {linkMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{linkMessage.text}</span>
        </div>
      )}
      {/* Top Welcome Card customized by Demographic */}
      <div className={`p-6 sm:p-8 rounded-2xl border shadow-xl relative overflow-hidden ${
        isPedia
          ? "bg-gradient-to-r from-zinc-900 via-amber-950/20 to-teal-950/40 border-amber-500/30"
          : isAdolescent
          ? "bg-gradient-to-r from-zinc-900 via-sky-950/20 to-teal-950/40 border-sky-500/30"
          : isOldPeople
          ? "bg-gradient-to-r from-zinc-900 via-amber-950/15 to-teal-950/40 border-amber-500/40"
          : "bg-gradient-to-r from-zinc-900 via-zinc-900 to-teal-950/40 border-zinc-800"
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="teal"
                icon={
                  isPedia ? (
                    <Baby className="w-3.5 h-3.5" />
                  ) : isAdolescent ? (
                    <GraduationCap className="w-3.5 h-3.5" />
                  ) : isOldPeople ? (
                    <HeartPulse className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <User className="w-3.5 h-3.5" />
                  )
                }
                statusText={
                  isPedia
                    ? "Pediatric Rehabilitation Portal"
                    : isAdolescent
                    ? "Adolescent Skill Building"
                    : isOldPeople
                    ? "Old People (55+) Independence Portal"
                    : "Adult Rehabilitation Portal"
                }
              />
              {isPedia && profile?.caregiver_name && (
                <span className="text-xs text-amber-300/90 font-medium">
                  Parent / Caregiver: {profile.caregiver_name}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
              {profile?.display_name
                ? isPedia
                  ? `Hi ${profile.display_name}! Ready for Fun Practice?`
                  : `Welcome back, ${profile.display_name}!`
                : isDemo
                ? isPedia
                  ? "Hi Leo! Ready for Fun Practice?"
                  : isAdolescent
                  ? "Welcome back, Maya!"
                  : isOldPeople
                  ? "Welcome back, Arthur!"
                  : "Welcome back, Marcus!"
                : "Welcome to your Care Portal"}
            </h1>

            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
              {isPedia
                ? "Complete today's play activities, record your fun milestones, and earn your daily therapy badge!"
                : isAdolescent
                ? "Track your daily fine-motor drills, school coordination tasks, and share progress videos with your therapist."
                : isOldPeople
                ? "Your specialized home program for joint mobility, fall risk reduction, and everyday living independence."
                : "Your personalized clinician-prescribed occupational therapy program designed for functional daily independence."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeProgram && (
              <Link href="/client">
                <Button className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold shadow-md">
                  <Play className="w-4 h-4 fill-zinc-950" />
                  {isPedia ? "Start Play Routine" : "Start Today's Exercises"}
                </Button>
              </Link>
            )}
            <Link href="/client/messages">
              <Button variant="secondary" className="gap-2 border-zinc-700 hover:border-teal-500/40">
                <MessageSquare className="w-4 h-4 text-teal-400" />
                Message Therapist
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Gamification / Progress Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Practice Streak */}
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400">Practice Streak</CardTitle>
            <Flame className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400 flex items-center gap-2">
              {isDemo ? "4 Days" : `${clientStats.streak} Days`}{" "}
              <span className="text-xs font-normal text-zinc-500">
                {isDemo
                  ? "🔥 In a row"
                  : clientStats.streak > 0
                  ? "Active streak"
                  : "Start today"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              {isDemo
                ? "Next milestone: 5 day star"
                : clientStats.streak > 0
                ? "Consistency supports recovery"
                : "Complete a routine to start streak"}
            </p>
          </CardContent>
        </Card>

        {/* Exercises Completed */}
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400">
              {isPedia ? "Play Tasks Mastered" : "Exercises Completed"}
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">
              {isDemo ? "12 Steps" : `${clientStats.stepsCompleted} Steps`}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              {isDemo
                ? "Supervised by Dr. Elena Ramos"
                : clientStats.stepsCompleted > 0
                ? "Recorded and submitted"
                : "Awaiting first session"}
            </p>
          </CardContent>
        </Card>

        {/* Reviews Received */}
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400">Therapist Feedback</CardTitle>
            <HeartHandshake className="w-4 h-4 text-teal-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-300">
              {isDemo
                ? "Reviewed"
                : clientStats.reviewsCount > 0
                ? `${clientStats.reviewsCount} Reviewed`
                : "Pending"}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              {isDemo
                ? "Feedback published on last video"
                : clientStats.reviewsCount > 0
                ? "Clinician feedback received"
                : "No clinician reviews yet"}
            </p>
          </CardContent>
        </Card>

        {/* Milestone or Stars */}
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400">
              {isPedia ? "Milestone Stars" : "Program Progress"}
            </CardTitle>
            {isPedia ? <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> : <Award className="w-4 h-4 text-teal-400" />}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">
              {isDemo
                ? isPedia
                  ? "⭐ 18 Stars"
                  : "85% Target"
                : isPedia
                ? `⭐ ${clientStats.submissionsCount * 3} Stars`
                : `${Math.min(clientStats.submissionsCount * 25, 100)}% Target`}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              {isDemo
                ? isPedia
                  ? "Great job this week!"
                  : "Upper extremity functional goal"
                : "Active therapy plan target"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Hub: Current Routine Card & Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Program Card */}
        <Card className="lg:col-span-2 bg-zinc-900/60 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-bold text-zinc-100">
                {isPedia ? "Today's Assigned Play Activity" : "Your Active Rehabilitation Routine"}
              </CardTitle>
              <p className="text-xs text-zinc-400">Prescribed by your occupational therapist</p>
            </div>
            {activeProgram && (
              <Link href="/client" className="text-xs text-teal-400 hover:underline flex items-center gap-1">
                Start Practice <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {activeProgram ? (
              <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-zinc-100">
                      {activeProgram.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      {activeProgram.main_instructions ||
                        "Follow each prescribed exercise step and submit short video clips for your clinician to review."}
                    </p>
                  </div>
                  <Badge variant="teal" statusText="Active Routine" />
                </div>

                {/* Steps overview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                  {activeProgram.steps && activeProgram.steps.length > 0 ? (
                    activeProgram.steps.slice(0, 3).map((st, idx) => (
                      <div key={st.id || idx} className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs">
                        <span className="font-semibold text-teal-400 block mb-0.5">Step {st.position || idx + 1}</span>
                        <span className="text-zinc-300 line-clamp-1">
                          {st.title || st.instructions || `Exercise Step ${idx + 1}`}
                        </span>
                      </div>
                    ))
                  ) : isDemo ? (
                    <>
                      <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs">
                        <span className="font-semibold text-teal-400 block mb-0.5">Step 1</span>
                        <span className="text-zinc-300 line-clamp-1">
                          {isPedia ? "Peg Pick & Color Sort" : "Cylinder Cup Grasp & Lift"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs">
                        <span className="font-semibold text-teal-400 block mb-0.5">Step 2</span>
                        <span className="text-zinc-300 line-clamp-1">
                          {isPedia ? "Clay Pinch & Squash" : "Block Stacking Sequence"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs">
                        <span className="font-semibold text-teal-400 block mb-0.5">Step 3</span>
                        <span className="text-zinc-300 line-clamp-1">
                          {isPedia ? "Twist-Top Container" : "Forearm Supination"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-3 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 text-center">
                      Follow each prescribed exercise step in your active routine.
                    </div>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">
                    {isPedia ? "Recommended: 15 min with parent" : "Recommended: 15 min daily session"}
                  </span>
                  <Link href="/client">
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold text-xs gap-1.5">
                      <Play className="w-3.5 h-3.5 fill-zinc-950" />
                      Open Exercises
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-zinc-950/70 border border-dashed border-zinc-800 space-y-3">
                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 text-teal-400 mx-auto flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-zinc-100">No Active Routine Assigned Yet</h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Your occupational therapist has not assigned a home exercise program yet. Once assigned, your routine exercises and practice instructions will appear here.
                  </p>
                </div>
                <div className="pt-2">
                  <Link href="/client/messages">
                    <Button variant="secondary" size="sm" className="gap-2 border-zinc-700 hover:border-teal-500/40 text-xs">
                      <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                      Message Your Therapist
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Quick Helper Tips */}
            <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/20 space-y-1">
              <div className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Therapist Note for Today:</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {isDemo
                  ? isPedia
                    ? "Encourage Leo to use thumb and pointer finger tip-to-tip. Take breaks if his hands get tired!"
                    : "Remember to keep your shoulder relaxed and elbow resting gently on the tabletop during forearm rotation."
                  : activeProgram
                  ? "Practice at a comfortable pace. Stop immediately if you experience pain or fatigue."
                  : "Once your clinician assigns your rehabilitation program, personalized daily reminders and precautions will appear here."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Tools & Assistants */}
        <div className="space-y-4">
          {/* Clinician Connection Card */}
          {linkData?.linked ? (
            <Card className="bg-teal-950/20 border-teal-500/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">
                    Care Team Clinician
                  </span>
                  <Badge variant="emerald" statusText="Active Care" icon={<CheckCircle2 className="w-3 h-3" />} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 font-bold shrink-0">
                    <ShieldCheck className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-100">
                      {linkData.therapist?.display_name || (isDemo ? "Dr. Elena Ramos, OTR/L" : "Assigned Clinician")}
                    </h4>
                    <p className="text-xs text-zinc-400">
                      {linkData.therapist?.discipline || "OT"}{linkData.therapist?.facility_name ? ` • ${linkData.therapist.facility_name}` : ""}
                    </p>
                  </div>
                </div>
                <Link href="/client/messages" className="block pt-1">
                  <Button variant="outline" size="sm" className="w-full border-teal-500/30 hover:bg-teal-950/40 text-teal-300 text-xs h-8 gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Message Clinician
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : linkData?.invitation_status === "pending" ? (
            <Card className="bg-gradient-to-b from-amber-950/30 to-zinc-900 border-amber-500/40">
              <CardContent className="p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                    Pending Connection
                  </span>
                  <Badge variant="amber" statusText="Pending" icon={<Clock className="w-3 h-3" />} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold shrink-0">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-100">
                      {linkData.therapist?.display_name || linkData.therapist?.name || "Occupational Therapist"}
                    </h4>
                    <p className="text-xs text-zinc-400">
                      {linkData.therapist?.email || (linkData as any).pending_therapist_email || "Pending Therapist"}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-zinc-300">
                  {linkData.invitation_initiated_by === "client"
                    ? "Connection request waiting for clinician approval in their caseload."
                    : "Clinician invited you to connect. Confirm above to start."}
                </p>

                {linkData.invitation_initiated_by === "client" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelRequest}
                    disabled={cancellingLink}
                    className="w-full border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs h-8"
                  >
                    {cancellingLink ? "Canceling..." : "Cancel Connection Request"}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRespondInvitation("accept")}
                      disabled={respondingLink}
                      className="flex-1 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold text-xs h-8"
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRespondInvitation("decline")}
                      disabled={respondingLink}
                      className="border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs h-8"
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-teal-400" />
                  Connect with your Clinician
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-zinc-400">
                  Have an occupational therapist? Enter their clinic email address to send a link request.
                </p>
                <form onSubmit={handleRequestTherapistLink} className="space-y-2">
                  <Input
                    type="email"
                    placeholder="therapist@aruga.health"
                    value={inputTherapistEmail}
                    onChange={(e) => setInputTherapistEmail(e.target.value)}
                    required
                    className="bg-zinc-950 border-zinc-800 text-xs h-9"
                  />
                  <Button
                    type="submit"
                    disabled={requestingLink || !inputTherapistEmail.trim()}
                    className="w-full bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs h-9"
                  >
                    {requestingLink ? "Sending..." : "Send Link Request"}
                  </Button>
                </form>

                {linkMessage && (
                  <div
                    className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                      linkMessage.type === "success"
                        ? "bg-teal-950/40 border-teal-500/40 text-teal-200"
                        : "bg-rose-950/40 border-rose-500/40 text-rose-200"
                    }`}
                  >
                    {linkMessage.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{linkMessage.text}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-zinc-100">Care Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/ask-ot" className="block p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-teal-500/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-950/80 text-teal-400 group-hover:scale-105 transition-transform">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-100 group-hover:text-teal-300 transition-colors">
                      Ask OT AI Helper
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Got questions about grip, postures, or daily tasks? Ask anytime.
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/sam-test" className="block p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-teal-500/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-950/80 text-teal-400 group-hover:scale-105 transition-transform">
                    <Scan className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-100 group-hover:text-teal-300 transition-colors">
                      Interactive Video Tracking
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Test SAM 3.1 video segmentation on your practice clips.
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/client/history" className="block p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-teal-500/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-950/80 text-teal-400 group-hover:scale-105 transition-transform">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-100 group-hover:text-teal-300 transition-colors">
                      Past Exercise History
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      View previous sessions and doctor review feedback notes.
                    </div>
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/60 border-zinc-800 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-semibold text-zinc-200">Private & Supervised</div>
                <p className="text-zinc-500 text-[11px]">
                  All practice recordings are shared solely with your licensed therapist.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
