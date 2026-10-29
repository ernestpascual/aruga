"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Send,
  BookOpen,
  AlertTriangle,
  User,
  Stethoscope,
  Baby,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MentionTextarea, ProgramMentionOption } from "@/components/ui/mention-textarea";
import { siteConfig } from "@/config/site";
import { Message, Patient } from "@/types/database";
import { useAuth } from "@/lib/supabase/auth-context";
import { isDemoUser } from "@/lib/supabase/demo-helpers";
import {
  DEMO_PATIENT_ID,
  DEMO_PEDIATRIC_PATIENT_ID,
} from "@/lib/supabase/mock-store";

export default function TherapistMessagesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading messages...</div>}>
      <TherapistMessagesContent />
    </Suspense>
  );
}

function TherapistMessagesContent() {
  const { user, profile } = useAuth();
  const isDemo = isDemoUser(user, profile);

  const searchParams = useSearchParams();
  const initialPatientId = searchParams.get("patientId") || (isDemo ? DEMO_PATIENT_ID : "");

  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [availablePrograms, setAvailablePrograms] = useState<ProgramMentionOption[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedMentionProgram, setSelectedMentionProgram] = useState<ProgramMentionOption | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingCaseload, setLoadingCaseload] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all patients for caseload selector
  useEffect(() => {
    const params = new URLSearchParams();
    if (user?.id) params.set("therapistId", user.id);
    params.set("isDemo", isDemo ? "true" : "false");

    fetch(`/api/therapist/clients?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.clients) {
          setPatients(data.clients);
          if (!selectedPatientId && data.clients.length > 0) {
            setSelectedPatientId(data.clients[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCaseload(false));
  }, [user?.id, isDemo, selectedPatientId]);

  const currentPatient =
    patients.find((p) => p.id === selectedPatientId) ||
    (isDemo
      ? {
          id: selectedPatientId || DEMO_PATIENT_ID,
          name: selectedPatientId === DEMO_PEDIATRIC_PATIENT_ID ? "Leo Chen" : "Marcus Vance",
          age: selectedPatientId === DEMO_PEDIATRIC_PATIENT_ID ? 6 : 58,
          caregiver_name: selectedPatientId === DEMO_PEDIATRIC_PATIENT_ID ? "Sarah Chen (Mother)" : null,
        }
      : null);

  const isPediatric = ((currentPatient?.age ?? 0) < 18) || (currentPatient as any)?.client_category === "pedia";

  const fetchMessages = async () => {
    if (!selectedPatientId) {
      setMessages([]);
      return;
    }
    try {
      const res = await fetch(`/api/messages?patientId=${selectedPatientId}&isDemo=${isDemo}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
      if (data.availablePrograms) {
        setAvailablePrograms(data.availablePrograms);
      }
    } catch {
      // error
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedPatientId, isDemo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || !inputText.trim() || !selectedPatientId) return;

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatientId,
          senderId: user?.id,
          senderRole: "therapist",
          text: inputText,
          referencedProgramId: selectedMentionProgram?.id || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setInputText("");
        setSelectedMentionProgram(null);
      }
    } catch {
      // error
    } finally {
      setSending(false);
    }
  };

  if (!isDemo && !loadingCaseload && patients.length === 0) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col justify-center items-center text-center p-8">
        <div className="p-4 rounded-full bg-zinc-900 border border-zinc-800 text-teal-400">
          <MessageSquare className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-zinc-100">No Patient Caseload Enrolled Yet</h2>
          <p className="text-xs text-zinc-400 max-w-md">
            You have not enrolled any clients or patients into your caseload yet. To begin a direct communication thread with clinical program citations, enroll a patient first.
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
    <div className="space-y-4 max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Header with Patient Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="w-5 h-5 text-teal-400" />
          <div>
            <h1 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span>Care Thread: {currentPatient?.name || "Select Patient"}</span>
              {currentPatient && (
                isPediatric ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-950/80 border border-sky-500/40 text-sky-300">
                    <Baby className="w-3 h-3 text-sky-400" />
                    Pediatric ({currentPatient.age}y)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 border border-zinc-700/60 text-zinc-300">
                    <User className="w-3 h-3 text-zinc-400" />
                    Adult ({currentPatient.age}y)
                  </span>
                )
              )}
            </h1>
            {currentPatient?.caregiver_name && (
              <p className="text-[11px] text-sky-400/90 font-medium">
                Caregiver / Co-Participant: {currentPatient.caregiver_name}
              </p>
            )}
          </div>
        </div>

        {/* Patient Switcher Tabs */}
        {isDemo ? (
          <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900/80 border border-zinc-800">
            <button
              type="button"
              onClick={() => setSelectedPatientId(DEMO_PATIENT_ID)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedPatientId === DEMO_PATIENT_ID
                  ? "bg-zinc-800 text-teal-300 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <User className="w-3 h-3" />
              <span>Marcus (Adult)</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPatientId(DEMO_PEDIATRIC_PATIENT_ID)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedPatientId === DEMO_PEDIATRIC_PATIENT_ID
                  ? "bg-sky-950 text-sky-300 border border-sky-500/40 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Baby className="w-3 h-3 text-sky-400" />
              <span>Leo (Pediatric)</span>
            </button>
          </div>
        ) : (
          patients.length > 1 && (
            <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900/80 border border-zinc-800">
              {patients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPatientId(p.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    selectedPatientId === p.id
                      ? "bg-zinc-800 text-teal-300 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <User className="w-3 h-3" />
                  <span>{p.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {/* Non-emergency Clinical Notice Banner */}
      <div className="rounded-lg bg-zinc-900/90 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-400 flex items-center gap-2.5 shrink-0">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>{siteConfig.messagingNotice}</span>
      </div>

      {/* Chat Messages Log Area */}
      <Card className="flex-1 overflow-y-auto border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500 space-y-2">
            <MessageSquare className="w-8 h-8 text-zinc-600" />
            <div className="font-semibold text-zinc-300 text-sm">No Messages in this Thread</div>
            <p className="text-xs max-w-sm">
              Send a message below to direct rehabilitation steps, share instructions, or cite active home routines.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe =
            msg.sender_id === user?.id ||
            msg.sender_id === "11111111-1111-4111-8111-111111111111" ||
            (msg as any).sender_profile?.role === "therapist";

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-1">
                {isMe ? (
                  <>
                    <span className="font-semibold text-teal-400">
                      {profile?.display_name ? `${profile.display_name} (You)` : "Dr. Elena Ramos (You)"}
                    </span>
                    <Stethoscope className="w-3 h-3 text-teal-400" />
                  </>
                ) : (
                  <>
                    {isPediatric ? <Baby className="w-3 h-3 text-sky-400" /> : <User className="w-3 h-3 text-zinc-400" />}
                    <span className="font-semibold text-zinc-300">
                      {(msg as any).sender_profile?.display_name || currentPatient?.name || "Patient"}
                    </span>
                  </>
                )}
                <span>•</span>
                <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>

              <div
                className={`max-w-[80%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  isMe
                    ? "bg-teal-950/80 border border-teal-500/40 text-zinc-100 rounded-tr-sm"
                    : "bg-zinc-800/80 border border-zinc-700/60 text-zinc-100 rounded-tl-sm"
                }`}
              >
                <p>{msg.body}</p>

                {/* Referenced Program Mention Chip */}
                {msg.referenced_program_id && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-700/50 flex items-center gap-1.5 text-[11px] text-teal-300">
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Referenced Home Routine:{" "}
                      <span className="font-semibold underline">
                        {(msg as any).referenced_program?.title || (isPediatric ? "Playful Pincer Grasp & Bilateral Toy Routine" : "Tabletop Grasp & Precision Release")}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </Card>

      {/* Input Composer */}
      <form onSubmit={handleSend} className="shrink-0 space-y-2">
        <MentionTextarea
          value={inputText}
          onChange={setInputText}
          selectedProgram={selectedMentionProgram}
          onSelectProgram={setSelectedMentionProgram}
          availablePrograms={availablePrograms}
          placeholder={`Write a message to ${currentPatient?.name || "patient"}... (Type @ to attach an assigned program)`}
          className="min-h-[80px]"
        />

        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Type <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">@</kbd> to cite an active program</span>
          <Button
            type="submit"
            isLoading={sending}
            disabled={!inputText.trim() || !selectedPatientId}
            className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold"
          >
            <Send className="w-3.5 h-3.5" />
            Send Message
          </Button>
        </div>
      </form>
    </div>
  );
}
