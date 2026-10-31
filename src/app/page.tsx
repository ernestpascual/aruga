"use client";

import React, { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform } from "motion/react";
import {
  Hand,
  ArrowRight,
  CheckCircle2,
  Lock,
  MessageSquare,
  Activity,
  ChevronDown,
  Baby,
  User,
  HeartPulse,
  GraduationCap,
  FileText,
  ShieldCheck,
  Clock,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Grainient } from "@/components/ui/grainient";
import { useAuth } from "@/lib/supabase/auth-context";
import { siteConfig } from "@/config/site";

export default function LandingPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  const targetRole =
    profile?.role ||
    (user?.user_metadata?.role as "therapist" | "client") ||
    (user?.email?.includes("therapist") ? "therapist" : "client");

  const dashboardHref =
    targetRole === "therapist" ? "/therapist/dashboard" : "/client/dashboard";

  useEffect(() => {
    if (!authLoading && user) {
      setRedirecting(true);
      router.replace(dashboardHref);
    }
  }, [authLoading, user, dashboardHref, router]);

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "-18%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const arrowOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  const headerBg = useTransform(
    scrollYProgress,
    [0.55, 0.85],
    ["rgba(0,0,0,0)", "rgba(0,0,0,1)"]
  );
  const headerBorder = useTransform(
    scrollYProgress,
    [0.55, 0.85],
    ["rgba(255,255,255,0)", "rgba(255,255,255,0.12)"]
  );

  if (redirecting || (!authLoading && user)) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-white border-t-transparent animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold">Welcome to Aruga</p>
          <p className="text-xs text-white/50">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F3EF] text-black selection:bg-black selection:text-white scroll-smooth">
      {/* NAV */}
      <motion.header
        style={{ backgroundColor: headerBg, borderBottomColor: headerBorder }}
        className="fixed top-0 inset-x-0 z-50 w-full border-b pt-3 sm:pt-4 pb-2 sm:pb-3"
      >
        <div className="container mx-auto flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr] h-12 sm:h-14 px-5 sm:px-6 max-w-7xl">
          <div className="flex justify-start shrink-0">
            <Link href="/" className="group flex items-center">
              <span
                className="font-aruga text-lg sm:text-xl font-normal text-white tracking-wide hover:text-white/70 transition-colors duration-200"
                style={{ fontFamily: "'Playwrite IT Trad', 'Playwrite Italia Tradizionale', cursive" }}
              >
                Aruga
              </span>
            </Link>
          </div>
          <nav className="hidden md:flex items-center justify-center gap-8 text-[13px] tracking-[0.03em] text-white font-medium">
            <a href="#overview" className="hover:text-white/70 transition-colors">Overview</a>
            <a href="#disciplines" className="hover:text-white/70 transition-colors">Disciplines</a>
            <a href="#lifespan" className="hover:text-white/70 transition-colors">Lifespan</a>
            <a href="#soap-notes" className="hover:text-white/70 transition-colors">SOAP</a>
            <a href="#safety" className="hover:text-white/70 transition-colors">Safety</a>
          </nav>
          <div className="flex justify-end items-center gap-2.5 sm:gap-3 shrink-0 ml-auto md:ml-0">
            {user ? (
              <Link href={dashboardHref}>
                <Button size="sm" className="text-xs bg-white hover:bg-zinc-100 text-black font-semibold rounded-none px-5">
                  Dashboard <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <span className="bg-black text-white rounded-full px-4 py-1.5 flex items-center gap-1.5 text-[11px]">Sign in <span className="bg-white text-black rounded-full w-4 h-4 flex items-center justify-center">→</span></span>
              </Link>
            )}
          </div>
        </div>
      </motion.header>

      {/* HERO — peg e6373c full-bleed, no card frame */}
      <section ref={heroRef} id="overview" className="w-full min-h-screen flex flex-col bg-white">
        <div className="w-full flex-1 flex flex-col overflow-hidden">
          {/* Hero visual — full width + height */}
          <div className="relative flex-1 min-h-[520px] sm:min-h-screen overflow-hidden">
            {/* Blue grainient — same animation, black replaced with white */}
            <div className="absolute inset-0">
              <Grainient
                colors={["#ffffff", "#f0f7ff", "#1e3a8a", "#2563eb", "#0284c7", "#38bdf8", "#93c5fd"]}
                type="linear"
                angle={60}
                bands={1}
                speed={0.8}
                flow={0.85}
                scale={1.15}
                softness={0.9}
                silk={0.25}
                grainAmount={0.16}
                grainSize={1.3}
                contrast={1.15}
                saturation={1.15}
                interactive={true}
                stir={2.5}
                clickSwirl={true}
                className="w-full h-full"
              />
            </div>
            {/* Dark overlay for text legibility like peg's eye photo */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-black/45" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-transparent" />



            {/* Headline — middle left */}
            <div className="absolute inset-0 flex flex-col justify-center z-10 px-6 sm:px-8 lg:px-12 gap-6">
              <h1 className="text-[32px] sm:text-[44px] lg:text-[52px] font-semibold leading-[0.9] tracking-[-0.02em] text-white max-w-[560px]">
                Therapy doesn&apos;t<br />stop at the<br />clinic door.
              </h1>
              <div className="flex flex-col gap-3 text-white">
                <div className="flex gap-2.5 items-start max-w-[280px]">
                  <span className="w-5 h-5 rounded-full bg-white/15 border border-white/20 flex items-center justify-center shrink-0 mt-0.5 text-[10px]">◈</span>
                  <div><div className="text-[11px] font-semibold leading-none">Real-Time Progress</div><div className="text-[10px] text-white/70 leading-tight">Track reps and form between visits.</div></div>
                </div>
                <div className="flex gap-2.5 items-start max-w-[280px]">
                  <span className="w-5 h-5 rounded-full bg-white/15 border border-white/20 flex items-center justify-center shrink-0 mt-0.5 text-[10px]">✎</span>
                  <div><div className="text-[11px] font-semibold leading-none">Personalized Plans</div><div className="text-[10px] text-white/70 leading-tight">OT, PT, and Speech tailored to you.</div></div>
                </div>
                <div className="flex gap-2.5 items-start max-w-[280px]">
                  <span className="w-5 h-5 rounded-full bg-white/15 border border-white/20 flex items-center justify-center shrink-0 mt-0.5 text-[10px]">♥</span>
                  <div><div className="text-[11px] font-semibold leading-none">Holistic Follow-Through</div><div className="text-[10px] text-white/70 leading-tight">Photo or clip, skip if tired — always safe.</div></div>
                </div>
              </div>
            </div>





            <motion.div style={{ opacity: arrowOpacity }} className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 hidden sm:flex">
              <a href="#disciplines" className="w-7 h-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white/70 hover:text-white"><ChevronDown className="w-3.5 h-3.5" /></a>
            </motion.div>
          </div>

          {/* Below hero — full width, no card */}
          <div className="w-full bg-[#F6F3EF] px-5 sm:px-6 lg:px-8 py-8 sm:py-10">
            <div className="flex items-center gap-2 text-[10px] tracking-[0.12em] uppercase text-black/40"><span>✱</span> Ready to see what your body’s been trying to tell you?</div>
            <h2 className="mt-3 text-[22px] sm:text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-black max-w-xl">A simple, supervised home-program — for people and practitioners.</h2>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
              {/* Step 1 — New Program form */}
              <div className="rounded-2xl overflow-hidden border border-black/5 bg-white flex flex-col">
                <div className="h-[200px] bg-zinc-950 p-3 relative overflow-hidden">
                  <div className="absolute top-3 left-3 bg-white text-black text-[10px] px-2 py-1 rounded-full font-medium">01</div>
                  <div className="mt-7 bg-white rounded-xl p-3 space-y-2.5 border border-zinc-100 shadow-sm">
                    <div className="text-[10px] font-semibold text-black">New Program</div>
                    <div className="text-[10px] text-zinc-500 border border-zinc-200 rounded-lg px-2.5 py-2 bg-zinc-50">cup grasp 10x, block stacking • OT</div>
                    <div className="flex gap-1.5">
                      <span className="text-[9px] bg-teal-600 text-white px-2 py-1 rounded-full">Generate draft</span>
                      <span className="text-[9px] bg-zinc-100 text-zinc-600 px-2 py-1 rounded-full border">Muse Spark 1.3</span>
                    </div>
                    <div className="space-y-1 pt-1 border-t border-zinc-100">
                      <div className="flex gap-2 text-[10px] text-zinc-700"><span className="w-4 h-4 rounded-full bg-teal-600 text-black flex items-center justify-center text-[8px]">1</span> Grasp cup, hold 3 sec — 10 reps</div>
                      <div className="flex gap-2 text-[10px] text-zinc-700"><span className="w-4 h-4 rounded-full bg-zinc-200 flex items-center justify-center text-[8px]">2</span> Stack 4 blocks, slow and steady</div>
                    </div>
                    <div className="bg-black text-white text-[10px] text-center py-1.5 rounded-full font-medium">Assign to client</div>
                  </div>
                </div>
                <div className="p-4"><div className="text-xs font-semibold text-black">Create in seconds</div><div className="text-[11px] text-black/50 mt-1 leading-relaxed">Type a short goal. Get a clear draft to approve.</div></div>
              </div>
              {/* Step 2 — My Programs MediaUploader */}
              <div className="rounded-2xl overflow-hidden border border-black/5 bg-white flex flex-col">
                <div className="h-[200px] bg-zinc-900 p-3 relative overflow-hidden flex flex-col">
                  <div className="absolute top-3 left-3 bg-white text-black text-[10px] px-2 py-1 rounded-full font-medium">02</div>
                  <div className="mt-7 bg-white rounded-xl overflow-hidden border border-zinc-200 shadow-sm flex-1 flex flex-col">
                    <div className="flex gap-2 px-3 pt-2.5 pb-2 border-b border-zinc-100 text-[10px] font-medium">
                      <span className="bg-black text-white px-2.5 py-1 rounded-full">Video</span><span className="bg-zinc-100 text-zinc-500 px-2.5 py-1 rounded-full">Photo</span>
                    </div>
                    <div className="flex-1 bg-black m-2 rounded-lg relative flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center"><div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" /></div>
                      <div className="absolute bottom-1.5 left-1.5 bg-red-600 text-black text-[8px] px-1.5 py-0.5 rounded-full">REC 08s</div>
                      <div className="absolute bottom-1.5 right-1.5 bg-white text-black text-[8px] px-2 py-1 rounded-full font-medium">Stop</div>
                    </div>
                    <div className="px-3 pb-2.5 flex items-center justify-between text-[9px] text-zinc-500"><span>My Programs Record</span><span className="text-emerald-600">Skip if tired</span></div>
                  </div>
                </div>
                <div className="p-4"><div className="text-xs font-semibold text-black">Client records at home</div><div className="text-[11px] text-black/50 mt-1 leading-relaxed">Clients open it on their phone and send a photo or short clip.</div></div>
              </div>
              {/* Step 3 — Submissions review */}
              <div className="rounded-2xl overflow-hidden border border-black/5 bg-white flex flex-col">
                <div className="h-[200px] bg-zinc-950 p-3 relative overflow-hidden">
                  <div className="absolute top-3 left-3 bg-white text-black text-[10px] px-2 py-1 rounded-full font-medium">03</div>
                  <div className="mt-7 bg-white rounded-xl overflow-hidden border border-zinc-200 shadow-sm">
                    <div className="h-24 bg-zinc-900 relative flex items-center justify-center">
                      <div className="absolute inset-2 border-2 border-teal-400/60 rounded-lg" />
                      <div className="w-10 h-10 bg-teal-500/20 border border-teal-400 rounded-full flex items-center justify-center"><Hand className="w-4 h-4 text-teal-400" /></div>
                      <span className="absolute top-1.5 right-1.5 bg-teal-600 text-black text-[7px] px-1.5 py-0.5 rounded-full">SAM 3.1</span>
                      <span className="absolute bottom-1.5 left-1.5 bg-white text-black text-[8px] px-2 py-1 rounded-full">Submissions</span>
                    </div>
                    <div className="px-3 py-2.5 space-y-1.5">
                      <div className="grid grid-cols-4 gap-1">
                        <span className="bg-sky-50 text-sky-700 border border-sky-200 text-[8px] text-center py-1 rounded">S</span>
                        <span className="bg-teal-50 text-teal-700 border border-teal-200 text-[8px] text-center py-1 rounded">O</span>
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[8px] text-center py-1 rounded">A</span>
                        <span className="bg-violet-50 text-violet-700 border border-violet-200 text-[8px] text-center py-1 rounded">P</span>
                      </div>
                      <div className="bg-black text-white text-[9px] text-center py-1.5 rounded-full font-medium">Publish</div>
                    </div>
                  </div>
                </div>
                <div className="p-4"><div className="text-xs font-semibold text-black">You review and publish</div><div className="text-[11px] text-black/50 mt-1 leading-relaxed">Watch the clip and share feedback. Clients see only what you publish.</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — Peg's section 2 style: numbered header + big headline + 3 cols */}
      <section id="disciplines" className="bg-white border-b border-black/10">

        {/* Big headline like "Protein Sequencing by Expansion" */}
        <div className="container mx-auto px-5 sm:px-6 max-w-7xl py-10 sm:py-14">
          <h2 className="font-black tracking-[-0.04em] leading-[0.9] text-black">
            <span className="block text-3xl sm:text-5xl lg:text-6xl">Built for OT, PT</span>
            <span className="block text-3xl sm:text-5xl lg:text-6xl text-black/30">and Speech —</span>
            <span className="block text-3xl sm:text-5xl lg:text-6xl">one workflow.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-xs sm:text-sm text-black/50 leading-relaxed">
            Same simple steps for every clinic. You stay in control.
          </p>

          <div className="mt-10 border-y border-black/10 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black/10">
            <div className="py-6 px-6 flex gap-4 items-start text-left">
              <span className="text-xs font-mono text-black/20 shrink-0">01</span>
              <div className="text-left"><div className="text-xs font-semibold text-black">You set the plan</div><div className="text-[11px] text-black/50 mt-1 leading-relaxed">Write a short goal. Check the draft.</div></div>
            </div>
            <div className="py-6 px-6 flex gap-4 items-start text-left">
              <span className="text-xs font-mono text-black/20 shrink-0">02</span>
              <div className="text-left"><div className="text-xs font-semibold text-black">They practice at home</div><div className="text-[11px] text-black/50 mt-1 leading-relaxed">They send a photo or short clip.</div></div>
            </div>
            <div className="py-6 px-6 flex gap-4 items-start text-left">
              <span className="text-xs font-mono text-black/20 shrink-0">03</span>
              <div className="text-left"><div className="text-xs font-semibold text-black">You review it</div><div className="text-[11px] text-black/50 mt-1 leading-relaxed">Send clear next steps.</div></div>
            </div>
          </div>

          <div className="mt-0 border-b border-black/10 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-black/10">
            {[
              { icon: Hand, title: "Occupational Therapy", desc: "Turn fine motor goals into simple home steps. Families follow and share a quick photo." },
              { icon: Activity, title: "Physical Therapy", desc: "Keep strength and balance going at home. Clients rest when needed." },
              { icon: MessageSquare, title: "Speech-Language Pathology", desc: "Send short speech practice for home. You listen and reply — no auto scores." },
            ].map((d, i) => (
              <div key={i} className="p-8 flex flex-col items-start text-left space-y-3">
                <d.icon className="w-5 h-5 text-black/30" />
                <h3 className="text-sm font-semibold text-black">{d.title}</h3>
                <p className="text-xs text-black/60 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 h-px w-full bg-black/10" />
        </div>
      </section>
      <div className="h-px w-full bg-black/10" />

      {/* LIFESPAN — editorial */}
      <section id="lifespan" className="bg-white border-b border-black/10">
        <div className="container mx-auto px-5 sm:px-6 max-w-7xl py-10 sm:py-14">
          <h2 className="font-black tracking-[-0.04em] leading-[0.9] text-black text-3xl sm:text-5xl">Adapted for every<br/><span className="text-black/25">milestone & generation.</span></h2>
          <p className="mt-4 max-w-2xl text-xs sm:text-sm text-black/50 leading-relaxed">Aruga keeps therapy going at home — simple steps, quick photo or clip, and clear feedback from your clinician.</p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-0 border border-black/10 divide-y md:divide-y-0 md:divide-x divide-black/10">
            {[
              { label: "Pediatric  1–12", title: "Play-Based Developmental", desc: "Aruga turns play into guided home practice. Parents follow short steps and share a quick photo between visits.", points: ["Play at home, not just in clinic","Parents can help easily","Steady progress you can see"], Icon: Baby },
              { label: "Adolescent  13–17", title: "Youth Coordination & Posture", desc: "Aruga gives teens clear tasks they can do on their own. They log it themselves and rest when needed.", points: ["Clear tasks for independence","They track it themselves","Rest is respected"], Icon: GraduationCap },
              { label: "Adult  18–64", title: "Neuro & Orthopedic Recovery", desc: "Aruga brings rehab routines home after stroke or injury. Short clips help you adjust daily tasks.", points: ["Daily tasks made simple","You adjust based on video","Pacing that respects fatigue"], Icon: User },
              { label: "Geriatrics  65+", title: "Dynamic Balance & Fall Prevention", desc: "Aruga supports safe movement at home. Simple steps and family follow-through help prevent falls.", points: ["Safer movement at home","Family-friendly steps","Easy to read and use"], Icon: HeartPulse },
            ].map((c, i) => (
              <div key={i} className="p-6 sm:p-8 space-y-4 bg-white">
                <div className="flex items-center justify-between">
                  <c.Icon className="w-5 h-5 text-black/25" />
                  <span className="text-[10px] tracking-[0.14em] uppercase border border-black/10 px-2.5 py-1 text-black/40">{c.label}</span>
                </div>
                <h3 className="text-sm font-semibold text-black">{c.title}</h3>
                <p className="text-xs text-black/40 leading-relaxed">{c.desc}</p>
                <ul className="pt-3 border-t border-black/10 space-y-1.5 text-xs text-black/55">
                  {c.points.map(p => <li key={p} className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-black/25 shrink-0 mt-0.5" />{p}</li>)}
                </ul>
              </div>
            ))}
          <div className="mt-8 h-px w-full bg-black/10" />
          </div>
        </div>
      </section>

      {/* Breaker */}
      <div className="h-px w-full bg-black/10" />

      {/* SOAP */}
      <section id="soap-notes" className="bg-white border-b border-black/10">
        <div className="container mx-auto px-5 sm:px-6 max-w-7xl py-10 sm:py-14">
          <h2 className="font-black tracking-[-0.04em] leading-[0.9] text-black text-3xl sm:text-5xl">Clinical notes.<br/><span className="text-black/25">Telehealth & assessments.</span></h2>
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-0 border border-black/10 divide-y lg:divide-y-0 lg:divide-x divide-black/10">
            <div className="p-6 sm:p-8 space-y-4">
              <FileText className="w-5 h-5 text-black/30" />
              <h3 className="text-sm font-semibold text-black">Standardized Progress Notes (SOAP)</h3>
              <p className="text-xs text-black/40 leading-relaxed">Separate documentation into Subjective, Objective, Assessment, Plan with auto-filled kinematic observations.</p>
              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-black/10 text-[11px] font-mono">
                <span className="border border-black/10 py-2 text-center text-black/50">S: Subjective</span>
                <span className="border border-black/10 py-2 text-center text-black/50">O: Objective</span>
                <span className="border border-black/10 py-2 text-center text-black/50">A: Assessment</span>
                <span className="border border-black/10 py-2 text-center text-black/50">P: Plan</span>
              </div>
            </div>
            <div className="p-6 sm:p-8 space-y-4">
              <Video className="w-5 h-5 text-black/30" />
              <h3 className="text-sm font-semibold text-black">Telehealth & Standardized Tests</h3>
              <p className="text-xs text-black/40 leading-relaxed">Attach Google Meet / Zoom recordings and link validated sheets (PDMS-2, BBS, Fugl-Meyer, TUG).</p>
              <ul className="pt-4 border-t border-black/10 space-y-2 text-xs text-black/50">
                <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-black/25" /> One-click session video playback</li>
                <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-black/25" /> Attach verified standardized reports</li>
              </ul>
            </div>
            <div className="p-6 sm:p-8 space-y-4">
              <Lock className="w-5 h-5 text-black/30" />
              <h3 className="text-sm font-semibold text-black">Record Lock & Feedback Edits</h3>
              <p className="text-xs text-black/40 leading-relaxed">Once published, submission locks for integrity. Clinicians can revise feedback anytime.</p>
              <ul className="pt-4 border-t border-black/10 space-y-2 text-xs text-black/50">
                <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-black/25" /> Client locked after review</li>
                <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-black/25" /> Clinician updates anytime</li>
              </ul>
            </div>
          <div className="mt-8 h-px w-full bg-black/10" />
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-black/10" />

      {/* SAFETY — breaker */}
      <section id="safety" className="bg-black border-y border-white/10">
        <div className="container mx-auto px-5 sm:px-6 max-w-7xl py-10 sm:py-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="shrink-0">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white leading-tight">Safe and private<br/><span className="text-white/40">by design.</span></h2>
              <p className="mt-2 text-[11px] tracking-[0.1em] uppercase text-white/30">HIPAA-compliant infrastructure</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 flex-1 lg:max-w-3xl">
              {[
                { Icon: Clock, t: "Auto logoff", d: "Logs out when idle to keep records safe." },
                { Icon: ShieldCheck, t: "Audit log", d: "Every view and publish is tracked." },
                { Icon: Lock, t: "De-identified", d: "Names are removed before any AI help." },
                { Icon: FileText, t: "Private storage", d: "Videos stay in your private, secure space." },
              ].map((f) => (
                <div key={f.t} className="space-y-2 border-t border-white/10 pt-4">
                  <div className="flex items-center gap-2"><f.Icon className="w-4 h-4 text-white/60" /><h3 className="text-xs font-semibold text-white">{f.t}</h3></div>
                  <p className="text-[11px] text-white/50 leading-relaxed">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-white/10 pt-8">
            <p className="text-sm text-white/60">Ready to feel Aruga?</p>
            <Link href="/login">
              <span className="inline-flex items-center gap-2 bg-white text-black text-sm font-semibold px-8 py-3 rounded-full hover:bg-zinc-100 transition-colors">Sign up <ArrowRight className="w-4 h-4" /></span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-white py-10 px-5 sm:px-6 border-t border-black/10">
        <div className="container mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-aruga text-lg font-normal tracking-wide" style={{ fontFamily: "'Playwrite IT Trad', 'Playwrite Italia Tradizionale', cursive" }}>Aruga</div>
          <div className="text-[11px] font-mono text-black/25">© 2026 Aruga • All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
