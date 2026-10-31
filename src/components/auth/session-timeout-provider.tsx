"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";
import { ShieldAlert, Clock, LogOut, CheckCircle2 } from "lucide-react";

interface SessionTimeoutContextType {
  lastActive: number;
  resetTimer: () => void;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextType | null>(null);

// HIPAA Standard Clinical Idle Timeout: 15 minutes (900s)
// Warning triggers 60 seconds before session termination (840s)
const TIMEOUT_DURATION_MS = 15 * 60 * 1000;
const WARNING_THRESHOLD_MS = 60 * 1000;

export function SessionTimeoutProvider({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);

  const lastActivityRef = useRef<number>(0);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleSignOut = useCallback(async () => {
    setShowWarning(false);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);

    try {
      await signOut();
    } catch {
      // Fallback
    } finally {
      router.push("/login?reason=session_timeout");
    }
  }, [signOut, router]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showWarning) {
      setShowWarning(false);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, [showWarning]);

  useEffect(() => {
    // Only run inactivity monitoring for authenticated sessions
    if (!user) {
      setShowWarning(false);
      return;
    }

    lastActivityRef.current = Date.now();

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    let throttleTimeout: NodeJS.Timeout | null = null;

    const onUserActivity = () => {
      if (showWarning) {
        // Do not auto-dismiss warning modal on incidental mouse jiggles;
        // require explicit clinical user interaction via the "Stay Logged In" button
        return;
      }
      if (!throttleTimeout) {
        lastActivityRef.current = Date.now();
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 1000);
      }
    };

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, onUserActivity, { passive: true });
    });

    // Master check interval: checks every 1 second
    const interval = setInterval(() => {
      if (lastActivityRef.current === 0) return;
      const elapsed = Date.now() - lastActivityRef.current;
      const remainingMs = TIMEOUT_DURATION_MS - elapsed;

      if (remainingMs <= 0) {
        // Timeout reached -> perform immediate HIPAA logout
        clearInterval(interval);
        handleSignOut();
      } else if (remainingMs <= WARNING_THRESHOLD_MS) {
        const secs = Math.max(1, Math.ceil(remainingMs / 1000));
        setSecondsRemaining(secs);
        setShowWarning(true);
      } else {
        if (showWarning) {
          setShowWarning(false);
        }
      }
    }, 1000);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, onUserActivity);
      });
      if (throttleTimeout) clearTimeout(throttleTimeout);
      clearInterval(interval);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [user, showWarning, handleSignOut]);

  return (
    <SessionTimeoutContext.Provider value={{ lastActive: lastActivityRef.current, resetTimer }}>
      {children}

      {/* HIPAA Inactivity Warning Modal (45 CFR § 164.312(a)(2)(iii)) */}
      {showWarning && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hipaa-timeout-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
        >
          <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-zinc-950 p-6 shadow-2xl shadow-amber-950/40 text-zinc-100 ring-1 ring-amber-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-mono tracking-wider uppercase text-amber-400 font-bold">
                  HIPAA 45 CFR § 164.312(a)(2)(iii)
                </span>
                <h3 id="hipaa-timeout-title" className="text-lg font-semibold text-zinc-100">
                  Automatic Session Timeout
                </h3>
              </div>
            </div>

            <p className="text-sm text-zinc-400 leading-relaxed mb-5">
              To safeguard protected health information (ePHI), clinical workstations are locked after 15 minutes of inactivity. Your session will close in:
            </p>

            {/* Countdown Badge & Progress Bar */}
            <div className="mb-6 p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
              <div className="flex items-center justify-center gap-2 text-2xl font-mono font-bold text-amber-400 mb-2">
                <Clock className="w-6 h-6" />
                <span>00:{secondsRemaining.toString().padStart(2, "0")}</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-red-500 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(secondsRemaining / 60) * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-zinc-500 mt-2 block">
                Click below to confirm you are actively working and extend your session.
              </span>
            </div>

            {/* Clinical Action Buttons: Strictly in single row */}
            <div className="flex flex-row items-center justify-end gap-3 whitespace-nowrap">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 bg-zinc-900 border border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out Now</span>
              </button>
              <button
                type="button"
                onClick={resetTimer}
                autoFocus
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-zinc-950 bg-teal-400 hover:bg-teal-300 shadow-md shadow-teal-950 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Stay Logged In</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </SessionTimeoutContext.Provider>
  );
}

export function useSessionTimeout() {
  const context = useContext(SessionTimeoutContext);
  return context;
}
