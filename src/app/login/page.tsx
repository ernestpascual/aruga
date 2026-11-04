"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Stethoscope,
  User,
  Baby,
  GraduationCap,
  HeartPulse,
  Lock,
  Mail,
  ArrowRight,
  Shield,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/lib/supabase/auth-context";
import { UserRole, ClientCategory } from "@/types/database";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, user, profile, loading: authLoading, resetPassword, changePassword } = useAuth();

  const [mode, setMode] = useState<"signin" | "register" | "forgot" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("client");
  const [clientCategory, setClientCategory] = useState<ClientCategory>("adult");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check URL params for password recovery link
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      if (params.get("mode") === "reset" || hash.includes("type=recovery")) {
        setMode("reset");
      }
    }
  }, []);

  // Hard reset on mount: browser bfcache / Next router cache can restore stale inputs
  // with loading=true ("Connecting…"). Mount effect clears it unconditionally.
  React.useEffect(() => {
    setLoading(false);
    // If not a password-reset deep link, clear any Autofill/bfcache restored values
    const p = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const isResetLink = p?.get("mode") === "reset" || (typeof window !== "undefined" && window.location.hash.includes("type=recovery"));
    if (!isResetLink) {
      // Small delay lets browser autofill settle then we clear stale cached values on logout path
      // Only clear if we are in logged-out state — check via authLoading/user below
    }
  }, []);

  // Whenever auth confirms logged-out, force form back to pristine initial state.
  // This fires both on hard reload (initial !user) and on soft router.push("/login")
  // after signOut; it bypasses the stale cache snapshot that still holds old email/password.
  React.useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setName("");
      setErrorMessage(null);
      setSuccessMessage(null);
      const p = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const isResetLink = p?.get("mode") === "reset" || window.location.hash.includes("type=recovery");
      if (!isResetLink) setMode("signin");
    } else {
      // Leaving login — ensure cache never captures "Connecting…"
      setLoading(false);
    }
  }, [authLoading, user]);

  // If already logged in, redirect immediately to appropriate dashboard (except when resetting password)
  React.useEffect(() => {
    if (mode === "reset") return;

    if (!authLoading && user) {
      const targetRole =
        profile?.role ||
        (user.user_metadata?.role as UserRole) ||
        (user.email?.includes("therapist") ? "therapist" : "client");

      if (targetRole === "therapist") {
        router.replace("/therapist/dashboard");
      } else {
        router.replace("/client/dashboard");
      }
    }
  }, [authLoading, user, profile, router, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const result = await signIn(email, password);
        if (result.error) {
          setErrorMessage(result.error);
          setLoading(false);
          return;
        }

        const targetRole = result.role || (email.includes("therapist") ? "therapist" : "client");
        // React state flush is async — router.push can snapshot the old loading=true tree.
        // Defer navigation to next tick so cache captures the clean (loading=false) frame.
        setLoading(false);
        await new Promise<void>((r) => setTimeout(r, 0));
        if (targetRole === "therapist") {
          router.push("/therapist/dashboard");
        } else {
          router.push("/client/dashboard");
        }
      } else if (mode === "forgot") {
        if (!email.trim()) {
          setErrorMessage("Please enter your registered email address.");
          setLoading(false);
          return;
        }
        const result = await resetPassword(email.trim());
        if (result.error) {
          setErrorMessage(result.error);
          setLoading(false);
          return;
        }
        setSuccessMessage(
          "Password reset link sent! Please check your email inbox to proceed."
        );
        setLoading(false);
      } else if (mode === "reset") {
        if (password.length < 6) {
          setErrorMessage("New password must be at least 6 characters.");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMessage("Passwords do not match.");
          setLoading(false);
          return;
        }
        const result = await changePassword(password);
        if (result.error) {
          setErrorMessage(result.error);
          setLoading(false);
          return;
        }
        setSuccessMessage("Password updated successfully! Redirecting to your dashboard...");
        setTimeout(() => {
          const targetRole =
            profile?.role ||
            (user?.user_metadata?.role as UserRole) ||
            (user?.email?.includes("therapist") ? "therapist" : "client");
          if (targetRole === "therapist") {
            router.push("/therapist/dashboard");
          } else {
            router.push("/client/dashboard");
          }
        }, 1200);
      } else {
        // Registration
        if (!name.trim()) {
          setErrorMessage("Please enter your full name.");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setErrorMessage("Password must be at least 6 characters.");
          setLoading(false);
          return;
        }

        const result = await signUp({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          clientCategory: role === "client" ? clientCategory : undefined,
        });

        if (result.error) {
          setErrorMessage(result.error);
          setLoading(false);
          return;
        }

        setSuccessMessage("Account created successfully! Redirecting to your dashboard...");
        setTimeout(() => {
          if (role === "therapist") {
            router.push("/therapist/dashboard");
          } else {
            router.push("/client/dashboard");
          }
        }, 600);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || "Authentication failed. Please check your credentials.");
      setLoading(false);
    }
  };

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-[#0a1428] to-zinc-950 flex flex-col items-center justify-center text-zinc-400 space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-zinc-200">Welcome to Aruga</p>
          <p className="text-xs text-zinc-500">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-zinc-950 via-[#0a1428] to-zinc-950 flex flex-col justify-between selection:bg-teal-500/30 selection:text-teal-200">
      {/* Ambient glow behind the glass */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-teal-500/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[520px] h-[520px] rounded-full bg-blue-600/20 blur-[130px]" />
        <div className="absolute -bottom-40 left-1/4 w-[420px] h-[420px] rounded-full bg-sky-400/10 blur-[120px]" />
      </div>
      {/* Top Header */}
      <header className="relative z-10 border-b border-white/10 bg-white/[0.02] backdrop-blur-xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="group flex items-center">
          <span
            className="font-aruga text-xl font-normal text-zinc-100 tracking-wide hover:text-teal-300 transition-colors"
            style={{ fontFamily: "'Playwrite IT Trad', 'Playwrite Italia Tradizionale', cursive" }}
          >
            Aruga
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 container mx-auto px-4 py-8 max-w-xl flex-1 flex flex-col justify-center items-center">
        <div className="w-full space-y-6">
          {/* Header */}
          <div className="flex flex-col items-center space-y-2 text-center pt-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center justify-center gap-2">
              Welcome to{" "}
              <span
                className="font-aruga text-2xl font-normal text-teal-400"
                style={{ fontFamily: "'Playwrite IT Trad', 'Playwrite Italia Tradizionale', cursive" }}
              >
                Aruga
              </span>
            </h1>
            <p className="text-xs text-zinc-400 max-w-md">
              {mode === "signin"
                ? "Secure, clinician-directed home rehabilitation platform."
                : mode === "register"
                ? "Register a new clinical therapist or client profile to begin."
                : mode === "forgot"
                ? "Enter your registered email to receive a password reset link."
                : "Enter and confirm your new account password below."}
            </p>
          </div>

          {/* Mode Tabs or Back to Sign In */}
          {mode === "forgot" || mode === "reset" ? (
            <div className="flex items-center justify-between pb-1">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-teal-400 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </button>
              <span className="text-xs text-zinc-500 font-medium">
                {mode === "forgot" ? "Account Recovery" : "Reset Password"}
              </span>
            </div>
          ) : (
            <div className="flex p-1 rounded-xl bg-white/[0.06] border border-white/10 backdrop-blur-xl shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
                  mode === "signin"
                    ? "bg-teal-600 text-zinc-950 shadow-sm font-bold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
                  mode === "register"
                    ? "bg-teal-600 text-zinc-950 shadow-sm font-bold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Error / Success Alerts */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-teal-950/50 border border-teal-500/40 text-teal-300 text-xs flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-400" />
              <span>{successMessage}</span>
            </motion.div>
          )}

          {/* Judge demo entries — no account or Supabase needed. Replay tool intentionally not linked here (behind auth, Tools menu). */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Link href="/demo/homeprogram" className="block p-4 rounded-2xl bg-teal-950/30 border border-teal-500/30 hover:border-teal-400/60 transition-colors">
              <div className="text-xs font-bold text-teal-200">Guided demo — full flow</div>
              <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">Create a home program, do it with preloaded clips, submit, get feedback, and replay the biomech analysis. No login; live Meta AI when a key is set.</p>
              <span className="text-[11px] font-semibold text-teal-300 mt-2 inline-block">Start guided demo →</span>
            </Link>
            <Link href="/demo/insights" className="block p-4 rounded-2xl bg-violet-950/20 border border-violet-500/30 hover:border-violet-400/60 transition-colors">
              <div className="text-xs font-bold text-violet-200">Insights playground</div>
              <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">Run the real Goal Tracking and Monthly Highlights agents on sample patient data with your Meta API key. Edit goals and re-run.</p>
              <span className="text-[11px] font-semibold text-violet-300 mt-2 inline-block">Try the agents →</span>
            </Link>
          </div>

          {/* Form Card */}
          <div className="p-6 rounded-2xl bg-white/[0.07] border border-white/15 shadow-2xl shadow-black/40 backdrop-blur-2xl ring-1 ring-white/10 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Registration Specific Fields */}
              <AnimatePresence mode="wait">
                {mode === "register" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Full Name / Display Name
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. Dr. Elena Ramos or Leo Chen"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required={mode === "register"}
                        className="bg-white/[0.05] border-white/10 text-sm placeholder:text-zinc-500 focus-visible:ring-teal-500/50"
                      />
                    </div>

                    {/* Role Selection */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        I am registering as:
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setRole("therapist")}
                          className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                            role === "therapist"
                              ? "bg-teal-950/40 border-teal-500 text-teal-200 ring-1 ring-teal-500/50"
                              : "bg-white/[0.04] border-white/10 text-zinc-400 hover:border-white/25"
                          }`}
                        >
                          <Stethoscope className="w-4 h-4 text-teal-400 shrink-0" />
                          <div>
                            <div className="text-xs font-semibold text-zinc-100">Therapist</div>
                            <div className="text-[10px] text-zinc-400">Clinician / OTR / PT</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRole("client")}
                          className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                            role === "client"
                              ? "bg-teal-950/40 border-teal-500 text-teal-200 ring-1 ring-teal-500/50"
                              : "bg-white/[0.04] border-white/10 text-zinc-400 hover:border-white/25"
                          }`}
                        >
                          <User className="w-4 h-4 text-teal-400 shrink-0" />
                          <div>
                            <div className="text-xs font-semibold text-zinc-100">Client / Patient</div>
                            <div className="text-[10px] text-zinc-400">Home Program Practice</div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Client Category Selection (Only if Client role) */}
                    {role === "client" && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-1.5"
                      >
                        <label className="block text-xs font-medium text-zinc-300">
                          Client Care Demographic:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <button
                            type="button"
                            onClick={() => setClientCategory("adult")}
                            className={`p-2.5 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                              clientCategory === "adult"
                                ? "bg-teal-950/50 border-teal-500 text-teal-200"
                                : "bg-white/[0.04] border-white/10 text-zinc-400 hover:border-white/25"
                            }`}
                          >
                            <User className="w-4 h-4 text-teal-400" />
                            <span className="text-[11px] font-semibold text-zinc-200">Adult</span>
                            <span className="text-[9px] text-zinc-500">18-54 Neuro/Ortho</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setClientCategory("geriatric")}
                            className={`p-2.5 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                              clientCategory === "geriatric" || clientCategory === "old_people"
                                ? "bg-amber-950/50 border-amber-500 text-amber-200"
                                : "bg-white/[0.04] border-white/10 text-zinc-400 hover:border-white/25"
                            }`}
                          >
                            <HeartPulse className="w-4 h-4 text-amber-400" />
                            <span className="text-[11px] font-semibold text-zinc-200">Geriatrics</span>
                            <span className="text-[9px] text-zinc-500">55+ Mobility/Daily</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setClientCategory("adolescent")}
                            className={`p-2.5 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                              clientCategory === "adolescent"
                                ? "bg-indigo-950/50 border-indigo-500 text-indigo-200"
                                : "bg-white/[0.04] border-white/10 text-zinc-400 hover:border-white/25"
                            }`}
                          >
                            <GraduationCap className="w-4 h-4 text-indigo-400" />
                            <span className="text-[11px] font-semibold text-zinc-200">Adolescent</span>
                            <span className="text-[9px] text-zinc-500">12-17 School/Coord</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setClientCategory("pedia")}
                            className={`p-2.5 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                              clientCategory === "pedia"
                                ? "bg-teal-950/50 border-teal-500 text-teal-200"
                                : "bg-white/[0.04] border-white/10 text-zinc-400 hover:border-white/25"
                            }`}
                          >
                            <Baby className="w-4 h-4 text-teal-400" />
                            <span className="text-[11px] font-semibold text-zinc-200">Pediatric</span>
                            <span className="text-[9px] text-zinc-500">1-11 Play/Caregiver</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email Address (Shown in signin, register, and forgot) */}
              {mode !== "reset" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                    <Input
                      type="email"
                      placeholder="you@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-9 bg-white/[0.05] border-white/10 text-sm placeholder:text-zinc-500 focus-visible:ring-teal-500/50"
                    />
                  </div>
                </div>
              )}

              {/* Password in Signin and Register */}
              {(mode === "signin" || mode === "register") && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-zinc-300">
                      Password
                    </label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode("forgot");
                          setErrorMessage(null);
                          setSuccessMessage(null);
                        }}
                        className="text-xs text-teal-400 hover:text-teal-300 hover:underline transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-9 bg-white/[0.05] border-white/10 text-sm placeholder:text-zinc-500 focus-visible:ring-teal-500/50"
                    />
                  </div>
                </div>
              )}

              {/* Password & Confirm Password in Reset Mode */}
              {mode === "reset" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                      <Input
                        type="password"
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pl-9 bg-white/[0.05] border-white/10 text-sm placeholder:text-zinc-500 focus-visible:ring-teal-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                      <Input
                        type="password"
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="pl-9 bg-white/[0.05] border-white/10 text-sm placeholder:text-zinc-500 focus-visible:ring-teal-500/50"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                isLoading={loading}
                className="w-full py-2.5 mt-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold transition-all shadow-md"
              >
                {loading
                  ? "Connecting..."
                  : mode === "signin"
                  ? "Sign In to Dashboard"
                  : mode === "register"
                  ? "Create Account & Proceed"
                  : mode === "forgot"
                  ? "Send Password Reset Link"
                  : "Update Password & Continue"}
              </Button>

              {/* Switch account / Register helper — #1 of 6 */}
              <div className="pt-2 flex items-center justify-center gap-2 text-xs flex-wrap">
                {mode === "signin" ? (
                  <>
                    <span className="text-zinc-500">No account yet?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="font-semibold text-teal-400 hover:text-teal-300 hover:underline underline-offset-4 transition-colors"
                    >
                      Register
                    </button>
                  </>
                ) : mode === "register" ? (
                  <>
                    <span className="text-zinc-500">Already have an account?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="font-semibold text-teal-400 hover:text-teal-300 hover:underline underline-offset-4 transition-colors"
                    >
                      Sign in
                    </button>
                  </>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-white/[0.02] backdrop-blur-xl px-6 py-4 text-center text-xs text-zinc-500">
        &copy; 2026 {siteConfig.name}. All rights reserved.
      </footer>
    </div>
  );
}
