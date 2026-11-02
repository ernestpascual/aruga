"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  User,
  Baby,
  GraduationCap,
  HeartPulse,
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  Heart,
  Calendar,
  Sparkles,
  School,
  Target,
  Shield,
  Loader2,
  Lock,
  HeartHandshake,
  Clock,
  UserPlus,
  Mail,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/supabase/auth-context";
import { ClientCategory } from "@/types/database";

export default function ClientProfilePage() {
  const { profile, user, updateProfile, changePassword } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [clientCategory, setClientCategory] = useState<ClientCategory>("adult");
  const [age, setAge] = useState<number | string>("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [primaryCondition, setPrimaryCondition] = useState("");
  const [caregiverName, setCaregiverName] = useState("");
  const [caregiverRelationship, setCaregiverRelationship] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [therapyGoals, setTherapyGoals] = useState("");
  const [preferredSchedule, setPreferredSchedule] = useState("");
  const [sensoryPreferences, setSensoryPreferences] = useState("");
  const [schoolOrWorkplace, setSchoolOrWorkplace] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Clinician linking state
  const [linkData, setLinkData] = useState<any>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkActionLoading, setLinkActionLoading] = useState(false);
  const [linkNotice, setLinkNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchLinkData = async () => {
    if (!user?.id) return;
    try {
      setLinkLoading(true);
      const res = await fetch(`/api/client/therapist-link?clientUserId=${user.id}`);
      const data = await res.json();
      setLinkData(data);
    } catch (err) {
      console.warn("Failed to fetch link status:", err);
    } finally {
      setLinkLoading(false);
    }
  };

  useEffect(() => {
    fetchLinkData();
  }, [user?.id]);

  const handleRequestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !linkEmail.trim() || linkActionLoading) return;
    setLinkActionLoading(true);
    setLinkNotice(null);
    try {
      const res = await fetch("/api/client/therapist-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientUserId: user.id, therapistEmail: linkEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send link request.");
      setLinkNotice({ type: "success", text: data.message });
      setLinkEmail("");
      window.dispatchEvent(new Event("aruga:notification-action"));
      await fetchLinkData();
    } catch (err: unknown) {
      setLinkNotice({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setLinkActionLoading(false);
    }
  };

  const handleCancelLink = async () => {
    if (!user?.id || linkActionLoading) return;
    setLinkActionLoading(true);
    setLinkNotice(null);
    try {
      const res = await fetch(`/api/client/therapist-link?clientUserId=${user.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel link request.");
      setLinkNotice({ type: "success", text: data.message || "Connection request canceled." });
      window.dispatchEvent(new Event("aruga:notification-action"));
      await fetchLinkData();
    } catch (err: unknown) {
      setLinkNotice({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setLinkActionLoading(false);
    }
  };

  const handleRespondInvitation = async (action: "accept" | "decline") => {
    if (!user?.id || linkActionLoading) return;
    setLinkActionLoading(true);
    setLinkNotice(null);
    try {
      const res = await fetch("/api/client/therapist-link", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientUserId: user.id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update connection.");
      setLinkNotice({ type: "success", text: data.message });
      window.dispatchEvent(new Event("aruga:notification-action"));
      await fetchLinkData();
    } catch (err: unknown) {
      setLinkNotice({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setLinkActionLoading(false);
    }
  };

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({
        type: "error",
        text: "New password must be at least 6 characters long.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "Passwords do not match. Please re-enter carefully.",
      });
      return;
    }

    setPasswordLoading(true);
    const res = await changePassword(newPassword);
    setPasswordLoading(false);

    if (res.error) {
      setPasswordMessage({ type: "error", text: res.error });
    } else {
      setPasswordMessage({
        type: "success",
        text: "Your password has been successfully updated!",
      });
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordMessage(null), 5000);
    }
  };

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      const cat = profile.client_category || "adult";
      setClientCategory(cat);
      setAge(profile.age ?? "");
      setDateOfBirth(profile.date_of_birth || "");
      setPrimaryCondition(profile.primary_condition || "");
      setCaregiverName(profile.caregiver_name || "");
      setCaregiverRelationship(profile.caregiver_relationship || "");
      setEmergencyPhone(profile.emergency_phone || "");
      setTherapyGoals(profile.therapy_goals || "");
      setPreferredSchedule(profile.preferred_schedule || "");
      setSensoryPreferences(profile.sensory_preferences || "");
      setSchoolOrWorkplace(profile.school_or_workplace || "");
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await updateProfile({
      display_name: displayName,
      client_category: clientCategory,
      age: Number(age) || 1,
      date_of_birth: dateOfBirth,
      primary_condition: primaryCondition,
      caregiver_name: caregiverName,
      caregiver_relationship: caregiverRelationship,
      emergency_phone: emergencyPhone,
      therapy_goals: therapyGoals,
      preferred_schedule: preferredSchedule,
      sensory_preferences: sensoryPreferences,
      school_or_workplace: schoolOrWorkplace,
    });

    setSaving(false);
    if (res.error) {
      setMessage({ type: "error", text: `Failed to save profile: ${res.error}` });
    } else {
      setMessage({ type: "success", text: "Client care profile saved successfully!" });
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const isPedia = clientCategory === "pedia";
  const isAdolescent = clientCategory === "adolescent";
  const isGeriatric = clientCategory === "geriatric" || clientCategory === "old_people";

  const CategoryIcon = isPedia ? Baby : isAdolescent ? GraduationCap : isGeriatric ? HeartPulse : User;

  return (
    <div className="space-y-6 min-w-0">
      {/* Header Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-950/80 border border-teal-500/40 text-teal-400 flex items-center justify-center">
            <CategoryIcon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">
                {displayName || "Client Profile"}
              </h1>
              <Badge
                variant="teal"
                statusText={
                  isPedia
                    ? "Pediatric Care"
                    : isAdolescent
                    ? "Adolescent Care"
                    : isGeriatric
                    ? "Geriatrics (55+) Care"
                    : "Adult Rehabilitation"
                }
              />
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Client Portal • {user?.email || "client@aruga.local"}
            </p>
          </div>
        </div>


      </div>

      {/* Status Alert */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2.5 ${
            message.type === "success"
              ? "bg-teal-950/60 border border-teal-500/40 text-teal-200"
              : "bg-red-950/60 border border-red-500/40 text-red-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-zinc-100">
              Personal & Clinical Background
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Display Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Patient / Client Full Name
                </label>
                <Input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Marcus Vance or Leo Chen"
                  required
                  className="bg-zinc-950/60 border-zinc-800 text-sm"
                />
              </div>

              {/* Care Demographic Category */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Care Demographic Category
                </label>
                <select
                  value={clientCategory === "old_people" ? "geriatric" : clientCategory}
                  onChange={(e) => setClientCategory(e.target.value as ClientCategory)}
                  className="w-full h-9 rounded-md bg-zinc-950/60 border border-zinc-800 px-3 text-sm text-zinc-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="adult">Adult (18-54 Neuro/Ortho Functional Rehab)</option>
                  <option value="geriatric">Geriatrics (55+ Mobility & Independent Living)</option>
                  <option value="adolescent">Adolescent (12-17 School & Motor Coordination)</option>
                  <option value="pedia">Pediatric (1-11 Play-Based Milestones & Caregiver)</option>
                </select>
              </div>

              {/* Age */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Current Age (Years)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={125}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="bg-zinc-950/60 border-zinc-800 text-sm"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Date of Birth
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <Input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="pl-9 bg-zinc-950/60 border-zinc-800 text-sm"
                  />
                </div>
              </div>

              {/* Caregiver Name (Important for Pedia & Adolescent) */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Caregiver / Guardian Name {isPedia && <span className="text-amber-400">*</span>}
                </label>
                <Input
                  type="text"
                  value={caregiverName}
                  onChange={(e) => setCaregiverName(e.target.value)}
                  placeholder="e.g. Sarah Chen (Mother)"
                  className="bg-zinc-950/60 border-zinc-800 text-sm"
                />
              </div>

              {/* Caregiver Relationship */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Caregiver Relationship
                </label>
                <Input
                  type="text"
                  value={caregiverRelationship}
                  onChange={(e) => setCaregiverRelationship(e.target.value)}
                  placeholder="e.g. Mother, Father, Legal Guardian, Spouse"
                  className="bg-zinc-950/60 border-zinc-800 text-sm"
                />
              </div>

              {/* Emergency Contact */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Emergency Contact Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <Input
                    type="text"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="pl-9 bg-zinc-950/60 border-zinc-800 text-sm"
                  />
                </div>
              </div>

              {/* School or Workplace */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  {isPedia ? "Daycare / Kindergarten" : isAdolescent ? "School & Grade" : "Workplace / Daily Schedule"}
                </label>
                <div className="relative">
                  <School className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <Input
                    type="text"
                    value={schoolOrWorkplace}
                    onChange={(e) => setSchoolOrWorkplace(e.target.value)}
                    placeholder={isPedia ? "e.g. Sunny Hills Preschool" : "e.g. Lincoln High School"}
                    className="pl-9 bg-zinc-950/60 border-zinc-800 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Primary Condition */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Primary Rehabilitation Condition / Diagnosis
              </label>
              <Input
                type="text"
                value={primaryCondition}
                onChange={(e) => setPrimaryCondition(e.target.value)}
                placeholder="e.g. Developmental Fine Motor Delay or Post-Stroke Upper Extremity Hemiparesis"
                className="bg-zinc-950/60 border-zinc-800 text-sm"
              />
            </div>

            {/* Personal Therapy Goals */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Client / Family Therapy Goals
              </label>
              <Textarea
                rows={3}
                value={therapyGoals}
                onChange={(e) => setTherapyGoals(e.target.value)}
                placeholder="List specific milestones: e.g. picking up small pegs with tip pinch, unassisted buttoning, independent eating..."
                className="bg-zinc-950/60 border-zinc-800 text-sm"
              />
            </div>

            {/* Preferred Schedule */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Preferred Practice Time & Frequency
              </label>
              <Input
                type="text"
                value={preferredSchedule}
                onChange={(e) => setPreferredSchedule(e.target.value)}
                placeholder="e.g. Daily morning after breakfast (15 minutes)"
                className="bg-zinc-950/60 border-zinc-800 text-sm"
              />
            </div>

            {/* Sensory & Environmental Preferences */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Sensory & Environmental Accommodations
              </label>
              <Textarea
                rows={2}
                value={sensoryPreferences}
                onChange={(e) => setSensoryPreferences(e.target.value)}
                placeholder="e.g. Prefers tactile dough, bright visual markers, quiet room without radio..."
                className="bg-zinc-950/60 border-zinc-800 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="submit"
            isLoading={saving}
            className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold px-6 shadow-md"
          >
            <Save className="w-4 h-4" />
            Save Profile Changes
          </Button>
        </div>
      </form>

      {/* Care Team & Clinician Connection Section */}
      <Card className="border-zinc-800 bg-zinc-900/90 shadow-lg mt-8">
        <CardHeader className="pb-3 border-b border-zinc-800/80 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-teal-400" />
            Care Team Clinician Connection
          </CardTitle>
          {linkData?.invitation_status === "pending" ? (
            <Badge variant="amber" statusText="Pending Confirmation" icon={<Clock className="w-3 h-3" />} />
          ) : linkData?.linked ? null : (
            <Badge variant="default" statusText="Not Linked" />
          )}
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          {linkNotice && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                linkNotice.type === "success"
                  ? "bg-teal-950/50 border-teal-500/40 text-teal-200"
                  : "bg-red-950/50 border-red-500/40 text-red-200"
              }`}
            >
              {linkNotice.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{linkNotice.text}</span>
            </div>
          )}

          {linkData?.linked ? (
            <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 font-bold shrink-0">
                  <Shield className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-100">
                    {linkData.therapist?.display_name || "Assigned Occupational Therapist"}
                  </h4>
                  <p className="text-xs text-zinc-400">
                    {linkData.therapist?.discipline || "OT"}{linkData.therapist?.facility_name ? ` • ${linkData.therapist.facility_name}` : ""}
                    {linkData.therapist?.email ? ` • ${linkData.therapist.email}` : ""}
                  </p>
                </div>
              </div>

              <Link href="/client/messages">
                <Button size="sm" className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold text-xs gap-1.5 h-8">
                  <Mail className="w-3.5 h-3.5" />
                  Message Clinician
                </Button>
              </Link>
            </div>
          ) : linkData?.invitation_status === "pending" ? (
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/30 via-zinc-900 to-zinc-950 border border-amber-500/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-100">
                      {linkData.therapist?.display_name || linkData.therapist?.name || "Occupational Therapist"}
                    </h4>
                    <p className="text-xs text-zinc-400">
                      {linkData.therapist?.email || linkData.pending_therapist_email || "Pending Therapist Email"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {linkData.invitation_initiated_by === "client" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelLink}
                      isLoading={linkActionLoading}
                      className="border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs h-8"
                    >
                      Cancel Request
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleRespondInvitation("accept")}
                        isLoading={linkActionLoading}
                        className="bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold text-xs h-8"
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRespondInvitation("decline")}
                        isLoading={linkActionLoading}
                        className="border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs h-8"
                      >
                        Decline
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-400">
                {linkData.invitation_initiated_by === "client"
                  ? "Your request was submitted and is waiting for your therapist to confirm in their caseload. Once accepted, home programs and video exercises will be accessible."
                  : "Your clinician invited you to connect to their rehabilitation caseload. Accept above to begin."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                You are currently not linked with an occupational therapist. Enter your therapist's clinic email address below to submit a care connection request.
              </p>
              <form onSubmit={handleRequestLink} className="flex flex-col sm:flex-row gap-2 max-w-md">
                <Input
                  type="email"
                  placeholder="therapist@aruga.health"
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  required
                  className="bg-zinc-950/60 border-zinc-800 text-xs h-9"
                />
                <Button
                  type="submit"
                  disabled={linkActionLoading || !linkEmail.trim()}
                  className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs h-9 shrink-0 gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Connect Clinician
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Security & Password Card */}
      <Card className="border-zinc-800 bg-zinc-900/90 shadow-lg mt-8">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <CardTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <Lock className="w-4 h-4 text-teal-400" />
            Security & Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <p className="text-xs text-zinc-400">
            Keep your account secure. When updated, your new password will take effect immediately.
          </p>

          {passwordMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                passwordMessage.type === "success"
                  ? "bg-teal-950/50 border-teal-500/40 text-teal-200"
                  : "bg-red-950/50 border-red-500/40 text-red-200"
              }`}
            >
              {passwordMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{passwordMessage.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  New Password
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="bg-zinc-950/60 border-zinc-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  required
                  className="bg-zinc-950/60 border-zinc-800 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Button
                type="submit"
                isLoading={passwordLoading}
                className="gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 text-xs font-semibold px-4 py-2"
              >
                <Lock className="w-3.5 h-3.5 text-teal-400" />
                Update Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
