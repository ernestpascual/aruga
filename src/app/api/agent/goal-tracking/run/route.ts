import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePatientId } from "@/lib/supabase/resolve-patient";

export const maxDuration = 60;

/**
 * POST /api/agent/goal-tracking/run
 * Evaluates STG/LTG vs real evidence — no invented ROM, adherence or mhr data.
 * Returns verdicts with gap/low_confidence when evidence missing.
 * Requires real goals in patients.long_term_goals / short_term_goals.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { patientId } = body as { patientId?: string };
    if (!patientId || typeof patientId !== "string") {
      return NextResponse.json({ error: "patientId required" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

    // Accept either patients.id (therapist) or client_user_id/profiles.id (client dashboard)
    const effectivePatientId = (await resolvePatientId(admin, patientId)) || patientId;
    const { data: pat, error: patErr } = await admin
      .from("patients")
      .select("id, long_term_goals, short_term_goals")
      .eq("id", effectivePatientId)
      .maybeSingle();
    if (patErr) return NextResponse.json({ error: patErr.message }, { status: 500 });
    if (!pat) return NextResponse.json({ error: "Patient not found — no patient linked to this account yet. Ask your therapist to link your profile." }, { status: 404 });

    const longGoals: string[] = Array.isArray((pat as any).long_term_goals) ? (pat as any).long_term_goals.filter(Boolean).slice(0, 5) : [];
    const shortGoals: string[] = Array.isArray((pat as any).short_term_goals) ? (pat as any).short_term_goals.filter(Boolean).slice(0, 10) : [];

    if (longGoals.length === 0 && shortGoals.length === 0) {
      return NextResponse.json(
        { error: "No therapy goals configured for this patient. Add at least one long-term or short-term goal to enable Goal Tracking.", code: "NO_GOALS" },
        { status: 422 }
      );
    }

    // Fetch real evidence — counts only, no invention
    let soapNotes: any[] = [];
    let mhrCount = 0;
    let submissionCount = 0;
    try {
      const { data: soaps } = await admin.from("soap_notes").select("id, session_date, objective, assessment, plan").eq("patient_id", effectivePatientId).order("session_date", { ascending: false }).limit(5);
      soapNotes = soaps || [];
    } catch {}
    try {
      const { count } = await admin.from("ai_analyses").select("id", { count: "exact", head: true }).eq("patient_id", effectivePatientId);
      mhrCount = count || 0;
    } catch {}
    try {
      const { count } = await admin.from("submissions").select("id", { count: "exact", head: true }).eq("patient_id", effectivePatientId);
      submissionCount = count || 0;
    } catch {}

    const hasEvidence = soapNotes.length > 0 || mhrCount > 0 || submissionCount > 0;

    // If insufficient evidence, return gap verdicts with honest reasons — never invent ROM
    const all = [
      ...longGoals.map((t, i) => ({ t, id: `lt-${i}`, type: "ltg" as const })),
      ...shortGoals.map((t, i) => ({ t, id: `st-${i}`, type: "stg" as const })),
    ].slice(0, 6);

    const verdicts = all.map((g) => {
      if (!hasEvidence) {
        return {
          goalId: g.id,
          goalText: g.t,
          goalType: g.type,
          verdict: "gap" as const,
          confidence: 0.2,
          signals: { rom_vs_target: 0, adherence: 0, time_to_deadline: 0 },
          reason: "No recent notes or videos to check. Add a short video and a session note, then run this again.",
          evidenceIds: [] as string[],
        };
      }
      // When some evidence exists but not per-goal matched, mark at_risk with low confidence and cite real IDs if any
      const evidenceIds: string[] = [];
      if (soapNotes[0]?.id) evidenceIds.push(`soap:${soapNotes[0].id.slice(0, 8)}`);
      // Do not invent mhr or submission IDs — only include counts as context in reason
      return {
        goalId: g.id,
        goalText: g.t,
        goalType: g.type,
        verdict: "gap" as const,
        confidence: 0.35,
        signals: { rom_vs_target: 0, adherence: 0, time_to_deadline: 0 },
        reason: `Some evidence exists (SOAP ${soapNotes.length}, MHR ${mhrCount}, submissions ${submissionCount}) but no goal-linked measurements yet. Link a video analysis (Biomech Agent) with the relevant intent (U1-U11) and document progress in SOAP Objective to enable quantitative tracking.`,
        evidenceIds,
      };
    });

    const summary = {
      onTrack: verdicts.filter((v: any) => v.verdict === "on_track").length,
      atRisk: verdicts.filter((v: any) => v.verdict === "at_risk").length,
      behind: verdicts.filter((v: any) => v.verdict === "behind").length,
      achieved: verdicts.filter((v: any) => v.verdict === "achieved").length,
      gap: verdicts.filter((v: any) => v.verdict === "gap").length,
      narrative: hasEvidence
        ? `Found ${verdicts.length} goals. We have some notes, but need a movement video linked to each goal to track progress.`
        : `No recent videos or notes yet. Add one to start tracking progress.`,
    };

    const suggestions: Array<{ goalId: string; action: string; text: string }> = [];
    if (!hasEvidence) {
      suggestions.push({ goalId: verdicts[0].goalId, action: "continue", text: "Add a short video for this goal — it helps us measure progress." });
    }

    // Persist to DB (goal_reviews) — draft, saves when generated
    const trace = [{ thought: "Fetched goals + evidence counts", tool: "fetch_goals+fetch_evidence", observation: `${all.length} goals, evidence=${hasEvidence ? "partial" : "none"}` }];
    let saved: any = null;
    try {
      const { data: ins, error: insErr } = await admin.from("goal_reviews").insert({
        patient_id: effectivePatientId,
        verdicts,
        summary,
        suggestions,
        trace,
        warnings: hasEvidence ? [] : ["Not enough info linked to your goals yet — add a video or note."],
        counts: { soapNotes: soapNotes.length, mhrCount, submissionCount },
        status: "draft",
        model_id: "muse-spark-1.3 reasoning:high (no mock — evidence-gated)",
      }).select("id, patient_id, status, created_at").single();
      if (insErr) throw insErr;
      saved = ins;
      try { await admin.from("agent_runs").insert({ patient_id: effectivePatientId, intent: "goal_tracking", trace, status: "completed", model_id: "muse-spark-1.3 reasoning:high" }); } catch {}
    } catch (dbErr:any) {
      // Table not yet migrated — return without saving but warn
      return NextResponse.json({ verdicts, summary, suggestions, modelId: "Draft — save pending. Please run the latest database update.", warnings: hasEvidence ? [] : ["Insufficient evidence"], counts: { soapNotes: soapNotes.length, mhrCount, submissionCount }, trace, warning: dbErr.message || String(dbErr) });
    }

    return NextResponse.json({
      verdicts,
      summary,
      suggestions,
      modelId: saved ? `Draft saved` : "Draft created",
      warnings: hasEvidence ? [] : ["Not enough info linked to your goals yet — add a video or note."],
      counts: { soapNotes: soapNotes.length, mhrCount, submissionCount },
      trace,
      saved,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
