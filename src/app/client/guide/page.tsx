"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  UserPlus,
  Play,
  Video,
  MessageSquare,
  Star,
  CheckCircle2,
  ArrowRight,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";

const steps = [
  {
    n: "01",
    title: "Connect with your therapist",
    desc: "Dashboard → Connect with your Clinician. Enter clinic email and send request.",
    icon: UserPlus,
    accent: "teal",
  },
  {
    n: "02",
    title: "Open your Home Program",
    desc: "Dashboard or Home Program tab. Check instructions for each step.",
    icon: Play,
    accent: "teal",
  },
  {
    n: "03",
    title: "Record & submit",
    desc: "Do the exercises, record short clips per step, then submit.",
    icon: Video,
    accent: "amber",
  },
  {
    n: "04",
    title: "Check feedback",
    desc: "Go to History to see therapist reviews, scores, and notes.",
    icon: Star,
    accent: "sky",
  },
  {
    n: "05",
    title: "Message if needed",
    desc: "Use Messages to ask questions. Type @ to link a program.",
    icon: MessageSquare,
    accent: "teal",
  },
  {
    n: "06",
    title: "Explore activities",
    desc: "Try Activities for extra practice. Use drag & drop photos in Messages.",
    icon: BookOpen,
    accent: "zinc",
  },
];

export default function ClientGuidePage() {
  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div className="p-4 sm:p-8 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-teal-950/40 border border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="teal" icon={<HelpCircle className="w-3.5 h-3.5" />} statusText="Client Guide" />
              <span className="text-xs text-zinc-400">Quick start • 2 min read</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">How to use Aruga</h1>
            <p className="text-sm text-zinc-400 max-w-xl">Six short steps to do your exercises and stay connected with your clinician.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/client">
              <Button className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold h-9 px-5 text-xs">
                <Play className="w-4 h-4" /> Start program
              </Button>
            </Link>
            <Link href="/client/messages">
              <Button variant="outline" className="h-9 px-5 text-xs gap-2 border-zinc-700">
                <MessageSquare className="w-4 h-4" /> Messages
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.n} className="bg-zinc-900/60 border-zinc-800 flex flex-col h-full hover:border-zinc-700 transition-colors">
              <CardHeader className="p-6 pb-4 flex flex-row items-center justify-between">
                <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">{s.n}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                  s.accent === "teal" ? "bg-teal-950/60 border-teal-500/30 text-teal-400" :
                  s.accent === "amber" ? "bg-amber-950/40 border-amber-500/30 text-amber-400" :
                  s.accent === "sky" ? "bg-sky-950/60 border-sky-500/30 text-sky-400" :
                  "bg-zinc-800 border-zinc-700 text-zinc-300"
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0 flex-1 flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-zinc-100">{s.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{s.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tips */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-zinc-900/60 border-zinc-800">
          <CardHeader className="p-6 pb-4">
            <CardTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-teal-400" /> Quick tips</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0 grid sm:grid-cols-2 gap-3 text-xs text-zinc-400">
            <div className="flex gap-2"><span className="text-teal-400">•</span><span>Keep clips under 25 MB. Good light, stable camera.</span></div>
            <div className="flex gap-2"><span className="text-teal-400">•</span><span>Submit only when all steps are ready.</span></div>
            <div className="flex gap-2"><span className="text-teal-400">•</span><span>You can attach photos in Messages via button or drag & drop.</span></div>
            <div className="flex gap-2"><span className="text-teal-400">•</span><span>Check Notifications bell for invites and feedback.</span></div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/60 border-zinc-800 p-6 flex flex-col justify-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200"><ShieldCheck className="w-4 h-4 text-teal-400" /> Private & supervised</div>
          <p className="text-xs text-zinc-500 leading-relaxed">Your videos are only shared with your assigned therapist. Need help? Message your clinician.</p>
          <Link href="/aruga-guide" className="text-xs text-teal-400 hover:underline flex items-center gap-1">Open Aruga Guide <ArrowRight className="w-3 h-3" /></Link>
        </Card>
      </div>
    </div>
  );
}
