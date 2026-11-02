import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const serverClient = await createServerClient();
    let clientUserId: string | null = null;
    if (serverClient) {
      const { data: { user } } = await serverClient.auth.getUser();
      if (user?.id) clientUserId = user.id;
    }
    // Fallback query param for demo/dev (therapist view)
    const { searchParams } = new URL(req.url);
    const qpId = searchParams.get("clientUserId") || searchParams.get("patientId");
    const effectiveId = clientUserId || qpId;
    if (!effectiveId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!admin) {
      return NextResponse.json({ error: "Database not configured — run Supabase migrations", code: "DB_NOT_CONFIGURED" }, { status: 503 });
    }

    // Resolve patient row: either by client_user_id or by patient id directly
    let row: { id: string; care_guide: string | null } | null = null;
    // Try client_user_id lookup first
    const { data: byClient } = await admin.from("patients").select("id, care_guide").eq("client_user_id", effectiveId).maybeSingle();
    if (byClient) row = byClient;
    else {
      const { data: byId } = await admin.from("patients").select("id, care_guide").eq("id", effectiveId).maybeSingle();
      if (byId) row = byId;
    }
    if (!row) return NextResponse.json({ careGuide: "", patientId: null });
    return NextResponse.json({ careGuide: row.care_guide || "", patientId: row.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
