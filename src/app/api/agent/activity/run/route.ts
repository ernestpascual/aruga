import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { ownsPatient } from "@/lib/supabase/owner";
import { resolvePatientId } from "@/lib/supabase/resolve-patient";
import { runActivityAgent } from "@/lib/meta/agent";
import { MetaApiError } from "@/lib/meta/errors";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, creatorId, step, action, feedback, usageInstructions, generateImage, patientContextHint, targetGoalKind, targetGoalText } = body;

    if (!patientId || typeof patientId !== "string") return NextResponse.json({ error: "patientId required" }, { status: 400 });
    if (!step || typeof step.title !== "string" || typeof step.instructions !== "string") {
      return NextResponse.json({ error: "step.title and step.instructions required" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

    // Derive requesterId from auth or header or body creatorId
    let requesterId: string | null = null;
    try {
      const sc = await createServerClient();
      const { data: { user } } = await (sc as NonNullable<typeof sc>).auth.getUser();
      if (user?.id) requesterId = user.id;
    } catch {}
    const hdr = req.headers.get("x-requester-id") || req.headers.get("x-user-id");
    if (hdr) requesterId = hdr;
    if (!requesterId && creatorId) requesterId = String(creatorId);
    if (!requesterId) return NextResponse.json({ error: "requesterId required (send x-requester-id or creatorId)" }, { status: 403 });

    // Normalize patientId — therapist passes patients.id, client dashboard may pass profiles.id
    const normalizedPatientId = (await resolvePatientId(admin, patientId)) || patientId;
    const ok = await ownsPatient(admin, normalizedPatientId, requesterId);
    if (!ok) {
      try {
        const { data: dbg } = await admin.from("patients").select("id, therapist_id, client_user_id, email, pending_therapist_email").eq("id", normalizedPatientId).maybeSingle();
        console.warn(`[agent/activity] ownsPatient denied`, { patientId, normalizedPatientId, requesterId, dbg });
      } catch {}
      return NextResponse.json({ error: "Forbidden — therapist does not own patient" }, { status: 403 });
    }

    const draft = await runActivityAgent({
      patientId: normalizedPatientId,
      creatorId: creatorId || requesterId,
      step: { title: String(step.title), instructions: String(step.instructions), position: Number(step.position) || 1 },
      action: action || "auto_draft",
      feedback: feedback ? String(feedback) : undefined,
      usageInstructions: typeof usageInstructions === "string" ? usageInstructions : null,
      generateImage: generateImage === false ? false : true,
      targetGoalKind: targetGoalKind === "ltg" || targetGoalKind === "stg" ? targetGoalKind : null,
      targetGoalText: typeof targetGoalText === "string" ? targetGoalText : null,
    });

    return NextResponse.json(draft);
  } catch (err: unknown) {
    if (err instanceof MetaApiError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode || 500 });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
