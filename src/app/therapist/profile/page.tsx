"use client";

import React, { useState, useEffect } from "react";
import {
  Stethoscope,
  Save,
  CheckCircle2,
  AlertCircle,
  Building,
  Award,
  Phone,
  Clock,
  FileText,
  Mail,
  UserCheck,
  Shield,
  Loader2,
  Lock,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/supabase/auth-context";
import { Discipline } from "@/types/database";

export default function TherapistProfilePage() {
  const { profile, user, updateProfile, changePassword } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [discipline, setDiscipline] = useState<Discipline>("OT");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [phone, setPhone] = useState("");
  const [officeHours, setOfficeHours] = useState("");
  const [caseloadFocus, setCaseloadFocus] = useState("");
  const [bio, setBio] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      setDiscipline((profile.discipline as Discipline) || "OT");
      setLicenseNumber(profile.license_number || "OTR-109482-NY");
      setFacilityName(profile.facility_name || "Metro Neurological & Pediatric Center");
      setSpecialties(
        profile.specialties ||
          "Upper Extremity Neurorehabilitation, Pediatric Fine Motor & Bilateral Integration"
      );
      setPhone(profile.phone || "+1 (555) 234-8910");
      setOfficeHours(profile.office_hours || "Mon - Thu, 8:30 AM - 4:30 PM");
      setCaseloadFocus(profile.caseload_focus || "Both Pediatric and Adult Rehabilitation");
      setBio(
        profile.bio ||
          "Licensed Occupational Therapist specializing in functional motor re-education, stroke recovery, and play-based pediatric developmental milestones."
      );
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await updateProfile({
      display_name: displayName,
      discipline,
      license_number: licenseNumber,
      facility_name: facilityName,
      specialties,
      phone,
      office_hours: officeHours,
      caseload_focus: caseloadFocus,
      bio,
    });

    setSaving(false);
    if (res.error) {
      setMessage({ type: "error", text: `Failed to save profile: ${res.error}` });
    } else {
      setMessage({ type: "success", text: "Therapist profile updated successfully in Supabase!" });
      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-950/80 border border-teal-500/40 text-teal-400 flex items-center justify-center">
            <Stethoscope className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">
                {displayName || "Clinician Profile"}
              </h1>
              <Badge variant="teal" statusText={discipline} />
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Licensed Clinician & Supervisor • {user?.email || "therapist@aruga.local"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="default" icon={<Shield className="w-3.5 h-3.5" />} statusText="Verified Clinician" />
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
              Professional Credentials & Practice Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Display Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Full Name & Titles
                </label>
                <Input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Dr. Elena Ramos, OTR/L"
                  required
                  className="bg-zinc-950/60 border-zinc-800 text-sm"
                />
              </div>

              {/* Primary Discipline */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Professional Discipline
                </label>
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value as Discipline)}
                  className="w-full h-9 rounded-md bg-zinc-950/60 border border-zinc-800 px-3 text-sm text-zinc-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="OT">Occupational Therapy (OT)</option>
                  <option value="PT">Physical Therapy (PT)</option>
                  <option value="SLP">Speech-Language Pathology (SLP)</option>
                </select>
              </div>

              {/* License Number */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  License / Registration Number
                </label>
                <div className="relative">
                  <Award className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <Input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="e.g. OTR-109482-NY"
                    className="pl-9 bg-zinc-950/60 border-zinc-800 text-sm"
                  />
                </div>
              </div>

              {/* Facility Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Primary Clinic / Hospital Facility
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <Input
                    type="text"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    placeholder="e.g. Metro Neurological & Pediatric Center"
                    className="pl-9 bg-zinc-950/60 border-zinc-800 text-sm"
                  />
                </div>
              </div>

              {/* Direct Phone */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Clinic Contact Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <Input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +1 (555) 234-8910"
                    className="pl-9 bg-zinc-950/60 border-zinc-800 text-sm"
                  />
                </div>
              </div>

              {/* Office Hours */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Consultation & Office Hours
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <Input
                    type="text"
                    value={officeHours}
                    onChange={(e) => setOfficeHours(e.target.value)}
                    placeholder="e.g. Mon - Thu, 8:30 AM - 4:30 PM"
                    className="pl-9 bg-zinc-950/60 border-zinc-800 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Specialties */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Clinical Specialties & Certifications
              </label>
              <Input
                type="text"
                value={specialties}
                onChange={(e) => setSpecialties(e.target.value)}
                placeholder="e.g. Upper Extremity Neurorehabilitation, Pediatric Sensory Integration, Ergonomics"
                className="bg-zinc-950/60 border-zinc-800 text-sm"
              />
            </div>

            {/* Caseload Focus */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Target Caseload Populations
              </label>
              <Input
                type="text"
                value={caseloadFocus}
                onChange={(e) => setCaseloadFocus(e.target.value)}
                placeholder="e.g. Both Pediatric and Adult Rehabilitation"
                className="bg-zinc-950/60 border-zinc-800 text-sm"
              />
            </div>

            {/* Bio & Clinical Approach */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Professional Bio & Clinical Philosophy
              </label>
              <Textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your rehabilitation philosophy, therapeutic focus, and background..."
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
            Keep your clinical provider credentials protected. Your new password will take effect immediately.
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
