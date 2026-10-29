"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Copy,
  MessageSquare,
  FileText,
  Calendar,
  AlertCircle,
  Eye,
  Send,
  Layers,
  Baby,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Patient, HomeProgram, Submission } from "@/types/database";
import {
  DEMO_PATIENT_ID,
  DEMO_PEDIATRIC_PATIENT_ID,
  DEMO_PROGRAM_ID,
  DEMO_PEDIATRIC_PROGRAM_ID,
  DEMO_SUBMISSION_ID,
  DEMO_PEDIATRIC_SUBMISSION_ID,
} from "@/lib/supabase/mock-store";

export default function TherapistClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading client...</div>}>
      <TherapistClientDetailContent params={params} />
    </React.Suspense>
  );
}

function TherapistClientDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const clientId = resolvedParams.id;

  const [client, setClient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/therapist/clients");
      const data = await res.json();
      if (data.clients) {
        const found = data.clients.find((c: Patient) => c.id === clientId) || data.clients[0];
        setClient(found);
      }
    } catch {
      // Fetch error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const isPediatric = (client?.age ?? (clientId === DEMO_PEDIATRIC_PATIENT_ID ? 6 : 58)) < 18;
  const programId = isPediatric ? DEMO_PEDIATRIC_PROGRAM_ID : DEMO_PROGRAM_ID;
  const submissionId = isPediatric ? DEMO_PEDIATRIC_SUBMISSION_ID : DEMO_SUBMISSION_ID;

  const handleDuplicate = async (progId: string) => {
    if (actionLoading) return;
    try {
      setActionLoading(`dup-${progId}`);
      const res = await fetch("/api/therapist/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate", programId: progId }),
      });
      const data = await res.json();
      if (res.ok && data.program) {
        router.push(`/therapist/clients/${clientId}/programs/new?duplicateId=${progId}`);
      }
    } catch {
      // Error
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/therapist/clients"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Clients
        </Link>
      </div>

      {/* Compact Client Header Card */}
      <Card className="border-zinc-800 bg-zinc-900/90 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold text-zinc-100">
                {client?.name || (isPediatric ? "Leo Chen" : "Marcus Vance")}
              </h1>

              {isPediatric ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950/80 border border-sky-500/40 text-sky-300">
                  <Baby className="w-3 h-3 text-sky-400" />
                  Pediatric ({client?.age || 6}y)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 border border-zinc-700/60 text-zinc-300">
                  <User className="w-3 h-3 text-zinc-400" />
                  Adult ({client?.age || 58}y)
                </span>
              )}

              <span className="text-xs text-zinc-400">
                • {client?.gender || "Male"}
              </span>

              <Badge variant="emerald" statusText="Active Care Relationship" />
            </div>

            <div className="text-xs text-zinc-400 space-y-0.5">
              <p>
                <span className="text-zinc-500 font-medium">Condition:</span>{" "}
                <span className="text-zinc-300 font-mono text-[11px]">
                  {client?.condition ||
                    (isPediatric
                      ? "Pediatric Bilateral Coordination Delay & Pincer Grasp Development"
                      : "Right ischemic CVA with upper extremity hemiparesis")}
                </span>
              </p>
              {client?.caregiver_name && (
                <p>
                  <span className="text-zinc-500 font-medium">Caregiver:</span>{" "}
                  <span className="text-sky-300 font-medium">{client.caregiver_name}</span>
                </p>
              )}
              <p>
                <span className="text-zinc-500 font-medium">Email:</span>{" "}
                <span className="text-zinc-300">
                  {client?.email || (isPediatric ? "leo.chen.demo@aruga-health.local" : "marcus.vance.demo@aruga-health.local")}
                </span>
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Link href={`/therapist/messages?patientId=${clientId}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                Message {isPediatric ? "Caregiver" : "Client"}
              </Button>
            </Link>

            <Link href={`/therapist/clients/${clientId}/programs/new`}>
              <Button size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs">
                <Plus className="w-4 h-4" />
                Create Home Program
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Home Programs Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-400" />
            Assigned & Draft Programs
          </h2>
          <span className="text-xs text-zinc-500 font-mono">1 Active Routine</span>
        </div>

        {/* Program Cards */}
        <div className="space-y-3">
          <Card className="border-zinc-800 bg-zinc-900/80 p-5 hover:border-zinc-700 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-semibold text-zinc-100">
                    {isPediatric
                      ? "Playful Pincer Grasp & Bilateral Toy Routine"
                      : "Tabletop Grasp & Precision Release Routine"}
                  </h3>
                  <Badge variant="teal" statusText="Assigned" />
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  {isPediatric
                    ? "Complete these 3 playful tabletop activities together with a parent or caregiver once daily. Practice gentle pincer grasp and bilateral hand engagement with colorful toys, recording a 10-20s video clip of each game."
                    : "Perform these 3 coordinated tabletop exercises once daily in a seated position with good posture. Keep the forearm supported on the table and record a short 10-20 second clip of each activity."}
                </p>

                <div className="flex items-center gap-4 text-[11px] text-zinc-500 pt-1">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-zinc-400" /> 3 Steps
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-zinc-400" /> Assigned Recently
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap sm:flex-col items-end gap-2 shrink-0">
                <Link href={`/therapist/submissions/${submissionId}`}>
                  <Button size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs">
                    <Eye className="w-3.5 h-3.5" />
                    Review Submission (1)
                  </Button>
                </Link>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDuplicate(programId)}
                  isLoading={actionLoading === `dup-${programId}`}
                  className="gap-1.5 text-xs text-zinc-300"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Duplicate
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
