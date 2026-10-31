import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      generatedActivityId,
      stepSubmissionId,
      patientId,
      clientId,
      drawingStoragePath,
      drawingDataUrl,
      drawingStrokes,
      photoUploadPath,
      completionMethod,
      scheduledDate,
      programId,
    } = body;

    if (!generatedActivityId || !patientId) {
      return NextResponse.json({ error: "generatedActivityId and patientId required" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "DB not configured — run migrations 05/06" }, { status: 503 });
    }

    // Ensure step_submission exists: if stepSubmissionId missing but programId given,
    // try to create/find draft submission flow (use same as client program runner)
    let effectiveStepSubId: string | null = stepSubmissionId || null;

    // Create/update activity_completion
    const row: Record<string, unknown> = {
      generated_activity_id: generatedActivityId,
      step_submission_id: effectiveStepSubId,
      patient_id: patientId,
      client_id: clientId || null,
      drawing_data_url: drawingDataUrl ? String(drawingDataUrl).slice(0, 5000000) : null, // cap
      drawing_storage_path: drawingStoragePath || null,
      drawing_strokes: drawingStrokes || [],
      photo_upload_path: photoUploadPath || null,
      completion_method: completionMethod || (photoUploadPath ? "photo" : "canvas"),
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // If step_submission_id is present, upsert on that unique key
    let result;
    if (effectiveStepSubId) {
      const { data: existing } = await admin.from("activity_completions").select("id").eq("step_submission_id", effectiveStepSubId).maybeSingle();
      if (existing) {
        const { data, error } = await admin.from("activity_completions").update(row).eq("id", existing.id).select().single();
        if (error) throw new Error(error.message);
        result = data;
      } else {
        const { data, error } = await admin.from("activity_completions").insert(row).select().single();
        if (error) throw new Error(error.message);
        result = data;
      }
    } else {
      const { data, error } = await admin.from("activity_completions").insert(row).select().single();
      if (error) throw new Error(error.message);
      result = data;
    }

    // Mirror into step_submissions.media_meta if linked (so therapist review surfaces it)
    if (effectiveStepSubId) {
      await admin.from("step_submissions").update({
        media_meta: {
          completionId: result.id,
          completionMethod: row.completion_method,
          activityCompletion: true,
          updatedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }).eq("id", effectiveStepSubId);
    }

    return NextResponse.json({ completion: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stepSubmissionId = searchParams.get("stepSubmissionId");
    const generatedActivityId = searchParams.get("generatedActivityId");
    const patientId = searchParams.get("patientId");

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ completions: [] });

    let q = admin.from("activity_completions").select("*, generated_activities:generated_activity_id(*)").order("created_at", { ascending: false });
    if (stepSubmissionId) q = q.eq("step_submission_id", stepSubmissionId);
    if (generatedActivityId) q = q.eq("generated_activity_id", generatedActivityId);
    if (patientId) q = q.eq("patient_id", patientId);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return NextResponse.json({ completions: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
