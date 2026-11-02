import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/hipaa/audit";

async function ownsSubmissionPatient(admin: NonNullable<ReturnType<typeof createAdminClient>>, submissionId: string, requesterId: string) {
  const { data: sub } = await admin.from("submissions").select("patient_id").eq("id", submissionId).maybeSingle();
  if (!sub?.patient_id) return false;
  const { data: pat } = await admin.from("patients").select("client_user_id, therapist_id").eq("id", sub.patient_id).maybeSingle();
  if (!pat) return false;
  return pat.client_user_id === requesterId || pat.therapist_id === requesterId;
}
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get("submissionId");
    const reviewId = searchParams.get("reviewId") || searchParams.get("id");
    const requesterId = searchParams.get("requesterId") || searchParams.get("therapistId") || req.headers.get("x-requester-id");

    if (!submissionId && !reviewId) {
      return NextResponse.json({ error: "submissionId or reviewId is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured. Run migrations." }, { status: 503 });
    }

    let query = admin.from("submission_reviews").select(`
        *,
        step_reviews(*),
        submission:submissions(*, program:home_programs(*, steps:program_steps(*)), step_submissions(*))
      `);

    if (submissionId) {
      query = query.eq("submission_id", submissionId);
    } else if (reviewId) {
      query = query.eq("id", reviewId);
    }

    const { data: dbReview, error } = await query.maybeSingle();

    if (!error && dbReview) {
      if (requesterId) {
        const sid = (dbReview.submission_id as string) || submissionId;
        if (sid) {
          const ok = await ownsSubmissionPatient(admin, sid as string, requesterId);
          if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
      }
      return NextResponse.json({ review: dbReview });
    }

    return NextResponse.json({ review: null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      submissionId,
      reviewId,
      stepReviews,
      overallFeedback,
      sessionRecordingUrl,
      session_recording_url,
      subjective,
      objective,
      assessment,
      assessmentLinks,
      assessment_links,
      plan,
      clientSummary,
      client_summary,
      confirmedObservationIds,
      stepSubmissionId,
    } = body;

    const effectiveRecordingUrl = sessionRecordingUrl !== undefined
      ? (sessionRecordingUrl ? sessionRecordingUrl.trim() : null)
      : (session_recording_url !== undefined ? (session_recording_url ? session_recording_url.trim() : null) : undefined);
    const effectiveAssessmentLinks = assessmentLinks !== undefined
      ? assessmentLinks
      : (assessment_links !== undefined ? assessment_links : undefined);

    const effectiveClientSummary = clientSummary || client_summary;
    let synthesizedFeedback = overallFeedback;
    if (!synthesizedFeedback && (subjective || objective || assessment || plan || effectiveClientSummary)) {
      synthesizedFeedback = effectiveClientSummary || [
        subjective ? `S: ${subjective}` : "",
        objective ? `O: ${objective}` : "",
        assessment ? `A: ${assessment}` : "",
        plan ? `P: ${plan}` : "",
      ].filter(Boolean).join("\n\n");
    }

    let therapistId = body.therapistId || body.requesterId || req.headers.get("x-requester-id") || null;
    if (!therapistId) {
      try {
        const serverClient = await createServerClient();
        if (serverClient) {
          const { data: { user } } = await serverClient.auth.getUser();
          if (user?.id) therapistId = user.id;
        }
      } catch {
        // ignore
      }
    }
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured. Run migrations." }, { status: 503 });
    }
    if (!therapistId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (submissionId && therapistId) {
      const okReview = await ownsSubmissionPatient(admin, submissionId, therapistId);
      if (!okReview) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 1. CONFIRM OBSERVATIONS
    if (action === "confirm_observation" && stepSubmissionId) {
      try {
        await admin
          .from("ai_analyses")
          .update({
            confirmed_observations: confirmedObservationIds || [],
            updated_at: new Date().toISOString(),
          })
          .eq("step_submission_id", stepSubmissionId);
      } catch {
        // non-fatal
      }

      return NextResponse.json({ success: true });
    }

    // 2. SAVE DRAFT REVIEW OR PUBLISH FEEDBACK
    if (!submissionId) {
      return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
    }

    const isPublish = action === "publish" || (body.publish === true && action !== "save_draft");

    // Upsert submission review (idempotent ON CONFLICT submission_id)
    const reviewPayload: Record<string, unknown> = {
      submission_id: submissionId,
      therapist_id: therapistId,
      status: isPublish ? "published" : "draft",
      updated_at: new Date().toISOString(),
    };
    if (synthesizedFeedback !== undefined) reviewPayload.overall_feedback = synthesizedFeedback;
    if (effectiveRecordingUrl !== undefined) reviewPayload.session_recording_url = effectiveRecordingUrl;
    if (subjective !== undefined) reviewPayload.subjective = subjective;
    if (objective !== undefined) reviewPayload.objective = objective;
    if (assessment !== undefined) reviewPayload.assessment = assessment;
    if (effectiveAssessmentLinks !== undefined) reviewPayload.assessment_links = effectiveAssessmentLinks;
    if (plan !== undefined) reviewPayload.plan = plan;
    if (effectiveClientSummary !== undefined) reviewPayload.client_summary = effectiveClientSummary;
    if (isPublish) reviewPayload.published_at = new Date().toISOString();

    let dbReview: { id: string; [key: string]: unknown } | null = null;
    try {
      const { data, error } = await admin
        .from("submission_reviews")
        .upsert(reviewPayload, { onConflict: "submission_id" })
        .select()
        .single();
      if (error) throw error;
      dbReview = data;
    } catch {
      // In case columns are not yet added in remote DB, fallback to upserting without newly added columns
      delete reviewPayload.session_recording_url;
      delete reviewPayload.assessment_links;
      delete reviewPayload.subjective;
      delete reviewPayload.objective;
      delete reviewPayload.assessment;
      delete reviewPayload.plan;
      delete reviewPayload.client_summary;
      const { data, error } = await admin
        .from("submission_reviews")
        .upsert(reviewPayload, { onConflict: "submission_id" })
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      dbReview = data;
    }

    if (dbReview && Array.isArray(stepReviews)) {
      for (const sr of stepReviews) {
        if (sr.stepSubmissionId) {
          await admin.from("step_reviews").upsert(
            {
              review_id: dbReview.id,
              step_submission_id: sr.stepSubmissionId,
              therapist_note: sr.note || "",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "review_id,step_submission_id" }
          );
        }
      }
    }

    if (isPublish) {
      await admin
        .from("submissions")
        .update({
          state: "reviewed",
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", submissionId);
    }

    // HIPAA Audit Log for Submission Review (45 CFR § 164.312(b))
    await logAuditEvent({
      userId: therapistId,
      userRole: "therapist",
      action: isPublish ? "EPHI_UPDATE" : "EPHI_CREATE",
      resourceType: "submission_reviews",
      resourceId: dbReview?.id as string | undefined,
      details: {
        submissionId,
        status: isPublish ? "published" : "draft",
        hasRecordingUrl: Boolean(effectiveRecordingUrl),
        assessmentLinksCount: Array.isArray(effectiveAssessmentLinks) ? effectiveAssessmentLinks.length : 0,
      },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      success: true,
      review: dbReview,
      submissionState: isPublish ? "reviewed" : "submitted",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
