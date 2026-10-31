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
  Trash2,
  ImagePlus,
  X,
} from "lucide-react";
import { compressImageFile, isImageFile } from "@/lib/image-compress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MentionTextarea, ProgramMentionOption } from "@/components/ui/mention-textarea";
import { Message } from "@/types/database";
import { useAuth } from "@/lib/supabase/auth-context";
import { isDemoUser } from "@/lib/supabase/demo-helpers";
import {
  DEMO_CLIENT_ID,
  DEMO_PATIENT_ID,
  DEMO_PEDIATRIC_CLIENT_ID,
  DEMO_PEDIATRIC_PATIENT_ID,
} from "@/lib/supabase/mock-store";

export default function ClientMessagesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading messages...</div>}>
      <ClientMessagesContent />
    </Suspense>
  );
}

function ClientMessagesContent() {
  const { user, profile } = useAuth();
  const isDemo = isDemoUser(user, profile);

  const searchParams = useSearchParams();
  const initialMode = searchParams.get("demoPatient") === "pediatric" ? "pediatric" : "adult";
  const [persona, setPersona] = useState<"adult" | "pediatric">(initialMode);

  const isPediatric = isDemo
    ? persona === "pediatric"
    : profile?.client_category === "pedia";

  const demoPatientId = isPediatric ? DEMO_PEDIATRIC_PATIENT_ID : DEMO_PATIENT_ID;
  const myClientId = isPediatric ? DEMO_PEDIATRIC_CLIENT_ID : DEMO_CLIENT_ID;

  const [messages, setMessages] = useState<Message[]>([]);
  const [availablePrograms, setAvailablePrograms] = useState<ProgramMentionOption[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedMentionProgram, setSelectedMentionProgram] = useState<ProgramMentionOption | null>(null);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const endpoint = isDemo
        ? `/api/messages?patientId=${demoPatientId}&isDemo=true`
        : `/api/messages?clientUserId=${user?.id || ""}&isDemo=false`;

      const res = await fetch(endpoint);
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
  }, [demoPatientId, user?.id, isDemo]);

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
      // fallback raw
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
    if (sending || (!inputText.trim() && !pendingFile)) return;
    setSending(true);
    try {
      let res: Response;
      if (pendingFile) {
        const fd = new FormData();
        if (isDemo) fd.set("patientId", demoPatientId);
        else if (user?.id) fd.set("clientUserId", user.id);
        if (user?.id) fd.set("senderId", user.id);
        else fd.set("senderId", myClientId);
        fd.set("senderRole", "client");
        fd.set("text", inputText.trim() || "📷 Photo");
        if (selectedMentionProgram?.id) fd.set("referencedProgramId", selectedMentionProgram.id);
        fd.set("image", pendingFile);
        res = await fetch("/api/messages", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: isDemo ? demoPatientId : undefined,
            clientUserId: !isDemo ? user?.id : undefined,
            senderId: user?.id || (isDemo ? myClientId : undefined),
            senderRole: "client",
            text: inputText,
            referencedProgramId: selectedMentionProgram?.id || null,
          }),
        });
      }
      const data = await res.json();
      if (res.ok && data.message) {
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
        setInputText("");
        setSelectedMentionProgram(null);
        clearPending();
      }
    } catch {
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;

    setDeletingId(messageId);
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

  return (
    <div className="space-y-4 max-w-3xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Header with Persona Switcher (Demo Only) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-teal-400" />
          <div>
            <h1 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <span>Messages</span>
            </h1>
            <p className="text-[11px] text-zinc-400">
              {isDemo
                ? isPediatric
                  ? "Leo Chen (Pediatric Care • Managed by Sarah Chen)"
                  : "Marcus Vance (Adult Tabletop Rehab)"
                : profile?.display_name
                ? `${profile.display_name} • Messages`
                : "Messages"}
            </p>
          </div>
        </div>

        {/* Persona toggle pill only for demo bypass */}
        {isDemo && (
          <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900/80 border border-zinc-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setPersona("adult")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                !isPediatric
                  ? "bg-zinc-800 text-teal-300 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <User className="w-3 h-3" />
              <span>Marcus</span>
            </button>
            <button
              type="button"
              onClick={() => setPersona("pediatric")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                isPediatric
                  ? "bg-sky-950 text-sky-300 border border-sky-500/40 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Baby className="w-3 h-3 text-sky-400" />
              <span>Leo & Sarah</span>
            </button>
          </div>
        )}
      </div>

      {/* Chat Messages Log Area - drop zone */}
      <Card
        className={`flex-1 overflow-y-auto border-zinc-800 bg-zinc-900/60 p-4 space-y-4 ${dragOver ? "ring-2 ring-teal-500/60 border-teal-500/40" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); }}
      >
        {dragOver && <div className="text-center text-xs text-teal-300 py-1 border border-dashed border-teal-500/40 rounded-lg bg-teal-950/30">Drop photo to attach</div>}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500 space-y-2">
            <MessageSquare className="w-8 h-8 text-zinc-600" />
            <div className="font-semibold text-zinc-300 text-sm">No Messages Yet</div>
            <p className="text-xs max-w-sm">
              Send a message below to start communicating with your occupational therapist about your home exercises or daily progress.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe =
            msg.sender_id === user?.id ||
            msg.sender_id === myClientId ||
            msg.sender_id.includes("client");

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-1">
                {isMe ? (
                  <>
                    <span className="font-semibold text-teal-400">
                      {isDemo
                        ? isPediatric
                          ? "Sarah Chen (for Leo) (You)"
                          : "Marcus Vance (You)"
                        : profile?.display_name || "You"}
                    </span>
                    {isPediatric ? <Baby className="w-3 h-3 text-teal-400" /> : <User className="w-3 h-3 text-teal-400" />}
                  </>
                ) : (
                  <>
                    <Stethoscope className="w-3 h-3 text-zinc-400" />
                    <span className="font-semibold text-zinc-300">
                      {isDemo ? "Dr. Elena Ramos, OTR/L" : profile?.clinician_name || "Occupational Therapist"}
                    </span>
                  </>
                )}
                <span>• {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
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
                className={`max-w-md rounded-xl p-3.5 text-xs leading-relaxed space-y-2 ${
                  isMe
                    ? "bg-teal-950/80 border border-teal-500/40 text-teal-100"
                    : "bg-zinc-800/90 border border-zinc-700/60 text-zinc-100"
                }`}
              >
                {/* Clickable @home-program mention chip */}
                {msg.referenced_program_id && (
                  <Link
                    href={`/client/programs/${msg.referenced_program_id}`}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900/90 border border-teal-500/60 text-[11px] font-medium text-teal-300 hover:bg-zinc-800 transition-colors"
                  >
                    <BookOpen className="w-3 h-3 text-teal-400" />
                    <span>View Referenced Home Program</span>
                  </Link>
                )}

                {msg.body !== "📷 Photo" && <p className="whitespace-pre-wrap">{msg.body}</p>}
                {(msg as any).attachment_url && (
                  <a href={(msg as any).attachment_url} target="_blank" rel="noopener noreferrer" className="block mt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={(msg as any).attachment_url} alt="attachment" className="rounded-lg border border-zinc-700 max-h-64 w-auto object-contain bg-zinc-950" loading="lazy" />
                  </a>
                )}
                {msg.body === "📷 Photo" && !(msg as any).attachment_url && <p>{msg.body}</p>}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </Card>

      {/* Input Composer with @mention support */}
      <form onSubmit={handleSend} className="shrink-0 space-y-2" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); }}>
        {previewUrl && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="preview" className="h-16 w-16 object-cover rounded border border-zinc-700" />
            <span className="text-xs text-zinc-400 flex-1 truncate">{pendingFile?.name} • {(pendingFile!.size / 1024).toFixed(0)} KB (compressed for free tier)</span>
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
          placeholder={
            isDemo
              ? "Ask Dr. Ramos a question... (Type @ to attach an assigned home program)"
              : "Ask your therapist a question... (Type @ to attach an assigned home program)"
          }
          className="min-h-[80px]"
        />

        <div className="flex items-center justify-between text-xs text-zinc-500 gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-7 px-2 border-zinc-700 text-zinc-300 gap-1"><ImagePlus className="w-3.5 h-3.5" />Photo</Button>
            <span className="hidden sm:inline">Drag & drop photo • <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">@</kbd> to cite program</span>
          </div>
          <Button type="submit" isLoading={sending} disabled={!inputText.trim() && !pendingFile} className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold">
            <Send className="w-3.5 h-3.5" />Send
          </Button>
        </div>
      </form>
    </div>
  );
}
