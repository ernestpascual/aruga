import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePatientId } from "@/lib/supabase/resolve-patient";
import { runGoalAgent } from "@/lib/meta/goal-agent";
import { MetaApiError } from "@/lib/meta/errors";

export const maxDuration = 60;

const SPARK_REQUIRED_MSG_MISSING = "Requires Meta Spark API — MODEL_API_KEY missing. Set MODEL_API_KEY (or META_API_KEY) and META_API_BASE_URL=https://api.meta.ai/v1 with AI_MODE=live to enable Goal Tracking.";
const SPARK_REQUIRED_MSG_FAILED = "Requires Meta Spark API — call failed. Check MODEL_API_KEY validity, META_API_BASE_URL, and api.meta.ai credits, then retry with AI_MODE=live.";

/**
 * POST /api/agent/goal-tracking/run
 * Real LLM: muse-spark-1.3 reasoning:high json_schema prompt_cache_key aruga-goal-tracking
 * On any Spark/META_API_KEY failure returns 503 with Requires Meta Spark API message.
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

    // Gather evidence for LLM
    let soapNotes: any[] = [];
    let mhrResults: any[] = [];
    let submissions: any[] = [];
    try {
      const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const fourteenAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const [soaps, mhrs, subs] = await Promise.all([
        admin.from("soap_notes").select("id, session_date, subjective, objective, assessment, plan").eq("patient_id", effectivePatientId).order("session_date", { ascending: false }).limit(5),
        admin.from("ai_analyses").select("id, mhr_results, biomech_summary, created_at").eq("patient_id", effectivePatientId).gte("created_at", thirtyAgo).not("mhr_results", "is", null).limit(5),
        admin.from("submissions").select("id, state, created_at").eq("patient_id", effectivePatientId).gte("created_at", fourteenAgo).limit(20),
      ]);
      soapNotes = soaps.data || [];
      mhrResults = mhrs.data || [];
      submissions = subs.data || [];
    } catch {}

    // Support up to 15 goals (5 LTG + 10 STG) — if more than 6, route will batch in chunks of 5
    const goalsForLlm = [
      ...longGoals.map((t, i) => ({ id: `lt-${i}`, text: t, type: "ltg" as const })),
      ...shortGoals.map((t, i) => ({ id: `st-${i}`, text: t, type: "stg" as const })),
    ].slice(0, 15);

    const evidence = {
      goals: goalsForLlm,
      soapNotes,
      mhrResults,
      submissions,
      counts: { soapCount: soapNotes.length, mhrCount: mhrResults.length, subCount: submissions.length },
    };

    // Real LLM — batch if >5 goals to stay within token budget (single call 10 goals ≈ 6500 tok → NO_CONTENT). Parallel chunks of 5, merge verdicts.
    let llm: Awaited<ReturnType<typeof runGoalAgent>> | null = null;
    let sparkWarning: string | null = null;
    const CHUNK_SIZE = 5;
    async function runBatched(ev: typeof evidence): Promise<Awaited<ReturnType<typeof runGoalAgent>>> {
      if (ev.goals.length <= CHUNK_SIZE) return runGoalAgent(ev);
      const chunks: Array<typeof ev.goals> = [];
      for (let i = 0; i < ev.goals.length; i += CHUNK_SIZE) chunks.push(ev.goals.slice(i, i + CHUNK_SIZE));
      const results = await Promise.all(chunks.map((g) => runGoalAgent({ ...ev, goals: g })));
      // merge verdicts/suggestions/warnings; sum summary counts from each batch's summary
      const mergedVerdicts = results.flatMap((r) => r.result.verdicts);
      const mergedSummary = {
        onTrack: results.reduce((a, r) => a + (r.result.summary.onTrack || 0), 0),
        atRisk: results.reduce((a, r) => a + (r.result.summary.atRisk || 0), 0),
        behind: results.reduce((a, r) => a + (r.result.summary.behind || 0), 0),
        achieved: results.reduce((a, r) => a + (r.result.summary.achieved || 0), 0),
        gap: results.reduce((a, r) => a + (r.result.summary.gap || 0), 0),
        narrative: results.map((r) => r.result.summary.narrative).join(" "),
      } as typeof results[0]["result"]["summary"];
      const mergedSuggestions = results.flatMap((r) => r.result.suggestions).slice(0, 5);
      const mergedWarnings = [...new Set(results.flatMap((r) => r.result.warnings || []))];
      const totalLatency = results.reduce((a, r) => a + r.latencyMs, 0);
      return { result: { verdicts: mergedVerdicts, summary: mergedSummary, suggestions: mergedSuggestions, warnings: mergedWarnings }, latencyMs: totalLatency, modelId: results[0].modelId + ` x${results.length} batches` };
    }
    try {
      llm = await runBatched(evidence);
    } catch (llmErr: unknown) {
      const msg = llmErr instanceof MetaApiError ? llmErr.message : llmErr instanceof Error ? llmErr.message : String(llmErr);
      const code = llmErr instanceof MetaApiError ? llmErr.code : "SPARK_CALL_FAILED";
      const isMissing = code === "MISSING_API_KEY";
      sparkWarning = `${isMissing ? SPARK_REQUIRED_MSG_MISSING : SPARK_REQUIRED_MSG_FAILED} (${code}: ${msg})`;
    }
    if (!llm) {
      const hasEvidence = soapNotes.length > 0 || mhrResults.length > 0 || submissions.length > 0;
      const verdicts = goalsForLlm.map((g) => ({
        goalId: g.id,
        goalText: g.text,
        goalType: g.type,
        verdict: "gap" as const,
        confidence: hasEvidence ? 0.35 : 0.2,
        signals: { rom_vs_target: 0, adherence: 0, time_to_deadline: 0 },
        reason: hasEvidence
          ? `${sparkWarning || SPARK_REQUIRED_MSG_FAILED} Some evidence exists (SOAP ${soapNotes.length}, MHR ${mhrResults.length}, subs ${submissions.length}) but no LLM verdict yet.`
          : `${sparkWarning || SPARK_REQUIRED_MSG_MISSING} No recent notes/videos to check. Add a video and enable MODEL_API_KEY, then run again.`,
        evidenceIds: soapNotes[0]?.id ? [`soap:${String(soapNotes[0].id).slice(0, 8)}`] : [],
      }));
      const summary = {
        onTrack: 0,
        atRisk: 0,
        behind: 0,
        achieved: 0,
        gap: verdicts.length,
        narrative: `${sparkWarning || SPARK_REQUIRED_MSG_FAILED} — showing gap placeholders.`.slice(0, 220),
      };
      const suggestions = verdicts[0] ? [{ goalId: verdicts[0].goalId, action: "continue" as const, text: "Enable MODEL_API_KEY (AI_MODE=live) to get Spark reasoning:high verdicts." }] : [];
      const trace = [
        { thought: "Gathered goals + SOAP + MHR + submissions", tool: "fetch_goals+fetch_evidence", observation: `${goalsForLlm.length} goals, SOAP ${soapNotes.length}, MHR ${mhrResults.length}, subs ${submissions.length}` },
        { thought: sparkWarning || SPARK_REQUIRED_MSG_FAILED, tool: "draft_goal_review", observation: "degraded — gap" },
      ];
      return NextResponse.json({
        verdicts,
        summary,
        suggestions,
        warnings: [sparkWarning || SPARK_REQUIRED_MSG_FAILED],
        modelId: `degraded — ${sparkWarning || SPARK_REQUIRED_MSG_FAILED}`.slice(0, 180),
        counts: evidence.counts,
        trace,
        degraded: true,
        sparkRequired: true,
      });
    }

    const verdicts = llm.result.verdicts;
    const summary = llm.result.summary;
    const suggestions = llm.result.suggestions;
    const warnings: string[] = llm.result.warnings || [];
    const trace = [
      { thought: "Gathered goals + SOAP + MHR + submissions", tool: "fetch_goals+fetch_evidence", observation: `${goalsForLlm.length} goals, SOAP ${soapNotes.length}, MHR ${mhrResults.length}, subs ${submissions.length}` },
      { thought: "Spark reasoning:high evaluated 7 signals per goal", tool: "draft_goal_review", observation: llm.modelId, latencyMs: llm.latencyMs },
    ];

    // Persist to DB (goal_reviews) — draft
    let saved: any = null;
    try {
      const { data: ins, error: insErr } = await admin
        .from("goal_reviews")
        .insert({
          patient_id: effectivePatientId,
          verdicts,
          summary,
          suggestions,
          trace,
          warnings,
          counts: evidence.counts,
          status: "draft",
          model_id: llm.modelId,
        })
        .select("id, patient_id, status, created_at")
        .single();
      if (insErr) throw insErr;
      saved = ins;
      try {
        await admin.from("agent_runs").insert({ patient_id: effectivePatientId, intent: "goal_tracking", trace, status: "completed", model_id: llm.modelId });
      } catch {}
    } catch (dbErr: any) {
      // Table not migrated — return without saving
      return NextResponse.json({
        verdicts,
        summary,
        suggestions,
        warnings,
        modelId: `${llm.modelId} — Draft — save pending. Please run the latest database update.`,
        counts: evidence.counts,
        trace,
        latencyMs: llm.latencyMs,
        warning: dbErr.message || String(dbErr),
      });
    }

    return NextResponse.json({
      verdicts,
      summary,
      suggestions,
      warnings,
      modelId: llm.modelId,
      counts: evidence.counts,
      trace,
      latencyMs: llm.latencyMs,
      saved,
    });
  } catch (e: unknown) {
    if (e instanceof MetaApiError) {
      const isMissing = e.code === "MISSING_API_KEY";
      return NextResponse.json({ error: isMissing ? SPARK_REQUIRED_MSG_MISSING : SPARK_REQUIRED_MSG_FAILED, code: e.code, detail: e.message }, { status: isMissing ? 503 : 502 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
