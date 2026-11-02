"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Send,
  BookOpen,
  User,
  Stethoscope,
  Baby,
  Users,
  Search,
  GraduationCap,
  HeartPulse,
  ChevronLeft,
  ExternalLink,
  PlusCircle,
  CheckCircle2,
  Trash2,
  ImagePlus,
  X,
  Loader2,
} from "lucide-react";
import { compressImageFile, isImageFile } from "@/lib/image-compress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MentionTextarea, ProgramMentionOption } from "@/components/ui/mention-textarea";
import { Message, Patient } from "@/types/database";
import { useAuth } from "@/lib/supabase/auth-context";

export default function TherapistMessagesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading messages...</div>}>
      <TherapistMessagesContent />
    </Suspense>
  );
}

function TherapistMessagesContent() {
  const { user, profile } = useAuth();

  const searchParams = useSearchParams();
  const initialPatientId = searchParams.get("patientId") || "";

  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [availablePrograms, setAvailablePrograms] = useState<ProgramMentionOption[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedMentionProgram, setSelectedMentionProgram] = useState<ProgramMentionOption | null>(null);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingCaseload, setLoadingCaseload] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "pedia" | "adolescent" | "adult" | "geriatric" | "old_people">("all");
  const [mobileView, setMobileView] = useState<"list" | "chat">("chat");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const unreadFetchRef = useRef<string | null>(null);

  // Helper to categorize patient demographic
  const getPatientCategory = (p: Patient): "pedia" | "adolescent" | "adult" | "geriatric" | "old_people" => {
    if (p.client_category) return p.client_category as any;
    if (p.age < 12) return "pedia";
    if (p.age < 18) return "adolescent";
    if (p.age >= 55) return "geriatric";
    return "adult";
  };

  // Fetch all patients for caseload selector
  useEffect(() => {
    if (!user?.id) {
      setLoadingCaseload(false);
      return;
    }
    const params = new URLSearchParams();
    params.set("therapistId", user.id);

    fetch(`/api/therapist/clients?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.clients && data.clients.length > 0) {
          setPatients(data.clients);
          if (!selectedPatientId || !data.clients.some((c: Patient) => c.id === selectedPatientId)) {
            setSelectedPatientId(data.clients[0].id);
          }
        } else {
          setPatients([]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCaseload(false));
  }, [user?.id, selectedPatientId]);

  const currentPatient =
    patients.find((p) => p.id === selectedPatientId) ||
    (patients.length > 0 ? patients[0] : null);

  const isPediatric =
    (currentPatient?.age ?? 0) < 18 || (currentPatient as any)?.client_category === "pedia";

  const fetchMessages = async () => {
    if (!selectedPatientId) {
      setMessages([]);
      return;
    }
    if (!user?.id) {
      setLoadingMessages(false);
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set("patientId", selectedPatientId);
      params.set("requesterId", user.id);
      const res = await fetch(`/api/messages?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.messages) {
        setMessages(data.messages);
      } else if (data.error) {
        // keep previous messages, surface empty only on 404 with no caseload
        console.warn("messages fetch error", data.error);
      }
      if (data.availablePrograms) {
        setAvailablePrograms(data.availablePrograms);
      }
    } catch {
      // error
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchUnread = async () => {
    if (!user?.id) return;
    // dedupe rapid polling
    const key = user.id;
    if (unreadFetchRef.current === key && document.hidden) return;
    try {
      const res = await fetch(`/api/messages/unread?requesterId=${user.id}`);
      const data = await res.json();
      if (res.ok && data.perPatient) {
        setUnreadMap(data.perPatient);
        // Broadcast total for nav badge
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("aruga:messages-unread", { detail: { totalUnread: data.totalUnread ?? 0, perPatient: data.perPatient } }));
        }
      }
    } catch {}
  };

  const markRead = async (patientId: string) => {
    if (!user?.id || !patientId) return;
    // optimistic: zero out badge for this patient
    setUnreadMap((prev) => {
      if ((prev[patientId] ?? 0) === 0) return prev;
      const next = { ...prev, [patientId]: 0 };
      const total = Object.values(next).reduce((a, b) => a + b, 0);
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("aruga:messages-unread", { detail: { totalUnread: total, perPatient: next } }));
      return next;
    });
    try {
      await fetch("/api/messages/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, requesterId: user.id }),
      });
      // refresh unread counts after mark
      fetchUnread();
    } catch {}
  };

  useEffect(() => {
    if (!selectedPatientId || !user?.id) return;
    setLoadingMessages(true);
    fetchMessages();
    fetchUnread();
    // mark read when opening thread
    markRead(selectedPatientId);
    const interval = setInterval(() => {
      fetchMessages();
      fetchUnread();
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedPatientId, user?.id]);

  // Also poll unread even when no patient selected (for badge)
  useEffect(() => {
    if (!user?.id) return;
    fetchUnread();
    const iv = setInterval(fetchUnread, 10000);
    const onVis = () => { if (document.visibilityState === "visible") fetchUnread(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [user?.id]);

  // When messages are fetched, if latest message is from other party and thread is open, mark read
  useEffect(() => {
    if (!selectedPatientId || !user?.id || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last && last.sender_id !== user.id) {
      // debounce mark read by 800ms to ensure user has seen content
      const t = setTimeout(() => markRead(selectedPatientId), 800);
      return () => clearTimeout(t);
    }
  }, [messages, selectedPatientId, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFiles = async (files: FileList | File[]) => {
    const f = Array.from(files)[0];
    if (!f || !isImageFile(f)) return;
    try {
      const { file, previewUrl: url } = await compressImageFile(f);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPendingFile(file);
      setPreviewUrl(url);
    } catch {
      setPendingFile(f);
      setPreviewUrl(URL.createObjectURL(f));
    }
  };
  const clearPending = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || (!inputText.trim() && !pendingFile) || !selectedPatientId) return;
    setSending(true);
    try {
      let res: Response;
      if (pendingFile) {
        const fd = new FormData();
        fd.set("patientId", selectedPatientId);
        if (user?.id) fd.set("senderId", user.id);
        fd.set("senderRole", "therapist");
        fd.set("text", inputText.trim() || "📷 Photo");
        if (selectedMentionProgram?.id) fd.set("referencedProgramId", selectedMentionProgram.id);
        fd.set("image", pendingFile);
        res = await fetch("/api/messages", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId: selectedPatientId, senderId: user?.id, senderRole: "therapist", text: inputText, referencedProgramId: selectedMentionProgram?.id || null }),
        });
      }
      const data = await res.json();
      if (res.ok && data.message) {
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
        setInputText("");
        setSelectedMentionProgram(null);
        clearPending();
        // therapist has now seen up to latest
        markRead(selectedPatientId);
      }
    } catch {
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;

    setDeletingId(messageId);
    // Optimistic delete
    setMessages((prev) => prev.filter((m) => m.id !== messageId));

    try {
      const res = await fetch(`/api/messages?id=${messageId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        fetchMessages();
      }
    } catch {
      fetchMessages();
    } finally {
      setDeletingId(null);
    }
  };

  // Filter patients by search query and demographic category
  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.condition.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.caregiver_name && p.caregiver_name.toLowerCase().includes(q));

    const category = getPatientCategory(p);
    const matchesCategory =
      categoryFilter === "all" ||
      category === categoryFilter ||
      ((categoryFilter === "geriatric" || categoryFilter === "old_people") &&
        (category === "geriatric" || category === "old_people"));

    return matchesSearch && matchesCategory;
  });

  if (loadingCaseload) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-teal-400" /></div>
        <p className="text-xs text-zinc-400">Loading caseload &amp; conversations...</p>
      </div>
    );
  }
  if (!loadingCaseload && patients.length === 0) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col justify-center items-center text-center p-8">
        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-teal-400">
          <MessageSquare className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-zinc-100">No Patient Caseload Enrolled Yet</h2>
          <p className="text-xs text-zinc-400 max-w-md">
            You do not have any enrolled clients in your caseload yet. Once a client is connected or enrolled, their dedicated asynchronous care thread will appear here.
          </p>
        </div>
        <Link href="/therapist/clients">
          <Button className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold">
            <Users className="w-4 h-4" />
            Manage & Enroll Patients
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-7xl mx-auto h-[calc(100dvh-7rem)] sm:h-[calc(100vh-8rem)] flex flex-col">
      {/* Top Bar with Caseload Summary & Global Client Selector */}
      <div className="flex flex-col gap-3 border-b border-zinc-800 pb-3 shrink-0">

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-950/80 border border-teal-500/40 text-teal-400 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span>Messages</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                {patients.length} {patients.length === 1 ? "Client" : "Clients"} in Caseload
              </span>
            </h1>
            <p className="text-xs text-zinc-400">Messages with your clients</p>
          </div>
        </div>

        {/* Global Client Switcher Dropdown (Always visible regardless of client count) */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-zinc-400 font-medium hidden sm:inline-block">Active Client:</span>
          <select
            value={selectedPatientId}
            onChange={(e) => {
              setSelectedPatientId(e.target.value);
              setMobileView("chat");
            }}
            className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 font-medium shadow-sm max-w-[240px] truncate"
          >
            {patients.map((p) => {
              const cat = getPatientCategory(p);
              const catLabel =
                cat === "pedia"
                  ? "Pediatric"
                  : cat === "adolescent"
                  ? "Adolescent"
                  : cat === "geriatric" || cat === "old_people"
                  ? "Geriatrics"
                  : "Adult";
              return (
                <option key={p.id} value={p.id}>
                  {p.name} ({catLabel}, {p.age}y)
                </option>
              );
            })}
          </select>

          {/* Mobile view toggle button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobileView(mobileView === "list" ? "chat" : "list")}
            className="md:hidden text-xs h-9 border-zinc-700 gap-1.5"
          >
            {mobileView === "chat" ? (
              <>
                <Users className="w-3.5 h-3.5 text-teal-400" />
                <span>Caseload ({patients.length})</span>
              </>
            ) : (
              <>
                <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                <span>Chat Thread</span>
              </>
            )}
          </Button>

          <Link href="/therapist/clients" className="hidden lg:inline-block">
            <Button variant="ghost" size="sm" className="text-xs h-9 text-zinc-400 hover:text-zinc-200 gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Manage Caseload
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Multi-Client Split-View Layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0">
        {/* Left Column: Client Selector / Caseload Directory */}
        <div
          className={`md:col-span-4 lg:col-span-4 flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-3 min-h-0 ${
            mobileView === "list" ? "flex" : "hidden md:flex"
          }`}
        >
          {/* Header of Client Selector */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                Select Client Conversation
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">
              {filteredPatients.length} of {patients.length}
            </span>
          </div>

          {/* Quick Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients by name or diagnosis..."
              className="pl-8 text-xs h-8 bg-zinc-950 border-zinc-800 focus-visible:ring-teal-500"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            {(
              [
                { id: "all", label: "All" },
                { id: "pedia", label: "Pedia" },
                { id: "adolescent", label: "Adolescent" },
                { id: "adult", label: "Adult" },
                { id: "geriatric", label: "Geriatrics" },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setCategoryFilter(filter.id)}
                className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap transition-colors ${
                  categoryFilter === filter.id
                    ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Scrollable Client List (Always renders all caseload clients) */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
            {filteredPatients.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 space-y-1">
                <p>No clients match "{searchQuery}"</p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCategoryFilter("all");
                  }}
                  className="text-teal-400 hover:underline text-[11px]"
                >
                  Clear search filters
                </button>
              </div>
            ) : (
              filteredPatients.map((p) => {
                const isSelected = p.id === selectedPatientId;
                const cat = getPatientCategory(p);
                const unread = unreadMap[p.id] ?? 0;
                const hasUnread = unread > 0;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setMobileView("chat");
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-3 group relative ${
                      isSelected
                        ? "bg-teal-950/40 border-teal-500/50 shadow-sm"
                        : hasUnread
                        ? "bg-zinc-900 border-amber-500/40 hover:border-amber-500/60 hover:bg-zinc-800/50"
                        : "bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-800/40"
                    }`}
                  >
                    {/* Demographic Avatar Icon */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${
                        cat === "pedia"
                          ? "bg-sky-950/80 border-sky-500/40 text-sky-400"
                          : cat === "adolescent"
                          ? "bg-indigo-950/80 border-indigo-500/40 text-indigo-400"
                          : cat === "geriatric" || cat === "old_people"
                          ? "bg-amber-950/80 border-amber-500/40 text-amber-400"
                          : "bg-teal-950/80 border-teal-500/40 text-teal-400"
                      }`}
                    >
                      {cat === "pedia" ? (
                        <Baby className="w-4 h-4" />
                      ) : cat === "adolescent" ? (
                        <GraduationCap className="w-4 h-4" />
                      ) : cat === "geriatric" || cat === "old_people" ? (
                        <HeartPulse className="w-4 h-4" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>

                    {/* Client Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs truncate ${
                            hasUnread ? "font-extrabold text-zinc-100" : "font-semibold"
                          } ${isSelected ? "text-teal-200" : hasUnread ? "text-zinc-100" : "text-zinc-200 group-hover:text-zinc-100"}`}
                        >
                          {p.name}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-medium shrink-0 ${
                            cat === "pedia"
                              ? "bg-sky-950/70 text-sky-300 border border-sky-500/30"
                              : cat === "adolescent"
                              ? "bg-indigo-950/70 text-indigo-300 border border-indigo-500/30"
                              : cat === "old_people"
                              ? "bg-amber-950/70 text-amber-300 border border-amber-500/30"
                              : "bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          {cat === "pedia"
                            ? `Pedia • ${p.age}y`
                            : cat === "adolescent"
                            ? `Teen • ${p.age}y`
                            : cat === "geriatric" || cat === "old_people"
                            ? `Geriatrics • ${p.age}y`
                            : `Adult • ${p.age}y`}
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">{p.condition}</p>

                      {p.caregiver_name && (
                        <p className="text-[10px] text-sky-400/90 truncate mt-0.5">
                          Caregiver: {p.caregiver_name}
                        </p>
                      )}
                    </div>

                    {hasUnread && !isSelected && (
                      <span className="absolute right-2 top-2 flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-zinc-950 shadow-md">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                    {hasUnread && isSelected && (
                      <span className="absolute right-2 top-2 flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-zinc-950 shadow-md">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                    {!hasUnread && isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 absolute right-2 top-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation Thread */}
        <div
          className={`md:col-span-8 lg:col-span-8 flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 min-h-0 space-y-3 ${
            mobileView === "chat" ? "flex" : "hidden md:flex"
          }`}
        >
          {/* Thread Header */}
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 pb-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileView("list")}
                className="md:hidden text-zinc-400 hover:text-zinc-200 h-8 w-8"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  isPediatric
                    ? "bg-sky-950/80 border-sky-500/40 text-sky-400"
                    : (currentPatient as any)?.client_category === "geriatric" || (currentPatient as any)?.client_category === "old_people" || (currentPatient?.age != null && currentPatient.age >= 55)
                    ? "bg-amber-950/80 border-amber-500/40 text-amber-400"
                    : "bg-teal-950/80 border-teal-500/40 text-teal-400"
                }`}
              >
                {isPediatric ? (
                  <Baby className="w-5 h-5" />
                ) : (currentPatient as any)?.client_category === "geriatric" || (currentPatient as any)?.client_category === "old_people" || (currentPatient?.age != null && currentPatient.age >= 55) ? (
                  <HeartPulse className="w-5 h-5" />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-zinc-100 truncate">
                    {currentPatient?.name || "Select Client"}
                  </h2>
                  {currentPatient && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        isPediatric
                          ? "bg-sky-950/80 border border-sky-500/40 text-sky-300"
                          : (currentPatient as any)?.client_category === "geriatric" || (currentPatient as any)?.client_category === "old_people" || (currentPatient?.age != null && currentPatient.age >= 55)
                          ? "bg-amber-950/80 border border-amber-500/40 text-amber-300"
                          : "bg-zinc-800 border border-zinc-700/60 text-zinc-300"
                      }`}
                    >
                      {isPediatric
                        ? `Pediatric (${currentPatient.age}y)`
                        : (currentPatient as any)?.client_category === "geriatric" || (currentPatient as any)?.client_category === "old_people" || (currentPatient?.age != null && currentPatient.age >= 55)
                        ? `Geriatrics (${currentPatient.age}y)`
                        : `Adult (${currentPatient.age}y)`}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-zinc-400 truncate">
                  {currentPatient?.condition || "Personalized Occupational Therapy"}
                  {currentPatient?.caregiver_name && (
                    <span className="text-sky-400 ml-1.5">• Caregiver: {currentPatient.caregiver_name}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Quick Actions for Current Client */}
            {currentPatient && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Link href={`/therapist/clients/${currentPatient.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 border-zinc-700 text-zinc-300 hover:text-teal-300 gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span className="hidden sm:inline">Profile</span>
                  </Button>
                </Link>
                <Link href={`/therapist/clients/${currentPatient.id}/programs/new`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 border-teal-500/40 text-teal-300 hover:bg-teal-950/50 gap-1"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span className="hidden sm:inline">New Home Program</span>
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Chat Messages Stream Area - drop zone */}
          <Card
            className={`flex-1 overflow-y-auto border-zinc-800 bg-zinc-900/50 p-4 space-y-3.5 min-h-0 ${dragOver ? "ring-2 ring-teal-500/50" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); }}
          >
            {dragOver && <div className="text-center text-xs text-teal-300 py-1 border border-dashed border-teal-500/40 rounded-lg bg-teal-950/30">Drop photo to attach</div>}
            {loadingMessages ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-xs text-zinc-400">
                <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                Loading conversation...
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500 space-y-2">
                <MessageSquare className="w-8 h-8 text-zinc-600" />
                <div className="font-semibold text-zinc-300 text-sm">
                  No Messages with {currentPatient?.name || "Client"} Yet
                </div>
                <p className="text-xs max-w-sm">
                  Send an initial care note, instruction, or cite an assigned home program using the composer below.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe =
                  msg.sender_id === user?.id ||
                  (msg as any).sender_profile?.role === "therapist";

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-1">
                      {isMe ? (
                        <>
                          <span className="font-semibold text-teal-400">
                            {profile?.display_name ? `${profile.display_name} (You)` : "Clinician (You)"}
                          </span>
                          <Stethoscope className="w-3 h-3 text-teal-400" />
                        </>
                      ) : (
                        <>
                          {isPediatric ? (
                            <Baby className="w-3 h-3 text-sky-400" />
                          ) : (currentPatient as any)?.client_category === "geriatric" || (currentPatient as any)?.client_category === "old_people" || (currentPatient?.age != null && currentPatient.age >= 55) ? (
                            <HeartPulse className="w-3 h-3 text-amber-400" />
                          ) : (
                            <User className="w-3 h-3 text-zinc-400" />
                          )}
                          <span className="font-semibold text-zinc-300">
                            {(msg as any).sender_profile?.display_name || currentPatient?.name || "Patient"}
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      {/* Delete Message Action */}
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id)}
                        disabled={deletingId === msg.id}
                        title="Delete message"
                        className="ml-1 text-zinc-500 hover:text-rose-400 transition-colors p-0.5 rounded hover:bg-rose-950/40 opacity-70 hover:opacity-100"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 text-xs sm:text-sm leading-relaxed ${
                        isMe
                          ? "bg-teal-950/80 border border-teal-500/40 text-zinc-100 rounded-tr-sm"
                          : "bg-zinc-800/90 border border-zinc-700/60 text-zinc-100 rounded-tl-sm shadow-sm"
                      }`}
                    >
                      {msg.body !== "📷 Photo" && <p className="whitespace-pre-wrap">{msg.body}</p>}
                      {(msg as any).attachment_url && (
                        <a href={(msg as any).attachment_url} target="_blank" rel="noopener noreferrer" className="block mt-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={(msg as any).attachment_url} alt="attachment" className="rounded-lg border border-zinc-700 max-h-64 w-auto object-contain bg-zinc-950" loading="lazy" />
                        </a>
                      )}
                      {msg.body === "📷 Photo" && !(msg as any).attachment_url && <p>{msg.body}</p>}
                      {/* Referenced Program Mention Chip */}
                      {msg.referenced_program_id && (
                        <div className="mt-2.5 pt-2 border-t border-zinc-700/50 flex items-center justify-between gap-1.5 text-[11px] text-teal-300">
                          <Link
                            href={`/therapist/clients/${currentPatient?.id}`}
                            className="flex items-center gap-1.5 hover:text-teal-200 hover:underline transition-colors truncate"
                            title="View client profile & home program details"
                          >
                            <BookOpen className="w-3.5 h-3.5 shrink-0 text-teal-400" />
                            <span className="truncate">
                              Referenced Home Program:{" "}
                              <span className="font-semibold">
                                {(msg as any).referenced_program?.title || "Assigned Tabletop Home Program"}
                              </span>
                            </span>
                            <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </Card>

          {/* Input Composer */}
          <form onSubmit={handleSend} className="shrink-0 space-y-2" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); }}>
            {previewUrl && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="preview" className="h-16 w-16 object-cover rounded border border-zinc-700" />
                <span className="text-xs text-zinc-400 flex-1 truncate">{pendingFile?.name} • {(pendingFile!.size / 1024).toFixed(0)} KB</span>
                <button type="button" onClick={clearPending} className="p-1 rounded hover:bg-zinc-800 text-zinc-400"><X className="w-4 h-4" /></button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
            <MentionTextarea
              value={inputText}
              onChange={setInputText}
              selectedProgram={selectedMentionProgram}
              onSelectProgram={setSelectedMentionProgram}
              availablePrograms={availablePrograms}
              placeholder={`Write a message to ${currentPatient?.name || "client"}... (Type @ to attach an assigned home program)`}
              className="min-h-[75px]"
            />

            <div className="flex items-center justify-between text-xs text-zinc-500 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-7 px-2 border-zinc-700 text-zinc-300 gap-1"><ImagePlus className="w-3.5 h-3.5" />Photo</Button>
              <span className="hidden sm:inline">Drag & drop photo • <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">@</kbd> program</span>
              <Button type="submit" isLoading={sending} disabled={(!inputText.trim() && !pendingFile) || !selectedPatientId} className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold ml-auto">
                <Send className="w-3.5 h-3.5" />Send
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
