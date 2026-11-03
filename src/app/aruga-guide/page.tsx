"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Send,
  ImagePlus,
  Video,
  X,
  Bot,
  User,
  AlertTriangle,
  BookOpenCheck,
  Loader2,
  ArrowLeft,
  UploadCloud,
  Trash2,
  Plus,
  HeartHandshake,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/supabase/auth-context";
import {
  DEFAULT_OT_CHAT_MODEL,
  OT_CHAT_MODELS,
  OT_CHAT_MODEL_LABELS,
  isOtChatModel,
  type OtChatModelId,
} from "@/lib/meta/models";

interface ChatAttachment {
  kind: "image" | "video";
  name?: string;
  mimeType?: string;
  /** For images: compressed JPEG data URL. */
  dataUrl?: string;
  /** For videos: local blob preview URL (not uploaded). */
  previewUrl?: string;
  /** For videos: extracted JPEG frames sent to the API as images. */
  frames?: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  references?: Array<{
    title: string;
    authors: string;
    year: string;
    source: string;
    url: string;
  }>;
  grounded?: boolean;
}

const CONVERSATION_KEY = "ot-helper-conversation-id";
const SUGGESTIONS = [
  "Explain my current home program — why do I need each exercise?",
  "What does my condition mean in everyday words?",
  "I feel pain when doing my exercises — what should I watch for?",
  "Show easy ways to practice at home safely with my family",
];

function isValidUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function newConversationId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {}
  // Fallback — still UUID v4 format to satisfy DB uuid column
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

const MAX_IMAGE_DIM = 1280;
const MAX_VIDEO_FRAMES = 4;
const MAX_VIDEO_FRAME_DIM = 960;

/** Downscale/compress an image to JPEG data URL so uploads stay small. */
async function compressImageToDataUrl(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_IMAGE_DIM / Math.max(bitmap.width, bitmap.height)
    );
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    if (!blob) throw new Error("compress failed");
    return await fileToDataUrl(new File([blob], file.name, { type: "image/jpeg" }));
  } catch {
    // Fallback: original bytes (backend size guard will reject if too big).
    return fileToDataUrl(file);
  }
}

/** Extract evenly-spaced JPEG frames from a video for LLM understanding. */
function extractVideoFrames(file: File, frameCount = MAX_VIDEO_FRAMES): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = async () => {
      try {
        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
        const times = Array.from({ length: frameCount }, (_, i) =>
          Math.min(duration - 0.2, (duration * (i + 1)) / (frameCount + 1))
        );
        const frames: string[] = [];
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas");

        for (const t of times) {
          await new Promise<void>((res, rej) => {
            const onSeek = () => {
              video.removeEventListener("seeked", onSeek);
              res();
            };
            const onErr = () => {
              video.removeEventListener("error", onErr);
              rej(new Error("seek failed"));
            };
            video.addEventListener("seeked", onSeek);
            video.addEventListener("error", onErr);
            video.currentTime = Math.max(0, t);
          });
          const scale = Math.min(
            1,
            MAX_VIDEO_FRAME_DIM / Math.max(video.videoWidth, video.videoHeight)
          );
          canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
          canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const blob: Blob | null = await new Promise((r) =>
            canvas.toBlob(r, "image/jpeg", 0.78)
          );
          if (blob) {
            frames.push(
              await fileToDataUrl(new File([blob], file.name, { type: "image/jpeg" }))
            );
          }
        }
        cleanup();
        if (frames.length === 0) throw new Error("no frames extracted");
        resolve(frames);
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error("frame extraction failed"));
      }
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Could not read video file."));
    };
    // Timeout if metadata never loads
    setTimeout(() => reject(new Error("Video load timed out.")), 15000);
  });
}

/**
 * Strip any in-answer References section so citations only appear in the
 * collapsed section below, driven by the structured `references` array.
 */
