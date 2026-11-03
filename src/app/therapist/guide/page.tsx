"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, ClipboardList, FileCheck2, MessageSquare, Palette, Scan, CheckCircle2, ArrowRight, HelpCircle, ShieldCheck,
  Stethoscope, LayoutDashboard, Search, Plus, Video, Bell, Wrench, BookOpen, Bot, FileText, Calendar, Target,
  Sparkles, History, Layers, ChevronDown, ChevronUp, Eye, Edit3
} from "lucide-react";

type Section = { id: string; label: string; icon: React.ElementType };
const sections: Section[] = [
  { id: "start", label: "Start here", icon: LayoutDashboard },
  { id: "clients", label: "Clients", icon: Users },
  { id: "programs", label: "Home Programs", icon: ClipboardList },
  { id: "activities", label: "Activities", icon: Palette },
  { id: "assessments", label: "Assessments", icon: FileText },
  { id: "submissions", label: "Review & Feedback", icon: FileCheck2 },
  { id: "aruga-agent", label: "Ask Aruga Agent", icon: Bot },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "account", label: "Account & Tips", icon: ShieldCheck },
];

const faqs = [
  { q: "How do I add a client?", a: "Go to Clients → New Client. Fill name, age, condition, goals. Or share your invite link and accept their request in Clients (pending card)." },
  { q: "How do I edit a client?", a: "Open Clients → tap the client card → Edit (top right). Change info, goals (max 5 long-term, 10 short-term), then Save. You can also Archive or Transfer from there." },
  { q: "How do I create a program?", a: "In the client page → New Home Program. Add title + main instructions. Add steps (one per card). Use Draft with Agent per step for a worksheet. Pick schedule (Every day / Custom dates) → Assign. Draft saves without assigning." },
  { q: "How do I edit a program?", a: "Programs live in the client page. Draft programs can be reopened and edited. Assigned programs are read-only — create a new program if you need changes." },
  { q: "Where is my AI helper?", a: "Tools → Aruga Guide AI Agent. Ask any rehab question. It can read a photo. It adds web articles as References. You stay in control." },
];

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800/50">
        <span>{title}</span>{open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>
      {open && <div className="px-4 pb-4 text-xs leading-relaxed text-zinc-400 space-y-2">{children}</div>}
    </div>
  );
}

