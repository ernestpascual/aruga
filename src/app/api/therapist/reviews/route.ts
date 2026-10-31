import { NextRequest, NextResponse } from "next/server";
import { getMockStore, DEMO_THERAPIST_ID } from "@/lib/supabase/mock-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/hipaa/audit";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get("submissionId");
    const reviewId = searchParams.get("reviewId") || searchParams.get("id");

    if (!submissionId && !reviewId) {
      return NextResponse.json({ error: "submissionId or reviewId is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    if (admin) {
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
        return NextResponse.json({ review: dbReview });
      }
    }

    // Fallback in-memory
    const store = getMockStore();
    const review = store.reviews.find(
      (r) => (submissionId && r.submission_id === submissionId) || (reviewId && r.id === reviewId)
    );

    if (review) {
      const stepRevs = store.stepReviews.filter((sr) => sr.review_id === review.id);
      return NextResponse.json({
        review: {
          ...review,
          step_reviews: stepRevs,
        },
      });
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

    const store = getMockStore();
    let therapistId = body.therapistId;
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
    if (!therapistId) therapistId = DEMO_THERAPIST_ID;
    const admin = createAdminClient();

    // 1. CONFIRM OBSERVATIONS
    if (action === "confirm_observation" && stepSubmissionId) {
      if (admin) {
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
      }

      const aiRec = store.aiAnalyses.find(
        (a) => a.step_submission_id === stepSubmissionId
      );
      if (aiRec) {
        aiRec.confirmed_observations = confirmedObservationIds || [];
        if (aiRec.spark_results?.observations) {
          aiRec.spark_results.observations.forEach((obs) => {
            obs.confirmed = (confirmedObservationIds || []).includes(obs.id);
          });
        }
      }
      return NextResponse.json({ success: true, aiRecord: aiRec });
    }

    // 2. SAVE DRAFT REVIEW OR PUBLISH FEEDBACK
    if (!submissionId) {
      return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
    }

    const isPublish = action === "publish" || (body.publish === true && action !== "save_draft");

    if (admin) {
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
        if (!error) dbReview = data;
      } catch {
        // In case columns are not yet added in remote DB, fallback to upserting without newly added columns
        delete reviewPayload.session_recording_url;
        delete reviewPayload.assessment_links;
        delete reviewPayload.subjective;
        delete reviewPayload.objective;
        delete reviewPayload.assessment;
        delete reviewPayload.plan;
        delete reviewPayload.client_summary;
        const { data } = await admin
          .from("submission_reviews")
          .upsert(reviewPayload, { onConflict: "submission_id" })
          .select()
          .single();
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
    }

    // Fallback store
    const submission = store.submissions.find((s) => s.id === submissionId);
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    let review = store.reviews.find((r) => r.submission_id === submissionId);

    if (!review) {
      const newReviewId = reviewId || `rev-${Date.now()}`;
      review = {
        id: newReviewId,
        submission_id: submissionId,
        therapist_id: therapistId,
        overall_feedback: synthesizedFeedback || null,
        session_recording_url: effectiveRecordingUrl || null,
        subjective: subjective || null,
        objective: objective || null,
        assessment: assessment || null,
        assessment_links: effectiveAssessmentLinks || [],
        plan: plan || null,
        client_summary: effectiveClientSummary || null,
        status: isPublish ? "published" : "draft",
        published_at: isPublish ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.reviews.push(review);
    } else {
      if (synthesizedFeedback !== undefined) review.overall_feedback = synthesizedFeedback;
      if (effectiveRecordingUrl !== undefined) review.session_recording_url = effectiveRecordingUrl;
      if (subjective !== undefined) review.subjective = subjective;
      if (objective !== undefined) review.objective = objective;
      if (assessment !== undefined) review.assessment = assessment;
      if (effectiveAssessmentLinks !== undefined) review.assessment_links = effectiveAssessmentLinks;
      if (plan !== undefined) review.plan = plan;
      if (effectiveClientSummary !== undefined) review.client_summary = effectiveClientSummary;
      if (isPublish) {
        review.status = "published";
        review.published_at = new Date().toISOString();
      } else if (action === "save_draft" || body.publish === false) {
        review.status = "draft";
      }
    }

    // HIPAA Audit Log for Fallback Store
    await logAuditEvent({
      userId: therapistId,
      userRole: "therapist",
      action: isPublish ? "EPHI_UPDATE" : "EPHI_CREATE",
      resourceType: "submission_reviews",
      resourceId: review.id,
      patientId: submission.patient_id,
      details: {
        submissionId,
        status: isPublish ? "published" : "draft",
        hasRecordingUrl: Boolean(effectiveRecordingUrl),
        assessmentLinksCount: Array.isArray(effectiveAssessmentLinks) ? effectiveAssessmentLinks.length : 0,
        mock: true,
      },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    // Update step reviews (deduplicated by step_submission_id)
    if (Array.isArray(stepReviews)) {
      for (const sr of stepReviews) {
        const existingSr = store.stepReviews.find(
          (r) => r.review_id === review!.id && r.step_submission_id === sr.stepSubmissionId
        );
        if (existingSr) {
          existingSr.therapist_note = sr.note || "";
          existingSr.updated_at = new Date().toISOString();
        } else {
          store.stepReviews.push({
            id: `sr-${Date.now()}-${Math.random()}`,
            review_id: review.id,
            step_submission_id: sr.stepSubmissionId,
            therapist_note: sr.note || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    if (isPublish) {
      submission.state = "reviewed";
      submission.reviewed_at = new Date().toISOString();
      submission.updated_at = new Date().toISOString();
    }

    return NextResponse.json({
      success: true,
      review,
      submissionState: submission.state,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
