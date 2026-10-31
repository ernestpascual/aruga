import { NextRequest, NextResponse } from "next/server";
import { getMockStore, DEMO_PATIENT_ID } from "@/lib/supabase/mock-store";
import { createAdminClient } from "@/lib/supabase/admin";

async function ownsPatientCheck(admin: NonNullable<ReturnType<typeof createAdminClient>>, patientId: string, requesterId: string) {
  const { data: pat } = await admin.from("patients").select("client_user_id, therapist_id").eq("id", patientId).maybeSingle();
  if (!pat) return false;
  return pat.client_user_id === requesterId || pat.therapist_id === requesterId;
}
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let patientId = searchParams.get("patientId");
    const clientUserId = searchParams.get("clientUserId");
    const requesterId = searchParams.get("requesterId") || clientUserId || req.headers.get("x-requester-id");
    const isDemo = searchParams.get("isDemo") === "true";

    const admin = createAdminClient();

    if (admin) {
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

      if (patientId) {
        if (requesterId) {
          const ok = await ownsPatientCheck(admin, patientId, requesterId);
          if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        } else if (!isDemo) {
          return NextResponse.json({ error: "requesterId required" }, { status: 403 });
        }
        const { data: dbNotes, error } = await admin
          .from("soap_notes")
          .select("*, therapist_profile:profiles(*)")
          .eq("patient_id", patientId)
          .order("session_date", { ascending: false });

        if (!error && dbNotes && (dbNotes.length > 0 || !isDemo)) {
          return NextResponse.json({ soapNotes: dbNotes });
        }
      }
    }

    // Fallback in-memory store for demo mode or offline dev
    const store = getMockStore();
    const effectivePatientId = patientId || DEMO_PATIENT_ID;

    const notes = store.soapNotes.filter((n) => n.patient_id === effectivePatientId);

    const hydrated = notes.map((n) => {
      const therapist = store.profiles.find((p) => p.id === n.therapist_id);
      return {
        ...n,
        therapist_profile: therapist,
      };
    });

    return NextResponse.json({ soapNotes: hydrated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
