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
      textResponse,
      checklistState,
      completionMethod,
      scheduledDate,
      programId,
    } = body;

    if (!generatedActivityId || !patientId) {
      return NextResponse.json({ error: "generatedActivityId and patientId required" }, { status: 400 });
    }
    let canonicalPatientId: string = String(patientId);

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "DB not configured — run migrations 05/06" }, { status: 503 });
    }

    // Verify ownership: clientId must own patientId, or therapist owns patient
    if (clientId) {
      let patient: any = null;
      {
        const { data } = await admin.from("patients").select("id, client_user_id, therapist_id").eq("id", patientId).maybeSingle();
        if (data) patient = data;
        else {
          const { data: byClient } = await admin.from("patients").select("id, client_user_id, therapist_id").eq("client_user_id", patientId).maybeSingle();
          if (byClient) patient = byClient;
        }
      }
      if (!patient) return NextResponse.json({ error: "Patient not found — no patient linked to this account" }, { status: 404 });
      canonicalPatientId = patient.id;
      const isOwner = patient.client_user_id === clientId;
      // Also allow if patient is linked via invitation/does not yet have client_user_id but email matches — handled via therapist ownership fallback
      if (!isOwner) {
        // Check if requester is the therapist for this patient (therapist creating completion on behalf)
        // If clientId does not match, we require it to be the therapist_id
        const isTherapistOwner = patient.therapist_id === clientId;
        if (!isTherapistOwner) {
          return NextResponse.json({ error: "Forbidden: patient does not belong to this client" }, { status: 403 });
        }
      }
    }

    // Verify activity is assigned to this patient's home program (prevents stray submissions to unassigned activities)
    {
      const { data: programs } = await admin.from("home_programs").select("id").eq("patient_id", canonicalPatientId);
      const progIds = (programs || []).map(p => p.id);
      if (progIds.length > 0) {
        const { data: linked } = await admin.from("program_steps").select("id").in("program_id", progIds).eq("generated_activity_id", generatedActivityId).limit(1);
        // If not linked via program_steps, allow only if generated_activities.patient_id matches (origin) — still attached check via origin
        if (!linked || linked.length === 0) {
          const { data: act } = await admin.from("generated_activities").select("patient_id, creator_id").eq("id", generatedActivityId).maybeSingle();
          if (act && act.patient_id !== canonicalPatientId) {
            // Not assigned via Home Program → block private data leak across patients
            return NextResponse.json({ error: "Activity not assigned to this home program" }, { status: 403 });
          }
        }
      }
    }

    // Ensure step_submission exists: if stepSubmissionId missing but programId given,
    // try to create/find draft submission flow (use same as client program runner)
    let effectiveStepSubId: string | null = stepSubmissionId || null;

    // Create/update activity_completion
    const isWritten = typeof textResponse === "string" || Array.isArray(checklistState);
    const row: Record<string, unknown> = {
      generated_activity_id: generatedActivityId,
      step_submission_id: effectiveStepSubId,
      patient_id: canonicalPatientId,
      client_id: clientId || null,
      drawing_data_url: drawingDataUrl ? String(drawingDataUrl).slice(0, 5000000) : null, // cap
      drawing_storage_path: drawingStoragePath || null,
      drawing_strokes: drawingStrokes || [],
      photo_upload_path: photoUploadPath || null,
      text_response: typeof textResponse === "string" ? String(textResponse).slice(0, 10000) : null,
      checklist_state: Array.isArray(checklistState) ? checklistState : [],
      completion_method: completionMethod || (photoUploadPath ? "photo" : isWritten ? "text" : "canvas"),
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
    const requesterId = searchParams.get("requesterId") || searchParams.get("clientUserId") || searchParams.get("clientId");

    const admin = createAdminClient();
    if (!admin) {
      if (patientId || stepSubmissionId || generatedActivityId) {
        return NextResponse.json({ error: "Database not configured — run Supabase migrations", code: "DB_NOT_CONFIGURED" }, { status: 503 });
      }
      return NextResponse.json({ completions: [] });
    }

    // Ownership check when patientId is filtered: requester must own that patient
    if (patientId && requesterId) {
      let pat: any = null;
      {
        const { data } = await admin.from("patients").select("client_user_id, therapist_id").eq("id", patientId).maybeSingle();
        if (data) pat = data;
        else {
          const { data: byClient } = await admin.from("patients").select("client_user_id, therapist_id").eq("client_user_id", patientId).maybeSingle();
          if (byClient) pat = byClient;
        }
      }
      if (!pat) return NextResponse.json({ error: "Patient not found — no patient linked to this account yet." }, { status: 404 });
      const owns = pat.client_user_id === requesterId || pat.therapist_id === requesterId;
      if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (patientId && !requesterId) {
      // Require proof for patient-scoped listing — without requester, deny to prevent patientId guessing
      // Exception: stepSubmissionId path below will verify via submission ownership
      if (!stepSubmissionId) return NextResponse.json({ error: "requesterId required — pass your user id as requesterId or clientUserId" }, { status: 403 });
    }

    // When stepSubmissionId is given, verify it belongs to requester’s patient if requester supplied
    if (stepSubmissionId && requesterId && admin) {
      const { data: ss } = await admin.from("step_submissions").select("submission_id").eq("id", stepSubmissionId).maybeSingle();
      if (ss?.submission_id) {
        const { data: sub } = await admin.from("submissions").select("patient_id").eq("id", ss.submission_id).maybeSingle();
        if (sub?.patient_id) {
          const { data: pat } = await admin.from("patients").select("client_user_id, therapist_id").eq("id", sub.patient_id).maybeSingle();
          if (pat && pat.client_user_id !== requesterId && pat.therapist_id !== requesterId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }
        }
      }
    }

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