function stripReferencesSection(content: string): string {
  const idx = content.search(/\n\s*#{0,3}\s*references\s*\n/i);
  if (idx === -1) return content.trimEnd();
  return content.slice(0, idx).trimEnd();
}

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-base font-bold mt-1 mb-2">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-sm font-bold mt-2 mb-1.5">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-zinc-100">{children}</strong>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-teal-400 hover:text-teal-300 underline break-all"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-teal-500/50 pl-3 my-2 text-zinc-300">
      {children}
    </blockquote>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="px-1 py-0.5 rounded bg-zinc-800 text-teal-200 text-[13px] font-mono">
      {children}
    </code>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-[13px] border-collapse">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-zinc-700 px-2 py-1 text-left font-semibold bg-zinc-800">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-zinc-800 px-2 py-1 align-top">{children}</td>
  ),
};

export default function AskOtPage() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<ChatAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; updated_at?: string }>>([]);
  const [conversationId, setConversationId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const existing = window.localStorage.getItem(CONVERSATION_KEY);
      // DB expects UUID (ot_conversations.id uuid) — legacy ot-xxx ids cause 22P02
      if (existing && isValidUUID(existing)) return existing;
      const id = newConversationId();
      window.localStorage.setItem(CONVERSATION_KEY, id);
      return id;
    } catch {
      return newConversationId();
    }
  });

  // Migrate legacy localStorage ids (ot-xxx) → UUID on mount; also fixes SSR "" hydration
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CONVERSATION_KEY);
      if (stored && !isValidUUID(stored)) {
        const id = newConversationId();
        window.localStorage.setItem(CONVERSATION_KEY, id);
        setConversationId(id);
        return;
      }
      if (!stored || !conversationId) {
        const existing = stored && isValidUUID(stored) ? stored : newConversationId();
        if (!stored || stored !== existing) {
          window.localStorage.setItem(CONVERSATION_KEY, existing);
        }
        if (!conversationId || conversationId !== existing) {
          setConversationId(existing);
        }
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [modelId, setModelId] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<OtChatModelId>(() => {
    if (typeof window === "undefined") return DEFAULT_OT_CHAT_MODEL;
    try {
      const saved = window.localStorage.getItem("ot-helper-model");
      if (saved && isOtChatModel(saved)) return saved;
    } catch {
      /* ignore */
    }
    return DEFAULT_OT_CHAT_MODEL;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [activeProgram, setActiveProgram] = useState<any>(null);
  const [verifyState, setVerifyState] = useState<Record<number, "idle" | "sending" | "sent">>({});

  // Butler context: load current home program so guide can explain why exercises matter
  useEffect(() => {
    if (!user?.id) return;
    const params = new URLSearchParams({ clientUserId: user.id, isDemo: "false" });
    fetch(`/api/therapist/programs?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.programs && data.programs.length > 0) setActiveProgram(data.programs[0]);
      })
      .catch(() => {});
  }, [user?.id]);

  // Load user conversations from database
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/ot-chat/conversations?userId=${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.conversations && data.conversations.length > 0) {
          setConversations(data.conversations);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  // Load active conversation messages from database — skip legacy non-UUID ids
  useEffect(() => {
    if (!conversationId || !isValidUUID(conversationId)) return;
    fetch(`/api/ot-chat/conversations?conversationId=${conversationId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: any) => ({
              role: m.role,
              content: m.content,
              grounded: false,
              references: [],
            }))
          );
        }
      })
      .catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function startNewChat() {
    if (messages.length === 0 && pendingFiles.length === 0 && !error) {
      return; // Already in a fresh empty chat session
    }
    const id = newConversationId();
    setConversationId(id);
    try {
      localStorage.setItem(CONVERSATION_KEY, id);
    } catch {}
    setPendingFiles([]);
    setMessages([]);
    setError(null);

    if (user?.id) {
      try {
        const res = await fetch("/api/ot-chat/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_conversation",
            userId: user.id,
            conversationId: id,
            title: "New Conversation",
            modelId: selectedModel,
          }),
        });
        const data = await res.json();
        if (data.conversation) {
          setConversations((prev) => [data.conversation, ...prev.filter((c) => c.id !== id)]);
        }
      } catch (e) {
        console.warn("Could not save conversation:", e);
      }
    }
  }

  async function clearCurrentChat() {
    setMessages([]);
    if (conversationId) {
      try {
        await fetch(`/api/ot-chat/conversations?conversationId=${conversationId}&action=clear`, {
          method: "DELETE",
        });
      } catch (e) {
        console.warn("Could not clear conversation:", e);
      }
    }
  }

  function removePendingAt(index: number) {
    setPendingFiles((prev) => {
      const target = prev[index];
      if (target?.previewUrl?.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(target.previewUrl);
        } catch {
          /* ignore */
        }
      }
      return prev.filter((_, idx) => idx !== index);
    });
  }

  function countSentImages(files: ChatAttachment[]): number {
    return files.reduce(
      (n, f) => n + (f.kind === "image" ? 1 : f.frames?.length ?? 0),
      0
    );
  }

  async function handleFiles(files: FileList | File[] | null) {
    if (!files) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    setError(null);
    setIsProcessingMedia(true);
    try {
      const next: ChatAttachment[] = [...pendingFiles];
      for (const file of list) {
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        if (!isImage && !isVideo) {
          setError(`"${file.name}" skipped — only images and videos can be attached.`);
          continue;
        }
        if (file.size > 25 * 1024 * 1024) {
          setError(`"${file.name}" is over 25 MB. Please choose a smaller file.`);
          continue;
        }
        // One dropped video = one pending item (frames grouped inside it).
        if (next.length >= 4) {
          setError("Max 4 attachments per message.");
          break;
        }
        try {
          if (isImage) {
            const dataUrl = await compressImageToDataUrl(file);
            next.push({
              kind: "image",
              dataUrl,
              mimeType: "image/jpeg",
              name: file.name,
            });
          } else {
            // Video: extract still frames and keep them grouped under one item.
            // Raw video bytes are too large for chat JSON and most chat APIs
            // reject base64 video, so frames are the reliable path.
            if (countSentImages(next) >= 4) {
              setError("Max 4 images per message (video frames count too).");
              break;
            }
            const previewUrl = URL.createObjectURL(file);
            try {
              const frames = await extractVideoFrames(file);
              const slotsLeft = 4 - countSentImages(next);
              if (frames.length > slotsLeft) {
                setError("Video trimmed to fit the 4-image limit (first frames kept).");
              }
              next.push({
                kind: "video",
                name: file.name,
                mimeType: file.type,
                previewUrl,
                frames: frames.slice(0, Math.max(0, slotsLeft)),
              });
            } catch {
              URL.revokeObjectURL(previewUrl);
              throw new Error("frame extraction failed");
            }
          }
        } catch {
          setError(`Could not process "${file.name}". Try a shorter clip or a photo.`);
        }
      }
      setPendingFiles(next);
    } finally {
      setIsProcessingMedia(false);
    }
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Only activate for file drags
    if (e.dataTransfer.types.includes("Files")) {
      dragCounter.current += 1;
      setIsDragging(true);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDragging(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (sending) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFiles(files);
    }
  }

  function handleModelChange(value: string) {
    if (!isOtChatModel(value)) return;
    setSelectedModel(value);
    try {
      localStorage.setItem("ot-helper-model", value);
    } catch {
      /* ignore */
    }
  }

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if ((!text && pendingFiles.length === 0) || sending || isProcessingMedia) return;
    setError(null);
    setSending(true);    const userMsg: ChatMessage = {
      role: "user",
      content:
        text +
        (pendingFiles.length > 0
          ? `\n[Attached: ${pendingFiles
              .map((f) =>
                f.kind === "video"
                  ? `${f.name || "video"} (1 video)`
                  : f.name || "image"
              )
              .join(", ")}]`
          : ""),
    };
    const historyForApi = messages.map((m) => ({
      role: m.role,
      // Strip in-answer References so history stays lean and citations live
      // only in the structured collapsed section.
      content:
        m.role === "assistant"
          ? stripReferencesSection(m.content).slice(0, 4000)
          : m.content.slice(0, 4000),
    }));
    // Expand grouped video frames into image attachments for the API, but keep
    // the UI grouped as 1 video = 1 item.
    const attachmentsToSend: Array<{
      kind: "image" | "video";
      dataUrl: string;
      mimeType?: string;
      name?: string;
    }> = [];
    for (const f of pendingFiles) {
      if (f.kind === "image" && f.dataUrl) {
        attachmentsToSend.push({
          kind: "image",
          dataUrl: f.dataUrl,
          mimeType: f.mimeType,
          name: f.name,
        });
      } else if (f.kind === "video" && f.frames) {
        f.frames.forEach((frame, i) => {
          attachmentsToSend.push({
            kind: "image",
            dataUrl: frame,
            mimeType: "image/jpeg",
            name: `${f.name || "video"} frame ${i + 1}`,
          });
        });
      }
      if (f.previewUrl?.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(f.previewUrl);
        } catch {
          /* ignore */
        }
      }
    }
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPendingFiles([]);

    if (user?.id && conversationId && isValidUUID(conversationId)) {
      fetch("/api/ot-chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_message",
          userId: user.id,
          conversationId,
          title: text.slice(0, 32) || "OT Chat Session",
          message: {
            role: "user",
            content: userMsg.content,
          },
        }),
      }).catch(() => {});
    }

    // Butler personalization: profile + program brief (client-safe, no secrets)
    const profileBrief = profile
      ? [
          `Role: ${profile.role || "client"}`,
          `Category: ${profile.client_category || "adult"}${profile.age ? `, Age: ${profile.age}` : ""}`,
          profile.primary_condition ? `Condition: ${profile.primary_condition}` : null,
          profile.therapy_goals ? `Goals: ${profile.therapy_goals}` : null,
          profile.discipline ? `Discipline: ${profile.discipline}` : null,
        ]
          .filter(Boolean)
          .join(" | ")
      : undefined;
    const programBrief = activeProgram
      ? `${activeProgram.title}: ${activeProgram.main_instructions || ""} Steps: ${(activeProgram.steps || [])
          .slice(0, 3)
          .map((s: any) => `${s.position}. ${s.title || s.instructions?.slice(0, 60)}`)
          .join(" ; ")}`
      : undefined;

    try {
      const res = await fetch("/api/ot-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: historyForApi,
          userText: text,
          attachments: attachmentsToSend,
          conversationId,
          model: selectedModel,
          clientContext: {
            displayName: profile?.display_name,
            profileBrief,
            programBrief,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Chat request failed.");
      }
      if (data.conversationId && data.conversationId !== conversationId && isValidUUID(data.conversationId)) {
        setConversationId(data.conversationId);
        try {
          localStorage.setItem(CONVERSATION_KEY, data.conversationId);
        } catch {
          /* ignore */
        }
      }
      if (data.modelId) setModelId(data.modelId);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply as string,
          references: data.references ?? [],
          grounded: data.grounded ?? false,
        },
      ]);

      if (user?.id && conversationId && isValidUUID(conversationId)) {
        // Use current conversationId (not stale closure if server returned a new one above)
        const currentId = data.conversationId && isValidUUID(data.conversationId) ? data.conversationId : conversationId;
        fetch("/api/ot-chat/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_message",
            userId: user.id,
            conversationId: currentId,
            message: {
              role: "assistant",
              content: data.reply as string,
            },
          }),
        }).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyWithClinician(idx: number) {
    const msg = messages[idx];
    if (!msg || msg.role !== "assistant" || !user?.id) return;
    setVerifyState((s) => ({ ...s, [idx]: "sending" }));
    const summary = msg.content.slice(0, 1800);
    const refs = msg.references && msg.references.length > 0 ? `\n\nReferences:\n${msg.references.map((r, i) => `[${i + 1}] ${r.title} — ${r.url}`).join("\n")}` : "";
    const body = `Hello, I'd like you to verify this guidance from my Aruga Guide:\n\n"""${summary}"""${refs}\n\nPlease let me know if this applies to my current home program.`;
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientUserId: user.id, senderRole: "client", senderId: user.id, text: body }),
      });
      if (!res.ok) throw new Error("send failed");
      setVerifyState((s) => ({ ...s, [idx]: "sent" }));
      setTimeout(() => setVerifyState((s) => ({ ...s, [idx]: "idle" })), 3000);
    } catch {
      setVerifyState((s) => ({ ...s, [idx]: "idle" }));
      setError("Could not send to clinician — please try from Messages.");
    }
  }

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag-and-drop overlay */}
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm p-6">
          <div className="w-full max-w-lg rounded-2xl border-2 border-dashed border-teal-400 bg-zinc-900/95 p-10 text-center space-y-3 shadow-2xl">
            <div className="mx-auto w-12 h-12 rounded-xl bg-teal-950 border border-teal-500/50 text-teal-300 flex items-center justify-center">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-base font-bold text-zinc-100">Drop to attach</p>
          </div>
        </div>
      )}
      {/* Header — clean, aligned, no pill/subtitle */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 sm:h-16 items-center justify-between gap-4 px-4 sm:px-6 max-w-4xl">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="h-5 w-px bg-zinc-800 hidden sm:block shrink-0" aria-hidden />
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-teal-950 to-zinc-900 border border-teal-500/25 text-teal-300 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100 leading-none truncate">Aruga Guide AI Agent</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {conversations.length > 0 && (
              <div className="relative hidden sm:flex items-center">
                <select
                  value={conversationId}
                  onChange={(e) => setConversationId(e.target.value)}
                  className="h-9 appearance-none bg-zinc-900 border border-zinc-700 rounded-lg pl-3 pr-8 text-xs font-medium text-zinc-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 max-w-[170px] truncate cursor-pointer hover:border-zinc-600 transition-colors"
                  aria-label="Select conversation"
                >
                  {conversations.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 w-3.5 h-3.5 text-zinc-500" />
              </div>
            )}
            <div className="relative flex items-center">
              <Sparkles className="pointer-events-none absolute left-2.5 w-3.5 h-3.5 text-teal-400/70" />
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="h-9 appearance-none bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded-lg pl-8 pr-8 text-xs font-medium text-zinc-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 cursor-pointer transition-colors min-w-[148px] sm:min-w-[168px]"
                aria-label="Select model"
              >
                {OT_CHAT_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {OT_CHAT_MODEL_LABELS[m]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 w-3.5 h-3.5 text-zinc-500" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={startNewChat}
              className="h-9 gap-1.5 text-xs font-medium border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:border-zinc-600 px-3"
            >
              <Plus className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">New chat</span>
              <span className="sm:hidden">New</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearCurrentChat}
              disabled={messages.length === 0}
              className="h-9 w-9 sm:w-auto sm:px-3 gap-1.5 text-xs border-zinc-800 bg-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900 transition-colors p-0 sm:py-0 disabled:opacity-40"
              title="Clear all messages in this chat"
              aria-label="Clear chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 py-6 flex flex-col gap-5">
        {/* Tabs — aligned, consistent height */}
        <div className="flex items-center gap-2 p-1 w-fit rounded-xl bg-zinc-900 border border-zinc-800">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 text-teal-300 border border-zinc-700 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" /> Aruga Guide AI Agent
          </span>
          <Link
            href="/sam-test"
            className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            SAM 3.1 Test
          </Link>
        </div>

        {/* Intro + safety — generous padding, aligned icon/text */}
        <Card className="p-4 border-zinc-800 bg-zinc-900/60">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-teal-950 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs leading-relaxed text-zinc-300">
              <strong className="font-semibold text-zinc-100">Aruga Guide — your online buddy.</strong>{" "}
              I&apos;m not a licensed clinician — I can be wrong. Always verify important steps with your care team. In an emergency, dial 911.
            </p>
          </div>
        </Card>

        {/* Messages — balanced vertical rhythm */}
        <div className="flex-1 space-y-5 min-h-[42vh]">
          {messages.length === 0 && (
            <Card className="p-6 space-y-4 border-zinc-800 bg-zinc-900/80">
              <div className="space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2.5 text-zinc-100">
                  <span className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 text-teal-400 flex items-center justify-center">
                    <HeartHandshake className="w-4 h-4" />
                  </span>
                  Hi{profile?.display_name ? ` ${profile.display_name}` : ""} — I&apos;m your Aruga Guide
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-[62ch]">
                  I&apos;m your online buddy for rehab — I explain your condition and why each activity helps in everyday life across PT, OT &amp; Speech. Attach a photo or short clip anytime.
                </p>
                {activeProgram && (
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1">
                    <div className="font-semibold text-zinc-200">Your current program: {activeProgram.title}</div>
                    <div className="text-zinc-400 leading-relaxed line-clamp-2">{activeProgram.main_instructions}</div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    disabled={sending}
                    className="px-3.5 py-2 rounded-full text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700 hover:border-teal-500/40 hover:text-teal-100 transition-colors disabled:opacity-50 text-left leading-snug"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                  <HeartHandshake className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3.5 text-sm leading-relaxed shadow-sm ${
                  m.role === "user"
                    ? "bg-teal-600 text-white font-medium rounded-br-md whitespace-pre-wrap"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-md"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="markdown-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {stripReferencesSection(m.content)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
                {m.role === "assistant" && (
                  <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
                    {m.references && m.references.length > 0 ? (
                      <details open className="">
                        <summary className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-300 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:text-teal-200">
                          <BookOpenCheck className="w-3.5 h-3.5" />
                          <span>References ({m.references.length})</span>
                        </summary>
                        <ol className="mt-2 space-y-1 text-[11px] text-zinc-400">
                          {m.references.map((r, i) => (
                            <li key={`${r.url}-${i}`} className="leading-relaxed">
                              <span className="text-zinc-500 font-mono">[{i + 1}] </span>
                              {r.authors} ({r.year}). {r.title}. {r.source}.{" "}
                              <a href={r.url} target="_blank" rel="noreferrer" className="text-teal-400 hover:text-teal-300 underline break-all">{r.url}</a>
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : (
                      <p className="text-[11px] text-zinc-500 italic">No specific studies retrieved — this is general rehab information. Please verify with your clinician.</p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleVerifyWithClinician(idx)}
                      disabled={verifyState[idx] === "sending"}
                      className={`w-full flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 border transition-colors ${verifyState[idx] === "sent" ? "bg-teal-950 border-teal-500/40 text-teal-300" : "bg-zinc-800 border-zinc-700 text-zinc-200 hover:border-teal-500/40 hover:text-teal-200"}`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {verifyState[idx] === "sending" ? "Sending…" : verifyState[idx] === "sent" ? "Sent to clinician ✓" : "Send to clinician to verify"}
                    </button>
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="rounded-2xl rounded-bl-md px-4 py-3.5 bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="rounded-xl border border-red-800/60 bg-red-950/30 px-4 py-2.5 text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Pending attachments — 1 tile per file (1 video = 1 tile) */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="relative w-20 h-20 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900"
                title={f.name}
              >
                {f.kind === "image" && f.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.dataUrl}
                    alt={f.name || "upload preview"}
                    className="w-full h-full object-cover"
                  />
                ) : f.kind === "video" && f.previewUrl ? (
                  <video
                    src={f.previewUrl}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => removePendingAt(i)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-zinc-950/80 border border-zinc-700 text-zinc-300 hover:text-red-300"
                  aria-label="Remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
                <span className="absolute bottom-1 left-1 px-1 rounded bg-zinc-950/80 text-[9px] text-zinc-300 font-mono">
                  {f.kind === "video" ? "VID" : "IMG"}
                </span>
              </div>
            ))}
          </div>
        )}
        {isProcessingMedia && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
            Processing media… (compressing images / extracting video frames)
          </div>
        )}

        {/* Composer — even 8pt grid, balanced outline */}
        <div className="sticky bottom-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-2.5 shadow-xl">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 w-10 flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 hover:bg-zinc-700 transition-colors shrink-0"
              title="Attach image or video"
              aria-label="Attach image or video"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="hidden sm:inline-flex h-10 px-3.5 rounded-xl border border-zinc-800 bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 hover:bg-zinc-700 transition-colors shrink-0 items-center gap-1.5 text-xs font-medium"
              title="Attach video clip"
            >
              <Video className="w-3.5 h-3.5" /> Video
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask a question…"
              rows={1}
              className="flex-1 min-h-[44px] max-h-28 resize-none bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/20 px-3.5 py-2.5 leading-relaxed"
            />
            <Button
              onClick={() => sendMessage()}
              disabled={sending || isProcessingMedia || (!input.trim() && pendingFiles.length === 0)}
              className="h-10 gap-1.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold px-5 shrink-0 shadow-sm rounded-xl"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
