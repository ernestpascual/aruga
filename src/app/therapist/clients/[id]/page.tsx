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
  Layers,
  Baby,
  User,
  Edit3,
  Trash2,
  CheckCircle2,
  X,
  Archive,
  Check,
  HeartPulse,
  GraduationCap,
  ArrowRightLeft,
  Sparkles,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Patient, HomeProgram, ClientCategory, SoapNote } from "@/types/database";
import { SoapSummaryCard } from "@/components/ui/soap-summary-card";

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
  const isDemo =
    clientId === "33333333-3333-4333-8333-333333333333" ||
    clientId === "33333333-3333-4333-8333-333333333334" ||
    clientId.includes("demo");

  const [client, setClient] = useState<Patient | null>(null);
  const [programs, setPrograms] = useState<HomeProgram[]>([]);
  const [soapNotes, setSoapNotes] = useState<SoapNote[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [soapNotesLoading, setSoapNotesLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"programs" | "soap">("programs");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // SOAP Note Modal State
  const [isSoapModalOpen, setIsSoapModalOpen] = useState(false);
  const [editingSoapId, setEditingSoapId] = useState<string | null>(null);
  const [soapDate, setSoapDate] = useState("");
  const [soapTitle, setSoapTitle] = useState("");
  const [soapSubjective, setSoapSubjective] = useState("");
  const [soapObjective, setSoapObjective] = useState("");
  const [soapAssessment, setSoapAssessment] = useState("");
  const [soapPlan, setSoapPlan] = useState("");
  const [soapClientSummary, setSoapClientSummary] = useState("");
  const [soapSubmitting, setSoapSubmitting] = useState(false);
  const [generatingSoapSummary, setGeneratingSoapSummary] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState<number | "">("");
  const [editGender, setEditGender] = useState("Prefer not to say");
  const [editCondition, setEditCondition] = useState("");
  const [editCaregiver, setEditCaregiver] = useState("");
  const [editCategory, setEditCategory] = useState<ClientCategory>("adult");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Transfer Care Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTargetEmail, setTransferTargetEmail] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const handleTransferCare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferSubmitting || !transferTargetEmail.trim()) return;

    setTransferSubmitting(true);
    setTransferError(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/therapist/clients/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: clientId,
          targetTherapistEmail: transferTargetEmail.trim(),
          handoverNotes: transferNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to transfer client care.");
      }

      setSuccessMsg(data.message || "Client care transferred successfully.");
      setIsTransferModalOpen(false);
      setTransferTargetEmail("");
      setTransferNotes("");
      setTransferError(null);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTransferError(msg);
      setErrorMsg(msg);
    } finally {
      setTransferSubmitting(false);
    }
  };

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/therapist/clients?id=${clientId}`);
      const data = await res.json();
      if (data.client) {
        setClient(data.client);
        setEditName(data.client.name);
        setEditAge(data.client.age);
        setEditGender(data.client.gender || "Prefer not to say");
        setEditCondition(data.client.condition);
        setEditCaregiver(data.client.caregiver_name || "");
        setEditCategory(data.client.client_category || (data.client.age < 12 ? "pedia" : data.client.age < 18 ? "adolescent" : data.client.age < 55 ? "adult" : "old_people"));
      } else if (data.clients && data.clients.length > 0) {
        const found = data.clients.find((c: Patient) => c.id === clientId);
        if (found) {
          setClient(found);
          setEditName(found.name);
          setEditAge(found.age);
          setEditGender(found.gender || "Prefer not to say");
          setEditCondition(found.condition);
          setEditCaregiver(found.caregiver_name || "");
          setEditCategory(found.client_category || (found.age < 12 ? "pedia" : found.age < 18 ? "adolescent" : found.age < 55 ? "adult" : "old_people"));
        } else {
          setClient(null);
        }
      } else {
        setClient(null);
      }
    } catch (err) {
      console.warn("Failed to fetch client details:", err);
    }
  };

  const fetchPrograms = async () => {
    try {
      const res = await fetch(`/api/therapist/programs?patientId=${clientId}`);
      const data = await res.json();
      if (data.programs) {
        setPrograms(data.programs);
      }
    } catch (err) {
      console.warn("Failed to fetch programs:", err);
    } finally {
      setProgramsLoading(false);
    }
  };

  const fetchSoapNotes = async () => {
    try {
      const res = await fetch(`/api/therapist/soap-notes?patientId=${clientId}&isDemo=true`);
      const data = await res.json();
      if (data.soapNotes) {
        setSoapNotes(data.soapNotes);
      }
    } catch (err) {
      console.warn("Failed to fetch SOAP notes:", err);
    } finally {
      setSoapNotesLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadClientData() {
      try {
        const [clientRes, progRes, soapRes] = await Promise.all([
          fetch(`/api/therapist/clients?id=${clientId}`),
          fetch(`/api/therapist/programs?patientId=${clientId}`),
          fetch(`/api/therapist/soap-notes?patientId=${clientId}&isDemo=true`),
        ]);
        const clientData = await clientRes.json();
        const progData = await progRes.json();
        const soapData = await soapRes.json();

        if (!isMounted) return;

        if (clientData.client) {
          setClient(clientData.client);
          setEditName(clientData.client.name);
          setEditAge(clientData.client.age);
          setEditGender(clientData.client.gender || "Prefer not to say");
          setEditCondition(clientData.client.condition);
          setEditCaregiver(clientData.client.caregiver_name || "");
          setEditCategory(clientData.client.client_category || (clientData.client.age < 12 ? "pedia" : clientData.client.age < 18 ? "adolescent" : clientData.client.age < 55 ? "adult" : "old_people"));
        } else if (clientData.clients && clientData.clients.length > 0) {
          const found = clientData.clients.find((c: Patient) => c.id === clientId);
          if (found) {
            setClient(found);
            setEditName(found.name);
            setEditAge(found.age);
            setEditGender(found.gender || "Prefer not to say");
            setEditCondition(found.condition);
            setEditCaregiver(found.caregiver_name || "");
            setEditCategory(found.client_category || (found.age < 12 ? "pedia" : found.age < 18 ? "adolescent" : found.age < 55 ? "adult" : "old_people"));
          }
        }

        if (progData.programs) {
          setPrograms(progData.programs);
        }

        if (soapData.soapNotes) {
          setSoapNotes(soapData.soapNotes);
        }
      } catch (err) {
        console.warn("Failed to load client details:", err);
      } finally {
        if (isMounted) {
          setProgramsLoading(false);
          setSoapNotesLoading(false);
        }
      }
    }

    loadClientData();

    return () => {
      isMounted = false;
    };
  }, [clientId]);

  // Open New SOAP Modal
  const handleOpenNewSoapModal = () => {
    setEditingSoapId(null);
    setSoapDate(new Date().toISOString().slice(0, 10));
    setSoapTitle(`Live Tele-Rehab Session #${soapNotes.length + 1}`);
    setSoapSubjective("");
    setSoapObjective("");
    setSoapAssessment("");
    setSoapPlan("");
    setSoapClientSummary("");
    setIsSoapModalOpen(true);
  };

  // Open Edit SOAP Modal
  const handleOpenEditSoapModal = (note: SoapNote) => {
    setEditingSoapId(note.id);
    setSoapDate(new Date(note.session_date).toISOString().slice(0, 10));
    setSoapTitle(note.session_title);
    setSoapSubjective(note.subjective);
    setSoapObjective(note.objective);
    setSoapAssessment(note.assessment);
    setSoapPlan(note.plan);
    setSoapClientSummary(note.client_summary);
    setIsSoapModalOpen(true);
  };

  const handleAiGenerateSoapSummary = async () => {
    setGeneratingSoapSummary(true);
    try {
      const res = await fetch("/api/ai/soap-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "soap_note",
          targetId: editingSoapId || undefined,
          subjective: soapSubjective,
          objective: soapObjective,
          assessment: soapAssessment,
          plan: soapPlan,
          clientName: client?.name,
          isDemo,
        }),
      });
      const data = await res.json();
      if (data.summary) {
        setSoapClientSummary(data.summary);
      }
    } catch (err) {
      console.warn("Could not generate summary:", err);
    } finally {
      setGeneratingSoapSummary(false);
    }
  };

  // Save SOAP Note (POST / PATCH)
  const handleSaveSoapNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (soapSubmitting) return;

    setSoapSubmitting(true);
    setErrorMsg(null);

    try {
      const isEditing = Boolean(editingSoapId);
      const method = isEditing ? "PATCH" : "POST";
      const payload: Record<string, unknown> = {
        patientId: clientId,
        sessionDate: new Date(soapDate || Date.now()).toISOString(),
        sessionTitle: soapTitle.trim() || "Live Clinical Session Note",
        subjective: soapSubjective.trim(),
        objective: soapObjective.trim(),
        assessment: soapAssessment.trim(),
        plan: soapPlan.trim(),
        clientSummary: soapClientSummary.trim(),
      };
      if (isEditing) {
        payload.id = editingSoapId;
      }

      const res = await fetch("/api/therapist/soap-notes", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save SOAP note.");
      }

      setSuccessMsg(isEditing ? "SOAP note updated successfully!" : "New live session SOAP note created!");
      setTimeout(() => setSuccessMsg(null), 3000);
      setIsSoapModalOpen(false);
      await fetchSoapNotes();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSoapSubmitting(false);
    }
  };

  // Delete SOAP Note
  const handleDeleteSoapNote = async (noteId: string) => {
    if (!confirm("Are you sure you want to permanently delete this live session SOAP note?")) return;

    try {
      setActionLoading(`del-soap-${noteId}`);
      const res = await fetch(`/api/therapist/soap-notes?id=${noteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSuccessMsg("Session SOAP note deleted.");
        setTimeout(() => setSuccessMsg(null), 3000);
        await fetchSoapNotes();
      }
    } catch (err) {
      console.warn("Failed to delete SOAP note:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Edit Client Submit (PATCH)
  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editSubmitting || !editName.trim() || !editCondition.trim()) return;

    setEditSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/therapist/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: clientId,
          name: editName.trim(),
          age: Number(editAge) || 1,
          gender: editGender,
          condition: editCondition.trim(),
          caregiverName: editCaregiver.trim() || null,
          clientCategory: editCategory,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update client details.");
      }

      setClient(data.client);
      setIsEditModalOpen(false);
      setSuccessMsg("Client profile updated successfully in Supabase!");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setEditSubmitting(false);
    }
  };

  // Delete Client Submit (DELETE)
  const handleDeleteClient = async () => {
    if (deleteSubmitting) return;
    setDeleteSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/therapist/clients?id=${clientId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete client.");
      }

      router.push("/therapist/clients");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setDeleteSubmitting(false);
      setIsDeleteModalOpen(false);
    }
  };

  // Duplicate Program
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
        setSuccessMsg("Program duplicated as a draft!");
        setTimeout(() => setSuccessMsg(null), 3000);
        await fetchPrograms();
      }
    } catch (err) {
      console.warn("Failed to duplicate program:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Assign Program
  const handleAssignProgram = async (progId: string) => {
    if (actionLoading) return;
    try {
      setActionLoading(`assign-${progId}`);
      const res = await fetch("/api/therapist/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", programId: progId }),
      });
      if (res.ok) {
        setSuccessMsg("Program assigned to client!");
        setTimeout(() => setSuccessMsg(null), 3000);
        await fetchPrograms();
      }
    } catch (err) {
      console.warn("Failed to assign program:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Archive Program
  const handleArchiveProgram = async (progId: string) => {
    if (actionLoading) return;
    try {
      setActionLoading(`archive-${progId}`);
      const res = await fetch("/api/therapist/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", programId: progId }),
      });
      if (res.ok) {
        setSuccessMsg("Program archived.");
        setTimeout(() => setSuccessMsg(null), 3000);
        await fetchPrograms();
      }
    } catch (err) {
      console.warn("Failed to archive program:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Delete Program
  const handleDeleteProgram = async (progId: string) => {
    if (actionLoading) return;
    const confirmDelete = window.confirm("Are you sure you want to permanently delete this home program?");
    if (!confirmDelete) return;

    try {
      setActionLoading(`del-${progId}`);
      const res = await fetch(`/api/therapist/programs?id=${progId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSuccessMsg("Home program deleted from database.");
        setTimeout(() => setSuccessMsg(null), 3000);
        await fetchPrograms();
      }
    } catch (err) {
      console.warn("Failed to delete program:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const isPediatric = client?.client_category === "pedia" || (client?.age != null && client.age < 12);
  const isAdolescent = client?.client_category === "adolescent" || (client?.age != null && client.age >= 12 && client.age < 18);
  const isOldPeople = client?.client_category === "old_people" || (client?.age != null && client.age >= 55);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          href="/therapist/clients"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Clients
        </Link>

        {/* Global Feedback Messages */}
        {successMsg && (
          <div className="text-xs font-medium text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 px-3 py-1 rounded-md flex items-center gap-1.5 animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="text-xs font-medium text-rose-400 bg-rose-950/70 border border-rose-800/80 px-3 py-1 rounded-md flex items-center gap-1.5 animate-fadeIn">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            {errorMsg}
          </div>
        )}
      </div>

      {/* Client Header Card */}
      <Card className="border-zinc-800 bg-zinc-900/90 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold text-zinc-100">
                {client?.name || "Client Details"}
              </h1>

              {isPediatric ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950/80 border border-sky-500/40 text-sky-300">
                  <Baby className="w-3 h-3 text-sky-400" />
                  Pediatric ({client?.age}y)
                </span>
              ) : isAdolescent ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950/80 border border-indigo-500/40 text-indigo-300">
                  <GraduationCap className="w-3 h-3 text-indigo-400" />
                  Adolescent ({client?.age}y)
                </span>
              ) : isOldPeople ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 border border-amber-500/40 text-amber-300">
                  <HeartPulse className="w-3 h-3 text-amber-400" />
                  Senior ({client?.age}y)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 border border-zinc-700/60 text-zinc-300">
                  <User className="w-3 h-3 text-zinc-400" />
                  Adult ({client?.age}y)
                </span>
              )}

              <span className="text-xs text-zinc-400">
                • {client?.gender || "Not specified"}
              </span>

              <Badge variant="emerald" statusText="Active Caseload" />
            </div>

            <div className="text-xs text-zinc-400 space-y-0.5">
              <p>
                <span className="text-zinc-500 font-medium">Condition:</span>{" "}
                <span className="text-zinc-300 font-mono text-[11px]">
                  {client?.condition || "Occupational Rehabilitation"}
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
                <span className="text-zinc-300">{client?.email || "No email"}</span>
              </p>
              {client?.handover_notes && (
                <div className="mt-2 p-2.5 rounded-lg bg-sky-950/30 border border-sky-800/40 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-sky-400 font-semibold text-[11px]">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Clinical Handover Note from Previous Clinician:</span>
                  </div>
                  <p className="text-zinc-300 italic">{client.handover_notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions (CRUD Controls) */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              className="gap-1.5 text-xs text-zinc-300 border-zinc-700 hover:bg-zinc-800"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              Edit Client
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTransferModalOpen(true)}
              className="gap-1.5 text-xs text-sky-300 border-sky-800/60 hover:bg-sky-950/40"
              title="Transfer client care and exercise history to a colleague clinician"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
              Transfer Care
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(true)}
              className="gap-1.5 text-xs text-rose-300 border-rose-900/50 hover:bg-rose-950/40"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              Delete Client
            </Button>

            <Link href={`/therapist/messages?patientId=${clientId}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                Message
              </Button>
            </Link>

            <Link href={`/therapist/clients/${clientId}/programs/new`}>
              <Button size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs">
                <Plus className="w-4 h-4" />
                Create Program
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Content Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("programs")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === "programs"
              ? "bg-teal-950/80 border border-teal-500/40 text-teal-300"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-teal-400" />
          <span>Assigned Home Programs</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
            {programs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("soap")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === "soap"
              ? "bg-teal-950/80 border border-teal-500/40 text-teal-300"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-teal-400" />
          <span>Live Session SOAP Notes</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
            {soapNotes.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Home Programs Section */}
      {activeTab === "programs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-400" />
              Assigned & Draft Programs ({programs.length})
            </h2>
            <span className="text-xs text-zinc-500 font-mono">
              {programs.filter((p) => p.status === "assigned").length} Active Routines
            </span>
          </div>

        {programsLoading ? (
          <div className="p-8 text-center text-zinc-500 bg-zinc-900/40 rounded-xl border border-zinc-800">
            Loading assigned programs from Supabase...
          </div>
        ) : programs.length === 0 ? (
          <Card className="border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center space-y-3">
            <Layers className="w-10 h-10 text-zinc-600 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-300">No home programs created yet</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Design a customized rehabilitation exercise sequence with target objects for this client.
            </p>
            <Link href={`/therapist/clients/${clientId}/programs/new`}>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs gap-1.5">
                <Plus className="w-4 h-4" />
                Create First Program
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {programs.map((prog) => {
              const stepCount = prog.steps?.length || 0;
              const isAssigned = prog.status === "assigned";
              const isDraft = prog.status === "draft";
              const isArchived = prog.status === "archived";

              return (
                <Card
                  key={prog.id}
                  className="border-zinc-800 bg-zinc-900/80 p-5 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 max-w-2xl">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-semibold text-zinc-100">
                          {prog.title}
                        </h3>
                        {isAssigned && <Badge variant="teal" statusText="Assigned" />}
                        {isDraft && <Badge variant="amber" statusText="Draft" />}
                        {isArchived && <Badge variant="outline" statusText="Archived" />}
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                        {prog.main_instructions}
                      </p>

                      <div className="flex items-center gap-4 text-[11px] text-zinc-500 pt-1">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-zinc-400" /> {stepCount} Steps
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-400" />
                          {new Date(prog.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Program Actions */}
                    <div className="flex flex-wrap sm:flex-col items-end gap-2 shrink-0">
                      {isDraft && (
                        <Button
                          size="sm"
                          onClick={() => handleAssignProgram(prog.id)}
                          isLoading={actionLoading === `assign-${prog.id}`}
                          className="gap-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Assign Program
                        </Button>
                      )}

                      {isAssigned && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleArchiveProgram(prog.id)}
                          isLoading={actionLoading === `archive-${prog.id}`}
                          className="gap-1.5 text-xs text-zinc-300 border-zinc-700 hover:bg-zinc-800"
                        >
                          <Archive className="w-3.5 h-3.5 text-zinc-400" />
                          Archive
                        </Button>
                      )}

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicate(prog.id)}
                          isLoading={actionLoading === `dup-${prog.id}`}
                          className="gap-1.5 text-xs text-zinc-300 border-zinc-800 hover:bg-zinc-800"
                        >
                          <Copy className="w-3.5 h-3.5 text-zinc-400" />
                          Duplicate
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProgram(prog.id)}
                          isLoading={actionLoading === `del-${prog.id}`}
                          className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 p-2 h-8"
                          title="Delete program"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Tab 2: Live Session SOAP Notes Section */}
      {activeTab === "soap" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-400" />
                Live Session Clinical Documentation (SOAP Notes)
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Record structured live therapy sessions with 4 distinct clinical boxes (Subjective, Objective, Assessment, Plan) and plain-English client summaries.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleOpenNewSoapModal}
              className="gap-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              New Session SOAP Note
            </Button>
          </div>

          {soapNotesLoading ? (
            <div className="p-8 text-center text-zinc-500 bg-zinc-900/40 rounded-xl border border-zinc-800">
              Loading live session documentation...
            </div>
          ) : soapNotes.length === 0 ? (
            <Card className="border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center space-y-3">
              <FileText className="w-10 h-10 text-zinc-600 mx-auto" />
              <h3 className="text-sm font-semibold text-zinc-300">No live session notes documented yet</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Create structured SOAP documentation for synchronous tele-rehab or clinic visits with this client.
              </p>
              <Button
                size="sm"
                onClick={handleOpenNewSoapModal}
                className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Create First SOAP Note
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {soapNotes.map((note) => (
                <Card
                  key={note.id}
                  className="border-zinc-800 bg-zinc-900/90 p-5 space-y-4 hover:border-zinc-700/80 transition-colors shadow-sm"
                >
                  {/* Top Bar of Note */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-bold text-zinc-100">
                          {note.session_title}
                        </h3>
                        <Badge variant="teal" statusText="Live Session Note" icon={<Clock className="w-3 h-3 text-teal-400" />} />
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                          Session Date: {new Date(note.session_date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span>•</span>
                        <span>
                          Clinician: {note.therapist_profile?.display_name || "Dr. Elena Ramos, OTR/L"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditSoapModal(note)}
                        className="text-xs border-zinc-700 text-zinc-300 hover:text-teal-300 gap-1.5 h-8"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit Note
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSoapNote(note.id)}
                        isLoading={actionLoading === `del-soap-${note.id}`}
                        className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 p-2 h-8"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* 4 Distinct SOAP Textarea Boxes in 2x2 Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* S: Subjective */}
                    <div className="rounded-xl border border-sky-900/40 bg-zinc-950/60 p-3.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                        <span className="w-4 h-4 rounded-full bg-sky-950 border border-sky-500/40 text-[10px] flex items-center justify-center font-mono">S</span>
                        Subjective
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {note.subjective || "No subjective notes recorded."}
                      </p>
                    </div>

                    {/* O: Objective */}
                    <div className="rounded-xl border border-teal-900/40 bg-zinc-950/60 p-3.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-teal-400">
                        <span className="w-4 h-4 rounded-full bg-teal-950 border border-teal-500/40 text-[10px] flex items-center justify-center font-mono">O</span>
                        Objective
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {note.objective || "No objective measurements recorded."}
                      </p>
                    </div>

                    {/* A: Assessment */}
                    <div className="rounded-xl border border-amber-900/40 bg-zinc-950/60 p-3.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                        <span className="w-4 h-4 rounded-full bg-amber-950 border border-amber-500/40 text-[10px] flex items-center justify-center font-mono">A</span>
                        Assessment
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {note.assessment || "No clinical assessment recorded."}
                      </p>
                    </div>

                    {/* P: Plan */}
                    <div className="rounded-xl border border-indigo-900/40 bg-zinc-950/60 p-3.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
                        <span className="w-4 h-4 rounded-full bg-indigo-950 border border-indigo-500/40 text-[10px] flex items-center justify-center font-mono">P</span>
                        Plan
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {note.plan || "No plan recorded."}
                      </p>
                    </div>
                  </div>

                  {/* Summary for Client & Family (Plain English) with On-Demand Reveal & DB Cache */}
                  <SoapSummaryCard
                    targetType="soap_note"
                    targetId={note.id}
                    initialSummary={note.client_summary}
                    subjective={note.subjective}
                    objective={note.objective}
                    assessment={note.assessment}
                    plan={note.plan}
                    clientName={client?.name}
                    isDemo={isDemo}
                  />
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EDIT CLIENT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-zinc-800 bg-zinc-900 shadow-2xl animate-in fade-in zoom-in-95">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
              <CardTitle className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-teal-400" />
                Edit Client Record
              </CardTitle>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleUpdateClient} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Client Full Name *</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="bg-zinc-950 border-zinc-800 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">Age *</label>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={editAge}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : "";
                        setEditAge(val);
                        if (typeof val === "number") {
                          if (val < 12) setEditCategory("pedia");
                          else if (val < 18) setEditCategory("adolescent");
                          else if (val < 55) setEditCategory("adult");
                          else setEditCategory("old_people");
                        }
                      }}
                      required
                      className="bg-zinc-950 border-zinc-800 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">Demographic Tier</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as ClientCategory)}
                      className="w-full h-9 rounded-md bg-zinc-950 border border-zinc-800 px-3 text-xs text-zinc-200"
                    >
                      <option value="pedia">Pediatric (&lt;12y)</option>
                      <option value="adolescent">Adolescent (12-17y)</option>
                      <option value="adult">Adult (18-54y)</option>
                      <option value="old_people">Senior (55y+)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Gender</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="w-full h-9 rounded-md bg-zinc-950 border border-zinc-800 px-3 text-xs text-zinc-200"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Primary Condition *</label>
                  <Textarea
                    value={editCondition}
                    onChange={(e) => setEditCondition(e.target.value)}
                    rows={2}
                    required
                    className="bg-zinc-950 border-zinc-800 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">
                    Caregiver Name {editCategory === "pedia" && "(Recommended for Pedia)"}
                  </label>
                  <Input
                    value={editCaregiver}
                    onChange={(e) => setEditCaregiver(e.target.value)}
                    placeholder="e.g. Guardian Name (Relationship)"
                    className="bg-zinc-950 border-zinc-800 text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditModalOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={editSubmitting}
                    className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DELETE CLIENT CONFIRMATION MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-rose-900/60 bg-zinc-900 shadow-2xl">
            <CardHeader className="border-b border-zinc-800 pb-3">
              <CardTitle className="text-base font-bold text-rose-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                Confirm Client Deletion
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs text-zinc-300">
              <p>
                Are you sure you want to permanently delete{" "}
                <span className="font-semibold text-zinc-100">{client?.name}</span> from Supabase?
              </p>
              <p className="text-zinc-400 bg-rose-950/30 border border-rose-900/40 p-3 rounded-lg text-[11px] leading-relaxed">
                This will delete the patient record, assigned home programs, client exercise submissions, and chat history. This action cannot be undone.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleDeleteClient}
                  isLoading={deleteSubmitting}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs"
                >
                  Permanently Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TRANSFER CARE / TRANSFER SERVICE MODAL */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-sky-900/60 bg-zinc-900 shadow-2xl">
            <CardHeader className="border-b border-zinc-800 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-sky-400 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-sky-400" />
                Transfer Service / Transfer Care
              </CardTitle>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleTransferCare} className="space-y-4">
                {transferError && (
                  <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-start gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{transferError}</span>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-sky-950/20 border border-sky-900/40 text-xs text-sky-200/90 leading-relaxed">
                  Transfer care of <span className="font-semibold text-white">{client?.name}</span> to a licensed colleague clinician on Aruga.
                  All assigned home programs, rehabilitation history, and client submissions will transfer seamlessly.
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">
                    Colleague Clinician Email <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    type="email"
                    required
                    placeholder="colleague.therapist@clinic.com"
                    value={transferTargetEmail}
                    onChange={(e) => setTransferTargetEmail(e.target.value)}
                    className="bg-zinc-800/80 border-zinc-700 text-xs"
                  />
                  <p className="text-[11px] text-zinc-500">
                    The colleague clinician must have an active Aruga account or be registered in the system.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">
                    Handover Notes & Continuity Protocol <span className="text-zinc-500 font-normal">(Optional)</span>
                  </label>
                  <Textarea
                    rows={4}
                    placeholder="Detail current clinical milestones, contraindications, ongoing treatment focus, or specific reasons for transfer..."
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="bg-zinc-800/80 border-zinc-700 text-xs resize-none"
                  />
                  <p className="text-[11px] text-zinc-500">
                    These notes will be pinned to the client&apos;s chart and visible to the receiving clinician.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={transferSubmitting}
                    disabled={!transferTargetEmail.trim()}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs gap-1.5"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Confirm Transfer
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CREATE / EDIT SOAP NOTE MODAL */}
      {isSoapModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl border-zinc-800 bg-zinc-900 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-400" />
                  {editingSoapId ? "Edit Live Session SOAP Note" : "New Live Session SOAP Note"}
                </CardTitle>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Client: <span className="font-semibold text-zinc-200">{client?.name}</span> • 4 Clinical SOAP Boxes + Easy Summary
                </p>
              </div>
              <button
                onClick={() => setIsSoapModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSaveSoapNote} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Session Date *</label>
                    <Input
                      type="date"
                      value={soapDate}
                      onChange={(e) => setSoapDate(e.target.value)}
                      required
                      className="bg-zinc-950 border-zinc-800 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Session Title *</label>
                    <Input
                      value={soapTitle}
                      onChange={(e) => setSoapTitle(e.target.value)}
                      placeholder="e.g., Live Tele-Rehab Session #4: Midline Crossing"
                      required
                      className="bg-zinc-950 border-zinc-800 text-xs"
                    />
                  </div>
                </div>

                {/* 4 Distinct Textarea Boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  {/* S */}
                  <div className="space-y-1 rounded-xl border border-sky-900/40 bg-zinc-950/60 p-3">
                    <label className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-sky-950 border border-sky-500/40 text-[10px] flex items-center justify-center font-mono">S</span>
                      Subjective *
                    </label>
                    <Textarea
                      rows={3}
                      placeholder="Patient's reported feelings, pain levels, feedback from family/caregiver, daily challenges..."
                      value={soapSubjective}
                      onChange={(e) => setSoapSubjective(e.target.value)}
                      required
                      className="bg-zinc-900/80 border-zinc-800 text-xs leading-relaxed"
                    />
                  </div>

                  {/* O */}
                  <div className="space-y-1 rounded-xl border border-teal-900/40 bg-zinc-950/60 p-3">
                    <label className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-teal-950 border border-teal-500/40 text-[10px] flex items-center justify-center font-mono">O</span>
                      Objective *
                    </label>
                    <Textarea
                      rows={3}
                      placeholder="Measurable clinical metrics, active ROM, grip strength score, task repetitions, postural alignment..."
                      value={soapObjective}
                      onChange={(e) => setSoapObjective(e.target.value)}
                      required
                      className="bg-zinc-900/80 border-zinc-800 text-xs leading-relaxed"
                    />
                  </div>

                  {/* A */}
                  <div className="space-y-1 rounded-xl border border-amber-900/40 bg-zinc-950/60 p-3">
                    <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-950 border border-amber-500/40 text-[10px] flex items-center justify-center font-mono">A</span>
                      Assessment *
                    </label>
                    <Textarea
                      rows={3}
                      placeholder="Clinical synthesis, neuromuscular response, functional progress toward rehab goals, limitations..."
                      value={soapAssessment}
                      onChange={(e) => setSoapAssessment(e.target.value)}
                      required
                      className="bg-zinc-900/80 border-zinc-800 text-xs leading-relaxed"
                    />
                  </div>

                  {/* P */}
                  <div className="space-y-1 rounded-xl border border-indigo-900/40 bg-zinc-950/60 p-3">
                    <label className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-950 border border-indigo-500/40 text-[10px] flex items-center justify-center font-mono">P</span>
                      Plan *
                    </label>
                    <Textarea
                      rows={3}
                      placeholder="Next session goals, adjustments to home exercise routine, frequency, follow-up schedule..."
                      value={soapPlan}
                      onChange={(e) => setSoapPlan(e.target.value)}
                      required
                      className="bg-zinc-900/80 border-zinc-800 text-xs leading-relaxed"
                    />
                  </div>
                </div>

                {/* 5th Box: Client-Friendly Summary */}
                <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/20 p-3.5 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Summary for Client & Family (Plain English Key Takeaways) *
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAiGenerateSoapSummary}
                      disabled={generatingSoapSummary || (!soapSubjective && !soapObjective && !soapAssessment && !soapPlan)}
                      className="h-6 text-[10px] px-2.5 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/60 hover:text-emerald-200 gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      {generatingSoapSummary ? "Generating..." : "AI Generate Summary"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    Provide a simple, encouraging summary without confusing medical jargon so the client and their family understand their progress and next steps.
                  </p>
                  <Textarea
                    rows={3}
                    placeholder="e.g., You did a wonderful job with your wrist exercises today! Rest your elbow on the table to keep your shoulder relaxed..."
                    value={soapClientSummary}
                    onChange={(e) => setSoapClientSummary(e.target.value)}
                    required
                    className="bg-zinc-950/90 border-emerald-500/30 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSoapModalOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={soapSubmitting}
                    className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {editingSoapId ? "Save Changes" : "Save SOAP Note"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
