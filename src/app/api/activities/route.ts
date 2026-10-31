import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const patientId = searchParams.get("patientId");
    const creatorId = searchParams.get("creatorId");

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ activities: [] });

    if (id) {
      const { data, error } = await admin.from("generated_activities").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ activity: data });
    }

    let q = admin.from("generated_activities").select("*").order("created_at", { ascending: false }).limit(100);
    if (patientId) q = q.eq("patient_id", patientId);
    if (creatorId) q = q.eq("creator_id", creatorId);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return NextResponse.json({ activities: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, instructions } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "DB not configured" }, { status: 503 });
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title.trim();
    if (instructions !== undefined) updates.instructions = instructions.trim();
    const { data, error } = await admin.from("generated_activities").update(updates).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ activity: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
