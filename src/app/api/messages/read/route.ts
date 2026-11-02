import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownsPatient } from "@/lib/supabase/owner";

async function ownsPatientCheck(admin: NonNullable<ReturnType<typeof createAdminClient>>, patientId: string, requesterId: string) {
  if (!requesterId) return false;
  return ownsPatient(admin, patientId, requesterId);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const patientId = body.patientId || url.searchParams.get("patientId");
    const requesterId = body.requesterId || body.userId || url.searchParams.get("requesterId") || url.searchParams.get("userId") || req.headers.get("x-requester-id");
    const at = body.at || new Date().toISOString();

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Service unavailable: database not configured" }, { status: 503 });
    if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 });
    if (!requesterId) return NextResponse.json({ error: "requesterId required" }, { status: 403 });

    const ok = await ownsPatientCheck(admin, patientId, requesterId);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data, error } = await admin
      .from("message_read_states")
      .upsert(
        {
          patient_id: patientId,
          user_id: requesterId,
          last_read_at: at,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "patient_id,user_id" }
      )
      .select("patient_id, user_id, last_read_at")
      .single();

    if (error) {
      // If table not yet migrated, silently succeed (badge will show all as unread until migration runs)
      if (error.message?.includes("does not exist") || error.message?.includes("message_read_states")) {
        return NextResponse.json({ success: true, note: "read table not yet migrated" });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, readState: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
