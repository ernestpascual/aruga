"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Search,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Send,
  X,
  Baby,
  GraduationCap,
  HeartPulse,
  User,
  Filter,
  Copy,
  Check,
  Key,
  Shield,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/supabase/auth-context";
import { Patient } from "@/types/database";

export default function TherapistClientsPage() {
  const { user } = useAuth();
  const isDemo = false as const;
  const [clients, setClients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [populationFilter, setPopulationFilter] = useState<"all" | "pending" | "pedia" | "adolescent" | "adult" | "geriatric" | "old_people">("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"intake" | "link_email">("intake");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkCondition, setLinkCondition] = useState("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const filter = params.get("filter");
      if (filter === "pending") {
        setPopulationFilter("pending");
      }
      if (params.get("action") === "link") {
        setModalMode("link_email");
        setIsAddModalOpen(true);
      }
    }
  }, []);

  // Form state
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState("Prefer not to say");
  const [condition, setCondition] = useState("");
  const [email, setEmail] = useState("");
  const [caregiverName, setCaregiverName] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Newly created client credentials
  interface CreatedCredentials {
    clientName: string;
    email: string;
    temporaryPassword: string;
    isNewUser: boolean;
  }
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);

  const copyCredentialsText = async (cred: CreatedCredentials) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const portalUrl = `${origin}/login`;
    const text = `Welcome to Aruga Occupational Therapy!
Your client rehabilitation portal account has been created.

• Client: ${cred.clientName}
• Portal URL: ${portalUrl}
• Login Email: ${cred.email}
• Temporary Password: ${cred.temporaryPassword}

Please sign in at ${portalUrl} and update your password under Profile > Security.`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedCredentials(true);
      setTimeout(() => setCopiedCredentials(false), 3000);
    } catch (err) {
      console.warn("Failed to copy credentials:", err);
    }
  };

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const handleConfirmClientLink = async (clientId: string, action: "accept" | "decline", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirmingId) return;

    setConfirmingId(clientId);
    setConfirmError(null);
    try {
      const res = await fetch("/api/therapist/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: clientId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update connection status.");
      window.dispatchEvent(new Event("aruga:notification-action"));
      await fetchClients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setConfirmError(msg);
      console.error("Failed to update status:", err);
    } finally {
      setConfirmingId(null);
    }
  };

  const copyRowAccessInfo = async (client: Patient, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const portalUrl = `${origin}/login`;

    let text: string;
    if (client.temporary_password) {
      text = `Welcome to Aruga Occupational Therapy!
Your client rehabilitation portal account has been created.

• Client: ${client.name}
• Portal URL: ${portalUrl}
• Login Email: ${client.email}
• Temporary Password: ${client.temporary_password}

Please sign in at ${portalUrl} and update your password under Profile > Security.`;
    } else {
      text = `Aruga Therapy Portal Access Details:
• Client: ${client.name}
• Portal URL: ${portalUrl}
• Login Email: ${client.email}
• Account Status: Claimed (Password protected by client)

Note: For client privacy and safety, temporary credentials are automatically deleted from clinician view once the client logs in. To reset passwords, the client can use the "Forgot password?" link on the login page.`;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedRowId(client.id);
      setTimeout(() => setCopiedRowId(null), 2500);
    } catch (err) {
      console.warn("Failed to copy access info:", err);
    }
  };

  const openAddModal = (mode: "intake" | "link_email" = "intake") => {
    setModalMode(mode);
    setName("");
    setAge("");
    setGender("Prefer not to say");
    setCondition("");
    setEmail("");
    setCaregiverName("");
    setFormError(null);
    setFormSuccess(null);
    setLinkEmail("");
    setLinkCondition("");
    setLinkError(null);
    setLinkSuccess(null);
    setIsAddModalOpen(true);
  };

  const handleLinkClientByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkEmail.trim() || linkSubmitting) return;

    setLinkSubmitting(true);
    setLinkError(null);
    setLinkSuccess(null);

    try {
      const res = await fetch("/api/therapist/client-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: linkEmail.trim(),
          condition: linkCondition.trim() || undefined,
          therapistId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to link client by email.");
      }

      setLinkSuccess(data.message || "Connection invitation sent to client.");
      setLinkEmail("");
      setLinkCondition("");
      window.dispatchEvent(new Event("aruga:notification-action"));
      await fetchClients();

      // Automatically switch to pending filter so therapist immediately sees the new link
      setPopulationFilter("pending");

      setTimeout(() => {
        setIsAddModalOpen(false);
        setLinkSuccess(null);
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLinkError(msg);
    } finally {
      setLinkSubmitting(false);
    }
  };

  const fetchClients = async () => {
    if (!user?.id) {
      setLoading(false);
      setClients([]);
      return;
    }
    try {
      setLoading(true);
      const url = `/api/therapist/clients?therapistId=${user.id}&isDemo=false`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.clients) {
        setClients(data.clients);
      }
    } catch {
      // Error fetching clients
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();

    const handleRefresh = () => fetchClients();
    window.addEventListener("aruga:notification-action", handleRefresh);
    return () => {
      window.removeEventListener("aruga:notification-action", handleRefresh);
    };
  }, [user?.id]);

  const isPediatricInput = typeof age === "number" && age < 18;

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formSubmitting) return;
    if (!user?.id) {
      setFormError("Therapist account not authenticated. Please refresh or sign in again.");
      return;
    }
    setFormError(null);
    setFormSuccess(null);
    setFormSubmitting(true);

    try {
      const res = await fetch("/api/therapist/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          age: Number(age),
          gender,
          condition,
          email,
          caregiverName: isPediatricInput ? caregiverName : null,
          therapistId: user.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add client");
      }

      setFormSuccess(data.message || `Client ${name} created. Secure setup invitation issued.`);
      setName("");
      setAge("");
      setGender("Prefer not to say");
      setCondition("");
      setEmail("");
      setCaregiverName("");
      setIsAddModalOpen(false);

      if (data.client) {
        setClients((prev) => {
          const exists = prev.some((c) => c.id === data.client.id || c.email === data.client.email);
          return exists
            ? prev.map((c) => (c.id === data.client.id || c.email === data.client.email ? data.client : c))
            : [data.client, ...prev];
        });
      }

      await fetchClients();

      if (data.credentials) {
        setCreatedCredentials(data.credentials);
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormSubmitting(false);
    }
  };

  const filteredClients = clients
    .filter((c) => {
      if (populationFilter === "pending") return c.invitation_status === "pending";
      if (populationFilter === "adult") return c.age >= 18 && c.age < 55;
      if (populationFilter === "geriatric" || populationFilter === "old_people") return c.age >= 55 || (c as any).client_category === "geriatric" || (c as any).client_category === "old_people";
      if (populationFilter === "adolescent") return c.age >= 12 && c.age < 18;
      if (populationFilter === "pedia") return c.age < 12;
      return true;
    })
    .filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.condition.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.caregiver_name && c.caregiver_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  const pediaCount = clients.filter((c) => c.age < 12).length;
  const adolescentCount = clients.filter((c) => c.age >= 12 && c.age < 18).length;
  const adultCount = clients.filter((c) => c.age >= 18 && c.age < 55).length;
  const geriatricCount = clients.filter((c) => c.age >= 55 || (c as any).client_category === "geriatric" || (c as any).client_category === "old_people").length;
  const pendingConfirmations = clients.filter((c) => c.invitation_status === "pending");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-zinc-800/80 pb-4 sm:pb-5">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-teal-950/50 border border-teal-500/20 grid place-items-center shrink-0">
              <Users className="w-5 h-5 text-teal-400" />
            </span>
            Clients
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed">
            Manage your caseload across pediatric and adult care, assign home programs, and review submissions.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2 sm:self-auto">
          <Button
            onClick={() => openAddModal("link_email")}
            variant="outline"
            className="gap-2 border-teal-500/40 text-teal-300 hover:bg-teal-950/50 hover:text-teal-200 font-semibold shadow-sm h-10 sm:h-9 text-xs justify-center"
          >
            <Link2 className="w-4 h-4" />
            <span className="hidden xs:inline">Link</span> by Email
          </Button>
          <Button
            onClick={() => openAddModal("intake")}
            className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold shadow-sm h-10 sm:h-9 text-xs justify-center"
          >
            <UserPlus className="w-4 h-4" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Pending activation is now just a pill in the client list — no banner or confirm actions. Auto-activates on first login via clear-temp-credentials + DB trigger. */}

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search by client name, condition, or caregiver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-900/90 border-zinc-800 h-10 sm:h-9 text-sm"
          />
        </div>

        {/* Population Filter Tabs — horizontally scrollable on mobile */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/80 border border-zinc-800 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-1 px-1 sm:mx-0">
          <button
            type="button"
            onClick={() => setPopulationFilter("all")}
            className={`snap-start shrink-0 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              populationFilter === "all"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All ({clients.length})
          </button>
          <button
            type="button"
            onClick={() => setPopulationFilter("pending")}
            className={`snap-start shrink-0 flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              populationFilter === "pending"
                ? "bg-amber-950/80 text-amber-300 border border-amber-500/40 font-semibold shadow-sm"
                : pendingConfirmations.length > 0
                ? "text-amber-400/90 hover:text-amber-300 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-amber-400" />
            Pending ({pendingConfirmations.length})
          </button>
          <button
            type="button"
            onClick={() => setPopulationFilter("pedia")}
            className={`snap-start shrink-0 flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              populationFilter === "pedia"
                ? "bg-sky-950/80 text-sky-300 border border-sky-500/40 font-semibold shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Baby className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-sky-400" />
            Pedia ({pediaCount})
          </button>
          <button
            type="button"
            onClick={() => setPopulationFilter("adolescent")}
            className={`snap-start shrink-0 flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              populationFilter === "adolescent"
                ? "bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 font-semibold shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-indigo-400" />
            Teen ({adolescentCount})
          </button>
          <button
            type="button"
            onClick={() => setPopulationFilter("adult")}
            className={`snap-start shrink-0 flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              populationFilter === "adult"
                ? "bg-zinc-800 text-teal-300 font-semibold shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <User className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
            Adult ({adultCount})
          </button>
          <button
            type="button"
            onClick={() => setPopulationFilter("geriatric")}
            className={`snap-start shrink-0 flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              populationFilter === "geriatric" || populationFilter === "old_people"
                ? "bg-amber-950/80 text-amber-300 border border-amber-500/40 font-semibold shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-amber-400" />
            55+ ({geriatricCount})
          </button>
        </div>
      </div>

      {/* Client List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-zinc-900/60 border border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="border-dashed border-zinc-800 bg-zinc-950/40 p-12 text-center">
          <Users className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-200">
            {populationFilter === "pending" ? "No Pending Requests" : "No clients found"}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            {populationFilter === "pending"
              ? "All client accounts in your caseload have been confirmed and are active."
              : searchQuery
              ? "No clients match your filter or search query."
              : "Get started by adding your first pediatric or adult client record."}
          </p>
          {!searchQuery && populationFilter !== "pending" && (
            <div className="flex flex-wrap items-center gap-2 mt-4 justify-center">
              <Button
                onClick={() => openAddModal("link_email")}
                variant="outline"
                size="sm"
                className="gap-1.5 border-teal-500/40 text-teal-300 hover:bg-teal-950/50"
              >
                <Link2 className="w-4 h-4" /> Link by Email
              </Button>
              <Button
                onClick={() => openAddModal("intake")}
                size="sm"
                className="gap-1.5 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold"
              >
                <UserPlus className="w-4 h-4" /> Add Client
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredClients.map((client) => {
            const awaitingCount = client.awaiting_review_count || 0;
            const activePrograms = client.active_programs_count || 0;
            const isPediatric = client.age < 18;

            return (
              <Link
                key={client.id}
                href={`/therapist/clients/${client.id}`}
                className="group block"
              >
                <Card className="hover:border-teal-500/50 hover:bg-zinc-900 transition-all duration-200 p-3 sm:p-5 overflow-hidden">
                  <div className="flex flex-col gap-3">
                    {/* Top row: name + pills */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="text-[15px] sm:text-base font-semibold text-zinc-100 group-hover:text-teal-400 transition-colors">
                          {client.name}
                        </span>

                        {/* Population / Age Pill */}
                        {client.age < 12 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-950/80 border border-sky-500/40 text-sky-300">
                            <Baby className="w-3 h-3 text-sky-400" />
                            Pediatric ({client.age}y)
                          </span>
                        ) : client.age < 18 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-950/80 border border-indigo-500/40 text-indigo-300">
                            <GraduationCap className="w-3 h-3 text-indigo-400" />
                            Adolescent ({client.age}y)
                          </span>
                        ) : client.age < 55 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 border border-zinc-700/60 text-zinc-300">
                            <User className="w-3 h-3 text-zinc-400" />
                            Adult ({client.age}y)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/80 border border-amber-500/40 text-amber-300">
                            <HeartPulse className="w-3 h-3 text-amber-400" />
                            Geriatrics ({client.age}y)
                          </span>
                        )}

                        <span className="text-xs text-zinc-400 hidden sm:inline">
                          • {client.gender}
                        </span>

                        {/* Invitation status badge */}
                        {client.invitation_status === "accepted" ? (
                          <Badge variant="emerald" statusText="Active Care" icon={<CheckCircle2 className="w-3 h-3" />} />
                        ) : client.invitation_status === "declined" ? (
                          <Badge variant="rose" statusText="Link Declined" icon={<AlertCircle className="w-3 h-3" />} />
                        ) : (
                          <Badge
                            variant="amber"
                            statusText="Pending Activation"
                            icon={<Clock className="w-3 h-3" />}
                          />
                        )}

                        {/* Temporary Credential Lifecycle Badge */}
                        {client.temporary_password ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/80 border border-amber-500/40 text-amber-300"
                            title="Temporary password is active until client logs in or changes password"
                          >
                            <Key className="w-3 h-3 text-amber-400" />
                            Temp Creds
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-950/80 border border-teal-500/40 text-teal-300"
                            title="Client has logged in and activated account. Credentials deleted from therapist control."
                          >
                            <Shield className="w-3 h-3 text-teal-400" />
                            Active
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                        <span className="text-zinc-500">Condition:</span> {client.condition}
                        {client.caregiver_name && (
                          <span className="text-sky-400/90 font-medium"> • Caregiver: {client.caregiver_name}</span>
                        )}
                      </p>
                    </div>

                    {/* Bottom row: stats + actions */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/60">
                      <div className="flex items-center gap-2 text-xs overflow-x-auto scrollbar-none">
                        <button
                          type="button"
                          onClick={(e) => copyRowAccessInfo(client, e)}
                          title={
                            client.temporary_password
                              ? "Copy active temporary credentials"
                              : "Client has claimed account. Copy portal login details"
                          }
                          className={`shrink-0 px-2.5 py-1.5 sm:py-1 rounded-lg border transition-colors flex items-center gap-1.5 text-[11px] font-medium h-8 sm:h-auto ${
                            client.temporary_password
                              ? "border-amber-500/40 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300"
                              : "border-zinc-800 bg-zinc-950/70 hover:bg-zinc-800 text-zinc-300 hover:text-teal-300"
                          }`}
                        >
                          {copiedRowId === client.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-teal-400" />
                              <span className="text-teal-400 hidden sm:inline">{client.temporary_password ? "Copied!" : "Copied!"}</span>
                              <span className="text-teal-400 sm:hidden">Copied</span>
                            </>
                          ) : (
                            <>
                              {client.temporary_password ? (
                                <>
                                  <Key className="w-3.5 h-3.5 text-amber-400" />
                                  <span className="hidden sm:inline">Copy Temp Creds</span><span className="sm:hidden">Creds</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                  <span className="hidden sm:inline">Copy Portal Link</span><span className="sm:hidden">Link</span>
                                </>
                              )}
                            </>
                          )}
                        </button>

                        <span className="hidden sm:flex items-center gap-1.5 text-zinc-300 shrink-0">
                          <FileText className="w-3.5 h-3.5 text-zinc-500" />
                          {activePrograms} Active
                        </span>

                        {awaitingCount > 0 ? (
                          <span className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-950/80 border border-teal-500/50 text-teal-300 font-medium text-xs">
                            {awaitingCount} Awaiting
                          </span>
                        ) : (
                          <span className="text-zinc-500 shrink-0 hidden sm:inline text-xs">0 Submissions</span>
                        )}
                      </div>

                      <ChevronRight className="w-5 h-5 sm:w-4 sm:h-4 text-zinc-600 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Add Client Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-zinc-800 bg-zinc-900 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100 p-1 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Mode Tabs */}
            <div className="flex border-b border-zinc-800 px-6 pt-5 gap-3">
              <button
                type="button"
                onClick={() => setModalMode("link_email")}
                className={`pb-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                  modalMode === "link_email"
                    ? "border-teal-400 text-teal-300"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Link2 className="w-4 h-4" />
                Link Client by Email
              </button>
              <button
                type="button"
                onClick={() => setModalMode("intake")}
                className={`pb-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                  modalMode === "intake"
                    ? "border-teal-400 text-teal-300"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <UserPlus className="w-4 h-4" />
                New Intake Profile
              </button>
            </div>

            {modalMode === "link_email" ? (
              <>
                <CardHeader className="pt-4 pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-zinc-100">
                    <Link2 className="w-5 h-5 text-teal-400" />
                    Link Client by Email Address
                  </CardTitle>
                  <p className="text-xs text-zinc-400">
                    Connect an existing registered client or caregiver to your caseload using their email. They will receive a care connection request in their portal.
                  </p>
                </CardHeader>

                <CardContent className="pt-2">
                  {linkError && (
                    <div className="mb-4 rounded-lg bg-red-950/60 border border-red-800 p-3 text-xs text-red-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{linkError}</span>
                    </div>
                  )}

                  {linkSuccess && (
                    <div className="mb-4 rounded-lg bg-emerald-950/60 border border-emerald-800 p-3 text-xs text-emerald-200 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{linkSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handleLinkClientByEmail} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-300">
                        Client or Caregiver Email Address <span className="text-teal-400">*</span>
                      </label>
                      <Input
                        type="email"
                        required
                        placeholder="client@example.com"
                        value={linkEmail}
                        onChange={(e) => setLinkEmail(e.target.value)}
                        className="bg-zinc-950 border-zinc-800 focus-visible:ring-teal-500"
                      />
                      <p className="text-[11px] text-zinc-500">
                        Enter the email address registered with the client's account.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-300">
                        Diagnosis / Clinical Focus (Optional)
                      </label>
                      <Input
                        placeholder="e.g. Fine motor coordination, upper extremity rehabilitation"
                        value={linkCondition}
                        onChange={(e) => setLinkCondition(e.target.value)}
                        className="bg-zinc-950 border-zinc-800"
                      />
                      <p className="text-[11px] text-zinc-500">
                        Optional clinical focus for this connection.
                      </p>
                    </div>

                    <div className="pt-2 flex justify-end gap-2 border-t border-zinc-800/80">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsAddModalOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        isLoading={linkSubmitting}
                        className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold"
                      >
                        <Link2 className="w-4 h-4" />
                        Send Link Invitation
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader className="pt-4 pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-zinc-100">
                    <UserPlus className="w-5 h-5 text-teal-400" />
                    Add Client Record
                  </CardTitle>
                  <p className="text-xs text-zinc-400">
                    Create a patient profile for pediatric or adult care and issue a secure onboarding invitation.
                  </p>
                </CardHeader>

                <CardContent className="pt-2">
                  {formError && (
                    <div className="mb-4 rounded-lg bg-red-950/60 border border-red-800 p-3 text-xs text-red-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {formSuccess && (
                    <div className="mb-4 rounded-lg bg-emerald-950/60 border border-emerald-800 p-3 text-xs text-emerald-200 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{formSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handleAddClient} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-300">Client Full Name</label>
                      <Input
                        required
                        placeholder="e.g. Client full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-zinc-300">Age</label>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                            isPediatricInput
                              ? "bg-sky-950/80 text-sky-300 border border-sky-600/40"
                              : "bg-zinc-800 text-zinc-300"
                          }`}>
                            {isPediatricInput ? "Pediatric (<18)" : "Adult (≥18)"}
                          </span>
                        </div>
                        <Input
                          type="number"
                          required
                          min={1}
                          max={125}
                          placeholder="e.g. 35"
                          value={age}
                          onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-300">Gender</label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        >
                          <option value="Female">Female</option>
                          <option value="Male">Male</option>
                          <option value="Non-binary">Non-binary</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      </div>
                    </div>

                    {/* Conditional Caregiver Field for Pediatric */}
                    {isPediatricInput && (
                      <div className="space-y-1 p-3 rounded-lg bg-sky-950/30 border border-sky-500/30 animate-in fade-in">
                        <label className="text-xs font-medium text-sky-200 flex items-center gap-1.5">
                          <Baby className="w-3.5 h-3.5 text-sky-400" />
                          Caregiver / Guardian Name (Pediatric Co-Runner)
                        </label>
                        <Input
                          placeholder="e.g. Guardian Name (Relationship)"
                          value={caregiverName}
                          onChange={(e) => setCaregiverName(e.target.value)}
                          className="bg-zinc-900 border-sky-500/40"
                        />
                        <p className="text-[11px] text-zinc-400">
                          Caregiver assists with guided video recording and fatigue monitoring.
                        </p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-300">
                        Condition / Diagnosis (Therapist-entered text)
                      </label>
                      <Input
                        required
                        placeholder={
                          isPediatricInput
                            ? "e.g. Bilateral coordination delay, fine motor planning"
                            : "e.g. Post-stroke hemiparesis, upper extremity rehabilitation"
                        }
                        value={condition}
                        onChange={(e) => setCondition(e.target.value)}
                      />
                      <p className="text-[11px] text-zinc-500">Enter clinical description; never AI-generated.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-300">
                        {isPediatricInput ? "Parent / Caregiver Email" : "Client Email (For Secure Invitation)"}
                      </label>
                      <Input
                        type="email"
                        required
                        placeholder="client@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsAddModalOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        isLoading={formSubmitting}
                        className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold"
                      >
                        <Send className="w-4 h-4" />
                        Create & Send Invite
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Credentials Created Modal */}
      {createdCredentials && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-teal-500/50 bg-zinc-900 shadow-2xl relative animate-in fade-in zoom-in-95">
            <CardHeader className="pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-950/80 border border-teal-500/40 text-teal-400 flex items-center justify-center shrink-0">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
                    Client Account Created
                    <Badge variant="emerald" statusText="Ready" />
                  </CardTitle>
                  <p className="text-xs text-zinc-400">
                    Access credentials generated for {createdCredentials.clientName}
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              <div className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800 space-y-3 text-xs">
                <div>
                  <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold block mb-0.5">
                    Portal Sign-In URL
                  </span>
                  <span className="text-zinc-200 font-mono select-all break-all">
                    {typeof window !== "undefined" ? `${window.location.origin}/login` : "/login"}
                  </span>
                </div>

                <div>
                  <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold block mb-0.5">
                    Client Login Email
                  </span>
                  <span className="text-teal-300 font-semibold select-all break-all">
                    {createdCredentials.email}
                  </span>
                </div>

                <div>
                  <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold block mb-0.5">
                    Temporary Initial Password
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-amber-300 font-mono text-sm font-bold bg-amber-950/40 px-2.5 py-1 rounded border border-amber-500/40 select-all">
                      {createdCredentials.temporaryPassword}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-teal-950/40 border border-teal-500/30 text-[11px] text-teal-200/90 leading-relaxed flex items-start gap-2">
                <Shield className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Privacy Rule:</strong> You can view and copy these temporary credentials until the client logs in for the first time or updates their password. Once they log in, credentials are automatically and permanently deleted from therapist control.
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
                <Button
                  type="button"
                  onClick={() => copyCredentialsText(createdCredentials)}
                  className="w-full sm:w-auto gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold px-5"
                >
                  {copiedCredentials ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied Credentials!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Credentials
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCreatedCredentials(null);
                    setCopiedCredentials(false);
                  }}
                  className="w-full sm:w-auto text-zinc-400 hover:text-zinc-200"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
