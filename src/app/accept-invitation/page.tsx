"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/config/site";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push("/client/dashboard");
    }, 600);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center pt-2">
          <h1
            className="font-aruga text-3xl font-normal text-teal-400"
            style={{ fontFamily: "'Playwrite IT Trad', 'Playwrite Italia Tradizionale', cursive" }}
          >
            {siteConfig.name}
          </h1>
          <p className="text-xs text-zinc-400">
            Secure Account Setup & Invitation Acceptance
          </p>
        </div>

        <Card className="border-zinc-800 bg-zinc-900/90 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg">Set Your Password</CardTitle>
            <CardDescription className="text-xs">
              Welcome to Aruga! Your therapist has invited you to access your home exercise routines.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {errorMsg && (
              <div className="mb-4 rounded-lg bg-red-950/60 border border-red-800 p-3 text-xs text-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  Choose Password (min 8 characters)
                </label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  Confirm Password
                </label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  isLoading={loading}
                  className="w-full bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Activate Account & Sign In
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
