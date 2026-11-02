"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Search,
  FileText,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  User,
  Users,
  Layers,
  ArrowRight,
  Filter,
  X,
  Plus,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SoapNote, Patient } from "@/types/database";

interface AssessmentEntry {
  title: string;
  url: string;
  soapNoteId: string;
  soapSessionTitle: string;
  soapSessionDate: string;
  soapAssessment?: string;
  soapObjective?: string;
  patientId: string;
  patientName: string;
  patientCategory?: string;
}

export default function TherapistAssessmentsPage() {
  const [soapNotes, setSoapNotes] = useState<SoapNote[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load all SOAP notes across clients
        const [soapRes, clientsRes] = await Promise.all([
          fetch("/api/therapist/soap-notes?all=true"),
          fetch("/api/therapist/clients"),
        ]);

        if (soapRes.ok) {
          const soapData = await soapRes.json();
          setSoapNotes(soapData.soapNotes || []);
        }

        if (clientsRes.ok) {
          const clientsData = await clientsRes.json();
          setPatients(clientsData.clients || []);
        }
      } catch (err) {
        console.error("Failed to load assessments:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Extract all assessment documents from SOAP notes
  const assessments = useMemo<AssessmentEntry[]>(() => {
    const list: AssessmentEntry[] = [];

    soapNotes.forEach((note) => {
      const patient =
        note.patient || patients.find((p) => p.id === note.patient_id);
      const patientName = patient?.name || "Marcus Vance";
      const patientCategory =
        patient?.client_category ||
        (patient?.age && patient.age < 12
          ? "pedia"
          : patient?.age && patient.age < 18
          ? "adolescent"
          : patient?.age && patient.age >= 55
          ? "geriatric"
          : "adult");

      if (Array.isArray(note.assessment_links)) {
        note.assessment_links.forEach((link) => {
          if (link && (link.title?.trim() || link.url?.trim())) {
            list.push({
              title: link.title?.trim() || "Untitled Standardized Assessment",
              url: link.url?.trim() || "",
              soapNoteId: note.id,
              soapSessionTitle: note.session_title || "Clinical Session",
              soapSessionDate: note.session_date,
              soapAssessment: note.assessment,
              soapObjective: note.objective,
              patientId: note.patient_id,
              patientName,
              patientCategory,
            });
          }
        });
      }
    });

    return list;
  }, [soapNotes, patients]);

  // Filter assessments by query and category
  const filteredAssessments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assessments.filter((a) => {
      const matchesCategory =
        selectedCategory === "all" ||
        a.patientCategory?.toLowerCase() === selectedCategory.toLowerCase() ||
        (selectedCategory === "geriatric" && (a.patientCategory === "old_people" || a.patientCategory === "geriatric"));

      if (!matchesCategory) return false;
      if (!q) return true;

      return (
        a.title.toLowerCase().includes(q) ||
        a.url.toLowerCase().includes(q) ||
        a.patientName.toLowerCase().includes(q) ||
        a.soapSessionTitle.toLowerCase().includes(q) ||
        (a.soapAssessment && a.soapAssessment.toLowerCase().includes(q)) ||
        (a.soapObjective && a.soapObjective.toLowerCase().includes(q))
      );
    });
  }, [assessments, searchQuery, selectedCategory]);

  // Unique clients count
  const uniqueClientsWithAssessments = useMemo(() => {
    const set = new Set(assessments.map((a) => a.patientId));
    return set.size;
  }, [assessments]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <ClipboardList className="w-6 h-6 text-teal-400" />
            Standardized Assessments Registry
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Search, filter, and review all standardized assessment documents and test scorecards linked across client SOAP notes.
          </p>
        </div>

        <Link href="/therapist/clients">
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800 gap-1.5"
          >
            <Users className="w-3.5 h-3.5 text-teal-400" />
            <span>Caseload Clients</span>
          </Button>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400">Total Assessments</CardTitle>
            <ClipboardList className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-300">{assessments.length}</div>
            <p className="text-[11px] text-zinc-500 mt-0.5">Linked across live session SOAP notes</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400">Clients Evaluated</CardTitle>
            <Users className="w-4 h-4 text-teal-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-300">{uniqueClientsWithAssessments}</div>
            <p className="text-[11px] text-zinc-500 mt-0.5">Clients with formal test reports</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400">Linked SOAP Sessions</CardTitle>
            <FileText className="w-4 h-4 text-sky-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-300">
              {new Set(assessments.map((a) => a.soapNoteId)).size}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">Sessions with standardized scores</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <Input
            type="text"
            placeholder="Search by test name, client, or SOAP session..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-950 border-zinc-800 text-xs h-9 text-zinc-200"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Demographic Selector Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All Demographics" },
            { id: "adult", label: "Adult" },
            { id: "pedia", label: "Pediatric" },
            { id: "geriatric", label: "Geriatrics (55+)" },
            { id: "adolescent", label: "Adolescent" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                selectedCategory === cat.id
                  ? "bg-teal-950/80 border border-teal-500/40 text-teal-300 font-semibold"
                  : "bg-zinc-950/60 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assessments Content */}
      {loading ? (
        <div className="p-12 text-center text-zinc-500 space-y-2">
          <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs">Loading standardized assessments...</p>
        </div>
      ) : assessments.length === 0 ? (
        <Card className="border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center space-y-3">
          <ClipboardList className="w-12 h-12 text-zinc-600 mx-auto" />
          <h3 className="text-base font-semibold text-zinc-200">No assessments created in SOAP notes yet</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            When you document live session SOAP notes and add standardized test reports (such as Fugl-Meyer, PDMS-2, or Box and Block reports), they will appear here.
          </p>
          <Link href="/therapist/clients">
            <Button size="sm" className="bg-teal-600 hover:bg-teal-500 text-zinc-950 font-bold text-xs gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Open Client Caseload
            </Button>
          </Link>
        </Card>
      ) : filteredAssessments.length === 0 ? (
        <Card className="border border-zinc-800 bg-zinc-900/40 p-10 text-center space-y-3">
          <Search className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-200">
            No assessments match your filters
          </h3>
          <p className="text-xs text-zinc-500">
            Try searching for a different keyword or resetting the demographic filter.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
            }}
            className="border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Reset Filters
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>
              Showing <strong className="text-zinc-200">{filteredAssessments.length}</strong> of {assessments.length} assessment{assessments.length === 1 ? "" : "s"}
            </span>
            {searchQuery && (
              <span className="text-teal-400 text-[11px]">
                Search filter: &ldquo;{searchQuery}&rdquo;
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredAssessments.map((item, idx) => (
              <Card
                key={`${item.soapNoteId}-${idx}`}
                className="border-zinc-800 bg-zinc-900/80 hover:border-amber-500/40 transition-colors p-5 space-y-4 shadow-sm group"
              >
                {/* Header row: Test Title, Client Badge, Action buttons */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="w-6 h-6 rounded bg-amber-950/80 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-zinc-100 group-hover:text-amber-200 transition-colors">
                        {item.title}
                      </h3>
                      <Badge variant="amber" statusText="Standardized Test" icon={<FileText className="w-3 h-3 text-amber-400" />} />
                    </div>

                    {/* Client Chip */}
                    <div className="flex items-center gap-2 pl-8 text-xs text-zinc-400">
                      <User className="w-3.5 h-3.5 text-teal-400" />
                      <span>Client:</span>
                      <Link
                        href={`/therapist/clients/${item.patientId}`}
                        className="font-semibold text-teal-300 hover:text-teal-200 hover:underline flex items-center gap-1"
                      >
                        {item.patientName}
                        <ArrowRight className="w-3 h-3 opacity-70" />
                      </Link>
                      <span className="text-zinc-600">•</span>
                      <span className="capitalize text-zinc-400">{item.patientCategory}</span>
                    </div>

                    <p className="text-xs text-zinc-400 pl-8 font-mono break-all line-clamp-1">
                      {item.url}
                    </p>
                  </div>

                  {/* Actions: Open Document & Copy Link */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto pl-8 sm:pl-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(item.url);
                        setCopiedUrl(item.url);
                        setTimeout(() => setCopiedUrl(null), 2000);
                      }}
                      className="h-8 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5"
                      title="Copy URL"
                    >
                      {copiedUrl === item.url ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </Button>

                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold transition-colors"
                    >
                      <span>Open Document</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Source SOAP Note Card */}
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3.5 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/60 pb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span className="text-xs text-zinc-400">Originated From SOAP Note:</span>
                      <span className="text-xs font-semibold text-zinc-200">
                        {item.soapSessionTitle}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-500" />
                        {new Date(item.soapSessionDate).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <Link
                        href={`/therapist/clients/${item.patientId}`}
                        className="inline-flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300 font-semibold"
                      >
                        <span>View in Client Profile</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Objective & Assessment context from that session */}
                  {item.soapAssessment && (
                    <div className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      <span className="text-amber-400/90 font-medium font-mono text-[11px] mr-1.5">
                        [A-Assessment Findings]:
                      </span>
                      {item.soapAssessment}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
