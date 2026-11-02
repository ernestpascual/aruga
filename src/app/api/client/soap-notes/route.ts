import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownsPatient } from "@/lib/supabase/owner";

async function ownsPatientCheck(admin: NonNullable<ReturnType<typeof createAdminClient>>, patientId: string, requesterId: string) {
  return ownsPatient(admin, patientId, requesterId);
}
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let patientId = searchParams.get("patientId");
    const clientUserId = searchParams.get("clientUserId");
    const requesterId = searchParams.get("requesterId") || clientUserId || req.headers.get("x-requester-id");

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    if (clientUserId && !patientId) {
      const { data: patientRecord } = await admin
        .from("patients")
        .select("id")
        .eq("client_user_id", clientUserId)
        .maybeSingle();

      if (patientRecord) {
        patientId = patientRecord.id;
      }
    }

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    if (requesterId) {
      const ok = await ownsPatientCheck(admin, patientId, requesterId);
      if (!ok) return NextResponse.json({ error: "Forbidden — not your patient" }, { status: 403 });
    } else {
      return NextResponse.json({ error: "requesterId required — pass your user id as requesterId or clientUserId" }, { status: 403 });
    }

    const { data: dbNotes, error } = await admin
      .from("soap_notes")
      .select("*, therapist_profile:profiles(*)")
      .eq("patient_id", patientId)
      .order("session_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ soapNotes: dbNotes || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
