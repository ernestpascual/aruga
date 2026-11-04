import type { GoalEvidence } from "@/lib/meta/goal-agent";
import type { HighlightsEvidence } from "@/lib/meta/highlights-agent";

// Dummy (sample) evidence for the judge demo at /demo/insights.
// This is sample patient data for trying the real Goal Tracking and
// Monthly Highlights agents with your own Meta API key — no Supabase needed.
// Numbers are illustrative sample data, clearly labeled as demo in the UI.

export const DEMO_GOALS_TEXT = `LTG: Patient will independently perform work-related computer tasks for 4 hours with scheduled breaks and pain not exceeding 2/10 in 6-8 weeks.
LTG: Patient will improve right-hand grip strength from 18 kg to at least 24 kg to support independent performance of daily and work activities in 6-8 weeks.
STG: Patient will decrease wrist pain from 5/10 to 3/10 during work activities.
STG: Patient will demonstrate proper ergonomic positioning and wrist protection techniques with minimal verbal cues.
STG: Patient will independently perform five prescribed home program activities with correct technique.`;

export function parseGoalsText(text: string): GoalEvidence["goals"] {
  const goals: GoalEvidence["goals"] = [];
  let li = 0;
  let si = 0;
  for (const raw of (text || "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const isLtg = /^ltg\b/i.test(line);
    const clean = line.replace(/^(ltg|stg)\s*:\s*/i, "").trim();
    if (!clean) continue;
    if (isLtg) goals.push({ id: `lt-${li++}`, text: clean, type: "ltg" });
    else goals.push({ id: `st-${si++}`, text: clean, type: "stg" });
  }
  return goals.slice(0, 15);
}

const DEMO_SOAP = [
  {
    id: "soapdemo01",
    session_date: "2026-10-28",
    subjective: "Reports wrist pain 3/10 after keyboarding, better than last week. Sleeping well.",
    objective: "Completed 8 reps shoulder flexion to 142 degrees with good trunk control. Grip dynamometer 21 kg right hand. Pincer grasp 4/5 trials.",
    assessment: "Progressing toward grip and ergonomic goals. Trunk compensation minimal.",
    plan: "Continue home program 5x/week, add grip strengthening.",
  },
  {
    id: "soapdemo02",
    session_date: "2026-10-21",
    subjective: "Wrist pain 4/10 during work tasks. Needs reminders for ergonomic breaks.",
    objective: "Shoulder flexion 135 degrees. Grip 19 kg. Demonstrates ergonomic positioning with moderate verbal cues.",
    assessment: "Early progress. Ergonomic technique inconsistent under fatigue.",
    plan: "Ergonomic education, scheduled breaks every 30 minutes.",
  },
];

const DEMO_MHR = [
  {
    id: "mhrdemo001",
    created_at: "2026-10-28T10:00:00.000Z",
    biomech_summary: {
      confidenceOverall: 0.91,
      peakAngles: { shoulderFlex_max: 158, neckFlex_max: 18 },
      rom: { shoulderFlex_range: 142 },
      flags: [],
    },
    mhr_results: { summary: { confidenceOverall: 0.91, peakAngles: { shoulderFlex_max: 158, neckFlex_max: 18 }, flags: [] } },
  },
  {
    id: "mhrdemo002",
    created_at: "2026-10-14T10:00:00.000Z",
    biomech_summary: {
      confidenceOverall: 0.87,
      peakAngles: { shoulderFlex_max: 141, neckFlex_max: 24 },
      rom: { shoulderFlex_range: 128 },
      flags: ["forward_head"],
    },
    mhr_results: { summary: { confidenceOverall: 0.87, peakAngles: { shoulderFlex_max: 141, neckFlex_max: 24 }, flags: ["forward_head"] } },
  },
];

const DEMO_SUBMISSIONS = [
  { id: "subdemo001", state: "reviewed", created_at: "2026-10-27T09:00:00.000Z", scheduled_date: "2026-10-27", submitted_at: "2026-10-27T09:30:00.000Z" },
  { id: "subdemo002", state: "submitted", created_at: "2026-10-25T09:00:00.000Z", scheduled_date: "2026-10-25", submitted_at: "2026-10-25T09:30:00.000Z" },
  { id: "subdemo003", state: "reviewed", created_at: "2026-10-22T09:00:00.000Z", scheduled_date: "2026-10-22", submitted_at: "2026-10-22T09:30:00.000Z" },
  { id: "subdemo004", state: "submitted", created_at: "2026-10-20T09:00:00.000Z", scheduled_date: "2026-10-20", submitted_at: "2026-10-20T09:30:00.000Z" },
];

export function buildDemoGoalEvidence(goalsText?: string): GoalEvidence {
  const goals = goalsText ? parseGoalsText(goalsText) : parseGoalsText(DEMO_GOALS_TEXT);
  return {
    goals: goals.length ? goals : parseGoalsText(DEMO_GOALS_TEXT),
    soapNotes: DEMO_SOAP,
    mhrResults: DEMO_MHR,
    submissions: DEMO_SUBMISSIONS,
    counts: { soapCount: DEMO_SOAP.length, mhrCount: DEMO_MHR.length, subCount: DEMO_SUBMISSIONS.length },
  };
}

export function buildDemoHighlightsEvidence(month?: string): HighlightsEvidence {
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : "2026-10";
  return {
    patientId: "demo-patient",
    month: m,
    soapNotes: DEMO_SOAP,
    homeProgramFeedback: DEMO_SUBMISSIONS.map((s) => ({ id: s.id, feedback: s.state })),
    goalReviewLatest: {
      summary: { onTrack: 3, atRisk: 1, behind: 0, achieved: 1, gap: 0, narrative: "Most goals progressing; ergonomic consistency is the watch item." },
      verdicts: [
        { verdict: "on_track" },
        { verdict: "on_track" },
        { verdict: "achieved" },
        { verdict: "at_risk" },
        { verdict: "on_track" },
      ],
    },
    adherence: { completionRate: 86, streak: 4, trend: 12 },
    activity: DEMO_MHR,
    counts: { soapCount: DEMO_SOAP.length, subCount: DEMO_SUBMISSIONS.length, mhrCount: DEMO_MHR.length, goalReviewCount: 1 },
    priorHighlights: null,
  };
}

export const DEMO_EVIDENCE_SUMMARY = {
  goals: 5,
  soapNotes: DEMO_SOAP.length,
  mhrClips: DEMO_MHR.length,
  submissions: DEMO_SUBMISSIONS.length,
  adherence: "86% completion · streak 4 · trend +12%",
};
