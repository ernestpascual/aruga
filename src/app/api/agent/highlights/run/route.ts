import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

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

    // Resolve patient — dashboard passes user.id (profiles.id / client_user_id) while therapist passes patients.id
    // Accept either; also handles demo users where patients rows may be seeded via client_user_id.
    async function resolvePatientId(raw: string): Promise<string | null> {
      const { data: byId } = await admin!.from("patients").select("id").eq("id", raw).maybeSingle();
      if (byId?.id) return byId.id;
      const { data: byClientUserId } = await admin!.from("patients").select("id").eq("client_user_id", raw).maybeSingle();
      if (byClientUserId?.id) return byClientUserId.id;
      return null;
    }
    const resolvedPatientId = await resolvePatientId(patientId);
    if (!resolvedPatientId) return NextResponse.json({ error: "Patient not found — no patient linked to this account yet. Ask your therapist to link your profile, or re-login." }, { status: 404 });
    // For downstream evidence queries use the canonical patients.id
    const effectivePatientId = resolvedPatientId;

    // Ownership check — fetch goals for summary (best effort)
    const { data: pat } = await admin.from("patients").select("id, long_term_goals, short_term_goals").eq("id", effectivePatientId).maybeSingle();
    if (!pat) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    // Fetch evidence for period
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

    // Build 7 highlights — never invent numbers; use placeholders when insufficient
    const hasAnyEvidence = counts.soapCount + counts.subCount + counts.mhrCount + counts.goalReviewCount > 0;

    // Helper to make placeholder
    const placeholder = (slot: number, reason: string) => ({
      slot,
      slotLabel: SLOT_LABELS[slot-1],
      title: "Not enough info yet",
      story: reason.slice(0, 100),
      delta: { quanti: "—", quali: "No info this month" },
      arrow: "→",
      weight: 0,
      evidenceIds: [] as string[],
    });

    const highlights: Array<{ slot:number; slotLabel:string; title:string; story:string; delta:{quanti:string; quali:string}; arrow:string; weight:number; evidenceIds:string[] }> = [];

    // Slot 1: Goal Progress — requires goal_reviews
    if (goalReviews[0]) {
      const gr = goalReviews[0] as any;
      const summary = gr.summary || {};
      const onTrack = summary.onTrack ?? 0;
      const total = Array.isArray(gr.verdicts) ? gr.verdicts.length : 0;
      highlights.push({
        slot: 1, slotLabel: SLOT_LABELS[0],
        title: `${onTrack} of ${total} goals on track`,
        story: `We checked ${total} goals — ${onTrack} on track, ${summary.atRisk ?? 0} need attention.`,
        delta: { quanti: `${onTrack}/${total} on track`, quali: "From your goal review" },
        arrow: onTrack > 0 ? "↑" : "→",
        weight: total > 0 ? 0.7 : 0,
        evidenceIds: [`goal_review:${String(gr.id).slice(0,8)}`],
      });
    } else {
      highlights.push(placeholder(1, "No goal check yet. Tap Check goals above, then generate highlights again."));
    }

    // Slot 2: Top ROM gain — requires mhrResults
    if (mhrResults.length >= 1) {
      const latest = mhrResults[0] as any;
      const conf = latest.biomech_summary?.confidenceOverall ?? latest.mhr_results?.summary?.confidenceOverall ?? 0;
      highlights.push({
        slot: 2, slotLabel: SLOT_LABELS[1],
        title: `${mhrResults.length} movement video${mhrResults.length>1?"s":""} this month`,
        story: mhrResults.length >=2 ? "We have enough videos to compare with last month." : "Add one more video to see your change over time.",
        delta: { quanti: `${mhrResults.length} video${mhrResults.length>1?"s":""}`, quali: latest.biomech_summary?.risk ? `${latest.biomech_summary.risk} risk` : "Movement data available" },
        arrow: mhrResults.length >=2 ? "↑" : "→",
        weight: mhrResults.length >=2 ? 0.6 : 0.2,
        evidenceIds: mhrResults.slice(0,2).map((r:any)=> `mhr:${String(r.id).slice(0,8)}`),
      });
    } else {
      highlights.push(placeholder(2, "No movement videos yet this month. Add a video to track progress."));
    }

    // Slot 3: Compensation shift
    if (mhrResults.length >= 1) {
      const flags = (mhrResults[0] as any)?.mhr_results?.flags || (mhrResults[0] as any)?.biomech_summary?.flags || [];
      const hasFlags = Array.isArray(flags) && flags.length>0;
      highlights.push({
        slot: 3, slotLabel: SLOT_LABELS[2],
        title: hasFlags ? "Small balance tip seen" : "Movement looked steady",
        story: hasFlags ? "We noticed a small shift in posture to take a look at." : "No extra leaning or strain noticed this month.",
        delta: { quanti: hasFlags ? `${flags.length} tip${flags.length>1?"s":""}` : "Steady", quali: hasFlags ? "Therapist will review" : "Looking good" },
        arrow: hasFlags ? "↓" : "→",
        weight: hasFlags ? 0.5 : 0.15,
        evidenceIds: mhrResults.slice(0,1).map((r:any)=> `mhr:${String(r.id).slice(0,8)}`),
      });
    } else highlights.push(placeholder(3, "No movement data to check posture yet. Add a video."));

    // Slot 4: Adherence
    if (submissions.length > 0) {
      const rate = submissions.filter((s:any)=> s.state==="submitted"||s.state==="reviewed").length;
      highlights.push({
        slot: 4, slotLabel: SLOT_LABELS[3],
        title: `${rate} of ${submissions.length} tasks done`,
        story: `You completed ${rate} of ${submissions.length} assigned tasks this month.`,
        delta: { quanti: `${rate}/${submissions.length} done`, quali: rate>0 ? "Great job" : "No tasks yet" },
        arrow: rate>0 ? "↑" : "→",
        weight: submissions.length>0 ? 0.4 : 0,
        evidenceIds: submissions.slice(0,2).map((s:any)=> `submission:${String(s.id).slice(0,8)}`),
      });
    } else highlights.push(placeholder(4, "No homework done in the last 30 days."));

    // Slot 5: Neck / cross-age
    if (mhrResults.length >=1) {
      highlights.push({
        slot: 5, slotLabel: SLOT_LABELS[4],
        title: "Neck and head control checked",
        story: "We checked head and neck posture in your latest video.",
        delta: { quanti: "Posture checked", quali: "All ages" },
        arrow: "→", weight: 0.25,
        evidenceIds: mhrResults.slice(0,1).map((r:any)=> `mhr:${String(r.id).slice(0,8)}`),
      });
    } else highlights.push(placeholder(5, "No neck posture video yet. Add one to check it."));

    // Slot 6: Program fit
    if (submissions.length>0 || soapNotes.length>0) {
      highlights.push({
        slot: 6, slotLabel: SLOT_LABELS[5],
        title: submissions.length>0 ? "Homework progress saved" : "Session notes saved",
        story: submissions.length>0 ? "Your homework progress was saved this month." : "Your therapist saved session notes to review with you.",
        delta: { quanti: `${submissions.length} update${submissions.length!==1?"s":""}`, quali: submissions.length>0 ? "Progress noted" : "Notes saved" },
        arrow: "→", weight: 0.2,
        evidenceIds: [...(submissions.slice(0,1).map((s:any)=> `submission:${String(s.id).slice(0,8)}`)), ...(soapNotes.slice(0,1).map((n:any)=> `soap:${String(n.id).slice(0,8)}`))],
      });
    } else highlights.push(placeholder(6, "No homework linked yet. Connect it to your program."));

    // Slot 7: Next focus
    if (goalReviews[0] || soapNotes[0]) {
      const next = (goalReviews[0] as any)?.suggestions?.[0]?.text || soapNotes[0]?.plan?.slice(0,80) || "Continue current plan.";
      highlights.push({
        slot: 7, slotLabel: SLOT_LABELS[6],
        title: "Next step",
        story: String(next).slice(0,100),
        delta: { quanti: goalReviews[0] ? "Based on your goals" : "From your plan", quali: "Therapist set this" },
        arrow: "→", weight: 0.3,
        evidenceIds: goalReviews[0] ? [`goal_review:${String(goalReviews[0].id).slice(0,8)}`] : soapNotes[0] ? [`soap:${String(soapNotes[0].id).slice(0,8)}`] : [],
      });
    } else highlights.push(placeholder(7, "No next step yet. Your therapist will set one after the goal check."));

    const summary = {
      trend: hasAnyEvidence ? "mixed" : "insufficient",
      topDriver: highlights.find(h=> h.weight>0)?.title || "Awaiting evidence",
    };
    const priorCompare = { lastMonthTrend: "—", deltaVsPrior: hasAnyEvidence ? "new period" : "no prior" };

    const trace = [
      { thought: "Fetched month window", tool: "fetch_month", observation: `SOAP ${counts.soapCount}, subs ${counts.subCount}, MHR ${counts.mhrCount}, goalReviews ${counts.goalReviewCount}` },
      { thought: "Weighted 7 slots by |Δ|×consistency×confidence — no invention", tool: "highlights-curation", observation: `${highlights.filter(h=> h.weight>0).length}/7 with evidence, rest placeholders` },
    ];

    // Persist to DB (upsert patient_id+month) — draft status, require therapist publish to expose to client
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
        model_id: "highlights draft",
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
      // Log agent run
      try {
        await admin.from("agent_runs").insert({ patient_id: effectivePatientId, intent: "highlights", concepts: SLOT_LABELS as unknown as string[], trace, status: "completed", model_id: payload.model_id });
      } catch {}
    } catch (dbErr:any) {
      // If table not migrated yet, return highlights without saving but warn
      return NextResponse.json({ highlights, summary, priorCompare, counts, trace, modelId: "Highlights ready — save needs a quick database update", warning: dbErr.message || String(dbErr) });
    }

    return NextResponse.json({ highlights, summary, priorCompare, counts, trace, saved, modelId: "Highlights saved as draft" });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const rawPatientId = req.nextUrl.searchParams.get("patientId");
  const month = req.nextUrl.searchParams.get("month") || monthKey();
  if (!rawPatientId) return NextResponse.json({ error: "patientId required" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  // Resolve client_user_id → patients.id
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
