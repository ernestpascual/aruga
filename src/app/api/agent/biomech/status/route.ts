import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
export async function GET(req: NextRequest) {
  const stepSubmissionId = req.nextUrl.searchParams.get("stepSubmissionId");
  if (!stepSubmissionId) return NextResponse.json({ error: "stepSubmissionId required" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const { data } = await admin.from("biomech_jobs").select("id, status, intent, concepts, created_at").eq("step_submission_id", stepSubmissionId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return NextResponse.json({ status: "not_found", trace: [] });
  return NextResponse.json({ status: data.status, intent: data.intent, concepts: data.concepts, job: data });
}
