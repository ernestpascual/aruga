"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookOpen, UserPlus, Play, Video, MessageSquare, Star, CheckCircle2, ArrowRight, HelpCircle, ShieldCheck,
  LayoutDashboard, Home, Palette, History, Search, Layers, FileCheck, Clock, HeartHandshake, Wrench, Bot, Scan, ChevronDown, ChevronUp, User, LogOut, Edit3, Plus
} from "lucide-react";

type Section = { id: string; label: string; icon: React.ElementType };
const sections: Section[] = [
  { id: "start", label: "Start here", icon: LayoutDashboard },
  { id: "connect", label: "Connect to therapist", icon: UserPlus },
  { id: "programs", label: "Home Programs", icon: Home },
  { id: "do", label: "Do & submit", icon: Video },
  { id: "activities", label: "Worksheets", icon: Palette },
  { id: "history", label: "History & feedback", icon: History },
  { id: "aruga-agent", label: "Ask Aruga Agent", icon: Bot },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "account", label: "Account & Tips", icon: ShieldCheck },
];

const faqs = [
  { q: "How do I link to my therapist?", a: "Dashboard → Connect with your Clinician. Type your therapist’s email or code, tap Send Request. Wait for them to accept (check Notifications bell)." },
  { q: "Where is my program?", a: "Dashboard shows your current program. Or go to Home Program → Activities. Tap Start or Continue Draft." },
  { q: "How do I save my work?", a: "In a program, do each step. You can Save Draft and come back later. Tap Submit only when all steps are done." },
  { q: "Can I change my video?", a: "Before Submit, tap the step again and re-record. After Submit, your therapist will review — you can still message them." },
  { q: "Where do I see feedback?", a: "Go to History. Tap any past program to see therapist notes and scores." },
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

export default function ClientGuidePage() {
  const [active, setActive] = useState("start");
  const [query, setQuery] = useState("");
  const filter = (t: string) => !query || t.toLowerCase().includes(query.toLowerCase());

  return (
    <div className="space-y-6 min-w-0">
      <div className="p-4 sm:p-8 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-teal-950/40 border border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="teal" icon={<HelpCircle className="w-3.5 h-3.5" />} statusText="Client Guide" />
              <span className="text-xs text-zinc-400">Simple words • Short steps • All features</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">How to use Aruga — Client</h1>
            <p className="text-sm text-zinc-400 max-w-2xl">Do your exercises, send videos, and get feedback from your therapist. Easy and clear.</p>
            <div className="relative max-w-md pt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search guide (e.g. video, draft, history)..." className="pl-9 h-9 bg-zinc-950 border-zinc-800 text-sm" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link href="/aruga-guide"><Button className="gap-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold h-9 px-5 text-xs"><Bot className="w-4 h-4" /> Ask Aruga Agent</Button></Link>
          </div>
        </div>
      </div>

      {/* ── What is Aruga — Client Intro ── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <div className="p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-950 border border-teal-500/20 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-5 h-5 text-teal-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-100">What is Aruga?</h2>
              <p className="text-sm leading-relaxed text-zinc-400 max-w-3xl">
                <b className="text-zinc-200">Aruga</b> is your home therapy helper. Your therapist uses it to give you simple steps you can do at home.
                You watch, practice, record a short video, and send it. No stress — Aruga keeps everything in one easy place.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-300"><Play className="w-3.5 h-3.5" /> Easy to do</div>
              <p className="text-xs leading-relaxed text-zinc-400">Open your program, follow one step at a time, draw on worksheets if given. Clear words, big buttons.</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300"><Video className="w-3.5 h-3.5" /> Show & get help</div>
              <p className="text-xs leading-relaxed text-zinc-400">Record a quick video or photo per step. Save as draft and come back later. Submit when ready.</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300"><Bot className="w-3.5 h-3.5" /> Ask anytime</div>
              <p className="text-xs leading-relaxed text-zinc-400">Ask Aruga Agent any question, even with a photo. Get simple steps + trusted References.</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-800/30">
            <p className="text-xs font-semibold text-teal-200">How will it help you?</p>
            <ul className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs leading-relaxed text-teal-100/80 list-disc pl-4">
              <li>Do therapy right at home — no extra travel</li>
              <li>Know you are on track — therapist feedback after each program</li>
              <li>Stay motivated — see your past wins in History</li>
              <li>Get answers fast — Ask Aruga Agent in plain, short words</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="teal" statusText="Simple & private" />
            <Badge variant="outline" statusText="Works on phone" />
            <Badge variant="outline" statusText="Free to use with your clinic" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        <nav className="lg:sticky lg:top-20 h-fit space-y-1 p-2 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <p className="px-3 py-2 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">Sections</p>
          {sections.map(s => {
            const I = s.icon; const isActive = active === s.id;
            return <button key={s.id} onClick={() => setActive(s.id)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${isActive ? "bg-teal-500/15 text-teal-300 border border-teal-500/20" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border border-transparent"}`}><I className="w-4 h-4 shrink-0" /> {s.label}</button>;
          })}
          <div className="pt-3 mt-3 border-t border-zinc-800">
            <Link href="/aruga-guide" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-teal-400 hover:bg-zinc-800 hover:text-teal-300"><Bot className="w-4 h-4" /> Aruga Guide AI Agent <ArrowRight className="w-3 h-3 ml-auto" /></Link>
          </div>
        </nav>

        <div className="space-y-6 min-w-0">
          {active === "start" && (
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><LayoutDashboard className="w-5 h-5 text-teal-400" /> Start here — find your way</CardTitle></CardHeader>
              <CardContent className="p-6 pt-0 space-y-4 text-sm text-zinc-300">
                <p className="text-xs text-zinc-400">Top bar is your map. It is always at the top.</p>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100">Dashboard</b><br /><span className="text-zinc-400">Your current program, progress, and quick links.</span></div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100">Home Program → Activities</b><br /><span className="text-zinc-400">All programs your therapist gave you. See status, drafts, feedback.</span></div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100">Records → History</b><br /><span className="text-zinc-400">Past programs and therapist feedback.</span></div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100">Ask Aruga Agent</b><br /><span className="text-zinc-400">Ask any question, add a photo, get simple steps + References.</span></div>
                </div>
                <div className="flex flex-wrap gap-2"><Badge variant="outline" statusText="Bell = alerts" /><Badge variant="outline" statusText="Profile = your info" /></div>
              </CardContent>
            </Card>
          )}

          {active === "connect" && (
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><UserPlus className="w-5 h-5 text-teal-400" /> Connect to your therapist</CardTitle></CardHeader>
              <CardContent className="p-6 pt-0 space-y-4 text-sm text-zinc-300">
                <ol className="list-decimal pl-5 space-y-1.5 text-xs text-zinc-400">
                  <li>Go to <b className="text-zinc-200">Dashboard → Connect with your Clinician</b>.</li>
                  <li>Type your therapist’s <b className="text-zinc-200">email or code</b> (they give it to you).</li>
                  <li>Tap <b className="text-zinc-200">Send Request</b>.</li>
                  <li>Wait. Your therapist accepts on their side. You will see a <b className="text-zinc-200">bell notification</b> when done.</li>
                </ol>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400"><b className="text-zinc-100">Edit:</b> If email is wrong, send again with the right one. Your therapist can also invite you directly.</div>
              </CardContent>
            </Card>
          )}

          {active === "programs" && (
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><Home className="w-5 h-5 text-teal-400" /> Home Programs — where your work lives</CardTitle></CardHeader>
              <CardContent className="p-6 pt-0 space-y-4 text-sm text-zinc-300">
                <p className="text-xs text-zinc-400">A Home Program = a set of steps your therapist made for you. Each step may have a worksheet to draw on and a video to record.</p>
                <div>
                  <h4 className="font-semibold text-zinc-100 text-sm mb-2 flex items-center gap-2"><Layers className="w-4 h-4 text-teal-400" /> Navigate</h4>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-400">
                    <li><b className="text-zinc-200">Dashboard</b> shows your current program card. Tap it to open.</li>
                    <li>Or go to <b className="text-zinc-200">Home Program → Activities</b> → you see all programs with status:
                      <div className="flex flex-wrap gap-1.5 mt-1"><Badge variant="teal" statusText="Assigned" /><Badge variant="outline" statusText="Draft" /><Badge variant="amber" statusText="Awaiting Review" /><Badge variant="emerald" statusText="Reviewed" /></div>
                    </li>
                    <li>Use tabs <b className="text-zinc-200">All / Active / Drafts / Past & Feedback</b> to filter.</li>
                    <li>Inside Activities, switch <b className="text-zinc-200">My Home Programs | Worksheets</b> to see drawings vs programs.</li>
                  </ul>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400"><b className="text-zinc-100">Edit your draft:</b> Tap <b className="text-zinc-200">Continue Draft</b> on any program with a draft. Pick up where you left off.</div>
              </CardContent>
            </Card>
          )}

          {active === "do" && (
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><Video className="w-5 h-5 text-teal-400" /> Do & submit — step by step</CardTitle></CardHeader>
              <CardContent className="p-6 pt-0 space-y-5 text-sm text-zinc-300">
                <ol className="list-decimal pl-5 space-y-1.5 text-xs text-zinc-400">
                  <li>Open a program → you see <b className="text-zinc-200">Step 1, 2, 3...</b> Use <b className="text-zinc-200">Next / Back</b> to move. Each step is fresh — old marks do not carry over.</li>
                  <li>Read the step. If there is a <b className="text-zinc-200">worksheet</b>, draw on it: pick pen color, draw, undo, save. Or do the written guide (check boxes).</li>
                  <li><b className="text-zinc-200">Record video</b>: tap Record → allow camera → do the move → Stop. Keep clips short and bright. You can also take a <b className="text-zinc-200">Photo</b> if asked.</li>
                  <li>Optional: add a <b className="text-zinc-200">Note</b> (“felt tired today”).</li>
                  <li>Tap <b className="text-zinc-200">Save</b> (saves as Draft) or move to next step. Drafts stay until you submit.</li>
                  <li>When all steps are done, tap <b className="text-zinc-200">Submit</b>. Your therapist is notified.</li>
                </ol>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100">Navigate:</b><span className="text-zinc-400"> Programs → pick date if your program has many days. Each date is one try.</span></div>
                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 text-amber-200/90">Keep phone steady. Good light. Clips under 25 MB work best.</div>
                </div>
                <Accordion title="How to fix a mistake"><p>Before Submit, go back to the step and tap <b>Record again</b> or <b>Clear drawing</b> → draw again → Save. After Submit, send your therapist a message.</p></Accordion>
              </CardContent>
            </Card>
          )}

          {active === "activities" && (
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><Palette className="w-5 h-5 text-teal-400" /> Worksheets — draw & practice</CardTitle></CardHeader>
              <CardContent className="p-6 pt-0 space-y-4 text-sm text-zinc-300">
                <ol className="list-decimal pl-5 space-y-1 text-xs text-zinc-400">
                  <li>Open a step with a worksheet. You see the print page + drawing tools.</li>
                  <li>Pick <b className="text-zinc-200">Pen</b> color and size, or <b className="text-zinc-200">Eraser</b>. Draw. Use <b className="text-zinc-200">Undo</b> if needed.</li>
                  <li>Tap <b className="text-zinc-200">Save</b>. You can also <b className="text-zinc-200">Download / Print</b> to do it on paper.</li>
                  <li>Some sheets are <b className="text-zinc-200">Written guides</b>: read each line, tap check, type notes, then save.</li>
                </ol>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400"><b className="text-zinc-100">Navigate:</b> Home Program → Activities → <b>Worksheets</b> tab to see all sheets in one place.</div>
              </CardContent>
            </Card>
          )}

          {active === "history" && (
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><History className="w-5 h-5 text-teal-400" /> History & feedback</CardTitle></CardHeader>
              <CardContent className="p-6 pt-0 space-y-4 text-sm text-zinc-300">
                <ol className="list-decimal pl-5 space-y-1 text-xs text-zinc-400">
                  <li>Go to <b className="text-zinc-200">Records → History</b>.</li>
                  <li>See all past programs. Filters: <b className="text-zinc-200">All / Awaiting / Reviewed / Archived</b>.</li>
                  <li>Tap any row to see details: date, steps, your videos, therapist notes.</li>
                  <li>If <b className="text-zinc-200">Reviewed</b>, read overall feedback + per-step notes. Celebrate wins!</li>
                </ol>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400"><b className="text-zinc-100">Tip:</b> Home Program → Activities also shows past feedback under each program card (last 3).</div>
              </CardContent>
            </Card>
          )}

          {active === "aruga-agent" && (
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><Bot className="w-5 h-5 text-teal-400" /> Ask Aruga Agent — ask anything</CardTitle></CardHeader>
              <CardContent className="p-6 pt-0 space-y-4 text-sm text-zinc-300">
                <p className="text-xs text-zinc-400">You can ask simple questions and get easy steps. Works like chat.</p>
                <div>
                  <h4 className="font-semibold text-zinc-100 text-sm mb-2 flex items-center gap-2"><Plus className="w-4 h-4 text-teal-400" /> Create — start a chat</h4>
                  <ol className="list-decimal pl-5 space-y-1 text-xs text-zinc-400">
                    <li>Go to <b className="text-zinc-200">Tools → Aruga Guide AI Agent</b> (or tap <b className="text-zinc-200">Aruga Guide AI Agent</b> in the menu).</li>
                    <li>Tap <b className="text-zinc-200">New chat</b>. Write your question in <b className="text-zinc-200">Ask a question...</b>.</li>
                    <li>Want better help? Tap <b className="text-zinc-200">Attach photo</b> and add a picture.</li>
                    <li>Tap <b className="text-zinc-200">Send</b>. AI answers with short steps + <b className="text-zinc-200">References</b> you can tap.</li>
                  </ol>
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-100 text-sm mb-2 flex items-center gap-2"><Search className="w-4 h-4 text-teal-400" /> Navigate — find your chats</h4>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-400">
                    <li>On the left (or top on phone) you see <b className="text-zinc-200">past chats</b>. Tap one to open.</li>
                    <li>Use <b className="text-zinc-200">Search</b> to find an old chat.</li>
                    <li>Scroll up to read. Tap any <b className="text-zinc-200">Reference</b> to open the web page.</li>
                    <li>Need a person? Tap <b className="text-zinc-200">Send to clinician to verify</b> — your therapist will check.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-100 text-sm mb-2 flex items-center gap-2"><Edit3 className="w-4 h-4 text-teal-400" /> Edit — fix or clear</h4>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-400">
                    <li>Fix last question: tap it, edit, send again for a new answer.</li>
                    <li>Delete one chat: tap <b className="text-zinc-200">trash icon</b> by the chat name.</li>
                    <li>Clear all: tap <b className="text-zinc-200">Clear</b> (top right of Aruga Guide).</li>
                  </ul>
                </div>
                <div className="p-3 rounded-xl bg-teal-950/20 border border-teal-800/30 text-xs text-teal-200/90">Tip: Keep it short. Example: “My child drops the spoon. What can I do at home?” You get 3-4 easy steps.</div>
              </CardContent>
            </Card>
          )}

          {active === "tools" && (
            <div className="space-y-4">
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardHeader className="p-6 pb-3"><CardTitle className="text-base text-zinc-100 flex items-center gap-2"><Wrench className="w-5 h-5 text-teal-400" /> Tools</CardTitle></CardHeader>
                <CardContent className="p-6 pt-0 grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100 flex items-center gap-1"><Bot className="w-3.5 h-3.5 text-teal-400" /> Aruga Guide AI Agent</b><span className="text-zinc-400"> Ask any rehab question. Add a photo. It shows References (web articles). Tap “Send to clinician to verify.”</span><br /><Link href="/aruga-guide" className="text-teal-400 hover:underline">Open →</Link></div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100 flex items-center gap-1"><Scan className="w-3.5 h-3.5 text-sky-400" /> SAM Test</b><span className="text-zinc-400"> Play with image cut-outs. Upload a photo, tap an object, see the mask.</span><br /><Link href="/sam-test" className="text-teal-400 hover:underline">Open →</Link></div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100 flex items-center gap-1"><BookOpen className="w-3.5 h-3.5 text-zinc-300" /> Care Guide</b><span className="text-zinc-400"> Home Program → Care Guide. Tips for daily care from your therapist.</span></div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><b className="text-zinc-100 flex items-center gap-1"><HeartHandshake className="w-3.5 h-3.5 text-amber-400" /> How to use Aruga</b><span className="text-zinc-400"> You are here! Use the left menu to jump to any section.</span></div>
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
                    <li><b className="text-zinc-200">Profile</b>: Top right → Profile (or menu ☰ on phone) → Edit name, details → Save.</li>
                    <li><b className="text-zinc-200">Log out</b>: Top right → Sign out.</li>
                    <li>Use short clips, good light, steady phone.</li>
                    <li>Save draft often. Submit only when done.</li>
                    <li>Need help? Message your therapist or ask Aruga Guide.</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="bg-teal-950/20 border-teal-800/30 p-4 flex items-center justify-between">
                <p className="text-xs text-teal-200/90">Stuck? Ask the AI guide — it can see your photo.</p>
                <Link href="/aruga-guide"><Button size="sm" className="bg-teal-600 hover:bg-teal-500 text-white text-xs h-8">Ask Guide</Button></Link>
              </Card>
            </div>
          )}

          <Card className="bg-zinc-900/40 border-zinc-800">
            <CardHeader className="p-6 pb-3"><CardTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2"><HelpCircle className="w-4 h-4 text-teal-400" /> Quick answers</CardTitle></CardHeader>
            <CardContent className="p-6 pt-0 space-y-2">
              {faqs.filter(f => filter(f.q + f.a)).map(f => (<Accordion key={f.q} title={f.q}><p>{f.a}</p></Accordion>))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
