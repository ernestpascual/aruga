"use client";

import React, { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform } from "motion/react";
import {
  Hand,
  Sparkles,
  Shield,
  ArrowRight,
  Layers,
  CheckCircle2,
  Lock,
  MessageSquare,
  Activity,
  AlertTriangle,
  ChevronDown,
  Baby,
  User,
  HeartHandshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Grainient } from "@/components/ui/grainient";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "@/components/theme-provider";
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

  const { theme } = useTheme();
  const isLight = theme === "light";

  // Menu bar transforms: transparent for hero section, smoothly shifts on the next section
  const headerBg = useTransform(
    scrollYProgress,
    [0.55, 0.85],
    [
      isLight ? "rgba(248, 250, 252, 0)" : "rgba(9, 9, 11, 0)",
      isLight ? "rgba(255, 255, 255, 0.94)" : "rgba(9, 9, 11, 0.92)",
    ]
  );
  const headerBorder = useTransform(
    scrollYProgress,
    [0.55, 0.85],
    [
      isLight ? "rgba(226, 232, 240, 0)" : "rgba(39, 39, 42, 0)",
      isLight ? "rgba(226, 232, 240, 0.85)" : "rgba(39, 39, 42, 0.8)",
    ]
  );
  const headerBlur = useTransform(
    scrollYProgress,
    [0.55, 0.85],
    ["blur(0px)", "blur(12px)"]
  );
  const headerShadow = useTransform(
    scrollYProgress,
    [0.55, 0.85],
    [
      "0px 0px 0px 0px rgba(0, 0, 0, 0)",
      isLight
        ? "0px 4px 20px -2px rgba(15, 23, 42, 0.08)"
        : "0px 4px 20px -2px rgba(0, 0, 0, 0.5)",
    ]
  );

  if (redirecting || (!authLoading && user)) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-zinc-200">Welcome to Aruga</p>
          <p className="text-xs text-zinc-500">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-teal-500/30 selection:text-teal-200 scroll-smooth">
      {/* ------------------------------------------------------------------ */}
      {/* NAVIGATION HEADER                                                  */}
      {/* ------------------------------------------------------------------ */}
      <motion.header
        style={{
          backgroundColor: headerBg,
          borderBottomColor: headerBorder,
          backdropFilter: headerBlur,
          WebkitBackdropFilter: headerBlur,
          boxShadow: headerShadow,
        }}
        className="fixed top-0 inset-x-0 z-50 w-full border-b pt-3 sm:pt-4 pb-2 sm:pb-3 transition-colors duration-200"
      >
        <div className="container mx-auto flex h-12 sm:h-14 items-center justify-between px-4 sm:px-6 max-w-7xl">
          <Link href="/" className="group flex items-center">
            <span
              className="font-aruga text-lg sm:text-xl font-normal text-zinc-100 tracking-wide hover:text-teal-300 transition-colors duration-200"
              style={{ fontFamily: "'Playwrite IT Trad', 'Playwrite Italia Tradizionale', cursive" }}
            >
              Aruga
            </span>
          </Link>

          {/* Simplified Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs text-zinc-300 font-medium">
            <a
              href="#overview"
              className="relative py-1 hover:text-zinc-100 transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 hover:after:w-full after:bg-teal-400 after:transition-all after:duration-300"
            >
              Overview
            </a>
            <a
              href="#disciplines"
              className="relative py-1 hover:text-zinc-100 transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 hover:after:w-full after:bg-teal-400 after:transition-all after:duration-300"
            >
              Disciplines
            </a>
            <a
              href="#lifespan"
              className="relative py-1 hover:text-zinc-100 transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 hover:after:w-full after:bg-teal-400 after:transition-all after:duration-300"
            >
              Pediatric & Adult
            </a>
            <a
              href="#safety"
              className="relative py-1 hover:text-zinc-100 transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 hover:after:w-full after:bg-teal-400 after:transition-all after:duration-300"
            >
              Safety & AI
            </a>
          </nav>

          {/* Action CTAs & Theme Toggle */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <ThemeToggle />

            {user ? (
              <Link href={dashboardHref}>
                <Button
                  size="sm"
                  className="text-xs bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold gap-1.5 shadow-sm group"
                >
                  <span>Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-zinc-800 text-zinc-300 hover:text-zinc-100 bg-zinc-900/60 hover:bg-zinc-800 backdrop-blur-sm"
                >
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </motion.header>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 1: HERO SECTION                                            */}
      {/* ------------------------------------------------------------------ */}
      <section
        ref={heroRef}
        id="overview"
        className="relative scroll-mt-0 min-h-screen flex flex-col justify-center items-center overflow-hidden border-b border-zinc-800/80 bg-zinc-950 px-4 sm:px-6 pt-24 sm:pt-28 pb-12"
      >
        {/* Grainient Animated WebGL2 Background (React Bits) */}
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
          <Grainient
            colors={["#020617", "#0f172a", "#1e3a8a", "#2563eb", "#0284c7", "#38bdf8", "#93c5fd"]}
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
            saturation={1.3}
            interactive={true}
            stir={2.5}
            clickSwirl={true}
            className="w-full h-full"
          />
        </div>

        {/* Subtle top and bottom atmospheric blend for contrast */}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-zinc-950/40 via-transparent to-zinc-950/90 pointer-events-none" />

        {/* Multi-layered smooth transition to next section */}
        <div className="absolute bottom-0 inset-x-0 h-36 sm:h-48 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent pointer-events-none z-10" />

        {/* Luminous horizon accent beam */}
        <div className="absolute bottom-0 inset-x-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-full max-w-5xl h-px bg-gradient-to-r from-transparent via-sky-500/60 via-blue-500/50 to-transparent" />
          <div className="absolute w-80 h-3 bg-gradient-to-r from-blue-500/20 via-sky-500/30 to-transparent blur-lg rounded-full" />
        </div>

        {/* Hero Content with Smooth Scroll Parallax Translation */}
        <motion.div
          style={{ y: heroY, opacity: heroOpacity, scale: heroScale }}
          className="flex flex-col items-center text-center space-y-7 max-w-4xl relative z-20 select-none my-auto py-12"
        >
          {/* Headline Statement */}
          <div className="space-y-3">
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-zinc-100 leading-[1.08] drop-shadow-sm"
            >
              Therapy doesn't stop at the clinic door.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              className="text-xl sm:text-2xl md:text-3xl font-semibold bg-gradient-to-r from-teal-300 via-sky-400 to-blue-400 bg-clip-text text-transparent"
            >
              Direct home programs with clinician-verified AI.
            </motion.p>
          </div>

          {/* Concise Core Statement */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            className="text-base sm:text-lg text-zinc-300 max-w-2xl leading-relaxed"
          >
            Prescribe custom routines, record practice clips, and verify progress with computer vision—designed for both pediatric early development and adult neurological recovery, always 100% clinician-reviewed.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            className="pt-2 flex flex-wrap items-center justify-center gap-4"
          >
            <Link href={user ? dashboardHref : "/login"}>
              <Button className="h-12 px-8 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold text-base shadow-lg shadow-teal-950/60 gap-2 group">
                <span>{user ? "Go to Dashboard" : "Sign In to Aruga"}</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
            </Link>

            <a href="#disciplines">
              <Button
                variant="outline"
                className="h-12 px-6 border-zinc-800 bg-zinc-950/70 text-zinc-200 hover:text-zinc-50 hover:border-zinc-700 text-base backdrop-blur-sm"
              >
                See How It Works
              </Button>
            </a>
          </motion.div>
        </motion.div>

        {/* Floating Arrow Down Button */}
        <motion.div
          style={{ opacity: arrowOpacity }}
          className="absolute bottom-8 inset-x-0 flex justify-center z-20 pointer-events-auto"
        >
          <a
            href="#disciplines"
            aria-label="Scroll to next section"
            className="p-3 rounded-full bg-zinc-950/70 border border-zinc-800/80 hover:border-sky-400/60 text-zinc-400 hover:text-sky-300 backdrop-blur-md shadow-lg shadow-black/40 hover:shadow-sky-500/20 transition-all duration-300 group"
          >
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            >
              <ChevronDown className="w-5 h-5 group-hover:text-sky-300 transition-colors" />
            </motion.div>
          </a>
        </motion.div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 2: DISCIPLINES & WORKFLOW                                  */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="disciplines"
        className="relative scroll-mt-24 py-20 md:py-28 border-b border-zinc-800/80 bg-zinc-950 overflow-hidden"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-32 bg-gradient-to-b from-sky-500/10 to-transparent blur-3xl pointer-events-none" />
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl space-y-16">
          {/* 4 Feature Highlights (Moved from Hero) */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto"
          >
            <motion.div
              whileHover={{ y: -4, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-teal-500/50 text-left transition-all cursor-default shadow-sm backdrop-blur-md"
            >
              <div className="flex items-center gap-2 text-zinc-200 font-semibold text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Human Verified</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">Zero unchecked AI decisions</p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-teal-500/50 text-left transition-all cursor-default shadow-sm backdrop-blur-md"
            >
              <div className="flex items-center gap-2 text-zinc-200 font-semibold text-xs sm:text-sm">
                <Layers className="w-4 h-4 text-teal-400 shrink-0" />
                <span>SAM 3.1 Tracking</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">Precise motion segmentation</p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-teal-500/50 text-left transition-all cursor-default shadow-sm backdrop-blur-md"
            >
              <div className="flex items-center gap-2 text-zinc-200 font-semibold text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Muse Spark 1.3</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">Fast routine drafting</p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-teal-500/50 text-left transition-all cursor-default shadow-sm backdrop-blur-md"
            >
              <div className="flex items-center gap-2 text-zinc-200 font-semibold text-xs sm:text-sm">
                <Lock className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Private Storage</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">Direct encrypted video</p>
            </motion.div>
          </motion.div>

          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <Badge variant="teal" statusText="Disciplines" />
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-zinc-100">
              Built for OT, SLP, and PT.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              One unified home-care platform for speech, occupational, and physical therapy.
            </p>
          </div>

          {/* Three Discipline Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* OT Card */}
            <motion.div
              whileHover={{
                y: -6,
                borderColor: "rgba(20, 184, 166, 0.6)",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(20, 184, 166, 0.15)",
              }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4 cursor-pointer transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-950/80 border border-teal-500/40 text-teal-400 flex items-center justify-center group-hover:scale-110 group-hover:rotate-2 group-hover:border-teal-400/80 transition-all duration-300">
                <Hand className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-100 group-hover:text-teal-200 transition-colors">
                  Occupational Therapy
                </h3>
                <span className="text-[11px] text-teal-400 font-mono font-medium uppercase">
                  Fine Motor & Daily Living
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Tabletop grasping, pinch-and-release, and object transfer. SAM 3.1 tracks everyday utensils, cups, and blocks.
              </p>
              <div className="pt-2 text-[11px] text-zinc-500 border-t border-zinc-800 flex items-center gap-1.5 group-hover:text-zinc-400 transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Visual target tracking</span>
              </div>
            </motion.div>

            {/* SLP Card */}
            <motion.div
              whileHover={{
                y: -6,
                borderColor: "rgba(20, 184, 166, 0.6)",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(20, 184, 166, 0.15)",
              }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4 cursor-pointer transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 flex items-center justify-center group-hover:scale-110 group-hover:rotate-2 group-hover:text-teal-300 group-hover:border-teal-400/60 transition-all duration-300">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-100 group-hover:text-teal-200 transition-colors">
                  Speech-Language Pathology
                </h3>
                <span className="text-[11px] text-zinc-400 font-mono font-medium uppercase">
                  Voice & Articulation
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Vocal resonance, phonation, and breath control. High-fidelity audio playback lets clinicians listen without automated scoring.
              </p>
              <div className="pt-2 text-[11px] text-zinc-500 border-t border-zinc-800 flex items-center gap-1.5 group-hover:text-zinc-400 transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Therapist audio review</span>
              </div>
            </motion.div>

            {/* PT Card */}
            <motion.div
              whileHover={{
                y: -6,
                borderColor: "rgba(20, 184, 166, 0.6)",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(20, 184, 166, 0.15)",
              }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4 cursor-pointer transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 flex items-center justify-center group-hover:scale-110 group-hover:rotate-2 group-hover:text-teal-300 group-hover:border-teal-400/60 transition-all duration-300">
                <Activity className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-100 group-hover:text-teal-200 transition-colors">
                  Physical Therapy
                </h3>
                <span className="text-[11px] text-zinc-400 font-mono font-medium uppercase">
                  Mobility & Posture
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Joint elevation, forearm supination, and seated posture. Patients report fatigue directly to skip steps safely.
              </p>
              <div className="pt-2 text-[11px] text-zinc-500 border-t border-zinc-800 flex items-center gap-1.5 group-hover:text-zinc-400 transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Fatigue-aware pacing</span>
              </div>
            </motion.div>
          </div>

          {/* Sequential 3-Step Workflow */}
          <div className="space-y-8 pt-4">
            <div className="text-center max-w-xl mx-auto space-y-1">
              <h3 className="text-lg font-bold text-zinc-200">How It Works</h3>
              <p className="text-xs text-zinc-400">
                Clinician-supervised at every step.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              {/* Step 1 */}
              <motion.div
                whileHover={{ y: -4, borderColor: "rgba(20, 184, 166, 0.5)" }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="group p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-3 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-teal-950 border border-teal-500/50 text-teal-400 font-bold text-xs flex items-center justify-center group-hover:scale-110 group-hover:border-teal-400 group-hover:shadow-[0_0_12px_rgba(20,184,166,0.3)] transition-all">
                  1
                </div>
                <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-teal-200 transition-colors">
                  Prescribe
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Draft quick shorthand notes. Muse Spark 1.3 turns them into clear steps for clinician approval.
                </p>
              </motion.div>

              {/* Step 2 */}
              <motion.div
                whileHover={{ y: -4, borderColor: "rgba(20, 184, 166, 0.5)" }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="group p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-3 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-xs flex items-center justify-center group-hover:scale-110 group-hover:border-teal-400 group-hover:text-teal-300 group-hover:shadow-[0_0_12px_rgba(20,184,166,0.3)] transition-all">
                  2
                </div>
                <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-teal-200 transition-colors">
                  Practice & Record
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Patients complete routines and record up to 30-second clips direct to private storage.
                </p>
              </motion.div>

              {/* Step 3 */}
              <motion.div
                whileHover={{ y: -4, borderColor: "rgba(20, 184, 166, 0.5)" }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="group p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-3 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-xs flex items-center justify-center group-hover:scale-110 group-hover:border-teal-400 group-hover:text-teal-300 group-hover:shadow-[0_0_12px_rgba(20,184,166,0.3)] transition-all">
                  3
                </div>
                <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-teal-200 transition-colors">
                  Review & Verify
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Inspect SAM 3.1 tracking overlays, verify key observations, and publish personalized feedback.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 2.5: LIFESPAN CARE: PEDIATRIC & ADULT WORKFLOWS             */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="lifespan"
        className="scroll-mt-24 py-20 md:py-28 border-b border-zinc-800/80 bg-zinc-950/70"
      >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <Badge variant="teal" statusText="Rehabilitation Across the Lifespan" />
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-zinc-100">
              Tailored for Both Pediatric & Adult Care.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-2xl mx-auto">
              Whether helping a child master bilateral coordination through play or guiding an adult recovering hand function after a stroke—Aruga adapts to every clinical age and milestone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Pediatric Card */}
            <motion.div
              whileHover={{ y: -5 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="rounded-2xl border border-sky-500/30 bg-zinc-900/80 p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-lg group hover:border-sky-500/60 transition-colors"
            >
              <div className="absolute top-0 right-0 w-36 h-36 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-sky-950/80 border border-sky-500/40 text-sky-400 flex items-center justify-center">
                  <Baby className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-950/80 border border-sky-500/40 text-sky-300">
                  Pediatric (Ages 1–17)
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-zinc-100 group-hover:text-sky-300 transition-colors">
                  Play-Based Developmental Therapy
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  Engineered for pediatric occupational therapy, speech articulation development, and early intervention motor routines.
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t border-zinc-800">
                <div className="flex items-start gap-2.5 text-xs text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span><strong>Engaging Tabletop Play:</strong> Pegboards, modeling dough beads, block towers, and sticker peeling games.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span><strong>Caregiver Co-Participation:</strong> Parents comfortably record short clips without confusing medical interfaces.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span><strong>Non-Punitive Rest:</strong> Built-in skip handling lets children pause when overstimulated or fatigued.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span><strong>SAM 3.1 Toy Tracking:</strong> Vision models recognize soft blocks, toys, and pegs without invasive sensors.</span>
                </div>
              </div>

              <div className="pt-2">
                <Link href="/login">
                  <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-sky-500/40 text-sky-300 hover:bg-sky-950/40">
                    <Baby className="w-3.5 h-3.5" />
                    <span>Try Pediatric Demo Account (Leo, 6y)</span>
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Adult Card */}
            <motion.div
              whileHover={{ y: -5 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="rounded-2xl border border-teal-500/30 bg-zinc-900/80 p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-lg group hover:border-teal-500/60 transition-colors"
            >
              <div className="absolute top-0 right-0 w-36 h-36 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-teal-950/80 border border-teal-500/40 text-teal-400 flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-950/80 border border-teal-500/40 text-teal-300">
                  Adult (Ages 18+)
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-zinc-100 group-hover:text-teal-300 transition-colors">
                  Neurological & Orthopedic Recovery
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  Tailored for adult post-stroke hemiparesis, traumatic brain injury recovery, and functional daily living independence.
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t border-zinc-800">
                <div className="flex items-start gap-2.5 text-xs text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <span><strong>Activities of Daily Living (ADL):</strong> Cup transfers, pinch-and-release, forearm supination, and utensil grasp.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <span><strong>Fatigue-Aware Pacing:</strong> Prevents harmful shoulder hiking compensation by honoring client fatigue logs.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <span><strong>Objective Visual Overlays:</strong> SAM 3.1 video segmentation provides therapists with real-time motion bounds.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <span><strong>Private 1-on-1 Messaging:</strong> Clinician threads with clickable routine chips for continuous supervision.</span>
                </div>
              </div>

              <div className="pt-2">
                <Link href="/login">
                  <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-teal-500/40 text-teal-300 hover:bg-teal-950/40">
                    <User className="w-3.5 h-3.5" />
                    <span>Try Adult Demo Account (Marcus, 58y)</span>
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 3: CLINICAL SAFETY & AI                                    */}
      {/* ------------------------------------------------------------------ */}
      <section id="safety" className="scroll-mt-24 py-20 md:py-28 border-b border-zinc-800/80 bg-zinc-950">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl space-y-16">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <Badge variant="amber" statusText="Safety First" />
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-zinc-100">
              AI assists. Clinicians decide.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Aruga provides visual tracking and drafting support—never automated medical diagnoses or unsupervised scoring.
            </p>
          </div>

          {/* 4 Architecture Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              whileHover={{ y: -4, borderColor: "rgba(20, 184, 166, 0.5)" }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-2.5 transition-colors cursor-default"
            >
              <div className="flex items-center gap-2.5 text-zinc-200">
                <Shield className="w-5 h-5 text-teal-400 group-hover:scale-110 transition-transform duration-200" />
                <h3 className="text-sm font-bold group-hover:text-teal-200 transition-colors">
                  No Automated Diagnosis
                </h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Zero autonomous clinical decisions or invented movement grades. Every observation must be confirmed by the therapist.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, borderColor: "rgba(20, 184, 166, 0.5)" }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-2.5 transition-colors cursor-default"
            >
              <div className="flex items-center gap-2.5 text-zinc-200">
                <Layers className="w-5 h-5 text-teal-400 group-hover:scale-110 transition-transform duration-200" />
                <h3 className="text-sm font-bold group-hover:text-teal-200 transition-colors">
                  Official SAM 3.1 Parser
                </h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Streams normalized bounding boxes and masks directly through the official <code className="text-teal-300 font-mono text-[11px]">@meta-sam/parser</code> library.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, borderColor: "rgba(20, 184, 166, 0.5)" }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-2.5 transition-colors cursor-default"
            >
              <div className="flex items-center gap-2.5 text-zinc-200">
                <Lock className="w-5 h-5 text-teal-400 group-hover:scale-110 transition-transform duration-200" />
                <h3 className="text-sm font-bold group-hover:text-teal-200 transition-colors">
                  Private Video Storage
                </h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Recordings upload directly to private, encrypted storage buckets with tamper-proof submission freezes.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -4, borderColor: "rgba(20, 184, 166, 0.5)" }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-2.5 transition-colors cursor-default"
            >
              <div className="flex items-center gap-2.5 text-zinc-200">
                <MessageSquare className="w-5 h-5 text-teal-400 group-hover:scale-110 transition-transform duration-200" />
                <h3 className="text-sm font-bold group-hover:text-teal-200 transition-colors">
                  Scoped 1-on-1 Messaging
                </h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Direct therapist-client thread with safety banners and quick links to assigned routines.
              </p>
            </motion.div>
          </div>

          {/* Call to Action Banner */}
          <motion.div
            whileHover={{ borderColor: "rgba(20, 184, 166, 0.7)" }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-teal-500/40 bg-zinc-900/90 p-8 sm:p-10 relative overflow-hidden text-center space-y-4 shadow-xl"
          >
            <div className="max-w-xl mx-auto space-y-1.5">
              <h3 className="text-xl sm:text-2xl font-bold text-zinc-100">
                Experience Aruga
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400">
                Try demo accounts for Dr. Elena Ramos (Therapist), Marcus Vance (Adult Client), or Leo Chen (Pediatric Client).
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Link href={user ? dashboardHref : "/login"}>
                <Button className="h-11 px-7 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold text-sm shadow-md gap-2 group">
                  <span>{user ? "Go to Dashboard" : "Sign In to Aruga"}</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER                                                             */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t border-zinc-800 bg-zinc-950 py-12 px-4 sm:px-6">
        <div className="container mx-auto max-w-7xl space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand column */}
            <div className="space-y-3 md:col-span-2">
              <Link href="/" className="inline-block group">
                <span
                  className="font-aruga text-lg sm:text-xl font-normal text-zinc-100 tracking-wide hover:text-teal-300 transition-colors duration-200"
                  style={{ fontFamily: "'Playwrite IT Trad', 'Playwrite Italia Tradizionale', cursive" }}
                >
                  Aruga
                </span>
              </Link>
              <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
                Clinician-directed home therapy for OT, SLP, and PT across pediatric and adult rehabilitation with verified visual AI assistance.
              </p>
              <div className="text-[11px] text-zinc-500">
                Pediatric & Adult clinical demonstration prototype.
              </div>
            </div>

            {/* Quick Portals */}
            <div className="space-y-2 text-xs">
              <div className="font-semibold text-zinc-200 uppercase tracking-wider text-[11px]">
                Care Portals
              </div>
              <ul className="space-y-2 text-zinc-400">
                <li>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1 hover:text-teal-400 hover:translate-x-1 transition-all duration-200"
                  >
                    Therapist Portal
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1 hover:text-teal-400 hover:translate-x-1 transition-all duration-200"
                  >
                    Client Portal
                  </Link>
                </li>
                <li>
                  <Link
                    href="/accept-invitation"
                    className="inline-flex items-center gap-1 hover:text-teal-400 hover:translate-x-1 transition-all duration-200"
                  >
                    Accept Invitation
                  </Link>
                </li>
              </ul>
            </div>

            {/* Documentation & Safety */}
            <div className="space-y-2 text-xs">
              <div className="font-semibold text-zinc-200 uppercase tracking-wider text-[11px]">
                Documentation
              </div>
              <ul className="space-y-2 text-zinc-400">
                <li>
                  <a
                    href="/login"
                    className="inline-flex items-center gap-1 hover:text-teal-400 hover:translate-x-1 transition-all duration-200"
                  >
                    Meta AI Integration
                  </a>
                </li>
                <li>
                  <a
                    href="/login"
                    className="inline-flex items-center gap-1 hover:text-teal-400 hover:translate-x-1 transition-all duration-200"
                  >
                    Demo Walkthrough
                  </a>
                </li>
                <li>
                  <a
                    href="/login"
                    className="inline-flex items-center gap-1 hover:text-teal-400 hover:translate-x-1 transition-all duration-200"
                  >
                    Performance & Latency
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Emergency Disclaimer & Copyright */}
          <div className="pt-6 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
            <p className="flex items-center gap-1.5 text-center sm:text-left">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
              <span>
                Not an emergency service. In an emergency, dial 911.
              </span>
            </p>
            <p className="shrink-0 font-mono text-[11px]">
              © 2026 {siteConfig.name} • All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
