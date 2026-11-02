"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  FileCheck2,
  Clock,
  Sparkles,
  Bot,
  Scan,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  Baby,
  GraduationCap,
  User,
  HeartPulse,
  ShieldCheck,
  PlusCircle,
  Stethoscope,
  UserPlus,
  CheckCircle2,
  X,
  Loader2,
  Link2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/supabase/auth-context";
import { Patient } from "@/types/database";

export default function TherapistDashboardPage() {
  const { user, profile } = useAuth();
  const [clients, setClients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ id: string; message: string; type: "success" | "error" } | null>(null);

  const fetchCaseload = React.useCallback(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const url = `/api/therapist/clients?therapistId=${user.id}&isDemo=false`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.clients) {
          setClients(data.clients);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    fetchCaseload();

    const handleRefresh = () => fetchCaseload();
    window.addEventListener("aruga:notification-action", handleRefresh);
    return () => {
      window.removeEventListener("aruga:notification-action", handleRefresh);
    };
  }, [fetchCaseload]);

  const handleLinkAction = async (clientId: string, action: "confirm" | "decline") => {
    if (approvingId) return;
    setApprovingId(clientId);
    setActionFeedback(null);

    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: clientId,
          action: action === "confirm" ? "approve" : "decline",
          role: "therapist",
          userId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update connection status.");

      setActionFeedback({
        id: clientId,
        message: action === "confirm" ? "Connection confirmed & approved!" : "Request declined.",
        type: "success",
      });

      // Dispatch global event so top navbar notification count updates
      window.dispatchEvent(new Event("aruga:notification-action"));

      setTimeout(() => {
        fetchCaseload();
        setActionFeedback(null);
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionFeedback({
        id: clientId,
        message: msg,
        type: "error",
      });
    } finally {
      setApprovingId(null);
    }
  };

  const geriatricCount = clients.filter(
    (c) => c.age >= 55 || c.client_category === "geriatric" || c.client_category === "old_people"
  ).length;
  const adultCount = clients.filter(
    (c) =>
      ((c.age >= 18 && c.age < 55) || c.client_category === "adult") &&
      c.age < 55 &&
      c.client_category !== "geriatric" &&
      c.client_category !== "old_people"
  ).length;
  const adolescentCount = clients.filter(
    (c) => (c.age >= 12 && c.age < 18) || c.client_category === "adolescent"
  ).length;
  const pediaCount = clients.filter(
    (c) => (c.age < 12 && c.age >= 1) || c.client_category === "pedia"
  ).length;

  const totalPrograms = clients.reduce((acc, c) => acc + (c.active_programs_count || 0), 0);
  const totalAwaiting = clients.reduce((acc, c) => acc + (c.awaiting_review_count || 0), 0);
  const pendingRequests = clients.filter((c) => c.invitation_status === "pending");

  return (
    <div className="w-full max-w-7xl mx-auto px-0 sm:px-0 py-2 sm:py-4 space-y-6 sm:space-y-8">
      {/* Welcome Hero Banner */}
      <div className="p-4 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-teal-950/40 border border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 sm:w-96 h-48 sm:h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 relative z-10">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="teal" icon={<Stethoscope className="w-3.5 h-3.5" />} statusText={profile?.discipline || "OTR/L"} />
              <span className="text-xs text-zinc-400">Clinical Dashboard</span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-zinc-100 leading-tight">
              Welcome, {profile?.display_name || "Doctor / Clinician"}
            </h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex lg:flex-wrap items-stretch sm:items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
            <Link href="/therapist/clients?action=link" className="w-full lg:w-auto">
              <Button variant="outline" className="w-full gap-2 border-teal-500/40 text-teal-300 hover:bg-teal-950/50 hover:text-teal-200 font-semibold shadow-md h-10 sm:h-9 text-xs justify-center">
                <Link2 className="w-4 h-4" />
                Link Client by Email
              </Button>
            </Link>
            <Link href="/therapist/clients" className="w-full lg:w-auto">
              <Button className="w-full gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold shadow-md h-10 sm:h-9 text-xs justify-center">
                <Users className="w-4 h-4" />
                Manage Caseload
              </Button>
            </Link>
            <Link href="/aruga-guide" className="w-full lg:w-auto">
              <Button variant="secondary" className="w-full gap-2 border-zinc-700 hover:border-teal-500/40 h-10 sm:h-9 text-xs justify-center">
                <Bot className="w-4 h-4 text-teal-400" />
                Ask Aruga Agent
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Pending requests now auto-activate on first login — no approve/decline UI. See "Pending Activation" pill in caseload. */}

      {/* Overview Stat Cards — even height + extra padding */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">
        <Card className="bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col h-full">
          <CardHeader className="flex flex-row items-center justify-between p-6 pb-4">
            <CardTitle className="text-xs font-medium text-zinc-400">Total Patients</CardTitle>
            <Users className="w-4 h-4 text-teal-400" />
          </CardHeader>
          <CardContent className="p-6 pt-0 flex-1 flex flex-col justify-center">
            <div className="text-2xl font-bold text-zinc-100">{clients.length}</div>
            <p className="text-[11px] text-zinc-500 mt-1.5">Across all care demographics</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col h-full">
          <CardHeader className="flex flex-row items-center justify-between p-6 pb-4">
            <CardTitle className="text-xs font-medium text-zinc-400">Pending Activation</CardTitle>
            <UserPlus className={`w-4 h-4 ${pendingRequests.length > 0 ? "text-amber-400" : "text-zinc-500"}`} />
          </CardHeader>
          <CardContent className="p-6 pt-0 flex-1 flex flex-col justify-center">
            <div className={`text-2xl font-bold ${pendingRequests.length > 0 ? "text-amber-400" : "text-zinc-100"}`}>
              {pendingRequests.length}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">
              {pendingRequests.length > 0 ? "Awaiting first login" : "No pending activations"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col h-full">
          <CardHeader className="flex flex-row items-center justify-between p-6 pb-4">
            <CardTitle className="text-xs font-medium text-zinc-400">Active Home Programs</CardTitle>
            <FileCheck2 className="w-4 h-4 text-teal-400" />
          </CardHeader>
          <CardContent className="p-6 pt-0 flex-1 flex flex-col justify-center">
            <div className="text-2xl font-bold text-zinc-100">{totalPrograms}</div>
            <p className="text-[11px] text-zinc-500 mt-1.5">Assigned exercises in progress</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col h-full">
          <CardHeader className="flex flex-row items-center justify-between p-6 pb-4">
            <CardTitle className="text-xs font-medium text-zinc-400">Pending Video Reviews</CardTitle>
            <Clock className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent className="p-6 pt-0 flex-1 flex flex-col justify-center">
            <div className="text-2xl font-bold text-amber-400">{totalAwaiting}</div>
            <p className="text-[11px] text-zinc-500 mt-1.5">Awaiting clinician sign-off</p>
          </CardContent>
        </Card>
      </div>

      {/* Lifespan Caseload Breakdown & Quick Hub — stretched to equal height */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Caseload Breakdown — extra padding + even */}
        <Card className="lg:col-span-2 bg-zinc-900/60 border-zinc-800 flex flex-col h-full">
          <CardHeader className="flex flex-row items-center justify-between p-6 pb-4">
            <div>
              <CardTitle className="text-sm font-bold text-zinc-100">Caseload by Demographic</CardTitle>
              <p className="text-xs text-zinc-400">Structured rehabilitation across the entire human lifespan</p>
            </div>
            <Link href="/therapist/clients" className="text-xs text-teal-400 hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0 flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Pediatric */}
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-teal-950/50 text-teal-400">
                    <Baby className="w-4 h-4" />
                  </div>
                  <span className="text-lg font-bold text-zinc-100">{pediaCount}</span>
                </div>
                <div className="text-xs font-semibold text-zinc-200">Pediatric (1-11)</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Play-based therapy, toys & caregiver co-activity</div>
              </div>

              {/* Adolescent */}
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-teal-950/50 text-teal-400">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <span className="text-lg font-bold text-zinc-100">{adolescentCount}</span>
                </div>
                <div className="text-xs font-semibold text-zinc-200">Adolescent (12-17)</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">School ergonomics, coordination & fine motor</div>
              </div>

              {/* Adult */}
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-teal-950/50 text-teal-400">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="text-lg font-bold text-zinc-100">{adultCount}</span>
                </div>
                <div className="text-xs font-semibold text-zinc-200">Adult (18-54)</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Neuro/stroke recovery & workplace ergonomics</div>
              </div>

              {/* Geriatrics */}
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-teal-950/50 text-teal-400">
                    <HeartPulse className="w-4 h-4" />
                  </div>
                  <span className="text-lg font-bold text-zinc-100">{geriatricCount}</span>
                </div>
                <div className="text-xs font-semibold text-zinc-200">Geriatrics (55+)</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Mobility, fall prevention & daily independence</div>
              </div>
            </div>

            {/* Recent Patients Table Preview */}
            <div className="space-y-2 pt-2">
              <div className="text-xs font-semibold text-zinc-400">Recent Caseload Records:</div>
              <div className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950/40">
                {clients.slice(0, 4).map((client) => (
                  <div key={client.id} className="p-3 flex items-center justify-between hover:bg-zinc-900/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 text-teal-300 font-bold text-xs flex items-center justify-center">
                        {client.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                          {client.name}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            {client.age < 12
                              ? "Pediatric"
                              : client.age < 18
                              ? "Adolescent"
                              : client.age < 55
                              ? "Adult"
                              : "Geriatrics (55+)"} ({client.age}y)
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400">{client.condition}</div>
                      </div>
                    </div>
                    <Link href={`/therapist/clients/${client.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs text-teal-400 hover:text-teal-300">
                        View Care Plan
                      </Button>
                    </Link>
                  </div>
                ))}
                {clients.length === 0 && (
                  <div className="p-4 text-center text-xs text-zinc-500">
                    No clients enrolled yet. Use the Clients page to register a new patient.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clinical Tools & Quick Access — even column */}
        <div className="flex flex-col gap-4 h-full">
          <Card className="bg-zinc-900/60 border-zinc-800 flex-1 flex flex-col">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-sm font-bold text-zinc-100">Clinical AI Assistants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-6 pt-0 flex-1">
              <Link href="/aruga-guide" className="block p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-teal-500/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-950/80 text-teal-400 group-hover:scale-105 transition-transform">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-100 group-hover:text-teal-300 transition-colors">
                      Ask OT Multi-Chat
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Query evidence-based clinical guidance, adaptive strategies, or exercise adaptations.
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
                      SAM 3.1 Video Test
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Track objects and fine-motor items across video frames with segmentation masks.
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/therapist/messages" className="block p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-teal-500/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-950/80 text-teal-400 group-hover:scale-105 transition-transform">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-100 group-hover:text-teal-300 transition-colors">
                      Patient Messages
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Direct 1-on-1 communication with patients or parents using @home-program citations.
                    </div>
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/60 border-zinc-800 p-6 flex flex-col justify-center">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-semibold text-zinc-200">Clinician Guardrails Active</div>
                <p className="text-zinc-500 text-[11px]">
                  All AI observations require clinician review and confirmation before being published to patients.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
