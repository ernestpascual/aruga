import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(()=> ({}));
    const { patientId, month } = body as { patientId?: string; month?: string };
    if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 });
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    // Resolve client_user_id → patients.id (client dashboard passes user.id)
    let effectivePatientId = patientId;
    const { data: byId } = await admin.from("patients").select("id").eq("id", patientId).maybeSingle();
    if (!byId?.id) {
      const { data: byClient } = await admin.from("patients").select("id").eq("client_user_id", patientId).maybeSingle();
      if (byClient?.id) effectivePatientId = byClient.id;
    }
    // If month provided, publish that month; otherwise publish latest draft
    let targetMonth = month;
    if (!targetMonth) {
      const { data: latest } = await admin.from("highlights").select("month").eq("patient_id", effectivePatientId).eq("status","draft").order("created_at",{ascending:false}).limit(1).maybeSingle();
      targetMonth = latest?.month;
      if (!targetMonth) return NextResponse.json({ error: "No draft highlights to publish for this patient" }, { status: 404 });
    }
    const { data, error } = await admin.from("highlights").update({ status: "published" }).eq("patient_id", effectivePatientId).eq("month", targetMonth).select("id, patient_id, month, status").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, published: true, highlight: data });
  } catch (e:unknown) {
    return NextResponse.json({ error: e instanceof Error? e.message : String(e) }, { status: 500 });
  }
}
