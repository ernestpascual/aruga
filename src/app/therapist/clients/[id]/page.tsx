"use client";

import React, { useState, useEffect, use, useMemo } from "react";
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
  ExternalLink,
  Video,
  FileCheck2,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Patient, HomeProgram, ClientCategory, SoapNote, SoapNoteAssessmentLink } from "@/types/database";

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
  const [activeTab, setActiveTab] = useState<"programs" | "soap" | "assessments">("programs");
  const [assessmentSearch, setAssessmentSearch] = useState("");
  const [copiedAssessmentUrl, setCopiedAssessmentUrl] = useState<string | null>(null);
  const [programFilter, setProgramFilter] = useState<"all" | "completed" | "reviewed" | "draft">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedVideosProgId, setExpandedVideosProgId] = useState<Record<string, boolean>>({});

  const toggleProgramVideos = (progId: string) => {
    setExpandedVideosProgId((prev) => ({
      ...prev,
      [progId]: !prev[progId],
    }));
  };

  const normalizeVideoUrl = (path?: string | null): string => {
    if (!path) return "/demo/tabletop_exercise.mp4";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:") || path.startsWith("/")) {
      return path;
    }
    return `/${path}`;
  };

  // Flatten and extract all standardized assessments from this client's SOAP notes
  const allClientAssessments = useMemo(() => {
    const list: Array<{
      title: string;
      url: string;
      soapNoteId: string;
      soapSessionTitle: string;
      soapSessionDate: string;
      soapObjective?: string;
      soapAssessment?: string;
      soapRecordingUrl?: string | null;
    }> = [];

    soapNotes.forEach((note) => {
      if (Array.isArray(note.assessment_links)) {
        note.assessment_links.forEach((link) => {
          if (link && (link.title?.trim() || link.url?.trim())) {
            list.push({
              title: link.title?.trim() || "Untitled Standardized Assessment",
              url: link.url?.trim() || "",
              soapNoteId: note.id,
              soapSessionTitle: note.session_title || "Clinical Session",
              soapSessionDate: note.session_date,
              soapObjective: note.objective,
              soapAssessment: note.assessment,
              soapRecordingUrl: note.session_recording_url,
            });
          }
        });
      }
    });

    return list;
  }, [soapNotes]);

  // Search filtered assessments
  const filteredClientAssessments = useMemo(() => {
    const query = assessmentSearch.trim().toLowerCase();
    if (!query) return allClientAssessments;
    return allClientAssessments.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.url.toLowerCase().includes(query) ||
        a.soapSessionTitle.toLowerCase().includes(query) ||
        (a.soapAssessment && a.soapAssessment.toLowerCase().includes(query)) ||
        (a.soapObjective && a.soapObjective.toLowerCase().includes(query))
    );
  }, [allClientAssessments, assessmentSearch]);

  const handleJumpToSoapNote = (noteId: string) => {
    setActiveTab("soap");
    setTimeout(() => {
      const el = document.getElementById(`soap-note-${noteId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-teal-500", "transition-all");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-teal-500");
        }, 2500);
      }
    }, 120);
  };

  // SOAP Note Modal State
  const [isSoapModalOpen, setIsSoapModalOpen] = useState(false);
  const [editingSoapId, setEditingSoapId] = useState<string | null>(null);
  const [soapDate, setSoapDate] = useState("");
  const [soapTitle, setSoapTitle] = useState("");
  const [soapRecordingUrl, setSoapRecordingUrl] = useState("");
  const [soapSubjective, setSoapSubjective] = useState("");
  const [soapObjective, setSoapObjective] = useState("");
  const [soapAssessment, setSoapAssessment] = useState("");
  const [soapAssessmentLinks, setSoapAssessmentLinks] = useState<SoapNoteAssessmentLink[]>([]);
  const [soapPlan, setSoapPlan] = useState("");
  const [soapSubmitting, setSoapSubmitting] = useState(false);

  // Home Program Edit Modal State
  const [isEditProgramModalOpen, setIsEditProgramModalOpen] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [editProgramTitle, setEditProgramTitle] = useState("");
  const [editProgramInstructions, setEditProgramInstructions] = useState("");
  const [editProgramStatus, setEditProgramStatus] = useState<"draft" | "assigned" | "archived">("draft");
  const [editProgramDates, setEditProgramDates] = useState<string[]>([]);
  const [editNewDateInput, setEditNewDateInput] = useState("");
  const [editProgramSteps, setEditProgramSteps] = useState<Array<{ id?: string; position: number; title: string; instructions: string }>>([]);
  const [editProgramSubmitting, setEditProgramSubmitting] = useState(false);

  // Edit Client Modal State
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
        setEditCategory(data.client.client_category || (data.client.age < 12 ? "pedia" : data.client.age < 18 ? "adolescent" : data.client.age < 55 ? "adult" : "geriatric"));
      } else if (data.clients && data.clients.length > 0) {
        const found = data.clients.find((c: Patient) => c.id === clientId);
        if (found) {
          setClient(found);
          setEditName(found.name);
          setEditAge(found.age);
          setEditGender(found.gender || "Prefer not to say");
          setEditCondition(found.condition);
          setEditCaregiver(found.caregiver_name || "");
          setEditCategory(found.client_category || (found.age < 12 ? "pedia" : found.age < 18 ? "adolescent" : found.age < 55 ? "adult" : "geriatric"));
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
          setEditCategory(clientData.client.client_category || (clientData.client.age < 12 ? "pedia" : clientData.client.age < 18 ? "adolescent" : clientData.client.age < 55 ? "adult" : "geriatric"));
        } else if (clientData.clients && clientData.clients.length > 0) {
          const found = clientData.clients.find((c: Patient) => c.id === clientId);
          if (found) {
            setClient(found);
            setEditName(found.name);
            setEditAge(found.age);
            setEditGender(found.gender || "Prefer not to say");
            setEditCondition(found.condition);
            setEditCaregiver(found.caregiver_name || "");
            setEditCategory(found.client_category || (found.age < 12 ? "pedia" : found.age < 18 ? "adolescent" : found.age < 55 ? "adult" : "geriatric"));
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
    setSoapRecordingUrl("");
    setSoapSubjective("");
    setSoapObjective("");
    setSoapAssessment("");
    setSoapAssessmentLinks([]);
    setSoapPlan("");
    setIsSoapModalOpen(true);
  };

  // Open Edit SOAP Modal
  const handleOpenEditSoapModal = (note: SoapNote) => {
    setEditingSoapId(note.id);
    setSoapDate(new Date(note.session_date).toISOString().slice(0, 10));
    setSoapTitle(note.session_title);
    setSoapRecordingUrl(note.session_recording_url || "");
    setSoapSubjective(note.subjective || "");
    setSoapObjective(note.objective || "");
    setSoapAssessment(note.assessment || "");
    setSoapAssessmentLinks(Array.isArray(note.assessment_links) ? [...note.assessment_links] : []);
    setSoapPlan(note.plan || "");
    setIsSoapModalOpen(true);
  };

  const handleAddAssessmentLink = () => {
    setSoapAssessmentLinks((prev) => [...prev, { title: "", url: "" }]);
  };

  const handleUpdateAssessmentLink = (index: number, field: "title" | "url", value: string) => {
    setSoapAssessmentLinks((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveAssessmentLink = (index: number) => {
    setSoapAssessmentLinks((prev) => prev.filter((_, i) => i !== index));
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
      const validLinks = soapAssessmentLinks.filter(
        (l) => l.title.trim() && l.url.trim()
      );
      const payload: Record<string, unknown> = {
        patientId: clientId,
        sessionDate: new Date(soapDate || Date.now()).toISOString(),
        sessionTitle: soapTitle.trim() || "Live Clinical Session Note",
        sessionRecordingUrl: soapRecordingUrl.trim() || null,
        subjective: soapSubjective.trim(),
        objective: soapObjective.trim(),
        assessment: soapAssessment.trim(),
        assessmentLinks: validLinks,
        plan: soapPlan.trim(),
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

  // Open Edit Program Modal
  const handleOpenEditProgramModal = (prog: HomeProgram) => {
    setEditingProgramId(prog.id);
    setEditProgramTitle(prog.title);
    setEditProgramInstructions(prog.main_instructions);
    setEditProgramStatus(prog.status);
    setEditProgramDates(prog.scheduled_dates ? [...prog.scheduled_dates] : []);
    setEditNewDateInput("");
    const mappedSteps =
      prog.steps && prog.steps.length > 0
        ? prog.steps.map((s, idx) => ({
            id: s.id,
            position: s.position || idx + 1,
            title: s.title || `Step ${idx + 1}`,
            instructions: s.instructions || "",
          }))
        : [
            {
              position: 1,
              title: "Step 1",
              instructions: "",
            },
          ];
    setEditProgramSteps(mappedSteps);
    setIsEditProgramModalOpen(true);
  };

  const handleAddStepToProgram = () => {
    setEditProgramSteps((prev) => [
      ...prev,
      {
        position: prev.length + 1,
        title: `Step ${prev.length + 1}`,
        instructions: "",
      },
    ]);
  };

  const handleRemoveStepFromProgram = (index: number) => {
    if (editProgramSteps.length <= 1) {
      alert("A home program must have at least one step.");
      return;
    }
    setEditProgramSteps((prev) =>
      prev.filter((_, i) => i !== index).map((s, idx) => ({ ...s, position: idx + 1 }))
    );
  };

  const handleMoveProgramStep = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= editProgramSteps.length) return;
    setEditProgramSteps((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((s, idx) => ({ ...s, position: idx + 1 }));
    });
  };

  const handleSaveEditedProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editProgramSubmitting || !editingProgramId) return;
    if (!editProgramTitle.trim() || !editProgramInstructions.trim()) {
      setErrorMsg("Program title and main instructions are required.");
      return;
    }
    if (editProgramSteps.some((s) => !s.instructions.trim())) {
      setErrorMsg("All steps must have instructions.");
      return;
    }

    setEditProgramSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/therapist/programs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: editingProgramId,
          title: editProgramTitle.trim(),
          mainInstructions: editProgramInstructions.trim(),
          status: editProgramStatus,
          scheduledDates: editProgramDates,
          steps: editProgramSteps.map((s, idx) => ({
            id: s.id,
            position: idx + 1,
            title: s.title.trim() || `Step ${idx + 1}`,
            instructions: s.instructions.trim(),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update home program.");
      }

      setSuccessMsg("Home program updated successfully!");
      setTimeout(() => setSuccessMsg(null), 3500);
      setIsEditProgramModalOpen(false);
      await fetchPrograms();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setEditProgramSubmitting(false);
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
      setSuccessMsg("Client profile updated successfully!");
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
  const isGeriatric = client?.client_category === "geriatric" || client?.client_category === "old_people" || (client?.age != null && client.age >= 55);

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
              ) : isGeriatric ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 border border-amber-500/40 text-amber-300">
                  <HeartPulse className="w-3 h-3 text-amber-400" />
                  Geriatrics ({client?.age}y)
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
          <div className="flex items-center gap-2 shrink-0 flex-nowrap overflow-x-auto pb-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              className="gap-1.5 text-xs text-zinc-300 border-zinc-700 hover:bg-zinc-800 whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              Edit Client
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTransferModalOpen(true)}
              className="gap-1.5 text-xs text-sky-300 border-sky-800/60 hover:bg-sky-950/40 whitespace-nowrap"
              title="Transfer client care and exercise history to a colleague clinician"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
              Transfer Care
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(true)}
              className="gap-1.5 text-xs text-rose-300 border-rose-900/50 hover:bg-rose-950/40 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              Delete Client
            </Button>

            <Link href={`/therapist/messages?patientId=${clientId}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs whitespace-nowrap">
                <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                Message
              </Button>
            </Link>

            <Link href={`/therapist/clients/${clientId}/programs/new`}>
              <Button size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs whitespace-nowrap">
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

        <button
          type="button"
          onClick={() => setActiveTab("assessments")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === "assessments"
              ? "bg-teal-950/80 border border-teal-500/40 text-teal-300"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5 text-teal-400" />
          <span>Created Assessments</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
            {allClientAssessments.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Home Programs Section */}
      {activeTab === "programs" && (() => {
        const pendingFeedbackCount = programs.filter(
          (p) => p.latest_submission?.state === "submitted"
        ).length;
        const reviewedCount = programs.filter(
          (p) => p.latest_submission?.state === "reviewed"
        ).length;
        const draftCount = programs.filter((p) => p.status === "draft").length;

        const filteredPrograms = programs.filter((p) => {
          if (programFilter === "completed") return p.latest_submission?.state === "submitted";
          if (programFilter === "reviewed") return p.latest_submission?.state === "reviewed";
          if (programFilter === "draft") return p.status === "draft";
          return true;
        });

        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
              <div>
                <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-400" />
                  Prescribed Home Programs ({programs.length})
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Monitor patient compliance, view client exercise submissions marked as done, and provide clinical feedback.
                </p>
              </div>

              <Link href={`/therapist/clients/${clientId}/programs/new`}>
                <Button size="sm" className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs gap-1.5 shrink-0">
                  <Plus className="w-4 h-4" />
                  New Home Program
                </Button>
              </Link>
            </div>

            {/* Quick Filter Pills */}
            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setProgramFilter("all")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  programFilter === "all"
                    ? "bg-teal-500 text-zinc-950 shadow-sm"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                All Programs ({programs.length})
              </button>
              <button
                type="button"
                onClick={() => setProgramFilter("completed")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  programFilter === "completed"
                    ? "bg-amber-500 text-zinc-950 font-bold shadow-sm"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-amber-300"
                }`}
              >
                <Clock className="w-3 h-3 text-amber-400" />
                Marked as Done / Needs Feedback ({pendingFeedbackCount})
              </button>
              <button
                type="button"
                onClick={() => setProgramFilter("reviewed")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  programFilter === "reviewed"
                    ? "bg-emerald-500 text-zinc-950 shadow-sm"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-300"
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Reviewed ({reviewedCount})
              </button>
              <button
                type="button"
                onClick={() => setProgramFilter("draft")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  programFilter === "draft"
                    ? "bg-zinc-200 text-zinc-950 shadow-sm"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Drafts ({draftCount})
              </button>
            </div>

            {programsLoading ? (
              <div className="p-8 text-center text-zinc-500 bg-zinc-900/40 rounded-xl border border-zinc-800">
                Loading assigned programs...
              </div>
            ) : filteredPrograms.length === 0 ? (
              <Card className="border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center space-y-3">
                <Layers className="w-10 h-10 text-zinc-600 mx-auto" />
                <h3 className="text-sm font-semibold text-zinc-300">
                  {programFilter === "all" ? "No home programs created yet" : `No programs matching filter "${programFilter}"`}
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  {programFilter === "all"
                    ? "Design a customized rehabilitation exercise sequence with target objects for this client."
                    : "Switch back to 'All Programs' or create a new home program for this client."}
                </p>
                {programFilter === "all" ? (
                  <Link href={`/therapist/clients/${clientId}/programs/new`}>
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs gap-1.5">
                      <Plus className="w-4 h-4" />
                      Create First Program
                    </Button>
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setProgramFilter("all")}
                    className="text-xs border-zinc-700 text-zinc-300"
                  >
                    View All Programs
                  </Button>
                )}
              </Card>
            ) : (
              <div className="space-y-3.5">
                {filteredPrograms.map((prog) => {
                  const stepCount = prog.steps?.length || 0;
                  const isAssigned = prog.status === "assigned";
                  const isDraft = prog.status === "draft";
                  const isArchived = prog.status === "archived";
                  const latestSub = prog.latest_submission;
                  const isMarkedDone = latestSub?.state === "submitted";
                  const isReviewed = latestSub?.state === "reviewed";

                  return (
                    <Card
                      key={prog.id}
                      className={`border p-5 transition-all shadow-sm ${
                        isMarkedDone
                          ? "border-amber-500/50 bg-gradient-to-b from-amber-950/20 to-zinc-900/90 hover:border-amber-500/70"
                          : isReviewed
                          ? "border-emerald-500/30 bg-zinc-900/90 hover:border-emerald-500/50"
                          : "border-zinc-800 bg-zinc-900/80 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-2 max-w-2xl">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-base font-semibold text-zinc-100">
                              {prog.title}
                            </h3>
                            {isAssigned && <Badge variant="teal" statusText="Assigned" />}
                            {isDraft && <Badge variant="amber" statusText="Draft" />}
                            {isArchived && <Badge variant="outline" statusText="Archived" />}

                            {isMarkedDone && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                                <Clock className="w-3 h-3 text-amber-400" />
                                Marked Done by Client
                              </span>
                            )}
                            {isReviewed && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Feedback Sent
                              </span>
                            )}
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
                              Created: {new Date(prog.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Program Actions - Strictly all in one horizontal row */}
                        <div className="flex items-center gap-2 shrink-0 flex-nowrap overflow-x-auto">
                          {isDraft && (
                            <Button
                              size="sm"
                              onClick={() => handleAssignProgram(prog.id)}
                              isLoading={actionLoading === `assign-${prog.id}`}
                              className="gap-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs whitespace-nowrap"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Assign
                            </Button>
                          )}

                          {isAssigned && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleArchiveProgram(prog.id)}
                              isLoading={actionLoading === `archive-${prog.id}`}
                              className="gap-1.5 text-xs text-zinc-300 border-zinc-700 hover:bg-zinc-800 whitespace-nowrap"
                            >
                              <Archive className="w-3.5 h-3.5 text-zinc-400" />
                              Archive
                            </Button>
                          )}

                          {/* Edit Home Program Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditProgramModal(prog)}
                            className="gap-1.5 text-xs text-zinc-300 border-zinc-700 hover:border-teal-500/50 hover:bg-zinc-800 hover:text-teal-300 whitespace-nowrap"
                            title="Edit home program instructions and steps"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-teal-400" />
                            Edit
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDuplicate(prog.id)}
                            isLoading={actionLoading === `dup-${prog.id}`}
                            className="gap-1.5 text-xs text-zinc-300 border-zinc-800 hover:bg-zinc-800 whitespace-nowrap"
                          >
                            <Copy className="w-3.5 h-3.5 text-zinc-400" />
                            Duplicate
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProgram(prog.id)}
                            isLoading={actionLoading === `del-${prog.id}`}
                            className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 p-2 h-8 whitespace-nowrap"
                            title="Delete home program"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Client Completion / Marked as Done & Direct Feedback Bar */}
                      {latestSub && (
                        <div
                          className={`mt-4 pt-3.5 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl ${
                            isMarkedDone
                              ? "bg-amber-950/30 border-amber-500/30 text-amber-200"
                              : isReviewed
                              ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                              : "bg-zinc-950/50 border-zinc-800 text-zinc-300"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isMarkedDone && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300">
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                  Client Completed Home Program • Awaiting Clinician Feedback
                                </span>
                              )}
                              {isReviewed && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  Reviewed & Feedback Delivered
                                </span>
                              )}
                              {latestSub.state === "draft" && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                                  <Layers className="w-3.5 h-3.5 text-zinc-400" />
                                  Client Working on Steps (In Progress)
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400">
                              {latestSub.submitted_at
                                ? `Submitted: ${new Date(latestSub.submitted_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })} • `
                                : ""}
                              {Array.isArray(latestSub.step_submissions)
                                ? `${latestSub.step_submissions.filter((ss) => !ss.skipped || ss.video_path).length} of ${stepCount} steps documented`
                                : "Home program activities logged"}
                            </p>
                          </div>

                          <div className="flex flex-row items-center gap-2 shrink-0 flex-nowrap whitespace-nowrap">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => toggleProgramVideos(prog.id)}
                              className="gap-1.5 text-xs text-zinc-300 border-zinc-700 hover:bg-zinc-800 hover:text-teal-300 whitespace-nowrap"
                            >
                              <Video className="w-3.5 h-3.5 text-teal-400" />
                              <span>{expandedVideosProgId[prog.id] ? "Hide Step Videos" : "View Step Videos"}</span>
                              {expandedVideosProgId[prog.id] ? (
                                <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                              )}
                            </Button>

                            <Link href={`/therapist/submissions/${latestSub.id}`}>
                              <Button
                                size="sm"
                                className={
                                  isMarkedDone
                                    ? "bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs gap-1.5 shadow-md shadow-teal-500/20 whitespace-nowrap"
                                    : isReviewed
                                    ? "bg-teal-950/60 hover:bg-teal-900/60 text-teal-300 font-semibold text-xs gap-1.5 border border-teal-500/40 hover:border-teal-400 whitespace-nowrap"
                                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs gap-1.5 border border-zinc-700 whitespace-nowrap"
                                }
                              >
                                {isMarkedDone ? (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5 text-zinc-950" />
                                    Review & Give Feedback →
                                  </>
                                ) : isReviewed ? (
                                  <>
                                    <FileCheck2 className="w-3.5 h-3.5 text-teal-400" />
                                    Check and Edit Feedback
                                  </>
                                ) : (
                                  <>
                                    <FileCheck2 className="w-3.5 h-3.5 text-teal-400" />
                                    View Submission & Analysis
                                  </>
                                )}
                              </Button>
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* Expandable Step Videos Drawer */}
                      {latestSub && expandedVideosProgId[prog.id] && (
                        <div className="mt-4 pt-4 border-t border-zinc-800/80 space-y-4 bg-zinc-950/70 p-4 rounded-xl">
                          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
                            <div className="flex items-center gap-2">
                              <Video className="w-4 h-4 text-teal-400" />
                              <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                                Uploaded Activity Videos by Step
                              </h4>
                            </div>
                            <span className="text-[11px] text-zinc-500 font-mono">
                              {stepCount} Steps Total
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {(prog.steps || []).map((step, sIdx) => {
                              const stepSub =
                                latestSub.step_submissions?.find((ss) => ss.program_step_id === step.id) ||
                                latestSub.step_submissions?.[sIdx];

                              const rawVideo =
                                stepSub?.video_path ||
                                (isDemo
                                  ? sIdx === 0
                                    ? "/demo/cup_grasp_transfer.mp4"
                                    : sIdx === 1
                                    ? "/demo/block_stacking.mp4"
                                    : "/demo/washcloth_supination.mp4"
                                  : null);

                              const videoSrc = rawVideo ? normalizeVideoUrl(rawVideo) : null;
                              const isSkipped = stepSub?.skipped;

                              return (
                                <div
                                  key={step.id || sIdx}
                                  className="rounded-lg bg-zinc-900/90 border border-zinc-800 p-3 space-y-2.5 flex flex-col justify-between"
                                >
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-bold text-zinc-200 truncate">
                                        Step {step.position || sIdx + 1}: {step.title}
                                      </span>
                                      {isSkipped ? (
                                        <Badge variant="amber" statusText="Skipped" />
                                      ) : videoSrc ? (
                                        <Badge
                                          variant="emerald"
                                          statusText="Uploaded"
                                          icon={<CheckCircle2 className="w-3 h-3" />}
                                        />
                                      ) : (
                                        <Badge variant="outline" statusText="No video" />
                                      )}
                                    </div>
                                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                                      {step.instructions}
                                    </p>
                                  </div>

                                  {/* Step Video Player */}
                                  <div className="space-y-2 pt-1">
                                    {videoSrc ? (
                                      <div className="space-y-1.5">
                                        <div className="relative aspect-video w-full rounded-md overflow-hidden bg-black border border-zinc-800">
                                          <video
                                            src={videoSrc}
                                            controls
                                            playsInline
                                            preload="metadata"
                                            className="w-full h-full object-contain"
                                          />
                                        </div>
                                        {stepSub?.client_comment && (
                                          <p className="text-[10px] text-zinc-400 italic bg-zinc-950 px-2 py-1 rounded border border-zinc-800/60 line-clamp-2">
                                            &quot;{stepSub.client_comment}&quot;
                                          </p>
                                        )}
                                      </div>
                                    ) : isSkipped ? (
                                      <div className="rounded bg-amber-950/20 border border-amber-800/40 p-2.5 text-[11px] text-amber-200/90">
                                        <span className="font-semibold block text-amber-300">Skip Reason:</span>
                                        <p className="italic">{stepSub?.skip_reason || "Fatigue precaution"}</p>
                                      </div>
                                    ) : (
                                      <div className="rounded bg-zinc-950 border border-zinc-800 p-4 text-center text-[11px] text-zinc-500">
                                        No video recorded yet
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {!latestSub && isAssigned && (
                        <div className="mt-3.5 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-zinc-500" />
                            Assigned to client • Pending initial exercise completion
                          </span>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

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
                  id={`soap-note-${note.id}`}
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

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditSoapModal(note)}
                        className="text-xs border-zinc-700 text-zinc-300 hover:text-teal-300 gap-1.5 h-8 whitespace-nowrap"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit Note
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSoapNote(note.id)}
                        isLoading={actionLoading === `del-soap-${note.id}`}
                        className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 p-2 h-8 whitespace-nowrap"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Full-Width SOAP Documentation with Pre-SOAP Video Recording Link */}
                  <div className="space-y-4">
                    {/* Session Recording Link (Placed BEFORE SOAP notes) */}
                    {note.session_recording_url && (
                      <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0">
                            <Video className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                              Live Session Recording Attached
                              <Badge variant="teal" statusText="Synchronous Evaluation" />
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate max-w-md sm:max-w-lg">
                              {note.session_recording_url}
                            </div>
                          </div>
                        </div>
                        <a
                          href={note.session_recording_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-bold transition-colors shrink-0 shadow-sm"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Watch Session Recording
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>
                      </div>
                    )}

                    {/* S: Subjective - FULL WIDTH */}
                    <div className="rounded-xl border border-sky-900/40 bg-zinc-950/60 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                        <span className="w-5 h-5 rounded-full bg-sky-950 border border-sky-500/40 text-[11px] flex items-center justify-center font-mono font-bold">
                          S
                        </span>
                        <span>Subjective</span>
                        <span className="text-[10px] text-zinc-500 font-normal">
                          (Patient/Caregiver reports, symptoms, functional goals)
                        </span>
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap pl-7">
                        {note.subjective || "No subjective notes recorded."}
                      </p>
                    </div>

                    {/* O: Objective - FULL WIDTH */}
                    <div className="rounded-xl border border-teal-900/40 bg-zinc-950/60 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-teal-400">
                        <span className="w-5 h-5 rounded-full bg-teal-950 border border-teal-500/40 text-[11px] flex items-center justify-center font-mono font-bold">
                          O
                        </span>
                        <span>Objective</span>
                        <span className="text-[10px] text-zinc-500 font-normal">
                          (Measurable clinical data, active ROM, grip score, postural alignment)
                        </span>
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap pl-7">
                        {note.objective || "No objective measurements recorded."}
                      </p>
                    </div>

                    {/* A: Assessment - FULL WIDTH + MULTIPLE ASSESSMENT DOCUMENT LINKS */}
                    <div className="rounded-xl border border-amber-900/40 bg-zinc-950/60 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                        <span className="w-5 h-5 rounded-full bg-amber-950 border border-amber-500/40 text-[11px] flex items-center justify-center font-mono font-bold">
                          A
                        </span>
                        <span>Assessment</span>
                        <span className="text-[10px] text-zinc-500 font-normal">
                          (Clinical synthesis, neuromuscular response, functional progress toward rehab goals)
                        </span>
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap pl-7">
                        {note.assessment || "No clinical assessment recorded."}
                      </p>

                      {/* Multiple Assessment Document Links */}
                      {Array.isArray(note.assessment_links) && note.assessment_links.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-amber-950/60 pl-7 space-y-2">
                          <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            Attached Assessment Documents & Reports ({note.assessment_links.length})
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {note.assessment_links.map((link, lIdx) => (
                              <a
                                key={lIdx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-zinc-800 border border-amber-500/40 text-amber-200 hover:text-amber-100 transition-colors group shadow-sm"
                              >
                                <FileText className="w-3 h-3 text-amber-400" />
                                <span className="font-medium">{link.title || link.url}</span>
                                <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-amber-300 transition-colors" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* P: Plan - FULL WIDTH */}
                    <div className="rounded-xl border border-indigo-900/40 bg-zinc-950/60 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                        <span className="w-5 h-5 rounded-full bg-indigo-950 border border-indigo-500/40 text-[11px] flex items-center justify-center font-mono font-bold">
                          P
                        </span>
                        <span>Plan</span>
                        <span className="text-[10px] text-zinc-500 font-normal">
                          (Next session targets, home exercise frequency, follow-up cadence)
                        </span>
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap pl-7">
                        {note.plan || "No plan recorded."}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Created Assessments from SOAP Notes */}
      {activeTab === "assessments" && (
        <div className="space-y-4">
          {/* Header & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-teal-400" />
                Standardized Assessments & Test Reports
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                All standardized clinical assessments, test score sheets, and goniometry reports linked across this client&apos;s SOAP notes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                <Input
                  type="text"
                  placeholder="Search assessment or SOAP note..."
                  value={assessmentSearch}
                  onChange={(e) => setAssessmentSearch(e.target.value)}
                  className="pl-8 bg-zinc-950/80 border-zinc-800 text-xs h-8 text-zinc-200"
                />
                {assessmentSearch && (
                  <button
                    type="button"
                    onClick={() => setAssessmentSearch("")}
                    className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {allClientAssessments.length === 0 ? (
            <Card className="border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center space-y-3">
              <ClipboardList className="w-10 h-10 text-zinc-600 mx-auto" />
              <h3 className="text-sm font-semibold text-zinc-300">No assessments created in SOAP notes yet</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                When you record or edit a live session SOAP note and add standardized assessment documents (like PDMS-2, Fugl-Meyer, or Sensory Profile), they will be cataloged and searchable here.
              </p>
              <Button
                size="sm"
                onClick={handleOpenNewSoapModal}
                className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Create SOAP Note with Assessment
              </Button>
            </Card>
          ) : filteredClientAssessments.length === 0 ? (
            <Card className="border border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-3">
              <Search className="w-8 h-8 text-zinc-600 mx-auto" />
              <h3 className="text-sm font-semibold text-zinc-300">No assessments match &quot;{assessmentSearch}&quot;</h3>
              <p className="text-xs text-zinc-500">
                Try searching by a different test name, link URL, or session title.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAssessmentSearch("")}
                className="border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Clear Search
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                <span>
                  Showing <strong className="text-zinc-200">{filteredClientAssessments.length}</strong> of {allClientAssessments.length} assessment{allClientAssessments.length === 1 ? "" : "s"}
                </span>
                {assessmentSearch && (
                  <span className="text-teal-400 text-[11px]">
                    Filtered by keyword &ldquo;{assessmentSearch}&rdquo;
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                {filteredClientAssessments.map((item, idx) => (
                  <Card
                    key={`${item.soapNoteId}-${idx}`}
                    className="border-zinc-800 bg-zinc-900/80 hover:border-amber-500/40 transition-colors p-4 space-y-3.5 shadow-sm group"
                  >
                    {/* Top Row: Test Title and Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-6 h-6 rounded bg-amber-950/80 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <h3 className="text-sm sm:text-base font-bold text-zinc-100 group-hover:text-amber-200 transition-colors">
                            {item.title}
                          </h3>
                          <Badge variant="amber" statusText="Standardized Assessment" icon={<FileText className="w-3 h-3 text-amber-400" />} />
                        </div>
                        <p className="text-xs text-zinc-400 pl-8 font-mono break-all line-clamp-1">
                          {item.url}
                        </p>
                      </div>

                      {/* Action buttons (Open Document, Copy URL) */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(item.url);
                            setCopiedAssessmentUrl(item.url);
                            setTimeout(() => setCopiedAssessmentUrl(null), 2000);
                          }}
                          className="h-8 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5"
                          title="Copy Link to Clipboard"
                        >
                          {copiedAssessmentUrl === item.url ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-zinc-400" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </Button>

                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold transition-colors"
                        >
                          <span>Open Document</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>

                    {/* Source SOAP Note Card */}
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/60 pb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          <span className="text-xs text-zinc-400">Originated From SOAP Note:</span>
                          <span className="text-xs font-semibold text-zinc-200">
                            {item.soapSessionTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-zinc-500" />
                            {new Date(item.soapSessionDate).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleJumpToSoapNote(item.soapNoteId)}
                            className="h-6 px-2 text-[11px] text-teal-400 hover:text-teal-300 hover:bg-teal-950/40"
                          >
                            View SOAP Note ↗
                          </Button>
                        </div>
                      </div>

                      {/* Brief clinical context snippet */}
                      {item.soapAssessment && (
                        <div className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                          <span className="text-amber-400/90 font-medium font-mono text-[11px] mr-1.5">[A-Assessment Context]:</span>
                          {item.soapAssessment}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
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
                          else setEditCategory("geriatric");
                        }
                      }}
                      required
                      className="bg-zinc-950 border-zinc-800 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">Demographic Tier</label>
                    <select
                      value={editCategory === "old_people" ? "geriatric" : editCategory}
                      onChange={(e) => setEditCategory(e.target.value as ClientCategory)}
                      className="w-full h-9 rounded-md bg-zinc-950 border border-zinc-800 px-3 text-xs text-zinc-200"
                    >
                      <option value="pedia">Pediatric (&lt;12y)</option>
                      <option value="adolescent">Adolescent (12-17y)</option>
                      <option value="adult">Adult (18-54y)</option>
                      <option value="geriatric">Geriatrics (55y+)</option>
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
                <span className="font-semibold text-zinc-100">{client?.name}</span>?
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
          <Card className="w-full max-w-4xl border-zinc-800 bg-zinc-900 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-400" />
                  {editingSoapId ? "Edit Live Session SOAP Note" : "New Live Session SOAP Note"}
                </CardTitle>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Client: <span className="font-semibold text-zinc-200">{client?.name}</span> • Full-Width Clinical SOAP Documentation
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSoapModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-4 max-h-[82vh] overflow-y-auto">
              <form onSubmit={handleSaveSoapNote} className="space-y-5">
                {/* Session Header Details */}
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

                {/* 1. SESSION RECORDING LINK (PLACED BEFORE ACTUAL SOAP NOTES) */}
                <div className="p-3.5 rounded-xl border border-teal-500/30 bg-teal-950/20 space-y-1.5">
                  <label className="text-xs font-bold text-teal-300 flex items-center gap-2">
                    <Video className="w-4 h-4 text-teal-400" />
                    Session Video Recording URL (Placed Before SOAP Notes)
                  </label>
                  <p className="text-[11px] text-zinc-400">
                    Add the cloud recording link for this synchronous telehealth or live evaluation session (e.g. Google Meet, Zoom, Vimeo, or Google Drive link).
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      type="url"
                      placeholder="https://meet.google.com/rec/session-id or https://drive.google.com/file/d/..."
                      value={soapRecordingUrl}
                      onChange={(e) => setSoapRecordingUrl(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-xs text-zinc-200"
                    />
                    {soapRecordingUrl.trim() && (
                      <a
                        href={soapRecordingUrl.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-md bg-teal-500/20 border border-teal-500/40 text-teal-300 hover:bg-teal-500/30 text-xs font-semibold flex items-center gap-1 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Test Link
                      </a>
                    )}
                  </div>
                </div>

                {/* 2. FULL-WIDTH SOAP DOCUMENTATION BOXES WITH LARGE TEXTAREAS */}
                <div className="space-y-4">
                  {/* S: Subjective - FULL WIDTH */}
                  <div className="space-y-1.5 rounded-xl border border-sky-900/40 bg-zinc-950/60 p-4">
                    <label className="text-xs font-bold text-sky-400 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-sky-950 border border-sky-500/40 text-[11px] flex items-center justify-center font-mono">
                        S
                      </span>
                      Subjective *
                      <span className="text-[11px] text-zinc-500 font-normal">
                        (Patient symptoms, pain scale, functional complaints, caregiver observations)
                      </span>
                    </label>
                    <Textarea
                      rows={7}
                      placeholder="Patient's reported feelings, pain levels (0-10), feedback from family/caregiver, daily home program challenges since previous visit..."
                      value={soapSubjective}
                      onChange={(e) => setSoapSubjective(e.target.value)}
                      required
                      className="bg-zinc-900/80 border-zinc-800 text-xs leading-relaxed min-h-[160px] resize-y"
                    />
                  </div>

                  {/* O: Objective - FULL WIDTH */}
                  <div className="space-y-1.5 rounded-xl border border-teal-900/40 bg-zinc-950/60 p-4">
                    <label className="text-xs font-bold text-teal-400 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-teal-950 border border-teal-500/40 text-[11px] flex items-center justify-center font-mono">
                        O
                      </span>
                      Objective *
                      <span className="text-[11px] text-zinc-500 font-normal">
                        (Measurable clinical data, active ROM degrees, grip strength score, task repetitions)
                      </span>
                    </label>
                    <Textarea
                      rows={7}
                      placeholder="Measurable clinical metrics, active ROM degrees, grip strength dynamometer readings, task trials/repetitions, postural alignment observations..."
                      value={soapObjective}
                      onChange={(e) => setSoapObjective(e.target.value)}
                      required
                      className="bg-zinc-900/80 border-zinc-800 text-xs leading-relaxed min-h-[160px] resize-y"
                    />
                  </div>

                  {/* A: Assessment - FULL WIDTH + MULTIPLE ASSESSMENT DOCUMENT LINKS */}
                  <div className="space-y-3 rounded-xl border border-amber-900/40 bg-zinc-950/60 p-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-amber-400 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-950 border border-amber-500/40 text-[11px] flex items-center justify-center font-mono">
                          A
                        </span>
                        Assessment *
                        <span className="text-[11px] text-zinc-500 font-normal">
                          (Clinical analysis, neuromuscular response, functional progression towards goals)
                        </span>
                      </label>
                      <Textarea
                        rows={8}
                        placeholder="Clinical synthesis, motor control progress, neuromuscular adaptation, functional limitations, tolerance to therapeutic activities..."
                        value={soapAssessment}
                        onChange={(e) => setSoapAssessment(e.target.value)}
                        required
                        className="bg-zinc-900/80 border-zinc-800 text-xs leading-relaxed min-h-[180px] resize-y"
                      />
                    </div>

                    {/* Multiple Assessment Document Links Section */}
                    <div className="pt-2 border-t border-amber-950/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            Assessment Documents & Standardized Test Reports
                          </label>
                          <p className="text-[11px] text-zinc-500">
                            Attach links to standardized assessment PDFs (e.g. PDMS-2, Fugl-Meyer, Sensory Profile, Goniometry sheets).
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddAssessmentLink}
                          className="h-7 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-950/40 hover:text-amber-200 gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add Document Link
                        </Button>
                      </div>

                      {soapAssessmentLinks.length === 0 ? (
                        <div className="text-[11px] text-zinc-500 italic bg-zinc-900/40 p-2.5 rounded-lg border border-dashed border-zinc-800">
                          No assessment documents linked yet. Click &quot;Add Document Link&quot; to attach test reports or scorecards.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {soapAssessmentLinks.map((link, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded bg-amber-950/80 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center">
                                    {idx + 1}
                                  </span>
                                  Assessment Link #{idx + 1}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {link.url.trim() && (
                                    <a
                                      href={link.url.trim()}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-teal-300 hover:text-teal-200 transition-colors"
                                      title="Open link in new tab"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      <span>Test Link</span>
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAssessmentLink(idx)}
                                    className="p-1 rounded hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 transition-colors"
                                    title="Remove document link"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                                    Test Title
                                  </label>
                                  <Input
                                    placeholder="e.g. PDMS-2 Scorecard PDF or Fugl-Meyer UE"
                                    value={link.title}
                                    onChange={(e) => handleUpdateAssessmentLink(idx, "title", e.target.value)}
                                    className="bg-zinc-950 border-zinc-800 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                                    Link
                                  </label>
                                  <Input
                                    placeholder="https://drive.google.com/... or https://clinic.org/..."
                                    value={link.url}
                                    onChange={(e) => handleUpdateAssessmentLink(idx, "url", e.target.value)}
                                    className="bg-zinc-950 border-zinc-800 text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* P: Plan - FULL WIDTH */}
                  <div className="space-y-1.5 rounded-xl border border-indigo-900/40 bg-zinc-950/60 p-4">
                    <label className="text-xs font-bold text-indigo-400 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-950 border border-indigo-500/40 text-[11px] flex items-center justify-center font-mono">
                        P
                      </span>
                      Plan *
                      <span className="text-[11px] text-zinc-500 font-normal">
                        (Home program adjustments, repetition targets, next telehealth visit cadence)
                      </span>
                    </label>
                    <Textarea
                      rows={7}
                      placeholder="Continuum of care, modifications to home program, frequency and repetitions, precautions, next live appointment date..."
                      value={soapPlan}
                      onChange={(e) => setSoapPlan(e.target.value)}
                      required
                      className="bg-zinc-900/80 border-zinc-800 text-xs leading-relaxed min-h-[160px] resize-y"
                    />
                  </div>
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
                    {editingSoapId ? "Save SOAP Note Changes" : "Save Live Session SOAP Note"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* EDIT HOME PROGRAM MODAL */}
      {isEditProgramModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-3xl border-zinc-800 bg-zinc-900 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-teal-400" />
                  Edit Home Program
                </CardTitle>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Update program instructions, exercise steps, and assignment status for <span className="font-semibold text-zinc-200">{client?.name}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditProgramModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-4 max-h-[82vh] overflow-y-auto">
              <form onSubmit={handleSaveEditedProgram} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Program Title *</label>
                    <Input
                      value={editProgramTitle}
                      onChange={(e) => setEditProgramTitle(e.target.value)}
                      placeholder="e.g., Tabletop Grasp & Precision Release Home Program"
                      required
                      className="bg-zinc-950 border-zinc-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Program Status</label>
                    <select
                      value={editProgramStatus}
                      onChange={(e) => setEditProgramStatus(e.target.value as "draft" | "assigned" | "archived")}
                      className="w-full h-9 rounded-md bg-zinc-950 border border-zinc-800 px-3 text-xs text-zinc-200"
                    >
                      <option value="draft">Draft</option>
                      <option value="assigned">Assigned to Client</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Main Instructions & Clinical Objectives *</label>
                  <Textarea
                    rows={3}
                    value={editProgramInstructions}
                    onChange={(e) => setEditProgramInstructions(e.target.value)}
                    placeholder="Describe frequency, caregiver cueing, posture guidelines, and overall rehabilitation goals..."
                    required
                    className="bg-zinc-950 border-zinc-800 text-xs leading-relaxed resize-y"
                  />
                </div>

                {/* Practice Schedule (Up to 10 Dates) */}
                <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-teal-400" />
                        Practice Schedule Dates (Up to 10 Dates)
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        Specify dates on when the client should do this home program. Each date is one submission.
                      </p>
                    </div>
                    <Badge
                      variant={editProgramDates.length >= 10 ? "amber" : "teal"}
                      statusText={`${editProgramDates.length} of 10 dates`}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="date"
                      value={editNewDateInput}
                      onChange={(e) => setEditNewDateInput(e.target.value)}
                      className="w-40 bg-zinc-900 border-zinc-800 text-xs h-8 text-zinc-200"
                      disabled={editProgramDates.length >= 10}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const val = editNewDateInput.trim();
                        if (val && !editProgramDates.includes(val) && editProgramDates.length < 10) {
                          setEditProgramDates([...editProgramDates, val].sort());
                          setEditNewDateInput("");
                        }
                      }}
                      disabled={!editNewDateInput || editProgramDates.length >= 10}
                      className="h-8 gap-1 text-xs border-teal-500/40 text-teal-300 hover:bg-teal-950/30"
                    >
                      <Plus className="w-3 h-3" />
                      Add Date
                    </Button>

                    <div className="flex items-center gap-1 ml-auto">
                      <span className="text-[10px] text-zinc-500 mr-1">Quick:</span>
                      {[
                        { label: "Today", days: 0 },
                        { label: "+1D", days: 1 },
                        { label: "+2D", days: 2 },
                        { label: "+3D", days: 3 },
                        { label: "+1W", days: 7 },
                      ].map((preset) => {
                        const d = new Date();
                        d.setDate(d.getDate() + preset.days);
                        const dateStr = d.toISOString().split("T")[0];
                        const alreadyAdded = editProgramDates.includes(dateStr);
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            disabled={alreadyAdded || editProgramDates.length >= 10}
                            onClick={() => {
                              if (!alreadyAdded && editProgramDates.length < 10) {
                                setEditProgramDates([...editProgramDates, dateStr].sort());
                              }
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                              alreadyAdded
                                ? "opacity-30 border-zinc-800 text-zinc-600 cursor-not-allowed"
                                : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-teal-500/50 hover:text-teal-300"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {editProgramDates.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {editProgramDates.map((dateStr, idx) => (
                        <div
                          key={dateStr}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-teal-500/30 text-xs text-zinc-200"
                        >
                          <span className="font-semibold text-teal-400">Date {idx + 1}:</span>
                          <span className="font-mono text-[11px]">{dateStr}</span>
                          <button
                            type="button"
                            onClick={() => setEditProgramDates(editProgramDates.filter((d) => d !== dateStr))}
                            className="text-zinc-500 hover:text-red-400 transition-colors ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-500 italic">
                      No specific dates set. The client will have 1 submission for this home program.
                    </p>
                  )}
                </div>

                {/* Steps Section */}
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-teal-400" />
                        Program Steps ({editProgramSteps.length})
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        Patients record a video or skip with explanation for each step.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddStepToProgram}
                      className="h-7 text-xs border-zinc-700 text-teal-300 hover:bg-zinc-800 gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Step
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {editProgramSteps.map((step, sIdx) => (
                      <div
                        key={sIdx}
                        className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/70 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="w-6 h-6 rounded-md bg-teal-950 border border-teal-500/40 text-teal-300 text-xs font-bold font-mono flex items-center justify-center shrink-0">
                              {sIdx + 1}
                            </span>
                            <Input
                              value={step.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditProgramSteps((prev) => {
                                  const copy = [...prev];
                                  copy[sIdx] = { ...copy[sIdx], title: val };
                                  return copy;
                                });
                              }}
                              placeholder={`Step ${sIdx + 1} Title`}
                              className="bg-zinc-900 border-zinc-800 text-xs h-8"
                            />
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveProgramStep(sIdx, "up")}
                              disabled={sIdx === 0}
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move step up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveProgramStep(sIdx, "down")}
                              disabled={sIdx === editProgramSteps.length - 1}
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move step down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStepFromProgram(sIdx)}
                              className="p-1.5 rounded hover:bg-rose-950/40 text-rose-400 hover:text-rose-300"
                              title="Remove step"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <Textarea
                            rows={2}
                            value={step.instructions}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditProgramSteps((prev) => {
                                const copy = [...prev];
                                copy[sIdx] = { ...copy[sIdx], instructions: val };
                                return copy;
                              });
                            }}
                            placeholder="Specific clinical instructions, object setup, grasp technique, repetitions..."
                            required
                            className="bg-zinc-900/90 border-zinc-800 text-xs leading-relaxed resize-y"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditProgramModalOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={editProgramSubmitting}
                    className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Save Program Changes
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
