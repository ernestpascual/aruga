import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runHighlightsAgent } from "@/lib/meta/highlights-agent";
import { MetaApiError } from "@/lib/meta/errors";

export const maxDuration = 60;

const SPARK_REQUIRED_MSG_MISSING = "Requires Meta Spark API — MODEL_API_KEY missing. Set MODEL_API_KEY (or META_API_KEY) and META_API_BASE_URL=https://api.meta.ai/v1 with AI_MODE=live to enable Highlights.";
const SPARK_REQUIRED_MSG_FAILED = "Requires Meta Spark API — call failed. Check MODEL_API_KEY validity, META_API_BASE_URL, and api.meta.ai credits, then retry with AI_MODE=live.";
const SLOT_LABELS = ["Goals","Movement","Steady progress","Keep going","Neck & posture","Program fit","Next step"] as const;
function monthKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const patientId = (body.patientId || req.nextUrl.searchParams.get("patientId")) as string | undefined;
    const month = (body.month as string | undefined) || monthKey();
    if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 });

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

    async function resolvePatientId(raw: string): Promise<string | null> {
      const { data: byId } = await admin!.from("patients").select("id").eq("id", raw).maybeSingle();
      if (byId?.id) return byId.id;
      const { data: byClientUserId } = await admin!.from("patients").select("id").eq("client_user_id", raw).maybeSingle();
      if (byClientUserId?.id) return byClientUserId.id;
      return null;
    }
    const resolvedPatientId = await resolvePatientId(patientId);
    if (!resolvedPatientId) return NextResponse.json({ error: "Patient not found — no patient linked to this account yet. Ask your therapist to link your profile, or re-login." }, { status: 404 });
    const effectivePatientId = resolvedPatientId;

    const { data: pat } = await admin.from("patients").select("id, long_term_goals, short_term_goals").eq("id", effectivePatientId).maybeSingle();
    if (!pat) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    // Gather evidence for LLM
    let soapNotes: any[] = [];
    let submissions: any[] = [];
    let mhrResults: any[] = [];
    let goalReviews: any[] = [];
    try {
      const thirtyAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString();
      const [soaps, subs, mhrs, grevs] = await Promise.all([
        admin.from("soap_notes").select("id, session_date, subjective, objective, assessment, plan").eq("patient_id", effectivePatientId).gte("session_date", thirtyAgo).order("session_date",{ascending:false}).limit(6),
        admin.from("submissions").select("id, state, submitted_at, created_at").eq("patient_id", effectivePatientId).gte("created_at", thirtyAgo),
        admin.from("ai_analyses").select("id, mhr_results, biomech_summary, created_at").eq("patient_id", effectivePatientId).gte("created_at", thirtyAgo).not("mhr_results","is",null).limit(10),
        admin.from("goal_reviews").select("id, verdicts, summary, created_at").eq("patient_id", effectivePatientId).order("created_at",{ascending:false}).limit(1),
      ]);
      soapNotes = soaps.data || [];
      submissions = subs.data || [];
      mhrResults = mhrs.data || [];
      goalReviews = grevs.data || [];
    } catch {}

    const counts = { soapCount: soapNotes.length, subCount: submissions.length, mhrCount: mhrResults.length, goalReviewCount: goalReviews.length };

    // Build adherence metrics for LLM
    const completionRate = submissions.length ? Math.round((submissions.filter((s:any)=> s.state==="submitted"||s.state==="reviewed").length / submissions.length)*100) : 0;
    // Trend: compare first half vs second half of 30d
    const halfPoint = Date.now() - 15*24*60*60*1000;
    const firstHalf = submissions.filter((s:any)=> new Date(s.created_at).getTime() < halfPoint).length;
    const secondHalf = submissions.filter((s:any)=> new Date(s.created_at).getTime() >= halfPoint).length;
    const trend = secondHalf - firstHalf;

    const goalReviewLatest = goalReviews[0] || null;

    // Prior month highlights for comparison
    let priorHighlights: any = null;
    try {
      const ym = month.split("-");
      const d = new Date(Number(ym[0]), Number(ym[1])-2, 1);
      const priorMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const { data: prior } = await admin.from("highlights").select("highlights, summary").eq("patient_id", effectivePatientId).eq("month", priorMonth).maybeSingle();
      if (prior) priorHighlights = prior;
    } catch {}

    const evidence = {
      patientId: effectivePatientId,
      month,
      soapNotes,
      homeProgramFeedback: submissions.slice(0,10).map((s:any)=> ({ id: s.id, feedback: s.state } as any)),
      goalReviewLatest,
      adherence: { completionRate, streak: secondHalf, trend },
      activity: mhrResults,
      counts,
      priorHighlights,
    };

    // Real LLM — if Spark unavailable, return 7 placeholders with Requires Meta Spark API warning (degraded, like before)
    let llm: Awaited<ReturnType<typeof runHighlightsAgent>> | null = null;
    let sparkWarning: string | null = null;
    try {
      llm = await runHighlightsAgent(evidence);
    } catch (llmErr: unknown) {
      const msg = llmErr instanceof MetaApiError ? llmErr.message : llmErr instanceof Error ? llmErr.message : String(llmErr);
      const code = llmErr instanceof MetaApiError ? llmErr.code : "SPARK_CALL_FAILED";
      const isMissing = code === "MISSING_API_KEY";
      sparkWarning = `${isMissing ? SPARK_REQUIRED_MSG_MISSING : SPARK_REQUIRED_MSG_FAILED} (${code}: ${msg})`;
    }
    if (!llm) {
      const hasAnyEvidence = counts.soapCount + counts.subCount + counts.mhrCount + counts.goalReviewCount > 0;
      const mk = (slot:number, title:string, story:string, delta:{quanti:string;quali:string}) => ({
        slot,
        slotLabel: SLOT_LABELS[slot-1],
        title,
        story: story.slice(0,100),
        delta,
        arrow: "→" as const,
        weight: 0,
        evidenceIds: [] as string[],
      });
      const highlights = [
        mk(1, "Requires Meta Spark API", sparkWarning || SPARK_REQUIRED_MSG_FAILED, { quanti: "—", quali: "Add MODEL_API_KEY + AI_MODE=live" }),
        mk(2, hasAnyEvidence ? `${counts.mhrCount} video(s) this month` : "No movement videos yet", hasAnyEvidence ? "LLM curation disabled — Spark needed for Top ROM" : "Add a video + enable Spark", { quanti: `${counts.mhrCount} video(s)`, quali: hasAnyEvidence ? "Evidence exists" : "No data" }),
        mk(3, "Compensation — Spark needed", "Spark reasoning:high picks compensation shift; currently gap", { quanti: "—", quali: "Requires Meta Spark API" }),
        mk(4, `${completionRate}% completion`, hasAnyEvidence ? "Adherence computed — Spark picks story" : "No homework 30d", { quanti: `${completionRate}%`, quali: hasAnyEvidence ? "Computed" : "No data" }),
        mk(5, "Neck & posture — Spark needed", "Spark needed for neck cross-age highlight", { quanti: "—", quali: "Requires Meta Spark API" }),
        mk(6, hasAnyEvidence ? "Program fit computed" : "No program data", sparkWarning || SPARK_REQUIRED_MSG_FAILED, { quanti: `${counts.subCount} updates`, quali: hasAnyEvidence ? "Computed" : "No data" }),
        mk(7, "Next step — Spark needed", "Spark picks next focus by risk×deadline; currently gap", { quanti: "—", quali: "Requires Meta Spark API" }),
      ];
      const summary = { trend: hasAnyEvidence ? "mixed" : "insufficient", topDriver: "Requires Meta Spark API — degraded placeholders" };
      const priorCompare = { lastMonthTrend: "—", deltaVsPrior: sparkWarning ? "degraded" : "no prior" };
      const trace = [
        { thought: "Fetched month window", tool: "fetch_month", observation: `SOAP ${counts.soapCount}, subs ${counts.subCount}, MHR ${counts.mhrCount}, goalReviews ${counts.goalReviewCount}` },
        { thought: sparkWarning || SPARK_REQUIRED_MSG_FAILED, tool: "highlights-curation", observation: "degraded — 7 placeholders" },
      ];
      return NextResponse.json({
        highlights,
        summary,
        priorCompare,
        counts,
        trace,
        modelId: `degraded — ${sparkWarning || SPARK_REQUIRED_MSG_FAILED}`,
        warnings: [sparkWarning || SPARK_REQUIRED_MSG_FAILED],
        degraded: true,
        sparkRequired: true,
      });
    }

    const highlights = llm.result.highlights;
    const summary = llm.result.summary;
    const priorCompare = llm.result.priorCompare;
    const trace = [
      { thought: "Fetched month window", tool: "fetch_month", observation: `SOAP ${counts.soapCount}, subs ${counts.subCount}, MHR ${counts.mhrCount}, goalReviews ${counts.goalReviewCount}` },
      { thought: "Spark reasoning discerned evidence-backed slots by |Δ|×consistency×confidence", tool: "highlights-curation", observation: `${llm.modelId} ${llm.latencyMs}ms — ${highlights.length} slots with evidence` },
    ];

    // Persist draft
    let saved: any = null;
    try {
      const { data: existing } = await admin.from("highlights").select("id").eq("patient_id", effectivePatientId).eq("month", month).maybeSingle();
      const payload = {
        patient_id: effectivePatientId,
        month,
        highlights,
        summary,
        prior_compare: priorCompare,
        trace,
        status: "draft" as const,
        model_id: llm.modelId,
      };
      if (existing?.id) {
        const { data: upd, error: updErr } = await admin.from("highlights").update(payload).eq("id", existing.id).select("id, patient_id, month, status").single();
        if (updErr) throw updErr;
        saved = upd;
      } else {
        const { data: ins, error: insErr } = await admin.from("highlights").insert(payload).select("id, patient_id, month, status").single();
        if (insErr) throw insErr;
        saved = ins;
      }
      try {
        await admin.from("agent_runs").insert({ patient_id: effectivePatientId, intent: "highlights", concepts: SLOT_LABELS as unknown as string[], trace, status: "completed", model_id: payload.model_id });
      } catch {}
    } catch (dbErr:any) {
      return NextResponse.json({ highlights, summary, priorCompare, counts, trace, latencyMs: llm.latencyMs, modelId: `${llm.modelId} — save needs a quick database update`, warning: dbErr.message || String(dbErr) });
    }

    return NextResponse.json({ highlights, summary, priorCompare, counts, trace, saved, latencyMs: llm.latencyMs, modelId: llm.modelId });
  } catch (e: unknown) {
    if (e instanceof MetaApiError) {
      const isMissing = e.code === "MISSING_API_KEY";
      return NextResponse.json({ error: isMissing ? SPARK_REQUIRED_MSG_MISSING : SPARK_REQUIRED_MSG_FAILED, code: e.code, detail: e.message }, { status: isMissing ? 503 : 502 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const rawPatientId = req.nextUrl.searchParams.get("patientId");
  const month = req.nextUrl.searchParams.get("month") || monthKey();
  if (!rawPatientId) return NextResponse.json({ error: "patientId required" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  let patientId = rawPatientId;
  const { data: byId } = await admin.from("patients").select("id").eq("id", rawPatientId).maybeSingle();
  if (!byId?.id) {
    const { data: byClient } = await admin.from("patients").select("id").eq("client_user_id", rawPatientId).maybeSingle();
    if (byClient?.id) patientId = byClient.id;
  }
  const { data, error } = await admin.from("highlights").select("*").eq("patient_id", patientId).eq("month", month).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ patientId, month, status: "not_found" });
  return NextResponse.json(data);
}