export default function TherapistGuidePage() {
  const [active, setActive] = useState("start");
  const [query, setQuery] = useState("");

  const filter = (text: string) => !query || text.toLowerCase().includes(query.toLowerCase());

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-teal-950/40 border border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="teal" icon={<Stethoscope className="w-3.5 h-3.5" />} statusText="Therapist Guide" />
              <span className="text-xs text-zinc-400">Simple words • Short steps • All features</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">How to use Aruga — Therapist</h1>
            <p className="text-sm text-zinc-400 max-w-2xl">Create programs, check videos, send feedback, and keep clients on track. Everything in one place. No jargon.</p>
            <div className="relative max-w-md pt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search guide (e.g. program, video, message)..." className="pl-9 h-9 bg-zinc-950 border-zinc-800 text-sm" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link href="/aruga-guide"><Button className="gap-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold h-9 px-5 text-xs"><Bot className="w-4 h-4" /> Ask Aruga Agent</Button></Link>
          </div>
        </div>
      </div>

      {/* ── What is Aruga — Therapist Intro ── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <div className="p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-950 border border-teal-500/20 flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5 text-teal-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-100">What is Aruga?</h2>
              <p className="text-sm leading-relaxed text-zinc-400 max-w-3xl">
                <b className="text-zinc-200">Aruga</b> is your all-in-one tele-rehab workspace — built for PT, OT, and Speech.
                It connects the clinic and the home so care does not stop at the door.
                You create clear Home Programs, clients do them at home with video + worksheets, and you review and give feedback — all in one place, no extra apps.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-300"><ClipboardList className="w-3.5 h-3.5" /> Create faster</div>
              <p className="text-xs leading-relaxed text-zinc-400">Build personalized programs in minutes. One step = one task. Generate printable worksheets with AI or use your templates.</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300"><Video className="w-3.5 h-3.5" /> See real progress</div>
              <p className="text-xs leading-relaxed text-zinc-400">Get video & photo per step. Track goals (5 LTG + 10 STG), check drawings, and publish clear feedback clients understand.</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300"><Bot className="w-3.5 h-3.5" /> AI that helps, not replaces</div>
              <p className="text-xs leading-relaxed text-zinc-400">Ask Aruga Agent for quick rehab ideas with web References. You always verify — AI drafts, you decide.</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-800/30">
            <p className="text-xs font-semibold text-teal-200">How will it help you?</p>
            <ul className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs leading-relaxed text-teal-100/80 list-disc pl-4">
              <li>Save hours weekly — no more paper handouts or scattered chats</li>
              <li>Better follow-through — schedule repeats (Every day / Custom, max 10) + reminders</li>
              <li>Clear proof for notes — SOAP, videos, scores, and assessment links in one record</li>
              <li>Stronger trust — clients get simple words + feedback, not jargon</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="teal" statusText="HIPAA-aware" />
            <Badge variant="outline" statusText="Works on phone + desktop" />
            <Badge variant="outline" statusText="No install needed" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Side nav */}
        <nav className="lg:sticky lg:top-20 h-fit space-y-1 p-2 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <p className="px-3 py-2 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">Sections</p>
          {sections.map(s => {
            const Icon = s.icon;
            const isActive = active === s.id;
            return (
              <button key={s.id} onClick={() => setActive(s.id)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${isActive ? "bg-teal-500/15 text-teal-300 border border-teal-500/20" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border border-transparent"}`}>
                <Icon className="w-4 h-4 shrink-0" /> {s.label}
              </button>
            );
          })}
          <div className="pt-3 mt-3 border-t border-zinc-800">
            <Link href="/aruga-guide" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-teal-400 hover:bg-zinc-800 hover:text-teal-300"><Bot className="w-4 h-4" /> Aruga Guide AI Agent <ArrowRight className="w-3 h-3 ml-auto" /></Link>
          </div>
        </nav>

        {/* Content */}
        <div className="space-y-6 min-w-0">
          {active === "start" && (
            <div className="space-y-4">
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><LayoutDashboard className="w-5 h-5 text-teal-400" /> Start here — navigate Aruga</CardTitle></CardHeader>
                <CardContent className="p-6 pt-0 space-y-4 text-sm leading-relaxed text-zinc-300">
                  <p className="text-xs text-zinc-400">Top bar = your map. It stays at the top on every page.</p>
                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100">Dashboard</b><br /><span className="text-zinc-400">See new submissions, pending links, and recent work. Your home base.</span></div>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100">Clients</b><br /><span className="text-zinc-400">All people you care for. Tap a card to open their page.</span></div>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100">Ask Aruga Agent</b><br /><span className="text-zinc-400">Your AI help. Ask rehab questions, add a photo, get clear steps + References.</span></div>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100">Tools</b><br /><span className="text-zinc-400">Activities, Assessments, Guide, SAM Test.</span></div>
                  </div>
                  <div className="flex flex-wrap gap-2"><Badge variant="outline" statusText="Bell = notifications" /><Badge variant="outline" statusText="Profile = your info" /></div>
                </CardContent>
              </Card>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { t: "Create", d: "New client → New program → Assign. 3 taps.", icon: Plus },
                  { t: "Review", d: "Open submission → watch → add notes → Publish.", icon: Eye },
                  { t: "Ask AI", d: "Ask Aruga Agent → ask OR add photo → get References.", icon: Bot },
                ].map(c => {
                  const I = c.icon; return <Card key={c.t} className="bg-zinc-900/50 border-zinc-800 p-4 flex gap-3"><div className="w-9 h-9 rounded-lg bg-teal-950 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0"><I className="w-4 h-4" /></div><div><p className="text-sm font-semibold text-zinc-100">{c.t}</p><p className="text-xs text-zinc-400">{c.d}</p></div></Card>;
                })}
              </div>
            </div>
          )}

          {active === "clients" && (
            <div className="space-y-4">
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><Users className="w-5 h-5 text-teal-400" /> Clients — create, find, edit</CardTitle></CardHeader>
                <CardContent className="p-6 pt-0 space-y-5 text-sm text-zinc-300">
                  <div>
                    <h4 className="font-semibold text-zinc-100 text-sm mb-2 flex items-center gap-2"><Plus className="w-4 h-4 text-teal-400" /> Create a client</h4>
                    <ol className="list-decimal pl-5 space-y-1 text-xs text-zinc-400">
                      <li>Go to <b className="text-zinc-200">Clients → New Client</b>.</li>
                      <li>Fill name, age, category (pediatric / adult / geriatric), condition, notes.</li>
                      <li>Add goals: up to <b className="text-zinc-200">5 long-term</b> + <b className="text-zinc-200">10 short-term</b>.</li>
                      <li>Tap <b className="text-zinc-200">Create</b>. Client appears in your list.</li>
                    </ol>
                    <p className="text-xs text-zinc-500 mt-2">Tip: You can also <b className="text-zinc-300">Connect with client</b> — share your email or link code. When they request, accept in the pending card at the top of Clients.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-100 text-sm mb-2 flex items-center gap-2"><Search className="w-4 h-4 text-teal-400" /> Find and open</h4>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-400">
                      <li>Use <b className="text-zinc-200">Search</b> by name. Use filters if shown.</li>
                      <li>Tap any client card → opens their full page (goals, programs, SOAP notes, history).</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-100 text-sm mb-2 flex items-center gap-2"><Edit3 className="w-4 h-4 text-teal-400" /> Edit, archive, transfer</h4>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-400">
                      <li><b className="text-zinc-200">Edit</b>: In client page → Edit (pencil icon, top right) → change details → Save.</li>
                      <li><b className="text-zinc-200">Archive</b>: Same menu → Archive. Hides client but keeps history.</li>
                      <li><b className="text-zinc-200">Transfer</b>: Move client to another therapist if your clinic allows.</li>
                    </ul>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 text-xs text-amber-200/90">Keep goals short and clear. Example: “Hold spoon for 10 seconds.” One goal = one action.</div>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400">Changes save right away. Client sees new goals and programs on next login.</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {active === "programs" && (
            <div className="space-y-4">
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-teal-400" /> Home Programs — create, schedule, assign</CardTitle></CardHeader>
                <CardContent className="p-6 pt-0 space-y-5 text-sm text-zinc-300">
                  <div>
                    <h4 className="font-semibold text-zinc-100 mb-2">Create in 5 steps</h4>
                    <ol className="list-decimal pl-5 space-y-1.5 text-xs text-zinc-400">
                      <li>Open client → <b className="text-zinc-200">New Home Program</b>.</li>
                      <li>Write <b className="text-zinc-200">Title</b> (short, e.g. “Hand grip — week 1”) and <b className="text-zinc-200">Main instructions</b> (what to do overall).</li>
                      <li>Add <b className="text-zinc-200">Steps</b>: each step = one task. Tap <b className="text-zinc-200">Add step</b>. Fill title + instructions. Keep each step to one action.</li>
                      <li>Per step, pick a worksheet: <b className="text-zinc-200">Draft with Agent</b> (AI makes it) or <b className="text-zinc-200">Browse templates</b> → approve. You can target a goal (LTG/STG) so the AI matches it.</li>
                      <li>Set <b className="text-zinc-200">Schedule</b>: choose
                        <ul className="list-disc pl-5 mt-1 space-y-0.5">
                          <li><b>Every day</b> / <b>Every other day</b> / <b>Every X days</b> / <b>Custom</b> — pick how often.</li>
                          <li>Or pick exact dates on the <b>Calendar</b>. Max 10 sessions. Badge shows <b>n/N sessions</b>.</li>
                        </ul>
                      </li>
                      <li>Tap <b className="text-zinc-200">Assign</b> (client sees it) or <b className="text-zinc-200">Save draft</b> (only you see it).</li>
                    </ol>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs"><b className="text-zinc-100">Edit:</b><span className="text-zinc-400"> Drafts can be reopened and changed. Assigned programs are locked — make a new one for changes.</span></div>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs"><b className="text-zinc-100">Navigate:</b><span className="text-zinc-400"> Client page → Programs tab. Filter by All / Draft / Assigned / Archived.</span></div>
                  </div>
                  <Accordion title="Tips for good steps"><ul className="list-disc pl-4 space-y-1"><li>One step = one video clip from client.</li><li>Write at 6th-grade level. Short sentences.</li><li>Add a goal tag so progress can be tracked.</li></ul></Accordion>
                </CardContent>
              </Card>
            </div>
          )}

          {active === "activities" && (
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><Palette className="w-5 h-5 text-teal-400" /> Activities — worksheets</CardTitle></CardHeader>
              <CardContent className="p-6 pt-0 space-y-4 text-sm text-zinc-300">
                <ol className="list-decimal pl-5 space-y-1 text-xs text-zinc-400">
                  <li>Go to <b className="text-zinc-200">Tools → Activities</b> or create from a program step.</li>
                  <li><b className="text-zinc-200">System</b> = ready templates. <b className="text-zinc-200">My Prompts</b> = your saved ideas. <b className="text-zinc-200">Custom</b> = write your own.</li>
                  <li>Pick age band, category, theme. Tap <b className="text-zinc-200">Generate</b>. AI makes the sheet (image + text).</li>
                  <li>Tap <b className="text-zinc-200">Save</b> or <b className="text-zinc-200">Attach to step</b>. Client draws on it later.</li>
                </ol>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400"><b className="text-zinc-100">Edit:</b> Open any activity → Edit text or re-generate image. Changes do not affect already assigned programs.</div>
              </CardContent>
            </Card>
          )}

          {active === "assessments" && (
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><FileText className="w-5 h-5 text-teal-400" /> Assessments — SOAP notes</CardTitle></CardHeader>
              <CardContent className="p-6 pt-0 space-y-4 text-sm text-zinc-300">
                <ol className="list-decimal pl-5 space-y-1 text-xs text-zinc-400">
                  <li>Go to <b className="text-zinc-200">Tools → Assessment</b> or client page → <b className="text-zinc-200">New SOAP Note</b>.</li>
                  <li>Pick client + date. Fill S (client says), O (you see), A (your check), P (next plan).</li>
                  <li>Optional: link to a Home Program (auto-links if status is <b className="text-zinc-200">Pending Activation</b>).</li>
                  <li>Tap <b className="text-zinc-200">Save</b>. Note shows in client History and your Assessments list.</li>
                </ol>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400"><b className="text-zinc-100">Navigate:</b> Assessments page → filter by client or date. Tap any row to view, edit, or print.</div>
              </CardContent>
            </Card>
          )}

          {active === "submissions" && (
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><FileCheck2 className="w-5 h-5 text-teal-400" /> Review & Feedback — videos to publish</CardTitle></CardHeader>
              <CardContent className="p-6 pt-0 space-y-4 text-sm text-zinc-300">
                <ol className="list-decimal pl-5 space-y-1 text-xs text-zinc-400">
                  <li>Open <b className="text-zinc-200">Dashboard</b> (pending reviews) or <b className="text-zinc-200">Submissions</b> → tap a submission.</li>
                  <li>Watch each step video. Check the worksheet drawing if attached.</li>
                  <li>Optional: tap <b className="text-zinc-200">Analyze with AI</b> for quick notes (you still verify).</li>
                  <li>Add <b className="text-zinc-200">Feedback</b> per step + overall. Set rating if used.</li>
                  <li>Tap <b className="text-zinc-200">Publish</b>. Client sees it in History. You can still edit after.</li>
                </ol>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100">Navigate:</b><span className="text-zinc-400"> Submissions → filters: All / Awaiting / Reviewed. Client page → Submissions tab.</span></div>
                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 text-amber-200/90">Be kind and clear. Short praise + one next step works best.</div>
                </div>
              </CardContent>
            </Card>
          )}

          {active === "aruga-agent" && (
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><Bot className="w-5 h-5 text-teal-400" /> Ask Aruga Agent — your rehab helper</CardTitle></CardHeader>
              <CardContent className="p-6 pt-0 space-y-4 text-sm text-zinc-300">
                <p className="text-xs text-zinc-400">Ask any rehab question. Get clear steps + web References. You stay in charge.</p>
                <div>
                  <h4 className="font-semibold text-zinc-100 text-sm mb-2 flex items-center gap-2"><Plus className="w-4 h-4 text-teal-400" /> Create — start a chat</h4>
                  <ol className="list-decimal pl-5 space-y-1 text-xs text-zinc-400">
                    <li>Go to <b className="text-zinc-200">Tools → Aruga Guide AI Agent</b> (or tap <b className="text-zinc-200">Aruga Guide AI Agent</b> in the left menu).</li>
                    <li>Tap <b className="text-zinc-200">New chat</b>. Type your question in <b className="text-zinc-200">Ask a question...</b>.</li>
                    <li>Optional: tap <b className="text-zinc-200">Attach photo</b> (paperclip) — add a photo for better help.</li>
                    <li>Tap <b className="text-zinc-200">Send</b>. AI replies in seconds with steps + <b className="text-zinc-200">References</b>.</li>
                  </ol>
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-100 text-sm mb-2 flex items-center gap-2"><Search className="w-4 h-4 text-teal-400" /> Navigate — find your chats</h4>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-400">
                    <li>Left side (or top on phone) = <b className="text-zinc-200">chat history</b>. Tap any chat to open it.</li>
                    <li>Use <b className="text-zinc-200">Search</b> to find an old chat by word.</li>
                    <li>In the chat, scroll up to read. References are at the end — tap to open the web article.</li>
                    <li>Bell icon shows updates (like new submissions) — separate from AI chats.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-100 text-sm mb-2 flex items-center gap-2"><Edit3 className="w-4 h-4 text-teal-400" /> Edit — change or clear</h4>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-400">
                    <li>To edit your last question: tap it, change text, send again — AI makes a new answer.</li>
                    <li>To delete a chat: open chat list → tap <b className="text-zinc-200">trash icon</b> next to the chat.</li>
                    <li>To clear all: in Aruga Guide, tap <b className="text-zinc-200">Clear</b> (top right) — removes all chats for this device.</li>
                    <li>Clients can tap <b className="text-zinc-200">Send to clinician to verify</b> if they want you to check an answer.</li>
                  </ul>
                </div>
                <div className="p-3 rounded-xl bg-teal-950/20 border border-teal-800/30 text-xs text-teal-200/90">Tip: Ask short and clear. Example: “How to help a 5-year-old hold a pencil?” AI gives steps you can use right away.</div>
              </CardContent>
            </Card>
          )}

          {active === "tools" && (
            <div className="space-y-4">
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><Wrench className="w-5 h-5 text-teal-400" /> Tools</CardTitle></CardHeader>
                <CardContent className="p-6 pt-0 grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100 flex items-center gap-1"><Bot className="w-3.5 h-3.5 text-teal-400" /> Aruga Guide AI Agent</b><span className="text-zinc-400"> Ask rehab questions. Add a photo for better help. Answers show References (web articles). Clients tap “Send to clinician to verify” to ask you to check an answer.</span><br /><Link href="/aruga-guide" className="text-teal-400 hover:underline">Open →</Link></div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100 flex items-center gap-1"><Scan className="w-3.5 h-3.5 text-sky-400" /> SAM Test</b><span className="text-zinc-400"> Try image cut-outs. Upload a photo, tap to mark an object, see the mask.</span><br /><Link href="/sam-test" className="text-teal-400 hover:underline">Open →</Link></div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100 flex items-center gap-1"><Palette className="w-3.5 h-3.5 text-amber-400" /> Activities</b><span className="text-zinc-400"> Make worksheets. See Activities section above.</span></div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100 flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-zinc-300" /> Assessment</b><span className="text-zinc-400"> Create and view SOAP notes. See Assessments above.</span></div>
                </CardContent>
              </Card>
            </div>
          )}

          {active === "account" && (
            <div className="space-y-4">
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardHeader className="p-6 pb-3"><CardTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-teal-400" /> Account & Tips</CardTitle></CardHeader>
                <CardContent className="p-6 pt-0 space-y-3 text-xs text-zinc-400">
                  <ul className="list-disc pl-5 space-y-1">
                    <li><b className="text-zinc-200">Profile</b>: Top right → Profile. Edit name, clinic, contact. Save.</li>
                    <li><b className="text-zinc-200">Log out</b>: Top right → Sign out. On mobile, open menu (☰) first.</li>
                    <li>Keep videos short & clear. Good light. Steady phone.</li>
                    <li>Use short words. One idea per sentence. Client reads better.</li>
                    <li>Check Dashboard daily for pending reviews.</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="bg-teal-950/20 border-teal-800/30 p-4 flex items-center justify-between">
                <p className="text-xs text-teal-200/90">Need help? Message support or ask Aruga Guide.</p>
                <Link href="/aruga-guide"><Button size="sm" className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">Ask Guide</Button></Link>
              </Card>
            </div>
          )}

          {/* FAQ always */}
          <Card className="bg-zinc-900/40 border-zinc-800">
            <CardHeader className="p-6 pb-3"><CardTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2"><HelpCircle className="w-4 h-4 text-teal-400" /> Quick answers</CardTitle></CardHeader>
            <CardContent className="p-6 pt-0 space-y-2">
              {faqs.filter(f => filter(f.q + f.a)).map(f => (
                <Accordion key={f.q} title={f.q}><p>{f.a}</p></Accordion>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
