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
  User,
  Filter,
  Copy,
  Check,
  Key,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/supabase/auth-context";
import { isDemoUser } from "@/lib/supabase/demo-helpers";
import { Patient } from "@/types/database";

export default function TherapistClientsPage() {
  const { user, profile } = useAuth();
  const isDemo = isDemoUser(user, profile);
  const [clients, setClients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [populationFilter, setPopulationFilter] = useState<"all" | "adult" | "pediatric">("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">(58);
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

  const fetchClients = async () => {
    try {
      setLoading(true);
      const url = user?.id
        ? `/api/therapist/clients?therapistId=${user.id}&isDemo=${isDemo}`
        : `/api/therapist/clients?isDemo=${isDemo}`;
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
  }, [user?.id, isDemo]);

  const isPediatricInput = typeof age === "number" && age < 18;

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formSubmitting) return;
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
          therapistId: user?.id || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add client");
      }

      setFormSuccess(`Client ${name} created. Secure setup invitation issued.`);
      setName("");
      setCondition("");
      setEmail("");
      setCaregiverName("");
      setIsAddModalOpen(false);
      fetchClients();

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
      if (populationFilter === "adult") return c.age >= 18;
      if (populationFilter === "pediatric") return c.age < 18;
      return true;
    })
    .filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.condition.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.caregiver_name && c.caregiver_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  const adultCount = clients.filter((c) => c.age >= 18).length;
  const pediatricCount = clients.filter((c) => c.age < 18).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-teal-400" />
            Clients
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Manage your caseload across pediatric and adult care, assign routines, and review tabletop submissions.
          </p>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold self-start sm:self-auto shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Add Client
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search by client name, condition, or caregiver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-900/90 border-zinc-800"
          />
        </div>

        {/* Population Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-zinc-900/80 border border-zinc-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setPopulationFilter("all")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              populationFilter === "all"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All ({clients.length})
          </button>
          <button
            type="button"
            onClick={() => setPopulationFilter("adult")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              populationFilter === "adult"
                ? "bg-zinc-800 text-teal-300 font-semibold shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <User className="w-3 h-3" />
            Adult ({adultCount})
          </button>
          <button
            type="button"
            onClick={() => setPopulationFilter("pediatric")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              populationFilter === "pediatric"
                ? "bg-sky-950/80 text-sky-300 border border-sky-500/40 font-semibold shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Baby className="w-3 h-3 text-sky-400" />
            Pediatric ({pediatricCount})
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
          <h3 className="text-base font-semibold text-zinc-200">No clients found</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? "No clients match your filter or search query."
              : "Get started by adding your first pediatric or adult client record."}
          </p>
          {!searchQuery && (
            <Button
              onClick={() => setIsAddModalOpen(true)}
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5"
            >
              <UserPlus className="w-4 h-4" /> Add Client
            </Button>
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
                <Card className="hover:border-teal-500/50 hover:bg-zinc-900 transition-all duration-200 p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left: Info */}
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-zinc-100 group-hover:text-teal-400 transition-colors">
                          {client.name}
                        </span>

                        {/* Population / Age Pill */}
                        {isPediatric ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-950/80 border border-sky-500/40 text-sky-300">
                            <Baby className="w-3 h-3 text-sky-400" />
                            Pediatric ({client.age}y)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 border border-zinc-700/60 text-zinc-300">
                            <User className="w-3 h-3 text-zinc-400" />
                            Adult ({client.age}y)
                          </span>
                        )}

                        <span className="text-xs text-zinc-400">
                          • {client.gender}
                        </span>

                        {/* Invitation status badge */}
                        {client.invitation_status === "accepted" ? (
                          <Badge variant="emerald" statusText="Active Care" icon={<CheckCircle2 className="w-3 h-3" />} />
                        ) : client.invitation_status === "failed" ? (
                          <Badge variant="rose" statusText="Invite Failed" icon={<AlertCircle className="w-3 h-3" />} />
                        ) : (
                          <Badge variant="amber" statusText="Invite Pending" icon={<Clock className="w-3 h-3" />} />
                        )}

                        {/* Temporary Credential Lifecycle Badge */}
                        {client.temporary_password ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/80 border border-amber-500/40 text-amber-300"
                            title="Temporary password is active until client logs in or changes password"
                          >
                            <Key className="w-3 h-3 text-amber-400" />
                            Temp Creds Active
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-950/80 border border-teal-500/40 text-teal-300"
                            title="Client has logged in and claimed account. Credentials deleted from therapist control."
                          >
                            <Shield className="w-3 h-3 text-teal-400" />
                            Account Claimed
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>
                          <span className="text-zinc-500">Condition:</span> {client.condition}
                        </span>
                        {client.caregiver_name && (
                          <span className="text-sky-400/90 font-medium">
                            • Caregiver: {client.caregiver_name}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Right: Stats & Chevron */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
                      <div className="flex items-center gap-3 text-xs">
                        {/* Copy Access Info / Temp Creds Button */}
                        <button
                          type="button"
                          onClick={(e) => copyRowAccessInfo(client, e)}
                          title={
                            client.temporary_password
                              ? "Copy active temporary credentials"
                              : "Client has claimed account. Copy portal login details"
                          }
                          className={`px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1.5 text-[11px] font-medium ${
                            client.temporary_password
                              ? "border-amber-500/40 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300"
                              : "border-zinc-800 bg-zinc-950/70 hover:bg-zinc-800 text-zinc-300 hover:text-teal-300"
                          }`}
                        >
                          {copiedRowId === client.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-teal-400" />
                              <span className="text-teal-400 font-medium">
                                {client.temporary_password ? "Copied Creds!" : "Copied Portal Link!"}
                              </span>
                            </>
                          ) : (
                            <>
                              {client.temporary_password ? (
                                <>
                                  <Key className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Copy Temp Creds</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Copy Portal Link</span>
                                </>
                              )}
                            </>
                          )}
                        </button>

                        {/* Active programs count */}
                        <div className="flex items-center gap-1.5 text-zinc-300">
                          <FileText className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{activePrograms} Active</span>
                        </div>

                        {/* Awaiting Review Badge */}
                        {awaitingCount > 0 ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-950/80 border border-teal-500/50 text-teal-300 font-medium">
                            <span>{awaitingCount} Awaiting Review</span>
                          </div>
                        ) : (
                          <span className="text-zinc-500">0 Submissions</span>
                        )}
                      </div>

                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
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

            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-zinc-100">
                <UserPlus className="w-5 h-5 text-teal-400" />
                Add Client Record
              </CardTitle>
              <p className="text-xs text-zinc-400">
                Create a patient profile for pediatric or adult care and issue a secure onboarding invitation.
              </p>
            </CardHeader>

            <CardContent>
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
                    placeholder="e.g. Leo Chen or Marcus Vance"
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
                      placeholder="e.g. 6 or 58"
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
                      placeholder="e.g. Sarah Chen (Mother)"
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
                        ? "e.g. Pediatric Bilateral Coordination Delay & Pincer Grasp Development"
                        : "e.g. Right ischemic CVA with upper extremity hemiparesis"
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
